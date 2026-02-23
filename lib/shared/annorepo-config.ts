/**
 * Server-side AnnoRepo configuration resolver
 *
 * Centralises the resolution of AnnoRepo base URL, container name,
 * and authentication token from the project configuration registry.
 * All API routes should use this instead of hardcoded constants.
 */

import { getProjectConfig, type ProjectConfig } from '../projects';

export interface AnnoRepoConfig {
  baseUrl: string;
  container: string;
  authToken: string | undefined;
  customQueryName: string;
  linkingQueryName: string;
  project: ProjectConfig;
}

/**
 * Resolve AnnoRepo configuration for a given project slug.
 * Falls back to the default project (neru) if the slug is invalid.
 *
 * Usage in API routes:
 * ```ts
 * const { baseUrl, container, authToken } = resolveAnnoRepoConfig(
 *   searchParams.get('project')
 * );
 * ```
 */
export function resolveAnnoRepoConfig(
  projectSlug?: string | null,
): AnnoRepoConfig {
  const project = getProjectConfig(projectSlug);
  const authToken = process.env[project.authTokenEnvVar];

  return {
    baseUrl: project.annoRepoBaseUrl,
    container: project.annoRepoContainer,
    authToken,
    customQueryName: project.customQueryName,
    linkingQueryName: project.linkingQueryName,
    project,
  };
}

/**
 * Check if a user's ORCID is on the allowlist for a specific project.
 * Used to gate write operations per-project.
 */
export function canEditProject(
  orcidId: string | undefined,
  projectSlug?: string | null,
): boolean {
  if (!orcidId) return false;

  const project = getProjectConfig(projectSlug);
  const envVar = project.orcidAllowlistEnvVar;
  let allowlistRaw = process.env[envVar];

  // Backward compatibility: fall back to ORCID_ALLOWLIST for neru
  if (!allowlistRaw && project.slug === 'neru') {
    allowlistRaw = process.env.ORCID_ALLOWLIST;
  }

  if (!allowlistRaw) return false;

  const allowlist = allowlistRaw.split(',').map((id) => id.trim());
  const orcidNumber = orcidId.replace('https://orcid.org/', '');

  return allowlist.includes(orcidId) || allowlist.includes(orcidNumber);
}
