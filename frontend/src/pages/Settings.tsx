// Settings. One view per area (tabs as routes). Sections are rows: a label column beside a panel.
import { useEffect, useState } from 'react';
import { App, Button, Form, Input, InputNumber, Modal, Popconfirm, Radio, Segmented, Select, Slider, Switch, Table, Tabs } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { projects } from '../data/sample';
import { budgetState, convertUnit, defaultBudget, fmtAmount, fmtOther, saveBudget, usedToday, useBudget, type Budget } from '../data/budget';
import { activeAdmins, isAdmin, projectsOf, removeAccount, saveAccount, setRules, useAccess, useMe, type Account } from '../data/access';
import { Avatar } from '../components/StatusPill';
import { fold, pct } from '../lib/format';
import { useTitle } from '../lib/useTitle';
import { tr } from '../i18n';

export function Settings() {
  const { section = 'members' } = useParams();
  const nav = useNavigate();
  const me = useMe();
  useTitle(tr('Cài đặt', 'Settings'));
  const tabs = [
    { key: 'members', label: tr('Thành viên & phân quyền', 'Members & access') },
    { key: 'budget', label: tr('Hạn mức sử dụng', 'Usage limits') },
    { key: 'api', label: 'Claude API' },
    { key: 'sandbox', label: 'Sandbox' },
    { key: 'approvals', label: tr('Phê duyệt', 'Approvals') },
  ];
  const adminOnly = !isAdmin(me) && ['members', 'budget', 'api', 'sandbox', 'approvals'].includes(section);
  return (
    <div className="settings">
      <div className="title-row"><div><h1>{tabs.find((t) => t.key === section)?.label ?? tr('Cài đặt', 'Settings')}</h1><p className="sub">{tr('Cài đặt áp dụng cho mọi job của Codes Tech.', 'Settings apply to every job in Codes Tech.')}</p></div></div>
      <Tabs activeKey={section} onChange={(k) => nav(`/settings/${k}`)} items={tabs.map((t) => ({ key: t.key, label: t.label }))} />
      {adminOnly ? <p className="finding">{tr('Chỉ admin xem và sửa được phần này. Bạn đang đăng nhập với vai trò Thành viên.', 'Only an admin can see and change this. You are signed in as a member.')}</p> : <>
        {section === 'members' && <MembersSettings />}
        {section === 'budget' && <BudgetSettings />}
        {section === 'api' && <ApiSettings />}
        {section === 'sandbox' && <SandboxSettings />}
        {section === 'approvals' && <ApprovalSettings />}
      </>}
    </div>
  );
}

