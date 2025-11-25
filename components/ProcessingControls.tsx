import React, { useState } from 'react';
import { ProcessingConfig, PdfPageImage } from '../types';
import { Sliders, Sun, Contrast, Eraser, Pipette } from 'lucide-react';
import ColorPickerModal from './ColorPickerModal';
import { useTranslation } from '../src/i18n/LanguageContext';

interface ProcessingControlsProps {
    config: ProcessingConfig;
    onChange: (config: ProcessingConfig) => void;
    sampleImage?: PdfPageImage; // For eyedropper
}

const ProcessingControls: React.FC<ProcessingControlsProps> = ({ config, onChange, sampleImage }) => {
    const { t } = useTranslation();
    const [showColorPicker, setShowColorPicker] = useState(false);

    const handleChange = (key: keyof ProcessingConfig, value: number) => {
        onChange({ ...config, [key]: value });
    };

    return (
        <div className="bg-white p-4 rounded-xl border border-[#e0e0e0] shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[#383838] flex items-center">
                    <span className="text-lg mr-2">🎨</span>
                    {t('processing.title')}
                </h3>
                <button
                    onClick={() => onChange({
                        threshold: 0,
                        brightness: 0,
                        contrast: 0,
                        targetColors: undefined,
                        colorTolerance: 20,
                        strongBinarize: false,
                        documentEnhance: false
                    })}
                    className="text-xs text-slate-600 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                    title="重置所有处理参数"
                >
                    {t('processing.reset')}
                </button>
            </div>

            {/* Eyedropper Button */}
            {sampleImage && (
                <div className="mb-4">
                    <button
                        onClick={() => setShowColorPicker(true)}
                        className="w-full flex items-center justify-center space-x-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg hover:bg-emerald-100 transition-colors font-medium"
                    >
                        <Pipette className="w-4 h-4" />
                        <span>{t('processing.eyedropper')}</span>
                    </button>
                    {config.targetColors && config.targetColors.length > 0 && (
                        <div className="mt-2 space-y-2">
                            {config.targetColors.map((color, index) => (
                                <div key={index} className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded">
                                    <div className="flex items-center space-x-2">
                                        <div
                                            className="w-6 h-6 rounded border border-slate-300"
                                            style={{ backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})` }}
                                        />
                                        <span className="text-slate-600">RGB({color.r}, {color.g}, {color.b})</span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const newColors = config.targetColors?.filter((_, i) => i !== index);
                                            onChange({ ...config, targetColors: newColors?.length ? newColors : undefined });
                                        }}
                                        className="text-red-500 hover:text-red-700"
                                    >
                                        {t('common.remove')}
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={() => onChange({ ...config, targetColors: undefined })}
                                className="w-full text-xs text-red-500 hover:text-red-700 py-1"
                            >
                                {t('common.clearAll')}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Color Tolerance Slider - only when targetColors is set */}
            {config.targetColors && config.targetColors.length > 0 && (
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-[#383838]">{t('processing.colorTolerance')}</label>
                        <span className="text-sm text-[#6b6b6b]">{config.colorTolerance || 20}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={config.colorTolerance || 20}
                        onChange={(e) => onChange({ ...config, colorTolerance: Number(e.target.value) })}
                        className="w-full h-1.5 bg-[#e0e0e0] rounded-lg appearance-none cursor-pointer accent-[#d97757]"
                    />
                    <div className="text-xs text-slate-500 mt-1">{t('processing.colorToleranceHint')}</div>
                </div>
            )}

            {/* Threshold Control */}
            <div className="space-y-1 mb-4">
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-[#383838] flex items-center">
                            <Eraser className="w-4 h-4 mr-2 text-[#6b6b6b]" />
                            {t('processing.whiteBg')}
                        </label>
                        <span className="text-xs text-[#6b6b6b] font-medium">{config.threshold}%</span>
                    </div>
                </div>
                <input
                    type="range"
                    min="0"
                    max="200"
                    value={config.threshold}
                    onChange={(e) => handleChange('threshold', parseInt(e.target.value))}
                    className="w-full h-1.5 bg-[#e0e0e0] rounded-lg appearance-none cursor-pointer accent-[#d97757]"
                />
            </div>

            {/* Brightness Control */}
            <div className="space-y-1 mb-4">
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-[#383838] flex items-center">
                            <Sun className="w-4 h-4 mr-2 text-[#6b6b6b]" />
                            {t('processing.brightness')}
                        </label>
                        <span className="text-xs text-[#6b6b6b] font-medium">{config.brightness > 0 ? '+' : ''}{config.brightness}%</span>
                    </div>
                </div>
                <input
                    type="range"
                    min="-100"
                    max="100"
                    value={config.brightness}
                    onChange={(e) => handleChange('brightness', parseInt(e.target.value))}
                    className="w-full h-1.5 bg-[#e0e0e0] rounded-lg appearance-none cursor-pointer accent-[#d97757]"
                />
            </div>

            {/* Contrast Control */}
            <div className="space-y-1 mb-4">
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-[#383838] flex items-center">
                            <Contrast className="w-4 h-4 mr-2 text-[#6b6b6b]" />
                            {t('processing.contrast')}
                        </label>
                        <span className="text-xs text-[#6b6b6b] font-medium">{config.contrast > 0 ? '+' : ''}{config.contrast}%</span>
                    </div>
                </div>
                <input
                    type="range"
                    min="-100"
                    max="100"
                    value={config.contrast}
                    onChange={(e) => handleChange('contrast', parseInt(e.target.value))}
                    className="w-full h-1.5 bg-[#e0e0e0] rounded-lg appearance-none cursor-pointer accent-[#d97757]"
                />
            </div>

            {/* Advanced Features */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-[#383838] flex items-center cursor-pointer">
                        <span className="mr-2">📄</span>
                        {t('processing.docEnhance')}
                    </label>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.documentEnhance || false}
                            onChange={(e) => onChange({ ...config, documentEnhance: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                </div>
                <div className="text-xs text-slate-500 -mt-1 ml-7">
                    {t('processing.docEnhance.desc')}
                </div>

                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-[#383838] flex items-center cursor-pointer">
                        <span className="mr-2">🖨️</span>
                        {t('processing.strongBW')}
                    </label>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.strongBinarize || false}
                            onChange={(e) => onChange({ ...config, strongBinarize: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                </div>
            </div>

            {showColorPicker && sampleImage && (
                <ColorPickerModal
                    image={sampleImage}
                    selectedColors={config.targetColors || []}
                    onColorsChanged={(colors) => {
                        onChange({ ...config, targetColors: colors.length > 0 ? colors : undefined, colorTolerance: config.colorTolerance || 20 });
                    }}
                    onClose={() => setShowColorPicker(false)}
                />
            )}

        </div>
    );
};

export default ProcessingControls;
