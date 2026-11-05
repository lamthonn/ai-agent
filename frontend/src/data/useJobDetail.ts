// One job's detail: its requirement, the evidence an approver needs (plan, review, diff) and its log.
// Fetched on open and polled while the job is not finished.
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

export interface JobEvent { id: number; level: 'info' | 'warn' | 'error'; message: string; at: string }
export interface Evidence { analyze?: { text: string }; plan?: { text: string }; review?: { text: string; verdict?: string }; diff?: string; exit_code?: number }
export interface JobDetailData { requirement: string; context: Evidence | null; events: JobEvent[]; loading: boolean; notFound: boolean }

export function useJobDetail(id: string | undefined, status: string | undefined): JobDetailData {
  const [data, setData] = useState<Omit<JobDetailData, 'events'>>({ requirement: '', context: null, loading: true, notFound: false });
  const [events, setEvents] = useState<JobEvent[]>([]);
  const last = useRef(0);

  useEffect(() => { setEvents([]); last.current = 0; setData({ requirement: '', context: null, loading: true, notFound: false }); }, [id]);

  useEffect(() => {
    if (!id) return;
    let stop = false;
    const pull = async () => {
      try {
        const [d, ev] = await Promise.all([api<{ requirement: string; context: Evidence | null }>(`/jobs/${id}`), api<JobEvent[]>(`/jobs/${id}/events?after=${last.current}`)]);
        if (stop) return;
        setData({ requirement: d.requirement, context: d.context, loading: false, notFound: false });
        if (ev.length) { last.current = ev[ev.length - 1].id; setEvents((e) => [...e, ...ev]); }
      } catch { if (!stop) setData((s) => ({ ...s, loading: false, notFound: s.requirement === '' })); }
    };
    void pull();
    const t = setInterval(pull, 2500);
    return () => { stop = true; clearInterval(t); };
  }, [id, status]);

  return { ...data, events };
}
