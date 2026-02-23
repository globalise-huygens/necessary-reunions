/**
 * Multi-project configuration registry
 *
 * Each project maps to a IIIF manifest, an AnnoRepo instance,
 * and an ORCID allowlist for write access control.
 */

export interface ProjectConfig {
  /** URL-safe slug used as query parameter value */
  slug: string;
  /** Display name shown in UI */
  label: string;
  /** IIIF manifest URL */
  manifestUrl: string;
  /** AnnoRepo server base URL (no trailing slash) */
  annoRepoBaseUrl: string;
  /** AnnoRepo container name */
  annoRepoContainer: string;
  /** Environment variable name holding the AnnoRepo bearer token */
  authTokenEnvVar: string;
  /** Environment variable name holding the ORCID allowlist */
  orcidAllowlistEnvVar: string;
  /** Prefix for session storage cache keys (client-side) */
  cacheKeyPrefix: string;
  /** Custom query name used for canvas-based annotation lookup */
  customQueryName: string;
  /** Custom query for linking annotations */
  linkingQueryName: string;
  /**
   * When true, skip loading annotations embedded in the IIIF manifest
   * (AnnotationPage references on each canvas). Use this when AnnoRepo
   * is the single authoritative source and the manifest pages would
   * create duplicates with different IDs.
   */
  skipManifestAnnotations?: boolean;
  /** Abbreviated label for compact UI (segmented control, mobile trigger) */
  shortLabel: string;
  /** Tailwind background colour class for the project accent dot */
  accentColor: string;
  /**
   * Geotag data sources available for this project.
   * Defaults to ['nominatim'] when not specified.
   */
  geotagSources?: Array<'nominatim' | 'globalise' | 'neru' | 'gavoc'>;
}

export const projects: Record<string, ProjectConfig> = {
  neru: {
    slug: 'neru',
    label: 'Necessary Reunions',
    shortLabel: 'NeRu',
    accentColor: 'bg-teal-500',
    manifestUrl:
      'https://globalise-huygens.github.io/necessary-reunions/manifest.json',
    annoRepoBaseUrl: 'https://annorepo.globalise.huygens.knaw.nl',
    annoRepoContainer: 'necessary-reunions',
    authTokenEnvVar: 'ANNO_REPO_TOKEN_JONA',
    orcidAllowlistEnvVar: 'ORCID_ALLOWLIST_NERU',
    cacheKeyPrefix: 'neru_anno_cache',
    customQueryName: 'with-target',
    linkingQueryName: 'with-target-and-motivation-or-purpose',
    geotagSources: ['nominatim', 'globalise', 'neru', 'gavoc'],
  },
  suriname: {
    slug: 'suriname',
    label: 'Suriname Time Machine',
    shortLabel: 'STM',
    accentColor: 'bg-amber-500',
    manifestUrl:
      'https://surinametimemachine.github.io/iiif-suriname/manifest.json',
    annoRepoBaseUrl: 'https://annorepo.surinametijdmachine.org',
    annoRepoContainer: 'suriname-time-machine',
    authTokenEnvVar: 'SURINAME_ANNOREPO_TOKEN',
    orcidAllowlistEnvVar: 'ORCID_ALLOWLIST_SURINAME',
    cacheKeyPrefix: 'suriname_anno_cache',
    customQueryName: 'with-target',
    linkingQueryName: 'with-target-and-motivation-or-purpose',
    skipManifestAnnotations: true,
    geotagSources: ['nominatim'],
  },
};

export const defaultProject = 'neru';

/**
 * Get project config by slug. Returns the default project if slug is invalid.
 */
export function getProjectConfig(slug?: string | null): ProjectConfig {
  if (slug && slug in projects) {
    return projects[slug]!;
  }
  return projects[defaultProject]!;
}

/**
 * Detect project from a manifest URL (for auto-detection when loading arbitrary manifests).
 */
export function getProjectFromManifestUrl(
  manifestUrl: string,
): ProjectConfig | null {
  for (const config of Object.values(projects)) {
    if (
      manifestUrl.startsWith(config.manifestUrl.replace('/manifest.json', ''))
    ) {
      return config;
    }
  }
  return null;
}

/**
 * Check if a project slug is valid.
 */
export function isValidProject(slug: string): slug is keyof typeof projects {
  return slug in projects;
}

/**
 * Get all available project configs.
 */
export function getAllProjects(): ProjectConfig[] {
  return Object.values(projects);
}
