'use client';

import { useEffect, useState } from 'react';

export function HydrationTest() {
  const [clientTime, setClientTime] = useState<string>('');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setClientTime(new Date().toLocaleTimeString());
  }, []);

  return (
    <div className="p-4 bg-yellow-100 border border-yellow-300 rounded">
      <h3 className="font-bold">Hydration Test</h3>
      <p>
        Render Environment:{' '}
        {typeof window === 'undefined' ? 'server' : 'client'}
      </p>
      <p>useEffect executed: {isClient ? 'YES' : 'NO'}</p>
      <p>Client time: {clientTime || 'Not available'}</p>
    </div>
  );
}
