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

// Helper to ensure OpenCV is loaded
const ensureOpenCVLoaded = async (): Promise<void> => {
  if ((window as any).cv) return;

  // Wait for cv to be available (it's loaded async in index.html)
  return new Promise((resolve, reject) => {
    let count = 0;
    const check = setInterval(() => {
      if ((window as any).cv) {
        clearInterval(check);
        resolve();
      }
      count++;
      if (count > 100) { // Wait up to 10s
        clearInterval(check);
        reject(new Error("OpenCV failed to load"));
      }
    }, 100);
  });
};

const processImage = async (
  imgData: PdfPageImage,
  config: ProcessingConfig
): Promise<HTMLImageElement> => {
  return new Promise(async (resolve) => {
    const img = new Image();
    img.onload = async () => {
      // If no processing needed
      if (config.threshold === 0 && config.brightness === 0 && config.contrast === 0 && !config.targetColor && !config.autoDewarp && !config.useAdaptiveThreshold) {
        resolve(img);
        return;
      }

      // Check if we need OpenCV
      const needsOpenCV = config.autoDewarp || config.useAdaptiveThreshold;

      if (needsOpenCV) {
        try {
          await ensureOpenCVLoaded();
          const cv = (window as any).cv;

          // Create canvas to read image data
          const canvas = document.createElement('canvas');
          canvas.width = imgData.width;
          canvas.height = imgData.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(img); return; }
          ctx.drawImage(img, 0, 0);

          let src = cv.imread(canvas);
          let dst = new cv.Mat();

          // 1. Auto Dewarp / Flatten
          if (config.autoDewarp) {
            try {
              let gray = new cv.Mat();
              cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

              // Blur to remove noise
              let blurred = new cv.Mat();
              cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

              // Edge detection
              let edges = new cv.Mat();
              cv.Canny(blurred, edges, 75, 200);

              // Find contours
              let contours = new cv.MatVector();
              let hierarchy = new cv.Mat();
              cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

              // Find largest quadrilateral
              let maxArea = 0;
              let maxContour = null;
              let approx = new cv.Mat();

              for (let i = 0; i < contours.size(); ++i) {
                let cnt = contours.get(i);
                let area = cv.contourArea(cnt);
                if (area > 5000) { // Minimum area filter
                  let peri = cv.arcLength(cnt, true);
                  let tmp = new cv.Mat();
                  cv.approxPolyDP(cnt, tmp, 0.02 * peri, true);

                  if (tmp.rows === 4 && area > maxArea) {
                    maxArea = area;
                    if (maxContour) maxContour.delete();
                    maxContour = tmp.clone();
                  }
                  tmp.delete();
                }
              }

              if (maxContour) {
                // Order points: tl, tr, br, bl
                // We need to convert Mat to array of points
                const points = [];
                for (let i = 0; i < 4; i++) {
                  points.push({
                    x: maxContour.intPtr(i, 0)[0],
                    y: maxContour.intPtr(i, 0)[1]
                  });
                }

                // Sort points
                // Top-left has smallest sum, Bottom-right has largest sum
                // Top-right has smallest diff, Bottom-left has largest diff
                points.sort((a, b) => a.y - b.y); // Sort by Y first
                // Top 2 are top points, Bottom 2 are bottom points
                const topPoints = points.slice(0, 2).sort((a, b) => a.x - b.x);
                const bottomPoints = points.slice(2, 4).sort((a, b) => a.x - b.x);

                const tl = topPoints[0];
                const tr = topPoints[1];
                const bl = bottomPoints[0];
                const br = bottomPoints[1];

                // Calculate width and height of new image
                const widthA = Math.sqrt(Math.pow(br.x - bl.x, 2) + Math.pow(br.y - bl.y, 2));
                const widthB = Math.sqrt(Math.pow(tr.x - tl.x, 2) + Math.pow(tr.y - tl.y, 2));
                const maxWidth = Math.max(widthA, widthB);

                const heightA = Math.sqrt(Math.pow(tr.x - br.x, 2) + Math.pow(tr.y - br.y, 2));
                const heightB = Math.sqrt(Math.pow(tl.x - bl.x, 2) + Math.pow(tl.y - bl.y, 2));
                const maxHeight = Math.max(heightA, heightB);

                // Perspective transform
                let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]);
                let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, maxWidth, 0, maxWidth, maxHeight, 0, maxHeight]);

                let M = cv.getPerspectiveTransform(srcTri, dstTri);
                cv.warpPerspective(src, dst, M, new cv.Size(maxWidth, maxHeight));

                // Update src to point to the warped image for next steps
                src.delete();
                src = dst.clone(); // dst is now our source

                // Cleanup
                srcTri.delete(); dstTri.delete(); M.delete();
                gray.delete(); blurred.delete(); edges.delete();
                contours.delete(); hierarchy.delete(); approx.delete();
                if (maxContour) maxContour.delete();

              } else {
                // No contour found, cleanup
                gray.delete(); blurred.delete(); edges.delete();
                contours.delete(); hierarchy.delete(); approx.delete();
              }
            } catch (e) {
              console.error("Dewarp error", e);
            }
          }

          // 2. Advanced Whitening (Adaptive Threshold)
          if (config.useAdaptiveThreshold) {
            let gray = new cv.Mat();
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

            // Adaptive Threshold
            // ADAPTIVE_THRESH_GAUSSIAN_C is usually better for text
            // Block size 11, C = 2
            cv.adaptiveThreshold(gray, dst, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 21, 10);

            // Convert back to RGBA
            cv.cvtColor(dst, dst, cv.COLOR_GRAY2RGBA);

            src.delete();
            src = dst.clone();
            gray.delete();
          }

          // 3. Apply Brightness/Contrast if still needed (on top of OpenCV result)
          // Note: Standard threshold is ignored if Adaptive is on, or we could apply it?
          // Usually Adaptive Threshold results in binary image, so brightness/contrast might not do much unless we do it BEFORE.
          // But let's stick to the flow. If Adaptive is OFF, we might still want standard processing.

          // If we did NOT do adaptive threshold, we might still want to do standard processing using the Canvas API
          // because it's faster/easier for simple pixel manipulation than OpenCV loops in JS.
          // So let's write the OpenCV result back to canvas and then continue with standard processing if needed.

          cv.imshow(canvas, src);
          src.delete(); dst.delete();

          // Now 'canvas' has the OpenCV processed image.
          // If we need further standard processing (like color removal or standard brightness/contrast on non-binary image)
          // we can continue.

          // If Adaptive Threshold was used, the image is already B&W (255/0).
          // Brightness/Contrast/Color removal might not be needed or effective.
          if (config.useAdaptiveThreshold) {
            // We are done
            const processedImg = new Image();
            processedImg.onload = () => resolve(processedImg);
            processedImg.src = canvas.toDataURL();
            return;
          }

          // If only Dewarp was used, we still need to apply standard Brightness/Contrast/Threshold
          // So we fall through to the standard logic below, but using the updated canvas.
          const ctx2 = canvas.getContext('2d');
          if (!ctx2) { resolve(img); return; }
          // Get the data from the updated canvas
          const imageData = ctx2.getImageData(0, 0, canvas.width, canvas.height);
          // ... continue to standard logic
          processStandard(imageData, config, ctx2, resolve);
          return;

        } catch (e) {
          console.error("OpenCV processing failed", e);
          // Fallback to standard
        }
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
  const targetColor = config.targetColor;
  const colorTolerance = config.colorTolerance || 20;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    let isBackground = false;

    // 1. Check Color-based Background Removal (using ORIGINAL pixel values)
    if (targetColor) {
      const colorDistance = Math.sqrt(
        Math.pow(r - targetColor.r, 2) +
        Math.pow(g - targetColor.g, 2) +
        Math.pow(b - targetColor.b, 2)
      );
      // Normalize distance to 0-100 scale
      const normalizedDistance = (colorDistance / 441) * 100;

      if (normalizedDistance < colorTolerance) {
        isBackground = true;
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
    if (rawContentWidth > availableWidth || rawContentHeight > availableHeight) {
      const scaleX = availableWidth / rawContentWidth;
      const scaleY = availableHeight / rawContentHeight;
      contentScale = Math.min(scaleX, scaleY, 1); // Never scale up, only down
    }

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

      // Scaled dimensions
      const scaledImgWidth = imgData.width * contentScale;
      const scaledImgHeight = imgData.height * contentScale;

      // Top-left coordinate for this cell slot
      const cellX = startX + colIndex * (scaledMaxWidth + scaledGutter);
      const cellY = startY + rowIndex * (scaledMaxHeight + scaledGutter);

      // Center the image within its specific slot
      const imgX = cellX + (scaledMaxWidth - scaledImgWidth) / 2;
      const imgY = cellY + (scaledMaxHeight - scaledImgHeight) / 2;

      // -- Comic Strip Styling --

      // 1. Drop Shadow
      ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
      ctx.shadowBlur = 15;
      ctx.shadowOffsetX = 5;
      ctx.shadowOffsetY = 5;

      // 2. Draw Image with scaled dimensions
      ctx.drawImage(img, imgX, imgY, scaledImgWidth, scaledImgHeight);

      // Reset Shadow for subsequent strokes
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // 3. Border (Black outline)
      ctx.strokeStyle = "#1e293b"; // Slate-800
      ctx.lineWidth = 3 * contentScale; // Scale border with content
      ctx.strokeRect(imgX, imgY, scaledImgWidth, scaledImgHeight);

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
