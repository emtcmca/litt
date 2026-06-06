import type { ReactNode } from 'react';

interface ShellProps {
  children: ReactNode;
  max?: number;
}

export function Shell({ children, max = 920 }: ShellProps) {
  return (
    <div style={{ overflowY: 'auto', padding: '24px 30px 60px', height: '100%' }}>
      <div style={{ maxWidth: max, margin: '0 auto', display: 'grid', gap: 18 }}>
        {children}
      </div>
    </div>
  );
}