/* ---------- members & access ---------- */
function MembersSettings() {
  const { accounts } = useAccess();
  const me = useMe();
  const { message } = App.useApp();
  const [editing, setEditing] = useState<Account | null>(null);
  const [form] = Form.useForm();
  const role = Form.useWatch('role', form);

  const open = (a: Account | null) => {
    const blank: Account = { id: '', name: '', email: '', short: '', hue: 200, role: 'member', projects: [], active: true, lastSeen: '—' };
    setEditing(a ?? blank); form.setFieldsValue(a ?? blank);
  };
  const submit = () => form.validateFields().then((v) => {
    const isNew = !editing!.id;
    const initials = v.name.trim().split(/\s+/).slice(-2).map((w: string) => w[0]).join('').toUpperCase();
    const next: Account = { ...editing!, ...v, id: editing!.id || v.email.split('@')[0], short: editing!.short || initials, hue: editing!.hue || Math.floor(Math.random() * 360), projects: v.role === 'admin' ? [] : v.projects ?? [] };
    if (activeAdmins(accounts.map((a) => (a.id === next.id ? next : a))) === 0) { message.error(tr('Phải còn ít nhất một admin đang hoạt động.', 'At least one active admin must remain.')); return; }
    setEditing(null);
    void saveAccount(next).then((pw) => {
      if (isNew && pw) Modal.info({ title: tr(`Đã tạo tài khoản ${next.email}`, `Created ${next.email}`), content: <p>{tr('Mật khẩu tạm (chỉ hiện một lần, hãy gửi cho người đó):', 'Temporary password (shown once; send it to them):')} <code>{pw}</code></p> });
      else if (!isNew) message.success(tr(`Đã cập nhật ${next.name}`, `Updated ${next.name}`));
    });
  });

  const projectName = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  return (
    <>
      <section className="set-row">
        <div className="set-label">
          <h2>{tr('Thành viên', 'Members')}</h2>
          <p>{tr('Admin thấy mọi project, quản lý thành viên và cấp quyền. Thành viên chỉ thấy, chạy và duyệt job trong project được cấp.', 'Admins see every project, manage members and grant access. Members see, run and approve jobs only in the projects granted to them.')}</p>
          <p className="hint num">{tr(`${accounts.filter((a) => a.active).length} đang hoạt động · ${accounts.filter((a) => a.role === 'admin').length} admin`, `${accounts.filter((a) => a.active).length} active · ${accounts.filter((a) => a.role === 'admin').length} admins`)}</p>
        </div>
        <div className="set-panel members-panel">
          <Table<Account> rowKey="id" size="small" pagination={false} dataSource={accounts} scroll={{ x: 640 }} columns={[
            { title: tr('Thành viên', 'Member'), key: 'n', render: (_, a) => <span className="who-cell"><Avatar {...a} /><span><span className="ink">{a.name}{a.id === me.id ? tr(' (bạn)', ' (you)') : ''}</span><span className="sub">{a.email}</span></span></span> },
            { title: tr('Vai trò', 'Role'), key: 'r', width: 110, render: (_, a) => <span className={`pill${a.role === 'admin' ? ' run' : ''}`}>{a.role === 'admin' ? 'Admin' : tr('Thành viên', 'Member')}</span> },
            { title: tr('Project được vào và duyệt', 'Projects (view & approve)'), key: 'p', render: (_, a) => !a.active ? <span className="muted">{tr('Đã khóa', 'Deactivated')}</span> : a.role === 'admin' ? <span className="muted">{tr('Tất cả', 'All')}</span> : a.projects.length ? a.projects.map((id) => projectName[id]).join(', ') : <span className="warn-ink">{tr('Chưa cấp project nào', 'No project yet')}</span> },
            { title: '', key: 'x', width: 150, align: 'right', render: (_, a) => <span className="row-actions">
              <Button size="small" onClick={() => open(a)}>{tr('Sửa', 'Edit')}</Button>
              {a.id !== me.id && <Popconfirm title={tr(`Xóa ${a.name}?`, `Remove ${a.name}?`)} description={tr('Job và lịch sử duyệt của người này được giữ lại.', 'Their jobs and approval history are kept.')} okText={tr('Xóa', 'Remove')} cancelText={tr('Không', 'No')} onConfirm={() => { removeAccount(a.id); message.success(tr('Đã xóa', 'Removed')); }}><Button size="small" danger>{tr('Xóa', 'Remove')}</Button></Popconfirm>}
            </span> },
          ]} />
          <div className="form-actions"><Button type="primary" onClick={() => open(null)}>{tr('Mời thành viên', 'Invite member')}</Button></div>
        </div>
      </section>

      <section className="set-row">
        <div className="set-label"><h2>{tr('Quyền theo project', 'Access by project')}</h2><p>{tr('Ai được vào và duyệt job ở từng project. Bấm ô để cấp hoặc thu hồi.', 'Who can open and approve jobs in each project. Click a cell to grant or revoke.')}</p></div>
        <div className="set-panel">
          <div className="table-wrap">
            <table className="plain matrix">
              <thead><tr><th>Project</th>{accounts.filter((a) => a.active).map((a) => <th key={a.id} className="c" title={a.name}><Avatar {...a} /></th>)}</tr></thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td className="ink">{p.name}</td>
                    {accounts.filter((a) => a.active).map((a) => {
                      const on = projectsOf(a).includes(p.id);
                      return (
                        <td key={a.id} className="c">
                          <button className={`cell${on ? ' on' : ''}`} disabled={a.role === 'admin'} aria-pressed={on}
                            aria-label={tr(`${a.name} ${on ? 'có' : 'không có'} quyền vào ${p.name}`, `${a.name} ${on ? 'has' : 'has no'} access to ${p.name}`)}
                            title={a.role === 'admin' ? tr('Admin luôn có quyền', 'Admins always have access') : undefined}
                            onClick={() => saveAccount({ ...a, projects: on ? a.projects.filter((x) => x !== p.id) : [...a.projects, p.id] })}>
                            {on ? tr('Có', 'Yes') : '—'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">{tr('Project không còn ai ngoài admin duyệt được thì job sẽ chờ admin.', 'A project nobody but admins can approve leaves its jobs waiting on an admin.')}</p>
        </div>
      </section>

      <Modal open={!!editing} title={editing?.id ? tr(`Sửa ${editing.name}`, `Edit ${editing.name}`) : tr('Mời thành viên', 'Invite member')} okText={editing?.id ? tr('Lưu', 'Save') : tr('Gửi lời mời', 'Send invite')} cancelText={tr('Hủy', 'Cancel')} onCancel={() => setEditing(null)} onOk={submit} destroyOnHidden>
        <Form form={form} layout="vertical" requiredMark={false}>
          <div className="form-2">
            <Form.Item label={tr('Họ tên', 'Name')} name="name" rules={[{ required: true, message: tr('Nhập họ tên', 'Enter a name') }]}><Input /></Form.Item>
            <Form.Item label="Email" name="email" rules={[{ required: true, type: 'email', message: tr('Email chưa đúng', 'Not a valid email') }]}><Input disabled={!!editing?.id} /></Form.Item>
          </div>
          <Form.Item label={tr('Vai trò', 'Role')} name="role"><Segmented options={[{ value: 'member', label: tr('Thành viên', 'Member') }, { value: 'admin', label: 'Admin' }]} /></Form.Item>
          {role !== 'admin' && (
            <Form.Item label={tr('Project được vào và duyệt', 'Projects to view and approve')} name="projects" rules={[{ required: true, type: 'array', min: 1, message: tr('Chọn ít nhất một project, nếu không người này sẽ không thấy job nào', 'Choose at least one project, or this person will see no jobs') }]} extra={tr('Thành viên chỉ thấy job của các project này.', 'The member sees jobs in these projects only.')}>
              <Select mode="multiple" allowClear showSearch={{ filterOption: (input, o) => fold(String(o?.label ?? '')).includes(fold(input)) }} notFoundContent={tr('Không có project phù hợp', 'No matching project')} options={projects.map((p) => ({ value: p.id, label: p.name }))} placeholder={tr('Chọn project', 'Choose projects')} />
            </Form.Item>
          )}
          {editing?.id && <Form.Item label={tr('Trạng thái', 'Status')} name="active" valuePropName="checked" extra={tr('Khóa thì người này không đăng nhập được, quyền được giữ để mở lại.', 'A deactivated account cannot sign in; its access is kept for later.')}><Switch checkedChildren={tr('Hoạt động', 'Active')} unCheckedChildren={tr('Khóa', 'Off')} /></Form.Item>}
        </Form>
      </Modal>
    </>
  );
}

/* ---------- usage limits: dollars or tokens ---------- */
function BudgetSettings() {
  const saved = useBudget();
  const { message } = App.useApp();
  const [b, setB] = useState<Budget>(saved);
  useEffect(() => setB(saved), [saved]);
  const set = (patch: Partial<Budget>) => setB((x) => ({ ...x, ...patch }));
  const dirty = JSON.stringify(b) !== JSON.stringify(saved);
  const usd = b.unit === 'usd';
  // tokens are typed in millions
  const toInput = (v: number | null) => (v == null ? null : usd ? v : v / 1_000_000);
  const fromInput = (v: number | null) => (v == null ? null : usd ? v : Math.round(v * 1_000_000));
  const inputProps = usd ? { prefix: '$', step: 1, precision: 2 } : { suffix: tr('tr token', 'M tokens'), step: 0.5, precision: 2 };
  const f = (v: number) => fmtAmount(b, v);

  const spent = usedToday(b);
  const state = budgetState(spent, b.daily, b.warnAt);
  const projectSum = projects.reduce((a, p) => a + (b.projects[p.id] ?? 0), 0);
  const errors = [
    b.perJob > b.daily && tr('Hạn mức mỗi job lớn hơn hạn mức cả ngày.', 'The per-job limit is above the daily limit.'),
    projects.some((p) => (b.projects[p.id] ?? 0) > b.daily) && tr('Có project đặt hạn mức lớn hơn hạn mức cả ngày.', 'A project limit is above the daily limit.'),
  ].filter(Boolean) as string[];
  const actionText = {
    queue: tr('Job mới vào hàng đợi tới 00:00 hôm sau. Job đang chạy chạy tiếp.', 'New jobs wait in the queue until midnight. Running jobs carry on.'),
    pause: tr('Job đang chạy tạm dừng ở node kế tiếp; job mới bị chặn. Admin có thể cho chạy tiếp từng job.', 'Running jobs pause at their next node and new jobs are blocked. An admin can resume single jobs.'),
    warn: tr('Chỉ gửi cảnh báo. Không có job nào bị dừng.', 'Only a warning is sent. No job is stopped.'),
  }[b.action];

  const save = () => {
    if (errors.length) { message.error(errors[0]); return; }
    saveBudget(b); message.success(tr('Đã lưu hạn mức', 'Limits saved'));
  };

  return (
    <>
      <section className="set-row">
        <div className="set-label">
          <h2>{tr('Đơn vị tính', 'Counted in')}</h2>
          <p>{tr('Tính theo chi phí (USD) hay theo số token Claude API. Token không đổi khi giá thay đổi; chi phí phản ánh đúng hóa đơn vì Opus đắt hơn Sonnet trên mỗi token.', 'Count by cost (USD) or by Claude API tokens. Tokens stay put when prices change; cost matches the bill, since Opus costs more per token than Sonnet.')}</p>
        </div>
        <div className="set-panel">
          <Segmented value={b.unit} onChange={(v) => setB((x) => convertUnit(x, v as Budget['unit']))} options={[{ value: 'usd', label: tr('Chi phí (USD)', 'Cost (USD)') }, { value: 'tokens', label: 'Token' }]} aria-label={tr('Đơn vị tính', 'Counted in')} />
          <p className="hint">{tr('Đổi đơn vị sẽ quy đổi các hạn mức bên dưới theo giá trung bình $3,60 / 1 triệu token (đầu vào + đầu ra).', 'Switching converts the limits below at an average of $3.60 per million tokens (input + output).')}</p>
        </div>
      </section>

      <section className="set-row">
        <div className="set-label">
          <h2>{tr('Hạn mức mỗi ngày', 'Daily limit')}</h2>
          <p>{tr('Tổng mức dùng Claude API của cả nhóm trong một ngày (00:00–24:00, giờ Việt Nam).', 'Total Claude API use for the team in one day (00:00–24:00, Vietnam time).')}</p>
          <div className="set-summary">
            <div className="budget-figure num"><span className="big">{f(spent)}</span> <span className="muted">/ {f(b.daily)} {tr('hôm nay', 'today')}</span></div>
            <div className={`meter ${b.enabled ? state : ''}`} aria-hidden="true"><span style={{ width: `${Math.min(100, (spent / b.daily) * 100)}%` }} /><i style={{ left: `${b.warnAt * 100}%` }} /></div>
            <p className="meter-scale num"><span>0</span><span>{pct(b.warnAt, 0)}</span><span>{f(b.daily)}</span></p>
          </div>
        </div>
        <div className="set-panel">
          <div className="switch-row"><div><div className="ink">{tr('Bật hạn mức', 'Turn on limits')}</div><div className="hint">{tr('Tắt thì job chạy không giới hạn.', 'When off, jobs run with no limit.')}</div></div><Switch checked={b.enabled} onChange={(v) => set({ enabled: v })} aria-label={tr('Bật hạn mức', 'Turn on limits')} /></div>
          <fieldset disabled={!b.enabled} className="props-fields">
            <div className="form-2">
              <div className="field"><label htmlFor="b-daily">{tr('Hạn mức mỗi ngày', 'Daily limit')}</label><InputNumber id="b-daily" min={usd ? 1 : 0.1} {...inputProps} value={toInput(b.daily)} onChange={(v) => set({ daily: fromInput(v) ?? b.daily })} style={{ width: '100%' }} /><span className="hint num">{fmtOther(b, b.daily)}</span></div>
              <div className="field"><label htmlFor="b-job">{tr('Hạn mức mỗi job', 'Per-job limit')}</label><InputNumber id="b-job" min={usd ? 0.5 : 0.1} {...inputProps} value={toInput(b.perJob)} onChange={(v) => set({ perJob: fromInput(v) ?? b.perJob })} style={{ width: '100%' }} /><span className="hint num">{fmtOther(b, b.perJob)}. {tr('Job chạm mức này dừng ở node kế tiếp và chờ duyệt.', 'A job that reaches it stops at its next node and waits for approval.')}</span></div>
            </div>
            <div className="field"><label htmlFor="b-warn">{tr('Cảnh báo khi đạt', 'Warn at')} <span className="num">{pct(b.warnAt, 0)}</span> <span className="muted num">({f(b.daily * b.warnAt)})</span></label>
              <Slider id="b-warn" min={0.5} max={0.95} step={0.05} value={b.warnAt} onChange={(v) => set({ warnAt: v })} tooltip={{ formatter: (v) => pct(v ?? 0, 0) }} />
            </div>
            <div className="field"><span className="label-like">{tr('Khi chạm hạn mức ngày', 'When the daily limit is reached')}</span>
              <Radio.Group value={b.action} onChange={(e) => set({ action: e.target.value })} className="radio-stack">
                <Radio value="queue">{tr('Đưa job mới vào hàng đợi', 'Queue new jobs')}</Radio>
                <Radio value="pause">{tr('Tạm dừng cả job đang chạy', 'Pause running jobs too')}</Radio>
                <Radio value="warn">{tr('Chỉ cảnh báo', 'Warn only')}</Radio>
              </Radio.Group>
              <span className="hint">{actionText}</span>
            </div>
          </fieldset>
        </div>
      </section>

      <section className="set-row">
        <div className="set-label">
          <h2>{tr('Hạn mức theo project', 'Per-project limits')}</h2>
          <p>{tr('Tùy chọn. Để trống thì project chỉ bị giới hạn bởi hạn mức chung.', 'Optional. Empty means the project is only bound by the daily limit.')}</p>
          <p className="hint num">{tr(`Tổng các hạn mức đã đặt: ${f(projectSum)} / ${f(b.daily)}`, `Sum of set limits: ${f(projectSum)} of ${f(b.daily)}`)}</p>
        </div>
        <div className="set-panel">
          <table className="plain">
            <thead><tr><th>Project</th><th className="n">{tr('Hôm nay', 'Today')}</th><th className="n">{tr('Hạn mức / ngày', 'Limit per day')}</th></tr></thead>
            <tbody>
              {projects.map((p) => {
                const lim = b.projects[p.id];
                const s = usedToday(b, p.id);
                return (
                  <tr key={p.id}>
                    <td className="ink">{p.name}</td>
                    <td className={`n num${lim != null && s >= lim * b.warnAt ? ' warn-ink' : ''}`}>{f(s)}</td>
                    <td className="n"><InputNumber size="small" disabled={!b.enabled} min={usd ? 0.5 : 0.1} {...inputProps} placeholder={tr('Không đặt', 'None')} value={toInput(lim ?? null)}
                      onChange={(v) => set({ projects: { ...b.projects, [p.id]: fromInput(v) } })} style={{ width: 150 }} aria-label={tr(`Hạn mức của ${p.name}`, `Limit for ${p.name}`)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="set-row">
        <div className="set-label"><h2>{tr('Thông báo', 'Notifications')}</h2><p>{tr('Ai nhận email khi qua ngưỡng cảnh báo và khi chạm hạn mức.', 'Who gets an email at the warning threshold and at the limit.')}</p></div>
        <div className="set-panel">
          <div className="field"><label htmlFor="b-mail">{tr('Email nhận cảnh báo', 'Alert emails')}</label><Input id="b-mail" disabled={!b.enabled} value={b.notify} onChange={(e) => set({ notify: e.target.value })} placeholder="a@codes.tech, b@codes.tech" /><span className="hint">{tr('Nhiều email cách nhau bằng dấu phẩy.', 'Separate emails with commas.')}</span></div>
          <div className="preview" aria-label={tr('Xem trước email', 'Email preview')}>
            <div className="preview-h">{tr('Xem trước', 'Preview')}</div>
            <p className="ink">[Codes Loop] {tr(`Mức dùng hôm nay đã đạt ${pct(b.warnAt, 0)} hạn mức`, `Today's use reached ${pct(b.warnAt, 0)} of the limit`)}</p>
            <p>{tr(`Đã dùng ${f(b.daily * b.warnAt)} trên ${f(b.daily)}. Khi chạm hạn mức: ${actionText.charAt(0).toLowerCase()}${actionText.slice(1)}`, `${f(b.daily * b.warnAt)} of ${f(b.daily)} used. At the limit: ${actionText.charAt(0).toLowerCase()}${actionText.slice(1)}`)}</p>
          </div>
        </div>
      </section>

      <div className="save-bar">
        {errors.length > 0 && <span className="neg-ink">{errors[0]}</span>}
        <span className="spacer" />
        <Button onClick={() => setB(defaultBudget)}>{tr('Về mặc định', 'Reset to defaults')}</Button>
        <Button disabled={!dirty} onClick={() => setB(saved)}>{tr('Bỏ thay đổi', 'Discard')}</Button>
        <Button type="primary" disabled={!dirty} onClick={save}>{tr('Lưu hạn mức', 'Save limits')}</Button>
      </div>
    </>
  );
}

function ApiSettings() {
  const { message } = App.useApp();
  return (
    <section className="set-row">
      <div className="set-label"><h2>Claude API</h2><p>{tr('Khóa dùng cho mọi agent. Khóa được lưu trong secret manager, không vào sandbox.', 'The key every agent uses. It lives in the secret manager and never enters a sandbox.')}</p></div>
      <div className="set-panel">
        <div className="field"><label htmlFor="s-key">API key</label><Input.Password id="s-key" value="sk-ant-••••••••••••••••3f9a" readOnly className="mono" /></div>
        <div className="form-actions"><Button onClick={() => message.info(tr('Đổi khóa (prototype)', 'Rotate key (prototype)'))}>{tr('Đổi khóa', 'Rotate key')}</Button></div>
      </div>
    </section>
  );
}

function SandboxSettings() {
  const { message } = App.useApp();
  return (
    <section className="set-row">
      <div className="set-label"><h2>Sandbox</h2><p>{tr('Giới hạn tài nguyên cho mỗi container chạy job.', 'Resource limits for each job container.')}</p></div>
      <div className="set-panel">
        <div className="form-2">
          <div className="field"><label htmlFor="s-cpu">CPU (core)</label><InputNumber id="s-cpu" min={1} max={8} defaultValue={2} style={{ width: '100%' }} /></div>
          <div className="field"><label htmlFor="s-mem">RAM (GB)</label><InputNumber id="s-mem" min={2} max={32} defaultValue={6} style={{ width: '100%' }} /></div>
          <div className="field"><label htmlFor="s-time">{tr('Thời gian tối đa (phút)', 'Max run time (minutes)')}</label><InputNumber id="s-time" min={10} max={240} defaultValue={90} style={{ width: '100%' }} /></div>
          <div className="field"><label htmlFor="s-par">{tr('Số job chạy song song', 'Parallel jobs')}</label><InputNumber id="s-par" min={1} max={10} defaultValue={3} style={{ width: '100%' }} /></div>
        </div>
        <div className="switch-row"><div><div className="ink">{tr('Chặn truy cập mạng ngoài', 'Block outside network')}</div><div className="hint">{tr('Chỉ cho phép git server nội bộ và package registry.', 'Only the internal git server and package registries are allowed.')}</div></div><Switch defaultChecked aria-label={tr('Chặn truy cập mạng ngoài', 'Block outside network')} /></div>
        <div className="form-actions"><Button type="primary" onClick={() => message.success(tr('Đã lưu (prototype)', 'Saved (prototype)'))}>{tr('Lưu', 'Save')}</Button></div>
      </div>
    </section>
  );
}

function ApprovalSettings() {
  const { message } = App.useApp();
  const { rules } = useAccess();
  // each switch saves itself (one save model for this view)
  const saved = () => message.success(tr('Đã lưu', 'Saved'));
  return (
    <section className="set-row">
      <div className="set-label"><h2>{tr('Phê duyệt', 'Approvals')}</h2><p>{tr('Ai được duyệt: thành viên có quyền vào project của job, và mọi admin. Quyền cấp ở tab Thành viên.', 'Who can approve: members with access to the job’s project, and every admin. Access is granted in the Members tab.')}</p></div>
      <div className="set-panel">
        <div className="switch-row"><div><div className="ink">{tr('Duyệt trước khi merge', 'Approve before merge')}</div><div className="hint">{tr('Luôn bật: không agent nào được merge vào branch gốc.', 'Always on: no agent may merge into a base branch.')}</div></div><Switch defaultChecked disabled aria-label={tr('Duyệt trước khi merge', 'Approve before merge')} /></div>
        <div className="switch-row"><div><div className="ink">{tr('Không tự duyệt job của mình', 'No approving your own job')}</div><div className="hint">{tr('Người tạo job cần một người khác duyệt. Nếu project không còn ai khác có quyền, người tạo vẫn được duyệt để job không bị kẹt.', 'A job’s creator needs someone else to approve it. If nobody else has access to the project, the creator may still approve so the job is not stuck.')}</div></div>
          <Switch checked={rules.noSelfApprove} onChange={(v) => { setRules({ noSelfApprove: v }); saved(); }} aria-label={tr('Không tự duyệt job của mình', 'No approving your own job')} /></div>
        <div className="switch-row"><div><div className="ink">{tr('Duyệt lệnh ngoài danh sách cho phép', 'Approve commands outside the allow-list')}</div><div className="hint">{tr('Ví dụ: cài package mới, gọi mạng.', 'For example installing a package or calling the network.')}</div></div><Switch defaultChecked onChange={saved} aria-label={tr('Duyệt lệnh ngoài danh sách', 'Approve commands outside the allow-list')} /></div>
      </div>
    </section>
  );
}
