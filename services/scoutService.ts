import { ScoutResult, ScoutInspiration, Brand, StyleAnalysis } from '../types';
import { analyzeImageStyle, generateBrandedImage, generateSmartSearchQueries, scoreDesignQuality } from './geminiService';

const SUPABASE_URL = 'https://yvsvxurquhtzaeuszwtb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2c3Z4dXJxdWh0emFldXN6d3RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNDE2MjAsImV4cCI6MjA4OTkxNzYyMH0.7xSR9mazaNDOmsTbotldB_yO3utM_UlDHyglOzmF1nI';

// Backend endpoints - Python scraper (primary) → Supabase Edge Function (fallback)
const SCRAPER_URL = 'http://localhost:8899';
const EDGE_FN_URL = `${SUPABASE_URL}/functions/v1/content-scout`;

// Detect which backend is available
let _backendUrl: string | null = null;

async function getBackendUrl(): Promise<string> {
  if (_backendUrl) return _backendUrl;

  // Try Python scraper first (Scrapling - better anti-bot)
  try {
    const resp = await fetch(`${SCRAPER_URL}/health`, { signal: AbortSignal.timeout(2000) });
    if (resp.ok) {
      _backendUrl = SCRAPER_URL;
      console.log('🔍 Scout: Using Python Scrapling backend');
      return _backendUrl;
    }
  } catch {}

  // Fallback to Supabase Edge Function
  _backendUrl = EDGE_FN_URL;
  console.log('🔍 Scout: Using Supabase Edge Function backend');
  return _backendUrl;
}

// Reset backend detection (e.g., if Python server starts later)
export function resetBackendDetection() {
  _backendUrl = null;
}

// Supabase REST API helper
async function supabaseRest(table: string, method: string, body?: any, query?: string) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query ? `?${query}` : ''}`;
  const headers: Record<string, string> = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal',
  };

  const resp = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Supabase error: ${resp.status} ${text}`);
  }

  const contentType = resp.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return resp.json();
  }
  return null;
}

// Search for inspiration images (with pagination)
export async function searchInspiration(
  query: string,
  sources: string[] = ['duckduckgo', 'pinterest', 'google'],
  industry?: string,
  page: number = 0
): Promise<{ results: ScoutResult[]; sourcesReport: Record<string, number>; hasMore: boolean }> {
  const backend = await getBackendUrl();

  try {
    let resp: Response;

    if (backend === SCRAPER_URL) {
      // Python FastAPI endpoint
      resp = await fetch(`${backend}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, sources, industry: industry || '', page }),
      });
    } else {
      // Supabase Edge Function
      resp = await fetch(backend, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'search', query, sources, industry: industry || '' }),
      });
    }

    if (!resp.ok) throw new Error(`Search failed: ${resp.status}`);
    const data = await resp.json();

    return {
      results: (data.results || []).map((r: any, i: number) => ({
        ...r,
        id: `scout-${Date.now()}-${page}-${i}`,
      })),
      sourcesReport: data.sources_report || {},
      hasMore: data.has_more ?? true,
    };
  } catch (err) {
    console.error('Scout search error:', err);
    // If Python failed, try Edge Function as fallback
    if (backend === SCRAPER_URL) {
      _backendUrl = null;
      console.log('Scrapling backend failed, trying Edge Function...');
      return searchInspiration(query, sources, industry, page);
    }
    return { results: [], sourcesReport: {}, hasMore: false };
  }
}

// Download an image via proxy (CORS bypass)
export async function downloadImage(imageUrl: string): Promise<{ base64: string; mimeType: string }> {
  const backend = await getBackendUrl();

  let resp: Response;
  if (backend === SCRAPER_URL) {
    resp = await fetch(`${backend}/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: imageUrl }),
    });
  } else {
    resp = await fetch(backend, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'proxy', url: imageUrl }),
    });
  }

  if (!resp.ok) throw new Error(`Proxy failed: ${resp.status}`);
  return resp.json();
}

// Full scout pipeline: search → download → analyze → adapt → save
export async function scoutAndAdapt(
  imageBase64: string,
  brand: Brand,
  topic: string,
  aspectRatio: string = '1:1',
  onProgress?: (step: string, progress: number) => void
): Promise<{ analysis: StyleAnalysis; adaptedImage: string }> {
  // Step 1: Analyze style
  onProgress?.('Stil analiz ediliyor...', 20);
  const analysis = await analyzeImageStyle(imageBase64);

  // Step 2: Generate adapted image
  onProgress?.('Marka uyarlaması yapılıyor...', 60);
  const adaptedImage = await generateBrandedImage(
    brand,
    analysis,
    imageBase64,    // referenceImage
    null,           // productImage
    topic,          // contextDescription
    aspectRatio
  );

  onProgress?.('Tamamlandı!', 100);
  return { analysis, adaptedImage };
}

// Save inspiration to Supabase
export async function saveInspiration(data: {
  brandId: string;
  searchQuery: string;
  sourceUrl?: string;
  sourcePlatform: string;
  originalImageBase64?: string;
  adaptedImageBase64?: string;
  styleAnalysis?: StyleAnalysis;
  status: string;
  tags?: string[];
  score?: number;
}): Promise<ScoutInspiration> {
  const result = await supabaseRest('scout_inspirations', 'POST', {
    brand_id: data.brandId,
    search_query: data.searchQuery,
    source_url: data.sourceUrl,
    source_platform: data.sourcePlatform,
    original_image_base64: data.originalImageBase64,
    adapted_image_base64: data.adaptedImageBase64,
    style_analysis: data.styleAnalysis,
    status: data.status,
    tags: data.tags || [],
    score: data.score || 0,
  });

  return mapDbToInspiration(result[0]);
}

