/**
 * Parse structured content from GLOBALISE and NeRu place datasets
 * Content uses bracketed tags like [CONTEXT], [COORD], [DISAMBIGUATION], etc.
 */

export interface ParsedContent {
  context: string[];
  coord: string[];
  disambiguation: string[];
  association: string[];
  inference: string[];
  automatic: string[];
  source: string[];
  altLabel: string[];
  other: string[];
}

export interface ContentSection {
  type:
    | 'context'
    | 'coord'
    | 'disambiguation'
    | 'association'
    | 'inference'
    | 'automatic'
    | 'source'
    | 'altLabel'
    | 'other';
  content: string;
}

/**
 * Parse bracketed content sections from referred_to_by content field
 */
export function parseContent(content: string): ParsedContent {
  const result: ParsedContent = {
    context: [],
    coord: [],
    disambiguation: [],
    association: [],
    inference: [],
    automatic: [],
    source: [],
    altLabel: [],
    other: [],
  };

  if (!content || typeof content !== 'string') {
    return result;
  }

  const sectionRegex = /\[([A-Z_]+)\]\s*/g;

  let match;
  const sections: Array<{ tag: string; startIndex: number }> = [];

  while ((match = sectionRegex.exec(content)) !== null) {
    sections.push({
      tag: match[1] || '',
      startIndex: match.index + match[0].length,
    });
  }

  sections.forEach((section, index) => {
    const endIndex =
      index < sections.length - 1
        ? sections[index + 1]!.startIndex - sections[index + 1]!.tag.length - 3
        : content.length;

    const sectionContent = content
      .slice(section.startIndex, endIndex)
      .trim()
      .replace(/\.\s*$/, '');

    if (sectionContent) {
      const tag = section.tag.toLowerCase();

      switch (tag) {
        case 'context':
          result.context.push(sectionContent);
          break;
        case 'coord':
          result.coord.push(sectionContent);
          break;
        case 'disambiguation':
          result.disambiguation.push(sectionContent);
          break;
        case 'association':
          result.association.push(sectionContent);
          break;
        case 'inference':
          result.inference.push(sectionContent);
          break;
        case 'automatic':
          result.automatic.push(sectionContent);
          break;
        case 'source':
          result.source.push(sectionContent);
          break;
        case 'alt_label':
          result.altLabel.push(sectionContent);
          break;
        default:
          result.other.push(`[${section.tag}] ${sectionContent}`);
      }
    }
  });

  if (sections.length === 0 && content.trim()) {
    result.context.push(content.trim());
  }

  return result;
}

/**
 * Get all sections as flat array for display
 */
export function getContentSections(content: string): ContentSection[] {
  const parsed = parseContent(content);
  const sections: ContentSection[] = [];

  if (parsed.context.length > 0) {
    parsed.context.forEach((text) =>
      sections.push({ type: 'context', content: text }),
    );
  }
  if (parsed.disambiguation.length > 0) {
    parsed.disambiguation.forEach((text) =>
      sections.push({ type: 'disambiguation', content: text }),
    );
  }
  if (parsed.coord.length > 0) {
    parsed.coord.forEach((text) =>
      sections.push({ type: 'coord', content: text }),
    );
  }
  if (parsed.association.length > 0) {
    parsed.association.forEach((text) =>
      sections.push({ type: 'association', content: text }),
    );
  }
  if (parsed.inference.length > 0) {
    parsed.inference.forEach((text) =>
      sections.push({ type: 'inference', content: text }),
    );
  }
  if (parsed.automatic.length > 0) {
    parsed.automatic.forEach((text) =>
      sections.push({ type: 'automatic', content: text }),
    );
  }
  if (parsed.source.length > 0) {
    parsed.source.forEach((text) =>
      sections.push({ type: 'source', content: text }),
    );
  }
  if (parsed.altLabel.length > 0) {
    parsed.altLabel.forEach((text) =>
      sections.push({ type: 'altLabel', content: text }),
    );
  }
  if (parsed.other.length > 0) {
    parsed.other.forEach((text) =>
      sections.push({ type: 'other', content: text }),
    );
  }

  return sections;
}

/**
 * Check if content has any meaningful sections
 */
export function hasContent(content: string): boolean {
  const parsed = parseContent(content);
  return Object.values(parsed).some(
    (arr) => Array.isArray(arr) && arr.length > 0,
  );
}
