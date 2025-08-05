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
  // Iconography cleanup analysis
  iconographyAnalysis?: {
    totalIconographyAnnotations: number;
    annotationsWithTypo: number;
    annotationsWithEmptyTextualBody: number;
    annotationsWithIncorrectBody: number;
    annotationsWithMissingBodyArray: number;
    annotationsWithNonArrayBody: number;
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
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [textspottingResult, setTextspottingResult] =
    useState<CleanupResult | null>(null);
  const [iconographyResult, setIconographyResult] =
    useState<CleanupResult | null>(null);
  const [showAllStructural, setShowAllStructural] = useState(false);
  const [showAllCorrect, setShowAllCorrect] = useState(false);
  const [showAllTextspotting, setShowAllTextspotting] = useState(false);
  const [showAllIconography, setShowAllIconography] = useState(false);

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
          Annotation Cleanup Manager
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

      {/* Linking Annotations Cleanup Section */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-primary">
          Linking Annotations Cleanup
        </h2>
        <p className="text-muted-foreground mb-4">
          Fix structural issues and duplicates in linking annotations.
        </p>

        <div className="flex justify-center gap-4">
          <Button
            onClick={runAnalysis}
            disabled={
              isAnalyzing ||
              isCleaning ||
              isAnalyzingTextspotting ||
              isCleaningTextspotting ||
              isAnalyzingIconography ||
              isCleaningIconography
            }
            className="flex items-center gap-2"
          >
            {isAnalyzing && <LoadingSpinner />}
            {isAnalyzing ? 'Analyzing...' : 'Analyze Linking'}
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
                isCleaningIconography
              }
              variant="destructive"
              className="flex items-center gap-2"
            >
              {isCleaning && <LoadingSpinner />}
              {isCleaning ? 'Processing...' : 'Run Linking Cleanup'}
            </Button>
          )}
        </div>
      </div>

      {/* Textspotting Annotations Cleanup Section */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-secondary">
          Textspotting Annotations Cleanup
        </h2>
        <div className="bg-secondary/10 border border-secondary/20 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-secondary mb-2">What This Fixes</h3>
          <ul className="list-disc list-inside space-y-1 text-secondary-foreground text-sm">
            <li>
              Annotations with incorrect annotation-level creators (should be
              body-level)
            </li>
            <li>
              Human edits that overwrote AI-generated text instead of creating
              separate bodies
            </li>
            <li>Missing proper W3C structure for human vs AI text bodies</li>
            <li>TextualBody entries without proper creator/created metadata</li>
          </ul>
        </div>

        <div className="flex justify-center gap-4">
          <Button
            onClick={runTextspottingAnalysis}
            disabled={
              isAnalyzingTextspotting ||
              isCleaningTextspotting ||
              isAnalyzing ||
              isCleaning ||
              isAnalyzingIconography ||
              isCleaningIconography
            }
            variant="secondary"
            className="flex items-center gap-2"
          >
            {isAnalyzingTextspotting && <LoadingSpinner />}
            {isAnalyzingTextspotting ? 'Analyzing...' : 'Analyze Textspotting'}
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
                isCleaningIconography
              }
              variant="destructive"
              className="flex items-center gap-2"
            >
              {isCleaningTextspotting && <LoadingSpinner />}
              {isCleaningTextspotting
                ? 'Processing...'
                : 'Fix Textspotting Structure'}
            </Button>
          )}
        </div>
      </div>

      {/* Iconography Annotations Cleanup Section */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-accent">
          Iconography Annotations Cleanup
        </h2>
        <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-accent mb-2">What This Fixes</h3>
          <ul className="list-disc list-inside space-y-1 text-accent-foreground text-sm">
            <li>Motivation typos ("iconograpy" → "iconography")</li>
            <li>
              Unnecessary TextualBody elements (W3C: iconography should have
              empty body array)
            </li>
            <li>
              Missing body arrays (W3C: iconography requires empty body array
              [])
            </li>
            <li>
              Non-array body structures (W3C: body must be array for
              iconography)
            </li>
          </ul>
        </div>

        <div className="flex justify-center gap-4">
          <Button
            onClick={runIconographyAnalysis}
            disabled={
              isAnalyzingIconography ||
              isCleaningIconography ||
              isAnalyzing ||
              isCleaning ||
              isAnalyzingTextspotting ||
              isCleaningTextspotting
            }
            variant="outline"
            className="flex items-center gap-2"
          >
            {isAnalyzingIconography && <LoadingSpinner />}
            {isAnalyzingIconography ? 'Analyzing...' : 'Analyze Iconography'}
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
                isCleaningTextspotting
              }
              variant="destructive"
              className="flex items-center gap-2"
            >
              {isCleaningIconography && <LoadingSpinner />}
              {isCleaningIconography
                ? 'Processing...'
                : 'Fix Iconography Structure'}
            </Button>
          )}
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

      {/* Textspotting Analysis Results */}
      {textspottingResult?.analysis?.textspottingAnalysis && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-secondary">
              Textspotting Analysis Results
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {
                    textspottingResult.analysis.textspottingAnalysis
                      .totalTextspottingAnnotations
                  }
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Textspotting
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-destructive">
                  {
                    textspottingResult.analysis.textspottingAnalysis
                      .annotationsWithIncorrectCreators
                  }
                </div>
                <div className="text-sm text-muted-foreground">
                  Wrong Creators
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-secondary">
                  {
                    textspottingResult.analysis.textspottingAnalysis
                      .annotationsWithOverwrittenAI
                  }
                </div>
                <div className="text-sm text-muted-foreground">
                  Overwritten AI
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent-foreground">
                  {
                    textspottingResult.analysis.textspottingAnalysis
                      .annotationsNeedingBodyRestructure
                  }
                </div>
                <div className="text-sm text-muted-foreground">
                  Need Restructure
                </div>
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
                <ul className="list-disc list-inside mt-2 space-y-1 text-secondary-foreground">
                  <li>
                    {
                      textspottingResult.analysis.textspottingAnalysis
                        .annotationsWithIncorrectCreators
                    }{' '}
                    annotations with annotation-level creators
                  </li>
                  <li>
                    {
                      textspottingResult.analysis.textspottingAnalysis
                        .annotationsWithOverwrittenAI
                    }{' '}
                    annotations with potentially overwritten AI text
                  </li>
                  <li>
                    {
                      textspottingResult.analysis.textspottingAnalysis
                        .annotationsNeedingBodyRestructure
                    }{' '}
                    annotations needing body restructure
                  </li>
                </ul>
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
              <div className="space-y-3 border border-border rounded-lg p-4 bg-muted">
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
                            {annotation.suspectedOverwrittenAI && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                                Overwritten AI
                              </span>
                            )}
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
          )}

          <div className="text-center">
            <Button
              onClick={() => setTextspottingResult(null)}
              variant="secondary"
            >
              Run Another Textspotting Analysis
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
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {
                    iconographyResult.analysis.iconographyAnalysis
                      .totalIconographyAnnotations
                  }
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Iconography
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-destructive">
                  {
                    iconographyResult.analysis.iconographyAnalysis
                      .annotationsWithTypo
                  }
                </div>
                <div className="text-sm text-muted-foreground">
                  Motivation Typos
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-secondary">
                  {
                    iconographyResult.analysis.iconographyAnalysis
                      .annotationsWithEmptyTextualBody
                  }
                </div>
                <div className="text-sm text-muted-foreground">
                  Empty TextualBody
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent-foreground">
                  {
                    iconographyResult.analysis.iconographyAnalysis
                      .annotationsWithIncorrectBody
                  }
                </div>
                <div className="text-sm text-muted-foreground">
                  Incorrect Body
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-muted-foreground">
                  {
                    iconographyResult.analysis.iconographyAnalysis
                      .annotationsWithMissingBodyArray
                  }
                </div>
                <div className="text-sm text-muted-foreground">
                  Missing Body Array
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
                <ul className="list-disc list-inside mt-2 space-y-1 text-accent-foreground">
                  <li>
                    {
                      iconographyResult.analysis.iconographyAnalysis
                        .annotationsWithTypo
                    }{' '}
                    annotations with motivation typos
                  </li>
                  <li>
                    {
                      iconographyResult.analysis.iconographyAnalysis
                        .annotationsWithEmptyTextualBody
                    }{' '}
                    annotations with unnecessary TextualBody elements
                  </li>
                  <li>
                    {
                      iconographyResult.analysis.iconographyAnalysis
                        .annotationsWithMissingBodyArray
                    }{' '}
                    annotations missing required body array (W3C standard)
                  </li>
                  <li>
                    {
                      iconographyResult.analysis.iconographyAnalysis
                        .annotationsWithNonArrayBody
                    }{' '}
                    annotations with non-array body structure
                  </li>
                </ul>
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
                            {annotation.body.map((b: any) => b.type).join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="text-center">
            <Button
              onClick={() => setIconographyResult(null)}
              variant="secondary"
            >
              Run Another Iconography Analysis
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
