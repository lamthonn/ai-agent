// Integrations > Google Sheets. Question: "Which rows of our sheet are ready for an agent, and what is on the reference list?"
// Tabs: the work items (rows read from the task sheet, triaged), the checklist, and the two sheet links. All data comes from the API.
// The API still calls the two sheets "bug" and "case"; only the words on screen are general.
import { useState } from 'react';
import { App, Button, Input, InputNumber, Segmented, Select, Switch, Table, Tabs } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { projects } from '../data/sample';
import { refresh, useLive } from '../data/live';
import { workflowById, workflows } from '../data/workflows';
import { api } from '../lib/api';
import { bugFields, caseFields, useSources, type BugRow, type BugSource, type CaseRow, type SheetLink, type SourceData, type Triage } from '../data/sources';
import { canSee, isAdmin, useMe } from '../data/access';
import { Icon } from '../components/Icon';
import { when } from '../lib/format';
import { utc } from '../lib/api';
import { useTitle } from '../lib/useTitle';
import { tr, tx } from '../i18n';

const triageText = (t: Triage) => ({ new: tr('Đang phân loại', 'Triaging'), ready: tr('Sẵn sàng', 'Ready'), 'need-info': tr('Cần thêm thông tin', 'Needs info'), duplicate: tr('Trùng', 'Duplicate'), job: tr('Đã tạo job', 'Job created') })[t];
const triageTone = (t: Triage) => ({ new: '', ready: 'run', 'need-info': 'warn', duplicate: '', job: 'pos' })[t];
const sevText = (s: BugRow['severity']) => ({ high: tr('Cao', 'High'), medium: tr('Trung bình', 'Medium'), low: tr('Thấp', 'Low') })[s];
const cols = 'ABCDEFGHIJKLMNOP'.split('').map((c) => ({ value: c, label: tr(`Cột ${c}`, `Column ${c}`) }));
const lastSync = (l: SheetLink) => (l.lastSyncAt ? when(utc(l.lastSyncAt)!) : tr('chưa lần nào', 'never'));

