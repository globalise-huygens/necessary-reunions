'use client';
import { ThemeProvider } from '../components/ThemeProvider';
import { LinkingModeProvider } from '../components/viewer/LinkingModeContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <LinkingModeProvider>{children}</LinkingModeProvider>
    </ThemeProvider>
  );
}
