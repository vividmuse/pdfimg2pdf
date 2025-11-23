import React, { useState } from 'react';
import { StampConfig } from '../types';
import { Sparkles, Type as TypeIcon, Palette, Square, Circle } from 'lucide-react';
import { generateStampSuggestion } from '../services/geminiService';

interface StampControlsProps {
  config: StampConfig;
  onChange: (config: StampConfig) => void;
}

const StampControls: React.FC<StampControlsProps> = ({ config, onChange }) => {
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleChange = (key: keyof StampConfig, value: any) => {
    onChange({ ...config, [key]: value });
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const suggestion = await generateStampSuggestion(aiPrompt);
      onChange({
        ...config,
        text: suggestion.text,
        subText: suggestion.subText || config.subText
      });
    } catch (e) {
      alert("AI Generation failed. Please check your API Key or try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6 sticky top-6">
      <div className="flex items-center space-x-2 border-b border-slate-100 pb-4">
        <div className="bg-red-100 p-2 rounded-lg">
          <Palette className="w-5 h-5 text-red-600" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Stamp Designer</h2>
      </div>

      {/* AI Generator Section */}
      <div className="space-y-3 bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100">
        <label className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center">
          <Sparkles className="w-3 h-3 mr-1" />
          AI Smart Text
        </label>
        <div className="flex gap-2">
          <input 
            type="text" 
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="e.g. 'Approved by Finance Dept'..."
            className="flex-1 text-sm border-indigo-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <button 
            onClick={handleAiGenerate}
            disabled={isGenerating || !aiPrompt}
            className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isGenerating ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Manual Controls */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Main Text</label>
          <div className="relative">
            <TypeIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text"
              value={config.text}
              maxLength={8}
              onChange={(e) => handleChange('text', e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none text-slate-800"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Sub Text</label>
          <input 
            type="text"
            value={config.subText}
            maxLength={12}
            onChange={(e) => handleChange('subText', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none text-slate-800 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">Shape</label>
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
            <input 
              type="color" 
              value={config.color}
              onChange={(e) => handleChange('color', e.target.value)}
              className="w-full h-[38px] p-1 border border-slate-300 rounded-lg cursor-pointer"
            />
          </div>
        </div>

        <div>
           <div className="flex justify-between items-center mb-1">
             <label className="block text-sm font-medium text-slate-700">Opacity</label>
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

      </div>
    </div>
  );
};

export default StampControls;