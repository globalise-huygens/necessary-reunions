'use client';

import type { Annotation } from '@/lib/types';
import React, { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/shared/Select';

interface ClassificationSelectorProps {
  annotation: Annotation;
  currentClassificationId?: string;
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
        } catch {
        } finally {
          setIsLoading(false);
        }
      };

      loadThesaurus().catch(() => {});
    }, []);

    const handleSelectionChange = async (value: string) => {
      if (!canEdit || isSaving) return;

      setIsSaving(true);
      try {
        const classificationId = value === 'none' ? null : value;
        await onClassificationUpdate(annotation, classificationId);
      } catch {
      } finally {
        setIsSaving(false);
      }
    };

    const getEnglishLabel = (concept: ThesaurusConcept): string => {
      const englishAltLabel = concept.altLabel?.find(
        (alt) => alt['@language'] === 'en',
      );
      return englishAltLabel?.['@value'] || concept.prefLabel['@value'];
    };

    const formatDisplayLabel = (concept: ThesaurusConcept): string => {
      const dutch = concept.prefLabel['@value'];
      const english = getEnglishLabel(concept);

      if (dutch === english || concept.prefLabel['@language'] === 'en') {
        return dutch;
      }

      return `${dutch} (${
        english.length > 15 ? english.slice(0, 12) + '...' : english
      })`;
    };

    const getDefinition = (concept: ThesaurusConcept): string => {
      const definition =
        concept.definition?.['@value'] || 'No definition available';
      return definition.length > 80
        ? definition.slice(0, 77) + '...'
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

    return (
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
                key={`classification-${option.value}`}
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
      </div>
    );
  },
);
