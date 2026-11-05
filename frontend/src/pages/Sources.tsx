// Bug & test case. Question: "Which bugs from our sheet are ready for an agent, and which test cases can we run?"
// Tabs: the bug inbox (rows read from the bug file, triaged), the test cases, and the two file links.
import { useState } from 'react';
import { App, Button, Input, InputNumber, Segmented, Select, Switch, Table, Tabs } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { projects } from '../data/sample';
import { workflowById, workflows } from '../data/workflows';
import { bugFields, bugRows, caseFields, caseRows, SERVICE_ACCOUNT, sources, type BugRow, type BugSource, type CaseRow, type SheetLink, type Triage } from '../data/sources';
import { canSee, isAdmin, useMe } from '../data/access';
import { Icon } from '../components/Icon';
import { useTitle } from '../lib/useTitle';
import { tr, tx } from '../i18n';

const triageText = (t: Triage) => ({ ready: tr('Sẵn sàng', 'Ready'), 'need-info': tr('Cần thêm thông tin', 'Needs info'), duplicate: tr('Trùng', 'Duplicate'), job: tr('Đã tạo job', 'Job created') })[t];
const triageTone = (t: Triage) => ({ ready: 'run', 'need-info': 'warn', duplicate: '', job: 'pos' })[t];
const sevText = (s: BugRow['severity']) => ({ high: tr('Cao', 'High'), medium: tr('Trung bình', 'Medium'), low: tr('Thấp', 'Low') })[s];
const lastText = (l: CaseRow['last']) => ({ pass: tr('Đạt', 'Pass'), fail: tr('Lỗi', 'Fail'), none: tr('Chưa chạy', 'Not run') })[l];
const cols = 'ABCDEFGHIJ'.split('').map((c) => ({ value: c, label: tr(`Cột ${c}`, `Column ${c}`) }));

