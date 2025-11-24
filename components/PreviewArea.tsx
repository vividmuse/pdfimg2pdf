import React, { useEffect, useRef, useState } from 'react';
import { ProcessingStatus, PdfPageImage, StampConfig, LayoutMode, ProcessingConfig, PageOrientation, PageConfig } from '../types';
import { stitchImagesAndStamp, generateGroupedImages } from '../services/pdfService';
import { Download, Loader2, Printer, Eye, ZoomIn, ZoomOut } from 'lucide-react';
import { useTranslation } from '../src/i18n/LanguageContext';

interface PreviewAreaProps {
  pages: PdfPageImage[];
  stampConfig: StampConfig;
  isProcessing: boolean;
  layoutMode: LayoutMode;
  pagesPerGroup: number;
  showStampDesigner: boolean;
  processingConfig: ProcessingConfig;
  orientation: PageOrientation;
  pageConfig: PageConfig;
}

const PreviewArea: React.FC<PreviewAreaProps> = ({
  pages,
  stampConfig,
  layoutMode,
  pagesPerGroup,
  isProcessing,
  showStampDesigner,
  processingConfig,
  orientation,
  pageConfig
}) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isStitching, setIsStitching] = useState(false);

  // Helper to draw the stamp on a standalone canvas
  const createStampCanvas = (): HTMLCanvasElement => {
    const size = 300; // Resolution for stamp rendering
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    // Clear
    ctx.clearRect(0, 0, size, size);

    const { text, subText, color, shape, opacity } = stampConfig;

    // Apply opacity
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 8;

    const center = size / 2;
    const radius = size / 2 - 10;
    const boxSize = size - 20;

    // Draw Border
    ctx.beginPath();
    if (shape === 'circle') {
      ctx.arc(center, center, radius, 0, Math.PI * 2);
    } else {
      ctx.roundRect(10, 10, boxSize, boxSize, 20);
    }
    ctx.stroke();

    // Inner Border (thinner)
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (shape === 'circle') {
      ctx.arc(center, center, radius - 15, 0, Math.PI * 2);
    } else {
      ctx.strokeRect(25, 25, boxSize - 30, boxSize - 30);
    }
    ctx.stroke();

    // Text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Main Text
    ctx.font = 'bold 60px "Noto Serif SC", serif';
    // Basic text wrapping for square stamps
    if (shape === 'square' && text.length > 4) {
      // split into two lines
      const mid = Math.ceil(text.length / 2);
      const l1 = text.slice(0, mid);
      const l2 = text.slice(mid);
      ctx.fillText(l1, center, center - 20);
      ctx.fillText(l2, center, center + 40);
    } else {
      ctx.fillText(text, center, subText ? center - 15 : center);
    }

    // Sub Text
    if (subText) {
      ctx.font = '500 24px "Inter", sans-serif';
      ctx.fillText(subText, center, center + 65);
    }

    // Grunge effect (simple noise)
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() * 2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    return canvas;
  };

  // Re-generate the stitched image whenever pages, stamp config, layout mode, or pages per group changes
  useEffect(() => {
    if (pages.length === 0) return;

    const generate = async () => {
      setIsStitching(true);
      // Short delay to allow UI to update to loading state
      await new Promise(r => setTimeout(r, 50));

      // Only create stamp canvas if stamp designer is enabled
      const stampCanvas = showStampDesigner ? createStampCanvas() : null;

      if (pagesPerGroup > 0 && pagesPerGroup < pages.length) {
        // Generate all grouped images
        const urls = await generateGroupedImages(pages, stampCanvas, stampConfig, pagesPerGroup, processingConfig, layoutMode, orientation, pageConfig);
        setPreviewUrls(urls);
      } else {
        // Generate single image for other layouts
        const url = await stitchImagesAndStamp(pages, stampCanvas, layoutMode, stampConfig, 1, processingConfig, orientation, pageConfig);
        setPreviewUrls([url]);
      }

      setIsStitching(false);
    };

    generate();
  }, [pages, stampConfig, layoutMode, pagesPerGroup, showStampDesigner, processingConfig, orientation, pageConfig]);


  const handleDownload = (url?: string, index?: number) => {
    const downloadUrl = url || previewUrls[0];
    if (!downloadUrl) return;

    const link = document.createElement('a');
    if (layoutMode === 'grouped' && index !== undefined) {
      link.download = `stamped_document_group_${index + 1}_${Date.now()}.jpg`;
    } else {
      link.download = `stamped_document_${layoutMode}_${Date.now()}.jpg`;
    }
    link.href = downloadUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = () => {
    // Download all grouped images
    previewUrls.forEach((url, index) => {
      setTimeout(() => {
        handleDownload(url, index);
      }, index * 1000); // Add delay to prevent browser from blocking multiple downloads
    });
  };

  const handlePrint = (url?: string) => {
    const urlsToPrint = url ? [url] : previewUrls;
    // Generate HTML with properly styled images
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const imagesToPrint = url ? [url] : previewUrls;
    const imagesHtml = imagesToPrint
      .map((imgUrl, index) => `
        <div style="
          page-break-after: ${index < imagesToPrint.length - 1 ? 'always' : 'avoid'};
          page-break-inside: avoid;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 0;
          margin: 0;
        ">
          <img 
            src="${imgUrl}" 
            style="
              max-width: 100%;
              max-height: 100vh;
              object-fit: contain;
              display: block;
            "
          />
        </div>
      `)
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print</title>
          <style>
            @page {
              margin: 0;
              size: auto;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              margin: 0;
              padding: 0;
            }
            @media print {
              body { margin: 0; }
              img { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          ${imagesHtml}
        </body>
      </html>
    `);

    printWindow.document.close();

    // Wait for images to load before printing
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    };
  };

  if (isProcessing) {
    return (
      <div className="h-96 flex flex-col items-center justify-center bg-white rounded-xl border border-dashed border-slate-300">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <h3 className="text-lg font-semibold text-slate-900">{t('preview.processing')}</h3>
        <p className="text-slate-500 mt-2">{t('preview.processing.desc')}</p>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-[#fcf7f1] rounded-xl border border-dashed border-[#e0e0e0] text-[#9e9e9e]">
        <p>{t('preview.uploadPrompt')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden sticky top-6">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-50">
          <div className="flex items-center space-x-2">
            <Eye className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-slate-800">{t('preview.title')}</h2>
            <span className="bg-indigo-100 text-indigo-700 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {pages.length} {pages.length === 1 ? t('common.page') : t('common.pages')}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {previewUrls.length > 1 && (
              <button
                onClick={handleDownloadAll}
                disabled={isStitching}
                className="flex items-center justify-center space-x-2 bg-[#d97757] text-white px-4 py-2 rounded-lg hover:bg-[#da7756] transition-colors disabled:opacity-50 text-sm"
              >
                {isStitching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>{t('preview.downloadAll', { count: previewUrls.length })}</span>
              </button>
            )}
            <button
              onClick={() => handleDownload()}
              disabled={previewUrls.length === 0 || isStitching}
              className="flex items-center justify-center space-x-2 bg-[#383838] text-white px-4 py-2 rounded-lg hover:bg-[#6b6b6b] transition-colors disabled:opacity-50 text-sm"
            >
              {isStitching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{previewUrls.length > 1 ? t('preview.downloadFirst') : t('preview.downloadImage')}</span>
            </button>
            <button
              onClick={() => handlePrint()}
              disabled={previewUrls.length === 0 || isStitching}
              className="flex items-center justify-center space-x-2 bg-[#ffffff] text-[#383838] border border-[#e0e0e0] px-4 py-2 rounded-lg hover:bg-[#f5f5f5] transition-colors disabled:opacity-50 text-sm"
            >
              <Printer className="w-4 h-4" />
              <span>{t('common.print')}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="relative w-full bg-[#fcf7f1] rounded-xl overflow-hidden min-h-[500px] border border-[#e0e0e0] shadow-inner flex flex-col items-center justify-start p-4 sm:p-8 overflow-y-auto max-h-[80vh]">
        {isStitching && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="bg-[#ffffff] p-4 rounded-xl shadow-xl flex items-center space-x-3">
              <Loader2 className="w-6 h-6 text-[#d97757] animate-spin" />
              <span className="font-medium text-[#383838]">{t('preview.applyingStamp')}</span>
            </div>
          </div>
        )}
        {previewUrls.length > 1 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            {previewUrls.map((url, index) => (
              <div key={index} className="flex flex-col items-center">
                <div className="w-full bg-white rounded-lg shadow-md overflow-hidden mb-2">
                  <img
                    src={url}
                    alt={`${t('common.group')} ${index + 1}`}
                    className="w-full h-auto object-contain"
                  />
                </div>
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm font-medium text-slate-700">{t('common.group')} {index + 1}</span>
                  <button
                    onClick={() => handleDownload(url, index)}
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded transition-colors"
                  >
                    {t('common.download')}
                  </button>
                  <button
                    onClick={() => handlePrint(url)}
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded transition-colors ml-2"
                  >
                    {t('common.print')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          previewUrls.length > 0 && (
            <div className="w-full h-full flex items-center justify-center">
              <img
                src={previewUrls[0]}
                alt={t('preview.altText')}
                className="shadow-2xl max-w-full max-h-[70vh] h-auto object-contain bg-white rounded-lg"
              />
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default PreviewArea;