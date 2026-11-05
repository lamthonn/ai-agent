// Number and time formats used across the screens. One rule per metric: money 2 decimals, percentages 1, counts 0.
import { NOW } from '../data/sample';

const nf = (o: Intl.NumberFormatOptions) => new Intl.NumberFormat('vi-VN', o);
export const int = (v: number) => nf({ maximumFractionDigits: 0 }).format(v);
export const dec = (v: number, d = 1) => nf({ minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
export const pct = (v: number, d = 1) => nf({ style: 'percent', minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
export const usd = (v: number) => '$' + nf({ minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
export const compact = (v: number) => nf({ notation: 'compact', maximumFractionDigits: 1 }).format(v);

export const duration = (min: number) => {
  if (min < 60) return `${min} phút`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} giờ ${m} phút` : `${h} giờ`;
};
export const clock = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
export const dayMonth = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
export const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** "14:12" today, "Hôm qua 16:40", or "03/11 09:15". */
export const when = (d: Date) => {
  if (sameDay(d, NOW)) return clock(d);
  const y = new Date(NOW); y.setDate(y.getDate() - 1);
  if (sameDay(d, y)) return `Hôm qua ${clock(d)}`;
  return `${dayMonth(d)} ${clock(d)}`;
};
/** Minutes between d and the prototype's clock. */
export const minutesAgo = (d: Date) => Math.round((NOW.getTime() - d.getTime()) / 60_000);
export const ago = (d: Date) => `${duration(minutesAgo(d))} trước`;
