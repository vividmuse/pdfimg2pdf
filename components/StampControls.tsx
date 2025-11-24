import React from 'react';
import { StampConfig } from '../types';
import { Type, Square, Circle, Move, Palette } from 'lucide-react';
import { useTranslation } from '../src/i18n/LanguageContext';

interface StampControlsProps {
  config: StampConfig;
  onChange: (config: StampConfig) => void;
}

const StampControls: React.FC<StampControlsProps> = ({ config, onChange }) => {
  const { t } = useTranslation();

  const handleChange = <K extends keyof StampConfig>(key: K, value: StampConfig[K]) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <div className="bg-[#ffffff] rounded-xl shadow-sm border border-[#e0e0e0] p-6 space-y-6 sticky top-6 max-h-[calc(100vh-4rem)] overflow-y-auto">
      <div className="flex items-center space-x-2 border-b border-[#e0e0e0] pb-4">
        <div className="bg-[#fcf7f1] p-2 rounded-lg">
          <Palette className="w-5 h-5 text-[#d97757]" />
        </div>
        <h2 className="text-lg font-bold text-[#383838] font-['Merriweather']">{t('stamp.title')}</h2>
      </div>

      {/* Manual Controls */}
      <div className="space-y-4">
        {/* Text Inputs */}
        <div>
          <label className="block text-sm font-medium text-[#383838] mb-1">{t('stamp.text')}</label>
          <div className="relative">
            <Type className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9e9e9e] w-4 h-4" />
            <input
              type="text"
              value={config.text}
              maxLength={8}
              onChange={(e) => handleChange('text', e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-[#e0e0e0] rounded-lg focus:ring-2 focus:ring-[#d97757] focus:border-[#d97757] outline-none text-[#383838] bg-[#ffffff]"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#383838] mb-1">{t('stamp.subText')}</label>
          <input
            type="text"
            value={config.subText}
            maxLength={12}
            onChange={(e) => handleChange('subText', e.target.value)}
            className="w-full px-3 py-2 border border-[#e0e0e0] rounded-lg focus:ring-2 focus:ring-[#d97757] focus:border-[#d97757] outline-none text-[#383838] text-sm bg-[#ffffff]"
          />
        </div>

        {/* Style Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('stamp.shape')}</label>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => handleChange('shape', 'square')}
                className={`flex-1 flex justify-center py-1.5 rounded-md transition-all ${config.shape === 'square' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
              >
                <Square className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleChange('shape', 'circle')}
                className={`flex-1 flex justify-center py-1.5 rounded-md transition-all ${config.shape === 'circle' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
              >
                <Circle className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('stamp.color')}</label>
            <input
              type="color"
              value={config.color}
              onChange={(e) => handleChange('color', e.target.value)}
              className="w-full h-[38px] p-1 border border-slate-300 rounded-lg cursor-pointer"
            />
          </div>
        </div>

        {/* Opacity */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium text-slate-700">{t('stamp.opacity')}</label>
            <span className="text-xs text-slate-500 font-medium">{Math.round(config.opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={config.opacity}
            onChange={(e) => handleChange('opacity', parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <hr className="border-slate-100" />

        {/* Position / Padding Controls */}
        <div>
          <div className="flex items-center mb-3">
            <Move className="w-4 h-4 text-slate-400 mr-2" />
            <label className="text-sm font-bold text-slate-700">{t('stamp.position')}</label>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>{t('stamp.paddingX')}</span>
                <span>{config.paddingX}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="500"
                step="10"
                value={config.paddingX}
                onChange={(e) => handleChange('paddingX', parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>{t('stamp.paddingY')}</span>
                <span>{config.paddingY}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="500"
                step="10"
                value={config.paddingY}
                onChange={(e) => handleChange('paddingY', parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default StampControls;