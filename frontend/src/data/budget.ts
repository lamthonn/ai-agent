// Cost limits for Claude API usage. Kept in localStorage in the prototype; the backend owns them later
// (the worker checks them before a job starts and between nodes).
import { useSyncExternalStore } from 'react';
import { jobs, NOW } from './sample';

export type BudgetAction = 'queue' | 'pause' | 'warn';
export interface Budget {
  enabled: boolean;
  daily: number;            // USD per day for the whole workspace
  perJob: number;           // USD; a job that reaches it stops at the next node and waits for approval
  warnAt: number;           // 0–1 share of the daily limit that raises a warning
  action: BudgetAction;     // what happens when the daily limit is reached
  projects: Record<string, number | null>; // optional per-project daily limit
  notify: string;           // comma-separated emails
}

const KEY = 'codesloop.budget';
export const defaultBudget: Budget = {
  enabled: true, daily: 25, perJob: 4, warnAt: 0.8, action: 'queue',
  projects: { qlkho: 12, hddt: null, web: null, runtime: 5 }, notify: 'minhanh@codes.tech',
};

let state: Budget = (() => {
  try { const s = localStorage.getItem(KEY); return s ? { ...defaultBudget, ...JSON.parse(s) } : defaultBudget; } catch { return defaultBudget; }
})();
const listeners = new Set<() => void>();
export function saveBudget(next: Budget) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* keep for this session */ }
  listeners.forEach((l) => l());
}
export function useBudget() {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => state, () => state);
}

const today = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
const round2 = (v: number) => Math.round(v * 100) / 100;
/** Spend so far today, from the jobs that ran today. */
export const spentToday = (project?: string) => round2(jobs.filter((j) => j.start >= today && (!project || j.project === project)).reduce((a, j) => a + j.cost, 0));

/** Where today's spend stands against a limit. */
export function budgetState(spent: number, limit: number, warnAt: number): 'ok' | 'warn' | 'over' {
  if (spent >= limit) return 'over';
  if (spent >= limit * warnAt) return 'warn';
  return 'ok';
}
