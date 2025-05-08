'use client';

import { signIn } from 'next-auth/react';
import { Button } from '@/components/Button';
import { LogIn } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <h1 className="text-3xl font-semibold mb-4">Access Denied</h1>
      <p className="mb-6 text-center max-w-md">
        The ORCID iD provided is not authorised to access this application.
        Please contact the administrator if access should be granted.
      </p>
      <Button
        onClick={() => signIn('orcid', { callbackUrl: window.location.origin })}
        variant="secondary"
      >
        <LogIn className="h-4 w-4 mr-1" />
        Try Signing In Again
      </Button>
    </div>
  );
}
