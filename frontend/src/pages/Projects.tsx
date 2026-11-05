// Projects. Question: "Which repositories can agents work on, with which workflow, and how is each built and tested?"
import { useState } from 'react';
import { App, Button, Select, Table } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { allJobs as jobs, people, projects } from '../data/sample';
import { latest, workflowById, workflows } from '../data/workflows';
import { fmtAmount, usedToday, useBudget } from '../data/budget';
import { approversOf, canSee, isAdmin, useMe } from '../data/access';
import { Avatar } from '../components/StatusPill';
import type { Project } from '../data/types';
import { StatusPill } from '../components/StatusPill';
import { when } from '../lib/format';
import { useTitle } from '../lib/useTitle';
import { tr, tx } from '../i18n';

export function Projects() {
  useTitle('Projects');
  const { message } = App.useApp();
  const nav = useNavigate();
  const budget = useBudget();
  const me = useMe();
  const admin = isAdmin(me);
  const mine = projects.filter((p) => canSee(me, p.id));
  const [defaults, setDefaults] = useState<Record<string, string>>(Object.fromEntries(projects.map((p) => [p.id, p.defaultWorkflow])));
  const last = (p: Project) => jobs.find((j) => j.project === p.id);
  const week = (p: Project) => jobs.filter((j) => j.project === p.id && j.start >= new Date(2026, 9, 30)).length;

  return (
    <>
      <div className="title-row">
        <div><h1>Projects</h1><p className="sub">{admin ? tr(`${projects.length} repository. Agent luôn làm trên branch riêng tạo từ branch gốc.`, `${projects.length} repositories. Agents always work on their own branch made from the base branch.`) : tr(`Bạn được cấp quyền vào ${mine.length}/${projects.length} project.`, `You can access ${mine.length} of ${projects.length} projects.`)}</p></div>
        {admin && <div className="title-actions"><Button onClick={() => nav('/settings/members')}>{tr('Phân quyền', 'Manage access')}</Button><Button type="primary">{tr('Thêm project', 'New project')}</Button></div>}
      </div>
      <Table<Project> rowKey="id" pagination={false} dataSource={mine} scroll={{ x: 1100 }} columns={[
        { title: 'Project', key: 'n', render: (_, p) => <><span className="ink">{p.name}</span><span className="sub mono">{p.repo}</span><span className="sub">{p.stack} · {people[p.owner].name}</span></> },
        { title: tr('Workflow mặc định', 'Default workflow'), key: 'wf', width: 220, render: (_, p) => (
          <Select size="small" disabled={!admin} value={defaults[p.id]} style={{ width: 200 }} aria-label={tr(`Workflow mặc định của ${p.name}`, `Default workflow for ${p.name}`)}
            onChange={(v) => { setDefaults((d) => ({ ...d, [p.id]: v })); message.success(tr(`${p.name} giờ mặc định dùng ${tx(workflowById[v].name)} (prototype)`, `${p.name} now defaults to ${tx(workflowById[v].name)} (prototype)`)); }}
            options={workflows.map((w) => ({ value: w.id, label: `${tx(w.name)} v${latest(w).version}` }))} />) },
        { title: tr('Người duyệt', 'Approvers'), key: 'ap', width: 130, render: (_, p) => <span className="avatars">{approversOf(p.id).map((a) => <Avatar key={a.id} {...a} />)}</span> },
        { title: 'Build / test', key: 'c', width: 190, render: (_, p) => <><code>{p.build}</code><span className="sub"><code>{p.test}</code></span></> },
        { title: budget.unit === 'usd' ? tr('Chi phí hôm nay', 'Spend today') : tr('Token hôm nay', 'Tokens today'), key: 'cost', width: 150, align: 'right', render: (_, p) => {
          const lim = budget.projects[p.id];
          return <span className="num">{fmtAmount(budget, usedToday(budget, p.id))}<span className="sub">{lim != null ? tr(`hạn mức ${fmtAmount(budget, lim)}`, `limit ${fmtAmount(budget, lim)}`) : tr('theo mức chung', 'workspace limit')}</span></span>;
        } },
        { title: tr('Jobs 7 ngày', 'Jobs, 7 days'), key: 'w', width: 100, align: 'right', className: 'num', render: (_, p) => week(p) },
        { title: tr('Job gần nhất', 'Latest job'), key: 'l', width: 190, align: 'right', render: (_, p) => { const j = last(p); return j ? <><Link to={`/jobs/${j.id}`} className="mono">{j.id}</Link> <StatusPill status={j.status} /><span className="sub num">{when(j.start)}</span></> : '—'; } },
      ]} />
      <p className="note">{tr('Đổi workflow mặc định chỉ áp dụng cho job tạo sau đó. Hạn mức chi phí từng project đặt trong', 'Changing the default only affects jobs created afterwards. Per-project cost limits live in')} <Link to="/settings/budget">{tr('Cài đặt › Hạn mức chi phí', 'Settings › Cost limits')}</Link>.</p>
    </>
  );
}
