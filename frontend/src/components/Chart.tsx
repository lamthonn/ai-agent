import { useEffect, useRef } from 'react';
import '../lib/charts.js';

type Kind = 'line' | 'bars' | 'barList';

/** Draws one chart from charts.js into a div; redraws when `opts` changes. */
export function Chart({ kind, opts, rows, label, height }: { kind: Kind; opts?: object; rows?: { label: string; value: number }[]; label: string; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const key = JSON.stringify({ kind, opts, rows });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const draw = () => {
      if (kind === 'barList') window.Charts.barList(el, rows ?? [], opts);
      else window.Charts[kind](el, { height, ...opts });
    };
    // labels are measured, so draw after the web font has loaded
    document.fonts?.ready.then(draw) ?? draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return <div ref={ref} className="chart" aria-label={label} />;
}
