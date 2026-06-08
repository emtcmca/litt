import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConsoleShell } from './components/console/ConsoleShell';
import { Overview } from './pages/Overview';
import { DailyCloseoutBrief } from './components/DailyCloseoutBrief';
import { Brief } from './pages/Brief';
import { EmailPreview } from './pages/EmailPreview';
import { AuditLog } from './pages/AuditLog';
import { AuditLedger } from './pages/AuditLedger';
import { Deadlines } from './pages/Deadlines';
import { Collect } from './pages/Collect';
import { Relationships } from './pages/Relationships';
import { Budgets } from './pages/Budgets';
import { Anomalies } from './pages/Anomalies';
import { AgentConsole } from './pages/AgentConsole';
import { Policy } from './pages/Policy';
import { Integrations } from './pages/Integrations';
import { Clients } from './pages/Clients';
import { ClientNew } from './pages/ClientNew';
import { Client } from './pages/Client';
import { TimerHUD } from './components/TimerHUD';

const FIRM_ID    = 'strand-okafor';
const ATTORNEY_ID = 'dana-strand';

function NotFound() {
  return (
    <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 18, fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 8px' }}>404</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Email preview — no shell */}
        <Route path="/email-preview" element={<EmailPreview />} />
        {/* Legacy audit route — keep for backwards compat */}
        <Route path="/audit" element={
          <ConsoleShell>
            <AuditLog />
          </ConsoleShell>
        } />
        {/* Console routes */}
        <Route path="/" element={
          <ConsoleShell>
            <Overview />
          </ConsoleShell>
        } />
        <Route path="/brief" element={
          <ConsoleShell>
            <Brief />
          </ConsoleShell>
        } />
        <Route path="/closeout" element={
          <ConsoleShell>
            <DailyCloseoutBrief />
          </ConsoleShell>
        } />
        <Route path="/deadlines" element={
          <ConsoleShell>
            <Deadlines />
          </ConsoleShell>
        } />
        <Route path="/clients" element={
          <ConsoleShell>
            <Clients />
          </ConsoleShell>
        } />
        <Route path="/clients/new" element={
          <ConsoleShell>
            <ClientNew />
          </ConsoleShell>
        } />
        <Route path="/clients/:clientId" element={
          <ConsoleShell>
            <Client />
          </ConsoleShell>
        } />
        <Route path="/relationships" element={
          <ConsoleShell>
            <Relationships />
          </ConsoleShell>
        } />
        <Route path="/collect" element={
          <ConsoleShell>
            <Collect />
          </ConsoleShell>
        } />
        <Route path="/anomalies" element={
          <ConsoleShell>
            <Anomalies />
          </ConsoleShell>
        } />
        <Route path="/budgets" element={
          <ConsoleShell>
            <Budgets />
          </ConsoleShell>
        } />
        <Route path="/agents" element={
          <ConsoleShell>
            <AgentConsole />
          </ConsoleShell>
        } />
        <Route path="/ledger" element={
          <ConsoleShell>
            <AuditLedger />
          </ConsoleShell>
        } />
        <Route path="/policy" element={
          <ConsoleShell>
            <Policy />
          </ConsoleShell>
        } />
        <Route path="/integrations" element={
          <ConsoleShell>
            <Integrations />
          </ConsoleShell>
        } />
        <Route path="*" element={
          <ConsoleShell>
            <NotFound />
          </ConsoleShell>
        } />
      </Routes>
      <TimerHUD firmId={FIRM_ID} attorneyId={ATTORNEY_ID} />
    </BrowserRouter>
  );
}
