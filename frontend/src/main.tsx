import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntApp, ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import enGB from 'antd/locale/en_GB';
import { HashRouter } from 'react-router-dom';
import { theme } from './theme';
import { App } from './App';
import { useLang } from './i18n';
import './styles/app.css';
import './styles/platform.css';

function Root() {
  const lang = useLang();
  // Re-mount on a language change so every string and number format is read again.
  return (
    <ConfigProvider theme={theme} locale={lang === 'en' ? enGB : viVN}>
      <AntApp>
        <HashRouter>
          <App key={lang} />
        </HashRouter>
      </AntApp>
    </ConfigProvider>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><Root /></StrictMode>);