export function Sources() {
  useTitle('Google Sheets');
  const { tab = 'items' } = useParams();
  const nav = useNavigate();
  const { message } = App.useApp();
  const me = useMe();
  useLive();
  const admin = isAdmin(me);
  const mine = projects.filter((p) => canSee(me, p.id));
  const [project, setProject] = useState(mine[0]?.id);
  const { data, error, reload } = useSources(project);
  const [busy, setBusy] = useState<number | null>(null);

  if (!project) return <div className="title-row"><div><h1>Google Sheets</h1><p className="sub">{tr('Bạn chưa được cấp quyền vào project nào.', 'You have no project access yet.')}</p></div></div>;

  const run = async (b: BugRow) => {
    setBusy(b.id);
    try {
      const r = await api<{ id: string }>(`/sources/${project}/bugs/${b.id}/run`, { method: 'POST', body: {} });
      message.success(tr(`Đã tạo ${r.id} từ ${b.key}`, `Created ${r.id} from ${b.key}`));
      await Promise.all([reload(), refresh()]);
    } catch (e) { message.error((e as Error).message); } finally { setBusy(null); }
  };
  const readNow = async () => {
    try { await api(`/sources/${project}/sync`, { method: 'POST', body: {} }); message.info(tr('Đã yêu cầu đọc lại. Worker sẽ đọc trong ít giây.', 'Re-read requested. The worker will read within seconds.')); }
    catch (e) { message.error((e as Error).message); }
  };

  const empty = (what: string) => (
    <div className="empty">
      <p>{tr(`Project này chưa gắn ${what}.`, `This project has no ${what} linked.`)}</p>
      <Button onClick={() => nav('/integrations/google-sheets/setup')}>{tr('Gắn bảng', 'Link a sheet')}</Button>
    </div>
  );
  const failed = (l: SheetLink) => l.lastError && <p className="finding bad">{tr('Lần đọc gần nhất lỗi: ', 'The last read failed: ')}{l.lastError}</p>;

  const bugs = data?.bugs ?? [];
  const cases = data?.cases ?? [];
  const ready = bugs.filter((b) => b.triage === 'ready').length;

  return (
    <>
      <div className="title-row">
        <div>
          <nav className="crumbs" aria-label="Breadcrumb"><Link to="/integrations">{tr('Tích hợp', 'Integrations')}</Link><Icon name="chevron" size={12} /><span>Google Sheets</span></nav>
          <h1>Google Sheets</h1>
          <p className="sub">{tr('Hệ thống đọc bảng công việc định kỳ, agent phân loại từng dòng, rồi tạo job chạy theo workflow bạn chọn.', 'The task sheet is read on a schedule, an agent triages each row, then a job runs through the workflow you choose.')}</p>
        </div>
        <div className="title-actions">
          <Select value={project} onChange={setProject} style={{ width: 200 }} options={mine.map((p) => ({ value: p.id, label: p.name }))} aria-label="Project" />
        </div>
      </div>
      <Tabs activeKey={tab} onChange={(k) => nav(`/integrations/google-sheets/${k}`)} items={[
        { key: 'items', label: <span>{tr('Công việc', 'Work items')} <span className="tab-count num">{bugs.length}</span></span> },
        { key: 'lists', label: <span>{tr('Danh sách kiểm tra', 'Checklist')} <span className="tab-count num">{cases.length}</span></span> },
        { key: 'setup', label: tr('Kết nối bảng', 'Sheet setup') },
      ]} />
      {error && <p className="finding bad">{error}</p>}
      {!data && !error && <p className="note">{tr('Đang tải…', 'Loading…')}</p>}

      {data && tab === 'items' && (!data.bug ? empty(tr('bảng công việc', 'a task sheet')) : <>
        <div className="filters">
          <span className="meta">{data.bug.mode === 'suggest' ? tr('Chế độ Chỉ đề xuất: bấm Chạy để tạo job.', 'Suggest only: press Run to create a job.') : tr(`Chế độ Tự chạy: tối đa ${data.bug.maxPerDay} job/ngày.`, `Auto: up to ${data.bug.maxPerDay} jobs a day.`)}</span>
          <span className="spacer" />
          <span className="meta num">{tr(`Đọc lúc ${lastSync(data.bug)} · ${ready} việc sẵn sàng`, `Read at ${lastSync(data.bug)} · ${ready} ready`)}</span>
          <Button onClick={readNow}>{tr('Đọc lại ngay', 'Read now')}</Button>
        </div>
        {failed(data.bug)}
        <Table<BugRow> rowKey="id" pagination={false} dataSource={bugs} scroll={{ x: 960 }} locale={{ emptyText: tr('Chưa có việc nào khớp bộ lọc. Worker đọc bảng mỗi 10 phút.', 'No item matches the filter yet. The worker reads the sheet every 10 minutes.') }} columns={[
          { title: tr('Công việc', 'Work item'), key: 'b', render: (_, b) => <><span className="mono">{b.key}</span> <span className="ink">{b.title}</span><span className="sub">{tr(`Dòng ${b.row} · ${b.reporter || '—'}`, `Row ${b.row} · ${b.reporter || '—'}`)}</span></> },
          { title: tr('Mức ưu tiên', 'Priority'), key: 's', width: 110, render: (_, b) => sevText(b.severity) },
          { title: tr('Agent phân loại', 'Triage'), key: 't', width: 340, render: (_, b) => <><span className={`pill ${triageTone(b.triage)}`}>{triageText(b.triage)}</span>{b.workflow && workflowById[b.workflow] && <span className="sub">→ {tx(workflowById[b.workflow].name)}</span>}{b.note && <span className="sub">{b.note}</span>}</> },
          { title: '', key: 'a', width: 130, align: 'right', render: (_, b) => b.jobId ? <Link to={`/jobs/${b.jobId}`} className="mono">{b.jobId}</Link>
            : b.triage === 'ready' ? <Button size="small" type="primary" loading={busy === b.id} icon={<Icon name="play" size={12} />} onClick={() => run(b)}>{tr('Chạy', 'Run')}</Button> : null },
        ]} />
        <p className="note">{data.bug.writeBack ? tr('Trạng thái và mã job được ghi ngược vào cột Trạng thái của bảng. Các bước cần duyệt trong workflow vẫn luôn chờ người duyệt.', 'Status and job ID are written back to the sheet’s Status column. Approval steps in the workflow always wait for a person.') : tr('Không ghi ngược vào bảng (đang tắt). Các bước cần duyệt trong workflow vẫn luôn chờ người duyệt.', 'Nothing is written back to the sheet (switched off). Approval steps in the workflow always wait for a person.')}</p>
      </>)}

      {data && tab === 'lists' && (!data.case ? empty(tr('danh sách kiểm tra', 'a checklist')) : <>
        <div className="filters">
          <span className="meta num">{tr(`${cases.length} mục · đọc lúc ${lastSync(data.case)}`, `${cases.length} items · read at ${lastSync(data.case)}`)}</span>
          <span className="spacer" />
          <Button onClick={readNow}>{tr('Đọc lại ngay', 'Read now')}</Button>
        </div>
        {failed(data.case)}
        <Table<CaseRow> rowKey="key" pagination={false} dataSource={cases} scroll={{ x: 760 }} columns={[
          { title: tr('Mục kiểm tra', 'Checklist item'), key: 'c', render: (_, c) => <><span className="mono">{c.key}</span> <span className="ink">{c.title}</span><span className="sub">{c.module}</span></> },
          { title: tr('Kết quả mong đợi', 'Expected'), key: 'e', render: (_, c) => c.expected },
          { title: tr('Số bước', 'Steps'), key: 'n', width: 90, align: 'right', className: 'num', render: (_, c) => c.steps },
        ]} />
        <p className="note">{tr('Hiện mới đọc và hiển thị danh sách. Để agent chạy từng mục cần một workflow kiểm thử chưa có trên server.', 'For now the list is only read and shown. Running each item with an agent needs a checklist workflow that the server does not have yet.')}</p>
      </>)}

      {data && tab === 'setup' && <Links key={project} project={project} admin={admin} data={data} onSaved={reload} />}
    </>
  );
}

