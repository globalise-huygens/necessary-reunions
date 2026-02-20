'use client';

import { useSearchParams } from 'next/navigation';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import {
  getProjectConfig,
  getProjectFromManifestUrl,
  type ProjectConfig,
} from '../projects';

const ProjectContext = createContext<ProjectConfig | null>(null);

/**
 * Provides project configuration based on the `project` URL query parameter.
 * Wraps the viewer and makes the config available to all descendants.
 */
export function ProjectProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const projectSlug = searchParams.get('project');

  const config = useMemo(() => getProjectConfig(projectSlug), [projectSlug]);

  return (
    <ProjectContext.Provider value={config}>{children}</ProjectContext.Provider>
  );
}

/**
 * Access the current project configuration.
 * Must be used within a ProjectProvider.
 */
export function useProjectConfig(): ProjectConfig {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjectConfig must be used within a ProjectProvider');
  }
  return context;
}

/**
 * Detect project config from a manifest URL.
 * Returns the project config if the URL matches a known project, otherwise null.
 * Useful for auto-detection when loading an arbitrary manifest.
 */
export function useProjectFromManifestUrl(
  manifestUrl: string | null,
): ProjectConfig | null {
  return useMemo(() => {
    if (!manifestUrl) return null;
    return getProjectFromManifestUrl(manifestUrl);
  }, [manifestUrl]);
}
