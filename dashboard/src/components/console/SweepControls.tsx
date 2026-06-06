interface SweepControlsProps {
  isRunning: boolean;
  canReplay: boolean;
  playbackIndex: number;
  totalSteps: number;
  onRun: () => void;
  onReplay: () => void;
  onScrub: (index: number) => void;
  elapsedSeconds?: number;
}

export function SweepControls({
  isRunning,
  canReplay,
  playbackIndex,
  totalSteps,
  onRun,
  onReplay,
  onScrub,
  elapsedSeconds,
}: SweepControlsProps) {
  const btnBase: React.CSSProperties = {
    fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
    border: 'none', borderRadius: 5, padding: '5px 14px',
    cursor: 'pointer', transition: 'opacity 0.15s',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button
        onClick={onRun}
        disabled={isRunning}
        style={{
          ...btnBase,
          background: isRunning ? 'rgba(29,158,117,.1)' : 'rgba(29,158,117,.12)',
          color: '#1D9E75',
          border: '1px solid rgba(29,158,117,.3)',
          opacity: isRunning ? 0.6 : 1,
        }}
      >
        {isRunning ? 'Running…' : '▶ Run sweep'}
      </button>

      {canReplay && (
        <button
          onClick={onReplay}
          disabled={isRunning}
          style={{
            ...btnBase,
            background: 'rgba(93,202,165,.06)',
            color: '#5DCAA5',
            border: '1px solid rgba(93,202,165,.2)',
            opacity: isRunning ? 0.5 : 1,
          }}
        >
          ↺ Replay
        </button>
      )}

      {totalSteps > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 120 }}>
          <input
            type="range"
            min={0}
            max={totalSteps - 1}
            value={playbackIndex}
            onChange={e => onScrub(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#1D9E75', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>
            {playbackIndex + 1}/{totalSteps}
          </span>
        </div>
      )}

      {elapsedSeconds != null && (
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)' }}>
          {elapsedSeconds.toFixed(1)}s
        </span>
      )}
    </div>
  );
}
