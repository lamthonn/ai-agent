// Tích hợp. Question: "Which platforms feed work into Codes Loop, and are they healthy?" One card per platform.
import { useState } from 'react';
import { Select } from 'antd';
import { useNavigate } from 'react-router-dom';
import { projects } from '../data/sample';
import { useLive } from '../data/live';
import { useSources } from '../data/sources';
import { platforms, type Platform } from '../data/integrations';
import { canSee, useMe } from '../data/access';
import { when } from '../lib/format';
import { utc } from '../lib/api';
import { useTitle } from '../lib/useTitle';
import { tr, tx } from '../i18n';

export function Integrations() {
  useTitle(tr('Tích hợp', 'Integrations'));
  const nav = useNavigate();
  const me = useMe();
  useLive();
  const mine = projects.filter((p) => canSee(me, p.id));
  const [project, setProject] = useState(mine[0]?.id);
  const { data } = useSources(project);

  if (!project) return <div className="title-row"><div><h1>{tr('Tích hợp', 'Integrations')}</h1><p className="sub">{tr('Bạn chưa được cấp quyền vào project nào.', 'You have no project access yet.')}</p></div></div>;

  /** What the card says about the platform for this project. */
  const status = (p: Platform) => {
    if (!p.live) return { tone: '', text: tr('Sắp có', 'Coming soon'), line: '' };
    const links = [data?.bug, data?.case].filter((l): l is NonNullable<typeof l> => !!l && !!l.url);
    if (!data) return { tone: '', text: tr('Đang tải…', 'Loading…'), line: '' };
    if (!links.length) return { tone: '', text: tr('Chưa kết nối', 'Not connected'), line: tr('Chưa gắn bảng nào cho project này.', 'No sheet linked to this project yet.') };
    const failed = links.find((l) => l.lastError);
    const last = links.map((l) => l.lastSyncAt).filter(Boolean).sort().pop();
    const line = tr(`${links.length} bảng · ${data.bugs.length} việc · đọc lúc ${last ? when(utc(last)!) : 'chưa lần nào'}`, `${links.length} sheet(s) · ${data.bugs.length} items · read ${last ? when(utc(last)!) : 'never'}`);
    return failed ? { tone: 'neg', text: tr('Lỗi đọc', 'Read error'), line: failed.lastError! } : { tone: 'pos', text: tr('Đã kết nối', 'Connected'), line };
  };

  return (
    <>
      <div className="title-row">
        <div>
          <h1>{tr('Tích hợp', 'Integrations')}</h1>
          <p className="sub">{tr('Kết nối nơi công việc của bạn đang nằm. Mỗi việc đọc được sẽ chạy qua workflow bạn chọn, dù là việc của IT hay của phòng ban khác.', 'Connect where your work lives. Each item it reads runs through the workflow you choose, whether it is IT work or any other team’s.')}</p>
        </div>
        <div className="title-actions">
          <Select value={project} onChange={setProject} style={{ width: 200 }} options={mine.map((p) => ({ value: p.id, label: p.name }))} aria-label="Project" />
        </div>
      </div>
      <ul className="int-grid">
        {platforms.map((p) => {
          const s = status(p);
          return (
            <li key={p.id}>
              <button className={`int-card${p.live ? '' : ' soon'}`} disabled={!p.live} onClick={() => nav(`/integrations/${p.id}`)} aria-label={`${p.name}: ${s.text}`}>
                <span className="int-head"><span className="wf-code">{p.chip}</span><span className="ink int-name">{p.name}</span><span className={`pill ${s.tone}`}>{s.text}</span></span>
                <span className="int-about">{tx(p.about)}</span>
                {s.line && <span className={`int-line${s.tone === 'neg' ? ' neg-ink' : ''}`}>{s.line}</span>}
                {p.live && <span className="int-cta">{s.tone ? tr('Cấu hình', 'Configure') : tr('Kết nối', 'Connect')} →</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
