
import { PdfPageImage, LayoutMode, StampConfig } from '../types';

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

const calculateOptimalGrid = (count: number, itemWidth: number, itemHeight: number, targetRatio: number = 1.0) => {
  let bestMetric = Number.MAX_VALUE;
  let bestRows = Math.ceil(Math.sqrt(count));
  let bestCols = Math.ceil(count / bestRows);

  // Iterate to find the grid configuration that results in the largest content when fit into the target aspect ratio
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const gridW = cols * itemWidth;
    const gridH = rows * itemHeight;
    
    // We want to minimize the limiting dimension relative to the aspect ratio
    // To fit Grid(W, H) into Container(Cw, Ch) where Cw/Ch = targetRatio.
    // The scale factor S = min(Cw/W, Ch/H). We want to maximize S.
    // Maximizing S is equivalent to minimizing 1/S = max(W/Cw, H/Ch).
    // Assuming Cw = 1, then Ch = 1/targetRatio.
    // Minimize max(W, H * targetRatio).
    
    const metric = Math.max(gridW, gridH * targetRatio);
    
    if (metric < bestMetric) {
        bestMetric = metric;
        bestRows = rows;
        bestCols = cols;
    }
  }
  
  return { rows: bestRows, cols: bestCols };
};

export const stitchImagesAndStamp = async (
  images: PdfPageImage[],
  stampCanvas: HTMLCanvasElement | null,
  layoutMode: LayoutMode = 'vertical',
  stampConfig: StampConfig // Need access to padding config
): Promise<string> => {
  if (images.length === 0) return '';

  const maxWidth = Math.max(...images.map(img => img.width));
  const maxHeight = Math.max(...images.map(img => img.height));

  let canvasWidth = 0;
  let canvasHeight = 0;
  let rows = 0;
  let cols = 0;
  
  // Style constants for Comic Strip mode
  const isGrid = layoutMode.startsWith('grid');
  const GUTTER_SIZE = isGrid ? 40 : 0;
  const OUTER_PADDING = isGrid ? 60 : 0;

  if (layoutMode === 'vertical') {
    canvasWidth = maxWidth;
    canvasHeight = images.reduce((sum, img) => sum + img.height, 0);
  } else {
    // GRID MODE (Square or A4)
    const targetRatio = layoutMode === 'grid-a4' ? 210/297 : 1.0;
    
    const gridConfig = calculateOptimalGrid(images.length, maxWidth + GUTTER_SIZE, maxHeight + GUTTER_SIZE, targetRatio);
    rows = gridConfig.rows;
    cols = gridConfig.cols;
    
    // Grid dimensions including gutters
    const gridPixelWidth = (cols * maxWidth) + ((cols - 1) * GUTTER_SIZE) + (OUTER_PADDING * 2);
    const gridPixelHeight = (rows * maxHeight) + ((rows - 1) * GUTTER_SIZE) + (OUTER_PADDING * 2);
    
    // Determine canvas size to match target aspect ratio
    if (layoutMode === 'grid-a4') {
        // Fit the grid content into an A4 container
        // Try matching width
        let testW = gridPixelWidth;
        let testH = testW / targetRatio;
        
        if (testH < gridPixelHeight) {
            // If height isn't enough, match height
            testH = gridPixelHeight;
            testW = testH * targetRatio;
        }
        canvasWidth = testW;
        canvasHeight = testH;
    } else {
        // Square Grid
        const squareSize = Math.max(gridPixelWidth, gridPixelHeight);
        canvasWidth = squareSize;
        canvasHeight = squareSize;
    }
  }

  // 2. Create the master canvas
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) return '';

  // Fill white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 3. Draw images
  if (layoutMode === 'vertical') {
    let currentY = 0;
    for (const imgData of images) {
      const img = new Image();
      img.src = imgData.blob;
      await new Promise((resolve) => { img.onload = resolve; });

      const xOffset = (canvasWidth - imgData.width) / 2;
      ctx.drawImage(img, xOffset, currentY, imgData.width, imgData.height);
      currentY += imgData.height;
    }
  } else {
    // GRID MODE (Comic Strip Effect)
    
    // Calculate total size of the grid content block
    const totalContentWidth = (cols * maxWidth) + ((cols - 1) * GUTTER_SIZE);
    const totalContentHeight = (rows * maxHeight) + ((rows - 1) * GUTTER_SIZE);
    
    // Center the whole grid block in the canvas
    const startX = (canvasWidth - totalContentWidth) / 2;
    const startY = (canvasHeight - totalContentHeight) / 2;

    for (let i = 0; i < images.length; i++) {
      const imgData = images[i];
      const img = new Image();
      img.src = imgData.blob;
      await new Promise((resolve) => { img.onload = resolve; });

      const colIndex = i % cols;
      const rowIndex = Math.floor(i / cols);

      // Top-left coordinate for this cell slot
      const cellX = startX + colIndex * (maxWidth + GUTTER_SIZE);
      const cellY = startY + rowIndex * (maxHeight + GUTTER_SIZE);
      
      // Center the image within its specific slot
      const imgX = cellX + (maxWidth - imgData.width) / 2;
      const imgY = cellY + (maxHeight - imgData.height) / 2;

      // -- Comic Strip Styling --
      
      // 1. Drop Shadow
      ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
      ctx.shadowBlur = 15;
      ctx.shadowOffsetX = 5;
      ctx.shadowOffsetY = 5;
      
      // 2. Draw Image
      ctx.drawImage(img, imgX, imgY, imgData.width, imgData.height);
      
      // Reset Shadow for subsequent strokes
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // 3. Border (Black outline)
      ctx.strokeStyle = "#1e293b"; // Slate-800
      ctx.lineWidth = 3;
      ctx.strokeRect(imgX, imgY, imgData.width, imgData.height);

      // 4. Page Number Badge (Comic order)
      const badgeSize = 40;
      const badgeX = imgX + imgData.width - badgeSize / 2; 
      const badgeY = imgY + imgData.height - badgeSize / 2;
      
      // Bottom Right inside the frame
      const numX = imgX + imgData.width - 30;
      const numY = imgY + imgData.height - 30;

      ctx.beginPath();
      ctx.arc(numX, numY, 20, 0, Math.PI * 2);
      ctx.fillStyle = "#1e293b";
      ctx.fill();
      
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 20px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText((i + 1).toString(), numX, numY);
    }
  }

  // 4. Draw Stamp (if provided)
  if (stampCanvas) {
    const stampWidth = stampCanvas.width;
    const stampHeight = stampCanvas.height;
    
    // Calculate target size
    const targetStampWidth = Math.min(canvasWidth * 0.2, 500); 
    const scaleRatio = targetStampWidth / stampWidth;
    const targetStampHeight = stampHeight * scaleRatio;

    // Determine Anchor Point (Bottom-Right Reference)
    let referenceRight = canvasWidth;
    let referenceBottom = canvasHeight;

    if (layoutMode.startsWith('grid')) {
        // In grid mode, anchor to the actual content bounds
        const totalContentWidth = (cols * maxWidth) + ((cols - 1) * GUTTER_SIZE);
        const totalContentHeight = (rows * maxHeight) + ((rows - 1) * GUTTER_SIZE);
        
        const startX = (canvasWidth - totalContentWidth) / 2;
        const startY = (canvasHeight - totalContentHeight) / 2;
        
        referenceRight = startX + totalContentWidth;
        referenceBottom = startY + totalContentHeight;
    }

    // Use user configured padding
    const userPaddingX = stampConfig.paddingX ?? 50;
    const userPaddingY = stampConfig.paddingY ?? 50;

    const stampX = referenceRight - targetStampWidth - userPaddingX;
    const stampY = referenceBottom - targetStampHeight - userPaddingY;

    ctx.drawImage(stampCanvas, stampX, stampY, targetStampWidth, targetStampHeight);
  }

  return canvas.toDataURL('image/jpeg', 0.9);
};
