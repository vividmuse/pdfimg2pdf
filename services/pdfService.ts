import { PdfPageImage, LayoutMode, StampConfig, ProcessingConfig, PageOrientation, PageConfig } from '../types';

// We rely on the global window.pdfjsLib loaded via CDN in index.html 
// to avoid complex bundler configuration for the worker file in this specific environment.
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

// Mobile Canvas size limits
// iOS Safari: 4096x4096 or 16MB total pixels
// Android: Similar limits
const MAX_CANVAS_DIMENSION = 4096;
const MAX_CANVAS_AREA = 16777216; // 4096 * 4096

// Detect if running on mobile
const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Scale down canvas dimensions if they exceed mobile limits
const getMobileSafeCanvasSize = (width: number, height: number) => {
  if (!isMobile()) {
    return { width, height, scale: 1 };
  }

  // Check dimension limits
  let scale = 1;
  if (width > MAX_CANVAS_DIMENSION) {
    scale = Math.min(scale, MAX_CANVAS_DIMENSION / width);
  }
  if (height > MAX_CANVAS_DIMENSION) {
    scale = Math.min(scale, MAX_CANVAS_DIMENSION / height);
  }

  // Check area limit
  const area = width * height;
  if (area > MAX_CANVAS_AREA) {
    scale = Math.min(scale, Math.sqrt(MAX_CANVAS_AREA / area));
  }

  // Apply scale
  const scaledWidth = Math.floor(width * scale);
  const scaledHeight = Math.floor(height * scale);

  return { width: scaledWidth, height: scaledHeight, scale };
};

export const convertPdfToImages = async (file: File, mode: 'render' | 'extract' = 'render'): Promise<PdfPageImage[]> => {
  // Handle Image Files
  if (file.type.startsWith('image/')) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          resolve([{
            blob: e.target?.result as string,
            width: img.width,
            height: img.height,
            pageIndex: 1
          }]);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  const arrayBuffer = await file.arrayBuffer();

  // Load the document
  const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const images: PdfPageImage[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);

    if (mode === 'extract') {
      const operatorList = await page.getOperatorList();
      const validObjectTypes = [
        window.pdfjsLib.OPS.paintImageXObject,
        window.pdfjsLib.OPS.paintInlineImageXObject,
      ];

      for (let j = 0; j < operatorList.fnArray.length; j++) {
        const fn = operatorList.fnArray[j];
        if (validObjectTypes.includes(fn)) {
          const imageName = operatorList.argsArray[j][0];

          try {
            // Get image object
            let image;
            if (fn === window.pdfjsLib.OPS.paintInlineImageXObject) {
              image = imageName;
            } else {
              image = await page.objs.get(imageName);
            }

            // Create canvas for the extracted image
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');

            if (ctx) {
              // Draw image data to canvas
              if (image.data) {
                const width = image.width;
                const height = image.height;
                const srcData = image.data;

                // Guess kind based on data size if kind is missing
                let kind = image.kind;
                if (!kind) {
                  const size = width * height;
                  if (srcData.length === size * 4) kind = 3; // RGBA or CMYK
                  else if (srcData.length === size * 3) kind = 2; // RGB
                  else if (srcData.length === size) kind = 1; // Grayscale
                }

                let imageData: ImageData | null = null;

                try {
                  if (kind === 3) {
                    // RGBA - Direct copy
                    imageData = new ImageData(new Uint8ClampedArray(srcData), width, height);
                  } else if (kind === 2) {
                    // RGB - Convert to RGBA
                    const rgbaData = new Uint8ClampedArray(width * height * 4);
                    for (let i = 0, j = 0; i < srcData.length; i += 3, j += 4) {
                      rgbaData[j] = srcData[i];     // R
                      rgbaData[j + 1] = srcData[i + 1]; // G
                      rgbaData[j + 2] = srcData[i + 2]; // B
                      rgbaData[j + 3] = 255;        // A
                    }
                    imageData = new ImageData(rgbaData, width, height);
                  } else if (kind === 1) {
                    // Grayscale - Convert to RGBA
                    const rgbaData = new Uint8ClampedArray(width * height * 4);
                    for (let i = 0, j = 0; i < srcData.length; i++, j += 4) {
                      rgbaData[j] = srcData[i];     // R
                      rgbaData[j + 1] = srcData[i]; // G
                      rgbaData[j + 2] = srcData[i]; // B
                      rgbaData[j + 3] = 255;        // A
                    }
                    imageData = new ImageData(rgbaData, width, height);
                  } else {
                    console.warn(`Unknown image kind: ${kind} for image ${imageName}.Size: ${srcData.length}, W: ${width}, H: ${height} `);
                    // Last ditch effort: Try to treat as Grayscale if size matches, or RGB if size matches * 3
                    const size = width * height;
                    if (srcData.length === size) {
                      const rgbaData = new Uint8ClampedArray(width * height * 4);
                      for (let i = 0, j = 0; i < srcData.length; i++, j += 4) {
                        const val = srcData[i];
                        rgbaData[j] = val; rgbaData[j + 1] = val; rgbaData[j + 2] = val; rgbaData[j + 3] = 255;
                      }
                      imageData = new ImageData(rgbaData, width, height);
                    }
                  }
                } catch (err) {
                  console.error("Error creating ImageData:", err);
                }

                if (imageData) {
                  ctx.putImageData(imageData, 0, 0);
                  images.push({
                    blob: canvas.toDataURL('image/jpeg', 0.9),
                    width: image.width,
                    height: image.height,
                    pageIndex: i
                  });
                }
              } else if (image instanceof ImageBitmap || image instanceof HTMLImageElement || image instanceof HTMLCanvasElement) {
                ctx.drawImage(image, 0, 0);
                images.push({
                  blob: canvas.toDataURL('image/jpeg', 0.9),
                  width: image.width,
                  height: image.height,
                  pageIndex: i
                });
              } else if (image.bitmap) {
                // Sometimes it's in a bitmap property
                ctx.drawImage(image.bitmap, 0, 0);
                images.push({
                  blob: canvas.toDataURL('image/jpeg', 0.9),
                  width: image.width,
                  height: image.height,
                  pageIndex: i
                });
              }
            }
          } catch (e) {
            console.error("Failed to extract image", e);
          }
        }
      }
    } else {
      // RENDER MODE (Original)
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
  }

  return images;
};

