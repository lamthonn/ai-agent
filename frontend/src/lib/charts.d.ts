// Types for the vanilla charts.js (from the design-taste-frontend skill), which sets window.Charts.
/* eslint-disable @typescript-eslint/no-explicit-any */
export {};
declare global {
  interface Window {
    Charts: {
      line: (el: HTMLElement, opts: any) => any;
      bars: (el: HTMLElement, opts: any) => any;
      barList: (el: HTMLElement, rows: { label: string; value: number }[], opts?: any) => any;
      ring: (el: HTMLElement, opts: any) => any;
      fmt: Record<string, any>;
    };
  }
}
