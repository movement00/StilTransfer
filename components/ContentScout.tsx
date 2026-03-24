import React, { useState, useEffect, useCallback } from 'react';
import { Search, Download, Wand2, Check, X, Loader2, ExternalLink, RefreshCw, Sparkles, Eye, ChevronDown, Filter, Globe, Image as ImageIcon, Heart, Trash2, AlertCircle } from 'lucide-react';
import { Brand, ScoutResult, ScoutInspiration } from '../types';
import {
  searchInspiration,
  downloadImage,
  scoutAndAdapt,
  saveInspiration,
  loadInspirations,
  updateInspirationStatus,
  deleteInspiration,
  checkScoutHealth,
  generateSearchQueries,
  resetBackendDetection,
  scoreAndRankResults,
} from '../services/scoutService';

interface ContentScoutProps {
  brands: Brand[];
  addToHistory: (asset: any) => void;
}

type ScoutTab = 'search' | 'saved' | 'ready';

const ContentScout: React.FC<ContentScoutProps> = ({ brands, addToHistory }) => {
  // State
  const [activeTab, setActiveTab] = useState<ScoutTab>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(brands[0] || null);
  const [searchResults, setSearchResults] = useState<ScoutResult[]>([]);
  const [savedInspirations, setSavedInspirations] = useState<ScoutInspiration[]>([]);
  const [readyInspirations, setReadyInspirations] = useState<ScoutInspiration[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [healthStatus, setHealthStatus] = useState<{ backend: string; sources: Record<string, boolean> } | null>(null);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [adaptProgress, setAdaptProgress] = useState<Record<string, { step: string; progress: number }>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [adaptTopic, setAdaptTopic] = useState('');
  const [sourcesReport, setSourcesReport] = useState<Record<string, number>>({});
  const [suggestedQueries, setSuggestedQueries] = useState<string[]>([]);
  const [isGeneratingQueries, setIsGeneratingQueries] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [scoringProgress, setScoringProgress] = useState<{ done: number; total: number } | null>(null);
  const [scoredResults, setScoredResults] = useState<Map<string, { score: number; reason: string }>>(new Map());
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastSearchQuery, setLastSearchQuery] = useState('');
  const scrollContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = node;
      if (scrollHeight - scrollTop - clientHeight < 300 && !isLoadingMore && hasMore && searchResults.length > 0) {
        loadMoreResults();
      }
    };
    node.addEventListener('scroll', handleScroll);
    return () => node.removeEventListener('scroll', handleScroll);
  }, [isLoadingMore, hasMore, searchResults.length]);

  // Check backend health on mount
  const refreshHealth = useCallback(() => {
    resetBackendDetection();
    checkScoutHealth().then(h => setHealthStatus({ backend: h.backend, sources: h.sources }));
  }, []);

  useEffect(() => { refreshHealth(); }, [refreshHealth]);

  // Generate AI-powered suggested queries when brand changes
  useEffect(() => {
    if (selectedBrand) {
      setIsGeneratingQueries(true);
      setSuggestedQueries([]);
      generateSearchQueries(selectedBrand)
        .then(queries => setSuggestedQueries(queries))
        .finally(() => setIsGeneratingQueries(false));
    }
  }, [selectedBrand]);

  // Load saved inspirations
  const loadSaved = useCallback(async () => {
    try {
      const all = await loadInspirations(selectedBrand?.id);
      setSavedInspirations(all.filter(i => !['ready', 'published'].includes(i.status)));
      setReadyInspirations(all.filter(i => ['ready', 'published'].includes(i.status)));
    } catch (err) {
      console.error('Failed to load inspirations:', err);
    }
  }, [selectedBrand?.id]);

  useEffect(() => { loadSaved(); }, [loadSaved]);

  // Search handler
  const handleSearch = async (query?: string) => {
    const q = query || searchQuery;
    if (!q.trim()) return;

    setIsSearching(true);
    setSearchResults([]);
    setSelectedResults(new Set());
    setCurrentPage(0);
    setHasMore(true);
    setLastSearchQuery(q);

    try {
      const { results, sourcesReport: sr, hasMore: more } = await searchInspiration(
        q,
        ['duckduckgo', 'pinterest', 'google'],
        selectedBrand?.industry,
        0
      );
      setSearchResults(results);
      setSourcesReport(sr);
      setHasMore(more && results.length > 0);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Load more results (pagination)
  const loadMoreResults = async () => {
    if (isLoadingMore || !hasMore || !lastSearchQuery) return;
    setIsLoadingMore(true);
    const nextPage = currentPage + 1;

    try {
      const { results, hasMore: more } = await searchInspiration(
        lastSearchQuery,
        ['duckduckgo', 'pinterest', 'google'],
        selectedBrand?.industry,
        nextPage
      );

      if (results.length > 0) {
        // Deduplicate against existing results
        const existingUrls = new Set(searchResults.map(r => r.imageUrl));
        const newResults = results.filter(r => !existingUrls.has(r.imageUrl));
        setSearchResults(prev => [...prev, ...newResults]);
        setCurrentPage(nextPage);
        setHasMore(more && newResults.length > 0);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Load more error:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Toggle result selection
  const toggleSelect = (id: string) => {
    setSelectedResults(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Download and save selected results
  const handleDownloadSelected = async () => {
    if (!selectedBrand || selectedResults.size === 0) return;

    const selected = searchResults.filter(r => selectedResults.has(r.id));

    for (const result of selected) {
      setProcessingIds(prev => new Set(prev).add(result.id));

      try {
        const { base64 } = await downloadImage(result.imageUrl);

        await saveInspiration({
          brandId: selectedBrand.id,
          searchQuery: searchQuery,
          sourceUrl: result.sourceUrl,
          sourcePlatform: result.platform,
          originalImageBase64: base64,
          status: 'downloaded',
          tags: [result.platform, selectedBrand.industry],
        });
      } catch (err) {
        console.error(`Failed to download ${result.title}:`, err);
      } finally {
        setProcessingIds(prev => {
          const next = new Set(prev);
          next.delete(result.id);
          return next;
        });
      }
    }

    setSelectedResults(new Set());
    await loadSaved();
    setActiveTab('saved');
  };

  // Adapt a single inspiration to brand
  const handleAdapt = async (inspiration: ScoutInspiration) => {
    if (!selectedBrand || !inspiration.originalImageBase64) return;

    const id = inspiration.id;
    setProcessingIds(prev => new Set(prev).add(id));
    setAdaptProgress(prev => ({ ...prev, [id]: { step: 'Başlatılıyor...', progress: 0 } }));

    try {
      await updateInspirationStatus(id, 'analyzing');

      const topic = adaptTopic || `${selectedBrand.industry} tanıtım görseli`;

      const { analysis, adaptedImage } = await scoutAndAdapt(
        inspiration.originalImageBase64,
        selectedBrand,
        topic,
        aspectRatio,
        (step, progress) => {
          setAdaptProgress(prev => ({ ...prev, [id]: { step, progress } }));
        }
      );

      await updateInspirationStatus(id, 'ready', {
        adapted_image_base64: adaptedImage,
        style_analysis: analysis,
      });

      // Add to history
      addToHistory({
        id: `scout-${Date.now()}`,
        url: adaptedImage,
        promptUsed: `Scout: ${inspiration.searchQuery} → ${selectedBrand.name}`,
        brandId: selectedBrand.id,
        createdAt: Date.now(),
      });

      await loadSaved();
    } catch (err) {
      console.error('Adaptation error:', err);
      await updateInspirationStatus(id, 'downloaded');
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setAdaptProgress(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  // Batch adapt all saved
  const handleBatchAdapt = async () => {
    const toAdapt = savedInspirations.filter(i => i.status === 'downloaded' && i.originalImageBase64);
    for (const insp of toAdapt) {
      await handleAdapt(insp);
    }
  };

  // Delete an inspiration
  const handleDelete = async (id: string) => {
    try {
      await deleteInspiration(id);
      await loadSaved();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const tabs: { id: ScoutTab; label: string; count: number }[] = [
    { id: 'search', label: 'Keşfet', count: searchResults.length },
    { id: 'saved', label: 'İndirilenler', count: savedInspirations.length },
    { id: 'ready', label: 'Paylaşıma Hazır', count: readyInspirations.length },
  ];

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-serif text-white flex items-center gap-3">
            <Sparkles className="text-lumina-gold" size={28} />
            İçerik Keşif Merkezi
          </h2>
          <p className="text-slate-400 mt-1">Web'den ilham bul, markana uyarla, paylaşıma hazır hale getir</p>
        </div>

        {/* Health indicator */}
        {healthStatus && (
          <div className="flex items-center gap-3 text-xs">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
              healthStatus.backend !== 'none' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${healthStatus.backend !== 'none' ? 'bg-emerald-400' : 'bg-red-400'}`} />
              {healthStatus.backend === 'scrapling' ? 'Scrapling' : healthStatus.backend === 'edge-function' ? 'Edge Fn' : 'Çevrimdışı'}
            </div>
            {Object.entries(healthStatus.sources).filter(([, v]) => v).map(([name]) => (
              <div key={name} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {name}
              </div>
            ))}
            <button onClick={refreshHealth} className="p-1 text-slate-500 hover:text-white transition-colors" title="Yeniden kontrol et">
              <RefreshCw size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Brand + Config Bar */}
      <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Brand selector */}
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-slate-500 uppercase tracking-wider mb-1 block">Marka</label>
            <select
              value={selectedBrand?.id || ''}
              onChange={e => setSelectedBrand(brands.find(b => b.id === e.target.value) || null)}
              className="w-full bg-lumina-950 border border-lumina-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-1 focus:ring-lumina-gold focus:border-lumina-gold outline-none"
            >
              {brands.map(b => (
                <option key={b.id} value={b.id}>{b.name} — {b.industry}</option>
              ))}
            </select>
          </div>

          {/* Aspect Ratio */}
          <div className="w-32">
            <label className="text-xs text-slate-500 uppercase tracking-wider mb-1 block">Oran</label>
            <select
              value={aspectRatio}
              onChange={e => setAspectRatio(e.target.value)}
              className="w-full bg-lumina-950 border border-lumina-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-1 focus:ring-lumina-gold focus:border-lumina-gold outline-none"
            >
              <option value="1:1">1:1 Kare</option>
              <option value="4:5">4:5 Post</option>
              <option value="9:16">9:16 Story</option>
              <option value="16:9">16:9 Yatay</option>
            </select>
          </div>

          {/* Topic */}
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-slate-500 uppercase tracking-wider mb-1 block">Uyarlama Konusu</label>
            <input
              type="text"
              value={adaptTopic}
              onChange={e => setAdaptTopic(e.target.value)}
              placeholder="Ör: Yaz kampanyası, yeni ürün tanıtımı..."
              className="w-full bg-lumina-950 border border-lumina-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:ring-1 focus:ring-lumina-gold focus:border-lumina-gold outline-none"
            />
          </div>
        </div>

        {/* Brand color preview */}
        {selectedBrand && (
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-slate-500">Palet:</span>
            {selectedBrand.palette.slice(0, 7).map((c, i) => (
              <div
                key={i}
                className="w-5 h-5 rounded-full border border-lumina-700"
                style={{ backgroundColor: c.hex }}
                title={c.name}
              />
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-lumina-800">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'text-lumina-gold border-lumina-gold'
                : 'text-slate-400 border-transparent hover:text-white hover:border-lumina-700'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                activeTab === tab.id ? 'bg-lumina-gold/20 text-lumina-gold' : 'bg-lumina-800 text-slate-500'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search Tab */}
      {activeTab === 'search' && (
        <div>
          {/* Search bar */}
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Sosyal medya gönderisi ara... (ör: modern fitness post design)"
                className="w-full bg-lumina-950 border border-lumina-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-600 focus:ring-2 focus:ring-lumina-gold focus:border-lumina-gold outline-none"
              />
            </div>
            <button
              onClick={() => handleSearch()}
              disabled={isSearching || !searchQuery.trim()}
              className="px-6 py-3 bg-lumina-gold text-black font-medium rounded-xl hover:bg-lumina-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              Ara
            </button>
          </div>

          {/* Suggested queries - AI generated */}
          {searchResults.length === 0 && !isSearching && (
            <div className="mb-6">
              {isGeneratingQueries ? (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 size={14} className="animate-spin text-lumina-gold" />
                  <span>Gemini markayı analiz edip akıllı aramalar üretiyor...</span>
                </div>
              ) : suggestedQueries.length > 0 ? (
                <>
                  <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
                    <Sparkles size={12} className="text-lumina-gold" />
                    AI önerilen aramalar ({selectedBrand?.name}):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedQueries.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => { setSearchQuery(q); handleSearch(q); }}
                        className="px-3 py-1.5 bg-lumina-800 text-slate-300 text-xs rounded-full hover:bg-lumina-700 hover:text-white transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* Loading */}
          {isSearching && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 size={40} className="animate-spin text-lumina-gold mb-4" />
              <p className="text-slate-400">Web'de aranıyor...</p>
            </div>
          )}

          {/* Results grid */}
          {searchResults.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-400">
                  {searchResults.length} sonuç bulundu
                  {Object.entries(sourcesReport).map(([source, count]) => (
                    <span key={source} className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                      source === 'pinterest' ? 'bg-red-500/10 text-red-300' :
                      source === 'duckduckgo' ? 'bg-amber-500/10 text-amber-300' :
                      source === 'google' ? 'bg-blue-500/10 text-blue-300' :
                      'bg-purple-500/10 text-purple-300'
                    }`}>
                      {source}: {count}
                    </span>
                  ))}
                </p>
                <div className="flex gap-2">
                  {/* AI Score Button */}
                  <button
                    onClick={async () => {
                      if (!selectedBrand || isScoring) return;
                      setIsScoring(true);
                      setScoringProgress({ done: 0, total: searchResults.length });
                      try {
                        const scored = await scoreAndRankResults(
                          searchResults,
                          selectedBrand,
                          6,
                          (done, total) => setScoringProgress({ done, total })
                        );
                        const newScores = new Map<string, { score: number; reason: string }>();
                        const reordered: ScoutResult[] = [];
                        scored.forEach(s => {
                          newScores.set(s.result.id, { score: s.score, reason: s.reason });
                          reordered.push(s.result);
                        });
                        setScoredResults(newScores);
                        setSearchResults(reordered);
                      } catch (err) {
                        console.error('Scoring failed:', err);
                      } finally {
                        setIsScoring(false);
                        setScoringProgress(null);
                      }
                    }}
                    disabled={isScoring || searchResults.length === 0}
                    className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {isScoring ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        {scoringProgress && `${scoringProgress.done}/${scoringProgress.total}`}
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        AI Puanla
                      </>
                    )}
                  </button>

                  {selectedResults.size > 0 && (
                    <button
                      onClick={handleDownloadSelected}
                      disabled={processingIds.size > 0}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                      {processingIds.size > 0 ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Download size={16} />
                      )}
                      {selectedResults.size} Görseli İndir & Kaydet
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {searchResults.map(result => {
                  const isSelected = selectedResults.has(result.id);
                  const isProcessing = processingIds.has(result.id);

                  return (
                    <div
                      key={result.id}
                      onClick={() => !isProcessing && toggleSelect(result.id)}
                      className={`group relative rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-lumina-gold ring-2 ring-lumina-gold/30 scale-[0.98]'
                          : 'border-lumina-800 hover:border-lumina-700'
                      }`}
                    >
                      <div className="aspect-[4/5] bg-lumina-950">
                        <img
                          src={result.thumbnailUrl}
                          alt={result.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>

                      {/* Selection overlay */}
                      <div className={`absolute inset-0 transition-opacity ${
                        isSelected ? 'bg-lumina-gold/10' : 'bg-black/0 group-hover:bg-black/30'
                      }`}>
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-6 h-6 bg-lumina-gold rounded-full flex items-center justify-center">
                            <Check size={14} className="text-black" />
                          </div>
                        )}
                        {isProcessing && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <Loader2 size={24} className="animate-spin text-lumina-gold" />
                          </div>
                        )}
                      </div>

                      {/* Platform badge + Score */}
                      <div className="absolute bottom-2 left-2 flex items-center gap-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          result.platform === 'pexels' ? 'bg-emerald-500/20 text-emerald-300' :
                          result.platform === 'pinterest' ? 'bg-red-500/20 text-red-300' :
                          result.platform === 'duckduckgo' ? 'bg-amber-500/20 text-amber-300' :
                          'bg-blue-500/20 text-blue-300'
                        }`}>
                          {result.platform}
                        </span>
                        {scoredResults.has(result.id) && (() => {
                          const { score, reason } = scoredResults.get(result.id)!;
                          const color = score >= 75 ? 'bg-emerald-500/90 text-white' :
                                        score >= 50 ? 'bg-amber-500/90 text-white' :
                                        'bg-red-500/90 text-white';
                          return (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${color}`} title={reason}>
                              {score}
                            </span>
                          );
                        })()}
                      </div>

                      {/* Preview button */}
                      <button
                        onClick={e => { e.stopPropagation(); setPreviewImage(result.imageUrl); }}
                        className="absolute top-2 left-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Eye size={14} className="text-white" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Load More */}
              {hasMore && searchResults.length > 0 && (
                <div className="flex justify-center mt-6">
                  <button
                    onClick={loadMoreResults}
                    disabled={isLoadingMore}
                    className="flex items-center gap-2 px-6 py-2.5 bg-lumina-900 border border-lumina-800 text-white rounded-xl hover:bg-lumina-800 transition-all text-sm disabled:opacity-50"
                  >
                    {isLoadingMore ? (
                      <><Loader2 size={16} className="animate-spin" /> Yükleniyor...</>
                    ) : (
                      <>Daha Fazla Görsel Yükle</>
                    )}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Empty state */}
          {!isSearching && searchResults.length === 0 && searchQuery && (
            <div className="text-center py-16">
              <Globe size={48} className="text-slate-700 mx-auto mb-4" />
              <p className="text-slate-400">Sonuç bulunamadı. Farklı anahtar kelimeler deneyin.</p>
            </div>
          )}
        </div>
      )}

      {/* Saved / Downloaded Tab */}
      {activeTab === 'saved' && (
        <div>
          {savedInspirations.length > 0 && (
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-400">{savedInspirations.length} indirilen görsel</p>
              <div className="flex gap-2">
                <button
                  onClick={loadSaved}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-lumina-800 text-slate-300 rounded-lg hover:bg-lumina-700 transition-colors text-xs"
                >
                  <RefreshCw size={14} /> Yenile
                </button>
                <button
                  onClick={handleBatchAdapt}
                  disabled={processingIds.size > 0}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-lumina-gold text-black rounded-lg hover:bg-lumina-gold/90 transition-colors text-xs font-medium disabled:opacity-50"
                >
                  <Wand2 size={14} /> Tümünü Uyarla
                </button>
              </div>
            </div>
          )}

          {savedInspirations.length === 0 ? (
            <div className="text-center py-16">
              <Download size={48} className="text-slate-700 mx-auto mb-4" />
              <p className="text-slate-400">Henüz indirilen görsel yok.</p>
              <p className="text-slate-600 text-sm mt-1">Keşfet sekmesinden görseller indirin.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {savedInspirations.map(insp => {
                const isProcessing = processingIds.has(insp.id);
                const progress = adaptProgress[insp.id];

                return (
                  <div key={insp.id} className="bg-lumina-900 border border-lumina-800 rounded-xl overflow-hidden group">
                    {/* Image */}
                    <div className="aspect-[4/5] bg-lumina-950 relative">
                      {insp.originalImageBase64 && (
                        <img
                          src={`data:image/jpeg;base64,${insp.originalImageBase64}`}
                          alt={insp.searchQuery}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}

                      {/* Processing overlay */}
                      {isProcessing && progress && (
                        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                          <Loader2 size={28} className="animate-spin text-lumina-gold mb-2" />
                          <p className="text-xs text-white">{progress.step}</p>
                          <div className="w-3/4 bg-lumina-800 rounded-full h-1.5 mt-2">
                            <div
                              className="bg-lumina-gold h-1.5 rounded-full transition-all duration-500"
                              style={{ width: `${progress.progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Status badge */}
                      <div className="absolute top-2 right-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          insp.status === 'downloaded' ? 'bg-blue-500/20 text-blue-300' :
                          insp.status === 'analyzing' ? 'bg-amber-500/20 text-amber-300' :
                          insp.status === 'adapting' ? 'bg-purple-500/20 text-purple-300' :
                          'bg-slate-500/20 text-slate-300'
                        }`}>
                          {insp.status === 'downloaded' ? 'İndirildi' :
                           insp.status === 'analyzing' ? 'Analiz Ediliyor' :
                           insp.status === 'adapting' ? 'Uyarlanıyor' : insp.status}
                        </span>
                      </div>

                      {/* Platform */}
                      <div className="absolute top-2 left-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/50 text-white">
                          {insp.sourcePlatform}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="p-3 flex items-center justify-between">
                      <p className="text-xs text-slate-400 truncate flex-1 mr-2">{insp.searchQuery}</p>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleAdapt(insp)}
                          disabled={isProcessing || !insp.originalImageBase64}
                          className="p-1.5 bg-lumina-gold/10 text-lumina-gold rounded-lg hover:bg-lumina-gold/20 transition-colors disabled:opacity-30"
                          title="Markaya Uyarla"
                        >
                          <Wand2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(insp.id)}
                          disabled={isProcessing}
                          className="p-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-30"
                          title="Sil"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Ready Tab */}
      {activeTab === 'ready' && (
        <div>
          {readyInspirations.length > 0 && (
            <p className="text-sm text-slate-400 mb-4">{readyInspirations.length} paylaşıma hazır görsel</p>
          )}

          {readyInspirations.length === 0 ? (
            <div className="text-center py-16">
              <Heart size={48} className="text-slate-700 mx-auto mb-4" />
              <p className="text-slate-400">Henüz uyarlanmış görsel yok.</p>
              <p className="text-slate-600 text-sm mt-1">İndirdiğiniz görselleri markaya uyarlayın.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {readyInspirations.map(insp => (
                <div key={insp.id} className="bg-lumina-900 border border-lumina-800 rounded-xl overflow-hidden group">
                  {/* Side by side comparison */}
                  <div className="grid grid-cols-2 gap-px bg-lumina-800">
                    {/* Original */}
                    <div className="aspect-square bg-lumina-950 relative">
                      {insp.originalImageBase64 && (
                        <img
                          src={`data:image/jpeg;base64,${insp.originalImageBase64}`}
                          alt="Orijinal"
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}
                      <span className="absolute bottom-1 left-1 text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded">Orijinal</span>
                    </div>
                    {/* Adapted */}
                    <div className="aspect-square bg-lumina-950 relative">
                      {insp.adaptedImageBase64 && (
                        <img
                          src={`data:image/png;base64,${insp.adaptedImageBase64}`}
                          alt="Uyarlanmış"
                          className="w-full h-full object-cover cursor-pointer"
                          loading="lazy"
                          onClick={() => setPreviewImage(`data:image/png;base64,${insp.adaptedImageBase64}`)}
                        />
                      )}
                      <span className="absolute bottom-1 left-1 text-[9px] bg-lumina-gold/80 text-black px-1.5 py-0.5 rounded font-medium">Uyarlanmış</span>
                    </div>
                  </div>

                  {/* Info & Actions */}
                  <div className="p-3">
                    <p className="text-xs text-slate-400 truncate mb-2">{insp.searchQuery}</p>
                    <div className="flex gap-2">
                      {insp.adaptedImageBase64 && (
                        <a
                          href={`data:image/png;base64,${insp.adaptedImageBase64}`}
                          download={`scout-${selectedBrand?.name || 'brand'}-${Date.now()}.png`}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-lumina-gold text-black rounded-lg text-xs font-medium hover:bg-lumina-gold/90 transition-colors"
                        >
                          <Download size={14} /> İndir
                        </a>
                      )}
                      <button
                        onClick={() => handleDelete(insp.id)}
                        className="px-3 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-8"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-[85vh] object-contain rounded-xl"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-lumina-900 border border-lumina-700 rounded-full flex items-center justify-center text-white hover:bg-red-500 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Setup hint */}
      {healthStatus && healthStatus.backend === 'none' && (
        <div className="mt-8 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-300 text-sm font-medium">Scraping Backend Gerekli</p>
            <p className="text-amber-400/70 text-xs mt-1">
              Arama yapabilmek için Python scraper'ı başlatın:
            </p>
            <pre className="mt-2 bg-black/30 rounded-lg p-3 text-xs text-emerald-300 font-mono">
              python3 scraper/server.py
            </pre>
            <p className="text-amber-400/70 text-xs mt-2">
              Scrapling ile Pinterest, Google ve DuckDuckGo'dan görseller taranır. API key gerekmez.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentScout;
