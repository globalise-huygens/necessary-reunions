import { useCallback, useRef, useState } from 'react';

export function useDebouncedExpansion(delay = 100) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const timeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  const setExpandedDebounced = useCallback(
    (id: string, value: boolean) => {
      // Clear existing timeout for this id
      if (timeoutRef.current[id]) {
        clearTimeout(timeoutRef.current[id]);
      }

      // Set new timeout
      timeoutRef.current[id] = setTimeout(() => {
        setExpanded((prev) => ({
          ...prev,
          [id]: value,
        }));
        delete timeoutRef.current[id];
      }, delay);
    },
    [delay],
  );

  const toggleExpanded = useCallback(
    (id: string) => {
      const currentState = expanded[id] || false;
      setExpandedDebounced(id, !currentState);
    },
    [expanded, setExpandedDebounced],
  );

  const setExpandedImmediate = useCallback(
    (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => {
      setExpanded(updater);
    },
    [],
  );

  const setExpandedById = useCallback((id: string, value: boolean) => {
    // Clear any pending timeout
    if (timeoutRef.current[id]) {
      clearTimeout(timeoutRef.current[id]);
      delete timeoutRef.current[id];
    }

    setExpanded((prev) => ({
      ...prev,
      [id]: value,
    }));
  }, []);

  return {
    expanded,
    setExpanded: setExpandedImmediate,
    setExpandedById,
    setExpandedDebounced,
    toggleExpanded,
  };
}
