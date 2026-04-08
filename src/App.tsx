import { useEffect, useState } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { auth } from '@/lib/firebase';
import { clearFirestoreSession, connectFirestoreSession } from '@/lib/firestoreSync';
import LoginScreen from './pages/LoginScreen';
import Index from './pages/Index.tsx';
import NotFound from './pages/NotFound.tsx';

const queryClient = new QueryClient();

function AppShell() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [syncReady, setSyncReady] = useState(false);
  const userId = user?.uid ?? null;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    if (!userId) {
      setSyncReady(false);
      void clearFirestoreSession();
      return () => {
        cancelled = true;
        cleanup?.();
      };
    }

    setSyncReady(false);
    void connectFirestoreSession(userId)
      .then((unsubscribe) => {
        if (cancelled) {
          unsubscribe();
          return;
        }
        cleanup = unsubscribe;
        setSyncReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setSyncReady(true);
        }
      });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [userId]);

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-sm text-muted-foreground">
        로그인 확인 중...
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (!syncReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-sm text-muted-foreground">
        데이터 불러오는 중...
      </div>
    );
  }

  return <Index />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename="/order-helper-korean">
        <Routes>
          <Route path="/" element={<AppShell />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
