'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/Select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/shared/Tooltip';
import type { Annotation } from '@/lib/types';
import { Info } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface ClassificationSelectorProps {
  annotation: Annotation;
  currentClassificationId?: string;
  currentClassificationLabel?: string;
  canEdit: boolean;
  onClassificationUpdate: (
    annotation: Annotation,
    classificationId: string | null,
  ) => Promise<void>;
}

interface ThesaurusConcept {
  '@id': string;
  '@type': string;
  prefLabel: {
    '@language': string;
    '@value': string;
  };
  altLabel?: Array<{
    '@language': string;
    '@value': string;
  }>;
  definition?: {
    '@language': string;
    '@value': string;
  };
}

interface IconographyThesaurus {
  '@context': any;
  '@graph': ThesaurusConcept[];
}

export const ClassificationSelector = React.memo(
  function ClassificationSelector({
    annotation,
    currentClassificationId,
    currentClassificationLabel,
    canEdit,
    onClassificationUpdate,
  }: ClassificationSelectorProps) {
    const [thesaurus, setThesaurus] = useState<IconographyThesaurus | null>(
      null,
    );
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
      const loadThesaurus = async () => {
        setIsLoading(true);
        try {
          const response = await fetch('/iconography-thesaurus.json');
          if (!response.ok) {
            throw new Error('Failed to load iconography thesaurus');
          }
          const data = await response.json();
          setThesaurus(data);
        } catch (error) {
          console.error('Error loading iconography thesaurus:', error);
        } finally {
          setIsLoading(false);
        }
      };

      loadThesaurus();
    }, []);

    const handleSelectionChange = async (value: string) => {
      if (!canEdit || isSaving) return;

      setIsSaving(true);
      try {
        const classificationId = value === 'none' ? null : value;
        await onClassificationUpdate(annotation, classificationId);
      } catch (error) {
        console.error('Error updating classification:', error);
      } finally {
        setIsSaving(false);
      }
    };

    // Helper function to get English translation
    const getEnglishLabel = (concept: ThesaurusConcept): string => {
      const englishAltLabel = concept.altLabel?.find(
        (alt) => alt['@language'] === 'en',
      );
      return englishAltLabel?.['@value'] || concept.prefLabel['@value'];
    };

    // Helper function to format display label (Dutch + English) - more compact
    const formatDisplayLabel = (concept: ThesaurusConcept): string => {
      const dutch = concept.prefLabel['@value'];
      const english = getEnglishLabel(concept);

      if (dutch === english || concept.prefLabel['@language'] === 'en') {
        return dutch; // Only show one if they're the same or if primary is already English
      }

      // Make it more compact by using shorter format
      return `${dutch} (${
        english.length > 15 ? english.substring(0, 12) + '...' : english
      })`;
    };

    // Helper function to get definition - more concise
    const getDefinition = (concept: ThesaurusConcept): string => {
      const definition =
        concept.definition?.['@value'] || 'No definition available';
      // Truncate very long definitions
      return definition.length > 80
        ? definition.substring(0, 77) + '...'
        : definition;
    };

    if (isLoading) {
      return (
        <div className="text-xs text-muted-foreground">
          Loading classifications...
        </div>
      );
    }

    if (!thesaurus) {
      return (
        <div className="text-xs text-destructive">
          Failed to load classifications
        </div>
      );
    }

    // Extract classification ID from full URL
    const shortClassificationId = currentClassificationId
      ? currentClassificationId.split('/').pop()
      : '';

    const selectOptions = [
      {
        value: 'none',
        label: 'No classification',
        definition: 'Remove classification from this annotation',
      },
      ...thesaurus['@graph'].map((concept) => ({
        value: concept['@id'],
        label: formatDisplayLabel(concept),
        definition: getDefinition(concept),
        concept: concept,
      })),
    ];

    const currentValue = shortClassificationId || 'none';
    const currentConcept = thesaurus['@graph'].find(
      (c) => c['@id'] === shortClassificationId,
    );

    return (
      <TooltipProvider>
        <div className="space-y-2 max-w-full">
          <Select
            value={currentValue}
            onValueChange={handleSelectionChange}
            disabled={!canEdit || isSaving}
          >
            <SelectTrigger className="w-full text-xs max-w-[280px] h-12">
              <SelectValue
                placeholder={
                  isSaving ? 'Saving...' : 'Select a classification...'
                }
              />
            </SelectTrigger>
            <SelectContent className="w-[var(--radix-select-trigger-width)] max-w-[280px]">
              {selectOptions.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="group min-h-[2.5rem] py-1.5"
                >
                  <div className="flex flex-col items-start w-full min-w-0 overflow-hidden">
                    <span className="font-medium text-xs truncate w-full">
                      {option.label}
                    </span>
                    <span
                      className="text-xs text-muted-foreground leading-tight w-full overflow-hidden"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {option.definition}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* {currentClassificationLabel && currentClassificationId && (
            <div className="text-xs text-muted-foreground break-words">
              Current:{' '}
              <span className="font-medium">
                {currentConcept
                  ? formatDisplayLabel(currentConcept)
                  : currentClassificationLabel}
              </span>
            </div>
          )} */}
        </div>
      </TooltipProvider>
    );
  },
);
