import React, { useEffect, useRef, useState } from 'react';
import { ProcessingStatus, PdfPageImage, LayoutMode, ProcessingConfig, PageOrientation } from '../types';
import { stitchImagesAndStamp, generateGroupedImages } from '../services/pdfService';
import { Download, Loader2, Printer, Eye, ZoomIn, ZoomOut } from 'lucide-react';
import { useTranslation } from '../src/i18n/LanguageContext';

interface PreviewAreaProps {
  pages: PdfPageImage[];
  isProcessing: boolean;
  layoutMode: LayoutMode;
  pagesPerGroup: number;
  processingConfig: ProcessingConfig;
  orientation: PageOrientation;
  onPreviewGenerated?: (blobs: Blob[]) => void;  // 预览用（可能压缩）
  onUploadBlobsGenerated?: (blobs: Blob[]) => void;  // 上传用（高质量）
}

const PreviewArea: React.FC<PreviewAreaProps> = ({
  pages,
  layoutMode,
  pagesPerGroup,
  isProcessing,
  processingConfig,
  orientation,
  onPreviewGenerated,
  onUploadBlobsGenerated  // 新增
}) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isStitching, setIsStitching] = useState(false);

  // Generate preview image
  useEffect(() => {
    const generatePreview = async () => {
      if (pages.length === 0) {
        setPreviewUrls([]);
        onPreviewGenerated?.([]);
        onUploadBlobsGenerated?.([]);
        return;
      }

      setIsStitching(true);
      try {
        let urls: string[] = [];
        // If grouped layout, generate all group images
        if (pagesPerGroup > 1) {
          urls = await generateGroupedImages(
            pages,
            layoutMode,
            pagesPerGroup,
            processingConfig,
            orientation
          );
        } else {
          // Single page or vertical layout - generate one long image or single images
          // For vertical layout, we stitch everything into one image
          // For grid layout with pagesPerGroup=1, we also stitch everything into one image?
          // Wait, if pagesPerGroup=1, it means "1 page per group" -> which means we should generate N images?
          // But here we are calling stitchImagesAndStamp which returns ONE image.

          // Let's stick to the previous behavior:
          // If pagesPerGroup > 1, we use generateGroupedImages.
          // If pagesPerGroup === 1, we use stitchImagesAndStamp to make ONE image of ALL pages?
          // OR does pagesPerGroup=1 mean "Keep pages separate"?
          // In the UI, "Group Images" usually implies merging.
          // If pagesPerGroup=1, it might mean "Don't merge".
          // BUT, `stitchImagesAndStamp` is designed to stitch.

          // Let's look at how it was before.
          // It used `stitchImagesAndStamp` directly.
          // And it passed `stampConfig` and `pageConfig`.

          // I will replace `stitchImagesAndStamp` with `generateGroupedImages` for consistency if possible,
          // OR just update `stitchImagesAndStamp` arguments.
          // Since `stitchImagesAndStamp` returns a single string, it implies a single output image.
          // If `layoutMode` is vertical, we want one long image.

          // Let's just update the call to `stitchImagesAndStamp` for now to match the signature I will update in pdfService.
          // I will pass `undefined` or `null` for the removed arguments.

          const url = await stitchImagesAndStamp(
            pages,
            layoutMode,
            pagesPerGroup,
            processingConfig,
            orientation
          );
          urls = [url];
        }
        setPreviewUrls(urls);

        // Convert URLs to Blobs for preview (使用当前质量，0.9)
        if (onPreviewGenerated) {
          const blobs = await Promise.all(urls.map(async (url) => {
            const res = await fetch(url);
            return await res.blob();
          }));
          onPreviewGenerated(blobs);
        }

        // 生成高质量版本用于上传 (0.95质量)
        if (onUploadBlobsGenerated) {
          const highQualityBlobs = await Promise.all(urls.map(async (url) => {
            // 重新创建canvas并以更高质量导出
            const img = new Image();
            await new Promise((resolve) => {
              img.onload = resolve;
              img.src = url;
            });

            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return new Blob();

            ctx.drawImage(img, 0, 0);
            return await new Promise<Blob>((resolve) => {
              canvas.toBlob((blob) => {
                resolve(blob || new Blob());
              }, 'image/jpeg', 0.95);  // 高质量
            });
          }));
          onUploadBlobsGenerated(highQualityBlobs);
        }
      } catch (error) {
        console.error('Error generating preview:', error);
      } finally {
        setIsStitching(false);
      }
    };

    // Debounce preview generation
    const timer = setTimeout(generatePreview, 500);
    return () => clearTimeout(timer);
  }, [pages, layoutMode, pagesPerGroup, processingConfig, orientation, onPreviewGenerated, onUploadBlobsGenerated]);


  const handleDownload = async (url?: string, index?: number) => {
    const targetUrls = url ? [url] : previewUrls;
    if (targetUrls.length === 0) return;

    // Dynamically import to avoid SSR issues if any (though this is client-side)
    const { downloadImagesAsPdf } = await import('../services/pdfExportService');

    const timestamp = Date.now();
    const filename = layoutMode === 'grouped' && index !== undefined
      ? `stamped_document_group_${index + 1}_${timestamp}.pdf`
      : `stamped_document_${layoutMode}_${timestamp}.pdf`;

    await downloadImagesAsPdf(targetUrls, filename);
  };

  const handleDownloadAll = async () => {
    // Download all grouped images as a SINGLE PDF
    if (previewUrls.length === 0) return;

    const { downloadImagesAsPdf } = await import('../services/pdfExportService');
    const timestamp = Date.now();
    await downloadImagesAsPdf(previewUrls, `stamped_document_all_${timestamp}.pdf`);
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
                <span>{t('preview.downloadAllPdf', { count: previewUrls.length })}</span>
              </button>
            )}
            <button
              onClick={() => handleDownload()}
              disabled={previewUrls.length === 0 || isStitching}
              className="flex items-center justify-center space-x-2 bg-[#383838] text-white px-4 py-2 rounded-lg hover:bg-[#6b6b6b] transition-colors disabled:opacity-50 text-sm"
            >
              {isStitching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{t('preview.downloadPdf')}</span>
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

      <div className="relative w-full bg-[#fcf7f1] rounded-xl overflow-hidden min-h-[500px] border border-[#e0e0e0] shadow-inner p-4 sm:p-8 overflow-y-auto max-h-[80vh]">
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
            <div className="w-full min-h-[450px] flex items-center justify-center">
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