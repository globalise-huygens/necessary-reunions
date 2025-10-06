'use client';

// Import request blocker to initialize it client-side
import '@/lib/request-blocker';
import { clearAllBlocks, isRequestBlocked } from '@/lib/request-blocker';
import { useEffect, useState } from 'react';

interface EmergencyBlockerStatusProps {
  className?: string;
}

export function EmergencyBlockerStatus({
  className = '',
}: EmergencyBlockerStatusProps) {
  const [blockedUrls, setBlockedUrls] = useState<string[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const checkBlocked = () => {
      const commonUrls = [
        '/api/annotations/linking-bulk',
        '/api/annotations/linking',
        '/api/manifest',
      ];

      const blocked = commonUrls.filter((url) => isRequestBlocked(url));
      setBlockedUrls(blocked);
      setIsVisible(blocked.length > 0);
    };

    checkBlocked();
    const interval = setInterval(checkBlocked, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg z-50 ${className}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-bold">🚫 Request Blocker Active</h4>
          <p className="text-sm">
            Some API requests have been blocked due to repeated failures.
          </p>
          {blockedUrls.length > 0 && (
            <ul className="text-xs mt-1">
              {blockedUrls.map((url) => (
                <li key={url}>• {url}</li>
              ))}
            </ul>
          )}
        </div>
        <button
          onClick={() => {
            clearAllBlocks();
            setIsVisible(false);
          }}
          className="ml-4 bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600"
        >
          Unblock All
        </button>
      </div>
    </div>
  );
}
