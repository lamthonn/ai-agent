// Settings. Sections as rows: label column beside a panel. One save per panel.
import { App, Button, Input, InputNumber, Switch } from 'antd';
import { useTitle } from '../lib/useTitle';

export function Settings() {
  useTitle('Cài đặt');
  const { message } = App.useApp();
  const save = () => message.success('Đã lưu (prototype)');
  return (
    <div className="settings">
      <div className="title-row"><div><h1>Cài đặt</h1><p className="sub">Áp dụng cho mọi job của Nhóm Phát triển.</p></div></div>

      <section className="set-row">
        <div className="set-label"><h2>Claude API</h2><p>Khóa dùng cho mọi agent. Khóa được lưu trong secret manager, không vào sandbox.</p></div>
        <div className="set-panel">
          <div className="field"><label htmlFor="s-key">API key</label><Input.Password id="s-key" value="sk-ant-••••••••••••••••3f9a" readOnly className="mono" /></div>
          <div className="field"><label htmlFor="s-budget">Hạn mức chi phí mỗi ngày (USD)</label><InputNumber id="s-budget" min={1} defaultValue={25} style={{ width: 200 }} /><span className="hint">Job mới vào hàng đợi khi chạm hạn mức.</span></div>
          <div className="form-actions"><Button type="primary" onClick={save}>Lưu</Button></div>
        </div>
      </section>

      <section className="set-row">
        <div className="set-label"><h2>Sandbox</h2><p>Giới hạn tài nguyên cho mỗi container chạy job.</p></div>
        <div className="set-panel">
          <div className="form-2">
            <div className="field"><label htmlFor="s-cpu">CPU</label><InputNumber id="s-cpu" min={1} max={8} defaultValue={2} addonAfter="core" style={{ width: '100%' }} /></div>
            <div className="field"><label htmlFor="s-mem">RAM</label><InputNumber id="s-mem" min={2} max={32} defaultValue={6} addonAfter="GB" style={{ width: '100%' }} /></div>
            <div className="field"><label htmlFor="s-time">Thời gian tối đa</label><InputNumber id="s-time" min={10} max={240} defaultValue={90} addonAfter="phút" style={{ width: '100%' }} /></div>
            <div className="field"><label htmlFor="s-par">Số job chạy song song</label><InputNumber id="s-par" min={1} max={10} defaultValue={3} style={{ width: '100%' }} /></div>
          </div>
          <div className="switch-row"><div><div className="ink">Chặn truy cập mạng ngoài</div><div className="hint">Chỉ cho phép git server nội bộ và package registry.</div></div><Switch defaultChecked aria-label="Chặn truy cập mạng ngoài" /></div>
          <div className="form-actions"><Button type="primary" onClick={save}>Lưu</Button></div>
        </div>
      </section>

      <section className="set-row">
        <div className="set-label"><h2>Phê duyệt</h2><p>Những bước luôn chờ người duyệt, kể cả khi workflow không có node Approval.</p></div>
        <div className="set-panel">
          <div className="switch-row"><div><div className="ink">Duyệt trước khi merge</div><div className="hint">Không agent nào được merge vào branch gốc.</div></div><Switch defaultChecked disabled aria-label="Duyệt trước khi merge" /></div>
          <div className="switch-row"><div><div className="ink">Duyệt khi agent muốn chạy lệnh ngoài danh sách cho phép</div><div className="hint">Ví dụ: cài package mới, gọi mạng.</div></div><Switch defaultChecked aria-label="Duyệt lệnh ngoài danh sách" /></div>
          <div className="form-actions"><Button type="primary" onClick={save}>Lưu</Button></div>
        </div>
      </section>
    </div>
  );
}
