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

// Helper to ensure OpenCV is loaded
const ensureOpenCVLoaded = async (): Promise<void> => {
  // Wait for cv to be available and ready (wasm init)
  const loader = (window as any).__loadOpenCV;
  if (loader) {
    try {
      await Promise.race([
        loader,
        new Promise((resolve) => setTimeout(resolve, 6000)) // timeout fallback
      ]);
    } catch (e) { /* ignore, fallback to readiness check */ }
  }
  if ((window as any).cv) {
    if ((window as any).cv.ready) {
      await (window as any).cv.ready;
      return;
    }
    return; // cv present without ready hook
  }

  return new Promise((resolve, reject) => {
    let count = 0;
    const check = setInterval(async () => {
      const cv = (window as any).cv;
      if (cv) {
        try {
          if (cv.ready) {
            await Promise.race([
              cv.ready,
              new Promise((resolve) => setTimeout(resolve, 3000))
            ]);
          }
          clearInterval(check);
          resolve();
          return;
        } catch (e) {
          // fall through to keep waiting
        }
      }
      count++;
      if (count > 80) { // Wait up to ~8s
        clearInterval(check);
        reject(new Error("OpenCV failed to load"));
      }
    }, 100);
  });
};

type CvPoint = { x: number; y: number };

const orderPointsClockwise = (points: CvPoint[]): CvPoint[] => {
  // TL: min(x + y), BR: max(x + y)
  // TR: min(y - x), BL: max(y - x)
  let tl = points[0];
  let br = points[0];
  let tr = points[0];
  let bl = points[0];

  let minSum = points[0].x + points[0].y;
  let maxSum = minSum;
  let minDiff = points[0].y - points[0].x;
  let maxDiff = minDiff;

  for (const p of points) {
    const sum = p.x + p.y;
    const diff = p.y - p.x;

    if (sum < minSum) {
      minSum = sum;
      tl = p;
    }
    if (sum > maxSum) {
      maxSum = sum;
      br = p;
    }
    if (diff < minDiff) {
      minDiff = diff;
      tr = p;
    }
    if (diff > maxDiff) {
      maxDiff = diff;
      bl = p;
    }
  }

  return [tl, tr, br, bl];
};

const warpWithPerspective = (cv: any, src: any, corners: CvPoint[]) => {
  const [tl, tr, br, bl] = orderPointsClockwise(corners);

  const widthA = Math.hypot(br.x - bl.x, br.y - bl.y);
  const widthB = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  const maxWidth = Math.max(widthA, widthB);

  const heightA = Math.hypot(tr.x - br.x, tr.y - br.y);
  const heightB = Math.hypot(tl.x - bl.x, tl.y - bl.y);
  const maxHeight = Math.max(heightA, heightB);

  const targetWidth = Math.max(1, Math.round(maxWidth));
  const targetHeight = Math.max(1, Math.round(maxHeight));

  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0, 0,
    targetWidth, 0,
    targetWidth, targetHeight,
    0, targetHeight
  ]);
  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    tl.x, tl.y,
    tr.x, tr.y,
    br.x, br.y,
    bl.x, bl.y
  ]);

  const warped = new cv.Mat();
  const M = cv.getPerspectiveTransform(srcTri, dstTri);
  cv.warpPerspective(src, warped, M, new cv.Size(targetWidth, targetHeight), cv.INTER_CUBIC, cv.BORDER_REPLICATE);

  srcTri.delete(); dstTri.delete(); M.delete();
  return warped;
};

const detectDominantAngle = (cv: any, bin: any): number => {
  const edges = new cv.Mat();
  cv.Canny(bin, edges, 50, 150);
  const lines = new cv.Mat();
  cv.HoughLines(edges, lines, 1, Math.PI / 180, Math.max(bin.rows, bin.cols) * 0.08);

  let angleSum = 0;
  let count = 0;
  for (let i = 0; i < lines.rows; i++) {
    const theta = lines.data32F[i * 2 + 1];
    const deg = (theta * 180) / Math.PI;
    if (deg > 70 && deg < 110) {
      angleSum += deg - 90;
      count++;
    }
  }

  edges.delete(); lines.delete();

  if (count === 0) return 0;
  const avg = angleSum / count;
  return Math.max(-10, Math.min(10, avg));
};

