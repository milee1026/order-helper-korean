import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

const TABS = [
  { id: 'today', label: '오늘 기록' },
  { id: 'automation', label: '자동화 발주' },
  { id: 'history', label: '기록 내역' },
  { id: 'analysis', label: '분석 / 요약' },
  { id: 'settings', label: '설정 / 내보내기' },
];

export function AppLayout({ activeTab, onTabChange, children }: AppLayoutProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background pb-14">
        <header className="border-b bg-background sticky top-0 z-10 px-3 py-2">
          <span className="text-sm font-bold text-foreground">재고 기록</span>
        </header>
        <main className="p-2">{children}</main>
        <nav className="fixed bottom-0 left-0 right-0 border-t bg-background z-10 flex">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'flex-1 py-2.5 text-xs font-medium transition-colors',
                activeTab === tab.id
                  ? 'text-primary border-t-2 border-primary bg-primary/5'
                  : 'text-muted-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-background sticky top-0 z-10">
        <div className="flex items-center px-4 h-10">
          <span className="text-sm font-bold mr-6 text-foreground">재고 기록</span>
          <div className="flex gap-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-t transition-colors',
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>
      <main className="p-3 max-w-[1024px] mx-auto">{children}</main>
    </div>
  );
}
