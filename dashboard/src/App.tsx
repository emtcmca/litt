import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { DailyCloseoutBrief } from './components/DailyCloseoutBrief';
import { EmailPreview } from './pages/EmailPreview';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DailyCloseoutBrief />} />
        <Route path="/email-preview" element={<EmailPreview />} />
        <Route path="*" element={
          <div style={{ minHeight: '100vh', background: 'var(--color-background-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 18, fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 8px' }}>404</p>
              <Link to="/" style={{ color: 'var(--color-text-info)', fontSize: 14 }}>Back to brief</Link>
            </div>
          </div>
        } />
      </Routes>
    </BrowserRouter>
  );
}
