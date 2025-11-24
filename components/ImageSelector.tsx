import React from 'react';
import { PdfPageImage } from '../types';
import { X, CheckSquare, Square, Trash2 } from 'lucide-react';
import { useTranslation } from '../src/i18n/LanguageContext';

interface ImageSelectorProps {
    images: PdfPageImage[];
    onRemove: (index: number) => void;
    onKeepOdd: () => void;
    onKeepEven: () => void;
    onAutoClean: () => void;
    onClear: () => void;
}

const ImageSelector: React.FC<ImageSelectorProps> = ({ images, onRemove, onKeepOdd, onKeepEven, onAutoClean, onClear }) => {
    const { t } = useTranslation();

    if (images.length === 0) return null;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-bold text-slate-800 font-['Merriweather']">{t('selector.title')}</h3>
                    <span className="bg-slate-100 text-slate-600 text-xs font-medium px-2.5 py-0.5 rounded-full">
                        {images.length} {t('common.items')}
                    </span>
                </div>
                <div className="flex space-x-2">
                    <button
                        onClick={onAutoClean}
                        className="text-xs flex items-center px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors font-medium mr-2"
                        title={t('selector.autoClean.tooltip')}
                    >
                        <span className="mr-1.5">✨</span>
                        {t('selector.autoClean')}
                    </button>
                    <button
                        onClick={onKeepOdd}
                        className="text-xs flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors font-medium"
                        title={t('selector.keepOdd.tooltip')}
                    >
                        <CheckSquare className="w-3 h-3 mr-1.5" />
                        {t('selector.keepOdd')}
                    </button>
                    <button
                        onClick={onKeepEven}
                        className="text-xs flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors font-medium"
                        title={t('selector.keepEven.tooltip')}
                    >
                        <Square className="w-3 h-3 mr-1.5" />
                        {t('selector.keepEven')}
                    </button>
                    <button
                        onClick={onClear}
                        className="text-xs flex items-center px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors font-medium ml-2"
                    >
                        <Trash2 className="w-3 h-3 mr-1.5" />
                        {t('common.clear')}
                    </button>
                </div>
            </div>

            <div className="flex space-x-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                {images.map((img, index) => (
                    <div key={index} className="relative group shrink-0">
                        <div className="w-32 h-32 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center">
                            <img
                                src={img.blob}
                                alt={`Item ${index + 1}`}
                                className="max-w-full max-h-full object-contain"
                            />
                        </div>
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => onRemove(index)}
                                className="bg-red-500 text-white p-1 rounded-full hover:bg-red-600 shadow-sm"
                                title={t('common.remove')}
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                        <div className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                            #{index + 1}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ImageSelector;
