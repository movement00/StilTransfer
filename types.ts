
export interface BrandColor {
  name: string;
  hex: string;
}

export interface Brand {
  id: string;
  name: string;
  industry: string;
  description?: string; // New field for detailed brand description
  logo: string | null; // Base64
  primaryColor: string; // UI gösterimi için ana renk
  secondaryColor: string; // UI gösterimi için ikincil renk
  palette: BrandColor[]; // AI üretimi için detaylı renk paleti
  tone: string;
  // New Contact Details
  instagram?: string;
  phone?: string;
  address?: string;
}

export interface StyleAnalysis {
  composition: string;
  lighting: string;
  colorPaletteDescription: string;
  mood: string;
  textureDetails: string;
  cameraAngle: string;
  artisticStyle: string;
  // New field for subtle details
  backgroundDetails: string; 
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
