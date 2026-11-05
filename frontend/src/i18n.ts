// Two languages, Vietnamese and English. Strings are written in place as tr('…vi…', '…en…'), so a screen reads
// in one file and a missing translation cannot happen. The choice is kept in localStorage.
import { useSyncExternalStore } from 'react';

export type Lang = 'vi' | 'en';
const KEY = 'codesloop.lang';
// ?lang=en in the URL wins (handy for sharing a link); otherwise the saved choice; Vietnamese by default.
const read = (): Lang => {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'en' || q === 'vi') return q;
  try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'vi'; } catch { return 'vi'; }
};

let lang: Lang = read();
const listeners = new Set<() => void>();

export const getLang = () => lang;
export function setLang(next: Lang) {
  lang = next;
  try { localStorage.setItem(KEY, next); } catch { /* private mode: keep it for this session only */ }
  document.documentElement.lang = next;
  listeners.forEach((l) => l());
}
export function useLang() {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, getLang, getLang);
}
/** Pick the string for the current language. */
export const tr = (vi: string, en: string) => (lang === 'en' ? en : vi);
/** A bilingual value kept in data. */
export type Text = { vi: string; en: string };
export const tx = (t: Text | string) => (typeof t === 'string' ? t : t[lang]);

document.documentElement.lang = lang;
