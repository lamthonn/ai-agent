// Spending limits for Claude API usage, in US dollars or in tokens. Kept in localStorage in the prototype;
// the backend owns them later (the worker checks them before a job starts and between nodes).
import { useSyncExternalStore } from 'react';
import { jobs, NOW } from './sample';
import { getLang, tr } from '../i18n';

export type BudgetAction = 'queue' | 'pause' | 'warn';
export type BudgetUnit = 'usd' | 'tokens';
export interface Budget {
  enabled: boolean;
  unit: BudgetUnit;          // what every limit below is counted in
  daily: number;             // per day for the whole workspace
  perJob: number;            // a job that reaches it stops at the next node and waits for approval
  warnAt: number;            // 0–1 share of the daily limit that raises a warning
  action: BudgetAction;      // what happens when the daily limit is reached
  projects: Record<string, number | null>; // optional per-project daily limit
  notify: string;            // comma-separated emails
}

/** Blended price used to show the other unit (input + output, Sonnet-heavy mix). Opus costs more per token. */
export const USD_PER_MTOK = 3.6;
export const toTokens = (usd: number) => (usd / USD_PER_MTOK) * 1_000_000;
export const toUsd = (tokens: number) => (tokens / 1_000_000) * USD_PER_MTOK;

// v2: the default moved to $1/day (Claude Pro, $20/month); a saved v1 config is not carried over
const KEY = 'codesloop.budget.v2';
export const defaultBudget: Budget = {
  enabled: true, unit: 'usd', daily: 1, perJob: 0.5, warnAt: 0.8, action: 'queue',
  projects: { qlkho: null, web: null }, notify: 'minhanh@codes.tech',
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
const todays = (project?: string) => jobs.filter((j) => j.start >= today && (!project || j.project === project));
/** Spend so far today in USD. */
export const spentToday = (project?: string) => round2(todays(project).reduce((a, j) => a + j.cost, 0));
/** Tokens used so far today. */
export const tokensToday = (project?: string) => todays(project).reduce((a, j) => a + j.tokens, 0);
/** Today's use in the budget's own unit. */
export const usedToday = (b: Budget, project?: string) => (b.unit === 'usd' ? spentToday(project) : tokensToday(project));
/** A job's use in the budget's unit. */
export const jobUse = (b: Budget, j: { cost: number; tokens: number }) => (b.unit === 'usd' ? j.cost : j.tokens);

const nf = (o: Intl.NumberFormatOptions) => new Intl.NumberFormat(getLang() === 'en' ? 'en-GB' : 'vi-VN', o);
export const fmtUsd = (v: number) => '$' + nf({ minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
/** 7 120 000 → "7,12 tr token" / "7.12M tokens" */
export const fmtTokens = (v: number) => {
  const m = v / 1_000_000;
  if (m >= 1) return tr(`${nf({ maximumFractionDigits: 2 }).format(m)} tr token`, `${nf({ maximumFractionDigits: 2 }).format(m)}M tokens`);
  return tr(`${nf({ maximumFractionDigits: 0 }).format(v / 1000)}k token`, `${nf({ maximumFractionDigits: 0 }).format(v / 1000)}k tokens`);
};
/** Format an amount in the budget's unit. */
export const fmtAmount = (b: Budget, v: number) => (b.unit === 'usd' ? fmtUsd(v) : fmtTokens(v));
/** The same amount in the other unit, as a hint ("≈ 6,94 tr token"). */
export const fmtOther = (b: Budget, v: number) => '≈ ' + (b.unit === 'usd' ? fmtTokens(toTokens(v)) : fmtUsd(toUsd(v)));

/** Convert every limit when the unit changes, rounded to a figure a person would type. */
export function convertUnit(b: Budget, unit: BudgetUnit): Budget {
  if (unit === b.unit) return b;
  const conv = (v: number) => (unit === 'tokens' ? Math.round(toTokens(v) / 100_000) * 100_000 : Math.round(toUsd(v) * 2) / 2);
  return { ...b, unit, daily: conv(b.daily), perJob: conv(b.perJob), projects: Object.fromEntries(Object.entries(b.projects).map(([k, v]) => [k, v == null ? null : conv(v)])) };
}

/** Where today's use stands against a limit. */
export function budgetState(used: number, limit: number, warnAt: number): 'ok' | 'warn' | 'over' {
  if (used >= limit) return 'over';
  if (used >= limit * warnAt) return 'warn';
  return 'ok';
}
