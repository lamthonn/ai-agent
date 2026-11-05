// Sign in. Accounts live on the backend; this page only sends the email and password.
import { useState } from 'react';
import { Alert, Button, Form, Input } from 'antd';
import { signIn } from '../data/live';
import { PRODUCT } from '../components/Shell';
import { useTitle } from '../lib/useTitle';
import { tr } from '../i18n';

export function Login() {
  useTitle(tr('Đăng nhập', 'Sign in'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (v: { email: string; password: string }) => {
    setBusy(true); setError('');
    try { await signIn(v.email, v.password); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <main className="login">
      <div className="login-card">
        <img src="brand/android-chrome-192x192.png" alt="" width={40} height={40} />
        <h1>{PRODUCT}</h1>
        <p className="sub">{tr('Đăng nhập để giao việc cho agent và duyệt kết quả.', 'Sign in to hand work to agents and approve results.')}</p>
        <Form layout="vertical" requiredMark={false} onFinish={submit}>
          <Form.Item label="Email" name="email" rules={[{ required: true, message: tr('Nhập email', 'Enter your email') }]}><Input type="email" autoComplete="username" autoFocus /></Form.Item>
          <Form.Item label={tr('Mật khẩu', 'Password')} name="password" rules={[{ required: true, message: tr('Nhập mật khẩu', 'Enter your password') }]}><Input.Password autoComplete="current-password" /></Form.Item>
          {error && <Alert type="error" showIcon={false} message={error} style={{ marginBottom: 16 }} />}
          <Button type="primary" htmlType="submit" loading={busy} block>{tr('Đăng nhập', 'Sign in')}</Button>
        </Form>
      </div>
    </main>
  );
}
