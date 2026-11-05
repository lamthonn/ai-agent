// Projects. Question: "Which repositories can agents work on, with which workflow, and how is each built and tested?"
import { useState } from 'react';
import { App, Button, Select, Table } from 'antd';
import { Link } from 'react-router-dom';
import { jobs, people, projects } from '../data/sample';
import { latest, workflowById, workflows } from '../data/workflows';
import { spentToday, useBudget } from '../data/budget';
import type { Project } from '../data/types';
import { StatusPill } from '../components/StatusPill';
import { usd, when } from '../lib/format';
import { useTitle } from '../lib/useTitle';
import { tr, tx } from '../i18n';

export function Projects() {
  useTitle('Projects');
  const { message } = App.useApp();
  const budget = useBudget();
  const [defaults, setDefaults] = useState<Record<string, string>>(Object.fromEntries(projects.map((p) => [p.id, p.defaultWorkflow])));
  const last = (p: Project) => jobs.find((j) => j.project === p.id);
  const week = (p: Project) => jobs.filter((j) => j.project === p.id && j.start >= new Date(2026, 9, 30)).length;

  return (
    <>
      <div className="title-row">
        <div><h1>Projects</h1><p className="sub">{tr(`${projects.length} repository. Agent luôn làm trên branch riêng tạo từ branch gốc.`, `${projects.length} repositories. Agents always work on their own branch made from the base branch.`)}</p></div>
        <div className="title-actions"><Button type="primary">{tr('Thêm project', 'New project')}</Button></div>
      </div>
      <Table<Project> rowKey="id" pagination={false} dataSource={projects} scroll={{ x: 1100 }} columns={[
        { title: 'Project', key: 'n', render: (_, p) => <><span className="ink">{p.name}</span><span className="sub mono">{p.repo}</span><span className="sub">{p.stack} · {people[p.owner].name}</span></> },
        { title: tr('Workflow mặc định', 'Default workflow'), key: 'wf', width: 220, render: (_, p) => (
          <Select size="small" value={defaults[p.id]} style={{ width: 200 }} aria-label={tr(`Workflow mặc định của ${p.name}`, `Default workflow for ${p.name}`)}
            onChange={(v) => { setDefaults((d) => ({ ...d, [p.id]: v })); message.success(tr(`${p.name} giờ mặc định dùng ${tx(workflowById[v].name)} (prototype)`, `${p.name} now defaults to ${tx(workflowById[v].name)} (prototype)`)); }}
            options={workflows.map((w) => ({ value: w.id, label: `${tx(w.name)} v${latest(w).version}` }))} />) },
        { title: tr('Branch gốc', 'Base branch'), key: 'b', width: 110, render: (_, p) => <span className="mono">{p.branch}</span> },
        { title: 'Build / test', key: 'c', width: 190, render: (_, p) => <><code>{p.build}</code><span className="sub"><code>{p.test}</code></span></> },
        { title: tr('Chi phí hôm nay', 'Spend today'), key: 'cost', width: 150, align: 'right', render: (_, p) => {
          const lim = budget.projects[p.id];
          return <span className="num">{usd(spentToday(p.id))}<span className="sub">{lim != null ? tr(`hạn mức ${usd(lim)}`, `limit ${usd(lim)}`) : tr('theo mức chung', 'workspace limit')}</span></span>;
        } },
        { title: tr('Jobs 7 ngày', 'Jobs, 7 days'), key: 'w', width: 100, align: 'right', className: 'num', render: (_, p) => week(p) },
        { title: tr('Job gần nhất', 'Latest job'), key: 'l', width: 190, align: 'right', render: (_, p) => { const j = last(p); return j ? <><Link to={`/jobs/${j.id}`} className="mono">{j.id}</Link> <StatusPill status={j.status} /><span className="sub num">{when(j.start)}</span></> : '—'; } },
      ]} />
      <p className="note">{tr('Đổi workflow mặc định chỉ áp dụng cho job tạo sau đó. Hạn mức chi phí từng project đặt trong', 'Changing the default only affects jobs created afterwards. Per-project cost limits live in')} <Link to="/settings/budget">{tr('Cài đặt › Hạn mức chi phí', 'Settings › Cost limits')}</Link>.</p>
    </>
  );
}
