import { useState } from 'react';
import { resetDemo } from '../api';

interface Props {
  firmId: string;
  onReset: () => void;
}

export function DemoResetButton({ firmId, onReset }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    if (!confirm('Reset all demo data? Deletes and re-seeds Strand & Okafor.')) return;
    setLoading(true);
    setError(null);
    try {
      await resetDemo(firmId);
      onReset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        onClick={handleReset}
        disabled={loading}
        className="text-xs px-3 py-1.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-lg hover:bg-amber-200 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Resetting…' : 'Reset Demo'}
      </button>
    </div>
  );
}
