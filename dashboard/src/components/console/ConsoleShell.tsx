import type { ReactNode } from 'react';
import { ConsoleRail } from './ConsoleRail';

export function ConsoleShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ height: '100vh', display: 'flex', background: '#14221F' }}>
      <ConsoleRail />
      <main style={{
        flex:             1,
        minWidth:         0,
        background:       '#F1EFE8',
        display:          'grid',
        gridTemplateRows: '1fr',
        minHeight:        0,
        overflow:         'hidden',
      }}>
        {children}
      </main>
    </div>
  );
}
