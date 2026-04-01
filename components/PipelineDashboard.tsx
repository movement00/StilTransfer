
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Square, RotateCcw, ChevronRight, CheckCircle2, XCircle,
  Loader2, Clock, Image, Upload, Trash2, Plus, Download, SkipForward,
  Zap, ArrowRight, Settings2, FileText, Sparkles, Compass, Search, X, Check, Star, Edit2, Send
} from 'lucide-react';
import {
  Brand, PipelineConfig, PipelineRun, PipelineStep, PipelineResult,
  PipelineImage, PipelineStepStatus, SavedTemplate, GeneratedAsset, TemplateFolder, ScoutResult
} from '../types';
import { pipelineService } from '../services/pipelineService';
import { resizeImageToRawBase64, generatePipelineTopics, reviseGeneratedImage, adaptRevisedToFormat, reviewCreativeQuality, QualityReview } from '../services/geminiService';
import { downloadBase64Image, downloadMultipleImages } from '../services/downloadService';
import { searchInspiration, downloadImage, scoreAndRankResults } from '../services/scoutService';

// Qoolline Campaign Templates from Banner Texts Excel
const CAMPAIGN_TEMPLATES = [
  {
    id: 'value_conversion',
    type: 'Value / Conversion',
    core: 'Stop Paying Roaming Fees',
    supporting: 'Instant eSIM activation',
    cta: 'Get eSIM',
    extra: 'Fast & Reliable Data',
    notes: 'Clear problem–solution framing. CTA should push toward transaction.',
  },
  {
    id: 'brand_awareness',
    type: 'Brand / Awareness',
    core: 'Seamless Connectivity for Modern Travellers',
    supporting: 'Coverage across 175+ destinations',
    cta: 'Explore Plans',
    extra: 'Easy Set Up & Activation',
    notes: 'Strong brand promise & scale proof. CTA should not be aggressive. Store logos should be removed.',
  },
  {
    id: 'product_performance',
    type: 'Product / Performance',
    core: 'Travel connected. Your eSIM, ready in minutes',
    supporting: 'No roaming fees abroad',
    cta: 'Get eSIM',
    extra: 'Instant eSIM Activation',
    notes: 'Balances emotional travel feel with a concrete benefit.',
  },
  {
    id: 'awareness_app',
    type: 'Awareness / App',
    core: 'The World at Your Fingertips, Wherever You Travel',
    supporting: 'Instant eSIM, Reliable Coverage',
    cta: 'Download',
    extra: 'Simple App for Travel Data',
    notes: 'Brand-led and aspirational. Best for upper funnel or retargeting. Use Download CTA with store logos.',
  },
  {
    id: 'promo_app',
    type: 'Promo / App or Web',
    core: 'Welcome to Seamless Travel Connectivity',
    supporting: 'Use code WELCOME',
    cta: 'Get eSIM',
    extra: 'Easy Set Up',
    notes: 'Clear incentive. CTA must reflect whether the goal is install or purchase.',
  },
  {
    id: 'direct_conversion',
    type: 'Direct Conversion',
    core: '10% off your Travel eSIM',
    supporting: 'Use code WELCOME at checkout',
    cta: 'Explore Plans',
    extra: 'No Roaming Fees / Fast Data',
    notes: 'Pure performance creative. Discount must be the hero, CTA must be transactional.',
  },
];

interface PipelineDashboardProps {
  brands: Brand[];
  templates: SavedTemplate[];
  folders: TemplateFolder[];
  setTemplates: React.Dispatch<React.SetStateAction<SavedTemplate[]>>;
  addToHistory: (asset: GeneratedAsset) => void;
}

const ASPECT_RATIOS = [
  { label: '1:1 Kare', value: '1:1' },
  { label: '4:5 Portre', value: '4:5' },
  { label: '9:16 Story', value: '9:16' },
  { label: '16:9 Yatay', value: '16:9' },
];

const stepIcons: Record<string, React.ReactNode> = {
  analyze: <Zap size={16} />,
  match: <ArrowRight size={16} />,
  generate: <Image size={16} />,
  revise: <RotateCcw size={16} />,
  save: <FileText size={16} />,
};

const statusColors: Record<PipelineStepStatus, string> = {
  idle: 'text-slate-500 bg-slate-500/10',
  running: 'text-blue-400 bg-blue-400/10',
  completed: 'text-emerald-400 bg-emerald-400/10',
  failed: 'text-red-400 bg-red-400/10',
  skipped: 'text-slate-600 bg-slate-600/10',
};