const cropToDominantPage = (cv: any, src: any): any | null => {
  // Heuristic: if image is wider than tall, try to locate a central seam and keep the larger side.
  const width = src.cols;
  const height = src.rows;
  if (width < height * 0.95) return null;

  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  const blurred = new cv.Mat();
  cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

  // Column-wise average intensity
  const colMean = new cv.Mat();
  cv.reduce(blurred, colMean, 0, cv.REDUCE_AVG, cv.CV_32F); // 1 x width
  const colData = colMean.data32F;

  const searchStart = Math.floor(width * 0.15);
  const searchEnd = Math.floor(width * 0.85);
  let minVal = Infinity;
  let minIdx = -1;
  let sum = 0;
  let count = 0;

  for (let x = searchStart; x < searchEnd; x++) {
    const v = colData[x];
    sum += v;
    count++;
    if (v < minVal) {
      minVal = v;
      minIdx = x;
    }
  }

  const meanVal = count > 0 ? sum / count : 0;

  gray.delete(); blurred.delete(); colMean.delete();

  if (minIdx === -1) return null;

  const leftWidth = minIdx;
  const rightWidth = width - minIdx;

  // Allow a lighter seam by default; fall back to forced split if still wide
  const valleyDeepEnough = meanVal === 0 ? false : (minVal <= meanVal * 0.99);
  const widthWideEnough = width > height * 1.1; // strong hint of two pages

  if (!valleyDeepEnough && !widthWideEnough) return null;

  const keepRight = rightWidth >= leftWidth;
  const keptWidth = keepRight ? rightWidth : leftWidth;
  if (keptWidth < width * 0.3) return null; // kept side too small

  const gutter = 8;
  let roi: any;
  if (keepRight) {
    const x = Math.min(width - 1, minIdx + gutter);
    roi = new cv.Rect(x, 0, width - x, height);
  } else {
    const x = Math.max(0, minIdx - gutter);
    roi = new cv.Rect(0, 0, Math.max(1, x), height);
  }

  const cropped = src.roi(roi).clone();
  return cropped;
};

const curveFlatten = (cv: any, src: any): any => {
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  const blur = new cv.Mat();
  cv.GaussianBlur(gray, blur, new cv.Size(3, 3), 0);
  const bin = new cv.Mat();
  cv.adaptiveThreshold(blur, bin, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, 21, 10);
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
  cv.morphologyEx(bin, bin, cv.MORPH_CLOSE, kernel);
  cv.dilate(bin, bin, kernel);

  const width = src.cols;
  const height = src.rows;
  const top: number[] = new Array(width).fill(-1);
  const bottom: number[] = new Array(width).fill(-1);

  // Scan per column
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      if (bin.ucharPtr(y, x)[0] > 0) { top[x] = y; break; }
    }
    for (let y = height - 1; y >= 0; y--) {
      if (bin.ucharPtr(y, x)[0] > 0) { bottom[x] = y; break; }
    }
  }

  // Fill missing by nearest
  let lastTop = -1, lastBottom = -1;
  for (let x = 0; x < width; x++) {
    if (top[x] === -1) top[x] = lastTop;
    else lastTop = top[x];
    if (bottom[x] === -1) bottom[x] = lastBottom;
    else lastBottom = bottom[x];
  }
  for (let x = width - 1; x >= 0; x--) {
    if (top[x] === -1) top[x] = lastTop;
    else lastTop = top[x];
    if (bottom[x] === -1) bottom[x] = lastBottom;
    else lastBottom = bottom[x];
  }

  // Smooth profiles (windowed average)
  const smooth = (arr: number[], win: number) => {
    const out = new Array(arr.length).fill(0);
    const half = Math.floor(win / 2);
    for (let i = 0; i < arr.length; i++) {
      let s = 0, c = 0;
      for (let j = -half; j <= half; j++) {
        const idx = i + j;
        if (idx >= 0 && idx < arr.length) {
          s += arr[idx]; c++;
        }
      }
      out[i] = c ? s / c : arr[i];
    }
    return out;
  };
  const topSm = smooth(top, 25);
  const bottomSm = smooth(bottom, 25);

  // Decide if curvature is significant
  const range = (arr: number[]) => Math.max(...arr) - Math.min(...arr);
  const topRange = range(topSm);
  const bottomRange = range(bottomSm);
  const heightMedian = (() => {
    const spans = bottomSm.map((b, i) => b - topSm[i]);
    const sorted = spans.slice().sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  })();

  gray.delete(); blur.delete(); bin.delete(); kernel.delete();

  if (heightMedian <= 0) return src.clone();
  if (topRange < 6 && bottomRange < 6) return src.clone();

  const dstHeight = Math.max(20, Math.round(heightMedian));
  const mapX = new cv.Mat(dstHeight, width, cv.CV_32FC1);
  const mapY = new cv.Mat(dstHeight, width, cv.CV_32FC1);

  for (let y = 0; y < dstHeight; y++) {
    const rel = y / dstHeight;
    for (let x = 0; x < width; x++) {
      const ySrc = topSm[x] + rel * (bottomSm[x] - topSm[x]);
      mapX.floatPtr(y, x)[0] = x;
      mapY.floatPtr(y, x)[0] = ySrc;
    }
  }

  const dst = new cv.Mat();
  cv.remap(src, dst, mapX, mapY, cv.INTER_CUBIC, cv.BORDER_REPLICATE, new cv.Scalar());
  mapX.delete(); mapY.delete();
  return dst;
};

