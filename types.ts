
export interface BrandColor {
  name: string;
  hex: string;
}

// ══════════════════════════════════════════════════
// Brand Asset Vault — real brand materials for creatives
// ══════════════════════════════════════════════════

export type BrandAssetCategory =
  | 'qr_code'           // App download QR, website QR
  | 'app_store_badge'   // Apple App Store badge
  | 'play_store_badge'  // Google Play Store badge
  | 'app_icon'          // App icon
  | 'social_icon'       // Social media icons (custom)
  | 'product_photo'     // Product shots
  | 'badge'             // Trust badges, certifications
  | 'custom_icon'       // Custom brand icons
  | 'watermark'         // Brand watermark
  | 'pattern'           // Brand pattern/texture
  | 'other';            // Misc

export interface BrandAsset {
  id: string;
  category: BrandAssetCategory;
  name: string;           // "App Store Badge", "QR Kod — Uygulama İndirme"
  description: string;    // When to use: "Uygulama tanıtımı yapılırken kullan"
  imageBase64: string;    // The actual asset image
  usageRule: string;      // AI hint: "Use when topic mentions app download or mobile"
  createdAt: number;
}

export interface BrandPricing {
  id: string;
  name: string;           // "Başlangıç Paketi", "Pro Plan"
  price: string;          // "₺99/ay", "$9.99/mo", "Free"
  features: string[];     // ["5GB storage", "Unlimited users"]
  highlighted: boolean;   // Is this the featured/recommended plan?
}

export interface Brand {
  id: string;
  name: string;
  industry: string;
  description?: string;
  logo: string | null;
  primaryColor: string;
  secondaryColor: string;
  palette: BrandColor[];
  tone: string;
  // Contact Details
  instagram?: string;
  phone?: string;
  address?: string;
  website?: string;
  // Asset Vault
  assets?: BrandAsset[];
  pricing?: BrandPricing[];
  slogans?: string[];          // Brand slogans/taglines
  appStoreUrl?: string;        // iOS App Store link
  playStoreUrl?: string;       // Google Play Store link
}

export interface StyleAnalysis {
  composition: string;
  lighting: string;
  colorPaletteDescription: string;
  mood: string;
  textureDetails: string;
  cameraAngle: string;
  artisticStyle: string;
  backgroundDetails: string;
}

// ══════════════════════════════════════════════════
// Design Blueprint — pixel-level JSON decomposition
// ══════════════════════════════════════════════════

export interface BlueprintLayer {
  id: string;
  type: 'text' | 'image' | 'shape' | 'icon' | 'logo' | 'background' | 'overlay' | 'decoration';
  content: string; // actual text or description of visual content
  position: {
    x: string;      // percentage from left (e.g. "5%", "center", "right")
    y: string;      // percentage from top
    anchor: string;  // "top-left" | "center" | "bottom-right" etc.
  };
  size: {
    width: string;   // percentage of canvas (e.g. "90%", "auto")
    height: string;
  };
  style: {
    fontFamily?: string;       // for text layers
    fontSize?: string;         // relative size "xl", "lg", "md", "sm", "xs"
    fontWeight?: string;       // "bold", "semibold", "regular", "light"
    textAlign?: string;        // "left", "center", "right"
    lineHeight?: string;       // "tight", "normal", "relaxed"
    letterSpacing?: string;    // "tight", "normal", "wide"
    textTransform?: string;    // "uppercase", "lowercase", "none"
    color: string;             // hex color
    backgroundColor?: string;
    borderRadius?: string;     // "none", "sm", "md", "lg", "full"
    opacity?: string;          // "100%", "80%", "50%", etc.
    shadow?: string;           // shadow description
    gradient?: string;         // gradient description
    blur?: string;             // blur amount
  };
  zIndex: number;              // layer stacking order
  rotation?: string;           // rotation in degrees
  effects?: string;            // additional effects description
}

