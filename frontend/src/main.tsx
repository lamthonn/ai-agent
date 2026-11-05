import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntApp, ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import enGB from 'antd/locale/en_GB';
import { HashRouter } from 'react-router-dom';
import { theme } from './theme';
import { App } from './App';
import { Login } from './pages/Login';
import { useSignedIn } from './lib/api';
import { isLoaded, loadAll, signOut, startPolling, useLive } from './data/live';
import { Spin } from 'antd';
import { useLang } from './i18n';
import './styles/app.css';
import './styles/platform.css';

/** Signed out: the login page. Signed in: wait for the first load, then the app, refreshed every few seconds. */
function Gate({ lang }: { lang: string }) {
  const signedIn = useSignedIn();
  useLive();
  const [error, setError] = useState('');
  useEffect(() => {
    if (!signedIn) return;
    loadAll().catch((e) => { setError(e.message); });
    return startPolling();
  }, [signedIn]);
  if (!signedIn) return <Login />;
  if (!isLoaded()) return <div className="login">{error ? <div className="login-card"><p>{error}</p><button className="btn" onClick={signOut}>OK</button></div> : <Spin size="large" />}</div>;
  return <HashRouter><App key={lang} /></HashRouter>;
}

function Root() {
  const lang = useLang();
  // Re-mount on a language change so every string and number format is read again.
  return (
    <ConfigProvider theme={theme} locale={lang === 'en' ? enGB : viVN}>
      <AntApp>
        <Gate lang={lang} />
      </AntApp>
    </ConfigProvider>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><Root /></StrictMode>);
