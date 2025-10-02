'use client';

import { Button } from '@/components/shared/Button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ApiFailureNoticeProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  canRetry?: boolean;
}

export function ApiFailureNotice({
  title = 'Service Temporarily Unavailable',
  message = 'Some features may be limited while external services are experiencing issues.',
  onRetry,
  canRetry = true,
}: ApiFailureNoticeProps) {
  return (
    <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-medium">{title}</div>
        <div className="text-amber-700">{message}</div>
      </div>
      {canRetry && onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="flex-shrink-0 border-amber-300 text-amber-800 hover:bg-amber-100"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      )}
    </div>
  );
}
