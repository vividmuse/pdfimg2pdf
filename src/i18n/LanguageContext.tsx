import React, { createContext, useContext, useState, ReactNode } from 'react';
import { translations, Language } from './translations';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [language, setLanguage] = useState<Language>('en');

    const t = (key: string, params?: Record<string, string | number>): string => {
        const langTranslations = translations[language];
        let text = langTranslations[key] || translations['en'][key] || key;

        if (params) {
            Object.entries(params).forEach(([paramKey, paramValue]) => {
                text = text.replace(`{${paramKey}}`, String(paramValue));
            });
        }

        return text;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useTranslation = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useTranslation must be used within a LanguageProvider');
    }
    return context;
};
