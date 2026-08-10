// Central word-list router. Every page that needs the word list for the current language
// should import wordsFor() from here rather than importing all three word lists directly.
// To add a new language, import its word list and add a branch.

import type { Language } from './language'
import type { Word } from './words'
import { SPANISH_WORDS } from './words'
import { MANDARIN_WORDS } from './mandarin'
import { INDONESIAN_WORDS } from './indonesian'

export function wordsFor(lang: Language): Word[] {
  if (lang === 'zh') return MANDARIN_WORDS
  if (lang === 'id') return INDONESIAN_WORDS
  return SPANISH_WORDS
}
