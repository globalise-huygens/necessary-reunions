'use client';

import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import React, { useEffect, useState } from 'react';

interface CleanupAnalysis {
  totalAnnotations: number;
  uniqueGroups: number;
  duplicatesToDelete: number;
  structuralFixes: number;
  annotationsToKeep: number;
  totalLinkingRelationships: number;
  // Orphaned targets analysis
  totalLinkingAnnotations?: number;
  annotationsWithOrphanedTargets?: number;
  annotationsToDelete?: number;
  annotationsToRepair?: number;
  totalOrphanedTargets?: number;
  annotationDetails?: Array<{
    id: string;
    shortId: string;
    targetAnalysis: {
      hasOrphanedTargets: boolean;
      validTargets: string[];
      orphanedTargets: string[];
      totalTargets: number;
      validTargetCount: number;
      orphanedTargetCount: number;
      details: Array<{
        target: string;
        exists: boolean;
        error?: string;
      }>;
    };
    shouldDelete: boolean;
    deleteReason?: string;
    created?: string;
    modified?: string;
  }>;
  textspottingAnalysis?: {
    totalTextspottingAnnotations: number;
    annotationsWithIncorrectCreators: number;
    annotationsWithOverwrittenAI: number;
    annotationsNeedingBodyRestructure: number;
    correctlyStructuredAnnotations: number;
    problematicAnnotations: Array<{
      id: string;
      issues: string[];
      bodies: any[];
      hasAnnotationLevelCreator: boolean;
      hasHumanEditedBodies: boolean;
      hasAIBodies: boolean;
      suspectedOverwrittenAI: boolean;
    }>;
  };
  iconographyAnalysis?: {
    totalIconographyAnnotations: number;
    annotationsWithTypo: number;
    annotationsWithEmptyTextualBody: number;
    annotationsWithIncorrectBody: number;
    annotationsWithMissingBodyArray: number;
    annotationsWithNonArrayBody: number;
    annotationsWithHumanModifications: number;
    annotationsWithMissingCreator: number;
    correctlyStructuredAnnotations: number;
    problematicAnnotations: Array<{
      id: string;
      issues: string[];
      motivation: string;
      body: any[];
      hasGenerator: boolean;
      hasEmptyTextualBody: boolean;
      hasTypoInMotivation: boolean;
      hasEmptyBodyArray: boolean;
      hasMissingBodyArray: boolean;
      hasNonArrayBody: boolean;
      hasHumanModifications: boolean;
      missingCreator: boolean;
    }>;
  };
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
  const [isAnalyzingTextspotting, setIsAnalyzingTextspotting] = useState(false);
  const [isCleaningTextspotting, setIsCleaningTextspotting] = useState(false);
  const [isAnalyzingIconography, setIsAnalyzingIconography] = useState(false);
  const [isCleaningIconography, setIsCleaningIconography] = useState(false);
  const [isAnalyzingOrphaned, setIsAnalyzingOrphaned] = useState(false);
  const [isCleaningOrphaned, setIsCleaningOrphaned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [textspottingResult, setTextspottingResult] =
    useState<CleanupResult | null>(null);
  const [iconographyResult, setIconographyResult] =
    useState<CleanupResult | null>(null);
  const [orphanedResult, setOrphanedResult] = useState<CleanupResult | null>(
    null,
  );
  const [showAllStructural, setShowAllStructural] = useState(false);
  const [showAllCorrect, setShowAllCorrect] = useState(false);
  const [showAllTextspotting, setShowAllTextspotting] = useState(false);
  const [showAllIconography, setShowAllIconography] = useState(false);
  const [showAllOrphaned, setShowAllOrphaned] = useState(false);

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

  const runTextspottingAnalysis = async () => {
    setIsAnalyzingTextspotting(true);
    setError(null);
    setTextspottingResult(null);

    try {
      const response = await fetch('/api/annotations/textspotting/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'analyze-textspotting',
          dryRun: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setTextspottingResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze textspotting annotations');
    } finally {
      setIsAnalyzingTextspotting(false);
    }
  };

  const runTextspottingCleanup = async () => {
    setIsCleaningTextspotting(true);
    setError(null);

    try {
      const response = await fetch('/api/annotations/textspotting/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'fix-textspotting-structure',
          dryRun: false,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setTextspottingResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to perform textspotting cleanup');
    } finally {
      setIsCleaningTextspotting(false);
    }
  };

  const runIconographyAnalysis = async () => {
    setIsAnalyzingIconography(true);
    setError(null);
    setIconographyResult(null);

    try {
      const response = await fetch('/api/annotations/iconography/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'analyze-iconography',
          dryRun: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setIconographyResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze iconography annotations');
    } finally {
      setIsAnalyzingIconography(false);
    }
  };

  const runIconographyCleanup = async () => {
    setIsCleaningIconography(true);
    setError(null);

    try {
      const response = await fetch('/api/annotations/iconography/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'fix-iconography-structure',
          dryRun: false,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setIconographyResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to perform iconography cleanup');
    } finally {
      setIsCleaningIconography(false);
    }
  };

  const runOrphanedAnalysis = async () => {
    setIsAnalyzingOrphaned(true);
    setError(null);
    setOrphanedResult(null);

    try {
      const response = await fetch('/api/annotations/linking/orphaned', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'analyze-orphaned',
          dryRun: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setOrphanedResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze orphaned targets');
    } finally {
      setIsAnalyzingOrphaned(false);
    }
  };

  const runOrphanedCleanup = async () => {
    setIsCleaningOrphaned(true);
    setError(null);

    try {
      const response = await fetch('/api/annotations/linking/orphaned', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'fix-orphaned',
          dryRun: false,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setOrphanedResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to perform orphaned targets cleanup');
    } finally {
      setIsCleaningOrphaned(false);
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
          Annotation Cleanup
        </h1>
        <p className="text-muted-foreground mb-6">
          Fix and organize annotation data
        </p>
      </div>

      {/* Cleanup Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Linking Annotations */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2 text-primary">Linking</h2>
          <p className="text-muted-foreground mb-4 text-sm">
            Fix duplicates and structural issues
          </p>

          <div className="space-y-2">
            <Button
              onClick={runAnalysis}
              disabled={
                isAnalyzing ||
                isCleaning ||
                isAnalyzingTextspotting ||
                isCleaningTextspotting ||
                isAnalyzingIconography ||
                isCleaningIconography ||
                isAnalyzingOrphaned ||
                isCleaningOrphaned
              }
              className="w-full"
              size="sm"
            >
              {isAnalyzing && <LoadingSpinner />}
              {isAnalyzing ? 'Checking...' : 'Check Issues'}
            </Button>

            {result?.analysis && (
              <Button
                onClick={runCleanup}
                disabled={
                  isCleaning ||
                  isAnalyzing ||
                  isAnalyzingTextspotting ||
                  isCleaningTextspotting ||
                  isAnalyzingIconography ||
                  isCleaningIconography ||
                  isAnalyzingOrphaned ||
                  isCleaningOrphaned
                }
                variant="destructive"
                className="w-full"
                size="sm"
              >
                {isCleaning && <LoadingSpinner />}
                {isCleaning ? 'Fixing...' : 'Fix Issues'}
              </Button>
            )}
          </div>
        </div>

        {/* Textspotting Annotations */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2 text-secondary">
            Textspotting
          </h2>
          <p className="text-muted-foreground mb-4 text-sm">
            Fix creator info, structure, and timestamp issues
          </p>

          <div className="space-y-2">
            <Button
              onClick={runTextspottingAnalysis}
              disabled={
                isAnalyzingTextspotting ||
                isCleaningTextspotting ||
                isAnalyzing ||
                isCleaning ||
                isAnalyzingIconography ||
                isCleaningIconography ||
                isAnalyzingOrphaned ||
                isCleaningOrphaned
              }
              variant="secondary"
              className="w-full"
              size="sm"
            >
              {isAnalyzingTextspotting && <LoadingSpinner />}
              {isAnalyzingTextspotting ? 'Checking...' : 'Check Issues'}
            </Button>

            {textspottingResult?.analysis?.textspottingAnalysis && (
              <Button
                onClick={runTextspottingCleanup}
                disabled={
                  isCleaningTextspotting ||
                  isAnalyzingTextspotting ||
                  isAnalyzing ||
                  isCleaning ||
                  isAnalyzingIconography ||
                  isCleaningIconography ||
                  isAnalyzingOrphaned ||
                  isCleaningOrphaned
                }
                variant="destructive"
                className="w-full"
                size="sm"
              >
                {isCleaningTextspotting && <LoadingSpinner />}
                {isCleaningTextspotting ? 'Fixing...' : 'Fix Issues'}
              </Button>
            )}
          </div>
        </div>

        {/* Iconography Annotations */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2 text-accent">
            Iconography
          </h2>
          <p className="text-muted-foreground mb-4 text-sm">
            Fix structure issues
          </p>

          <div className="space-y-2">
            <Button
              onClick={runIconographyAnalysis}
              disabled={
                isAnalyzingIconography ||
                isCleaningIconography ||
                isAnalyzing ||
                isCleaning ||
                isAnalyzingTextspotting ||
                isCleaningTextspotting ||
                isAnalyzingOrphaned ||
                isCleaningOrphaned
              }
              variant="outline"
              className="w-full"
              size="sm"
            >
              {isAnalyzingIconography && <LoadingSpinner />}
              {isAnalyzingIconography ? 'Checking...' : 'Check Issues'}
            </Button>

            {iconographyResult?.analysis?.iconographyAnalysis && (
              <Button
                onClick={runIconographyCleanup}
                disabled={
                  isCleaningIconography ||
                  isAnalyzingIconography ||
                  isAnalyzing ||
                  isCleaning ||
                  isAnalyzingTextspotting ||
                  isCleaningTextspotting ||
                  isAnalyzingOrphaned ||
                  isCleaningOrphaned
                }
                variant="destructive"
                className="w-full"
                size="sm"
              >
                {isCleaningIconography && <LoadingSpinner />}
                {isCleaningIconography ? 'Fixing...' : 'Fix Issues'}
              </Button>
            )}
          </div>
        </div>

        {/* Orphaned Targets */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2 text-orange-600">
            Orphaned Targets
          </h2>
          <p className="text-muted-foreground mb-4 text-sm">
            Remove references to deleted annotations
          </p>

          <div className="space-y-2">
            <Button
              onClick={runOrphanedAnalysis}
              disabled={
                isAnalyzingOrphaned ||
                isCleaningOrphaned ||
                isAnalyzing ||
                isCleaning ||
                isAnalyzingTextspotting ||
                isCleaningTextspotting ||
                isAnalyzingIconography ||
                isCleaningIconography
              }
              variant="outline"
              className="w-full border-orange-300 hover:bg-orange-50"
              size="sm"
            >
              {isAnalyzingOrphaned && <LoadingSpinner />}
              {isAnalyzingOrphaned ? 'Checking...' : 'Check Orphaned'}
            </Button>

            {orphanedResult?.analysis && (
              <Button
                onClick={runOrphanedCleanup}
                disabled={
                  isCleaningOrphaned ||
                  isAnalyzingOrphaned ||
                  isAnalyzing ||
                  isCleaning ||
                  isAnalyzingTextspotting ||
                  isCleaningTextspotting ||
                  isAnalyzingIconography ||
                  isCleaningIconography
                }
                variant="destructive"
                className="w-full"
                size="sm"
              >
                {isCleaningOrphaned && <LoadingSpinner />}
                {isCleaningOrphaned ? 'Fixing...' : 'Fix Orphaned'}
              </Button>
            )}
          </div>
        </div>
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
                <div className="max-h-96 overflow-y-auto border border-border rounded-lg bg-muted">
                  <div className="space-y-3 p-4">
                    {(() => {
                      const allItems =
                        result.analysis?.structuralFixGroups || [];
                      let itemsToDisplay;

                      if (showAllStructural) {
                        itemsToDisplay = allItems;
                      } else {
                        itemsToDisplay = allItems.slice(0, 10);
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
              </div>
            )}

          {result.analysis.duplicateGroups &&
            result.analysis.duplicateGroups.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4 text-primary">
                  Duplicate Groups Found (
                  {result.analysis.duplicateGroups.length})
                </h3>
                <div className="max-h-96 overflow-y-auto">
                  <div className="space-y-4 pr-2">
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
                              <div className="flex items-center gap-2">
                                <a
                                  href={getAnnotationLink(annotation.id)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-foreground hover:text-primary underline"
                                >
                                  {formatAnnotationId(annotation.id)} ↗
                                </a>
                              </div>
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
                <div className="max-h-96 overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pr-2">
                    {result.analysis.singleAnnotations
                      .slice(0, showAllCorrect ? undefined : 20)
                      .map((annotation, index) => (
                        <div
                          key={`correct-${annotation.id}-${index}`}
                          className="border border-border rounded p-3 bg-muted text-sm"
                        >
                          <div className="font-medium text-primary">
                            <a
                              href={getAnnotationLink(annotation.id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline"
                            >
                              {formatAnnotationId(annotation.id)} ↗
                            </a>
                          </div>
                          <div className="text-muted-foreground">
                            {annotation.bodyCount} bodies •{' '}
                            {annotation.bodyPurposes.join(', ') ||
                              'No purposes'}{' '}
                            • {annotation.linkedAnnotationsCount} linked
                          </div>
                        </div>
                      ))}
                  </div>
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
              <div className="max-h-96 overflow-y-auto">
                <div className="space-y-3 pr-2">
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
                            <a
                              href={getAnnotationLink(detail.originalId!)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {formatAnnotationId(detail.originalId!)} ↗
                            </a>
                            {' → '}
                            <a
                              href={getAnnotationLink(detail.fixedId!)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {formatAnnotationId(detail.fixedId!)} ↗
                            </a>
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
                            <a
                              href={getAnnotationLink(detail.consolidatedId!)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {formatAnnotationId(detail.consolidatedId!)} ↗
                            </a>
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
            </div>
          )}

          <div className="text-center">
            <Button onClick={() => setResult(null)} variant="secondary">
              New Analysis
            </Button>
          </div>
        </div>
      )}

      {/* Textspotting Analysis Results */}
      {textspottingResult?.analysis?.textspottingAnalysis && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-secondary">
              Textspotting Analysis Results
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {
                    textspottingResult.analysis.textspottingAnalysis
                      .totalTextspottingAnnotations
                  }
                </div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-destructive">
                  {textspottingResult.analysis.textspottingAnalysis
                    .annotationsWithIncorrectCreators +
                    textspottingResult.analysis.textspottingAnalysis
                      .annotationsNeedingBodyRestructure}
                </div>
                <div className="text-sm text-muted-foreground">Need Fixes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-muted-foreground">
                  {
                    textspottingResult.analysis.textspottingAnalysis
                      .correctlyStructuredAnnotations
                  }
                </div>
                <div className="text-sm text-muted-foreground">
                  Already Correct
                </div>
              </div>
            </div>

            {textspottingResult.analysis.textspottingAnalysis
              .problematicAnnotations.length > 0 && (
              <div className="bg-secondary/10 border border-secondary/20 rounded-lg p-4">
                <h3 className="font-semibold text-secondary">Issues Found</h3>
                <p className="text-secondary-foreground mt-2">
                  Found{' '}
                  {
                    textspottingResult.analysis.textspottingAnalysis
                      .problematicAnnotations.length
                  }{' '}
                  annotations with creator, structure, or timestamp issues.
                </p>
              </div>
            )}
          </div>

          {textspottingResult.analysis.textspottingAnalysis
            .problematicAnnotations.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-secondary">
                  Problematic Textspotting Annotations (
                  {
                    textspottingResult.analysis.textspottingAnalysis
                      .problematicAnnotations.length
                  }
                  )
                </h3>
                {textspottingResult.analysis.textspottingAnalysis
                  .problematicAnnotations.length > 10 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllTextspotting(!showAllTextspotting)}
                  >
                    {showAllTextspotting ? 'Show Less' : 'Show All'}
                  </Button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto border border-border rounded-lg bg-muted">
                <div className="space-y-3 p-4">
                  {textspottingResult.analysis.textspottingAnalysis.problematicAnnotations
                    .slice(0, showAllTextspotting ? undefined : 10)
                    .map((annotation, index) => (
                      <div
                        key={`textspotting-${annotation.id}-${index}`}
                        className="border border-border rounded-lg p-4 bg-card hover:bg-accent/10 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-secondary">
                                Annotation {formatAnnotationId(annotation.id)}
                              </p>
                              <a
                                href={getAnnotationLink(annotation.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:text-secondary underline"
                              >
                                View in AnnoRepo ↗
                              </a>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              <strong>Full ID:</strong>{' '}
                              {getFullAnnotationId(annotation.id)}
                            </p>
                            <div className="flex gap-2 mb-2">
                              {annotation.hasAnnotationLevelCreator && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-destructive text-destructive-foreground">
                                  Wrong Creator Level
                                </span>
                              )}
                              {/* Note: suspectedOverwrittenAI badge removed - human confirmation of AI text is good behavior */}
                              {!annotation.hasHumanEditedBodies &&
                                annotation.hasAIBodies && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-accent text-accent-foreground">
                                    Needs Body Restructure
                                  </span>
                                )}
                            </div>
                          </div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                            {annotation.bodies.length} bodies
                          </span>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-secondary">
                            Issues to Fix:
                          </h4>
                          {annotation.issues.map((issue, issueIndex) => (
                            <div
                              key={issueIndex}
                              className="text-sm text-secondary-foreground bg-secondary/20 px-3 py-2 rounded border-l-4 border-secondary"
                            >
                              {issue}
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 p-3 bg-muted rounded border border-border">
                          <h5 className="text-xs font-medium text-secondary mb-2">
                            Current Body Structure:
                          </h5>
                          <pre className="text-xs text-muted-foreground overflow-x-auto max-h-32">
                            {JSON.stringify(annotation.bodies, null, 2)}
                          </pre>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          <div className="text-center">
            <Button
              onClick={() => setTextspottingResult(null)}
              variant="secondary"
            >
              New Analysis
            </Button>
          </div>
        </div>
      )}

      {/* Iconography Analysis Results */}
      {iconographyResult?.analysis?.iconographyAnalysis && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-accent">
              Iconography Analysis Results
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {
                    iconographyResult.analysis.iconographyAnalysis
                      .totalIconographyAnnotations
                  }
                </div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-destructive">
                  {iconographyResult.analysis.iconographyAnalysis
                    .annotationsWithTypo +
                    iconographyResult.analysis.iconographyAnalysis
                      .annotationsWithEmptyTextualBody +
                    iconographyResult.analysis.iconographyAnalysis
                      .annotationsWithMissingBodyArray +
                    iconographyResult.analysis.iconographyAnalysis
                      .annotationsWithNonArrayBody}
                </div>
                <div className="text-sm text-muted-foreground">Need Fixes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {iconographyResult.analysis.iconographyAnalysis
                    .annotationsWithMissingCreator || 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  Human-Modified Missing Creator
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent">
                  {
                    iconographyResult.analysis.iconographyAnalysis
                      .correctlyStructuredAnnotations
                  }
                </div>
                <div className="text-sm text-muted-foreground">
                  Already Correct
                </div>
              </div>
            </div>

            {iconographyResult.analysis.iconographyAnalysis
              .problematicAnnotations.length > 0 && (
              <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
                <h3 className="font-semibold text-accent">Issues Found</h3>
                <p className="text-accent-foreground mt-2">
                  Found{' '}
                  {
                    iconographyResult.analysis.iconographyAnalysis
                      .problematicAnnotations.length
                  }{' '}
                  annotations that need fixes: motivation typos, incorrect body
                  structure, or missing creator information.
                </p>
              </div>
            )}
          </div>

          {iconographyResult.analysis.iconographyAnalysis.problematicAnnotations
            .length > 0 && (
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-accent">
                  Problematic Iconography Annotations (
                  {
                    iconographyResult.analysis.iconographyAnalysis
                      .problematicAnnotations.length
                  }
                  )
                </h3>
                {iconographyResult.analysis.iconographyAnalysis
                  .problematicAnnotations.length > 10 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllIconography(!showAllIconography)}
                  >
                    {showAllIconography ? 'Show Less' : 'Show All'}
                  </Button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                <div className="space-y-3 border border-border rounded-lg p-4 bg-muted">
                  {iconographyResult.analysis.iconographyAnalysis.problematicAnnotations
                    .slice(0, showAllIconography ? undefined : 10)
                    .map((annotation, index) => (
                      <div
                        key={`iconography-${annotation.id}-${index}`}
                        className="border border-border rounded-lg p-4 bg-card hover:bg-accent/10 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <a
                              href={getAnnotationLink(annotation.id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-mono text-accent hover:underline"
                            >
                              {formatAnnotationId(annotation.id)} ↗
                            </a>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {annotation.hasTypoInMotivation && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-destructive text-destructive-foreground">
                                  Motivation Typo
                                </span>
                              )}
                              {annotation.hasEmptyTextualBody && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                                  Empty TextualBody
                                </span>
                              )}
                              {annotation.hasMissingBodyArray && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-destructive text-destructive-foreground">
                                  Missing Body Array
                                </span>
                              )}
                              {annotation.hasNonArrayBody && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-accent text-accent-foreground">
                                  Non-Array Body
                                </span>
                              )}
                              {annotation.hasHumanModifications && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary text-primary-foreground">
                                  Human Modified
                                </span>
                              )}
                              {annotation.missingCreator && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                  Missing Creator
                                </span>
                              )}
                              {annotation.hasGenerator && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                                  AI Generated
                                </span>
                              )}
                              {annotation.hasEmptyBodyArray &&
                                !annotation.hasMissingBodyArray &&
                                !annotation.hasNonArrayBody &&
                                !annotation.hasEmptyTextualBody &&
                                !annotation.hasTypoInMotivation && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    W3C Compliant (Empty Array)
                                  </span>
                                )}
                            </div>
                          </div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                            {annotation.body.length} body elements
                          </span>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-accent">
                            Issues to Fix:
                          </h4>
                          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                            {annotation.issues.map((issue, issueIndex) => (
                              <li key={issueIndex}>{issue}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="mt-3 p-3 bg-muted rounded border border-border">
                          <h4 className="text-sm font-medium mb-2 text-accent">
                            Current Motivation:{' '}
                            <span className="font-mono text-xs">
                              {annotation.motivation}
                            </span>
                          </h4>
                          {annotation.body.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              Body elements:{' '}
                              {annotation.body
                                .map((b: any) => b.type)
                                .join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          <div className="text-center">
            <Button
              onClick={() => setIconographyResult(null)}
              variant="secondary"
            >
              New Analysis
            </Button>
          </div>
        </div>
      )}

      {/* Orphaned Targets Analysis Results */}
      {orphanedResult?.analysis && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-orange-600">
              Orphaned Targets Analysis Results
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {orphanedResult.analysis.totalLinkingAnnotations ?? 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Linking
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-destructive">
                  {orphanedResult.analysis.annotationsWithOrphanedTargets ?? 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  With Orphaned
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {orphanedResult.analysis.annotationsToDelete ?? 0}
                </div>
                <div className="text-sm text-muted-foreground">To Delete</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {orphanedResult.analysis.annotationsToRepair ?? 0}
                </div>
                <div className="text-sm text-muted-foreground">To Repair</div>
              </div>
            </div>

            {(orphanedResult.analysis.totalOrphanedTargets ?? 0) > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                <h3 className="font-semibold text-orange-800 mb-2">
                  Found {orphanedResult.analysis.totalOrphanedTargets} orphaned
                  target references
                </h3>
                <p className="text-orange-700 text-sm">
                  These linking annotations reference annotations that no longer
                  exist.
                  {(orphanedResult.analysis.annotationsToDelete ?? 0) > 0 && (
                    <>
                      {' '}
                      {orphanedResult.analysis.annotationsToDelete} linking
                      annotations will be deleted as they have insufficient
                      valid targets.
                    </>
                  )}
                  {(orphanedResult.analysis.annotationsToRepair ?? 0) > 0 && (
                    <>
                      {' '}
                      {orphanedResult.analysis.annotationsToRepair} linking
                      annotations can be repaired by removing orphaned
                      references.
                    </>
                  )}
                </p>
              </div>
            )}

            {orphanedResult.analysis.annotationDetails &&
              orphanedResult.analysis.annotationDetails.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">
                      Detailed Analysis (
                      {orphanedResult.analysis.annotationDetails.length})
                    </h3>
                    <Button
                      onClick={() => setShowAllOrphaned(!showAllOrphaned)}
                      variant="outline"
                      size="sm"
                    >
                      {showAllOrphaned ? 'Show Less' : 'Show All'}
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {(showAllOrphaned
                      ? orphanedResult.analysis.annotationDetails
                      : orphanedResult.analysis.annotationDetails.slice(0, 5)
                    ).map((detail: any, index: number) => (
                      <div
                        key={detail.id}
                        className="bg-muted/30 border border-border rounded-lg p-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm">
                              <a
                                href={getAnnotationLink(detail.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {detail.shortId}
                              </a>
                            </h4>
                            <div className="text-xs text-muted-foreground space-y-1">
                              <div>
                                Targets:{' '}
                                {detail.targetAnalysis.validTargetCount}/
                                {detail.targetAnalysis.totalTargets} valid
                              </div>
                              {detail.targetAnalysis.orphanedTargetCount >
                                0 && (
                                <div className="text-orange-600">
                                  {detail.targetAnalysis.orphanedTargetCount}{' '}
                                  orphaned references
                                </div>
                              )}
                              {detail.shouldDelete && (
                                <div className="text-red-600 font-medium">
                                  Will be deleted: {detail.deleteReason}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="ml-4">
                            {detail.shouldDelete ? (
                              <Badge variant="destructive">Delete</Badge>
                            ) : detail.targetAnalysis.hasOrphanedTargets ? (
                              <Badge variant="secondary">Repair</Badge>
                            ) : (
                              <Badge variant="default">Valid</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            <div className="text-center">
              <Button
                onClick={() => setOrphanedResult(null)}
                variant="secondary"
              >
                New Analysis
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
