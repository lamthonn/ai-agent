// Bug and test-case files linked to a project (Google Sheet). The worker reads the bug file every few minutes: each new row
// is triaged by an agent and either waits for a person to run it ("suggest") or becomes a job on its own ("auto").
// Status is written back to the sheet. Everything here comes from the API; nothing is kept in the browser.
import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Text } from '../i18n';

export type BugField = 'id' | 'title' | 'steps' | 'severity' | 'status' | 'reporter';
export type CaseField = 'id' | 'module' | 'title' | 'steps' | 'expected';
export interface SheetLink { url: string; tab: string; columns: Record<string, string>; lastSyncAt: string | null; lastError: string | null }
export interface BugSource extends SheetLink { filter: string; mode: 'suggest' | 'auto'; autoWorkflow: string; maxPerDay: number; writeBack: boolean }

export const bugFields: { key: BugField; label: Text }[] = [
  { key: 'id', label: { vi: 'Mã bug', en: 'Bug ID' } }, { key: 'title', label: { vi: 'Mô tả', en: 'Description' } },
  { key: 'steps', label: { vi: 'Bước tái hiện', en: 'Steps to reproduce' } }, { key: 'severity', label: { vi: 'Mức độ', en: 'Severity' } },
  { key: 'status', label: { vi: 'Trạng thái', en: 'Status' } }, { key: 'reporter', label: { vi: 'Người báo', en: 'Reporter' } },
];
export const caseFields: { key: CaseField; label: Text }[] = [
  { key: 'id', label: { vi: 'Mã test case', en: 'Case ID' } }, { key: 'module', label: { vi: 'Chức năng', en: 'Module' } },
  { key: 'title', label: { vi: 'Tên test case', en: 'Case title' } }, { key: 'steps', label: { vi: 'Các bước', en: 'Steps' } },
  { key: 'expected', label: { vi: 'Kết quả mong đợi', en: 'Expected result' } },
];

export type Triage = 'new' | 'ready' | 'need-info' | 'duplicate' | 'job';
export interface BugRow { id: number; key: string; row: number; title: string; severity: 'high' | 'medium' | 'low'; reporter: string; triage: Triage; workflow: string | null; note: string | null; jobId: string | null }
export interface CaseRow { key: string; module: string; title: string; expected: string; steps: number }
export interface SourceData { bug: BugSource | null; case: SheetLink | null; serviceAccount: string | null; bugs: BugRow[]; cases: CaseRow[] }

/** The project's linked files and their rows, refreshed every few seconds while the screen is open. */
export function useSources(project: string | undefined) {
  const [data, setData] = useState<SourceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!project) return;
    try { setData(await api<SourceData>(`/sources/${project}`)); setError(null); } catch (e) { setError((e as Error).message); }
  }, [project]);
  useEffect(() => { setData(null); void load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);
  return { data, error, reload: load };
}
