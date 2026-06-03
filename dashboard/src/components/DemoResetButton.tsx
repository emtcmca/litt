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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {error && <span style={{ fontSize: 12, color: 'var(--color-text-danger)' }}>{error}</span>}
      <button
        onClick={handleReset}
        disabled={loading}
        style={{
          fontSize: 12,
          padding: '10px 14px',
          background: 'var(--color-background-warning)',
          color: 'var(--color-text-warning)',
          border: '0.5px solid var(--color-border-warning)',
          borderRadius: 'var(--border-radius-md)',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
          fontWeight: 400,
          fontFamily: 'var(--font-mono)',
          transition: 'background 0.15s',
        }}
      >
        {loading ? 'Resetting…' : 'Reset demo'}
      </button>
    </div>
  );
}
