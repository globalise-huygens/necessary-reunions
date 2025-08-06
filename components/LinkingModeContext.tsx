'use client';

import { PointSelector } from '@/lib/types';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

interface LinkingModeState {
  isLinkingMode: boolean;
  isPointSelectionMode: boolean;
  selectedAnnotationsForLinking: string[];
  selectedPoint: PointSelector | null;
  selectedGeotag: any | null;
  isDirty: boolean;
  lastSaved: number | null;
}

interface LinkingModeActions {
  setIsLinkingMode: (mode: boolean) => void;
  setIsPointSelectionMode: (mode: boolean) => void;
  addAnnotationToLinking: (annotationId: string) => void;
  removeAnnotationFromLinking: (annotationId: string) => void;
  clearLinkingSelection: () => void;
  exitLinkingMode: () => void;
  setPointSelectHandler: (handler: (point: PointSelector) => void) => void;
  setSelectedPoint: (point: PointSelector | null) => void;
  setSelectedGeotag: (geotag: any | null) => void;
  markDirty: () => void;
  markSaved: () => void;
  resetState: () => void;
  getContextualSaveMessage: () => string;
  getWorkflowSuggestion: () => string | null;
}

interface LinkingModeContextType extends LinkingModeState, LinkingModeActions {
  onPointSelect?: (point: PointSelector) => void;
  canSave: boolean;
  hasUnsavedChanges: boolean;
  getStateSnapshot: () => LinkingModeState;
  restoreStateSnapshot: (snapshot: LinkingModeState) => void;
}

const LinkingModeContext = createContext<LinkingModeContextType | undefined>(
  undefined,
);

const initialState: LinkingModeState = {
  isLinkingMode: false,
  isPointSelectionMode: false,
  selectedAnnotationsForLinking: [],
  selectedPoint: null,
  selectedGeotag: null,
  isDirty: false,
  lastSaved: null,
};

