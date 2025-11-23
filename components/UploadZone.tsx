import React, { useRef, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
}

const UploadZone: React.FC<UploadZoneProps> = ({ onFileSelect }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const validateAndPassFile = (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file.');
      return;
    }
    setError(null);
    onFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      validateAndPassFile(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndPassFile(files[0]);
    }
  };

  return (
    <div
      className={`relative border-2 border-dashed rounded-xl p-10 transition-all duration-300 flex flex-col items-center justify-center text-center cursor-pointer overflow-hidden
        ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-slate-400 bg-white'}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInput}
        accept="application/pdf"
        className="hidden"
      />
      
      <div className="bg-indigo-100 p-4 rounded-full mb-4">
        <Upload className="w-8 h-8 text-indigo-600" />
      </div>
      
      <h3 className="text-xl font-semibold text-slate-800 mb-2">
        Upload your PDF
      </h3>
      <p className="text-slate-500 mb-6 max-w-sm">
        Drag and drop your file here, or click to browse. We will stitch all pages into one long image.
      </p>

      {error && (
        <div className="absolute bottom-4 flex items-center text-red-500 text-sm font-medium bg-red-50 px-3 py-1 rounded-lg">
          <AlertCircle className="w-4 h-4 mr-2" />
          {error}
        </div>
      )}
    </div>
  );
};

export default UploadZone;
