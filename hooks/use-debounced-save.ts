import { useCallback, useEffect, useRef } from 'react';

interface UseDebouncedSaveOptions {
  delay?: number;
  onSave: (value: string) => Promise<void>;
  onError?: (error: Error) => void;
}

export function useDebouncedSave({
  delay = 800,
  onSave,
  onError,
}: UseDebouncedSaveOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSaveRef = useRef<string | null>(null);
  const isActiveRef = useRef(false);

  const debouncedSave = useCallback(
    (value: string) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      pendingSaveRef.current = value;
      isActiveRef.current = true;

      timeoutRef.current = setTimeout(async () => {
        if (pendingSaveRef.current !== null && isActiveRef.current) {
          try {
            await onSave(pendingSaveRef.current);
          } catch (error) {
            onError?.(error as Error);
          } finally {
            pendingSaveRef.current = null;
          }
        }
      }, delay);
    },
    [delay, onSave, onError],
  );

  const cancelSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    pendingSaveRef.current = null;
    isActiveRef.current = false;
  }, []);

  const saveImmediately = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (pendingSaveRef.current !== null && isActiveRef.current) {
      try {
        await onSave(pendingSaveRef.current);
      } catch (error) {
        onError?.(error as Error);
        throw error;
      } finally {
        pendingSaveRef.current = null;
      }
    }
  }, [onSave, onError]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    debouncedSave,
    cancelSave,
    saveImmediately,
    hasPendingSave: pendingSaveRef.current !== null,
  };
}
