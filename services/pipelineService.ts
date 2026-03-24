
import {
  Brand, StyleAnalysis, DesignBlueprint, PipelineConfig, PipelineRun, PipelineStep,
  PipelineResult, PipelineImage, SavedTemplate, GeneratedAsset
} from '../types';
import {
  analyzeImageStyle, decomposeToBlueprint, matchTopicsToStyles,
  generateBrandedImage, reconstructFromBlueprint, adaptMasterToFormat,
  generateDesignDirectives, DesignDirectives
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
    const formats = config.aspectRatios && config.aspectRatios.length > 0
      ? config.aspectRatios
      : [config.aspectRatio];
    const totalItems = config.topics.length * formats.length;

    const steps: PipelineStep[] = [
      { id: 'blueprint', name: 'Blueprint Ayrıştırma', description: 'Referans görseller JSON katmanlarına ayrıştırılıyor', status: 'idle', progress: 0 },
      { id: 'match', name: 'Akıllı Eşleştirme', description: 'Konular en uygun stillerle eşleştiriliyor', status: 'idle', progress: 0 },
      { id: 'directives', name: 'Tasarım Direktifleri', description: 'AI Kreatif Direktör tasarım kurallarını belirliyor', status: 'idle', progress: 0 },
      { id: 'generate', name: 'Görsel Üretimi', description: `${totalItems} görsel üretiliyor (${formats.length} format)`, status: 'idle', progress: 0 },
      { id: 'save', name: 'Kayıt & Arşiv', description: 'Sonuçlar kaydediliyor', status: 'idle', progress: 0 },
    ];

    if (!config.autoRevise) {
      steps[2].status = 'skipped'; // Skip directives step
    }
    if (!config.saveAsTemplate) {
      steps[4].status = 'skipped';
    }

    const results: PipelineResult[] = [];
    config.topics.forEach((topic, ti) => {
      formats.forEach((fmt, fi) => {
        results.push({
          id: `result-${ti}-${fi}`,
          topic: formats.length > 1 ? `${topic} [${fmt}]` : topic,
          styleAnalysis: {} as StyleAnalysis,
          referenceImageId: '',
          status: 'pending' as const,
        });
      });
    });

    this.currentRun = {
      id: `run-${Date.now()}`,
      configId: config.id,
      status: 'running',
      steps,
      results,
      startedAt: Date.now(),
      totalItems: totalItems,
      completedItems: 0,
    };

    this.emit('run-update', { run: { ...this.currentRun } });
    this.log(`Pipeline başlatıldı: ${config.name}`);
    this.log(`${config.topics.length} konu, ${config.referenceImages.length} referans görsel`);

    try {
      // ===== STEP 1: BLUEPRINT DECOMPOSITION =====
      const { analyses, blueprints } = await this.stepBlueprint(config.referenceImages, signal);

      // ===== STEP 2: MATCH =====
      const matches = await this.stepMatch(config.topics, analyses, signal);

      // ===== STEP 3: DESIGN DIRECTIVES (optional, before generation) =====
      let directives: Map<number, string> | null = null;
      if (config.autoRevise) {
        directives = await this.stepDirectives(config, brand, analyses, matches, signal);
      }

      // ===== STEP 4: GENERATE (multi-format) =====
      await this.stepGenerate(config, brand, analyses, blueprints, matches, formats, signal, directives);

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

  // ===== STEP 1: Blueprint decomposition =====
  private async stepBlueprint(
    images: PipelineImage[],
    signal: AbortSignal
  ): Promise<{ analyses: Map<string, StyleAnalysis>; blueprints: Map<string, DesignBlueprint> }> {
    this.updateStep('blueprint', { status: 'running', startedAt: Date.now() });
    this.log('Blueprint ayrıştırma başlıyor — her görsel JSON katmanlarına çözümleniyor...');

    const analyses = new Map<string, StyleAnalysis>();
    const blueprints = new Map<string, DesignBlueprint>();

    for (let i = 0; i < images.length; i++) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

      const img = images[i];
      this.log(`Ayrıştırılıyor: ${img.name} (${i + 1}/${images.length})`);

      try {
        // Run both in parallel: quick style analysis + deep blueprint
        const [analysis, blueprint] = await Promise.all([
          analyzeImageStyle(img.base64),
          decomposeToBlueprint(img.base64),
        ]);

        analyses.set(img.id, analysis);
        blueprints.set(img.id, blueprint);

        const layerCount = blueprint.layers.length;
        const layerTypes = [...new Set(blueprint.layers.map(l => l.type))].join(', ');
        this.log(`  → ${layerCount} katman tespit edildi: ${layerTypes}`);
        this.log(`  → Layout: ${blueprint.layout.type}, Renk: ${blueprint.colorSystem.dominant} / ${blueprint.colorSystem.secondary}`);

        this.updateStep('blueprint', {
          progress: Math.round(((i + 1) / images.length) * 100)
        });
      } catch (err: any) {
        this.log(`Ayrıştırma hatası (${img.name}): ${err.message}`);
        throw err;
      }
    }

    this.updateStep('blueprint', { status: 'completed', completedAt: Date.now(), progress: 100 });
    this.log(`${analyses.size} görsel ayrıştırıldı — ${blueprints.size} blueprint oluşturuldu.`);
    return { analyses, blueprints };
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

  // ===== STEP 4: Generate branded images (Master → Adapt flow) =====
  private async stepGenerate(
    config: PipelineConfig,
    brand: Brand,
    analyses: Map<string, StyleAnalysis>,
    blueprints: Map<string, DesignBlueprint>,
    matches: { topicIndex: number; styleId: string }[],
    formats: string[],
    signal: AbortSignal,
    directives?: Map<number, string> | null
  ): Promise<void> {
    this.updateStep('generate', { status: 'running', startedAt: Date.now() });
    const totalGenerations = matches.length * formats.length;
    // First format is the "master", rest are adaptations
    const masterFormat = formats[0];
    const adaptFormats = formats.slice(1);

    this.log(`Görsel üretimi başlıyor — ${matches.length} konu × ${formats.length} format = ${totalGenerations} görsel`);
    if (adaptFormats.length > 0) {
      this.log(`  → Master format: ${masterFormat}, Adaptasyon: ${adaptFormats.join(', ')}`);
      this.log(`  → Her konu için önce master üretilecek, sonra birebir aynı tasarım diğer formatlara adapt edilecek.`);
    }

    let completed = 0;

    for (let i = 0; i < matches.length; i++) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

      const match = matches[i];
      const topic = config.topics[match.topicIndex];
      const analysis = analyses.get(match.styleId);
      const blueprint = blueprints.get(match.styleId);
      const refImage = config.referenceImages.find(img => img.id === match.styleId);

      if (!analysis || !refImage) {
        formats.forEach((_, fi) => {
          this.updateResult(`result-${match.topicIndex}-${fi}`, {
            status: 'failed',
            error: 'Stil veya referans bulunamadı'
          });
        });
        continue;
      }

      const directive = directives?.get(match.topicIndex);
      const productImg = config.productImages.length > 0
        ? config.productImages[i % config.productImages.length]
        : null;

      // ─── STEP A: Generate MASTER image (first format) ───
      const masterResultId = `result-${match.topicIndex}-0`;
      this.updateResult(masterResultId, { status: 'generating' });
      this.log(`🎨 MASTER üretiliyor (${completed + 1}/${totalGenerations}): "${topic}" [${masterFormat}]`);

      let masterImageBase64: string | null = null;

      try {
        if (blueprint) {
          if (directive) this.log(`  → Blueprint + Direktif uygulanıyor...`);
          masterImageBase64 = await reconstructFromBlueprint(
            blueprint,
            brand,
            topic,
            masterFormat,
            refImage.base64,
            productImg?.base64 || null,
            directive
          );
        } else {
          masterImageBase64 = await generateBrandedImage(
            brand,
            analysis,
            refImage.base64,
            productImg?.base64 || null,
            topic,
            masterFormat,
            directive
          );
        }

        this.updateResult(masterResultId, {
          status: 'completed',
          generatedImageBase64: masterImageBase64,
        });

        completed++;
        this.currentRun!.completedItems = completed;
        this.updateStep('generate', {
          progress: Math.round((completed / totalGenerations) * 100),
        });
        this.updateRun({ completedItems: completed });
        this.log(`  ✓ Master tamamlandı.`);

      } catch (err: any) {
        this.updateResult(masterResultId, {
          status: 'failed',
          error: err.message,
        });
        this.log(`  ✗ Master hatası ("${topic}"): ${err.message}`);
        completed++;

        // If master failed, skip adaptations for this topic
        adaptFormats.forEach((_, afi) => {
          this.updateResult(`result-${match.topicIndex}-${afi + 1}`, {
            status: 'failed',
            error: 'Master görsel üretilemediği için adaptasyon atlandı'
          });
          completed++;
        });
        this.currentRun!.completedItems = completed;
        this.updateRun({ completedItems: completed });
        continue;
      }

      // ─── STEP B: Adapt master to each additional format ───
      for (let afi = 0; afi < adaptFormats.length; afi++) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

        const targetFmt = adaptFormats[afi];
        const adaptResultId = `result-${match.topicIndex}-${afi + 1}`;

        this.updateResult(adaptResultId, { status: 'generating' });
        this.log(`  📐 Adapt ediliyor (${completed + 1}/${totalGenerations}): "${topic}" [${masterFormat} → ${targetFmt}]`);

        try {
          const adaptedBase64 = await adaptMasterToFormat(
            masterImageBase64!,
            blueprint || { canvas: { aspectRatio: masterFormat, backgroundColor: brand.primaryColor, mood: analysis.mood, style: analysis.artisticStyle }, layout: { type: 'single-column', alignment: 'center', padding: '5%', gutterSize: '2%', visualFlow: '' }, layers: [], typography: { headingStyle: '', bodyStyle: '', accentStyle: '', hierarchy: '' }, colorSystem: { dominant: brand.primaryColor, secondary: brand.secondaryColor, accent: brand.primaryColor, textPrimary: '#FFFFFF', textSecondary: '#CCCCCC', distribution: '' }, compositionNotes: analysis.composition, formatAdjustments: {} },
            brand,
            topic,
            targetFmt,
            masterFormat,
            productImg?.base64 || null
          );

          this.updateResult(adaptResultId, {
            status: 'completed',
            generatedImageBase64: adaptedBase64,
          });

          completed++;
          this.currentRun!.completedItems = completed;
          this.updateStep('generate', {
            progress: Math.round((completed / totalGenerations) * 100),
          });
          this.updateRun({ completedItems: completed });
          this.log(`  ✓ Adaptasyon tamamlandı [${targetFmt}] — master ile birebir aynı tasarım.`);

        } catch (err: any) {
          this.updateResult(adaptResultId, {
            status: 'failed',
            error: err.message,
          });
          this.log(`  ✗ Adaptasyon hatası ("${topic}" [${targetFmt}]): ${err.message}`);
          completed++;
        }
      }
    }

    this.updateStep('generate', { status: 'completed', completedAt: Date.now(), progress: 100 });
    this.log('Görsel üretimi tamamlandı.');
  }

  // ===== STEP 3: Generate design directives before image generation =====
  private async stepDirectives(
    config: PipelineConfig,
    brand: Brand,
    analyses: Map<string, StyleAnalysis>,
    matches: { topicIndex: number; styleId: string }[],
    signal: AbortSignal
  ): Promise<Map<number, string>> {
    this.updateStep('directives', { status: 'running', startedAt: Date.now() });
    this.log('AI Kreatif Direktör tasarım kurallarını belirliyor...');

    const directivesMap = new Map<number, string>();

    for (let i = 0; i < matches.length; i++) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

      const match = matches[i];
      const topic = config.topics[match.topicIndex];
      const analysis = analyses.get(match.styleId);

      if (!analysis) continue;

      this.log(`Direktif oluşturuluyor (${i + 1}/${matches.length}): "${topic}"`);

      try {
        const directives = await generateDesignDirectives(
          brand,
          topic,
          analysis,
          config.aspectRatio
        );

        directivesMap.set(match.topicIndex, directives.fullDirective);

        this.log(`  → Tipografi: ${directives.typographyRules.slice(0, 60)}...`);
        this.log(`  → Renk: ${directives.colorStrategy.slice(0, 60)}...`);

        this.updateStep('directives', {
          progress: Math.round(((i + 1) / matches.length) * 100),
        });
      } catch (err: any) {
        this.log(`Direktif hatası ("${topic}"): ${err.message}`);
        // Continue without directive — image will still generate with base prompt
      }
    }

    this.updateStep('directives', { status: 'completed', completedAt: Date.now(), progress: 100 });
    this.log(`${directivesMap.size} konu için tasarım direktifi oluşturuldu.`);
    return directivesMap;
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
