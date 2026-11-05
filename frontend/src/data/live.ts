// Loads what the backend holds and puts it where the screens already read it (the arrays and maps in sample.ts,
// workflows.ts, access.ts, budget.ts). Screens keep reading those; this file refills them from the API and
// tells React to render again. Polling keeps them current while someone is signed in.
import { useSyncExternalStore } from 'react';
import { message } from 'antd';
import { api, setToken, utc } from '../lib/api';
import { agents, allJobs, approvals, jobById, jobs, NOW, people, projectById, projects, workers } from './sample';
import { versionOf, workflowById, workflows } from './workflows';
import { loadAccess, sink, type Account } from './access';
import { budgetSink, defaultBudget, loadBudget, toTokens, toUsd, type Budget } from './budget';
import type { Agent, Approval, Job, Person, Project, StepId, TraceStep } from './types';

interface ApiJobStep { nodeId: string; outcome: string; tokens: number; note?: string; at: string }
interface ApiJob {
  id: string; title: string; projectId: string; workflowId: string; workflowVersion: number; createdById: string; createdByName: string; status: Job['status'];
  failReason: string | null; branch: string | null; createdAt: string; startedAt: string | null; endedAt: string | null; tokens: number; cost: number; steps: ApiJobStep[];
}
interface ApiApproval { id: number; jobId: string; kind: 'plan' | 'merge'; status: Approval['status']; requestedAt: string; decidedById: string | null; decidedAt: string | null; canApprove: boolean }

const hue = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
const initials = (name: string) => name.trim().split(/\s+/).slice(-2).map((w) => w[0]).join('').toUpperCase();
const person = (id: string, name: string, isAdmin = false): Person => ({ id, name, short: initials(name), hue: hue(id), role: { vi: isAdmin ? 'Admin' : 'Thành viên', en: isAdmin ? 'Admin' : 'Member' } });
const aprId = (n: number) => `APR-${String(n).padStart(4, '0')}`;
export const aprNumber = (id: string) => Number(id.slice(4));

const replace = <T,>(target: T[], next: T[]) => { target.splice(0, target.length, ...next); };
const replaceRec = <T,>(target: Record<string, T>, next: T[], key: (t: T) => string) => { for (const k of Object.keys(target)) delete target[k]; for (const t of next) target[key(t)] = t; };

/** The step a job moves to after `last` reported: the workflows' own branches, written once. */
function nextStep(last: ApiJobStep, order: StepId[]): StepId | undefined {
  const ok = last.note === 'true';
  if (last.nodeId === 'build_ok') return ok ? 'review' : 'fix';
  if (last.nodeId === 'review_ok') return ok ? 'approve_merge' : 'fix';
  if (last.nodeId === 'fix') return 'build_test';
  const i = order.indexOf(last.nodeId as StepId);
  return i >= 0 ? order[i + 1] : undefined;
}

function buildTrace(j: ApiJob): TraceStep[] {
  const order = versionOf(j.workflowId, j.workflowVersion).steps;
  const start = utc(j.startedAt ?? j.createdAt)!.getTime();
  const trace: TraceStep[] = order.map((step) => ({ step, state: 'pending', min: 0 }));
  let prev = start, afterWait = false;
  for (const s of j.steps) {
    const at = utc(s.at)!.getTime();
    const t = trace.find((x) => x.step === s.nodeId);
    if (t) {
      t.state = s.outcome === 'failed' ? 'failed' : s.outcome === 'waiting' ? 'waiting' : 'done';
      if (s.nodeId === 'fix') t.rounds = (t.rounds ?? 0) + 1;
      if (!afterWait && !['approve_plan', 'approve_merge'].includes(s.nodeId)) t.min += Math.max(0, Math.round((at - prev) / 60_000));
    }
    afterWait = s.outcome === 'waiting';     // the time until the next report includes a person's wait: not counted
    prev = at;
  }
  const waiting = trace.find((t) => t.state === 'waiting');
  if (waiting && j.status !== 'approval') waiting.state = 'done';
  const fix = trace.find((t) => t.step === 'fix');
  if (fix && !fix.rounds) fix.state = j.status === 'succeeded' ? 'skipped' : 'pending';
  if (j.status === 'running') {
    const last = j.steps[j.steps.length - 1];
    const cur = trace.find((t) => t.step === (last ? nextStep(last, order) : order[0]));
    if (cur && cur.state !== 'failed') cur.state = 'running';
  }
  return trace;
}

