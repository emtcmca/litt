import type { CSSProperties, ReactNode } from 'react';

interface MonoProps {
  children: ReactNode;
  style?: CSSProperties;
}

export function Mono({ children, style }: MonoProps) {
  return (
    <span style={{ fontFamily: 'var(--font-mono)', ...style }}>
      {children}
    </span>
  );
}
