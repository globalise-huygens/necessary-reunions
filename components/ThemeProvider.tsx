'use client';

import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps as NextThemesProviderProps,
} from 'next-themes';
import * as React from 'react';

export interface ThemeProviderProps extends NextThemesProviderProps {}
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