const processImage = async (
  imgData: PdfPageImage,
  config: ProcessingConfig
): Promise<HTMLImageElement> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (config.threshold === 0 && config.brightness === 0 && config.contrast === 0 && !config.targetColor) {
        resolve(img);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = imgData.width;
      canvas.height = imgData.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(img);
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const threshold = config.threshold;
      const brightness = config.brightness;
      const contrast = config.contrast;
      const targetColor = config.targetColor;
      const colorTolerance = config.colorTolerance || 20;

      for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        // Apply brightness
        if (brightness !== 0) {
          r = Math.max(0, Math.min(255, r + brightness * 2.55));
          g = Math.max(0, Math.min(255, g + brightness * 2.55));
          b = Math.max(0, Math.min(255, b + brightness * 2.55));
        }

        // Apply contrast
        if (contrast !== 0) {
          const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
          r = Math.max(0, Math.min(255, factor * (r - 128) + 128));
          g = Math.max(0, Math.min(255, factor * (g - 128) + 128));
          b = Math.max(0, Math.min(255, factor * (b - 128) + 128));
        }

        // Apply color-based background removal (if targetColor is set)
        if (targetColor) {
          const colorDistance = Math.sqrt(
            Math.pow(r - targetColor.r, 2) +
            Math.pow(g - targetColor.g, 2) +
            Math.pow(b - targetColor.b, 2)
          );
          // Normalize distance to 0-100 scale (max distance is sqrt(3*255^2) ≈ 441)
          const normalizedDistance = (colorDistance / 441) * 100;

          if (normalizedDistance < colorTolerance) {
            // Make this pixel white
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
          } else {
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
          }
        } else {
          // Apply threshold (grayscale-based background removal)
          if (threshold > 0) {
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            if (gray > threshold) {
              data[i] = 255;
              data[i + 1] = 255;
              data[i + 2] = 255;
            } else {
              data[i] = r;
              data[i + 1] = g;
              data[i + 2] = b;
            }
          } else {
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
      const processedImg = new Image();
      processedImg.onload = () => resolve(processedImg);
      processedImg.src = canvas.toDataURL();
    };
    img.src = imgData.blob;
  });
};

/**
 * Group images into chunks based on pages per group
 * @param images Array of page images
 * @param pagesPerGroup Number of pages to include in each group
 * @returns Array of image groups
 */
