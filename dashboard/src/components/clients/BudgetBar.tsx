import { T } from '../../tokens';

interface BudgetBarProps {
  pct: number;
  height?: number;
}

function budgetTone(pct: number): string {
  if (pct >= 90) return T.danger;
  if (pct >= 75) return T.gold;
  return T.teal;
}

export function BudgetBar({ pct, height = 7 }: BudgetBarProps) {
  const tone = budgetTone(pct);
  return (
    <div style={{ position: 'relative', height, borderRadius: 999, background: T.wash2, overflow: 'hidden' }}>
      {/* 75% threshold marker — behind the fill */}
      <div style={{
        position: 'absolute', left: '75%', top: 0, bottom: 0, width: 2,
        background: T.gold, opacity: 0.45, zIndex: 1,
      }} />
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: `${Math.min(pct, 100)}%`,
        background: tone, borderRadius: 999,
        zIndex: 2,
      }} />
    </div>
  );
}

export { budgetTone };
