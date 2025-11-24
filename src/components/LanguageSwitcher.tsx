import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import { Language } from '../i18n/translations';
import { Globe } from 'lucide-react';

const languages: { code: Language; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'zh', label: '中文' },
    { code: 'fr', label: 'Français' },
    { code: 'es', label: 'Español' },
    { code: 'de', label: 'Deutsch' },
    { code: 'th', label: 'ไทย' },
];

const LanguageSwitcher: React.FC = () => {
    const { language, setLanguage } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-1 text-[#6b6b6b] hover:text-[#383838] transition-colors p-2 rounded-lg hover:bg-gray-100"
                aria-label="Select Language"
            >
                <Globe className="w-5 h-5" />
                <span className="text-sm font-medium uppercase">{language}</span>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-[#e0e0e0] py-1 z-50">
                    {languages.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => {
                                setLanguage(lang.code);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-[#fcf7f1] transition-colors ${language === lang.code ? 'text-[#d97757] font-medium' : 'text-[#383838]'
                                }`}
                        >
                            {lang.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LanguageSwitcher;
