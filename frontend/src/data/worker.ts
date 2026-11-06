// Is a worker connected, and to which Claude? The worker reports every 10 seconds; the server says "online" when the last report is under 45 s old.
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export interface WorkerInfo {
  host: string; version: string | null; claudeInstalled: boolean; claudeLoggedIn: boolean; claudeVersion: string | null;
  claudeEmail: string | null; claudeOrg: string | null; claudePlan: string | null; claudeError: string | null; currentJob: string | null; googleKey: boolean;
}
export interface WorkerState { online: boolean; seenAt: string | null; info: WorkerInfo | null; runningJobs: number }

export function useWorker() {
  const [state, setState] = useState<WorkerState | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => api<WorkerState>('/worker').then((s) => live && setState(s)).catch(() => undefined);
    void load();
    const t = setInterval(load, 5000);
    return () => { live = false; clearInterval(t); };
  }, []);
  return state;
}