export function LinkingModeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<LinkingModeState>(initialState);
  const [onPointSelect, setOnPointSelect] = useState<
    ((point: PointSelector) => void) | undefined
  >();

  const stateHistoryRef = useRef<LinkingModeState[]>([]);
  const maxHistorySize = 10;

  const saveStateSnapshot = useCallback(() => {
    stateHistoryRef.current.push({ ...state });
    if (stateHistoryRef.current.length > maxHistorySize) {
      stateHistoryRef.current.shift();
    }
  }, [state]);

  const updateState = useCallback((updates: Partial<LinkingModeState>) => {
    setState((prev) => ({
      ...prev,
      ...updates,
      isDirty: updates.isDirty !== false,
    }));
  }, []);

  const setIsLinkingMode = useCallback(
    (mode: boolean) => {
      if (mode) {
        saveStateSnapshot();
      }
      updateState({ isLinkingMode: mode });
    },
    [updateState, saveStateSnapshot],
  );

  const setIsPointSelectionMode = useCallback(
    (mode: boolean) => {
      updateState({ isPointSelectionMode: mode });
    },
    [updateState],
  );

  const addAnnotationToLinking = useCallback((annotationId: string) => {
    setState((prev) => {
      if (prev.selectedAnnotationsForLinking.includes(annotationId)) {
        return prev;
      }

      return {
        ...prev,
        selectedAnnotationsForLinking: [
          ...prev.selectedAnnotationsForLinking,
          annotationId,
        ],
        isDirty: true,
      };
    });
  }, []);

  const removeAnnotationFromLinking = useCallback((annotationId: string) => {
    setState((prev) => {
      const newSelected = prev.selectedAnnotationsForLinking.filter(
        (id) => id !== annotationId,
      );
      if (newSelected.length === prev.selectedAnnotationsForLinking.length) {
        return prev;
      }

      return {
        ...prev,
        selectedAnnotationsForLinking: newSelected,
        isDirty: true,
      };
    });
  }, []);

  const clearLinkingSelection = useCallback(() => {
    updateState({
      selectedAnnotationsForLinking: [],
      selectedPoint: null,
      selectedGeotag: null,
    });
  }, [updateState]);

  const exitLinkingMode = useCallback(() => {
    updateState({
      isLinkingMode: false,
      isPointSelectionMode: false,
      selectedAnnotationsForLinking: [],
      selectedPoint: null,
      selectedGeotag: null,
      isDirty: false,
    });
  }, [updateState]);

  const setPointSelectHandler = useCallback(
    (handler: (point: PointSelector) => void) => {
      setOnPointSelect(() => handler);
    },
    [],
  );

  const setSelectedPoint = useCallback(
    (point: PointSelector | null) => {
      updateState({ selectedPoint: point });
    },
    [updateState],
  );

  const setSelectedGeotag = useCallback(
    (geotag: any | null) => {
      updateState({ selectedGeotag: geotag });
    },
    [updateState],
  );

  const markDirty = useCallback(() => {
    updateState({ isDirty: true });
  }, [updateState]);

  const markSaved = useCallback(() => {
    updateState({
      isDirty: false,
      lastSaved: Date.now(),
    });
  }, [updateState]);

  const resetState = useCallback(() => {
    setState(initialState);
    setOnPointSelect(undefined);
    stateHistoryRef.current = [];
  }, []);

  const getStateSnapshot = useCallback(() => ({ ...state }), [state]);

  const getContextualSaveMessage = useCallback(() => {
    const features = [];
    if (state.selectedAnnotationsForLinking.length > 0) {
      features.push(
        `${state.selectedAnnotationsForLinking.length} annotation${
          state.selectedAnnotationsForLinking.length > 1 ? 's' : ''
        }`,
      );
    }
    if (state.selectedGeotag) {
      const locationName =
        state.selectedGeotag.display_name || state.selectedGeotag.label;
      features.push(
        locationName ? `location "${locationName}"` : 'location data',
      );
    }
    if (state.selectedPoint) {
      features.push('point selection');
    }

    if (features.length === 0) {
      return 'No content selected for linking';
    }

    const featureText = features.join(', ');
    return state.isDirty
      ? `Save changes to linking with ${featureText}`
      : `Ready to create linking with ${featureText}`;
  }, [state]);

  const getWorkflowSuggestion = useCallback(() => {
    const hasContent =
      state.selectedAnnotationsForLinking.length > 0 ||
      state.selectedGeotag ||
      state.selectedPoint;

    if (!hasContent) {
      return 'Select annotations, add a location, or choose a point to start linking';
    }

    if (
      state.selectedAnnotationsForLinking.length === 1 &&
      !state.selectedGeotag &&
      !state.selectedPoint
    ) {
      return 'Add more annotations, a location, or a point to create a meaningful link';
    }

    if (state.selectedAnnotationsForLinking.length > 5) {
      return 'Consider splitting into smaller groups for better organization';
    }

    if (state.isDirty && hasContent) {
      return 'You have unsaved changes - click Save to preserve your work';
    }

    return null;
  }, [state]);

  const restoreStateSnapshot = useCallback((snapshot: LinkingModeState) => {
    setState(snapshot);
  }, []);

  const hasUnsavedChanges =
    state.isDirty &&
    (state.selectedAnnotationsForLinking.length > 0 ||
      state.selectedPoint !== null ||
      state.selectedGeotag !== null);

  const canSave =
    state.selectedAnnotationsForLinking.length > 0 ||
    state.selectedPoint !== null ||
    state.selectedGeotag !== null;

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue =
          'You have unsaved linking changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!state.isLinkingMode || !state.isDirty) return;

    const timeout = setTimeout(() => {
      if (hasUnsavedChanges) {
        console.warn('Auto-clearing linking selection due to inactivity');
        clearLinkingSelection();
      }
    }, 30 * 60 * 1000); // 30 minutes

    return () => clearTimeout(timeout);
  }, [
    state.isLinkingMode,
    state.isDirty,
    hasUnsavedChanges,
    clearLinkingSelection,
  ]);

  const contextValue: LinkingModeContextType = {
    ...state,
    onPointSelect,
    canSave,
    hasUnsavedChanges,
    setIsLinkingMode,
    setIsPointSelectionMode,
    addAnnotationToLinking,
    removeAnnotationFromLinking,
    clearLinkingSelection,
    exitLinkingMode,
    setPointSelectHandler,
    setSelectedPoint,
    setSelectedGeotag,
    markDirty,
    markSaved,
    resetState,
    getStateSnapshot,
    restoreStateSnapshot,
    getContextualSaveMessage,
    getWorkflowSuggestion,
  };

  return (
    <LinkingModeContext.Provider value={contextValue}>
      {children}
    </LinkingModeContext.Provider>
  );
}

export function useLinkingMode() {
  const context = useContext(LinkingModeContext);
  if (context === undefined) {
    throw new Error('useLinkingMode must be used within a LinkingModeProvider');
  }
  return context;
}

export function useLinkingModeHistory() {
  const context = useLinkingMode();
  const [history, setHistory] = useState<LinkingModeState[]>([]);

  useEffect(() => {
    const snapshot = context.getStateSnapshot();
    setHistory((prev) => {
      const newHistory = [...prev, snapshot];
      return newHistory.slice(-10);
    });
  }, [
    context.selectedAnnotationsForLinking,
    context.selectedPoint,
    context.selectedGeotag,
  ]);

  const canUndo = history.length > 1;

  const undo = useCallback(() => {
    if (canUndo) {
      const previousState = history[history.length - 2];
      context.restoreStateSnapshot(previousState);
      setHistory((prev) => prev.slice(0, -1));
    }
  }, [canUndo, history, context]);

  return {
    history,
    canUndo,
    undo,
  };
}