function toJob(j: ApiJob, pending: Map<string, ApiApproval>): Job {
  const trace = buildTrace(j);
  const p = pending.get(j.id);
  const start = utc(j.startedAt ?? j.createdAt)!;
  const reason = j.failReason ?? '';
  return {
    id: j.id, title: j.title, project: j.projectId, by: j.createdById, status: j.status, start, end: utc(j.endedAt),
    workflowId: j.workflowId, workflowVersion: j.workflowVersion, trace,
    fix: trace.find((t) => t.step === 'fix')?.rounds ?? 0, minutes: trace.reduce((a, t) => a + t.min, 0), tokens: j.tokens, cost: Math.round(j.cost * 100) / 100,
    branch: j.branch ?? '—', approval: p?.kind, waitingSince: p ? utc(p.requestedAt)! : undefined,
    note: reason ? { vi: reason, en: reason } : undefined,
  };
}

let version = 0, loaded = false, loadedFor: string | null = null;
const listeners = new Set<() => void>();
const bump = () => { version++; listeners.forEach((l) => l()); };
/** Changes every time fresh data arrives; reading it re-renders the screen. */
export const useLive = () => useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => version, () => version);
export const isLoaded = () => loaded;

const roleOf = Object.fromEntries(agents.map((a) => [a.id, a.role]));
const allWorkflows = [...workflows];

export async function loadAll(): Promise<void> {
  const me = await api<{ id: string; name: string; email: string; isAdmin: boolean; projects: string[] }>('/me');
  const [rawProjects, rawAgents, rawFlows, rawJobs, rawApprovals, rawBudget, rawRules, rawAccounts] = await Promise.all([
    api<{ id: string; name: string; repo: string; baseBranch: string; stack: string; buildCommand: string; testCommand: string; defaultWorkflowId: string }[]>('/projects'),
    api<{ id: string; name: string; model: string; maxTurns: number; permission: Agent['perm']; toolsJson: string; prompt: string }[]>('/agents'),
    api<{ id: string; latest: number; versions: { version: number; note: string; createdById: string; createdByName: string; createdAt: string }[] }[]>('/workflows'),
    api<ApiJob[]>('/jobs'),
    api<ApiApproval[]>('/approvals'),
    api<{ enabled: boolean; unit: Budget['unit']; dailyTokens: number; perJobTokens: number; warnAt: number; action: Budget['action']; notify: string }>('/settings/budget'),
    api<{ noSelfApprove: boolean }>('/settings/rules'),
    me.isAdmin ? api<{ id: string; name: string; email: string; isAdmin: boolean; active: boolean; projects: string[] }[]>('/accounts') : Promise.resolve(null),
  ]);

  NOW.setTime(Date.now());

  // workflows: keep the layouts the builder knows, but only the flows and versions the backend really has
  const have = new Map(rawFlows.map((f) => [f.id, new Map(f.versions.map((v) => [v.version, v]))]));
  replace(workflows, allWorkflows.filter((w) => have.has(w.id)).map((w) => ({ ...w, versions: w.versions.filter((v) => have.get(w.id)!.has(v.version))
    .map((v) => { const r = have.get(w.id)!.get(v.version)!; return { ...v, by: r.createdById, date: r.createdAt.slice(0, 10), note: { vi: r.note, en: r.note } }; }) })).filter((w) => w.versions.length));
  replaceRec(workflowById, workflows, (w) => w.id);

  // people and accounts
  const accounts: Account[] = rawAccounts
    ? rawAccounts.map((a) => ({ id: a.id, name: a.name, email: a.email, short: initials(a.name), hue: hue(a.id), role: a.isAdmin ? 'admin' : 'member', projects: a.projects, active: a.active, lastSeen: '—' }))
    : [{ id: me.id, name: me.name, email: me.email, short: initials(me.name), hue: hue(me.id), role: 'member', projects: me.projects, active: true, lastSeen: '—' }];
  for (const k of Object.keys(people)) delete people[k];
  for (const a of accounts) people[a.id] = person(a.id, a.name, a.role === 'admin');
  for (const j of rawJobs) if (!people[j.createdById]) people[j.createdById] = person(j.createdById, j.createdByName);
  for (const f of rawFlows) for (const v of f.versions) if (!people[v.createdById]) people[v.createdById] = person(v.createdById, v.createdByName);
  loadAccess(accounts, me.id, rawRules);

  const ownerOf = (id: string) => accounts.find((a) => a.role === 'member' && a.projects.includes(id))?.id ?? me.id;
  const ps: Project[] = rawProjects.map((p) => ({ id: p.id, name: p.name, repo: p.repo, branch: p.baseBranch, stack: p.stack, build: p.buildCommand, test: p.testCommand, owner: ownerOf(p.id), defaultWorkflow: p.defaultWorkflowId }));
  replace(projects, ps); replaceRec(projectById, ps, (p) => p.id);

  replace(agents, rawAgents.map((a) => ({ id: a.id, name: a.name, role: roleOf[a.id] ?? { vi: '', en: '' }, model: a.model, perm: a.permission, tools: JSON.parse(a.toolsJson), maxTurns: a.maxTurns, prompt: a.prompt })));

  const pendingByJob = new Map(rawApprovals.filter((a) => a.status === 'pending').map((a) => [a.jobId, a]));
  const js = rawJobs.map((j) => toJob(j, pendingByJob));
  replace(jobs, js); replace(allJobs, js); replaceRec(jobById, js, (j) => j.id);
  replace(approvals, rawApprovals.map((a) => ({ id: aprId(a.id), job: a.jobId, kind: a.kind, requested: utc(a.requestedAt)!, status: a.status, by: a.decidedById ?? undefined, decided: utc(a.decidedAt) ?? undefined, canApprove: a.canApprove })));
  replace(workers, []);   // sandboxes arrive with the Docker milestone

  const usd = rawBudget.unit === 'usd';
  loadBudget({ ...defaultBudget, enabled: rawBudget.enabled, unit: rawBudget.unit, daily: usd ? Math.round(toUsd(rawBudget.dailyTokens) * 100) / 100 : rawBudget.dailyTokens,
    perJob: usd ? Math.round(toUsd(rawBudget.perJobTokens) * 100) / 100 : rawBudget.perJobTokens, warnAt: rawBudget.warnAt, action: rawBudget.action, notify: rawBudget.notify,
    projects: Object.fromEntries(ps.map((p) => [p.id, null])) });

  loaded = true; loadedFor = me.id;
  bump();
}

