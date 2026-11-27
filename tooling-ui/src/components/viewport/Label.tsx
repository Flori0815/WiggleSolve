import { Html } from '@react-three/drei';
import type { ReactNode } from 'react';

type Props = { children: ReactNode; color?: string; offset?: 'above' | 'below' | 'side' };

/** Screen-space text label anchored at the parent group's origin. */
export const Label = ({ children, color = '#e5e7eb', offset = 'above' }: Props) => (
  <Html pointerEvents="none" zIndexRange={[10, 0]}>
    <div className={`viewport-label label-${offset}`} style={{ color, borderColor: `${color}55` }}>{children}</div>
  </Html>
);
