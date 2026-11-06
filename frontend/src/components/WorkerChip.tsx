// Top-bar chip: is a worker connected, which Claude login does it use, what is it doing.
import { Popover } from 'antd';
import { useWorker } from '../data/worker';
import { when } from '../lib/format';
import { utc } from '../lib/api';
import { tr } from '../i18n';

export function WorkerChip() {
  const w = useWorker();
  if (!w) return null;
  const i = w.info;
  const ok = w.online && !!i?.claudeLoggedIn;
  const tone = ok ? 'ok' : w.online ? 'warn' : i ? 'bad' : '';
  const label = !i ? tr('Chưa có worker', 'No worker')
    : !w.online ? tr('Worker offline', 'Worker offline')
    : !i.claudeLoggedIn ? tr('Claude chưa đăng nhập', 'Claude not signed in')
    : i.claudeEmail ? `Claude · ${i.claudeEmail}` : tr('Claude đã kết nối', 'Claude connected');
  const row = (k: string, v: string | null | undefined) => v ? <div><dt>{k}</dt><dd>{v}</dd></div> : null;

  const body = (
    <div className="worker-pop">
      {!i && <p>{tr('Chưa worker nào kết nối. Job sẽ nằm trong hàng đợi cho tới khi có worker chạy trên máy có đăng nhập Claude.', 'No worker has connected. Jobs wait in the queue until a worker runs on a machine signed in to Claude.')}</p>}
      {i && !w.online && <p className="neg-ink">{tr('Worker đã ngừng báo.', 'The worker stopped reporting.')}{w.runningJobs > 0 && tr(` ${w.runningJobs} job đang ở trạng thái “chạy” sẽ không tiến triển cho tới khi worker chạy lại.`, ` ${w.runningJobs} job(s) marked running will not progress until the worker is back.`)}</p>}
      {i && w.online && !i.claudeLoggedIn && <p className="warn-ink">{i.claudeError ?? tr('Claude Code chưa đăng nhập.', 'Claude Code is not signed in.')}</p>}
      {i && <dl className="facts">
        {row(tr('Tài khoản Claude', 'Claude account'), i.claudeEmail)}
        {row(tr('Tổ chức', 'Organisation'), i.claudeOrg)}
        {row(tr('Gói', 'Plan'), i.claudePlan)}
        {row('Claude Code', i.claudeVersion)}
        {row(tr('Máy chạy worker', 'Worker machine'), i.host)}
        {row(tr('Đang làm', 'Doing'), w.online ? (i.currentJob ?? tr('rảnh', 'idle')) : null)}
        {row(tr('Ghi vào Google Sheet', 'Write to Google Sheet'), i.googleKey ? tr('được (có khóa)', 'yes (key set)') : tr('chưa (không có khóa)', 'no (no key)'))}
        {row(tr('Báo lần cuối', 'Last report'), w.seenAt ? when(utc(w.seenAt)!) : null)}
      </dl>}
    </div>
  );
  return (
    <Popover content={body} trigger={['hover', 'click']} placement="bottomRight">
      <button className="worker-chip" aria-label={label}><span className={`dot ${tone}`} aria-hidden="true" /><span className="truncate">{label}</span></button>
    </Popover>
  );
}
