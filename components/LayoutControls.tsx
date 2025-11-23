
import React from 'react';
import { LayoutMode } from '../types';
import { Columns, Grid, File, FileDigit } from 'lucide-react';

interface LayoutControlsProps {
  currentMode: LayoutMode;
  onChange: (mode: LayoutMode) => void;
}

const LayoutControls: React.FC<LayoutControlsProps> = ({ currentMode, onChange }) => {
  return (
    <div className="bg-[#ffffff] rounded-xl shadow-sm border border-[#e0e0e0] p-6 mb-6">
      <h2 className="text-lg font-bold text-[#383838] mb-4 flex items-center font-['Merriweather']">
        <Columns className="w-5 h-5 mr-2 text-[#d97757]" />
        Layout Style
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onChange('vertical')}
          className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
            currentMode === 'vertical'
              ? 'border-[#d97757] bg-[#fcf7f1] text-[#383838]'
              : 'border-[#e0e0e0] hover:border-[#9e9e9e] text-[#6b6b6b]'
          }`}
        >
          <div className="mb-2 p-2 bg-white rounded-lg border border-slate-100 shadow-sm">
             <div className="w-6 h-8 border-2 border-slate-300 border-dashed rounded-sm mx-auto flex flex-col gap-1 p-0.5">
                <div className="h-1.5 w-full bg-slate-300 rounded-xs"></div>
                <div className="h-1.5 w-full bg-slate-300 rounded-xs"></div>
                <div className="h-1.5 w-full bg-slate-300 rounded-xs"></div>
             </div>
          </div>
          <span className="text-sm font-semibold">Vertical</span>
          <span className="text-xs opacity-70 mt-1 text-center">Scroll</span>
        </button>

        <button
          onClick={() => onChange('grouped')}
          className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
            currentMode === 'grouped'
              ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
              : 'border-slate-200 hover:border-slate-300 text-slate-600'
          }`}
        >
          <div className="mb-2 p-2 bg-white rounded-lg border border-slate-100 shadow-sm">
             <div className="w-8 h-8 border-2 border-slate-300 rounded-sm mx-auto flex flex-col gap-1 p-1">
                <div className="h-2 w-full bg-slate-300 rounded-xs"></div>
                <div className="h-2 w-3/4 bg-slate-300 rounded-xs"></div>
                <div className="h-2 w-1/2 bg-slate-300 rounded-xs mt-1"></div>
                <div className="h-2 w-3/4 bg-slate-300 rounded-xs"></div>
             </div>
          </div>
          <span className="text-sm font-semibold">Grouped</span>
          <span className="text-xs opacity-70 mt-1 text-center">Per Pages</span>
        </button>

        <button
          onClick={() => onChange('grid')}
          className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
            currentMode === 'grid'
              ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
              : 'border-slate-200 hover:border-slate-300 text-slate-600'
          }`}
        >
           <div className="mb-2 p-2 bg-white rounded-lg border border-slate-100 shadow-sm">
             <div className="w-8 h-8 border-2 border-slate-300 rounded-sm mx-auto grid grid-cols-2 gap-0.5 p-0.5">
                <div className="bg-slate-300 rounded-xs"></div>
                <div className="bg-slate-300 rounded-xs"></div>
                <div className="bg-slate-300 rounded-xs"></div>
                <div className="bg-slate-300 rounded-xs"></div>
             </div>
          </div>
          <span className="text-sm font-semibold">Square</span>
          <span className="text-xs opacity-70 mt-1 text-center">1:1 Grid</span>
        </button>

        <button
          onClick={() => onChange('grid-a4')}
          className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
            currentMode === 'grid-a4'
              ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
              : 'border-slate-200 hover:border-slate-300 text-slate-600'
          }`}
        >
           <div className="mb-2 p-2 bg-white rounded-lg border border-slate-100 shadow-sm">
             <div className="w-6 h-8 border-2 border-slate-300 rounded-sm mx-auto grid grid-cols-2 gap-0.5 p-0.5">
                <div className="bg-slate-300 rounded-xs h-2"></div>
                <div className="bg-slate-300 rounded-xs h-2"></div>
                <div className="bg-slate-300 rounded-xs h-2"></div>
                <div className="bg-slate-300 rounded-xs h-2"></div>
                <div className="bg-slate-300 rounded-xs h-2"></div>
                <div className="bg-slate-300 rounded-xs h-2"></div>
             </div>
          </div>
          <span className="text-sm font-semibold">A4 Grid</span>
          <span className="text-xs opacity-70 mt-1 text-center">Portrait</span>
        </button>
      </div>
    </div>
  );
};

export default LayoutControls;
