'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shared/Card';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Progress } from '@/components/shared/Progress';
import { CheckCircle, Circle, Loader2 } from 'lucide-react';
import React from 'react';

interface LoadingStep {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'complete' | 'error';
  description?: string;
}

interface ManifestLoadingProps {
  steps: LoadingStep[];
  currentStep?: string;
  progress?: number;
}

export function ManifestLoading({
  steps,
  currentStep,
  progress,
}: ManifestLoadingProps) {
  const completedSteps = steps.filter(
    (step) => step.status === 'complete',
  ).length;
  const progressPercent = progress ?? (completedSteps / steps.length) * 100;

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="font-medium">Loading Collection</h3>
          <p className="text-sm text-muted-foreground">
            Please wait while we prepare your collection...
          </p>
        </div>

        <Progress value={progressPercent} className="w-full" />

        <div className="space-y-3">
          {steps.map((step) => (
            <div key={step.id} className="flex items-center gap-3">
              <div className="flex-shrink-0">
                {step.status === 'complete' && (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                )}
                {step.status === 'loading' && (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                )}
                {step.status === 'pending' && (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
                {step.status === 'error' && (
                  <Circle className="h-5 w-5 text-red-600" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    step.status === 'complete'
                      ? 'text-green-600'
                      : step.status === 'loading'
                      ? 'text-blue-600'
                      : step.status === 'error'
                      ? 'text-red-600'
                      : 'text-muted-foreground'
                  }`}
                >
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-xs text-muted-foreground">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export const defaultLoadingSteps: LoadingStep[] = [
  {
    id: 'fetch',
    label: 'Fetching collection data',
    status: 'pending',
    description: 'Downloading collection information...',
  },
  {
    id: 'validate',
    label: 'Validating format',
    status: 'pending',
    description: 'Checking collection structure...',
  },
  {
    id: 'normalize',
    label: 'Processing content',
    status: 'pending',
    description: 'Normalizing collection format...',
  },
  {
    id: 'annotations',
    label: 'Loading annotations',
    status: 'pending',
    description: 'Merging local annotations...',
  },
  {
    id: 'geo',
    label: 'Checking map data',
    status: 'pending',
    description: 'Looking for georeferencing information...',
  },
  {
    id: 'complete',
    label: 'Ready to view',
    status: 'pending',
    description: 'Collection is ready for exploration',
  },
];
