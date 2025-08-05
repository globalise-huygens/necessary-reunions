'use client';

import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';

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

  useEffect(() => {
    validateLinkingData();
  }, [linkedIds, selectedGeotag, selectedPoint]);

  const validateLinkingData = async () => {
    const newIssues: ValidationIssue[] = [];

    if (linkedIds.length === 0 && !selectedGeotag && !selectedPoint) {
      newIssues.push({
        type: 'error',
        message: 'Select annotations, add location, or pick a point',
        severity: 'high',
      });
    }

    // Simple success message - no slow API calls
    if (linkedIds.length > 0 && newIssues.length === 0) {
      newIssues.push({
        type: 'info',
        message: `Ready to link ${linkedIds.length} annotations`,
        severity: 'low',
      });
    }

    setIssues(newIssues);

    const hasErrors = newIssues.some((issue) => issue.type === 'error');
    onValidationChange?.(!hasErrors, newIssues);
  };

  const getIcon = (type: ValidationIssue['type']) => {
    switch (type) {
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-600" />;
      default:
        return <CheckCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getIssueStyle = (type: ValidationIssue['type']) => {
    switch (type) {
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-orange-50 border-orange-200 text-orange-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <span>Ready to save</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {issues.map((issue, index) => (
        <div
          key={index}
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