export interface DesignBlueprint {
  // Canvas properties
  canvas: {
    aspectRatio: string;       // detected aspect ratio
    backgroundColor: string;   // hex
    backgroundGradient?: string;
    backgroundTexture?: string;
    mood: string;
    style: string;             // "minimalist", "bold", "elegant", etc.
  };
  // Layout grid
  layout: {
    type: string;              // "single-column", "two-column", "centered", "z-pattern", "f-pattern"
    alignment: string;         // "left", "center", "right"
    padding: string;           // percentage padding
    gutterSize: string;        // space between elements
    visualFlow: string;        // description of eye flow
  };
  // All layers in order
  layers: BlueprintLayer[];
  // Typography system
  typography: {
    headingStyle: string;      // font description for headings
    bodyStyle: string;         // font description for body
    accentStyle: string;       // font description for CTAs/badges
    hierarchy: string;         // description of text hierarchy
  };
  // Color system
  colorSystem: {
    dominant: string;          // hex — 60%
    secondary: string;         // hex — 30%
    accent: string;            // hex — 10%
    textPrimary: string;       // hex
    textSecondary: string;     // hex
    distribution: string;      // description of how colors are distributed
  };
  // Composition notes
  compositionNotes: string;    // overall composition analysis
  // Per-format alignment adjustments
  formatAdjustments: {
    square?: string;           // how to adjust for 1:1
    portrait?: string;         // how to adjust for 4:5
    story?: string;            // how to adjust for 9:16
    landscape?: string;        // how to adjust for 16:9
  };
}

export interface TemplateFolder {
  id: string;
  name: string;
  thumbnail?: string;
}

export interface SavedTemplate {
  id: string;
  name: string;
  thumbnail: string; // Base64 of the reference image
  analysis: StyleAnalysis;
  folderId?: string; // Optional folder reference
  createdAt: number;
}

export interface GeneratedAsset {
  id: string;
  url: string; // Base64 data url
  promptUsed: string;
  brandId: string;
  createdAt: number;
}

export type ViewState = 'dashboard' | 'brands' | 'analyzer' | 'library' | 'bulk' | 'pipeline' | 'scout';

// Content Scout Types
export interface ScoutResult {
  id: string;
  title: string;
  imageUrl: string;
  thumbnailUrl: string;
  sourceUrl: string;
  platform: 'pinterest' | 'web' | 'pexels';
  width: number;
  height: number;
  photographer?: string;
}

export interface ScoutInspiration {
  id: string;
  brandId: string;
  searchQuery: string;
  sourceUrl?: string;
  sourcePlatform: string;
  originalImageBase64?: string;
  adaptedImageBase64?: string;
  styleAnalysis?: StyleAnalysis;
  status: 'discovered' | 'downloaded' | 'analyzing' | 'adapting' | 'ready' | 'published' | 'rejected';
  tags: string[];
  score: number;
  createdAt: string;
}

// Pipeline Types
export type PipelineStepStatus = 'idle' | 'running' | 'completed' | 'failed' | 'skipped';

export interface PipelineStep {
  id: string;
  name: string;
  description: string;
  status: PipelineStepStatus;
  progress: number; // 0-100
  error?: string;
  startedAt?: number;
  completedAt?: number;
  result?: any;
}

export interface PipelineConfig {
  id: string;
  name: string;
  brandId: string;
  aspectRatio: string;
  aspectRatios?: string[];     // multi-format: generate all selected formats
  topics: string[];
  referenceImages: PipelineImage[];
  productImages: PipelineImage[];
  autoRevise: boolean;
  revisionPrompt?: string;
  saveAsTemplate: boolean;
  templateFolderId?: string;
  createdAt: number;
}

export interface PipelineImage {
  id: string;
  base64: string;
  name: string;
}

export interface PipelineRun {
  id: string;
  configId: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  steps: PipelineStep[];
  results: PipelineResult[];
  startedAt?: number;
  completedAt?: number;
  totalItems: number;
  completedItems: number;
}

export interface DesignReviewResult {
  score: number;
  needsRevision: boolean;
  issues: string[];
  revisionPrompt: string;
}

export interface PipelineResult {
  id: string;
  topic: string;
  styleAnalysis: StyleAnalysis;
  referenceImageId: string;
  generatedImageBase64?: string;
  revisedImageBase64?: string;
  designReview?: DesignReviewResult;
  status: 'pending' | 'analyzing' | 'generating' | 'revising' | 'completed' | 'failed';
  error?: string;
  savedAsTemplateId?: string;
}

export interface OptimizedPromptDetails {
  characterAnalysis: string;
  environmentDetails: string;
  lightingAndColor: string;
  perspective: string;
  optimizedPrompt: string;
}

export interface StoryTemplate {
  id: number;
  title: string;
  content: string;
}

// Bulk Generation Types
export interface BulkMatchItem {
  id: string;
  topic: string;
  referenceImageId: string; // ID of the uploaded file
  status: 'pending' | 'generating' | 'completed' | 'failed';
  resultUrl?: string;
}

export interface UploadedReference {
  id: string;
  file: File;
  base64: string;
  analysis?: StyleAnalysis; // Populated after analysis step
}