export const groupImages = (images: PdfPageImage[], pagesPerGroup: number): PdfPageImage[][] => {
  if (pagesPerGroup <= 0) return [images];

  const groups: PdfPageImage[][] = [];
  for (let i = 0; i < images.length; i += pagesPerGroup) {
    groups.push(images.slice(i, i + pagesPerGroup));
  }

  return groups;
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
  stampConfig: StampConfig,
  pagesPerGroup: number = 1,
  processingConfig?: ProcessingConfig,
  orientation: PageOrientation = 'portrait',
  pageConfig?: PageConfig
): Promise<string> => {
  if (images.length === 0) return '';

  // If grouped layout (pagesPerGroup > 1), only process the first group for the single image preview
  // However, usually stitchImagesAndStamp is called for a specific set of images.
  // If we are here, 'images' should be the set we want to stitch.
  // So we don't need to slice unless we want to enforce a limit.
  // But wait, if pagesPerGroup > 1, we might be in "Grouped Mode" where we want to generate multiple images.
  // But stitchImagesAndStamp generates ONE image.
  // So if we are called with 10 images and pagesPerGroup=2, we should probably only stitch the first 2?
  // Or does the caller handle slicing?
  // The caller (PreviewArea) calls generateGroupedImages if it wants multiple images.
  // If it calls stitchImagesAndStamp, it expects one image.
  // Let's assume the caller passes the correct images.
  // BUT, for backward compatibility or safety, if pagesPerGroup is set and we are NOT in a grouped generation flow,
  // we might want to respect it.
  // Actually, let's simplify: stitchImagesAndStamp stitches ALL 'images' passed to it into ONE canvas.
  // It is the caller's responsibility to slice 'images' if they only want to stitch a subset.

  const processedImages = images;

  const maxWidth = Math.max(...processedImages.map(img => img.width));
  const maxHeight = Math.max(...processedImages.map(img => img.height));

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
    // GRID MODE (Square or A4 or A3)
    let targetRatio = 1.0;
    if (layoutMode === 'grid-a4') {
      targetRatio = orientation === 'portrait' ? 210 / 297 : 297 / 210;
    } else if (layoutMode === 'grid-a3') {
      targetRatio = orientation === 'portrait' ? 297 / 420 : 420 / 297;
    }

    // Calculate grid dimensions
    const count = processedImages.length;
    const gridConfig = calculateOptimalGrid(count, maxWidth + GUTTER_SIZE, maxHeight + GUTTER_SIZE, targetRatio);
    rows = gridConfig.rows;
    cols = gridConfig.cols;

    // Grid dimensions including gutters
    const gridPixelWidth = (cols * maxWidth) + ((cols - 1) * GUTTER_SIZE) + (OUTER_PADDING * 2);
    const gridPixelHeight = (rows * maxHeight) + ((rows - 1) * GUTTER_SIZE) + (OUTER_PADDING * 2);

    // Determine canvas size to match target aspect ratio
    if (layoutMode === 'grid-a4' || layoutMode === 'grid-a3') {
      // Fit the grid content into an A4/A3 container
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

  // Apply mobile Canvas size limits
  const safeSize = getMobileSafeCanvasSize(canvasWidth, canvasHeight);
  canvasWidth = safeSize.width;
  canvasHeight = safeSize.height;
  const canvasScale = safeSize.scale;

  // 2. Create the master canvas
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d', { alpha: false });

  if (!ctx) return '';

  // Fill white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 3. Draw images
  // Scale context if canvas was downsized for mobile
  if (canvasScale < 1) {
    ctx.scale(canvasScale, canvasScale);
  }

  if (layoutMode === 'vertical') {
    let currentY = 0;
    for (const imgData of processedImages) {
      const img = processingConfig
        ? await processImage(imgData, processingConfig)
        : await new Promise<HTMLImageElement>((resolve) => {
          const i = new Image();
          i.onload = () => resolve(i);
          i.src = imgData.blob;
        });

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

    for (let i = 0; i < processedImages.length; i++) {
      const imgData = processedImages[i];
      const img = processingConfig
        ? await processImage(imgData, processingConfig)
        : await new Promise<HTMLImageElement>((resolve) => {
          const i = new Image();
          i.onload = () => resolve(i);
          i.src = imgData.blob;
        });

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

  // Draw Header
  if (pageConfig?.headerText) {
    ctx.save();
    ctx.fillStyle = '#666666';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(pageConfig.headerText, canvasWidth / 2, 20);
    ctx.restore();
  }

  // Draw Footer
  if (pageConfig?.footerText) {
    ctx.save();
    ctx.fillStyle = '#666666';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(pageConfig.footerText, canvasWidth / 2, canvasHeight - 10);
    ctx.restore();
  }

  return canvas.toDataURL('image/jpeg', 0.9);
};

/**
 * Generate all grouped images with stamps
 * @param images Array of all page images
 * @param stampCanvas Stamp canvas element
 * @param stampConfig Stamp configuration
 * @param pagesPerGroup Number of pages per group
 * @returns Array of data URLs for each group
 */
export const generateGroupedImages = async (
  images: PdfPageImage[],
  stampCanvas: HTMLCanvasElement | null,
  stampConfig: StampConfig,
  pagesPerGroup: number = 1,
  processingConfig?: ProcessingConfig,
  layoutMode: LayoutMode = 'grid',
  orientation: PageOrientation = 'portrait',
  pageConfig?: PageConfig
): Promise<string[]> => {
  if (images.length === 0) return [];

  const groupedImages: string[] = [];

  // Process each group
  for (let i = 0; i < images.length; i += pagesPerGroup) {
    const group = images.slice(i, i + pagesPerGroup);
    const imageUrl = await stitchImagesAndStamp(group, stampCanvas, layoutMode, stampConfig, 1, processingConfig, orientation, pageConfig);
    groupedImages.push(imageUrl);
  }

  return groupedImages;
};
