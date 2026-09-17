/**
 * i18n 配置 - 14 种语言
 *
 * 语言列表(four.meme 对标):
 *   en   - English
 *   fr   - Français
 *   de   - Deutsch
 *   pt   - Português
 *   es   - Español
 *   ko   - 한국어
 *   th   - ไทย
 *   ja   - 日本語
 *   zh-CN - 简体中文
 *   zh-TW - 繁體中文
 *   ar   - العربية
 *   ru   - Русский
 *   vi   - Tiếng Việt
 *   hi   - हिन्दी
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import fr from './locales/fr.json'
import de from './locales/de.json'
import pt from './locales/pt.json'
import es from './locales/es.json'
import ko from './locales/ko.json'
import th from './locales/th.json'
import ja from './locales/ja.json'
import zhCN from './locales/zh-CN.json'
import zhTW from './locales/zh-TW.json'
import ar from './locales/ar.json'
import ru from './locales/ru.json'
import vi from './locales/vi.json'
import hi from './locales/hi.json'
import docsEN from './locales/docs.en.json'
import docsZH from './locales/docs.zh-CN.json'

// 把 docs 注入每个语言包的中文覆盖,其他 fallback 到英文
function withDocs(base: any, docsOverlay: any = {}) {
  return {
    ...base,
    docs: { ...(base.docs || {}), ...(docsOverlay || {}) },
  }
}

// ⚠️ LANGUAGES 必须先定义(后面 VALID_LANG_CODES 引用它)
export const LANGUAGES = [
  { code: 'en',    label: 'English',        native: 'English',        flag: '🇬🇧' },
  { code: 'zh-CN', label: '简体中文',         native: '简体中文',         flag: '🇨🇳' },
  { code: 'zh-TW', label: '繁體中文',         native: '繁體中文',         flag: '🇭🇰' },
  { code: 'ja',    label: '日本語',           native: '日本語',           flag: '🇯🇵' },
  { code: 'ko',    label: '한국어',           native: '한국어',           flag: '🇰🇷' },
  { code: 'th',    label: 'ภาษาไทย',          native: 'ภาษาไทย',          flag: '🇹🇭' },
  { code: 'vi',    label: 'Tiếng Việt',     native: 'Tiếng Việt',     flag: '🇻🇳' },
  { code: 'hi',    label: 'हिन्दी',            native: 'हिन्दी',            flag: '🇮🇳' },
  { code: 'es',    label: 'Español',         native: 'Español',         flag: '🇪🇸' },
  { code: 'pt',    label: 'Português',      native: 'Português',      flag: '🇧🇷' },
  { code: 'fr',    label: 'Français',       native: 'Français',       flag: '🇫🇷' },
  { code: 'de',    label: 'Deutsch',         native: 'Deutsch',         flag: '🇩🇪' },
  { code: 'ar',    label: 'العربية',           native: 'العربية',           flag: '🇸🇦', dir: 'rtl' },
  { code: 'ru',    label: 'Русский',         native: 'Русский',         flag: '🇷🇺' },
]

const resources = {
  en:    { translation: withDocs(en, docsEN) },
  fr:    { translation: withDocs(fr, docsEN) },
  de:    { translation: withDocs(de, docsEN) },
  pt:    { translation: withDocs(pt, docsEN) },
  es:    { translation: withDocs(es, docsEN) },
  ko:    { translation: withDocs(ko, docsEN) },
  th:    { translation: withDocs(th, docsEN) },
  ja:    { translation: withDocs(ja, docsEN) },
  'zh-CN': { translation: withDocs(zhCN, docsZH) },
  'zh-TW': { translation: withDocs(zhTW, docsZH) },
  ar:    { translation: withDocs(ar, docsEN) },
  ru:    { translation: withDocs(ru, docsEN) },
  vi:    { translation: withDocs(vi, docsEN) },
  hi:    { translation: withDocs(hi, docsEN) },
}

const VALID_LANG_CODES = LANGUAGES.map(l => l.code)
const savedLangRaw = localStorage.getItem('banana-lang') || 'zh-CN'
const savedLang = VALID_LANG_CODES.includes(savedLangRaw) ? savedLangRaw : 'zh-CN'

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLang,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  })

export function setLanguage(code: string) {
  localStorage.setItem('banana-lang', code)
  i18n.changeLanguage(code)
  // 更新 document lang + direction(阿拉伯语等 RTL 语言)
  document.documentElement.lang = code
  document.documentElement.dir = ['ar'].includes(code) ? 'rtl' : 'ltr'
}

export default i18n
