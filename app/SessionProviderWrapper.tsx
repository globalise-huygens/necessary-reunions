'use client';

import React from 'react';
import { SessionProvider } from 'next-auth/react';

interface SessionProviderWrapperProps {
  children: React.ReactNode;
}

export function SessionProviderWrapper({
  children,
}: SessionProviderWrapperProps) {
  return <SessionProvider>{children}</SessionProvider>;
}
