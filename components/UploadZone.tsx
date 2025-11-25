import React, { useRef, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { useTranslation } from '../src/i18n/LanguageContext';

interface UploadZoneProps {
  onFileSelect: (files: File[], mode: 'render' | 'extract') => void;
}

const UploadZone: React.FC<UploadZoneProps> = ({ onFileSelect }) => {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'render' | 'extract'>('extract');  // 默认提取图片模式

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const validateAndPassFile = (file: File) => {
    if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
      setError(t('upload.error.type'));
      return;
    }
    setError(null);
    onFileSelect(file, mode);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const validFiles = files.filter((file: File) =>
        file.type === 'application/pdf' || file.type.startsWith('image/')
      );
      if (validFiles.length === 0) {
        setError(t('upload.error.type'));
        return;
      }
      setError(null);
      onFileSelect(validFiles, mode);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      const validFiles = fileArray.filter((file: File) =>
        file.type === 'application/pdf' || file.type.startsWith('image/')
      );
      if (validFiles.length === 0) {
        setError(t('upload.error.type'));
        return;
      }
      setError(null);
      onFileSelect(validFiles, mode);
    }
  };

  return (
    <div
      className={`relative border-2 border-dashed rounded-[var(--radius)] p-10 transition-all duration-300 flex flex-col items-center justify-center text-center cursor-pointer overflow-hidden font-['DM Sans']
        ${isDragging ? 'border-[#d97757] bg-[#fcf7f1]' : 'border-[#e0e0e0] hover:border-[#9e9e9e] bg-[#ffffff]'}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInput}
        accept="application/pdf,image/*"
        multiple
        className="hidden"
      />

      <div className="bg-[#fcf7f1] p-4 rounded-full mb-4">
        <Upload className="w-8 h-8 text-[#d97757]" />
      </div>

      <h3 className="text-xl font-semibold text-[#383838] mb-2 font-['Merriweather']">
        {t('upload.title')}
      </h3>
      <p className="text-[#6b6b6b] mb-6 max-w-sm">
        {t('upload.subtitle')}
      </p>

      {/* Mode Toggle */}
      <div className="flex bg-[#fcf7f1] p-1 rounded-lg mb-6 border border-[#e0e0e0]" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setMode('render')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'render'
            ? 'bg-white text-[#d97757] shadow-sm'
            : 'text-[#6b6b6b] hover:text-[#383838]'
            }`}
        >
          {t('upload.render')}
        </button>
        <button
          onClick={() => setMode('extract')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'extract'
            ? 'bg-white text-[#d97757] shadow-sm'
            : 'text-[#6b6b6b] hover:text-[#383838]'
            }`}
          title={t('upload.extract.tooltip')}
        >
          {t('upload.extract')}
        </button>
      </div>

      {error && (
        <div className="absolute bottom-4 flex items-center text-[#d15648] text-sm font-medium bg-[#fcf7f1] px-3 py-1 rounded-lg">
          <AlertCircle className="w-4 h-4 mr-2" />
          {error}
        </div>
      )}
    </div>
  );
};

export default UploadZone;
