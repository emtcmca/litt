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
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-700 mb-2">404</p>
              <Link to="/" className="text-blue-600 text-sm underline">Back to brief</Link>
            </div>
          </div>
        } />
      </Routes>
    </BrowserRouter>
  );
}
