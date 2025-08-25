'use client';
import { LinkingModeProvider } from '@/components/viewer/LinkingModeContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return <LinkingModeProvider>{children}</LinkingModeProvider>;
}