const blank = (): BugSource => ({ url: '', tab: 'Sheet1', columns: {}, lastSyncAt: null, lastError: null, filter: 'Trạng thái = Mới', mode: 'suggest', autoWorkflow: 'quick-fix', maxPerDay: 1, writeBack: true });

function Links({ project, admin, data, onSaved }: { project: string; admin: boolean; data: SourceData; onSaved: () => Promise<void> }) {
  const { message } = App.useApp();
  const [bugs, setBugs] = useState<BugSource>(data.bug ?? blank());          // read once: the screen refreshes every few seconds and must not overwrite what you are typing
  const [cases, setCases] = useState<SheetLink>(data.case ?? blank());
  const [saving, setSaving] = useState<'bug' | 'case' | null>(null);
  const setB = (p: Partial<BugSource>) => setBugs((b) => ({ ...b, ...p }));
  const save = async (kind: 'bug' | 'case') => {
    setSaving(kind);
    try {
      const v = kind === 'bug' ? bugs : cases;
      await api(`/sources/${project}/${kind}`, { method: 'PUT', body: kind === 'bug' ? { url: v.url, tab: v.tab, columns: v.columns, filter: bugs.filter, mode: bugs.mode, autoWorkflow: bugs.autoWorkflow, maxPerDay: bugs.maxPerDay, writeBack: bugs.writeBack } : { url: v.url, tab: v.tab, columns: v.columns } });
      message.success(tr('Đã lưu. Worker sẽ đọc file trong ít giây.', 'Saved. The worker will read the file within seconds.'));
      await onSaved();
    } catch (e) { message.error((e as Error).message); } finally { setSaving(null); }
  };
  const urlField = (id: string, v: SheetLink, set: (p: Partial<SheetLink>) => void) => (
    <div className="form-2">
      <div className="field"><label htmlFor={`${id}-url`}>{tr('Link Google Sheet', 'Google Sheet link')}</label><Input id={`${id}-url`} className="mono" value={v.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://docs.google.com/spreadsheets/d/…" /></div>
      <div className="field"><label htmlFor={`${id}-tab`}>{tr('Tên tab', 'Sheet tab')}</label><Input id={`${id}-tab`} value={v.tab} onChange={(e) => set({ tab: e.target.value })} /></div>
    </div>
  );
  const mapping = (fields: { key: string; label: { vi: string; en: string } }[], v: SheetLink, set: (p: Partial<SheetLink>) => void) => (
    <table className="plain">
      <thead><tr><th>{tr('Thông tin', 'Field')}</th><th>{tr('Lấy từ', 'Read from')}</th></tr></thead>
      <tbody>{fields.map((f) => <tr key={f.key}><td className="ink">{tx(f.label)}</td><td><Select size="small" allowClear style={{ width: 130 }} placeholder={tr('Chưa chọn', 'Not set')} value={v.columns[f.key]} options={cols}
        onChange={(c) => set({ columns: Object.fromEntries(Object.entries({ ...v.columns, [f.key]: c }).filter(([, x]) => x)) })} aria-label={tx(f.label)} /></td></tr>)}</tbody>
    </table>
  );

  return (
    <fieldset disabled={!admin} className="props-fields">
      {!admin && <p className="note">{tr('Chỉ admin sửa được kết nối bảng.', 'Only an admin can change the sheet links.')}</p>}
      <section className="set-row">
        <div className="set-label">
          <h2>{tr('Bảng công việc', 'Task sheet')}</h2>
          <p>{tr('Mỗi dòng là một việc cần làm; dòng đầu là tiêu đề. Hệ thống đọc lại sau mỗi 10 phút; dòng đã đọc được nhận theo Mã nên không tạo job trùng.', 'One piece of work per row; the first row is the header. Read again every 10 minutes; rows are matched by ID, so no job is created twice.')}</p>
          {data.serviceAccount
            ? <p className="hint">{tr('Chia sẻ file cho', 'Share the file with')} <span className="mono">{data.serviceAccount}</span> {tr('(quyền sửa để ghi trạng thái ngược lại).', '(edit access, to write status back).')}</p>
            : <p className="hint">{tr('Worker chưa có khóa tài khoản dịch vụ Google: chỉ đọc được file bật “Bất kỳ ai có link”, và chưa ghi được trạng thái ngược vào file.', 'The worker has no Google service-account key: it can only read a file shared as “anyone with the link”, and cannot write status back.')}</p>}
          {data.bug?.lastError && <p className="finding bad">{data.bug.lastError}</p>}
        </div>
        <div className="set-panel">
          {urlField('bug', bugs, setB)}
          {mapping(bugFields, bugs, setB)}
          <div className="field"><label htmlFor="bug-filter">{tr('Chỉ lấy dòng', 'Only rows where')}</label><Input id="bug-filter" value={bugs.filter} onChange={(e) => setB({ filter: e.target.value })} placeholder="Trạng thái = Mới" /></div>
          <div className="field"><span className="label-like">{tr('Khi có việc sẵn sàng', 'When an item is ready')}</span>
            <Segmented value={bugs.mode} onChange={(m) => setB({ mode: m as BugSource['mode'] })} options={[{ value: 'suggest', label: tr('Chỉ đề xuất', 'Suggest only') }, { value: 'auto', label: tr('Tự chạy', 'Run automatically') }]} />
            <span className="hint">{bugs.mode === 'suggest' ? tr('Agent phân loại sẵn; người có quyền vào project bấm Chạy để tạo job.', 'The agent triages; someone with project access presses Run.') : tr('Việc sẵn sàng thành job ngay, trong giới hạn số job/ngày và hạn mức chi phí. Job vẫn dừng ở bước duyệt kế hoạch và duyệt merge.', 'Ready items become jobs at once, within the jobs-per-day cap and the cost limit. Jobs still stop at plan and merge approval.')}</span>
          </div>
          {bugs.mode === 'auto' && <div className="form-2">
            <div className="field"><label htmlFor="bug-wf">{tr('Workflow dùng khi tự chạy', 'Workflow for automatic runs')}</label><Select id="bug-wf" value={bugs.autoWorkflow} onChange={(w) => setB({ autoWorkflow: w })} options={workflows.filter((w) => w.id !== 'test-cases' && w.id !== 'review-only').map((w) => ({ value: w.id, label: tx(w.name) }))} /></div>
            <div className="field"><label htmlFor="bug-max">{tr('Tối đa job mỗi ngày', 'Max jobs a day')}</label><InputNumber id="bug-max" min={1} max={20} value={bugs.maxPerDay} onChange={(n) => setB({ maxPerDay: n ?? 1 })} style={{ width: '100%' }} /></div>
          </div>}
          <div className="switch-row"><div><div className="ink">{tr('Ghi kết quả vào bảng', 'Write results to the sheet')}</div><div className="hint">{tr('Cột Trạng thái: Đang xử lý / Chờ duyệt / Đã sửa / Không tự sửa được, kèm mã job.', 'Status column: In progress / Awaiting approval / Fixed / Could not fix, with the job ID.')}</div></div>
            <Switch checked={bugs.writeBack} onChange={(v) => setB({ writeBack: v })} aria-label={tr('Ghi kết quả vào bảng', 'Write results to the sheet')} /></div>
          <div className="form-actions"><Button type="primary" loading={saving === 'bug'} onClick={() => save('bug')}>{tr('Lưu', 'Save')}</Button></div>
        </div>
      </section>
      <section className="set-row">
        <div className="set-label">
          <h2>{tr('Danh sách kiểm tra', 'Checklist')}</h2>
          <p>{tr('Mỗi dòng là một mục; dòng đầu là tiêu đề.', 'One item per row; the first row is the header.')}</p>
          {data.case?.lastError && <p className="finding bad">{data.case.lastError}</p>}
        </div>
        <div className="set-panel">
          {urlField('case', cases, (p) => setCases((c) => ({ ...c, ...p })))}
          {mapping(caseFields, cases, (p) => setCases((c) => ({ ...c, ...p })))}
          <div className="form-actions"><Button type="primary" loading={saving === 'case'} onClick={() => save('case')}>{tr('Lưu', 'Save')}</Button></div>
        </div>
      </section>
    </fieldset>
  );
}
