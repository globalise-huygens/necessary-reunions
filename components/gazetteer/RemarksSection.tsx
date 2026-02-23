'use client';

import {
  AlertCircle,
  FileText,
  Info,
  Lightbulb,
  Link2,
  MapPin,
  Tag,
} from 'lucide-react';
import type { ParsedRemarks } from '../../lib/gazetteer/types';
import { Alert } from '../shared/Alert';

interface RemarksSectionProps {
  remarks: ParsedRemarks;
}

interface SectionConfig {
  key: keyof ParsedRemarks;
  title: string;
  icon: React.ReactNode;
  variant: 'default' | 'destructive';
  description?: string;
}

const SECTION_CONFIGS: SectionConfig[] = [
  {
    key: 'context',
    title: 'Historical Context',
    icon: <FileText className="w-4 h-4" />,
    variant: 'default',
    description: 'General historical information and background',
  },
  {
    key: 'disambiguation',
    title: 'Disambiguation',
    icon: <AlertCircle className="w-4 h-4" />,
    variant: 'destructive',
    description: 'Important notes to avoid confusion with similar places',
  },
  {
    key: 'coord',
    title: 'Coordinate Notes',
    icon: <MapPin className="w-4 h-4" />,
    variant: 'default',
    description: 'Details about location coordinates and precision',
  },
  {
    key: 'association',
    title: 'Associated Places',
    icon: <Link2 className="w-4 h-4" />,
    variant: 'default',
    description: 'Relationships and connections to other locations',
  },
  {
    key: 'inference',
    title: 'Inferred Information',
    icon: <Lightbulb className="w-4 h-4" />,
    variant: 'default',
    description: 'Location or data determined through scholarly inference',
  },
  {
    key: 'automatic',
    title: 'Automated Geocoding',
    icon: <Info className="w-4 h-4" />,
    variant: 'default',
    description: 'Coordinates obtained through automatic geocoding services',
  },
  {
    key: 'source',
    title: 'Sources',
    icon: <FileText className="w-4 h-4" />,
    variant: 'default',
    description: 'Source citations and references',
  },
  {
    key: 'altLabel',
    title: 'Alternative Labels',
    icon: <Tag className="w-4 h-4" />,
    variant: 'default',
    description: 'Other names and labels for this place',
  },
];

export function RemarksSection({ remarks }: RemarksSectionProps) {
  const hasContent = Object.values(remarks).some(
    (arr) => Array.isArray(arr) && arr.length > 0,
  );

  if (!hasContent) {
    return null;
  }

  const renderContent = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={`url-${part}`}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline break-all"
          >
            {part}
          </a>
        );
      }
      return <span key={`text-${part}`}>{part}</span>;
    });
  };

  return (
    <div className="bg-card rounded-lg shadow p-6">
      <h2 className="text-xl font-heading text-primary mb-6 flex items-center gap-2">
        <Info className="w-5 h-5" />
        Scholarly Remarks
      </h2>

      <div className="space-y-6">
        {SECTION_CONFIGS.map((config) => {
          const items = remarks[config.key];
          if (items.length === 0) return null;

          return (
            <div key={`section-${config.key}`} className="space-y-3">
              {/* Section header with icon */}
              <div className="flex items-start gap-2">
                <div className="mt-0.5 text-primary">{config.icon}</div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground">
                    {config.title}
                  </h3>
                  {config.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {config.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Content items */}
              <div className="space-y-2 pl-6">
                {items.map((item) => (
                  <Alert
                    key={`${config.key}-${item}`}
                    variant={
                      config.key === 'disambiguation'
                        ? 'destructive'
                        : 'default'
                    }
                    className="shadow-sm"
                  >
                    <div className="text-sm leading-relaxed">
                      {renderContent(item)}
                    </div>
                  </Alert>
                ))}
              </div>
            </div>
          );
        })}

        {/* Other/Unknown sections */}
        {remarks.other.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <div className="mt-0.5 text-primary">
                <Info className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground">
                  Additional Notes
                </h3>
              </div>
            </div>
            <div className="space-y-2 pl-6">
              {remarks.other.map((item) => (
                <Alert
                  key={`other-${item}`}
                  variant="default"
                  className="shadow-sm"
                >
                  <div className="text-sm leading-relaxed">
                    {renderContent(item)}
                  </div>
                </Alert>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Remarks compiled from GLOBALISE and NeRu place datasets. These notes
          represent scholarly analysis of historical sources, coordinate
          determinations, and contextual information about the place.
        </p>
      </div>
    </div>
  );
}