const autoDeskewAndCrop = (cv: any, src: any): any => {
  // Add a replicated border to avoid losing edges during processing
  let padded = new cv.Mat();
  cv.copyMakeBorder(src, padded, 8, 8, 8, 8, cv.BORDER_REPLICATE);

  // Pre-crop to dominant page if it's a two-page photo
  const dominant = cropToDominantPage(cv, padded);
  if (dominant) {
    padded.delete();
    padded = dominant;
  }

  // Downscale for robust contour detection while keeping ratio
  const maxDetect = 1200;
  const maxDim = Math.max(padded.cols, padded.rows);
  const scale = maxDim > maxDetect ? maxDetect / maxDim : 1;
  let detectMat: any = new cv.Mat();
  if (scale < 1) {
    cv.resize(padded, detectMat, new cv.Size(0, 0), scale, scale, cv.INTER_AREA);
  } else {
    detectMat = padded.clone();
  }

  const gray = new cv.Mat();
  cv.cvtColor(detectMat, gray, cv.COLOR_RGBA2GRAY);

  const blurred = new cv.Mat();
  cv.GaussianBlur(gray, blurred, new cv.Size(3, 3), 0);

  // Combine Canny edges with adaptive threshold to get solid page contours
  const edges = new cv.Mat();
  cv.Canny(blurred, edges, 50, 150);

  const adaptiveMask = new cv.Mat();
  cv.adaptiveThreshold(blurred, adaptiveMask, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, 41, 15);

  const edgeMask = new cv.Mat();
  cv.bitwise_or(edges, adaptiveMask, edgeMask);

  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(9, 9));
  cv.morphologyEx(edgeMask, edgeMask, cv.MORPH_CLOSE, kernel);
  cv.dilate(edgeMask, edgeMask, kernel);

  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(edgeMask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  const totalArea = detectMat.cols * detectMat.rows;
  let bestIdx = -1;
  let bestArea = 0;
  let bestScore = -Infinity;

  // Prefer a single, tall page located on the right half (to drop the left page)
  const centerTarget = detectMat.cols * 0.65;
  const centerWidth = detectMat.cols;

  for (let i = 0; i < contours.size(); i++) {
    const cnt = contours.get(i);
    const area = cv.contourArea(cnt);
    const areaRatio = area / totalArea;

    if (areaRatio < 0.15) { cnt.delete(); continue; }

    const rect = cv.minAreaRect(cnt);
    const w = rect.size.width;
    const h = rect.size.height;
    const aspect = h > 0 && w > 0 ? Math.max(h, w) / Math.min(h, w) : 1;
    const portraitBonus = aspect > 1 ? Math.min(aspect, 2.5) / 2.5 : 0.0; // prefer tall pages

    const centerX = rect.center.x;
    const rightBias = centerX > centerTarget ? 1 : (centerX < centerWidth * 0.45 ? -0.5 : 0);

    // Score: base area + portrait bias + right-page bias
    const score = areaRatio * 1.0 + portraitBonus * 0.3 + rightBias * 0.2;

    if (score > bestScore) {
      bestScore = score;
      bestArea = area;
      bestIdx = i;
    }

    cnt.delete();
  }

  let bestContour = bestIdx !== -1 ? contours.get(bestIdx) : null;

  // Cleanup intermediate mats no longer needed
  contours.delete(); hierarchy.delete();
  edgeMask.delete(); edges.delete(); adaptiveMask.delete();
  kernel.delete(); blurred.delete(); gray.delete();

  if (!bestContour || bestArea < totalArea * 0.3) {
    detectMat.delete();
    padded.delete();
    return src.clone();
  }

  let warped: any = null;

  try {
    const rect = cv.minAreaRect(bestContour);
    const box = cv.RotatedRect.points(rect);
    const corners: CvPoint[] = [];
    for (let i = 0; i < box.length; i++) {
      corners.push({
        x: box[i].x / scale,
        y: box[i].y / scale
      });
    }

    // Disallow extremely thin rectangles which usually mean we grabbed an inner table
    const ratio = rect.size.width > 0 && rect.size.height > 0 ? Math.max(rect.size.width, rect.size.height) / Math.min(rect.size.width, rect.size.height) : 1;
    const areaRatio = (rect.size.width * rect.size.height) / totalArea;

    // Require decent coverage and portrait-ish shape to avoid warping a narrow inner table
    if (areaRatio > 0.35 && ratio > 1.05 && ratio < 2.8) {
      // Pre-deskew global angle before perspective
      const tmpGray = new cv.Mat();
      cv.cvtColor(padded, tmpGray, cv.COLOR_RGBA2GRAY);
      const tmpBin = new cv.Mat();
      cv.threshold(tmpGray, tmpBin, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
      const angle = detectDominantAngle(cv, tmpBin);
      let deskewed = padded.clone();
      let transformedCorners = corners;
      if (Math.abs(angle) > 0.3) {
        const center = new cv.Point(padded.cols / 2, padded.rows / 2);
        const Mrot = cv.getRotationMatrix2D(center, angle, 1);
        cv.warpAffine(padded, deskewed, Mrot, new cv.Size(padded.cols, padded.rows), cv.INTER_CUBIC, cv.BORDER_REPLICATE);

        // Rotate corner points accordingly
        transformedCorners = corners.map(pt => {
          const x = pt.x - center.x;
          const y = pt.y - center.y;
          const rad = angle * Math.PI / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const rx = x * cos - y * sin + center.x;
          const ry = x * sin + y * cos + center.y;
          return { x: rx, y: ry };
        });
        Mrot.delete();
      }
      tmpGray.delete(); tmpBin.delete();

      warped = warpWithPerspective(cv, deskewed, transformedCorners);
      deskewed.delete();
    }
  } catch (e) {
    console.error("Perspective crop failed", e);
  }

  if (!warped) {
    // Fallback: return original with only border added (no warp) to avoid distortion
    warped = padded.clone();
  }

  // Final curve flattening pass for bottom warped text
  const flattened = curveFlatten(cv, warped);

  bestContour.delete();
  detectMat.delete();
  padded.delete();

  warped.delete();
  return flattened;
};

  const processImage = async (
  imgData: PdfPageImage,
  config: ProcessingConfig
): Promise<HTMLImageElement> => {
  return new Promise(async (resolve) => {
    const img = new Image();
    img.onload = async () => {
      // If no processing needed
      if (config.threshold === 0 && config.brightness === 0 && config.contrast === 0 && !config.targetColor && !config.autoDewarp && !config.useAdaptiveThreshold && !config.strongBinarize) {
        resolve(img);
        return;
      }

      // Check if we need OpenCV
      const needsOpenCV = config.autoDewarp || config.useAdaptiveThreshold || config.strongBinarize;

          if (needsOpenCV) {
            try {
              await ensureOpenCVLoaded();
              const cv = (window as any).cv;
              if (!cv) throw new Error("OpenCV not available");

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
              const dewarped = autoDeskewAndCrop(cv, src);
              src.delete();
              src = dewarped;
            } catch (e) {
              console.error("Auto Dewarp failed", e);
            }
          }

          // 2. Strong B/W Scan (forceful binarization for gray paper)
          if (config.strongBinarize) {
            let gray = new cv.Mat();
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

            let bg = new cv.Mat();
            cv.medianBlur(gray, bg, 21); // smooth background estimation

            let normalized = new cv.Mat();
            cv.divide(gray, bg, normalized, 255, -1);

            let clahe = new cv.Mat();
            const claheObj = cv.createCLAHE(2.0, new cv.Size(8, 8));
            claheObj.apply(normalized, clahe);

            let bin = new cv.Mat();
            cv.adaptiveThreshold(clahe, bin, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 35, 5);

            // Optional: small morphology to clean dots
            let k = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
            cv.morphologyEx(bin, bin, cv.MORPH_OPEN, k);
            k.delete();

            cv.cvtColor(bin, src, cv.COLOR_GRAY2RGBA);

            // Cleanup
            gray.delete(); bg.delete(); normalized.delete(); clahe.delete(); bin.delete(); claheObj.delete();

            // Output immediately to avoid further processing
            cv.imshow(canvas, src);
            src.delete(); dst.delete();
            const processedImg = new Image();
            processedImg.onload = () => resolve(processedImg);
            processedImg.src = canvas.toDataURL();
            return;
          }

          // 3. Advanced Whitening (Color Preserving)
          if (config.useAdaptiveThreshold) {
            // Convert to RGB (drop alpha for processing)
            let rgb = new cv.Mat();
            cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);

            // Split channels
            let planes = new cv.MatVector();
            cv.split(rgb, planes);

            let resultPlanes = new cv.MatVector();

            // Kernel size for morphological operations
            // Needs to be large enough to cover text but smaller than page features
            // 30-50 is usually good for document images
            let kSize = new cv.Size(30, 30);
            let kernel = cv.getStructuringElement(cv.MORPH_RECT, kSize);

            for (let i = 0; i < planes.size(); ++i) {
              let channel = planes.get(i);
              let background = new cv.Mat();

              // Estimate background using Morphological Closing (Dilation -> Erosion)
              // This fills in the dark text with the surrounding bright background color
              cv.morphologyEx(channel, background, cv.MORPH_CLOSE, kernel);

              // Division Normalization: (Image / Background) * 255
              // This flattens the illumination
              let result = new cv.Mat();
              cv.divide(channel, background, result, 255, -1);

              // --- ENHANCEMENT: Levels Adjustment (Histogram Stretching) ---
              // We want to force light grays to pure white and darken text slightly.
              // Input range: [0, 255] -> Output range: [0, 255]
              // But we map [blackPoint, whitePoint] -> [0, 255]

              // Agressive whitening: Clip anything above 210 to 255 (Was 230)
              // Contrast boost: Clip anything below 30 to 0 (Was 20)

              const whitePoint = 210; // Aggressive White
              const blackPoint = 30;  // Aggressive Black

              const alpha = 255.0 / (whitePoint - blackPoint);
              const beta = -blackPoint * alpha;

              result.convertTo(result, -1, alpha, beta);

              resultPlanes.push_back(result);

              channel.delete();
              background.delete();
            }

            // Merge back
            cv.merge(resultPlanes, rgb);

            // Convert back to RGBA
            cv.cvtColor(rgb, dst, cv.COLOR_RGB2RGBA);

            // Cleanup
            src.delete();
            src = dst.clone();

            rgb.delete();
            planes.delete();
            resultPlanes.delete();
            kernel.delete();
          }

          // 4. Apply Brightness/Contrast if still needed (on top of OpenCV result)
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
