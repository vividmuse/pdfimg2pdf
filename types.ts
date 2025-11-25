
export enum ProcessingStatus {
  IDLE = 'IDLE',
  PROCESSING_PDF = 'PROCESSING_PDF',
  READY = 'READY',
  ERROR = 'ERROR'
}

export type LayoutMode = 'vertical' | 'grid' | 'grid-a4' | 'grid-a3';
export type PageOrientation = 'portrait' | 'landscape';

export interface ProcessingConfig {
  threshold: number; // 0-100 (0 = off)
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  targetColor?: { r: number; g: number; b: number };
  colorTolerance?: number; // 0-100
  strongBinarize?: boolean;
}



export interface PdfPageImage {
  blob: string;
  width: number;
  height: number;
  pageIndex: number;
}
