import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Dropdown, Segmented } from 'antd';
import { Icon } from './Icon';
import { Avatar } from './StatusPill';
import { WorkerChip } from './WorkerChip';
import { approvals, jobById, jobs, NOW } from '../data/sample';
import { canSee, isAdmin, projectsOf, useMe } from '../data/access';
import { signOut, useLive } from '../data/live';
import { setLang, tr, useLang, type Lang } from '../i18n';

export const PRODUCT = 'Codes Loop';

// Framed sheet: the sidebar and the 48px top bar share one tinted ground (an L, no rule between them);
// the work sits on a white sheet inset 8px from the window's right and bottom edges.
export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const lang = useLang();
  useEffect(() => setOpen(false), [loc.pathname]);

  const me = useMe();
  useLive();
  // counts follow what this account can see
  const pending = approvals.filter((a) => a.status === 'pending' && a.canApprove && jobById[a.job]).length; // only what this account can act on
  const today = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
  const failedToday = jobs.filter((j) => j.status === 'failed' && j.start >= today && canSee(me, j.project)).length;
  const roleText = isAdmin(me) ? 'Admin' : tr(`Thành viên · ${projectsOf(me).length} project`, `Member · ${projectsOf(me).length} projects`);
  const switcher = {
    items: [
      { key: 'who', type: 'group' as const, label: `${me.name} · ${me.email}`, children: [{ key: 'out', label: tr('Đăng xuất', 'Sign out') }] },
    ],
    onClick: ({ key }: { key: string }) => { if (key === 'out') signOut(); },
  };

  const nav = [
    { to: '/', label: tr('Tổng quan', 'Overview'), icon: 'overview', end: true },
    { to: '/jobs', label: 'Jobs', icon: 'jobs', count: failedToday, countLabel: tr('job lỗi hôm nay', 'failed today') },
    { to: '/approvals', label: tr('Chờ duyệt', 'Approvals'), icon: 'approvals', count: pending, countLabel: tr('yêu cầu bạn duyệt được', 'you can approve') },
    { to: '/workflows', label: 'Workflows', icon: 'workflow' },
    { to: '/agents', label: 'Agents', icon: 'agents' },
    { to: '/projects', label: 'Projects', icon: 'projects' },
    { to: '/integrations', label: tr('Tích hợp', 'Integrations'), icon: 'sources' },
    { to: '/monitoring', label: tr('Giám sát', 'Monitoring'), icon: 'monitoring' },
  ];

  return (
    <div className="app frame">
      <aside className={`sidebar${open ? ' open' : ''}`} aria-label={tr('Điều hướng', 'Navigation')}>
        <div className="brand">
          <img src="brand/android-chrome-192x192.png" alt="" width={28} height={28} />
          <div>
            <div className="brand-name">{PRODUCT}</div>
            <div className="brand-scope">Codes Tech</div>
          </div>
          <button className="btn ghost menu-close" onClick={() => setOpen(false)} aria-label={tr('Đóng menu', 'Close menu')}><Icon name="close" /></button>
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
          <NavLink to="/settings" className={() => `nav-item${loc.pathname.startsWith('/settings') ? ' active' : ''}`}><Icon name="settings" /><span>{tr('Cài đặt', 'Settings')}</span></NavLink>
          <div className="user-row">
            <Avatar {...me} />
            <div><div>{me.name}</div><div className="meta">{roleText}</div></div>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="btn ghost menu-toggle" onClick={() => setOpen(true)} aria-label={tr('Mở menu', 'Open menu')}><Icon name="menu" /></button>
          <label className="search">
            <Icon name="search" size={14} />
            <input placeholder={tr('Tìm job, project, branch…', 'Search jobs, projects, branches…')} aria-label={tr('Tìm kiếm', 'Search')} />
            <kbd>Ctrl K</kbd>
          </label>
          <div className="topbar-right">
            <WorkerChip />
            <Segmented size="small" value={lang} onChange={(v) => setLang(v as Lang)} options={[{ label: 'VI', value: 'vi' }, { label: 'EN', value: 'en' }]} aria-label={tr('Ngôn ngữ', 'Language')} />
            <button className="btn ghost help" aria-label={tr('Trợ giúp', 'Help')}><Icon name="help" /></button>
            <Dropdown menu={switcher} trigger={['click']} placement="bottomRight">
              <button className="avatar-btn" aria-label={tr(`Tài khoản: ${me.name}. Đăng xuất`, `Account: ${me.name}. Sign out`)}><Avatar {...me} /></button>
            </Dropdown>
          </div>
        </header>
        <main className="sheet">{children}</main>
      </div>
    </div>
  );
}