export function Sources() {
  useTitle('Bug & test case');
  const { tab = 'bugs' } = useParams();
  const nav = useNavigate();
  const { message } = App.useApp();
  const me = useMe();
  const admin = isAdmin(me);
  const mine = projects.filter((p) => canSee(me, p.id));
  const [project, setProject] = useState(mine[0]?.id);
  const src = project ? sources[project] : undefined;
  const bugs = bugRows.filter((b) => b.project === project);
  const cases = caseRows.filter((c) => c.project === project);
  const [started, setStarted] = useState<Record<string, string>>({});
  const run = (b: BugRow) => { const id = `JOB-0${152 + Object.keys(started).length}`; setStarted((s) => ({ ...s, [b.id]: id })); message.success(tr(`Đã tạo ${id} từ ${b.id} bằng ${tx(workflowById[b.workflow!].name)} (prototype)`, `Created ${id} from ${b.id} with ${tx(workflowById[b.workflow!].name)} (prototype)`)); };

  if (!project) return <div className="title-row"><div><h1>Bug & test case</h1><p className="sub">{tr('Bạn chưa được cấp quyền vào project nào.', 'You have no project access yet.')}</p></div></div>;
  const ready = bugs.filter((b) => b.triage === 'ready' && !started[b.id]).length;

  const empty = (what: string) => (
    <div className="empty">
      <p>{tr(`Project này chưa gắn ${what}.`, `This project has no ${what} linked.`)}</p>
      <Button onClick={() => nav('/sources/links')}>{tr('Gắn file', 'Link a file')}</Button>
    </div>
  );

  return (
    <>
      <div className="title-row">
        <div>
          <h1>Bug & test case</h1>
          <p className="sub">{tr('Hệ thống đọc file bug định kỳ, agent phân loại từng dòng, rồi tạo job sửa. Test case chạy bằng workflow Kiểm thử theo test case.', 'The bug file is read on a schedule, an agent triages each row, then a fix job is created. Test cases run with the Run test cases workflow.')}</p>
        </div>
        <div className="title-actions">
          <Select value={project} onChange={setProject} style={{ width: 200 }} options={mine.map((p) => ({ value: p.id, label: p.name }))} aria-label="Project" />
        </div>
      </div>
      <Tabs activeKey={tab} onChange={(k) => nav(`/sources/${k}`)} items={[
        { key: 'bugs', label: <span>Bug <span className="tab-count num">{bugs.length}</span></span> },
        { key: 'cases', label: <span>Test case <span className="tab-count num">{cases.length}</span></span> },
        { key: 'links', label: tr('File nguồn', 'Linked files') },
      ]} />

      {tab === 'bugs' && (!src?.bugs ? empty(tr('file bug', 'a bug file')) : <>
        <div className="filters">
          <span className="meta">{src.bugs.mode === 'suggest' ? tr('Chế độ Chỉ đề xuất: bấm Chạy để tạo job.', 'Suggest only: press Run to create a job.') : tr(`Chế độ Tự chạy: tối đa ${src.bugs.maxPerDay} job/ngày.`, `Auto: up to ${src.bugs.maxPerDay} jobs a day.`)}</span>
          <span className="spacer" />
          <span className="meta num">{tr(`Đọc lúc ${src.bugs.lastSync} · ${ready} bug sẵn sàng`, `Read at ${src.bugs.lastSync} · ${ready} ready`)}</span>
          <Button onClick={() => message.info(tr('Đang đọc lại file bug (prototype)', 'Re-reading the bug file (prototype)'))}>{tr('Đọc lại ngay', 'Read now')}</Button>
        </div>
        <Table<BugRow> rowKey="id" pagination={false} dataSource={bugs} scroll={{ x: 960 }} columns={[
          { title: 'Bug', key: 'b', render: (_, b) => <><span className="mono">{b.id}</span> <span className="ink">{b.title}</span><span className="sub">{tr(`Dòng ${b.row} · ${b.reporter}`, `Row ${b.row} · ${b.reporter}`)}</span></> },
          { title: tr('Mức độ', 'Severity'), key: 's', width: 110, render: (_, b) => sevText(b.severity) },
          { title: tr('Agent phân loại', 'Triage'), key: 't', width: 340, render: (_, b) => { const t = started[b.id] ? 'job' : b.triage; return <><span className={`pill ${triageTone(t)}`}>{triageText(t)}</span>{b.workflow && <span className="sub">→ {tx(workflowById[b.workflow].name)}</span>}{b.note && <span className="sub">{tx(b.note)}</span>}</>; } },
          { title: '', key: 'a', width: 130, align: 'right', render: (_, b) => started[b.id] ? <Link to="/jobs" className="mono">{started[b.id]}</Link>
            : b.triage === 'ready' ? <Button size="small" type="primary" icon={<Icon name="play" size={12} />} onClick={() => run(b)}>{tr('Chạy', 'Run')}</Button> : null },
        ]} />
        <p className="note">{tr('Trạng thái và link job được ghi ngược vào cột Trạng thái của file bug. Merge vẫn luôn cần người duyệt.', 'Status and job link are written back to the bug file’s Status column. Merging always needs a person’s approval.')}</p>
      </>)}

      {tab === 'cases' && (!src?.cases ? empty(tr('file test case', 'a test-case file')) : <>
        <div className="filters">
          <span className="meta num">{tr(`${cases.length} test case · lần chạy trước: ${cases.filter((c) => c.last === 'fail').length} lỗi`, `${cases.length} cases · last run: ${cases.filter((c) => c.last === 'fail').length} failed`)}</span>
          <span className="spacer" />
          <Button type="primary" icon={<Icon name="play" size={12} />} onClick={() => nav('/jobs?new=1&workflow=test-cases&project=' + project)}>{tr('Chạy bộ test case', 'Run the test cases')}</Button>
        </div>
        <Table<CaseRow> rowKey="id" pagination={false} dataSource={cases} scroll={{ x: 760 }} columns={[
          { title: 'Test case', key: 'c', render: (_, c) => <><span className="mono">{c.id}</span> <span className="ink">{c.title}</span><span className="sub">{c.module}</span></> },
          { title: tr('Số bước', 'Steps'), key: 'n', width: 90, align: 'right', className: 'num', render: (_, c) => c.steps },
          { title: tr('Lần chạy trước', 'Last run'), key: 'l', width: 140, render: (_, c) => <span className={`pill ${c.last === 'pass' ? 'pos' : c.last === 'fail' ? 'neg' : ''}`}>{lastText(c.last)}</span> },
        ]} />
        <p className="note">{tr('Agent chỉ chạy đúng các ca trong file, không sửa code, không viết test mới. Ca lỗi được ghi thành dòng mới trong file bug.', 'The agent runs only the cases in the file; it changes no code and writes no new tests. Failed cases become new rows in the bug file.')}</p>
      </>)}

      {tab === 'links' && <Links key={project} project={project} admin={admin} />}
    </>
  );
}

