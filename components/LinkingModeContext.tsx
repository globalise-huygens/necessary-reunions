'use client';

import { PointSelector } from '@/lib/types';
import React, { createContext, useContext, useState } from 'react';

interface LinkingModeContextType {
  isLinkingMode: boolean;
  isPointSelectionMode: boolean;
  selectedAnnotationsForLinking: string[];
  setIsLinkingMode: (mode: boolean) => void;
  setIsPointSelectionMode: (mode: boolean) => void;
  addAnnotationToLinking: (annotationId: string) => void;
  removeAnnotationFromLinking: (annotationId: string) => void;
  clearLinkingSelection: () => void;
  onPointSelect?: (point: PointSelector) => void;
  setPointSelectHandler: (handler: (point: PointSelector) => void) => void;
}

const LinkingModeContext = createContext<LinkingModeContextType | undefined>(undefined);

export function LinkingModeProvider({ children }: { children: React.ReactNode }) {
  const [isLinkingMode, setIsLinkingMode] = useState(false);
  const [isPointSelectionMode, setIsPointSelectionMode] = useState(false);
  const [selectedAnnotationsForLinking, setSelectedAnnotationsForLinking] = useState<string[]>([]);
  const [onPointSelect, setOnPointSelect] = useState<((point: PointSelector) => void) | undefined>();

  const addAnnotationToLinking = (annotationId: string) => {
    setSelectedAnnotationsForLinking(prev => 
      prev.includes(annotationId) ? prev : [...prev, annotationId]
    );
  };

  const removeAnnotationFromLinking = (annotationId: string) => {
    setSelectedAnnotationsForLinking(prev => 
      prev.filter(id => id !== annotationId)
    );
  };

  const clearLinkingSelection = () => {
    setSelectedAnnotationsForLinking([]);
  };

  const setPointSelectHandler = (handler: (point: PointSelector) => void) => {
    setOnPointSelect(() => handler);
  };

  return (
    <LinkingModeContext.Provider value={{
      isLinkingMode,
      isPointSelectionMode,
      selectedAnnotationsForLinking,
      setIsLinkingMode,
      setIsPointSelectionMode,
      addAnnotationToLinking,
      removeAnnotationFromLinking,
      clearLinkingSelection,
      onPointSelect,
      setPointSelectHandler,
    }}>
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
