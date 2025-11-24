# Internationalization Support

I have added language switching support to the application.

## Changes

### 1. Internationalization Infrastructure
- Created `src/i18n/translations.ts`: Contains translation dictionaries for English (en), Chinese (zh), French (fr), Spanish (es), German (de), and Thai (th).
- Created `src/i18n/LanguageContext.tsx`: A React Context to manage the current language state and provide the `t` translation function.
- Wrapped the application in `LanguageProvider` in `index.tsx`.

### 2. Language Switcher UI
- Created `src/components/LanguageSwitcher.tsx`: A dropdown component in the header to allow users to select their preferred language.

### 3. Component Updates
- Updated `App.tsx` to include the `LanguageSwitcher` and translate the header and main application text.
- Updated the following components to use the `useTranslation` hook:
    - `components/UploadZone.tsx`
    - `components/StampControls.tsx`
    - `components/LayoutControls.tsx`
    - `components/ProcessingControls.tsx`
    - `components/GroupControls.tsx`
    - `components/PreviewArea.tsx`

## Verification
- The application should now display a language switcher in the top right corner.
- Selecting a language should instantly update all text in the application to the selected language.
- All functional text, including tooltips and dynamic messages, should be translated.
