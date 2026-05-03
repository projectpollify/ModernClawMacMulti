import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MainContent } from './MainContent';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-transparent">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <MainContent>{children}</MainContent>
      </div>
    </div>
  );
}