// Load saved inspirations from Supabase
export async function loadInspirations(brandId?: string, status?: string): Promise<ScoutInspiration[]> {
  let query = 'order=created_at.desc&limit=50';
  if (brandId) query += `&brand_id=eq.${brandId}`;
  if (status) query += `&status=eq.${status}`;

  const data = await supabaseRest('scout_inspirations', 'GET', undefined, query);
  return (data || []).map(mapDbToInspiration);
}

// Update inspiration status
export async function updateInspirationStatus(id: string, status: string, updates?: Record<string, any>) {
  const body: any = { status };
  if (updates?.adapted_image_base64) body.adapted_image_base64 = updates.adapted_image_base64;
  if (updates?.style_analysis) body.style_analysis = updates.style_analysis;
  body.updated_at = new Date().toISOString();

  await supabaseRest('scout_inspirations', 'PATCH', body, `id=eq.${id}`);
}

// Delete inspiration
export async function deleteInspiration(id: string) {
  await supabaseRest('scout_inspirations', 'DELETE', undefined, `id=eq.${id}`);
}

// Check scout health - tries both backends
export async function checkScoutHealth(): Promise<{
  status: string;
  backend: string;
  sources: Record<string, boolean>;
}> {
  // Try Python scraper
  try {
    const resp = await fetch(`${SCRAPER_URL}/health`, { signal: AbortSignal.timeout(3000) });
    if (resp.ok) {
      const data = await resp.json();
      return {
        status: 'ok',
        backend: 'scrapling',
        sources: {
          duckduckgo: true,
          pinterest: true,
          google: true,
          ...Object.fromEntries((data.sources || []).map((s: string) => [s, true])),
        },
      };
    }
  } catch {}

  // Try Edge Function
  try {
    const resp = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'health' }),
    });
    if (resp.ok) {
      const data = await resp.json();
      return {
        status: 'ok',
        backend: 'edge-function',
        sources: data.sources || {},
      };
    }
  } catch {}

  return { status: 'offline', backend: 'none', sources: {} };
}

// Helper: map DB row to ScoutInspiration
function mapDbToInspiration(row: any): ScoutInspiration {
  return {
    id: row.id,
    brandId: row.brand_id,
    searchQuery: row.search_query,
    sourceUrl: row.source_url,
    sourcePlatform: row.source_platform,
    originalImageBase64: row.original_image_base64,
    adaptedImageBase64: row.adapted_image_base64,
    styleAnalysis: row.style_analysis,
    status: row.status,
    tags: row.tags || [],
    score: row.score || 0,
    createdAt: row.created_at,
  };
}

// Generate search queries - AI-powered with static fallback
export async function generateSearchQueries(brand: Brand): Promise<string[]> {
  try {
    const aiQueries = await generateSmartSearchQueries(brand);
    if (aiQueries.length > 0) return aiQueries;
  } catch (err) {
    console.warn('AI query generation failed, using fallback:', err);
  }

  // Static fallback
  const industryMap: Record<string, string[]> = {
    'Telekomünikasyon': ['tech social media design', 'mobile app promotion post', 'esim travel design', 'telecom marketing visual'],
    'Eğitim': ['education social media post', 'school marketing design', 'student motivation poster', 'academic achievement design'],
    'Okul Öncesi': ['preschool social media', 'kindergarten colorful design', 'child education poster', 'playful school marketing'],
    'Tesettür': ['hijab fashion social media', 'modest fashion post design', 'scarf collection promotion', 'elegant fashion marketing'],
    'İç Mimarlık': ['interior design social media', 'minimalist home design post', 'architecture marketing visual', 'luxury home promotion'],
    'Sınava Hazırlık': ['education motivation post', 'exam preparation design', 'student success social media', 'tutoring center marketing'],
  };

  const queries: string[] = [];
  for (const [key, values] of Object.entries(industryMap)) {
    if (brand.industry.toLowerCase().includes(key.toLowerCase())) {
      queries.push(...values);
      break;
    }
  }

  if (queries.length === 0) {
    queries.push(
      `${brand.industry} social media post design`,
      `${brand.industry} marketing visual`,
      `professional ${brand.industry} promotion design`
    );
  }

  return queries;
}

// AI-powered design quality scoring
// Downloads images, sends to Gemini for scoring, returns scored results
export async function scoreAndRankResults(
  results: ScoutResult[],
  brand: Brand,
  batchSize: number = 6,
  onProgress?: (done: number, total: number) => void
): Promise<{ result: ScoutResult; score: number; reason: string }[]> {
  const scored: { result: ScoutResult; score: number; reason: string }[] = [];

  // Process in batches (Gemini multi-image limit)
  for (let i = 0; i < results.length; i += batchSize) {
    const batch = results.slice(i, i + batchSize);

    // Download thumbnails for scoring
    const images: string[] = [];
    const validResults: ScoutResult[] = [];

    for (const result of batch) {
      try {
        const { base64 } = await downloadImage(result.thumbnailUrl || result.imageUrl);
        images.push(base64);
        validResults.push(result);
      } catch {
        // Skip failed downloads
      }
    }

    if (images.length === 0) continue;

    try {
      const { scores, reasons } = await scoreDesignQuality(images, brand);

      validResults.forEach((result, idx) => {
        scored.push({
          result,
          score: scores[idx] ?? 50,
          reason: reasons[idx] ?? '',
        });
      });
    } catch (err) {
      console.error('Scoring batch failed:', err);
      // Add with default score
      validResults.forEach(result => {
        scored.push({ result, score: 50, reason: 'Puanlama başarısız' });
      });
    }

    onProgress?.(Math.min(i + batchSize, results.length), results.length);
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);
  return scored;
}
