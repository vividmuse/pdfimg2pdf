import { PdfPageImage, LayoutMode, ProcessingConfig, PageOrientation } from '../types';

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

export const convertPdfToImages = async (file: File, mode: 'render' | 'extract' = 'render', targetWidth?: number): Promise<PdfPageImage[]> => {
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
      // Dynamic Scaling Calculation (Matched to Reference)
      const baseViewport = page.getViewport({ scale: 1.0 });
      const pageArea = baseViewport.width * baseViewport.height;
      const a4Area = 595 * 842; // A4 area

      let scale = 2.0;

      if (targetWidth) {
        const widthScale = targetWidth / baseViewport.width;
        // If page is large (like A4), use higher quality scale
        if (pageArea > a4Area * 0.8) {
          scale = widthScale * 2.5;
        } else {
          scale = widthScale;
        }
      } else {
        // Default high quality
        scale = Math.min(5.0, 3000 / baseViewport.width);
        if (scale < 2.0) scale = 2.0;
      }

      // Cap at 5.0 to prevent crash
      scale = Math.min(scale, 5.0);

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
  return new Promise(async (resolve) => {
    const img = new Image();
    img.onload = async () => {
      // If no processing needed
      if (config.threshold === 0 && config.brightness === 0 && config.contrast === 0 && !config.targetColors && !config.strongBinarize && !config.documentEnhance) {
        resolve(img);
        return;
      }

      // Standard Processing (Canvas API)
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
      processStandard(imageData, config, ctx, resolve);
    };
    img.src = imgData.blob;
  });
};

