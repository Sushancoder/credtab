export type VoiceLang = 'en-IN' | 'hi-IN'

const KEY = 'voice_lang'
const DEFAULT: VoiceLang = 'en-IN'

export function getVoiceLang(): VoiceLang {
    if (typeof window === 'undefined') return DEFAULT
    const stored = localStorage.getItem(KEY)
    return (stored === 'hi-IN' || stored === 'en-IN') ? stored : DEFAULT
}

export function setVoiceLang(lang: VoiceLang): void {
    localStorage.setItem(KEY, lang)
}
