import { PdfPageImage } from '../types';

// We rely on the global window.pdfjsLib loaded via CDN in index.html 
// to avoid complex bundler configuration for the worker file in this specific environment.
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

export const convertPdfToImages = async (file: File): Promise<PdfPageImage[]> => {
  const arrayBuffer = await file.arrayBuffer();
  
  // Load the document
  const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const images: PdfPageImage[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const scale = 2.0; // Higher scale for better quality
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) continue;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;

    images.push({
      blob: canvas.toDataURL('image/jpeg', 0.85),
      width: viewport.width,
      height: viewport.height,
      pageIndex: i
    });
  }

  return images;
};

export const stitchImagesAndStamp = async (
  images: PdfPageImage[],
  stampCanvas: HTMLCanvasElement | null
): Promise<string> => {
  if (images.length === 0) return '';

  // 1. Calculate total dimensions
  // We assume vertical stitching. We'll use the width of the widest page to maintain resolution.
  const maxWidth = Math.max(...images.map(img => img.width));
  const totalHeight = images.reduce((sum, img) => sum + img.height, 0);

  // 2. Create the master canvas
  const canvas = document.createElement('canvas');
  canvas.width = maxWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) return '';

  // Fill white background first
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 3. Draw images
  let currentY = 0;
  for (const imgData of images) {
    const img = new Image();
    img.src = imgData.blob;
    await new Promise((resolve) => {
      img.onload = resolve;
    });

    // Center smaller pages horizontally if needed
    const xOffset = (maxWidth - imgData.width) / 2;
    ctx.drawImage(img, xOffset, currentY, imgData.width, imgData.height);
    currentY += imgData.height;
  }

  // 4. Draw Stamp (if provided)
  if (stampCanvas) {
    const stampWidth = stampCanvas.width;
    const stampHeight = stampCanvas.height;
    
    // Position: Bottom Right with some padding
    // Scale stamp relative to document size to ensure it's visible but not huge
    // Let's say we want the stamp to be about 15-20% of the page width roughly
    
    const targetStampWidth = Math.min(maxWidth * 0.25, 400); // Max 400px or 25% width
    const scaleRatio = targetStampWidth / stampWidth;
    const targetStampHeight = stampHeight * scaleRatio;

    const marginX = maxWidth * 0.05; // 5% margin
    const marginY = maxWidth * 0.05;

    const stampX = maxWidth - targetStampWidth - marginX;
    const stampY = totalHeight - targetStampHeight - marginY;

    ctx.drawImage(stampCanvas, stampX, stampY, targetStampWidth, targetStampHeight);
  }

  return canvas.toDataURL('image/jpeg', 0.9);
};
