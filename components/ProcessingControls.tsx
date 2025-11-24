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
            <h3 className="text-sm font-semibold text-[#383838] mb-3 flex items-center">
                <span className="text-lg mr-2">🎨</span>
                {t('processing.title')}
            </h3>

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
                    {config.targetColor && (
                        <div className="mt-2 flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-2">
                                <div
                                    className="w-6 h-6 rounded border border-slate-300"
                                    style={{ backgroundColor: `rgb(${config.targetColor.r}, ${config.targetColor.g}, ${config.targetColor.b})` }}
                                />
                                <span className="text-slate-600">RGB({config.targetColor.r}, {config.targetColor.g}, {config.targetColor.b})</span>
                            </div>
                            <button
                                onClick={() => onChange({ ...config, targetColor: undefined })}
                                className="text-red-500 hover:text-red-700"
                            >
                                {t('common.clear')}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Color Tolerance Slider - only when targetColor is set */}
            {config.targetColor && (
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
                        <span className="mr-2">📐</span>
                        Auto Flatten / Dewarp
                    </label>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.autoDewarp || false}
                            onChange={(e) => onChange({ ...config, autoDewarp: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                </div>

                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-[#383838] flex items-center cursor-pointer">
                        <span className="mr-2">✨</span>
                        Advanced Whitening
                    </label>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.useAdaptiveThreshold || false}
                            onChange={(e) => onChange({ ...config, useAdaptiveThreshold: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                </div>
            </div>

            {showColorPicker && sampleImage && (
                <ColorPickerModal
                    image={sampleImage}
                    onColorPicked={(color) => {
                        onChange({ ...config, targetColor: color, colorTolerance: config.colorTolerance || 20 });
                        setShowColorPicker(false);
                    }}
                    onClose={() => setShowColorPicker(false)}
                />
            )}
        </div>
    );
};

export default ProcessingControls;
