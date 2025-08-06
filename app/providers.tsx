'use client';
import { LinkingModeProvider } from '@/components/viewer/LinkingModeContext';
import { SessionProvider } from 'next-auth/react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LinkingModeProvider>{children}</LinkingModeProvider>
    </SessionProvider>
  );
}
