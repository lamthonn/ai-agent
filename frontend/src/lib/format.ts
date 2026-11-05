// Number and time formats used across the screens. One rule per metric: money 2 decimals, percentages 1, counts 0.
// They follow the chosen language (vi-VN or en-GB separators and words).
import { NOW } from '../data/sample';
import { getLang, tr } from '../i18n';

const nf = (o: Intl.NumberFormatOptions) => new Intl.NumberFormat(getLang() === 'en' ? 'en-GB' : 'vi-VN', o);
export const int = (v: number) => nf({ maximumFractionDigits: 0 }).format(v);
export const dec = (v: number, d = 1) => nf({ minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
export const pct = (v: number, d = 1) => nf({ style: 'percent', minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
export const usd = (v: number) => '$' + nf({ minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

export const duration = (min: number) => {
  if (min < 60) return tr(`${min} phút`, `${min} min`);
  const h = Math.floor(min / 60), m = min % 60;
  return m ? tr(`${h} giờ ${m} phút`, `${h} h ${m} min`) : tr(`${h} giờ`, `${h} h`);
};
export const clock = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
export const dayMonth = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
export const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
/** "2026-10-29" → "29/10/2026" */
export const isoDay = (s: string) => s.split('-').reverse().join('/');

/** "14:12" today, "Yesterday 16:40", or "03/11 09:15". */
export const when = (d: Date) => {
  if (sameDay(d, NOW)) return clock(d);
  const y = new Date(NOW); y.setDate(y.getDate() - 1);
  if (sameDay(d, y)) return `${tr('Hôm qua', 'Yesterday')} ${clock(d)}`;
  return `${dayMonth(d)} ${clock(d)}`;
};
/** Minutes between d and the prototype's clock. */
export const minutesAgo = (d: Date) => Math.round((NOW.getTime() - d.getTime()) / 60_000);
export const ago = (d: Date) => tr(`${duration(minutesAgo(d))} trước`, `${duration(minutesAgo(d))} ago`);
