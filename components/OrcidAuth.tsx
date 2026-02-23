'use client';

import { LogIn, LogOut, Pencil } from 'lucide-react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { Button } from '../components/shared/Button';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { getProjectConfig } from '../lib/projects';
import { useOptionalProjectConfig } from '../lib/viewer/project-context';

interface SessionUser {
  id: string;
  label: string;
  allowedProjects?: string[];
}

export default function OrcidAuth() {
  const { data: session, status } = useSession();
  const projectConfig = useOptionalProjectConfig();

  const getOrcidDisplayId = (id: string) => {
    if (id.startsWith('https://orcid.org/')) {
      return id.replace('https://orcid.org/', '');
    }
    return id;
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-5 sm:h-10">
        <LoadingSpinner />
      </div>
    );
  }

  const user = session?.user as SessionUser | undefined;
  const allowedProjects = user?.allowedProjects ?? [];
  const canEditCurrent = projectConfig
    ? allowedProjects.includes(projectConfig.slug)
    : false;

  return (
    <div className="flex items-center gap-1 sm:space-x-3">
      {!session ? (
        <Button
          onClick={() => signIn('orcid')}
          variant="secondary"
          className="h-5 w-5 p-0 sm:h-9 sm:w-auto sm:px-3 sm:text-sm"
          title="Sign in with ORCID"
        >
          <LogIn className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
          <span className="hidden sm:inline">Sign in</span>
        </Button>
      ) : (
        <>
          <div className="hidden sm:flex items-center gap-2.5">
            {/* Column 1: name + ORCID */}
            <div className="flex flex-col items-end gap-0">
              <span className="text-sm text-white leading-tight">
                {user!.label}
              </span>
              <small className="text-primary-foreground/60 leading-tight">
                ORCID: {getOrcidDisplayId(user!.id)}
              </small>
            </div>
            {/* Column 2: project permission badges */}
            {allowedProjects.length > 0 ? (
              <div className="flex flex-col items-start gap-0.5">
                {allowedProjects.map((slug) => {
                  const cfg = getProjectConfig(slug);
                  const isActive = projectConfig
                    ? slug === projectConfig.slug
                    : false;
                  return (
                    <span
                      key={slug}
                      className={`inline-flex items-center gap-1 text-[10px] leading-none px-1.5 py-0.5 rounded-full font-medium ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-white/10 text-primary-foreground/50'
                      }`}
                      title={`Can edit ${cfg.label}`}
                    >
                      <Pencil className="h-2 w-2 shrink-0" />
                      <span
                        className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${cfg.accentColor}`}
                      />
                      {cfg.shortLabel}
                    </span>
                  );
                })}
              </div>
            ) : (
              <span className="text-amber-300/80 text-[10px] leading-tight">
                Read-only
              </span>
            )}
          </div>
          {/* Mobile: compact edit indicator */}
          {canEditCurrent && (
            <span
              className="sm:hidden inline-flex items-center gap-0.5 text-[9px] text-white/70 leading-none"
              title={`Can edit ${projectConfig!.label}`}
            >
              <Pencil className="h-2 w-2" />
            </span>
          )}
          <Button
            onClick={() => signOut()}
            variant="default"
            className="h-5 w-5 p-0 sm:h-9 sm:w-auto sm:px-3 sm:text-sm hover:text-secondary"
            title="Sign out"
          >
            <LogOut className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </>
      )}
    </div>
  );
}
