import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import en from './locales/en.json';
import ru from './locales/ru.json';

const SUPPORTED_LANGUAGES = ['ru', 'en'] as const;

const detectLanguage = (): string => {
  const locales = Localization.getLocales?.() ?? [];
  const languageCode = locales[0]?.languageCode || 'ru';
  return SUPPORTED_LANGUAGES.includes(languageCode as (typeof SUPPORTED_LANGUAGES)[number])
    ? languageCode
    : 'ru';
};

const isTest = process.env.NODE_ENV === 'test';
const initialLanguage = isTest ? 'ru' : detectLanguage();

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ru: { translation: ru },
  },
  lng: initialLanguage,
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
});

export default i18n;

const getLanguageCode = () => (i18n.resolvedLanguage || i18n.language || 'ru').toLowerCase();

export const getDateLocale = (): string => {
  const lang = getLanguageCode();
  return lang.startsWith('en') ? 'en-US' : 'ru-RU';
};

export const formatShortDate = (date: Date): string => {
  const locale = getDateLocale();
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(date);
};

export const getDayLabel = (dayId: string): string => {
  const key = `days.${dayId}Short`;
  return i18n.exists(key) ? i18n.t(key) : dayId;
};

export const getCategoryLabel = (category: string): string => {
  const key = `categories.${category}`;
  return i18n.exists(key) ? i18n.t(key) : category;
};
