'use client';

import { useEffect } from 'react';

export function ConsoleFilter() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const originalLog = console.log;
      const originalInfo = console.info;
      const originalDebug = console.debug;

      const filterMessage = (message: string) => {
        return (
          message.includes('[SW]') ||
          message.includes('Fetching fresh') ||
          message.includes('Serving from cache') ||
          message.includes('Serving static asset') ||
          message.includes('Serving image')
        );
      };

      console.log = function (...args) {
        const message = args.join(' ');
        if (!filterMessage(message)) {
          originalLog.apply(console, args);
        }
      };

      console.info = function (...args) {
        const message = args.join(' ');
        if (!filterMessage(message)) {
          originalInfo.apply(console, args);
        }
      };

      console.debug = function (...args) {
        const message = args.join(' ');
        if (!filterMessage(message)) {
          originalDebug.apply(console, args);
        }
      };

      return () => {
        console.log = originalLog;
        console.info = originalInfo;
        console.debug = originalDebug;
      };
    }
  }, []);

  return null;
}
