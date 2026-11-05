// Settings. One view per area (tabs as routes). Sections are rows: a label column beside a panel, one Save per panel.
import { useEffect, useState } from 'react';
import { App, Button, Input, InputNumber, Radio, Slider, Switch, Tabs } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { projects } from '../data/sample';
import { budgetState, defaultBudget, saveBudget, spentToday, useBudget, type Budget } from '../data/budget';
import { pct, usd } from '../lib/format';
import { useTitle } from '../lib/useTitle';
import { tr } from '../i18n';

export function Settings() {
  const { section = 'budget' } = useParams();
  const nav = useNavigate();
  useTitle(tr('Cài đặt', 'Settings'));
  const tabs = [
    { key: 'budget', label: tr('Hạn mức chi phí', 'Cost limits') },
    { key: 'api', label: 'Claude API' },
    { key: 'sandbox', label: 'Sandbox' },
    { key: 'approvals', label: tr('Phê duyệt', 'Approvals') },
  ];
  return (
    <div className="settings">
      <div className="title-row"><div><h1>{tabs.find((t) => t.key === section)?.label ?? tr('Cài đặt', 'Settings')}</h1><p className="sub">{tr('Cài đặt áp dụng cho mọi job của Codes Tech · Nhóm Phát triển.', 'Settings apply to every job in Codes Tech · Dev team.')}</p></div></div>
      <Tabs activeKey={section} onChange={(k) => nav(`/settings/${k}`)} items={tabs.map((t) => ({ key: t.key, label: t.label }))} />
      {section === 'budget' && <BudgetSettings />}
      {section === 'api' && <ApiSettings />}
      {section === 'sandbox' && <SandboxSettings />}
      {section === 'approvals' && <ApprovalSettings />}
    </div>
  );
}

