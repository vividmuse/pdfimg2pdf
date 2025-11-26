import React, { useState, useEffect } from 'react';
import { ProcessingStatus, PdfPageImage, LayoutMode, ProcessingConfig, PageOrientation } from './types';
import UploadZone from './components/UploadZone';
import LayoutControls from './components/LayoutControls';
import ProcessingControls from './components/ProcessingControls';
import GroupControls from './components/GroupControls';
import PreviewArea from './components/PreviewArea';
import ImageSelector from './components/ImageSelector';
import { ScanServicePanel } from './src/components/ScanServicePanel';
import { convertPdfToImages } from './services/pdfService';
import { FileText, ScrollText, Github, User } from 'lucide-react';
import { useTranslation } from './src/i18n/LanguageContext';
import LanguageSwitcher from './src/components/LanguageSwitcher';

const App: React.FC = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [pdfPages, setPdfPages] = useState<PdfPageImage[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid-a4');
  const [pagesPerGroup, setPagesPerGroup] = useState<number>(1);
  const [processingConfig, setProcessingConfig] = useState<ProcessingConfig>({
    threshold: 0,
    brightness: 0,
    contrast: 0,
    strongBinarize: false
  });
  const [orientation, setOrientation] = useState<PageOrientation>('portrait');
  const [previewBlobs, setPreviewBlobs] = useState<Blob[]>([]);
  const [uploadBlobs, setUploadBlobs] = useState<Blob[]>([]);  // 高质量处理后图片用于上传
  const [originalFiles, setOriginalFiles] = useState<File[]>([]);  // 原始文件，用于单图直接上传

  const handleFileSelect = async (files: File[], mode: 'render' | 'extract' = 'extract') => {
    try {
      setStatus(ProcessingStatus.PROCESSING_PDF);
      setFileName(files.length === 1 ? files[0].name : `${files.length} files`);

      // 保存原始文件
      setOriginalFiles(files);

      // Process all files and combine results
      let allImages: PdfPageImage[] = [];
      for (const file of files) {
        const images = await convertPdfToImages(file, mode);
        allImages.push(...images);
      }

      // 如果是提取模式，自动清理小图片和重复图片
      if (mode === 'extract' && allImages.length > 0) {
        // Calculate max area to identify "main" pages
        const maxArea = Math.max(...allImages.map(img => img.width * img.height));

        // Filter out images that are significantly smaller (< 20% of max area)
        // This removes small watermarks, QR codes, icons, etc.
        const thresholdRatio = 0.2;
        allImages = allImages.filter(img => {
          const area = img.width * img.height;
          return area > (maxArea * thresholdRatio);
        });

        console.log(`Auto-cleaned: removed ${allImages.length} small images`);
      }

      setPdfPages(allImages);
      setStatus(ProcessingStatus.READY);

      // uploadBlobs会在PreviewArea的onUploadBlobsGenerated中设置
    } catch (error) {
      console.error(error);
      setStatus(ProcessingStatus.ERROR);
      alert(t('app.error.process'));
    }
  };

  const handleLayoutChange = (mode: LayoutMode) => {
    setLayoutMode(mode);
    // If switching to A4/A3 and grouping is "All" (0), default to 1 page per sheet
    // This prevents the "One giant image on A4" issue which is usually not what users want
    if ((mode === 'grid-a4' || mode === 'grid-a3') && pagesPerGroup === 0) {
      setPagesPerGroup(1);
    }
  };

  const handleRemovePage = (index: number) => {
    setPdfPages(prev => prev.filter((_, i) => i !== index));
    // uploadBlobs会由PreviewArea自动重新生成
  };

  const handleKeepOdd = () => {
    setPdfPages(prev => prev.filter((_, i) => i % 2 === 0));
  };

  const handleKeepEven = () => {
    setPdfPages(prev => prev.filter((_, i) => i % 2 !== 0));
  };

  const handleAutoClean = () => {
    if (pdfPages.length === 0) return;

    // Calculate max area to identify "main" pages
    const maxArea = Math.max(...pdfPages.map(img => img.width * img.height));

    // Filter out images that are significantly smaller than the main pages (e.g., < 20% of max area)
    // This effectively removes small watermarks, QR codes, icons, etc.
    const thresholdRatio = 0.2;

    setPdfPages(prev => prev.filter((img, index) => {
      const area = img.width * img.height;
      return area > (maxArea * thresholdRatio);
    }));
  };

  const handleClear = () => {
    setPdfPages([]);
    setStatus(ProcessingStatus.IDLE);
    setProcessingConfig({
      threshold: 0,
      brightness: 0,
      contrast: 0,
      strongBinarize: false
    });
    setFileName('');
  };

  return (
    <div className="min-h-screen bg-[#fcf7f1] font-['DM Sans'] selection:bg-[#da7756] selection:text-[#ffffff]">

      {/* Header */}
      <header className="bg-[#ffffff] border-b border-[#e0e0e0] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-[#d97757] p-2 rounded-lg">
              <ScrollText className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-[#383838] tracking-tight font-['Merriweather']">{t('app.title')} <span className="text-[#9e9e9e] font-light">{t('app.subtitle')}</span></h1>
          </div>
          <div className="flex items-center space-x-4">
            <LanguageSwitcher />
            <div className="relative group">
              <a
                href="https://github.com/cclank/NLM2Img"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#6b6b6b] hover:text-[#383838] transition-colors"
                aria-label="GitHub Repository"
              >
                <Github className="w-5 h-5" />
              </a>
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 text-xs text-white bg-[#383838] rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                {t('app.github')}
              </div>
            </div>
            <div className="relative group">
              <a
                href="https://x.com/LufzzLiz"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#6b6b6b] hover:text-[#383838] transition-colors"
                aria-label="Author Profile"
              >
                <User className="w-5 h-5" />
              </a>
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 text-xs text-white bg-[#383838] rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                {t('app.author')}
              </div>
            </div>
            <div className="text-sm font-medium text-[#6b6b6b] hidden sm:block">
              {t('app.privacy')}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Upload Section (Visible if no file) */}
        {status === ProcessingStatus.IDLE && (
          <div className="max-w-2xl mx-auto mt-12">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">{t('app.hero.title')}</h2>
              <p className="text-lg text-slate-600">{t('app.hero.subtitle')}</p>
            </div>
            <UploadZone onFileSelect={handleFileSelect} />
          </div>
        )}

        {/* Workspace (Visible if file loaded or processing) */}
        {(status !== ProcessingStatus.IDLE) && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* Sidebar Controls */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-[#ffffff] p-4 rounded-xl border border-[#e0e0e0] flex items-center justify-between shadow-sm">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <FileText className="w-5 h-5 text-[#d97757] shrink-0" />
                  <span className="text-sm font-medium text-[#383838] truncate" title={fileName}>{fileName}</span>
                </div>
                <button
                  onClick={() => {
                    setStatus(ProcessingStatus.IDLE);
                    setPdfPages([]);
                  }}
                  className="text-xs text-[#d15648] hover:text-[#d15648] font-medium px-2 py-1 rounded hover:bg-[#fcf7f1] transition-colors"
                >
                  {t('app.changeFile')}
                </button>
              </div>

              <LayoutControls
                currentMode={layoutMode}
                onChange={handleLayoutChange}
                orientation={orientation}
                onOrientationChange={setOrientation}
              />

              <ProcessingControls
                config={processingConfig}
                onChange={setProcessingConfig}
                sampleImage={pdfPages[0]}
              />

              {/* Group Controls - Always visible now to allow merging pages */}
              <GroupControls
                totalPages={pdfPages.length}
                onPageGroupChange={setPagesPerGroup}
              />
            </div>

            {/* Preview Area */}
            <div className="lg:col-span-8">
              <ImageSelector
                images={pdfPages}
                onRemove={handleRemovePage}
                onKeepOdd={handleKeepOdd}
                onKeepEven={handleKeepEven}
                onAutoClean={handleAutoClean}
                onClear={handleClear}
              />
              <PreviewArea
                pages={pdfPages}
                layoutMode={layoutMode}
                pagesPerGroup={pagesPerGroup}
                isProcessing={status === ProcessingStatus.PROCESSING_PDF}
                processingConfig={processingConfig}
                orientation={orientation}
                onPreviewGenerated={setPreviewBlobs}
                onUploadBlobsGenerated={setUploadBlobs}  // 接收高质量上传图片
              />

              {/* Scan Service Panel - 智能上传：单图用原图，多图拼接原图 */}
              {pdfPages.length > 0 && (
                <ScanServicePanel
                  previewImages={uploadBlobs}  // 备用（暂不使用）
                  originalFiles={originalFiles}  // 原始文件
                  pdfPages={pdfPages}  // 原始页面数据
                  layoutMode={layoutMode}  // 布局模式
                  pagesPerGroup={pagesPerGroup}  // 分组
                  processingConfig={processingConfig}  // 处理配置
                  orientation={orientation}  // 方向
                  onScanComplete={async (pdfUrl: string) => {
                    try {
                      console.log('Loading scanned PDF from:', pdfUrl);
                      setStatus(ProcessingStatus.PROCESSING_PDF);

                      // 从URL下载PDF
                      const response = await fetch(pdfUrl);
                      const blob = await response.blob();
                      const file = new File([blob], 'scanned.pdf', { type: 'application/pdf' });

                      // 转换为图片并更新预览
                      const images = await convertPdfToImages(file, 'render');
                      setPdfPages(images);
                      setFileName('scanned.pdf');

                      setStatus(ProcessingStatus.READY);

                      console.log('Scanned PDF loaded successfully');
                    } catch (error) {
                      console.error('Failed to load scanned PDF:', error);
                      setStatus(ProcessingStatus.ERROR);
                      alert('加载扫描PDF失败');
                    }
                  }}
                />
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
