// Accounts and project access. An admin sees every project, manages members and grants access;
// a member sees, runs and approves jobs only in the projects granted to them.
// Kept in localStorage in the prototype; the backend owns it later (and checks it on every API call).
import { useSyncExternalStore } from 'react';
import { projects } from './sample';
import { tr } from '../i18n';

export type Role = 'admin' | 'member';
export interface Account { id: string; name: string; email: string; short: string; hue: number; role: Role; projects: string[]; active: boolean; lastSeen: string }
interface State { accounts: Account[]; current: string }

const KEY = 'codesloop.access';
const initial: State = {
  current: 'ma',
  accounts: [
    { id: 'ma', name: 'Nguyễn Minh Anh', email: 'minhanh@codes.tech', short: 'MA', hue: 190, role: 'admin', projects: [], active: true, lastSeen: '2026-11-05 14:18' },
    { id: 'tq', name: 'Trần Quốc Huy', email: 'quochuy@codes.tech', short: 'QH', hue: 30, role: 'member', projects: ['qlkho', 'hddt'], active: true, lastSeen: '2026-11-05 14:12' },
    { id: 'lt', name: 'Lê Thu Trang', email: 'thutrang@codes.tech', short: 'TT', hue: 320, role: 'member', projects: ['web'], active: true, lastSeen: '2026-11-05 12:40' },
    { id: 'pd', name: 'Phạm Văn Đức', email: 'vanduc@codes.tech', short: 'VĐ', hue: 110, role: 'member', projects: ['runtime', 'qlkho'], active: true, lastSeen: '2026-11-04 17:05' },
    { id: 'hn', name: 'Hoàng Ngọc Hà', email: 'ngocha@codes.tech', short: 'NH', hue: 260, role: 'member', projects: [], active: false, lastSeen: '—' },
  ],
};

let state: State = (() => {
  let s = initial;
  try { const raw = localStorage.getItem(KEY); if (raw) s = JSON.parse(raw) as State; } catch { /* use the sample */ }
  // prototype only: ?as=lt opens the app as that account, without saving the choice
  const as = new URLSearchParams(location.search).get('as');
  return as && s.accounts.some((a) => a.id === as) ? { ...s, current: as } : s;
})();
const listeners = new Set<() => void>();
function commit(next: State) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* keep for this session */ }
  listeners.forEach((l) => l());
}
export function useAccess() {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => state, () => state);
}
export const getAccess = () => state;

export const isAdmin = (a?: Account) => a?.role === 'admin';
/** Projects an account can open: all for an admin, the granted ones for a member, none when deactivated. */
export const projectsOf = (a?: Account) => (!a || !a.active ? [] : a.role === 'admin' ? projects.map((p) => p.id) : a.projects);
export const canSee = (a: Account | undefined, project: string) => projectsOf(a).includes(project);
/** Anyone with access to the project may approve its jobs. */
export const canApprove = canSee;
/** Everyone who can approve a project's jobs. */
export const approversOf = (project: string) => state.accounts.filter((a) => canApprove(a, project));

export function currentAccount(s: State = state) { return s.accounts.find((a) => a.id === s.current) ?? s.accounts[0]; }
export function switchAccount(id: string) { commit({ ...state, current: id }); }
export function saveAccount(a: Account) {
  const exists = state.accounts.some((x) => x.id === a.id);
  commit({ ...state, accounts: exists ? state.accounts.map((x) => (x.id === a.id ? a : x)) : [...state.accounts, a] });
}
export function removeAccount(id: string) { commit({ ...state, accounts: state.accounts.filter((a) => a.id !== id) }); }
export function resetAccess() { commit(initial); }
/** At least one active admin must remain, or nobody can grant access again. */
export const activeAdmins = (accounts = state.accounts) => accounts.filter((a) => a.role === 'admin' && a.active).length;

/** The signed-in account (switchable in the prototype). */
export const useMe = () => currentAccount(useAccess());
/** Label for an approval node's approver setting. */
export const approverLabel = (v?: string) => (v === 'admin' ? 'Admin' : v === 'project' ? tr('Thành viên của project', 'Project members') : v ?? '');
