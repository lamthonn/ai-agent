// Projects. Question: "Which repositories can agents work on, and how is each built and tested?"
import { Button, Table } from 'antd';
import { Link } from 'react-router-dom';
import { jobs, people, projects } from '../data/sample';
import type { Project } from '../data/types';
import { StatusPill } from '../components/StatusPill';
import { when } from '../lib/format';
import { useTitle } from '../lib/useTitle';

export function Projects() {
  useTitle('Projects');
  const last = (p: Project) => jobs.find((j) => j.project === p.id);
  const week = (p: Project) => jobs.filter((j) => j.project === p.id && j.start >= new Date(2026, 9, 30)).length;
  return (
    <>
      <div className="title-row">
        <div><h1>Projects</h1><p className="sub">{projects.length} repository. Agent luôn làm trên branch riêng tạo từ branch gốc.</p></div>
        <div className="title-actions"><Button type="primary">Thêm project</Button></div>
      </div>
      <Table<Project> rowKey="id" pagination={false} dataSource={projects} scroll={{ x: 900 }} columns={[
        { title: 'Project', key: 'n', render: (_, p) => <><span className="ink">{p.name}</span><span className="sub mono">{p.repo}</span></> },
        { title: 'Stack', dataIndex: 'stack', width: 150 },
        { title: 'Branch gốc', key: 'b', width: 120, render: (_, p) => <span className="mono">{p.branch}</span> },
        { title: 'Build / test', key: 'c', render: (_, p) => <><code>{p.build}</code><span className="sub"><code>{p.test}</code></span></> },
        { title: 'Phụ trách', key: 'o', width: 150, render: (_, p) => people[p.owner].name },
        { title: 'Jobs 7 ngày', key: 'w', width: 110, align: 'right', className: 'num', render: (_, p) => week(p) },
        { title: 'Job gần nhất', key: 'l', width: 200, align: 'right', render: (_, p) => { const j = last(p); return j ? <><Link to={`/jobs/${j.id}`} className="mono">{j.id}</Link> <StatusPill status={j.status} /><span className="sub num">{when(j.start)}</span></> : '—'; } },
      ]} />
    </>
  );
}