const processStandard = (imageData: ImageData, config: ProcessingConfig, ctx: CanvasRenderingContext2D, resolve: (img: HTMLImageElement) => void) => {
  const data = imageData.data;
  const threshold = config.threshold;
  const brightness = config.brightness;
  const contrast = config.contrast;
  const targetColors = config.targetColors; // Changed from targetColor to targetColors
  const colorTolerance = config.colorTolerance || 20;

  // Fallback strong binarize when OpenCV is unavailable
  if (config.strongBinarize) {
    let sum = 0, sumSq = 0, count = 0, min = 255, max = 0;
    const grayVals = new Array(data.length / 4);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      grayVals[j] = g;
      sum += g; sumSq += g * g; count++;
      if (g < min) min = g;
      if (g > max) max = g;
    }
    const mean = sum / count;
    const variance = sumSq / count - mean * mean;
    const std = Math.sqrt(Math.max(variance, 0));
    const thr = Math.min(max, Math.max(min, mean - 0.25 * std));
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const v = grayVals[j] > thr ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = v;
    }
    ctx.putImageData(imageData, 0, 0);
    const processedImg = new Image();
    processedImg.onload = () => resolve(processedImg);
    processedImg.src = ctx.canvas.toDataURL();
    return;
  }

  // Document Enhancement - Make text clearer and background whiter
  if (config.documentEnhance) {
    // Step 1: Calculate global statistics for adaptive processing
    let sumR = 0, sumG = 0, sumB = 0, count = 0;
    const grayscale = new Array(data.length / 4);

    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      grayscale[j] = gray;
      sumR += r;
      sumG += g;
      sumB += b;
      count++;
    }

    const avgR = sumR / count;
    const avgG = sumG / count;
    const avgB = sumB / count;
    const avgGray = 0.299 * avgR + 0.587 * avgG + 0.114 * avgB;

    // Step 2: Determine adaptive threshold
    // Use a threshold slightly below average to separate text from background
    const adaptiveThreshold = avgGray * 0.75;

    // Step 3: Apply enhancement
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const gray = grayscale[j];

      if (gray > adaptiveThreshold) {
        // Likely background - make it whiter
        // Apply aggressive whitening for light pixels
        const whitenFactor = (gray - adaptiveThreshold) / (255 - adaptiveThreshold);
        const enhanced = 255 - (255 - gray) * (1 - whitenFactor * 0.8);
        data[i] = data[i + 1] = data[i + 2] = Math.min(255, enhanced);
      } else {
        // Likely text - make it clearer (darker and higher contrast)
        // Apply contrast enhancement for dark pixels
        const darkenFactor = 1 - (gray / adaptiveThreshold);
        const enhanced = gray * (1 - darkenFactor * 0.4);
        data[i] = data[i + 1] = data[i + 2] = Math.max(0, enhanced);
      }
    }

    // Don't return here - continue with other processing options
    // This allows document enhancement to be combined with brightness, contrast, etc.
  }

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    let isBackground = false;

    // 1. Check Color-based Background Removal (using ORIGINAL pixel values)
    // Check against all target colors
    if (targetColors && targetColors.length > 0) {
      for (const targetColor of targetColors) {
        const colorDistance = Math.sqrt(
          Math.pow(r - targetColor.r, 2) +
          Math.pow(g - targetColor.g, 2) +
          Math.pow(b - targetColor.b, 2)
        );
        // Normalize distance to 0-100 scale
        const normalizedDistance = (colorDistance / 441) * 100;

        if (normalizedDistance < colorTolerance) {
          isBackground = true;
          break; // Found a matching color, no need to check others
        }
      }
    }

    if (isBackground) {
      // Set to white
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
    } else {
      // Foreground processing
      let newR = r;
      let newG = g;
      let newB = b;

      // 2. Apply Brightness
      if (brightness !== 0) {
        newR = Math.max(0, Math.min(255, newR + brightness * 2.55));
        newG = Math.max(0, Math.min(255, newG + brightness * 2.55));
        newB = Math.max(0, Math.min(255, newB + brightness * 2.55));
      }

      // 3. Apply Contrast
      if (contrast !== 0) {
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
        newR = Math.max(0, Math.min(255, factor * (newR - 128) + 128));
        newG = Math.max(0, Math.min(255, factor * (newG - 128) + 128));
        newB = Math.max(0, Math.min(255, factor * (newB - 128) + 128));
      }

      // 4. Apply Threshold (Grayscale logic)
      // We apply this even if targetColor was used, to clean up the remaining foreground
      if (threshold > 0) {
        // Invert threshold: input is "strength" (0-255), so actual threshold is 255 - strength
        // Strength 0 -> Threshold 255 (Safe)
        // Strength 50 -> Threshold 205 (Removes light gray)
        const actualThreshold = 255 - threshold;

        const gray = 0.299 * newR + 0.587 * newG + 0.114 * newB;
        if (gray > actualThreshold) {
          // This pixel is light enough to be background
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
        } else {
          // Keep the processed color (or could force to black if desired, but keeping color is safer)
          data[i] = newR;
          data[i + 1] = newG;
          data[i + 2] = newB;
        }
      } else {
        // No threshold, just save the B/C adjusted values
        data[i] = newR;
        data[i + 1] = newG;
        data[i + 2] = newB;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  const processedImg = new Image();
  processedImg.onload = () => resolve(processedImg);
  processedImg.src = ctx.canvas.toDataURL();
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
  layoutMode: LayoutMode = 'vertical',
  pagesPerGroup: number = 1,
  processingConfig?: ProcessingConfig,
  orientation: PageOrientation = 'portrait'
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
  // 更紧凑的 grouped 布局：初始留白即较小，并随页数自动收紧
  const itemCount = processedImages.length;
  const baseGutter = isGrid ? 16 : 0;
  const baseOuter = isGrid ? 8 : 0;
  const shrink = Math.min(itemCount * 1.8, 12); // 页数多时逐步缩小留白
  const GUTTER_SIZE = isGrid ? Math.max(4, baseGutter - shrink) : 0;
  const OUTER_PADDING = isGrid ? Math.max(4, baseOuter - Math.floor(shrink / 2)) : 0;

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

      const xOffset = (canvasWidth / canvasScale - imgData.width) / 2;
      ctx.drawImage(img, xOffset, currentY, imgData.width, imgData.height);
      currentY += imgData.height;
    }
  } else {
    // GRID MODE (Comic Strip Effect)

    // Calculate total size of the grid content block (before any scaling)
    const rawContentWidth = (cols * maxWidth) + ((cols - 1) * GUTTER_SIZE);
    const rawContentHeight = (rows * maxHeight) + ((rows - 1) * GUTTER_SIZE);

    // Auto-scale if content exceeds canvas (happens when many pages)
    const availableWidth = (canvasWidth / canvasScale) - (OUTER_PADDING * 2);
    const availableHeight = (canvasHeight / canvasScale) - (OUTER_PADDING * 2);

    let contentScale = 1;
    const scaleX = availableWidth / rawContentWidth;
    const scaleY = availableHeight / rawContentHeight;
    // 允许放大填充空白（最多放大到1.15），避免多图拼接时留大片空隙
    const maxUpScale = 1.15;
    contentScale = Math.min(scaleX, scaleY, maxUpScale);
    if (contentScale > maxUpScale) contentScale = maxUpScale;

    // Apply content scale
    const scaledMaxWidth = maxWidth * contentScale;
    const scaledMaxHeight = maxHeight * contentScale;
    const scaledGutter = GUTTER_SIZE * contentScale;

    const totalContentWidth = (cols * scaledMaxWidth) + ((cols - 1) * scaledGutter);
    const totalContentHeight = (rows * scaledMaxHeight) + ((rows - 1) * scaledGutter);

    // Center the whole grid block in the canvas (accounting for canvas scale)
    const startX = ((canvasWidth / canvasScale) - totalContentWidth) / 2;
    const startY = ((canvasHeight / canvasScale) - totalContentHeight) / 2;

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

      // 格子的可用空间
      const cellWidth = scaledMaxWidth;
      const cellHeight = scaledMaxHeight;

      // 计算图片在格子内的最大化尺寸（保持宽高比）
      const imgAspectRatio = imgData.width / imgData.height;
      const cellAspectRatio = cellWidth / cellHeight;

      let drawWidth, drawHeight;
      if (imgAspectRatio > cellAspectRatio) {
        // 图片更宽，以宽度为准
        drawWidth = cellWidth;
        drawHeight = cellWidth / imgAspectRatio;
      } else {
        // 图片更高，以高度为准
        drawHeight = cellHeight;
        drawWidth = cellHeight * imgAspectRatio;
      }

      // Top-left coordinate for this cell slot
      const cellX = startX + colIndex * (scaledMaxWidth + scaledGutter);
      const cellY = startY + rowIndex * (scaledMaxHeight + scaledGutter);

      // Center the image within its cell
      const imgX = cellX + (cellWidth - drawWidth) / 2;
      const imgY = cellY + (cellHeight - drawHeight) / 2;

      // -- Comic Strip Styling --

      // 1. Drop Shadow
      ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
      ctx.shadowBlur = 15;
      ctx.shadowOffsetX = 5;
      ctx.shadowOffsetY = 5;

      // 2. Draw Image with scaled dimensions
      ctx.drawImage(img, imgX, imgY, drawWidth, drawHeight);

      // Reset Shadow for subsequent strokes
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // 3. Border (Black outline)
      ctx.strokeStyle = "#1e293b"; // Slate-800
      ctx.lineWidth = 3 * contentScale; // Scale border with content
      ctx.strokeRect(imgX, imgY, drawWidth, drawHeight);

      // 4. Page Number Badge (Comic order)
      const badgeSize = 40;
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
  layoutMode: LayoutMode,
  pagesPerGroup: number,
  processingConfig?: ProcessingConfig,
  orientation: PageOrientation = 'portrait'
): Promise<string[]> => {
  const groups: PdfPageImage[][] = [];
  for (let i = 0; i < images.length; i += pagesPerGroup) {
    groups.push(images.slice(i, i + pagesPerGroup));
  }

  const results: string[] = [];
  for (const group of groups) {
    const url = await stitchImagesAndStamp(
      group,
      layoutMode,
      pagesPerGroup,
      processingConfig,
      orientation
    );
    results.push(url);
  }

  return results;
};

/**
 * Rotate an image URL by 90 degrees clockwise
 * Used for correcting landscape A4/A3 images before uploading to scan service
 * (because scan service defaults to portrait PDF)
 */
export const rotateImageURL = async (imageUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Swap width and height for 90 degree rotation
      canvas.width = img.height;
      canvas.height = img.width;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Rotate context
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(90 * Math.PI / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
};
