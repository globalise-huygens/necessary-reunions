/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
'use client';

import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import React, { useState } from 'react';

interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  severity: 'high' | 'medium' | 'low';
}

interface LinkingPreValidationProps {
  linkedIds: string[];
  selectedGeotag?: any;
  selectedPoint?: { x: number; y: number } | null;
  onValidationChange?: (isValid: boolean, issues: ValidationIssue[]) => void;
}

export const LinkingPreValidation: React.FC<LinkingPreValidationProps> = ({
  linkedIds,
  selectedGeotag,
  selectedPoint,
  onValidationChange,
}) => {
  const [issues, setIssues] = useState<ValidationIssue[]>([]);

  const validateLinkingData = React.useCallback(() => {
    const newIssues: ValidationIssue[] = [];

    const hasLinkedAnnotations = linkedIds && linkedIds.length > 1;
    const hasGeotag =
      selectedGeotag &&
      (selectedGeotag.lat ||
        selectedGeotag.geometry ||
        selectedGeotag.coordinates);
    const hasPoint =
      selectedPoint &&
      typeof selectedPoint.x === 'number' &&
      typeof selectedPoint.y === 'number';

    if (!hasLinkedAnnotations && !hasGeotag && !hasPoint) {
      newIssues.push({
        type: 'error',
        message: 'Nothing to save yet',
        severity: 'high',
      });
    } else {
      if (linkedIds && linkedIds.length === 1) {
        newIssues.push({
          type: 'info',
          message: 'Only one annotation selected - need at least 2 for linking',
          severity: 'medium',
        });
      }

      if (selectedGeotag && !selectedGeotag.lat && !selectedGeotag.geometry) {
        newIssues.push({
          type: 'warning',
          message: 'Geotag data appears incomplete',
          severity: 'medium',
        });
      }

      if (selectedPoint && (selectedPoint.x === 0 || selectedPoint.y === 0)) {
        newIssues.push({
          type: 'warning',
          message: 'Point selection may be at origin (0,0)',
          severity: 'low',
        });
      }
    }

    setIssues(newIssues);

    const hasErrors = newIssues.some((issue) => issue.type === 'error');
    onValidationChange?.(!hasErrors, newIssues);
  }, [linkedIds, selectedGeotag, selectedPoint, onValidationChange]);

  React.useEffect(() => {
    validateLinkingData();
  }, [validateLinkingData]);

  const getIcon = (type: ValidationIssue['type']) => {
    switch (type) {
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-chart-1" />;
      case 'info':
        return <Info className="h-4 w-4 text-primary" />;
      default:
        return <CheckCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getIssueStyle = (type: ValidationIssue['type']) => {
    switch (type) {
      case 'error':
        return 'bg-destructive/10 border-destructive/30 text-destructive';
      case 'warning':
        return 'bg-chart-1/10 border-chart-1/30 text-chart-1';
      case 'info':
        return 'bg-primary/10 border-primary/30 text-primary';
      default:
        return 'bg-muted/50 border-border text-muted-foreground';
    }
  };

  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 p-2 bg-chart-2/10 border border-chart-2/30 rounded text-xs text-chart-2">
        <CheckCircle className="h-4 w-4 text-chart-2" />
        <span>Ready to save</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {issues.map((issue) => (
        <div
          key={`${issue.type}-${issue.message}`}
          className={`flex items-start gap-2 p-2 border rounded text-xs ${getIssueStyle(
            issue.type,
          )}`}
        >
          <div className="mt-0.5 flex-shrink-0">{getIcon(issue.type)}</div>
          <div className="flex-1">{issue.message}</div>
        </div>
      ))}
    </div>
  );
};