function Links({ project, admin }: { project: string; admin: boolean }) {
  const { message } = App.useApp();
  const [bugs, setBugs] = useState<BugSource>(sources[project].bugs ?? { url: '', tab: 'Sheet1', columns: {}, filter: 'Trạng thái = Mới', mode: 'suggest', autoWorkflow: 'quick-fix', maxPerDay: 1, writeBack: true });
  const [cases, setCases] = useState<SheetLink>(sources[project].cases ?? { url: '', tab: 'Sheet1', columns: {} });
  const setB = (p: Partial<BugSource>) => setBugs((b) => ({ ...b, ...p }));
  const save = () => message.success(tr('Đã lưu (prototype)', 'Saved (prototype)'));
  const urlField = (id: string, v: SheetLink, set: (p: Partial<SheetLink>) => void) => (
    <div className="form-2">
      <div className="field"><label htmlFor={`${id}-url`}>{tr('Link Google Sheet hoặc Excel (OneDrive)', 'Google Sheet or Excel (OneDrive) link')}</label><Input id={`${id}-url`} className="mono" value={v.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://docs.google.com/spreadsheets/d/…" /></div>
      <div className="field"><label htmlFor={`${id}-tab`}>{tr('Tên tab', 'Sheet tab')}</label><Input id={`${id}-tab`} value={v.tab} onChange={(e) => set({ tab: e.target.value })} /></div>
    </div>
  );
  const mapping = (fields: { key: string; label: { vi: string; en: string } }[], v: SheetLink, set: (p: Partial<SheetLink>) => void) => (
    <table className="plain">
      <thead><tr><th>{tr('Thông tin', 'Field')}</th><th>{tr('Lấy từ', 'Read from')}</th></tr></thead>
      <tbody>{fields.map((f) => <tr key={f.key}><td className="ink">{tx(f.label)}</td><td><Select size="small" allowClear style={{ width: 130 }} placeholder={tr('Chưa chọn', 'Not set')} value={v.columns[f.key]} options={cols}
        onChange={(c) => set({ columns: { ...v.columns, [f.key]: c } })} aria-label={tx(f.label)} /></td></tr>)}</tbody>
    </table>
  );

  return (
    <fieldset disabled={!admin} className="props-fields">
      {!admin && <p className="note">{tr('Chỉ admin sửa được file nguồn.', 'Only an admin can change the linked files.')}</p>}
      <section className="set-row">
        <div className="set-label">
          <h2>{tr('File bug', 'Bug file')}</h2>
          <p>{tr('Mỗi dòng là một bug. Hệ thống đọc lại sau mỗi 10 phút; dòng đã đọc được nhận theo Mã bug nên không tạo job trùng.', 'One bug per row. Read again every 10 minutes; rows are matched by Bug ID, so no job is created twice.')}</p>
          <p className="hint">{tr('Chia sẻ file cho', 'Share the file with')} <span className="mono">{SERVICE_ACCOUNT}</span> {tr('(quyền sửa để ghi trạng thái ngược lại).', '(edit access, to write status back).')}</p>
        </div>
        <div className="set-panel">
          {urlField('bug', bugs, setB)}
          {mapping(bugFields, bugs, setB)}
          <div className="field"><label htmlFor="bug-filter">{tr('Chỉ lấy dòng', 'Only rows where')}</label><Input id="bug-filter" value={bugs.filter} onChange={(e) => setB({ filter: e.target.value })} /></div>
          <div className="field"><span className="label-like">{tr('Khi có bug sẵn sàng', 'When a bug is ready')}</span>
            <Segmented value={bugs.mode} onChange={(m) => setB({ mode: m as BugSource['mode'] })} options={[{ value: 'suggest', label: tr('Chỉ đề xuất', 'Suggest only') }, { value: 'auto', label: tr('Tự chạy', 'Run automatically') }]} />
            <span className="hint">{bugs.mode === 'suggest' ? tr('Agent phân loại sẵn; người có quyền vào project bấm Chạy để tạo job.', 'The agent triages; someone with project access presses Run.') : tr('Bug sẵn sàng thành job ngay, trong giới hạn số job/ngày và hạn mức chi phí.', 'Ready bugs become jobs at once, within the jobs-per-day cap and the cost limit.')}</span>
          </div>
          {bugs.mode === 'auto' && <div className="form-2">
            <div className="field"><label htmlFor="bug-wf">{tr('Workflow dùng khi tự chạy', 'Workflow for automatic runs')}</label><Select id="bug-wf" value={bugs.autoWorkflow} onChange={(w) => setB({ autoWorkflow: w })} options={workflows.filter((w) => w.id !== 'test-cases' && w.id !== 'review-only').map((w) => ({ value: w.id, label: tx(w.name) }))} /></div>
            <div className="field"><label htmlFor="bug-max">{tr('Tối đa job mỗi ngày', 'Max jobs a day')}</label><InputNumber id="bug-max" min={1} max={20} value={bugs.maxPerDay} onChange={(n) => setB({ maxPerDay: n ?? 1 })} style={{ width: '100%' }} /></div>
          </div>}
          <div className="switch-row"><div><div className="ink">{tr('Ghi kết quả vào file bug', 'Write results to the bug file')}</div><div className="hint">{tr('Cột Trạng thái: Đang xử lý / Chờ duyệt / Đã sửa / Không tự sửa được, kèm link job.', 'Status column: In progress / Awaiting approval / Fixed / Could not fix, with the job link.')}</div></div>
            <Switch checked={bugs.writeBack} onChange={(v) => setB({ writeBack: v })} aria-label={tr('Ghi kết quả vào file bug', 'Write results to the bug file')} /></div>
          <div className="form-actions"><Button type="primary" onClick={save}>{tr('Lưu', 'Save')}</Button></div>
        </div>
      </section>
      <section className="set-row">
        <div className="set-label">
          <h2>{tr('File test case', 'Test-case file')}</h2>
          <p>{tr('Mỗi dòng là một test case. Workflow Kiểm thử theo test case chạy đúng các ca này, không thêm ca mới.', 'One case per row. The Run test cases workflow runs exactly these cases and adds none.')}</p>
        </div>
        <div className="set-panel">
          {urlField('case', cases, (p) => setCases((c) => ({ ...c, ...p })))}
          {mapping(caseFields, cases, (p) => setCases((c) => ({ ...c, ...p })))}
          <div className="form-actions"><Button type="primary" onClick={save}>{tr('Lưu', 'Save')}</Button></div>
        </div>
      </section>
    </fieldset>
  );
}
