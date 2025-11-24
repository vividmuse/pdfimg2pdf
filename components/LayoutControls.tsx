import React from 'react';
import { LayoutMode, PageOrientation, PageConfig } from '../types';
import { LayoutList, Grid, FileText, LayoutTemplate, Smartphone, Monitor, Type } from 'lucide-react';
import { useTranslation } from '../src/i18n/LanguageContext';

interface LayoutControlsProps {
  currentMode: LayoutMode;
  onChange: (mode: LayoutMode) => void;
  orientation: PageOrientation;
  onOrientationChange: (orientation: PageOrientation) => void;
  pageConfig: PageConfig;
  onPageConfigChange: (config: PageConfig) => void;
}

const LayoutControls: React.FC<LayoutControlsProps> = ({ currentMode, onChange, orientation, onOrientationChange, pageConfig, onPageConfigChange }) => {
  const { t } = useTranslation();

  const options: { id: LayoutMode; label: string; icon: React.ElementType; description: string; preview: React.ReactNode }[] = [
    {
      id: 'vertical',
      label: t('layout.vertical'),
      icon: LayoutList,
      description: t('layout.vertical.desc'),
      preview: (
        <div className="w-6 h-8 border-2 border-slate-300 border-dashed rounded-sm mx-auto flex flex-col gap-1 p-0.5">
          <div className="h-1.5 w-full bg-slate-300 rounded-xs"></div>
          <div className="h-1.5 w-full bg-slate-300 rounded-xs"></div>
          <div className="h-1.5 w-full bg-slate-300 rounded-xs"></div>
        </div>
      ),
    },
    {
      id: 'grid',
      label: t('layout.grid'),
      icon: Grid,
      description: t('layout.grid.desc'),
      preview: (
        <div className="w-8 h-8 border-2 border-slate-300 rounded-sm mx-auto grid grid-cols-2 gap-0.5 p-0.5">
          <div className="bg-slate-300 rounded-xs"></div>
          <div className="bg-slate-300 rounded-xs"></div>
          <div className="bg-slate-300 rounded-xs"></div>
          <div className="bg-slate-300 rounded-xs"></div>
        </div>
      ),
    },
    {
      id: 'grid-a4',
      label: t('layout.a4'),
      icon: FileText,
      description: t('layout.a4.desc'),
      preview: (
        <div className="w-6 h-8 border-2 border-slate-300 rounded-sm mx-auto grid grid-cols-2 gap-0.5 p-0.5">
          <div className="bg-slate-300 rounded-xs h-2"></div>
          <div className="bg-slate-300 rounded-xs h-2"></div>
          <div className="bg-slate-300 rounded-xs h-2"></div>
          <div className="bg-slate-300 rounded-xs h-2"></div>
          <div className="bg-slate-300 rounded-xs h-2"></div>
          <div className="bg-slate-300 rounded-xs h-2"></div>
        </div>
      ),
    },
    {
      id: 'grid-a3',
      label: t('layout.a3'),
      icon: LayoutTemplate,
      description: t('layout.a3.desc'),
      preview: (
        <div className="w-8 h-10 border-2 border-slate-300 rounded-sm mx-auto grid grid-cols-2 gap-0.5 p-0.5">
          <div className="bg-slate-300 rounded-xs h-2"></div>
          <div className="bg-slate-300 rounded-xs h-2"></div>
          <div className="bg-slate-300 rounded-xs h-2"></div>
          <div className="bg-slate-300 rounded-xs h-2"></div>
          <div className="bg-slate-300 rounded-xs h-2"></div>
          <div className="bg-slate-300 rounded-xs h-2"></div>
          <div className="bg-slate-300 rounded-xs h-2"></div>
          <div className="bg-slate-300 rounded-xs h-2"></div>
        </div>
      ),
    },
  ];

  return (
    <div className="bg-[#ffffff] rounded-xl shadow-sm border border-[#e0e0e0] p-6 mb-6">
      <div className="flex items-center mb-4">
        <div className="bg-[#fcf7f1] p-2 rounded-lg mr-3">
          <LayoutList className="w-5 h-5 text-[#d97757]" />
        </div>
        <h2 className="text-lg font-bold text-[#383838] font-['Merriweather']">{t('layout.title')}</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${currentMode === option.id
              ? 'border-[#d97757] bg-[#fcf7f1] text-[#383838]'
              : 'border-[#e0e0e0] hover:border-[#9e9e9e] text-[#6b6b6b]'
              }`}
          >
            <div className="mb-2 p-2 bg-white rounded-lg border border-slate-100 shadow-sm">
              {option.preview}
            </div>
            <span className="text-sm font-semibold">{option.label}</span>
            <span className="text-xs opacity-70 mt-1 text-center">{option.description}</span>
          </button>
        ))}
      </div>

      {/* Orientation Toggle - Only relevant for A4/A3 grids */}
      {(currentMode === 'grid-a4' || currentMode === 'grid-a3') && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <label className="text-sm font-medium text-[#383838] mb-2 block">{t('layout.orientation')}</label>
          <div className="flex bg-[#fcf7f1] p-1 rounded-lg border border-[#e0e0e0]">
            <button
              onClick={() => onOrientationChange('portrait')}
              className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-all ${orientation === 'portrait'
                ? 'bg-white text-[#d97757] shadow-sm'
                : 'text-[#6b6b6b] hover:text-[#383838]'
                }`}
            >
              <Smartphone className="w-4 h-4 mr-2" />
              {t('layout.portrait')}
            </button>
            <button
              onClick={() => onOrientationChange('landscape')}
              className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-all ${orientation === 'landscape'
                ? 'bg-white text-[#d97757] shadow-sm'
                : 'text-[#6b6b6b] hover:text-[#383838]'
                }`}
            >
              <Monitor className="w-4 h-4 mr-2" />
              {t('layout.landscape')}
            </button>
          </div>
        </div>
      )}

      {/* Header & Footer Inputs */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <label className="text-sm font-medium text-[#383838] mb-2 block flex items-center">
          <Type className="w-4 h-4 mr-2" />
          {t('layout.headerFooter')}
        </label>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-500">{t('layout.header')}</label>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onPageConfigChange({ ...pageConfig, headerText: window.location.hostname });
                }}
                className="text-xs text-[#d97757] hover:text-[#b85637] font-medium"
              >
                {t('layout.useCurrentUrl')}
              </button>
            </div>
            <input
              type="text"
              value={pageConfig.headerText}
              onChange={(e) => onPageConfigChange({ ...pageConfig, headerText: e.target.value })}
              placeholder="e.g. www.example.com"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#d97757] focus:border-transparent"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">{t('layout.footer')}</label>
            <input
              type="text"
              value={pageConfig.footerText}
              onChange={(e) => onPageConfigChange({ ...pageConfig, footerText: e.target.value })}
              placeholder="e.g. Page 1"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#d97757] focus:border-transparent"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LayoutControls;
