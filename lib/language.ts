// Central registry for supported languages.
// To add a new language: extend the Language union, LANGUAGE_NAMES, and LANGUAGE_FLAGS,
// then add word/sentence data and update lib/language-data.ts and app/page.tsx.

// Language = the word-list language (i.e., the language whose data file is loaded).
export type Language = 'es' | 'zh' | 'id'

export const LANGUAGE_NAMES: Record<Language, string> = {
  es: 'Spanish',
  zh: 'Mandarin',
  id: 'Indonesian',
}

export const LANGUAGE_FLAGS: Record<Language, string> = {
  es: '🇪🇸',
  zh: '🇨🇳',
  id: '🇮🇩',
}

const STORAGE_KEY = 'langlearn_language'

export function getStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'es'
  return (localStorage.getItem(STORAGE_KEY) as Language) ?? 'es'
}

export function setStoredLanguage(lang: Language): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, lang)
}

// ── Source language ──────────────────────────────────────────────────────────
// SourceLanguage = the language the user already speaks (their native language).
// When source !== 'en', games run in reversed mode: native-language prompt → type target.
// Currently only English ↔ Indonesian reversal is supported (the only available word pair).

export type SourceLanguage = 'en' | 'id'

export const SOURCE_LANGUAGE_NAMES: Record<SourceLanguage, string> = {
  en: 'English',
  id: 'Indonesian',
}

export const SOURCE_LANGUAGE_FLAGS: Record<SourceLanguage, string> = {
  en: '🇬🇧',
  id: '🇮🇩',
}

const SOURCE_STORAGE_KEY = 'langlearn_source_language'

export function getStoredSourceLanguage(): SourceLanguage {
  if (typeof window === 'undefined') return 'en'
  return (localStorage.getItem(SOURCE_STORAGE_KEY) as SourceLanguage) ?? 'en'
}

export function setStoredSourceLanguage(lang: SourceLanguage): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(SOURCE_STORAGE_KEY, lang)
}
