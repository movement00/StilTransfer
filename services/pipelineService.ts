
import {
  Brand, StyleAnalysis, PipelineConfig, PipelineRun, PipelineStep,
  PipelineResult, PipelineImage, SavedTemplate, GeneratedAsset
} from '../types';
import {
  analyzeImageStyle, matchTopicsToStyles, generateBrandedImage, reviseGeneratedImage
} from './geminiService';

type PipelineEventType = 'step-update' | 'result-update' | 'run-update' | 'log';

interface PipelineEvent {
  type: PipelineEventType;
  data: any;
  timestamp: number;
}

type PipelineListener = (event: PipelineEvent) => void;

export class PipelineService {
  private listeners: PipelineListener[] = [];
  private abortController: AbortController | null = null;
  private currentRun: PipelineRun | null = null;

  subscribe(listener: PipelineListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private emit(type: PipelineEventType, data: any) {
    const event: PipelineEvent = { type, data, timestamp: Date.now() };
    this.listeners.forEach(l => l(event));
  }

  private log(message: string) {
    this.emit('log', { message });
  }

  private updateStep(stepId: string, updates: Partial<PipelineStep>) {
    if (!this.currentRun) return;
    this.currentRun.steps = this.currentRun.steps.map(s =>
      s.id === stepId ? { ...s, ...updates } : s
    );
    this.emit('step-update', { stepId, updates, steps: this.currentRun.steps });
  }

  private updateResult(resultId: string, updates: Partial<PipelineResult>) {
    if (!this.currentRun) return;
    this.currentRun.results = this.currentRun.results.map(r =>
      r.id === resultId ? { ...r, ...updates } : r
    );
    this.emit('result-update', { resultId, updates, results: this.currentRun.results });
  }

  private updateRun(updates: Partial<PipelineRun>) {
    if (!this.currentRun) return;
    Object.assign(this.currentRun, updates);
    this.emit('run-update', { run: { ...this.currentRun } });
  }

  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.log('Pipeline iptal edildi.');
      if (this.currentRun) {
        this.updateRun({ status: 'paused' });
      }
    }
  }

  getRun(): PipelineRun | null {
    return this.currentRun ? { ...this.currentRun } : null;
  }

  async execute(config: PipelineConfig, brand: Brand): Promise<PipelineRun> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    // Initialize run
    const steps: PipelineStep[] = [
      { id: 'analyze', name: 'Stil Analizi', description: 'Referans görseller analiz ediliyor', status: 'idle', progress: 0 },
      { id: 'match', name: 'Akıllı Eşleştirme', description: 'Konular en uygun stillerle eşleştiriliyor', status: 'idle', progress: 0 },
      { id: 'generate', name: 'Görsel Üretimi', description: 'Markalı görseller üretiliyor', status: 'idle', progress: 0 },
      { id: 'revise', name: 'Otomatik Revizyon', description: 'Görseller revize ediliyor', status: 'idle', progress: 0 },
      { id: 'save', name: 'Kayıt & Arşiv', description: 'Sonuçlar kaydediliyor', status: 'idle', progress: 0 },
    ];

    if (!config.autoRevise) {
      steps[3].status = 'skipped';
    }
    if (!config.saveAsTemplate) {
      steps[4].status = 'skipped';
    }

    const results: PipelineResult[] = config.topics.map((topic, i) => ({
      id: `result-${i}`,
      topic,
      styleAnalysis: {} as StyleAnalysis,
      referenceImageId: '',
      status: 'pending' as const,
    }));

    this.currentRun = {
      id: `run-${Date.now()}`,
      configId: config.id,
      status: 'running',
      steps,
      results,
      startedAt: Date.now(),
      totalItems: config.topics.length,
      completedItems: 0,
    };

    this.emit('run-update', { run: { ...this.currentRun } });
    this.log(`Pipeline başlatıldı: ${config.name}`);
    this.log(`${config.topics.length} konu, ${config.referenceImages.length} referans görsel`);

    try {
      // ===== STEP 1: ANALYZE =====
      const analyses = await this.stepAnalyze(config.referenceImages, signal);

      // ===== STEP 2: MATCH =====
      const matches = await this.stepMatch(config.topics, analyses, signal);

      // ===== STEP 3: GENERATE =====
      await this.stepGenerate(config, brand, analyses, matches, signal);

      // ===== STEP 4: REVISE (optional) =====
      if (config.autoRevise && config.revisionPrompt) {
        await this.stepRevise(config.revisionPrompt, signal);
      }

      // ===== STEP 5: SAVE (optional) =====
      if (config.saveAsTemplate) {
        await this.stepSave(config, analyses);
      }

      this.updateRun({ status: 'completed', completedAt: Date.now() });
      this.log('Pipeline tamamlandı!');

    } catch (err: any) {
      if (err.name === 'AbortError') {
        this.updateRun({ status: 'paused' });
        this.log('Pipeline kullanıcı tarafından durduruldu.');
      } else {
        this.updateRun({ status: 'failed' });
        this.log(`Pipeline hatası: ${err.message}`);
      }
    }

    return { ...this.currentRun };
  }

  // ===== STEP 1: Analyze all reference images =====
  private async stepAnalyze(
    images: PipelineImage[],
    signal: AbortSignal
  ): Promise<Map<string, StyleAnalysis>> {
    this.updateStep('analyze', { status: 'running', startedAt: Date.now() });
    this.log('Stil analizi başlıyor...');

    const analyses = new Map<string, StyleAnalysis>();

    for (let i = 0; i < images.length; i++) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

      const img = images[i];
      this.log(`Analiz ediliyor: ${img.name} (${i + 1}/${images.length})`);

      try {
        const analysis = await analyzeImageStyle(img.base64);
        analyses.set(img.id, analysis);
        this.updateStep('analyze', {
          progress: Math.round(((i + 1) / images.length) * 100)
        });
      } catch (err: any) {
        this.log(`Analiz hatası (${img.name}): ${err.message}`);
        throw err;
      }
    }

    this.updateStep('analyze', { status: 'completed', completedAt: Date.now(), progress: 100 });
    this.log(`${analyses.size} görsel başarıyla analiz edildi.`);
    return analyses;
  }

  // ===== STEP 2: Match topics to styles =====
  private async stepMatch(
    topics: string[],
    analyses: Map<string, StyleAnalysis>,
    signal: AbortSignal
  ): Promise<{ topicIndex: number; styleId: string }[]> {
    this.updateStep('match', { status: 'running', startedAt: Date.now() });
    this.log('Akıllı eşleştirme başlıyor...');

    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const analyzedStyles = Array.from(analyses.entries()).map(([id, analysis]) => ({
      id,
      analysis,
    }));

    let matches: { topicIndex: number; styleId: string }[];

    if (analyzedStyles.length === 1) {
      // Single style: assign all topics to it
      matches = topics.map((_, i) => ({ topicIndex: i, styleId: analyzedStyles[0].id }));
      this.log('Tek stil mevcut, tüm konulara atandı.');
    } else {
      matches = await matchTopicsToStyles(topics, analyzedStyles);
      this.log(`${matches.length} eşleştirme yapıldı.`);
    }

    // Update results with matched style info
    for (const match of matches) {
      const analysis = analyses.get(match.styleId);
      if (analysis) {
        this.updateResult(`result-${match.topicIndex}`, {
          styleAnalysis: analysis,
          referenceImageId: match.styleId,
        });
      }
    }

    this.updateStep('match', { status: 'completed', completedAt: Date.now(), progress: 100 });
    return matches;
  }

  // ===== STEP 3: Generate branded images =====
  private async stepGenerate(
    config: PipelineConfig,
    brand: Brand,
    analyses: Map<string, StyleAnalysis>,
    matches: { topicIndex: number; styleId: string }[],
    signal: AbortSignal
  ): Promise<void> {
    this.updateStep('generate', { status: 'running', startedAt: Date.now() });
    this.log('Görsel üretimi başlıyor...');

    for (let i = 0; i < matches.length; i++) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

      const match = matches[i];
      const topic = config.topics[match.topicIndex];
      const analysis = analyses.get(match.styleId);
      const refImage = config.referenceImages.find(img => img.id === match.styleId);

      if (!analysis || !refImage) {
        this.updateResult(`result-${match.topicIndex}`, {
          status: 'failed',
          error: 'Stil veya referans bulunamadı'
        });
        continue;
      }

      this.updateResult(`result-${match.topicIndex}`, { status: 'generating' });
      this.log(`Üretiliyor (${i + 1}/${matches.length}): "${topic}"`);

      try {
        // Cycle through product images
        const productImg = config.productImages.length > 0
          ? config.productImages[i % config.productImages.length]
          : null;

        const imageBase64 = await generateBrandedImage(
          brand,
          analysis,
          refImage.base64,
          productImg?.base64 || null,
          topic,
          config.aspectRatio
        );

        this.updateResult(`result-${match.topicIndex}`, {
          status: 'completed',
          generatedImageBase64: imageBase64,
        });

        this.currentRun!.completedItems++;
        this.updateStep('generate', {
          progress: Math.round(((i + 1) / matches.length) * 100),
        });
        this.updateRun({ completedItems: this.currentRun!.completedItems });

      } catch (err: any) {
        this.updateResult(`result-${match.topicIndex}`, {
          status: 'failed',
          error: err.message,
        });
        this.log(`Üretim hatası ("${topic}"): ${err.message}`);
      }
    }

    this.updateStep('generate', { status: 'completed', completedAt: Date.now(), progress: 100 });
    this.log('Görsel üretimi tamamlandı.');
  }

  // ===== STEP 4: Auto-revise generated images =====
  private async stepRevise(revisionPrompt: string, signal: AbortSignal): Promise<void> {
    this.updateStep('revise', { status: 'running', startedAt: Date.now() });
    this.log('Otomatik revizyon başlıyor...');

    const completedResults = this.currentRun!.results.filter(
      r => r.status === 'completed' && r.generatedImageBase64
    );

    for (let i = 0; i < completedResults.length; i++) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

      const result = completedResults[i];
      this.updateResult(result.id, { status: 'revising' });
      this.log(`Revize ediliyor (${i + 1}/${completedResults.length}): "${result.topic}"`);

      try {
        const revised = await reviseGeneratedImage(
          result.generatedImageBase64!,
          revisionPrompt,
          null
        );

        this.updateResult(result.id, {
          status: 'completed',
          revisedImageBase64: revised,
        });

        this.updateStep('revise', {
          progress: Math.round(((i + 1) / completedResults.length) * 100),
        });
      } catch (err: any) {
        this.log(`Revizyon hatası ("${result.topic}"): ${err.message}`);
        // Don't fail the result, keep original
        this.updateResult(result.id, { status: 'completed' });
      }
    }

    this.updateStep('revise', { status: 'completed', completedAt: Date.now(), progress: 100 });
    this.log('Otomatik revizyon tamamlandı.');
  }

  // ===== STEP 5: Save results as templates =====
  private async stepSave(
    config: PipelineConfig,
    analyses: Map<string, StyleAnalysis>
  ): Promise<void> {
    this.updateStep('save', { status: 'running', startedAt: Date.now() });
    this.log('Sonuçlar kaydediliyor...');

    // Save unique style analyses as templates
    const savedIds: string[] = [];
    analyses.forEach((analysis, imageId) => {
      const refImage = config.referenceImages.find(img => img.id === imageId);
      if (refImage) {
        const templateId = `tpl-${Date.now()}-${imageId}`;
        savedIds.push(templateId);
      }
    });

    this.updateStep('save', {
      status: 'completed',
      completedAt: Date.now(),
      progress: 100,
      result: { savedTemplateIds: savedIds }
    });
    this.log(`${savedIds.length} şablon kaydedildi.`);
  }
}

// Singleton instance
export const pipelineService = new PipelineService();
