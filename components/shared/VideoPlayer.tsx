'use client';

import { Play } from 'lucide-react';
import { useState } from 'react';

interface VideoPlayerProps {
  src: string;
  title: string;
  description?: string;
  duration?: string;
  poster?: string;
}

export function VideoPlayer({
  src,
  title,
  description,
  duration,
  poster,
}: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="my-8 print:hidden">
      <div className="bg-card border-2 border-border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        <div className="relative bg-card-foreground aspect-video">
          {!isPlaying && (
            <div
              className="absolute inset-0 flex items-center justify-center cursor-pointer group"
              onClick={() => setIsPlaying(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsPlaying(true);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`Play video: ${title}`}
            >
              {/* Video thumbnail preview - shows first frame */}
              <video
                src={src}
                preload="metadata"
                className="absolute inset-0 w-full h-full object-cover"
                muted
                playsInline
              >
                <track kind="captions" />
              </video>
              {/* Optional custom poster image overlay */}
              {poster && (
                <img
                  src={poster}
                  alt={title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-card-foreground/40 group-hover:bg-card-foreground/50 transition-colors" />
              <div className="relative z-10 bg-primary/90 group-hover:bg-primary rounded-full p-6 shadow-lg transition-all group-hover:scale-110">
                <Play
                  size={48}
                  className="text-primary-foreground fill-primary-foreground"
                />
              </div>
            </div>
          )}
          {isPlaying && (
            <video
              src={src}
              controls
              autoPlay
              className="w-full h-full"
              onEnded={() => setIsPlaying(false)}
            >
              <track kind="captions" />
              Your browser does not support the video tag.
            </video>
          )}
        </div>
        <div className="p-4 bg-card">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h4 className="font-semibold text-foreground mb-1">{title}</h4>
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>
            {duration && (
              <span className="text-xs font-mono bg-muted text-muted-foreground px-2 py-1 rounded shrink-0">
                {duration}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
