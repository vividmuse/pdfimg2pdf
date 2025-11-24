
export enum ProcessingStatus {
  IDLE = 'IDLE',
  PROCESSING_PDF = 'PROCESSING_PDF',
  GENERATING_STAMP = 'GENERATING_STAMP',
  READY = 'READY',
  ERROR = 'ERROR'
}

export type LayoutMode = 'vertical' | 'grid' | 'grid-a4' | 'grid-a3';
export type PageOrientation = 'portrait' | 'landscape';

export interface PageConfig {
  headerText: string;
  footerText: string;
}

export interface ProcessingConfig {
  threshold: number; // 0-255, for white background
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  targetColor?: { r: number; g: number; b: number }; // Color to remove
  colorTolerance?: number; // 0-100, tolerance for color matching
}

export interface StampConfig {
  text: string;
  subText: string;
  size: number;
  color: string;
  opacity: number;
  shape: 'square' | 'circle';
  paddingX: number;
  paddingY: number;
}

export interface PdfPageImage {
  blob: string;
  width: number;
  height: number;
  pageIndex: number;
}
