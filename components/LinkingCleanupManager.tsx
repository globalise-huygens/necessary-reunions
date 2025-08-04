'use client';

import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { LoadingSpinner } from './LoadingSpinner';

interface CleanupAnalysis {
  totalAnnotations: number;
  uniqueGroups: number;
  duplicatesToDelete: number;
  structuralFixes: number;
  annotationsToKeep: number;
  totalLinkingRelationships: number;
  duplicateGroups: Array<{
    targets: string[];
    annotations: Array<{
      id: string;
      created: string;
      modified: string;
      bodyCount: number;
      bodies: any[];
    }>;
  }>;
  structuralFixGroups: Array<{
    targets: string[];
    annotation: {
      id: string;
      created: string;
      modified: string;
      bodyCount: number;
      bodies: any[];
      issues: string[];
    };
  }>;
  singleAnnotations: Array<{
    id: string;
    created: string;
    modified: string;
    target: any;
    bodyCount: number;
    bodies: any[];
    bodyPurposes: string[];
    linkedAnnotationsCount: number;
  }>;
  singleAnnotationsSample: string;
}

interface CleanupResult {
  success: boolean;
  dryRun?: boolean;
  message: string;
  analysis?: CleanupAnalysis;
  summary?: {
    totalAnalyzed: number;
    groupsConsolidated: number;
    structuralFixes: number;
    annotationsDeleted: number;
    annotationsCreated: number;
    annotationsKept: number;
  };
  details?: Array<{
    type?: string;
    targets: string[];
    originalId?: string;
    fixedId?: string;
    consolidatedId?: string;
    deletedIds?: string[];
    bodyCount?: number;
    issues?: string[];
    hadStructuralIssues?: boolean;
    error?: string;
  }>;
}

