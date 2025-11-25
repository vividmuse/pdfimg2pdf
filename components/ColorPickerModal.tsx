import React, { useRef, useEffect, useState } from 'react';
import { X, Check } from 'lucide-react';
import { PdfPageImage } from '../types';
import { useTranslation } from '../src/i18n/LanguageContext';

interface ColorPickerModalProps {
    image: PdfPageImage; // This should now be the preview image instead of original
    selectedColors: { r: number; g: number; b: number }[];
    onColorsChanged: (colors: { r: number; g: number; b: number }[]) => void;
    onClose: () => void;
}

const ColorPickerModal: React.FC<ColorPickerModalProps> = ({ image, selectedColors, onColorsChanged, onClose }) => {
    const { t } = useTranslation();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [hoveredColor, setHoveredColor] = useState<{ r: number; g: number; b: number } | null>(null);
    const [localColors, setLocalColors] = useState<{ r: number; g: number; b: number }[]>(selectedColors);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = new Image();
        img.onload = () => {
            // Scale down for performance
            const maxWidth = 600;
            const scale = Math.min(1, maxWidth / img.width);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = image.blob;
    }, [image]);

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width));
        const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height));

        const imageData = ctx.getImageData(x, y, 1, 1);
        const data = imageData.data;

        const newColor = { r: data[0], g: data[1], b: data[2] };

        // Check if color already exists
        const exists = localColors.some(c => c.r === newColor.r && c.g === newColor.g && c.b === newColor.b);
        if (!exists) {
            setLocalColors([...localColors, newColor]);
        }
    };

    const handleCanvasMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width));
        const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height));

        const imageData = ctx.getImageData(x, y, 1, 1);
        const data = imageData.data;

        setHoveredColor({ r: data[0], g: data[1], b: data[2] });
    };

    const handleRemoveColor = (index: number) => {
        setLocalColors(localColors.filter((_, i) => i !== index));
    };

    const handleApply = () => {
        onColorsChanged(localColors);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            < div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-auto" >
                <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900">{t('processing.pickColor')}</h3>
                        <p className="text-sm text-slate-500">{t('processing.pickColorHint')}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6">
                    {/* Current hover color display */}
                    <div className="mb-4 flex items-center justify-between">
                        {hoveredColor && (
                            <div className="flex items-center space-x-3">
                                <div
                                    className="w-10 h-10 rounded border border-slate-300"
                                    style={{ backgroundColor: `rgb(${hoveredColor.r}, ${hoveredColor.g}, ${hoveredColor.b})` }}
                                />
                                <div className="text-sm text-slate-600">
                                    RGB({hoveredColor.r}, {hoveredColor.g}, {hoveredColor.b})
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Selected colors list */}
                    {localColors.length > 0 && (
                        <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                            <div className="text-sm font-medium text-slate-700 mb-2">
                                {t('processing.selectedColors')} ({localColors.length})
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {localColors.map((color, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center space-x-2 bg-white px-2 py-1 rounded border border-slate-200"
                                    >
                                        <div
                                            className="w-6 h-6 rounded border border-slate-300"
                                            style={{ backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})` }}
                                        />
                                        <span className="text-xs text-slate-600">
                                            RGB({color.r}, {color.g}, {color.b})
                                        </span>
                                        <button
                                            onClick={() => handleRemoveColor(index)}
                                            className="text-red-500 hover:text-red-700 ml-1"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Canvas for color picking */}
                    <canvas
                        ref={canvasRef}
                        onClick={handleCanvasClick}
                        onMouseMove={handleCanvasMove}
                        className="w-full cursor-crosshair border border-slate-200 rounded-lg"
                    />

                    {/* Action buttons */}
                    <div className="mt-4 flex justify-end space-x-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={handleApply}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center space-x-2"
                        >
                            <Check className="w-4 h-4" />
                            <span>{t('common.apply')}</span>
                        </button>
                    </div>
                </div>
            </div >
        </div >
    );
};

export default ColorPickerModal;
