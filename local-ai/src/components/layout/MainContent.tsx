import type { ReactNode } from 'react';

export function MainContent({ children }: { children: ReactNode }) {
  return <main className="flex-1 overflow-hidden bg-[hsl(var(--panel))] backdrop-blur-[18px]">{children}</main>;
}