function BudgetSettings() {
  const saved = useBudget();
  const { message } = App.useApp();
  const [b, setB] = useState<Budget>(saved);
  useEffect(() => setB(saved), [saved]);
  const set = (patch: Partial<Budget>) => setB((x) => ({ ...x, ...patch }));
  const dirty = JSON.stringify(b) !== JSON.stringify(saved);
  const spent = spentToday();
  const state = budgetState(spent, b.daily, b.warnAt);
  const projectSum = projects.reduce((a, p) => a + (b.projects[p.id] ?? 0), 0);
  const errors = [
    b.perJob > b.daily && tr('Hạn mức mỗi job lớn hơn hạn mức cả ngày.', 'The per-job limit is above the daily limit.'),
    projects.some((p) => (b.projects[p.id] ?? 0) > b.daily) && tr('Có project đặt hạn mức lớn hơn hạn mức cả ngày.', 'A project limit is above the daily limit.'),
  ].filter(Boolean) as string[];
  const actionText = {
    queue: tr('Job mới vào hàng đợi tới 00:00 hôm sau. Job đang chạy chạy tiếp.', 'New jobs wait in the queue until midnight. Running jobs carry on.'),
    pause: tr('Job đang chạy tạm dừng ở node kế tiếp; job mới bị chặn. Tech lead có thể cho chạy tiếp từng job.', 'Running jobs pause at their next node and new jobs are blocked. The tech lead can resume single jobs.'),
    warn: tr('Chỉ gửi cảnh báo. Không có job nào bị dừng.', 'Only a warning is sent. No job is stopped.'),
  }[b.action];

  const save = () => {
    if (errors.length) { message.error(errors[0]); return; }
    saveBudget(b); message.success(tr('Đã lưu hạn mức chi phí', 'Cost limits saved'));
  };

  return (
    <>
      <section className="set-row">
        <div className="set-label">
          <h2>{tr('Hạn mức mỗi ngày', 'Daily limit')}</h2>
          <p>{tr('Tổng chi phí Claude API của cả nhóm trong một ngày (00:00–24:00, giờ Việt Nam).', 'Total Claude API spend for the team in one day (00:00–24:00, Vietnam time).')}</p>
          <div className="set-summary">
            <div className="budget-figure num"><span className="big">{usd(spent)}</span> <span className="muted">/ {usd(b.daily)} {tr('hôm nay', 'today')}</span></div>
            <div className={`meter ${b.enabled ? state : ''}`} aria-hidden="true"><span style={{ width: `${Math.min(100, (spent / b.daily) * 100)}%` }} /><i style={{ left: `${b.warnAt * 100}%` }} /></div>
            <p className="meter-scale num"><span>$0</span><span>{pct(b.warnAt, 0)}</span><span>{usd(b.daily)}</span></p>
          </div>
        </div>
        <div className="set-panel">
          <div className="switch-row"><div><div className="ink">{tr('Bật hạn mức chi phí', 'Turn on cost limits')}</div><div className="hint">{tr('Tắt thì job chạy không giới hạn chi phí.', 'When off, jobs run with no cost limit.')}</div></div><Switch checked={b.enabled} onChange={(v) => set({ enabled: v })} aria-label={tr('Bật hạn mức chi phí', 'Turn on cost limits')} /></div>
          <fieldset disabled={!b.enabled} className="props-fields">
            <div className="form-2">
              <div className="field"><label htmlFor="b-daily">{tr('Hạn mức mỗi ngày', 'Daily limit')}</label><InputNumber id="b-daily" min={1} max={10000} step={5} precision={2} value={b.daily} onChange={(v) => set({ daily: v ?? b.daily })} prefix="$" style={{ width: '100%' }} /></div>
              <div className="field"><label htmlFor="b-job">{tr('Hạn mức mỗi job', 'Per-job limit')}</label><InputNumber id="b-job" min={0.5} max={1000} step={0.5} precision={2} value={b.perJob} onChange={(v) => set({ perJob: v ?? b.perJob })} prefix="$" style={{ width: '100%' }} /><span className="hint">{tr('Job chạm mức này dừng ở node kế tiếp và chờ duyệt.', 'A job that reaches it stops at its next node and waits for approval.')}</span></div>
            </div>
            <div className="field"><label htmlFor="b-warn">{tr('Cảnh báo khi đạt', 'Warn at')} <span className="num">{pct(b.warnAt, 0)}</span> <span className="muted num">({usd(b.daily * b.warnAt)})</span></label>
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
          <p className="hint num">{tr(`Tổng các hạn mức đã đặt: ${usd(projectSum)} / ${usd(b.daily)}`, `Sum of set limits: ${usd(projectSum)} of ${usd(b.daily)}`)}</p>
        </div>
        <div className="set-panel">
          <table className="plain">
            <thead><tr><th>Project</th><th className="n">{tr('Hôm nay', 'Today')}</th><th className="n">{tr('Hạn mức / ngày', 'Limit per day')}</th></tr></thead>
            <tbody>
              {projects.map((p) => {
                const lim = b.projects[p.id];
                const s = spentToday(p.id);
                return (
                  <tr key={p.id}>
                    <td className="ink">{p.name}</td>
                    <td className={`n num${lim != null && s >= lim * b.warnAt ? ' warn-ink' : ''}`}>{usd(s)}</td>
                    <td className="n"><InputNumber size="small" disabled={!b.enabled} min={0.5} max={b.daily} step={1} precision={2} prefix="$" placeholder={tr('Không đặt', 'None')} value={lim ?? null}
                      onChange={(v) => set({ projects: { ...b.projects, [p.id]: v ?? null } })} style={{ width: 130 }} aria-label={tr(`Hạn mức của ${p.name}`, `Limit for ${p.name}`)} /></td>
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
            <p className="ink">[Codes Loop] {tr(`Chi phí hôm nay đã đạt ${pct(b.warnAt, 0)} hạn mức`, `Today's spend reached ${pct(b.warnAt, 0)} of the limit`)}</p>
            <p>{tr(`Đã dùng ${usd(b.daily * b.warnAt)} trên ${usd(b.daily)}. Khi chạm hạn mức: ${actionText.charAt(0).toLowerCase()}${actionText.slice(1)}`, `${usd(b.daily * b.warnAt)} of ${usd(b.daily)} used. At the limit: ${actionText.charAt(0).toLowerCase()}${actionText.slice(1)}`)}</p>
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
  return (
    <section className="set-row">
      <div className="set-label"><h2>{tr('Phê duyệt', 'Approvals')}</h2><p>{tr('Những bước luôn chờ người duyệt, kể cả khi workflow không có node Approval.', 'Steps that always wait for a person, even without an Approval node in the workflow.')}</p></div>
      <div className="set-panel">
        <div className="switch-row"><div><div className="ink">{tr('Duyệt trước khi merge', 'Approve before merge')}</div><div className="hint">{tr('Không agent nào được merge vào branch gốc.', 'No agent may merge into a base branch.')}</div></div><Switch defaultChecked disabled aria-label={tr('Duyệt trước khi merge', 'Approve before merge')} /></div>
        <div className="switch-row"><div><div className="ink">{tr('Duyệt lệnh ngoài danh sách cho phép', 'Approve commands outside the allow-list')}</div><div className="hint">{tr('Ví dụ: cài package mới, gọi mạng.', 'For example installing a package or calling the network.')}</div></div><Switch defaultChecked aria-label={tr('Duyệt lệnh ngoài danh sách', 'Approve commands outside the allow-list')} /></div>
        <div className="form-actions"><Button type="primary" onClick={() => message.success(tr('Đã lưu (prototype)', 'Saved (prototype)'))}>{tr('Lưu', 'Save')}</Button></div>
      </div>
    </section>
  );
}