const PipelineDashboard: React.FC<PipelineDashboardProps> = ({
  brands, templates, folders, setTemplates, addToHistory
}) => {
  // Config state
  const [selectedBrandId, setSelectedBrandId] = useState(brands[0]?.id || '');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [selectedFormats, setSelectedFormats] = useState<Set<string>>(new Set(['1:1']));
  const [topicsText, setTopicsText] = useState('');
  const [referenceImages, setReferenceImages] = useState<PipelineImage[]>([]);
  const [productImages, setProductImages] = useState<PipelineImage[]>([]);
  // autoRevise removed — Kreatif Beyin always active
  const [revisionPrompt, setRevisionPrompt] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(true);
  const [pipelineName, setPipelineName] = useState('');
  const [creativeTone, setCreativeTone] = useState('');

  // Revision state
  const [bulkRevisionPrompt, setBulkRevisionPrompt] = useState('');
  const [isRevising, setIsRevising] = useState(false);
  const [revisingIds, setRevisingIds] = useState<Set<string>>(new Set());
  const [singleRevisionPrompts, setSingleRevisionPrompts] = useState<Record<string, string>>({});
  const [expandedRevision, setExpandedRevision] = useState<string | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());

  // AI Topics state
  const [isGeneratingTopics, setIsGeneratingTopics] = useState(false);
  const [topicCount, setTopicCount] = useState(5);

  // Quality Control state
  const [qcReviews, setQcReviews] = useState<Record<string, QualityReview>>({});
  const [qcReviewingIds, setQcReviewingIds] = useState<Set<string>>(new Set());
  const [qcBulkRunning, setQcBulkRunning] = useState(false);

  // Scout Picker state
  const [showScoutPicker, setShowScoutPicker] = useState<'reference' | 'product' | null>(null);
  const [scoutQuery, setScoutQuery] = useState('');
  const [scoutResults, setScoutResults] = useState<ScoutResult[]>([]);
  const [isScoutSearching, setIsScoutSearching] = useState(false);
  const [scoutSelected, setScoutSelected] = useState<Set<string>>(new Set());
  const [isScoutDownloading, setIsScoutDownloading] = useState(false);
  const [scoredResults, setScoredResults] = useState<Map<string, { score: number; reason: string }>>(new Map());
  const [isScoring, setIsScoring] = useState(false);
  const [scoutPage, setScoutPage] = useState(0);
  const [scoutHasMore, setScoutHasMore] = useState(true);
  const [isLoadingMoreScout, setIsLoadingMoreScout] = useState(false);

  // Run state
  const [currentRun, setCurrentRun] = useState<PipelineRun | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // Refs
  const logsEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to pipeline events
  useEffect(() => {
    const unsub = pipelineService.subscribe((event) => {
      if (event.type === 'log') {
        setLogs(prev => [...prev, `[${new Date(event.timestamp).toLocaleTimeString('tr-TR')}] ${event.data.message}`]);
      } else if (event.type === 'run-update') {
        setCurrentRun({ ...event.data.run });
        if (event.data.run.status === 'completed' || event.data.run.status === 'failed' || event.data.run.status === 'paused') {
          setIsRunning(false);
        }
      } else if (event.type === 'step-update') {
        setCurrentRun(prev => prev ? { ...prev, steps: [...event.data.steps] } : null);
      } else if (event.type === 'result-update') {
        setCurrentRun(prev => prev ? { ...prev, results: [...event.data.results] } : null);
      }
    });
    return unsub;
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Save completed results to history
  useEffect(() => {
    if (currentRun?.status === 'completed') {
      currentRun.results.forEach(r => {
        const imgData = r.revisedImageBase64 || r.generatedImageBase64;
        if (imgData) {
          addToHistory({
            id: `pipeline-${r.id}-${Date.now()}`,
            url: imgData,
            promptUsed: r.topic,
            brandId: selectedBrandId,
            createdAt: Date.now(),
          });
        }
      });

      // Save templates if configured
      if (saveAsTemplate) {
        const newTemplates: SavedTemplate[] = [];
        const seenStyles = new Set<string>();
        currentRun.results.forEach(r => {
          if (r.referenceImageId && !seenStyles.has(r.referenceImageId)) {
            seenStyles.add(r.referenceImageId);
            const refImg = referenceImages.find(img => img.id === r.referenceImageId);
            if (refImg && r.styleAnalysis?.composition) {
              newTemplates.push({
                id: `tpl-pipeline-${Date.now()}-${r.referenceImageId}`,
                name: `Pipeline: ${pipelineName || 'Otomatic'} - ${refImg.name}`,
                thumbnail: refImg.base64,
                analysis: r.styleAnalysis,
                createdAt: Date.now(),
              });
            }
          }
        });
        if (newTemplates.length > 0) {
          setTemplates(prev => [...newTemplates, ...prev]);
        }
      }
    }
  }, [currentRun?.status]);

  // Image upload handler
  const handleImageUpload = useCallback(async (
    files: FileList | null,
    setter: React.Dispatch<React.SetStateAction<PipelineImage[]>>
  ) => {
    if (!files) return;
    const newImages: PipelineImage[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const base64 = await resizeImageToRawBase64(file, 1200);
        newImages.push({
          id: `img-${Date.now()}-${i}`,
          base64,
          name: file.name,
        });
      } catch (err) {
        console.error('Image upload error:', err);
      }
    }
    setter(prev => [...prev, ...newImages]);
  }, []);

  // AI Topic Generation
  const handleGenerateTopics = async () => {
    const brand = brands.find(b => b.id === selectedBrandId);
    if (!brand) return;
    setIsGeneratingTopics(true);
    try {
      // Pass reference images so AI can analyze them and generate matching topics
      const refs = referenceImages.length > 0
        ? referenceImages.map(img => ({ base64: img.base64, name: img.name }))
        : undefined;
      const generated = await generatePipelineTopics(brand, topicCount, aspectRatio, refs, creativeTone || undefined);
      if (generated.length > 0) {
        setTopicsText(generated.join('\n'));
      } else {
        setTopicsText('');
        alert('Konu üretilemedi. API anahtarınızı kontrol edin.');
      }
    } catch (err: any) {
      console.error('Topic generation error:', err);
      if (err.message?.includes('API_KEY_MISSING')) {
        alert('Gemini API anahtarı bulunamadı. Sol menüden API Ayarları\'na girin.');
      } else {
        alert(`Konu üretme hatası: ${err.message || 'Bilinmeyen hata'}`);
      }
    } finally {
      setIsGeneratingTopics(false);
    }
  };

  // Scout Search
  const handleScoutSearch = async () => {
    if (!scoutQuery.trim()) return;
    setIsScoutSearching(true);
    setScoutResults([]);
    setScoredResults(new Map());
    setScoutSelected(new Set());
    setScoutPage(0);
    setScoutHasMore(true);
    try {
      const { results, hasMore } = await searchInspiration(
        scoutQuery,
        ['duckduckgo', 'pinterest', 'google'],
        selectedBrand?.industry,
        0
      );
      setScoutResults(results);
      setScoutHasMore(hasMore && results.length > 0);
      // Auto-score results
      if (results.length > 0 && selectedBrand) {
        setIsScoring(true);
        try {
          const scored = await scoreAndRankResults(results.slice(0, 18), selectedBrand, 6);
          const scoreMap = new Map<string, { score: number; reason: string }>();
          scored.forEach(s => scoreMap.set(s.result.id, { score: s.score, reason: s.reason }));
          setScoredResults(scoreMap);
          // Re-sort results by score
          const sortedResults = [...results].sort((a, b) => {
            const scoreA = scoreMap.get(a.id)?.score ?? 0;
            const scoreB = scoreMap.get(b.id)?.score ?? 0;
            return scoreB - scoreA;
          });
          setScoutResults(sortedResults);
        } catch {} finally {
          setIsScoring(false);
        }
      }
    } catch (err) {
      console.error('Scout search error:', err);
    } finally {
      setIsScoutSearching(false);
    }
  };

  // Scout: Load more results
  const handleScoutLoadMore = async () => {
    if (isLoadingMoreScout || !scoutHasMore) return;
    setIsLoadingMoreScout(true);
    const nextPage = scoutPage + 1;
    try {
      const { results, hasMore } = await searchInspiration(
        scoutQuery,
        ['duckduckgo', 'pinterest', 'google'],
        selectedBrand?.industry,
        nextPage
      );
      if (results.length > 0) {
        const existingUrls = new Set(scoutResults.map(r => r.imageUrl));
        const newResults = results.filter(r => !existingUrls.has(r.imageUrl));
        setScoutResults(prev => [...prev, ...newResults]);
        setScoutPage(nextPage);
        setScoutHasMore(hasMore && newResults.length > 0);
      } else {
        setScoutHasMore(false);
      }
    } catch (err) {
      console.error('Load more error:', err);
    } finally {
      setIsLoadingMoreScout(false);
    }
  };

  // Scout: Add selected images to pipeline
  const handleScoutAddSelected = async () => {
    if (scoutSelected.size === 0) return;
    setIsScoutDownloading(true);
    const targetSetter = showScoutPicker === 'product' ? setProductImages : setReferenceImages;

    for (const id of scoutSelected) {
      const result = scoutResults.find(r => r.id === id);
      if (!result) continue;
      try {
        const { base64 } = await downloadImage(result.thumbnailUrl || result.imageUrl);
        targetSetter(prev => [...prev, {
          id: `scout-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          base64,
          name: result.title || 'Scout Image',
        }]);
      } catch (err) {
        console.error('Download failed:', err);
      }
    }

    setIsScoutDownloading(false);
    setShowScoutPicker(null);
    setScoutResults([]);
    setScoutSelected(new Set());
    setScoutQuery('');
  };

  const toggleScoutSelect = (id: string) => {
    setScoutSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Start pipeline
  const startPipeline = async () => {
    const brand = brands.find(b => b.id === selectedBrandId);
    if (!brand) return;

    const topics = topicsText.split('\n').map(t => t.trim()).filter(Boolean);
    if (topics.length === 0 || referenceImages.length === 0) return;

    setLogs([]);
    setIsRunning(true);

    const config: PipelineConfig = {
      id: `config-${Date.now()}`,
      name: pipelineName || `Pipeline ${new Date().toLocaleString('tr-TR')}`,
      brandId: selectedBrandId,
      aspectRatio,
      aspectRatios: [...selectedFormats],
      topics,
      referenceImages,
      productImages,
      autoRevise: true, // Kreatif Beyin always active
      revisionPrompt: undefined,
      saveAsTemplate,
      creativeTone: creativeTone || undefined,
      createdAt: Date.now(),
    };

    await pipelineService.execute(config, brand);
  };

  const stopPipeline = () => {
    pipelineService.abort();
  };

  const resetPipeline = () => {
    setCurrentRun(null);
    setLogs([]);
    setIsRunning(false);
  };

  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  const downloadAllResults = async () => {
    if (!currentRun || isDownloadingAll) return;
    setIsDownloadingAll(true);

    const items = currentRun.results
      .map((r, i) => ({ base64: (r.revisedImageBase64 || r.generatedImageBase64)!, filename: `pipeline-${i + 1}-${r.topic.slice(0, 30)}.png` }))
      .filter(item => item.base64);

    await downloadMultipleImages(items);
    setIsDownloadingAll(false);
  };

  // ═══ GROUP RESULTS BY BASE TOPIC ═══
  const getBaseTopic = (topic: string) => topic.replace(/\s*\[.*?\]\s*$/, '');
  const getAspectRatio = (topic: string) => {
    const match = topic.match(/\[([\d]+:[\d]+)\]/);
    return match ? match[1] : undefined;
  };

  const resultGroups: Record<string, PipelineResult[]> = currentRun ? (() => {
    const groups: Record<string, PipelineResult[]> = {};
    currentRun.results.forEach(r => {
      const base = getBaseTopic(r.topic);
      if (!groups[base]) groups[base] = [];
      groups[base].push(r);
    });
    return groups;
  })() : {};

  const toggleGroup = (baseTopic: string) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (next.has(baseTopic)) next.delete(baseTopic);
      else next.add(baseTopic);
      return next;
    });
  };

  const selectAllGroups = () => {
    const allTopics = Object.keys(resultGroups).filter(t =>
      resultGroups[t].some(r => r.generatedImageBase64 || r.revisedImageBase64)
    );
    setSelectedGroups(prev =>
      prev.size === allTopics.length ? new Set() : new Set(allTopics)
    );
  };

  // ═══ REVISION HANDLERS ═══
  // Chained revision: revise first image → adapt revised to other formats (like initial generation)
  const handleGroupRevision = async () => {
    if (!currentRun || !bulkRevisionPrompt.trim() || selectedGroups.size === 0) return;
    const brand = brands.find(b => b.id === selectedBrandId);

    setIsRevising(true);
    const allIds: string[] = [];
    selectedGroups.forEach(baseTopic => {
      resultGroups[baseTopic]?.forEach(r => allIds.push(r.id));
    });
    setRevisingIds(new Set(allIds));

    for (const baseTopic of [...selectedGroups]) {
      const group = resultGroups[baseTopic as string];
      if (!group || group.length === 0) continue;

      // Step 1: Revise the FIRST image (master) in the group
      const primary = group[0];
      const primarySource = primary.revisedImageBase64 || primary.generatedImageBase64;
      if (!primarySource) continue;
      const primaryAspectRatio = getAspectRatio(primary.topic);

      let revisedPrimary: string | null = null;
      try {
        revisedPrimary = await reviseGeneratedImage(primarySource, bulkRevisionPrompt, null, primaryAspectRatio, brand?.logo);
        setCurrentRun(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            results: prev.results.map(r =>
              r.id === primary.id ? { ...r, revisedImageBase64: revisedPrimary! } : r
            ),
          };
        });
      } catch (err: any) {
        console.error(`Revision failed for primary ${primary.id}:`, err);
      }

      setRevisingIds(prev => { const n = new Set(prev); n.delete(primary.id); return n; });

      // Step 2: ADAPT revised primary to sibling formats (same approach as initial generation)
      // This ensures pixel-perfect consistency: same design, different aspect ratio
      if (!revisedPrimary) continue;
      for (let i = 1; i < group.length; i++) {
        const sibling = group[i];
        const siblingAspectRatio = getAspectRatio(sibling.topic);

        try {
          const adaptedSibling = await adaptRevisedToFormat(
            revisedPrimary,
            siblingAspectRatio || '9:16',
            primaryAspectRatio || '1:1',
            brand?.logo
          );
          setCurrentRun(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              results: prev.results.map(r =>
                r.id === sibling.id ? { ...r, revisedImageBase64: adaptedSibling } : r
              ),
            };
          });
        } catch (err: any) {
          console.error(`Adapt failed for sibling ${sibling.id}:`, err);
        }

        setRevisingIds(prev => { const n = new Set(prev); n.delete(sibling.id); return n; });
      }
    }

    setIsRevising(false);
    setBulkRevisionPrompt('');
    setSelectedGroups(new Set());
  };

  // ═══ Quality Control Handlers ═══
  const handleQcSingle = async (resultId: string) => {
    const result = currentRun?.results.find(r => r.id === resultId);
    const brand = brands.find(b => b.id === selectedBrandId);
    const imageData = result?.revisedImageBase64 || result?.generatedImageBase64;
    if (!imageData || !brand) return;

    setQcReviewingIds(prev => new Set(prev).add(resultId));
    try {
      const review = await reviewCreativeQuality(imageData, brand.name);
      setQcReviews(prev => ({ ...prev, [resultId]: review }));
    } catch (err: any) {
      setQcReviews(prev => ({ ...prev, [resultId]: { score: 0, passed: false, issues: [`Denetim hatası: ${err.message}`], revisionInstruction: null } }));
    }
    setQcReviewingIds(prev => { const next = new Set(prev); next.delete(resultId); return next; });
  };

  const handleQcBulk = async () => {
    if (!currentRun) return;
    const brand = brands.find(b => b.id === selectedBrandId);
    if (!brand) return;

    const completedResults = currentRun.results.filter(r => (r.generatedImageBase64 || r.revisedImageBase64) && !qcReviews[r.id]);
    if (completedResults.length === 0) return;

    setQcBulkRunning(true);
    for (const result of completedResults) {
      await handleQcSingle(result.id);
    }
    setQcBulkRunning(false);
  };

  const handleQcRevise = async (resultId: string) => {
    const review = qcReviews[resultId];
    if (!review?.revisionInstruction) return;
    // Use existing single revision logic with QC's instruction
    setSingleRevisionPrompts(prev => ({ ...prev, [resultId]: review.revisionInstruction! }));
    await handleSingleRevision(resultId);
    // Clear the review after revision
    setQcReviews(prev => { const next = { ...prev }; delete next[resultId]; return next; });
  };

  const handleSingleRevision = async (resultId: string, promptOverride?: string) => {
    const prompt = promptOverride || singleRevisionPrompts[resultId];
    if (!currentRun || !prompt?.trim()) return;
    const brand = brands.find(b => b.id === selectedBrandId);

    const result = currentRun.results.find(r => r.id === resultId);
    if (!result) return;
    const resultAspectRatio = getAspectRatio(result.topic);
    const baseTopic = getBaseTopic(result.topic);

    // Find siblings (other formats in same group)
    const siblings = currentRun.results.filter(
      r => r.id !== resultId && getBaseTopic(r.topic) === baseTopic
    );

    // Mark all group members as revising
    const allIds = [resultId, ...siblings.map(s => s.id)];
    setRevisingIds(new Set(allIds));

    const sourceImage = result.revisedImageBase64 || result.generatedImageBase64;
    if (!sourceImage) { setRevisingIds(new Set()); return; }

    let revisedMaster: string | null = null;

    try {
      // Step 1: Revise the target image (master)
      revisedMaster = await reviseGeneratedImage(sourceImage, prompt, null, resultAspectRatio, brand?.logo);
      setCurrentRun(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          results: prev.results.map(r =>
            r.id === resultId ? { ...r, revisedImageBase64: revisedMaster! } : r
          ),
        };
      });
      setRevisingIds(prev => { const n = new Set(prev); n.delete(resultId); return n; });
    } catch (err: any) {
      console.error(`Single revision failed:`, err);
      alert(`Revizyon hatası: ${err.message}`);
      setRevisingIds(new Set());
      return;
    }

    // Step 2: Adapt revised master to sibling formats (consistent design language)
    if (revisedMaster && siblings.length > 0) {
      for (const sibling of siblings) {
        const siblingAspectRatio = getAspectRatio(sibling.topic);
        try {
          const adaptedSibling = await adaptRevisedToFormat(
            revisedMaster,
            siblingAspectRatio || '9:16',
            resultAspectRatio || '1:1',
            brand?.logo
          );
          setCurrentRun(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              results: prev.results.map(r =>
                r.id === sibling.id ? { ...r, revisedImageBase64: adaptedSibling } : r
              ),
            };
          });
        } catch (err: any) {
          console.error(`Adapt sibling failed for ${sibling.id}:`, err);
        }
        setRevisingIds(prev => { const n = new Set(prev); n.delete(sibling.id); return n; });
      }
    }

    setRevisingIds(new Set());
    setSingleRevisionPrompts(prev => ({ ...prev, [resultId]: '', ...(promptOverride ? { [`group-${baseTopic}`]: '' } : {}) }));
    setExpandedRevision(null);
  };

  const selectedBrand = brands.find(b => b.id === selectedBrandId);
  const topics = topicsText.split('\n').map(t => t.trim()).filter(Boolean);
  const canStart = selectedBrandId && topics.length > 0 && referenceImages.length > 0 && !isRunning;

  return (
    <div className="p-4 lg:p-6 h-screen overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-serif text-white flex items-center gap-3">
            <Zap className="text-lumina-gold" size={28} />
            Otomasyon Pipeline
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Blueprint → Eşleştir → Direktif → Üret → Kaydet
          </p>
        </div>
        <div className="flex gap-2">
          {isRunning ? (
            <button onClick={stopPipeline} className="flex items-center gap-2 px-5 py-2.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/30 transition-all">
              <Square size={16} /> Durdur
            </button>
          ) : currentRun ? (
            <>
              <button onClick={resetPipeline} className="flex items-center gap-2 px-5 py-2.5 bg-lumina-900 text-slate-300 border border-lumina-800 rounded-xl hover:bg-lumina-800 transition-all">
                <RotateCcw size={16} /> Sıfırla
              </button>
              {currentRun.status === 'completed' && (
                <>
                  <button onClick={downloadAllResults} disabled={isDownloadingAll} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl hover:bg-emerald-500/30 disabled:opacity-50 transition-all">
                    {isDownloadingAll ? <><Loader2 size={16} className="animate-spin" /> İndiriliyor...</> : <><Download size={16} /> Tümünü İndir</>}
                  </button>
                  <button onClick={handleQcBulk} disabled={qcBulkRunning} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl hover:bg-indigo-500/30 disabled:opacity-50 transition-all">
                    {qcBulkRunning ? <><Loader2 size={16} className="animate-spin" /> Denetleniyor...</> : <><CheckCircle2 size={16} /> Toplu Kalite Kontrol</>}
                  </button>
                </>
              )}
            </>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        {/* LEFT: Configuration Panel */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-5">
            <h3 className="text-white font-medium flex items-center gap-2 mb-4">
              <Settings2 size={18} className="text-lumina-gold" />
              Pipeline Ayarları
            </h3>

            {/* Pipeline Name */}
            <label className="block text-xs text-slate-400 mb-1">Pipeline Adı</label>
            <input
              type="text"
              value={pipelineName}
              onChange={e => setPipelineName(e.target.value)}
              placeholder="Örn: Haftalık Sosyal Medya"
              className="w-full bg-lumina-950 border border-lumina-800 rounded-lg px-3 py-2 text-sm text-white mb-3 focus:outline-none focus:border-lumina-gold/50"
              disabled={isRunning}
            />

            {/* Brand Selection */}
            <label className="block text-xs text-slate-400 mb-1">Marka</label>
            <select
              value={selectedBrandId}
              onChange={e => setSelectedBrandId(e.target.value)}
              className="w-full bg-lumina-950 border border-lumina-800 rounded-lg px-3 py-2 text-sm text-white mb-3 focus:outline-none focus:border-lumina-gold/50"
              disabled={isRunning}
            >
              {brands.map(b => (
                <option key={b.id} value={b.id}>{b.name} — {b.industry}</option>
              ))}
            </select>

            {/* Brand Preview */}
            {selectedBrand && (
              <div className="flex items-center gap-2 mb-3 p-2 bg-lumina-950 rounded-lg border border-lumina-800">
                <div className="flex gap-1">
                  {selectedBrand.palette.slice(0, 5).map((c, i) => (
                    <div key={i} className="w-5 h-5 rounded-full border border-white/10" style={{ backgroundColor: c.hex }} title={c.name} />
                  ))}
                </div>
                <span className="text-xs text-slate-400 ml-auto">{selectedBrand.tone}</span>
              </div>
            )}

            {/* Aspect Ratio (multi-select) */}
            <label className="block text-xs text-slate-400 mb-1">
              Format Seçimi <span className="text-lumina-gold">({selectedFormats.size} format — her konu × {selectedFormats.size} görsel)</span>
            </label>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
              {ASPECT_RATIOS.map(ar => {
                const isSelected = selectedFormats.has(ar.value);
                return (
                  <button
                    key={ar.value}
                    onClick={() => {
                      const next = new Set(selectedFormats);
                      if (isSelected && next.size > 1) {
                        next.delete(ar.value);
                      } else {
                        next.add(ar.value);
                      }
                      setSelectedFormats(next);
                      setAspectRatio([...next][0]); // primary format for topic gen
                    }}
                    className={`text-xs py-1.5 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-lumina-gold/20 border-lumina-gold/50 text-lumina-gold'
                        : 'bg-lumina-950 border-lumina-800 text-slate-400 hover:border-lumina-700'
                    }`}
                    disabled={isRunning}
                  >
                    {isSelected && <span className="mr-1">✓</span>}{ar.label}
                  </button>
                );
              })}
            </div>

            {/* Topics */}
            <label className="block text-xs text-slate-400 mb-1">
              Konular <span className="text-lumina-gold">({topics.length} konu)</span>
            </label>
            <textarea
              value={topicsText}
              onChange={e => setTopicsText(e.target.value)}
              placeholder={"Yeni sezon kayıtları başladı!\nBahar indirimi %30\nÖğrenci başarı hikayeleri\nKampüs turu davetiyesi"}
              rows={5}
              className="w-full bg-lumina-950 border border-lumina-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lumina-gold/50 resize-none"
              disabled={isRunning}
            />
            {/* AI Topic Generation */}
            <div className="flex items-center gap-2 mt-1.5 mb-3">
              <div className="flex items-center gap-1 bg-lumina-950 border border-lumina-800 rounded-lg px-2 py-1">
                <button
                  onClick={() => setTopicCount(Math.max(1, topicCount - 1))}
                  className="text-slate-400 hover:text-white text-xs px-1"
                  disabled={isRunning || isGeneratingTopics}
                >-</button>
                <span className="text-xs text-white w-4 text-center">{topicCount}</span>
                <button
                  onClick={() => setTopicCount(Math.min(20, topicCount + 1))}
                  className="text-slate-400 hover:text-white text-xs px-1"
                  disabled={isRunning || isGeneratingTopics}
                >+</button>
              </div>
              <button
                onClick={handleGenerateTopics}
                disabled={isRunning || isGeneratingTopics || !selectedBrandId}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isGeneratingTopics ? (
                  <><Loader2 size={12} className="animate-spin" /> {referenceImages.length > 0 ? 'Görseller analiz ediliyor...' : 'Üretiliyor...'}</>
                ) : (
                  <><Sparkles size={12} /> {referenceImages.length > 0 ? `Görsellerden ${topicCount} Konu Üret` : `AI ile ${topicCount} Konu Üret`}</>
                )}
              </button>
              <button
                onClick={() => {
                  const campaignTopics = CAMPAIGN_TEMPLATES.map(t =>
                    `[${t.type}] ${t.core} | ${t.supporting} | CTA: ${t.cta} | ${t.extra}`
                  );
                  setTopicsText(campaignTopics.join('\n'));
                }}
                disabled={isRunning}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FileText size={12} /> Şablonlar ile Üret ({CAMPAIGN_TEMPLATES.length})
              </button>
            </div>

            {/* Campaign Template Preview */}
            {topicsText.includes('[Value / Conversion]') && (
              <div className="mb-3 p-2.5 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                <p className="text-[10px] text-amber-400 font-medium mb-1.5">Kampanya Şablonları Yüklendi</p>
                <div className="space-y-1">
                  {CAMPAIGN_TEMPLATES.map(t => (
                    <div key={t.id} className="flex items-center gap-2 text-[10px]">
                      <span className="text-amber-400/60 w-28 shrink-0 truncate">{t.type}</span>
                      <span className="text-slate-400 truncate">{t.core}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-slate-500 mt-1.5">Metinler sabit kalacak, AI sadece görsel stili eşleştirecek.</p>
              </div>
            )}

            {/* Reference Images */}
            <label className="block text-xs text-slate-400 mb-1">
              Referans Görseller <span className="text-lumina-gold">({referenceImages.length})</span>
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {referenceImages.map(img => (
                <div key={img.id} className="relative w-16 h-16 rounded-lg overflow-hidden border border-lumina-800 group">
                  <img src={`data:image/png;base64,${img.base64}`} className="w-full h-full object-cover" />
                  {!isRunning && (
                    <button
                      onClick={() => setReferenceImages(prev => prev.filter(i => i.id !== img.id))}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                    >
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  )}
                </div>
              ))}
              {!isRunning && (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-16 h-16 border-2 border-dashed border-lumina-800 rounded-lg flex items-center justify-center text-slate-500 hover:border-lumina-gold/50 hover:text-lumina-gold transition-all"
                    title="Dosyadan yükle"
                  >
                    <Plus size={20} />
                  </button>
                  <button
                    onClick={() => { setShowScoutPicker('reference'); setScoutQuery(selectedBrand?.industry + ' social media design inspiration' || ''); }}
                    className="w-16 h-16 border-2 border-dashed border-indigo-500/30 rounded-lg flex flex-col items-center justify-center text-indigo-400 hover:border-indigo-500/60 hover:bg-indigo-500/5 transition-all"
                    title="Web'den keşfet"
                  >
                    <Compass size={16} />
                    <span className="text-[9px] mt-0.5">Keşfet</span>
                  </button>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => handleImageUpload(e.target.files, setReferenceImages)}
            />

            {/* Product Images */}
            <label className="block text-xs text-slate-400 mb-1 mt-3">
              Ürün Görselleri (Opsiyonel) <span className="text-slate-500">({productImages.length})</span>
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {productImages.map(img => (
                <div key={img.id} className="relative w-12 h-12 rounded-lg overflow-hidden border border-lumina-800 group">
                  <img src={`data:image/png;base64,${img.base64}`} className="w-full h-full object-cover" />
                  {!isRunning && (
                    <button
                      onClick={() => setProductImages(prev => prev.filter(i => i.id !== img.id))}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                    >
                      <Trash2 size={12} className="text-red-400" />
                    </button>
                  )}
                </div>
              ))}
              {!isRunning && (
                <>
                  <button
                    onClick={() => productInputRef.current?.click()}
                    className="w-12 h-12 border-2 border-dashed border-lumina-800 rounded-lg flex items-center justify-center text-slate-500 hover:border-lumina-gold/50 hover:text-lumina-gold transition-all"
                    title="Dosyadan yükle"
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    onClick={() => { setShowScoutPicker('product'); setScoutQuery(selectedBrand?.name + ' product' || ''); }}
                    className="w-12 h-12 border-2 border-dashed border-indigo-500/30 rounded-lg flex flex-col items-center justify-center text-indigo-400 hover:border-indigo-500/60 hover:bg-indigo-500/5 transition-all"
                    title="Web'den keşfet"
                  >
                    <Compass size={12} />
                    <span className="text-[8px] mt-0.5">Keşfet</span>
                  </button>
                </>
              )}
            </div>
            <input
              ref={productInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => handleImageUpload(e.target.files, setProductImages)}
            />

            {/* AI Creative Brain Info */}
            {/* Kreatif Beyin — Yaklaşım Seçici */}
            <div className="mt-4 p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">🧠</span>
                <p className="text-sm text-indigo-300 font-medium">Kreatif Beyin — Yaklaşım Seçimi</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-2">
                {[
                  { id: '', label: 'Otomatik', desc: 'AI konuya göre belirler' },
                  { id: 'kurumsal', label: 'Kurumsal', desc: 'Profesyonel, güven veren' },
                  { id: 'esprili', label: 'Esprili', desc: 'Şakacı, zekice, mizahi' },
                  { id: 'eglenceli', label: 'Eğlenceli', desc: 'Enerjik, canlı, neşeli' },
                  { id: 'samimi', label: 'Samimi', desc: 'Sıcak, arkadaşça, içten' },
                  { id: 'luks', label: 'Lüks / Premium', desc: 'Sofistike, zarif, seçkin' },
                  { id: 'genc', label: 'Genç / Dinamik', desc: 'Trend, cesur, enerjik' },
                ].map(tone => (
                  <button
                    key={tone.id}
                    onClick={() => setCreativeTone(tone.id)}
                    disabled={isRunning}
                    className={`p-2 rounded-lg text-left transition-all border ${
                      creativeTone === tone.id
                        ? 'bg-indigo-500/20 border-indigo-400/50 text-indigo-200'
                        : 'bg-lumina-950/50 border-lumina-800/50 text-slate-400 hover:border-lumina-700'
                    }`}
                  >
                    <span className="text-xs font-medium block">{tone.label}</span>
                    <span className="text-[10px] opacity-60">{tone.desc}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-indigo-300/50 leading-relaxed">
                {creativeTone ? 'Seçilen yaklaşım tüm kreatif çıktıları etkiler.' : 'AI, her konu için en uygun yaklaşımı otomatik belirler.'}
              </p>
            </div>

            {/* Save as Template Toggle */}
            <div className="flex items-center justify-between mt-3 p-3 bg-lumina-950 rounded-lg border border-lumina-800">
              <div>
                <p className="text-sm text-white">Şablon Olarak Kaydet</p>
                <p className="text-xs text-slate-500">Stilleri kütüphaneye ekle</p>
              </div>
              <button
                onClick={() => setSaveAsTemplate(!saveAsTemplate)}
                className={`w-11 h-6 rounded-full transition-all ${saveAsTemplate ? 'bg-lumina-gold' : 'bg-lumina-800'}`}
                disabled={isRunning}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${saveAsTemplate ? 'translate-x-5.5 ml-[22px]' : 'translate-x-0.5 ml-[2px]'}`} />
              </button>
            </div>

            {/* Start Button */}
            <button
              onClick={startPipeline}
              disabled={!canStart}
              className={`w-full mt-5 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                canStart
                  ? 'bg-gradient-to-r from-lumina-gold to-amber-500 text-black hover:from-amber-500 hover:to-lumina-gold shadow-lg shadow-lumina-gold/20'
                  : 'bg-lumina-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Play size={18} />
              Pipeline Başlat
            </button>
          </div>
        </div>

        {/* RIGHT: Execution Panel */}
        <div className="lg:col-span-8 space-y-4">
          {/* Step Progress */}
          {currentRun && (
            <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-5">
              <h3 className="text-white font-medium mb-4 flex items-center justify-between">
                <span>Pipeline İlerlemesi</span>
                <span className="text-xs text-slate-400">
                  {currentRun.completedItems}/{currentRun.totalItems} görsel
                </span>
              </h3>

              {/* Overall Progress Bar */}
              <div className="w-full h-2 bg-lumina-950 rounded-full mb-5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-lumina-gold to-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${currentRun.totalItems > 0 ? (currentRun.completedItems / currentRun.totalItems) * 100 : 0}%` }}
                />
              </div>

              {/* Steps */}
              <div className="space-y-2">
                {currentRun.steps.map((step, i) => (
                  <div key={step.id} className="flex items-center gap-3">
                    {/* Step Icon */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${statusColors[step.status]}`}>
                      {step.status === 'running' ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : step.status === 'completed' ? (
                        <CheckCircle2 size={16} />
                      ) : step.status === 'failed' ? (
                        <XCircle size={16} />
                      ) : step.status === 'skipped' ? (
                        <SkipForward size={16} />
                      ) : (
                        stepIcons[step.id] || <Clock size={16} />
                      )}
                    </div>

                    {/* Step Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-medium ${step.status === 'running' ? 'text-white' : step.status === 'completed' ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {step.name}
                        </p>
                        <span className="text-xs text-slate-500">
                          {step.status === 'running' ? `${step.progress}%` :
                           step.status === 'completed' && step.startedAt && step.completedAt
                             ? `${((step.completedAt - step.startedAt) / 1000).toFixed(1)}s`
                             : step.status === 'skipped' ? 'Atlandı' : ''}
                        </span>
                      </div>
                      {/* Step Progress Bar */}
                      {step.status === 'running' && (
                        <div className="w-full h-1 bg-lumina-950 rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full bg-blue-400 rounded-full transition-all duration-300"
                            style={{ width: `${step.progress}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Connector */}
                    {i < currentRun.steps.length - 1 && (
                      <ChevronRight size={14} className="text-lumina-800 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results Grid */}
          {currentRun && currentRun.results.some(r => r.generatedImageBase64 || r.status !== 'pending') && (
            <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-medium">Üretilen Görseller</h3>
                {Object.keys(resultGroups).length > 1 && currentRun.results.some(r => r.generatedImageBase64) && (
                  <button
                    onClick={selectAllGroups}
                    className="text-[10px] text-slate-400 hover:text-white transition-colors"
                  >
                    {selectedGroups.size === Object.keys(resultGroups).filter(t => resultGroups[t].some(r => r.generatedImageBase64 || r.revisedImageBase64)).length
                      ? 'Seçimi Kaldır' : 'Tümünü Seç'}
                  </button>
                )}
              </div>

              {/* ═══ REVISION BAR ═══ */}
              {currentRun.results.some(r => r.generatedImageBase64) && (
                <div className="mb-4 p-3 bg-lumina-950 border border-lumina-800 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Edit2 size={14} className="text-lumina-gold shrink-0" />
                    <p className="text-xs text-white font-medium">
                      {selectedGroups.size > 0
                        ? `Revizyon — ${selectedGroups.size} tasarım grubu seçili`
                        : 'Revizyon — Aşağıdan tasarım gruplarını seçin'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={bulkRevisionPrompt}
                      onChange={e => setBulkRevisionPrompt(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !isRevising && selectedGroups.size > 0 && handleGroupRevision()}
                      placeholder="Örn: Arka planı daha koyu yap, yazıları büyüt, logo'yu sağ alta taşı..."
                      className="flex-1 bg-lumina-900 border border-lumina-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lumina-gold/50 placeholder-slate-600"
                      disabled={isRevising}
                    />
                    <button
                      onClick={handleGroupRevision}
                      disabled={isRevising || !bulkRevisionPrompt.trim() || selectedGroups.size === 0}
                      className="px-4 py-2 rounded-lg text-xs font-bold bg-lumina-gold/20 text-lumina-gold border border-lumina-gold/30 hover:bg-lumina-gold/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 shrink-0"
                    >
                      {isRevising ? (
                        <><Loader2 size={12} className="animate-spin" /> Revize ediliyor ({revisingIds.size} kaldı)...</>
                      ) : (
                        <><RotateCcw size={12} /> Seçilenleri Revize Et</>
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1.5">
                    İsteğinizi basit bir dille anlatın. Önce birinci boyut revize edilir, sonra diğer boyutlar revize edilen görsele göre uyumlu şekilde güncellenir.
                  </p>
                </div>
              )}

              {/* ═══ GROUPED RESULTS ═══ */}
              <div className="space-y-5">
                {Object.entries(resultGroups).map(([baseTopic, group]) => {
                  const hasImages = group.some(r => r.generatedImageBase64 || r.revisedImageBase64);
                  const isGroupSelected = selectedGroups.has(baseTopic);
                  const refImg = group[0]?.referenceImageId ? referenceImages.find(img => img.id === group[0].referenceImageId) : null;
                  const isGroupRevisionOpen = expandedRevision === `group-${baseTopic}`;
                  const groupRevisionKey = `group-${baseTopic}`;
                  const isAnyRevising = group.some(r => revisingIds.has(r.id));

                  return (
                    <div
                      key={baseTopic}
                      className={`border rounded-xl overflow-hidden transition-all ${
                        isGroupSelected
                          ? 'border-lumina-gold/50 bg-lumina-gold/5'
                          : 'border-lumina-800 bg-lumina-950'
                      }`}
                    >
                      {/* ─── Group header with reference thumbnail ─── */}
                      <div className="flex items-center gap-3 px-3 py-2.5 bg-lumina-900/50 border-b border-lumina-800">
                        {hasImages && (
                          <button
                            onClick={() => toggleGroup(baseTopic)}
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0 ${
                              isGroupSelected
                                ? 'bg-lumina-gold border-lumina-gold'
                                : 'border-lumina-700 hover:border-lumina-500'
                            }`}
                          >
                            {isGroupSelected && <Check size={10} className="text-lumina-950" />}
                          </button>
                        )}
                        {refImg && (
                          <img
                            src={`data:image/png;base64,${refImg.base64}`}
                            className="w-8 h-8 rounded object-cover border border-lumina-700 shrink-0"
                            title={`Referans: ${refImg.name}`}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white font-medium truncate" title={baseTopic}>{baseTopic}</p>
                          <span className="text-[10px] text-slate-500">{group.length} boyut {group.length > 1 ? '— ayni tasarim dili' : ''}</span>
                        </div>
                        {/* Group actions */}
                        {hasImages && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => {
                                group.forEach(r => {
                                  const img = r.revisedImageBase64 || r.generatedImageBase64;
                                  if (img) downloadBase64Image(img, `${r.topic.slice(0, 30)}${r.revisedImageBase64 ? '-revised' : ''}.png`);
                                });
                              }}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                              title="Grubu indir"
                            >
                              <Download size={12} />
                            </button>
                            <button
                              onClick={() => setExpandedRevision(isGroupRevisionOpen ? null : groupRevisionKey)}
                              className="p-1.5 rounded-lg bg-lumina-gold/10 hover:bg-lumina-gold/20 text-lumina-gold transition-all"
                              title="Grubu revize et"
                            >
                              <Edit2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* ─── Group-level revision input ─── */}
                      {isGroupRevisionOpen && (
                        <div className="px-3 py-2.5 bg-lumina-950 border-b border-lumina-800">
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={singleRevisionPrompts[groupRevisionKey] || ''}
                              onChange={e => setSingleRevisionPrompts(prev => ({ ...prev, [groupRevisionKey]: e.target.value }))}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && singleRevisionPrompts[groupRevisionKey]?.trim()) {
                                  // Revise master (first in group), siblings auto-adapt
                                  handleSingleRevision(group[0].id, singleRevisionPrompts[groupRevisionKey]);
                                  setExpandedRevision(null);
                                }
                              }}
                              placeholder="Tum boyutlari birlikte revize et... (master revize edilir, diger boyutlar uyumlanir)"
                              className="flex-1 bg-lumina-900 border border-lumina-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-lumina-gold/50 placeholder-slate-600"
                              autoFocus
                            />
                            <button
                              onClick={() => {
                                if (singleRevisionPrompts[groupRevisionKey]?.trim()) {
                                  handleSingleRevision(group[0].id, singleRevisionPrompts[groupRevisionKey]);
                                  setExpandedRevision(null);
                                }
                              }}
                              disabled={!singleRevisionPrompts[groupRevisionKey]?.trim() || isAnyRevising}
                              className="px-3 py-2 bg-lumina-gold/20 text-lumina-gold rounded-lg text-xs hover:bg-lumina-gold/30 disabled:opacity-30 transition-all flex items-center gap-1"
                            >
                              {isAnyRevising ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                              Revize
                            </button>
                          </div>
                          <p className="text-[9px] text-slate-500 mt-1.5">
                            Master boyut revize edilecek, diger {group.length - 1} boyut otomatik uyumlanacak — tutarli tasarim dili korunur
                          </p>
                        </div>
                      )}

                      {/* ─── Side-by-side format comparison ─── */}
                      <div className="p-3">
                        <div className={`flex gap-3 ${group.length === 1 ? 'justify-center' : ''}`}>
                          {group.map((result) => {
                            const displayImage = result.revisedImageBase64 || result.generatedImageBase64;
                            const isThisRevising = revisingIds.has(result.id);
                            const isExpanded = expandedRevision === result.id;
                            const formatLabel = result.topic.match(/\[(.*?)\]/)?.[1];
                            // Parse aspect ratio for proper display
                            const arMatch = formatLabel?.match(/(\d+):(\d+)/);
                            const arW = arMatch ? parseInt(arMatch[1]) : 1;
                            const arH = arMatch ? parseInt(arMatch[2]) : 1;
                            const isVertical = arH > arW;

                            return (
                              <div key={result.id} className="flex-1 min-w-0">
                                {/* Format label header */}
                                <div className="flex items-center justify-center gap-1.5 mb-2">
                                  <span className="text-[10px] font-bold text-lumina-gold bg-lumina-gold/10 px-2 py-0.5 rounded-full">
                                    {formatLabel || 'Orijinal'}
                                  </span>
                                  <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                                    isThisRevising ? 'bg-lumina-gold animate-pulse' :
                                    result.status === 'completed' ? 'bg-emerald-400' :
                                    result.status === 'failed' ? 'bg-red-400' :
                                    result.status === 'pending' ? 'bg-slate-600' :
                                    'bg-blue-400 animate-pulse'
                                  }`} />
                                </div>

                                {/* Image container with real aspect ratio */}
                                <div
                                  className="relative rounded-lg overflow-hidden bg-lumina-900 border border-lumina-800 mx-auto"
                                  style={{
                                    aspectRatio: `${arW}/${arH}`,
                                    maxHeight: isVertical ? '400px' : '280px',
                                  }}
                                >
                                  {isThisRevising ? (
                                    <div className="w-full h-full flex items-center justify-center bg-lumina-900/50">
                                      {displayImage && (
                                        <img src={`data:image/png;base64,${displayImage}`} className="w-full h-full object-cover opacity-30 absolute inset-0" />
                                      )}
                                      <div className="text-center relative z-10">
                                        <Loader2 size={24} className="text-lumina-gold animate-spin mx-auto" />
                                        <p className="text-xs text-lumina-gold mt-2">Revize ediliyor...</p>
                                      </div>
                                    </div>
                                  ) : displayImage ? (
                                    <img
                                      src={`data:image/png;base64,${displayImage}`}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      {result.status === 'generating' || result.status === 'analyzing' || result.status === 'revising' ? (
                                        <div className="text-center">
                                          <Loader2 size={24} className="text-lumina-gold animate-spin mx-auto" />
                                          <p className="text-xs text-slate-500 mt-2">
                                            {result.status === 'generating' ? 'Uretiliyor...' :
                                             result.status === 'revising' ? 'Revize ediliyor...' :
                                             'Analiz ediliyor...'}
                                          </p>
                                        </div>
                                      ) : result.status === 'failed' ? (
                                        <div className="text-center px-3">
                                          <XCircle size={24} className="text-red-400 mx-auto" />
                                          <p className="text-xs text-red-400 mt-2">{result.error || 'Hata'}</p>
                                        </div>
                                      ) : (
                                        <Clock size={24} className="text-slate-600" />
                                      )}
                                    </div>
                                  )}

                                  {/* Badges */}
                                  {result.revisedImageBase64 && !isThisRevising && (
                                    <div className="absolute top-2 left-2 bg-lumina-gold/90 text-lumina-950 text-[9px] font-bold px-1.5 py-0.5 rounded">
                                      REVISED
                                    </div>
                                  )}

                                  {/* QC score badge */}
                                  {result.qcScore != null && result.qcScore > 0 && (
                                    <div className={`absolute ${result.revisedImageBase64 ? 'top-8' : 'top-2'} left-2 text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                      result.qcPassed
                                        ? 'bg-green-500/90 text-white'
                                        : 'bg-red-500/90 text-white'
                                    }`}
                                      title={result.qcIssues?.join(', ') || ''}
                                    >
                                      QC {result.qcScore}/10{result.qcRetryCount ? ` (${result.qcRetryCount}R)` : ''}
                                    </div>
                                  )}

                                  {/* Action overlay */}
                                  {displayImage && !isThisRevising && (
                                    <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); downloadBase64Image(displayImage!, `${result.topic.slice(0, 30)}${result.revisedImageBase64 ? '-revised' : ''}.png`); }}
                                        className="bg-white/20 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-1"
                                      >
                                        <Download size={12} /> Indir
                                      </button>
                                      <button
                                        onClick={() => setExpandedRevision(isExpanded ? null : result.id)}
                                        className="bg-lumina-gold/30 backdrop-blur-sm text-lumina-gold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1"
                                      >
                                        <Edit2 size={12} /> Revize
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleQcSingle(result.id); }}
                                        disabled={qcReviewingIds.has(result.id)}
                                        className="bg-indigo-500/30 backdrop-blur-sm text-indigo-300 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 disabled:opacity-50"
                                      >
                                        {qcReviewingIds.has(result.id) ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} KK
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Single revision input — revises this + siblings */}
                                {isExpanded && (
                                  <div className="mt-2 p-2 bg-lumina-950 rounded-lg border border-lumina-800">
                                    <div className="flex gap-1.5">
                                      <input
                                        type="text"
                                        value={singleRevisionPrompts[result.id] || ''}
                                        onChange={e => setSingleRevisionPrompts(prev => ({ ...prev, [result.id]: e.target.value }))}
                                        onKeyDown={e => e.key === 'Enter' && handleSingleRevision(result.id)}
                                        placeholder="Nasil degissin? (diger boyutlar da uyumlu guncellenir)"
                                        className="flex-1 bg-lumina-900 border border-lumina-800 rounded px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-lumina-gold/50 placeholder-slate-600"
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => handleSingleRevision(result.id)}
                                        disabled={!singleRevisionPrompts[result.id]?.trim()}
                                        className="px-2 py-1.5 bg-lumina-gold/20 text-lumina-gold rounded text-[11px] hover:bg-lumina-gold/30 disabled:opacity-30 transition-all"
                                      >
                                        <Send size={10} />
                                      </button>
                                    </div>
                                    {group.length > 1 && (
                                      <p className="text-[9px] text-slate-600 mt-1">Bu boyut revize edilecek, diger {group.length - 1} boyut da otomatik uyumlanacak</p>
                                    )}
                                  </div>
                                )}

                                {/* Status + QC info */}
                                <div className="mt-2 text-center">
                                  <span className="text-[10px] text-slate-500">
                                    {isThisRevising ? 'Revize ediliyor...' :
                                     result.revisedImageBase64 ? 'Revize edildi' :
                                     result.status === 'completed' ? 'Tamamlandi' :
                                     result.status === 'failed' ? 'Basarisiz' :
                                     result.status === 'generating' ? 'Uretiliyor' :
                                     result.status === 'revising' ? 'Denetleniyor' :
                                     result.status === 'analyzing' ? 'Analiz ediliyor' :
                                     'Bekliyor'}
                                  </span>

                                  {/* QC Review Result */}
                                  {qcReviews[result.id] && (
                                    <div className={`mt-1.5 p-1.5 rounded-lg border text-[10px] text-left ${
                                      qcReviews[result.id].passed
                                        ? 'bg-emerald-500/10 border-emerald-500/20'
                                        : 'bg-red-500/10 border-red-500/20'
                                    }`}>
                                      <div className="flex items-center justify-between mb-1">
                                        <span className={`font-bold ${qcReviews[result.id].passed ? 'text-emerald-400' : 'text-red-400'}`}>
                                          {qcReviews[result.id].score}/10 {qcReviews[result.id].passed ? '✓' : '✗'}
                                        </span>
                                        {!qcReviews[result.id].passed && qcReviews[result.id].revisionInstruction && (
                                          <button
                                            onClick={() => handleQcRevise(result.id)}
                                            disabled={revisingIds.has(result.id)}
                                            className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded text-[9px] hover:bg-indigo-500/30 disabled:opacity-50"
                                          >
                                            Revize Et
                                          </button>
                                        )}
                                      </div>
                                      {qcReviews[result.id].issues.length > 0 && (
                                        <div className="text-slate-400 space-y-0.5">
                                          {qcReviews[result.id].issues.map((issue, idx) => (
                                            <p key={idx}>• {issue}</p>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* QC Reviewing indicator */}
                                  {qcReviewingIds.has(result.id) && (
                                    <div className="mt-1.5 flex items-center justify-center gap-1 text-[10px] text-indigo-400">
                                      <Loader2 size={10} className="animate-spin" /> Denetleniyor...
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Connection indicator between formats */}
                        {group.length > 1 && hasImages && (
                          <div className="flex items-center justify-center mt-2 gap-2">
                            <div className="h-px flex-1 bg-lumina-800" />
                            <span className="text-[9px] text-slate-600 px-2">ayni tasarim dili</span>
                            <div className="h-px flex-1 bg-lumina-800" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Logs */}
          <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-5">
            <h3 className="text-white font-medium mb-3 flex items-center gap-2">
              <FileText size={16} className="text-slate-400" />
              Pipeline Logları
            </h3>
            <div className="bg-lumina-950 rounded-lg p-3 h-48 overflow-y-auto font-mono text-xs">
              {logs.length === 0 ? (
                <p className="text-slate-600">Pipeline başlatıldığında loglar burada görünecek...</p>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className={`py-0.5 ${
                    log.includes('hatası') || log.includes('Hata') ? 'text-red-400' :
                    log.includes('tamamlandı') || log.includes('başarıyla') ? 'text-emerald-400' :
                    log.includes('başlıyor') || log.includes('başlatıldı') ? 'text-blue-400' :
                    'text-slate-400'
                  }`}>
                    {log}
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>

          {/* Empty State */}
          {!currentRun && (
            <div className="bg-lumina-900/50 border border-dashed border-lumina-800 rounded-xl p-12 text-center">
              <Zap size={48} className="text-lumina-gold/30 mx-auto mb-4" />
              <h3 className="text-white font-serif text-xl mb-2">Pipeline Hazır</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                Sol panelden ayarları yapılandırın, konuları ve referans görselleri ekleyin,
                sonra tek tıkla tüm süreci otomatik başlatın.
              </p>
              <div className="flex items-center justify-center gap-2 mt-6 text-xs text-slate-500">
                <span className="px-2 py-1 bg-lumina-950 rounded">Analiz</span>
                <ChevronRight size={12} />
                <span className="px-2 py-1 bg-lumina-950 rounded">Eşleştir</span>
                <ChevronRight size={12} />
                <span className="px-2 py-1 bg-lumina-950 rounded">Üret</span>
                <ChevronRight size={12} />
                <span className="px-2 py-1 bg-lumina-950 rounded">Revize</span>
                <ChevronRight size={12} />
                <span className="px-2 py-1 bg-lumina-950 rounded">Kaydet</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Scout Picker Modal ═══ */}
      {showScoutPicker && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-lumina-900 border border-lumina-800 rounded-2xl w-full max-w-4xl max-h-[90vh] lg:max-h-[85vh] flex flex-col overflow-hidden mx-2">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-lumina-800">
              <div className="flex items-center gap-3">
                <Compass size={20} className="text-indigo-400" />
                <div>
                  <h3 className="text-white font-medium">
                    {showScoutPicker === 'product' ? 'Ürün Görseli Keşfet' : 'Referans Görseli Keşfet'}
                  </h3>
                  <p className="text-xs text-slate-400">Web'den arayın, seçin, doğrudan pipeline'a ekleyin</p>
                </div>
              </div>
              <button onClick={() => { setShowScoutPicker(null); setScoutResults([]); setScoutSelected(new Set()); }} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-4 border-b border-lumina-800">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={scoutQuery}
                  onChange={e => setScoutQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleScoutSearch()}
                  placeholder="Arama... (örn: modern education poster design)"
                  className="flex-1 bg-lumina-950 border border-lumina-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                />
                <button
                  onClick={handleScoutSearch}
                  disabled={isScoutSearching || !scoutQuery.trim()}
                  className="px-5 py-2.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg hover:bg-indigo-500/30 transition-all disabled:opacity-40 flex items-center gap-2"
                >
                  {isScoutSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  Ara
                </button>
              </div>
              {scoutSelected.size > 0 && (
                <div className="flex items-center justify-between mt-3 p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                  <span className="text-xs text-indigo-300">{scoutSelected.size} görsel seçildi</span>
                  <button
                    onClick={handleScoutAddSelected}
                    disabled={isScoutDownloading}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-500 text-white rounded-lg text-xs font-medium hover:bg-indigo-600 transition-all disabled:opacity-50"
                  >
                    {isScoutDownloading ? (
                      <><Loader2 size={12} className="animate-spin" /> Ekleniyor...</>
                    ) : (
                      <><Check size={12} /> Pipeline'a Ekle</>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Results Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {isScoutSearching ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 size={32} className="text-indigo-400 animate-spin" />
                  <p className="text-slate-400 text-sm mt-3">Aranıyor...</p>
                  {isScoring && <p className="text-xs text-indigo-400 mt-1">AI kalite puanlaması yapılıyor...</p>}
                </div>
              ) : scoutResults.length > 0 ? (
                <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {scoutResults.map(result => {
                    const isSelected = scoutSelected.has(result.id);
                    const scoreData = scoredResults.get(result.id);
                    return (
                      <div
                        key={result.id}
                        onClick={() => toggleScoutSelect(result.id)}
                        className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all group ${
                          isSelected
                            ? 'border-indigo-500 shadow-lg shadow-indigo-500/20'
                            : 'border-lumina-800 hover:border-lumina-700'
                        }`}
                      >
                        <div className="aspect-square bg-lumina-950">
                          <img
                            src={result.thumbnailUrl || result.imageUrl}
                            alt={result.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        </div>
                        {/* Selection overlay */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center">
                            <Check size={14} className="text-white" />
                          </div>
                        )}
                        {/* Score badge */}
                        {scoreData && (
                          <div className={`absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            scoreData.score >= 70 ? 'bg-emerald-500/90 text-white' :
                            scoreData.score >= 40 ? 'bg-amber-500/90 text-white' :
                            'bg-red-500/90 text-white'
                          }`}>
                            <Star size={8} className="inline mr-0.5" />{scoreData.score}
                          </div>
                        )}
                        {/* Platform badge */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                          <p className="text-[10px] text-white/80 truncate">{result.title}</p>
                          <span className="text-[9px] text-slate-400">{result.platform}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Load More Button */}
                {scoutHasMore && (
                  <div className="flex justify-center mt-4 pb-2">
                    <button
                      onClick={handleScoutLoadMore}
                      disabled={isLoadingMoreScout}
                      className="flex items-center gap-2 px-5 py-2 bg-lumina-900 border border-lumina-800 text-white rounded-lg hover:bg-lumina-800 transition-all text-xs disabled:opacity-50"
                    >
                      {isLoadingMoreScout ? (
                        <><Loader2 size={14} className="animate-spin" /> Yükleniyor...</>
                      ) : (
                        <>Daha Fazla Görsel</>
                      )}
                    </button>
                  </div>
                )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                  <Search size={32} className="mb-3 opacity-30" />
                  <p className="text-sm">Arama yaparak görselleri keşfedin</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PipelineDashboard;