/** Refreshes now (after the user did something). Errors are shown, not thrown. */
export async function refresh() {
  try { await loadAll(); } catch (e) { message.error((e as Error).message); }
}

export async function signIn(email: string, password: string) {
  const r = await api<{ token: string }>('/auth/login', { method: 'POST', body: { email, password } });
  setToken(r.token);
  await loadAll();
}
export function signOut() { setToken(null); loaded = false; loadedFor = null; bump(); }
export const signedInAs = () => loadedFor;

// What the screens change goes back to the server.
sink.rules = (r) => { api('/settings/rules', { method: 'PUT', body: r }).then(() => refresh()).catch((e) => { message.error(e.message); void refresh(); }); };
budgetSink.save = (b) => {
  const usd = b.unit === 'usd';
  api('/settings/budget', { method: 'PUT', body: { enabled: b.enabled, unit: b.unit, dailyTokens: Math.round(usd ? toTokens(b.daily) : b.daily), perJobTokens: Math.round(usd ? toTokens(b.perJob) : b.perJob),
    warnAt: b.warnAt, action: b.action, notify: b.notify } }).then(() => refresh()).catch((e) => { message.error(e.message); void refresh(); });
};
sink.account = async (a, isNew) => {
  try {
    let password: string | undefined;
    if (isNew) {
      password = Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
      await api('/accounts', { method: 'POST', body: { name: a.name, email: a.email, password, isAdmin: a.role === 'admin', projects: a.role === 'admin' ? [] : a.projects } });
    } else await api(`/accounts/${a.id}`, { method: 'PUT', body: { name: a.name, isAdmin: a.role === 'admin', active: a.active, projects: a.projects } });
    await refresh();
    return password;
  } catch (e) { message.error((e as Error).message); await refresh(); return undefined; }
};

/** Polls while signed in. Returns the stop function. */
export function startPolling(everyMs = 4000) {
  const id = setInterval(() => { if (!document.hidden) loadAll().catch(() => { /* the next tick tries again; a 401 already signed out */ }); }, everyMs);
  return () => clearInterval(id);
}
