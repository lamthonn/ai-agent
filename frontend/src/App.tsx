import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Shell } from './components/Shell';
import { Overview } from './pages/Overview';
import { Jobs } from './pages/Jobs';
import { JobDetail } from './pages/JobDetail';
import { Approvals } from './pages/Approvals';
import { Workflows } from './pages/Workflows';
import { WorkflowBuilder } from './pages/WorkflowBuilder';
import { Agents } from './pages/Agents';
import { Projects } from './pages/Projects';
import { Monitoring } from './pages/Monitoring';
import { Sources } from './pages/Sources';
import { Settings } from './pages/Settings';
import { tr } from './i18n';

export function App() {
  const loc = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/jobs/:id" element={<JobDetail />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/approvals/:id" element={<Approvals />} />
        <Route path="/workflows" element={<Workflows />} />
        <Route path="/workflows/:id" element={<WorkflowBuilder />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/agents/:id" element={<Agents />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/sources" element={<Sources />} />
        <Route path="/sources/:tab" element={<Sources />} />
        <Route path="/monitoring" element={<Monitoring />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/:section" element={<Settings />} />
        <Route path="*" element={<div className="title-row"><h1>{tr('Không tìm thấy trang', 'Page not found')}</h1></div>} />
      </Routes>
    </Shell>
  );
}
