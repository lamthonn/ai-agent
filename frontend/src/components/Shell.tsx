import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Icon, Mark } from './Icon';
import { Avatar } from './StatusPill';
import { approvals, jobs, me } from '../data/sample';

// Framed sheet: the sidebar and the 48px top bar share one tinted ground (an L, no rule between them);
// the work sits on a white sheet inset 8px from the window's right and bottom edges.
export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);

  const pending = approvals.filter((a) => a.status === 'pending').length;
  const failedToday = jobs.filter((j) => j.status === 'failed' && j.start.getDate() === 5 && j.start.getMonth() === 10).length;

  const nav = [
    { to: '/', label: 'Tổng quan', icon: 'overview', end: true },
    { to: '/jobs', label: 'Jobs', icon: 'jobs', count: failedToday, countLabel: 'job lỗi hôm nay' },
    { to: '/approvals', label: 'Chờ duyệt', icon: 'approvals', count: pending, countLabel: 'yêu cầu chờ duyệt' },
    { to: '/workflows', label: 'Workflow', icon: 'workflow' },
    { to: '/agents', label: 'Agents', icon: 'agents' },
    { to: '/projects', label: 'Projects', icon: 'projects' },
    { to: '/monitoring', label: 'Giám sát', icon: 'monitoring' },
  ];

  return (
    <div className="app frame">
      <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Điều hướng">
        <div className="brand">
          <Mark />
          <div>
            <div className="brand-name">Agent Platform</div>
            <div className="brand-scope">Nhóm Phát triển</div>
          </div>
          <button className="btn ghost menu-close" onClick={() => setOpen(false)} aria-label="Đóng menu"><Icon name="close" /></button>
        </div>
        <nav className="nav">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <Icon name={n.icon} />
              <span>{n.label}</span>
              {n.count ? <span className="count num" aria-label={`${n.count} ${n.countLabel}`}>{n.count}</span> : null}
            </NavLink>
          ))}
        </nav>
        <div className="bottom">
          <NavLink to="/settings" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}><Icon name="settings" /><span>Cài đặt</span></NavLink>
          <div className="user-row">
            <Avatar {...me} />
            <div><div>{me.name}</div><div className="meta">{me.role}</div></div>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="btn ghost menu-toggle" onClick={() => setOpen(true)} aria-label="Mở menu"><Icon name="menu" /></button>
          <label className="search">
            <Icon name="search" size={14} />
            <input placeholder="Tìm job, project, branch…" aria-label="Tìm kiếm" />
            <kbd>Ctrl K</kbd>
          </label>
          <div className="topbar-right">
            <button className="btn ghost" aria-label="Trợ giúp"><Icon name="help" /></button>
            <Avatar {...me} />
          </div>
        </header>
        <main className="sheet">{children}</main>
      </div>
    </div>
  );
}
