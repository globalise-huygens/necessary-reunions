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

  const renderBadges = () => {
    if (allowedProjects.length === 0) {
      return <span className="text-chart-4/80 text-[10px]">Read-only</span>;
    }
    return (
      <span className="inline-flex items-center gap-1">
        <Pencil className="h-2 w-2 text-primary-foreground/50 shrink-0" />
        {allowedProjects.map((slug) => {
          const cfg = getProjectConfig(slug);
          const isActive = projectConfig ? slug === projectConfig.slug : false;
          return (
            <span
              key={slug}
              className={`inline-flex items-center gap-0.5 text-[10px] leading-none px-1.5 py-0.5 rounded-full font-medium ${
                isActive
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-primary-foreground/10 text-primary-foreground/50'
              }`}
              title={`Can edit ${cfg.label}`}
            >
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${cfg.accentColor}`}
              />
              {cfg.shortLabel}
            </span>
          );
        })}
      </span>
    );
  };

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
          {/* Desktop: name + ORCID + badges on one row */}
          <div className="hidden sm:flex items-center gap-2.5">
            <div className="flex flex-col items-end gap-0">
              <span className="text-sm text-primary-foreground leading-tight">
                {user!.label}
              </span>
              <div className="flex items-center gap-1 leading-tight">
                <small className="text-primary-foreground/60">
                  ORCID: {getOrcidDisplayId(user!.id)}
                </small>
                <span className="text-primary-foreground/30">|</span>
                {renderBadges()}
              </div>
            </div>
          </div>
          {/* Mobile: compact badges next to sign-out */}
          <div className="flex sm:hidden items-center gap-1">
            {renderBadges()}
          </div>
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
