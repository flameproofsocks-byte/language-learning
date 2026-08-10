// User preference storage via localStorage.
// Currently holds one setting: familiarity (0–100), which controls sentence difficulty.
// A value of 70 means "mostly familiar words with some new ones" (the default).

export interface UserSettings {
  familiarity: number  // 0–100: 0 = mostly new words, 100 = mostly known words
}

const DEFAULTS: UserSettings = { familiarity: 70 }

export function getSettings(): UserSettings {
  if (typeof window === 'undefined') return { ...DEFAULTS }
  try {
    const raw = localStorage.getItem('langlearn_settings')
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {}
  return { ...DEFAULTS }
}

export function saveSettings(s: UserSettings): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('langlearn_settings', JSON.stringify(s))
}