export function LinkingCleanupManager() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [showAllStructural, setShowAllStructural] = useState(false);
  const [showAllCorrect, setShowAllCorrect] = useState(false);

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    setShowAllStructural(false);
    setShowAllCorrect(false);

    try {
      const response = await fetch('/api/annotations/linking/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'analyze',
          dryRun: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setResult(data);
      console.log('Analysis result:', data.analysis);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze annotations');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runCleanup = async () => {
    setIsCleaning(true);
    setError(null);

    try {
      const response = await fetch('/api/annotations/linking/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'cleanup-duplicates',
          dryRun: false,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to perform cleanup');
    } finally {
      setIsCleaning(false);
    }
  };

  const formatAnnotationId = (id: string) => {
    const parts = id.split('/');
    return parts[parts.length - 1].substring(0, 8) + '...';
  };

  const getFullAnnotationId = (id: string) => {
    const parts = id.split('/');
    return parts[parts.length - 1];
  };

  const getAnnotationLink = (id: string) => {
    return `https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/${getFullAnnotationId(
      id,
    )}`;
  };

  const getAnnoRepoPageLink = (pageNumber: number) => {
    return `https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions?page=${pageNumber}`;
  };

  const formatTargetList = (targets: string[] | any) => {
    if (Array.isArray(targets)) {
      return targets.map(formatAnnotationId).join(', ');
    }
    if (typeof targets === 'string') {
      return formatAnnotationId(targets);
    }
    return 'Unknown targets';
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2 text-primary">
          Linking Annotation Cleanup
        </h1>
        <p className="text-muted-foreground mb-6">
          Managing annotation data structure integrity
        </p>

        <div className="bg-muted border border-border rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold text-primary mb-3">
            Quick Navigation
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <a
              href={getAnnoRepoPageLink(232)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 bg-card border border-border rounded-lg hover:bg-accent/10 hover:text-primary transition-colors"
            >
              <div>
                <div className="font-medium text-primary">Page 232</div>
                <div className="text-xs text-muted-foreground">AnnoRepo ↗</div>
              </div>
            </a>
            <a
              href={getAnnoRepoPageLink(233)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 bg-card border border-border rounded-lg hover:bg-accent/10 hover:text-primary transition-colors"
            >
              <div>
                <div className="font-medium text-primary">Page 233</div>
                <div className="text-xs text-muted-foreground">AnnoRepo ↗</div>
              </div>
            </a>
            <a
              href={getAnnoRepoPageLink(234)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 bg-card border border-border rounded-lg hover:bg-accent/10 hover:text-primary transition-colors"
            >
              <div>
                <div className="font-medium text-primary">Page 234</div>
                <div className="text-xs text-muted-foreground">AnnoRepo ↗</div>
              </div>
            </a>
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-4">
        <Button
          onClick={runAnalysis}
          disabled={isAnalyzing || isCleaning}
          className="flex items-center gap-2"
        >
          {isAnalyzing && <LoadingSpinner />}
          {isAnalyzing ? 'Analyzing...' : 'Analyze Annotations'}
        </Button>

        {result?.analysis && (
          <Button
            onClick={runCleanup}
            disabled={isCleaning || isAnalyzing}
            variant="destructive"
            className="flex items-center gap-2"
          >
            {isCleaning && <LoadingSpinner />}
            {isCleaning ? 'Processing...' : 'Run Cleanup'}
          </Button>
        )}
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <h3 className="font-semibold text-destructive">Error</h3>
          <p className="text-destructive mt-1">{error}</p>
        </div>
      )}

      {result?.analysis && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-primary">
              Analysis Results
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {result.analysis.totalAnnotations}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Annotations
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent-foreground">
                  {result.analysis.totalLinkingRelationships}
                </div>
                <div className="text-sm text-muted-foreground">
                  Linking Relations
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-secondary">
                  {result.analysis.structuralFixes}
                </div>
                <div className="text-sm text-muted-foreground">Need Fixes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-destructive">
                  {result.analysis.duplicatesToDelete}
                </div>
                <div className="text-sm text-muted-foreground">Duplicates</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {result.analysis.annotationsToKeep}
                </div>
                <div className="text-sm text-muted-foreground">
                  Already Correct
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent-foreground">
                  {result.analysis.uniqueGroups}
                </div>
                <div className="text-sm text-muted-foreground">
                  Groups to Process
                </div>
              </div>
            </div>

            {(result.analysis.structuralFixes > 0 ||
              result.analysis.duplicatesToDelete > 0) && (
              <div className="bg-secondary/10 border border-secondary/20 rounded-lg p-4">
                <h3 className="font-semibold text-secondary">
                  Actions Required
                </h3>
                <ul className="list-disc list-inside mt-2 space-y-1 text-secondary-foreground">
                  {result.analysis.structuralFixes > 0 && (
                    <li>
                      Fix structural issues in {result.analysis.structuralFixes}{' '}
                      annotations
                    </li>
                  )}
                  {result.analysis.duplicatesToDelete > 0 && (
                    <li>
                      Consolidate {result.analysis.duplicatesToDelete} duplicate
                      annotations
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {result.analysis.structuralFixGroups &&
            result.analysis.structuralFixGroups.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-primary">
                    Structural Issues Found (
                    {result.analysis.structuralFixGroups.length})
                  </h3>
                  {result.analysis.structuralFixGroups.length > 10 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowAllStructural(!showAllStructural);
                      }}
                    >
                      {showAllStructural ? 'Show Less' : 'Show All'}
                    </Button>
                  )}
                </div>
                <div className="space-y-3 border border-border rounded-lg p-4 bg-muted">
                  {(() => {
                    const allItems = result.analysis?.structuralFixGroups || [];
                    let itemsToDisplay;

                    if (showAllStructural) {
                      itemsToDisplay = allItems; // Show all items
                    } else {
                      itemsToDisplay = allItems.slice(0, 10); // Show only first 10
                    }

                    return itemsToDisplay;
                  })().map((group, index) => (
                    <div
                      key={`structural-${group.annotation.id}-${index}`}
                      className="border border-border rounded-lg p-4 bg-card hover:bg-accent/10 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-primary">
                              Annotation{' '}
                              {formatAnnotationId(group.annotation.id)}
                            </p>
                            <a
                              href={getAnnotationLink(group.annotation.id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:text-secondary underline"
                            >
                              View in AnnoRepo ↗
                            </a>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            <strong>Full ID:</strong>{' '}
                            {getFullAnnotationId(group.annotation.id)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            <strong>Targets:</strong>{' '}
                            {formatTargetList(group.targets)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Created:{' '}
                            {new Date(
                              group.annotation.created,
                            ).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <strong>Linked to:</strong> {group.targets.length}{' '}
                            annotation{group.targets.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                          {group.annotation.bodyCount} bodies
                        </span>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-primary">
                          Issues to Fix:
                        </h4>
                        {group.annotation.issues.map((issue, issueIndex) => (
                          <div
                            key={issueIndex}
                            className="text-sm text-secondary-foreground bg-secondary/20 px-3 py-2 rounded border-l-4 border-secondary"
                          >
                            {issue}
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 p-3 bg-muted rounded border border-border">
                        <h5 className="text-xs font-medium text-primary mb-2">
                          Current Body Structure:
                        </h5>
                        <pre className="text-xs text-muted-foreground overflow-x-auto max-h-32">
                          {JSON.stringify(group.annotation.bodies, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {result.analysis.duplicateGroups &&
            result.analysis.duplicateGroups.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4 text-primary">
                  Duplicate Groups Found (
                  {result.analysis.duplicateGroups.length})
                </h3>
                <div className="space-y-4">
                  {result.analysis.duplicateGroups.map((group, index) => (
                    <div
                      key={index}
                      className="border border-border rounded-lg p-4 bg-destructive/10"
                    >
                      <p className="font-medium mb-2 text-destructive">
                        Targets: {formatTargetList(group.targets)} (
                        {group.targets.length} linked annotation
                        {group.targets.length !== 1 ? 's' : ''})
                      </p>
                      <div className="space-y-2">
                        {group.annotations.map((annotation, annIndex) => (
                          <div
                            key={annIndex}
                            className="flex items-center justify-between bg-card p-2 rounded border border-border"
                          >
                            <span className="text-sm text-foreground">
                              {formatAnnotationId(annotation.id)}
                            </span>
                            <div className="flex gap-2 items-center">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                                {annotation.bodyCount} bodies
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(
                                  annotation.created,
                                ).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {result.analysis.singleAnnotations &&
            result.analysis.singleAnnotations.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-primary">
                    Correctly Structured Annotations
                  </h3>
                  {result.analysis.singleAnnotations.length > 20 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAllCorrect(!showAllCorrect)}
                    >
                      {showAllCorrect ? 'Show Less' : 'Show All'}
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {result.analysis.singleAnnotationsSample}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {result.analysis.singleAnnotations
                    .slice(0, showAllCorrect ? undefined : 20)
                    .map((annotation, index) => (
                      <div
                        key={`correct-${annotation.id}-${index}`}
                        className="border border-border rounded p-3 bg-muted text-sm"
                      >
                        <div className="font-medium text-primary">
                          {formatAnnotationId(annotation.id)}
                        </div>
                        <div className="text-muted-foreground">
                          {annotation.bodyCount} bodies •{' '}
                          {annotation.bodyPurposes.join(', ') || 'No purposes'}{' '}
                          • {annotation.linkedAnnotationsCount} linked
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
        </div>
      )}

      {result?.summary && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-semibold text-primary mb-4">
              Cleanup Completed Successfully
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {result.summary.totalAnalyzed}
                </div>
                <div className="text-sm text-muted-foreground">Analyzed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-secondary">
                  {result.summary.structuralFixes}
                </div>
                <div className="text-sm text-muted-foreground">Fixed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent-foreground">
                  {result.summary.groupsConsolidated}
                </div>
                <div className="text-sm text-muted-foreground">
                  Consolidated
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-destructive">
                  {result.summary.annotationsDeleted}
                </div>
                <div className="text-sm text-muted-foreground">Deleted</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {result.summary.annotationsCreated}
                </div>
                <div className="text-sm text-muted-foreground">Created</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-muted-foreground">
                  {result.summary.annotationsKept}
                </div>
                <div className="text-sm text-muted-foreground">Kept</div>
              </div>
            </div>

            <div className="bg-muted rounded-lg p-4">
              <h3 className="font-semibold text-primary mb-2">
                Cleanup Summary
              </h3>
              <p className="text-foreground">{result.message}</p>
              <div className="mt-2 space-y-1 text-foreground">
                <p>Fixed {result.summary.structuralFixes} structural issues</p>
                <p>
                  Consolidated {result.summary.groupsConsolidated} duplicate
                  groups
                </p>
                <p>
                  Maintained {result.summary.annotationsKept} correct
                  annotations
                </p>
              </div>
            </div>
          </div>

          {result.details && result.details.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 text-primary">
                Detailed Results ({result.details.length})
              </h3>
              <div className="space-y-3">
                {result.details.map((detail, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 ${
                      detail.error
                        ? 'bg-destructive/10 border-destructive/20'
                        : detail.type === 'structural-fix'
                        ? 'bg-secondary/10 border-secondary/20'
                        : 'bg-muted border-border'
                    }`}
                  >
                    {detail.error ? (
                      <div>
                        <p className="font-medium text-destructive">
                          Error processing {formatTargetList(detail.targets)}
                        </p>
                        <p className="text-sm text-destructive">
                          {detail.error}
                        </p>
                      </div>
                    ) : detail.type === 'structural-fix' ? (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-secondary">
                            Structural Fix
                          </p>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                            Fixed
                          </span>
                        </div>
                        <p className="text-sm text-foreground">
                          {formatAnnotationId(detail.originalId!)} →{' '}
                          {formatAnnotationId(detail.fixedId!)}
                        </p>
                        <div className="mt-2 space-y-1">
                          {detail.issues?.map((issue, issueIndex) => (
                            <p
                              key={issueIndex}
                              className="text-xs text-secondary-foreground bg-secondary/20 px-2 py-1 rounded"
                            >
                              {issue}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-primary">
                            Consolidation
                          </p>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary text-primary-foreground">
                            {detail.bodyCount} bodies
                          </span>
                        </div>
                        <p className="text-sm text-foreground">
                          {detail.deletedIds?.length} duplicates →{' '}
                          {formatAnnotationId(detail.consolidatedId!)}
                        </p>
                        {detail.hadStructuralIssues && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Also fixed structural issues
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-center">
            <Button onClick={() => setResult(null)} variant="secondary">
              Run Another Analysis
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
