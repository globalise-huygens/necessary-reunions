'use client';

import {
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  Code,
  Copy,
  Database,
  FileText,
  Link as LinkIcon,
  Map,
  Search,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { VideoPlayer } from './shared/VideoPlayer';

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
        <pre className="font-mono text-sm text-white">
          <code>{code}</code>
        </pre>
      </div>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-2 bg-muted/20 hover:bg-muted/30 rounded transition-all opacity-0 group-hover:opacity-100"
        aria-label="Copy code"
        type="button"
      >
        {copied ? (
          <Check size={16} className="text-secondary" />
        ) : (
          <Copy size={16} className="text-white" />
        )}
      </button>
    </div>
  );
}

function SectionHeading({
  id,
  level = 2,
  icon: Icon,
  children,
}: {
  id: string;
  level?: 2 | 3 | 4;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sizeClass =
    level === 2 ? 'text-3xl' : level === 3 ? 'text-2xl' : 'text-xl';

  const commonClasses = `${sizeClass} font-bold font-heading text-primary mb-6 flex items-center gap-3 group/heading scroll-mt-24 print:mb-4`;

  const content = (
    <>
      {Icon && <Icon className="text-secondary print:hidden" size={32} />}
      <span className="flex-1">{children}</span>
      <button
        onClick={handleCopyLink}
        className="opacity-0 group-hover/heading:opacity-100 transition-opacity p-2 hover:bg-muted rounded print:hidden"
        aria-label="Copy link to section"
        type="button"
      >
        {copied ? (
          <Check size={18} className="text-secondary" />
        ) : (
          <LinkIcon size={18} className="text-muted-foreground" />
        )}
      </button>
    </>
  );

  if (level === 2) {
    return (
      <h2 id={id} className={commonClasses}>
        {content}
      </h2>
    );
  }

  if (level === 3) {
    return (
      <h3 id={id} className={commonClasses}>
        {content}
      </h3>
    );
  }

  return (
    <h4 id={id} className={commonClasses}>
      {content}
    </h4>
  );
}

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: BookOpen },
  { id: 'getting-started', label: 'Getting Started', icon: Map },
  { id: 'recharted', label: 're:Charted', icon: Map },
  { id: 'gavoc', label: 'GAVOC', icon: Database },
  { id: 'gazetteer', label: 'Gazetteer', icon: Search },
  { id: 'api', label: 'API Documentation', icon: Code },
  { id: 'developers', label: 'For Developers', icon: FileText },
  { id: 'contributing', label: 'Contributing', icon: LinkIcon },
] as const;

export function DocumentationContent() {
  const [activeSection, setActiveSection] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [tocExpanded, setTocExpanded] = useState(true);
  const sectionRefs = useRef<Record<string, HTMLElement>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const setSectionRef = (id: string) => (element: HTMLElement | null) => {
    if (element) {
      sectionRefs.current[id] = element;
    } else {
      delete sectionRefs.current[id];
    }
  };

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      let currentSection = 'overview';
      let closestDistance = Infinity;

      Object.entries(sectionRefs.current).forEach(([id, section]) => {
        const rect = section.getBoundingClientRect();
        const viewportMiddle = 200;

        const distance = Math.abs(rect.top - viewportMiddle);

        if (rect.top < window.innerHeight && rect.bottom > 0) {
          if (rect.top <= viewportMiddle && rect.bottom >= viewportMiddle) {
            currentSection = id;
          } else if (
            distance < closestDistance &&
            rect.top > 0 &&
            rect.top < viewportMiddle + 100
          ) {
            closestDistance = distance;
            currentSection = id;
          }
        }
      });

      setActiveSection(currentSection);

      setShowBackToTop(scrollContainer.scrollTop > 300);

      const scrollTop = scrollContainer.scrollTop;
      const scrollHeight =
        scrollContainer.scrollHeight - scrollContainer.clientHeight;
      const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
      setScrollProgress(progress);
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === 'Escape') {
        setShowSearch(false);
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const searchResults = searchQuery.trim()
    ? NAV_ITEMS.filter(
        (item) =>
          item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.id.includes(searchQuery.toLowerCase()),
      ).slice(0, 5)
    : [];

  const scrollToSection = (sectionId: string) => {
    const element = sectionRefs.current[sectionId];
    const scrollContainer = scrollContainerRef.current;

    if (element && scrollContainer) {
      const containerTop = scrollContainer.getBoundingClientRect().top;
      const elementTop = element.getBoundingClientRect().top;
      const offset = 100;
      const scrollPosition =
        elementTop - containerTop + scrollContainer.scrollTop - offset;

      scrollContainer.scrollTo({ top: scrollPosition, behavior: 'smooth' });

      setShowSearch(false);
      setSearchQuery('');
    }
  };

  const scrollToTop = () => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div
      className="h-full overflow-auto bg-background"
      ref={scrollContainerRef}
    >
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          /* Hide interactive elements */
          .print\\:hidden {
            display: none !important;
          }

          /* Reset page styling for print */
          body {
            background: white !important;
          }

          /* Optimize typography for print */
          h1,
          h2,
          h3,
          h4,
          h5,
          h6 {
            page-break-after: avoid;
            break-after: avoid;
          }

          /* Avoid breaking inside elements */
          div,
          section,
          table,
          pre,
          blockquote {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          /* Ensure links show URLs */
          a[href^='http']::after {
            content: ' (' attr(href) ')';
            font-size: 0.8em;
            color: #666;
          }

          /* Optimize code blocks for print */
          pre,
          code {
            background: #f5f5f5 !important;
            border: 1px solid #ddd;
            page-break-inside: avoid;
          }

          /* Table of contents - show all on print */
          nav {
            position: static !important;
          }

          /* Remove shadows for print */
          * {
            box-shadow: none !important;
            text-shadow: none !important;
          }

          /* Ensure good contrast */
          .bg-primary,
          .text-primary {
            color: #000 !important;
          }

          /* Page margins */
          @page {
            margin: 2cm;
          }

          /* Show all content, remove scrolling */
          .overflow-auto {
            overflow: visible !important;
          }

          /* Fix grid layouts */
          .grid {
            display: block !important;
          }

          .grid > * {
            margin-bottom: 1rem;
          }
        }
      `}</style>

      {/* Reading Progress Indicator */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-muted/30 z-50 print:hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-150 ease-out"
          style={{ width: `${scrollProgress}%` }}
          role="progressbar"
          aria-valuenow={Math.round(scrollProgress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Reading progress"
        />
      </div>

      {/* Search Modal */}
      {showSearch && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-20 print:hidden"
          onClick={() => setShowSearch(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowSearch(false);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Close search modal"
        >
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events */}
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 border border-border"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
                <div className="flex items-center gap-3 flex-1 bg-muted/10 px-4 py-3 rounded-lg border border-border focus-within:border-primary focus-within:bg-white transition-all">
                  <Search size={20} className="text-muted-foreground" />
                  <input
                    placeholder="Search documentation..."
                    className="flex-1 outline-none text-base bg-transparent text-foreground placeholder:text-muted-foreground"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1.5 text-xs font-mono bg-muted text-muted-foreground border border-border rounded shadow-sm">
                  ⌘K
                </kbd>
                <button
                  onClick={() => setShowSearch(false)}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted px-3 py-1.5 rounded transition-colors"
                  type="button"
                  aria-label="Close search"
                >
                  <span className="text-sm font-medium">ESC</span>
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-1">
                  {searchResults.map((result) => (
                    <button
                      key={`search-result-${result.id}`}
                      onClick={() => scrollToSection(result.id)}
                      className="w-full text-left px-4 py-3 hover:bg-primary/10 rounded-lg transition-colors flex items-center gap-3 group"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {result.label}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
                        Jump to section →
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {searchQuery && searchResults.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Search
                    size={48}
                    className="mx-auto mb-3 text-muted-foreground/50"
                  />
                  <p className="font-medium">No results found</p>
                  <p className="text-sm mt-1">
                    Try searching for &quot;GAVOC&quot;, &quot;API&quot;, or
                    &quot;maps&quot;
                  </p>
                </div>
              )}

              {!searchQuery && (
                <div className="text-center py-12 text-muted-foreground">
                  <Search
                    size={48}
                    className="mx-auto mb-3 text-muted-foreground/50"
                  />
                  <p className="text-sm">
                    Start typing to search documentation sections
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-40 bg-primary text-primary-foreground p-3 rounded-full shadow-lg hover:bg-primary/90 transition-all duration-300 hover:scale-110 print:hidden"
          aria-label="Scroll to top"
          type="button"
        >
          <ArrowUp size={24} />
        </button>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-8 print:block">
        {/* Sidebar Navigation */}
        <aside className="w-64 flex-shrink-0 hidden lg:block print:hidden">
          <nav className="sticky top-8 bg-white rounded-lg shadow-md p-4">
            <button
              onClick={() => setTocExpanded(!tocExpanded)}
              className="w-full flex items-center justify-between text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 hover:text-primary transition-colors"
            >
              <span>Contents</span>
              <ChevronDown
                size={16}
                className={`transition-transform duration-200 ${tocExpanded ? 'rotate-0' : '-rotate-90'}`}
              />
            </button>
            {tocExpanded && (
              <ul className="space-y-1">
                {NAV_ITEMS.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <li key={`nav-${item.id}`}>
                      <button
                        onClick={() => scrollToSection(item.id)}
                        className={`w-full text-left px-3 py-2 rounded-md flex items-center gap-2 transition-colors ${
                          activeSection === item.id
                            ? 'bg-primary text-white'
                            : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        <ItemIcon size={16} />
                        <span className="text-sm">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 bg-white rounded-lg shadow-md p-8 lg:p-12">
          {/* Header */}
          <div className="mb-12">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-4xl font-bold font-heading text-primary mb-3">
                  Documentation
                </h1>
                <p className="text-xl text-muted-foreground">
                  User Guide & Technical Reference for Necessary Reunions Tools
                </p>
              </div>
              <button
                onClick={() => setShowSearch(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-border rounded-lg hover:bg-muted/10 transition-colors shadow-sm print:hidden"
              >
                <Search size={18} />
                <span className="text-sm text-foreground">Search</span>
                <kbd className="hidden md:inline-block px-2 py-1 text-xs bg-muted border border-border rounded">
                  ⌘K
                </kbd>
              </button>
            </div>
          </div>

          {/* Overview Section */}
          <section
            id="overview"
            className="mb-16 scroll-mt-24"
            ref={setSectionRef('overview')}
          >
            <SectionHeading id="overview" icon={BookOpen}>
              Overview
            </SectionHeading>
            <div className="prose max-w-none">
              <p className="text-foreground leading-relaxed mb-4 text-lg">
                The Necessary Reunions project reunites historical maps and
                textual sources from the Dutch East India Company (VOC) archives
                to reconceptualise Kerala&apos;s early modern topography. This
                documentation provides comprehensive guidance on using the three
                main tools developed for this project.
              </p>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                The Three Tools
              </h3>

              <div className="grid gap-4 my-6">
                <div className="border-2 border-primary/20 rounded-lg p-6 bg-muted/10 hover:border-primary/40 transition-colors">
                  <h4 className="font-bold font-heading text-primary text-lg mb-2">
                    re:Charted
                  </h4>
                  <p className="text-foreground">
                    An IIIF viewer and editor for browsing and annotating 30
                    historical Kerala maps from various archives, including the
                    Leupe collection at the National Archives in The Hague.
                  </p>
                </div>

                <div className="border-2 border-primary/20 rounded-lg p-6 bg-muted/10 hover:border-primary/40 transition-colors">
                  <h4 className="font-bold font-heading text-primary text-lg mb-2">
                    GAVOC (Grote Atlas van de Verenigde Oost-Indische Compagnie)
                  </h4>
                  <p className="text-foreground">
                    A historical place name database with over 11,000
                    standardised entries linking historical and modern names
                    with coordinates and categories, serving as a reference
                    dataset for external linking.
                  </p>
                </div>

                <div className="border-2 border-primary/20 rounded-lg p-6 bg-muted/10 hover:border-primary/40 transition-colors">
                  <h4 className="font-bold font-heading text-primary text-lg mb-2">
                    Gazetteer
                  </h4>
                  <p className="text-foreground">
                    A searchable interface for exploring places located on the
                    30 maps in re:Charted, showing the history and transitions
                    of places in the Kerala region.
                  </p>
                </div>
              </div>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Key Features
              </h3>
              <ul className="list-disc pl-6 text-foreground space-y-2">
                <li>Web-based and free to use for researchers worldwide</li>
                <li>IIIF manifest support for standardised image delivery</li>
                <li>SVG annotation capabilities for precise map markup</li>
                <li>
                  Integration between annotations and historical place names
                </li>
                <li>Public API for external linking and data integration</li>
                <li>Open source codebase hosted on GitHub</li>
              </ul>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Why This Project?
              </h3>
              <p className="text-foreground leading-relaxed mb-4">
                Historical maps and documents from the VOC tell richer stories
                when brought back together. The project reunites cartographic
                and textual sources that were separated by time and archival
                practice, enabling new insights into early modern Kerala&apos;s
                geography, economy, and society. By making these connections
                visible and searchable, researchers can trace how places were
                understood, named, and represented across different sources and
                time periods.
              </p>
            </div>
          </section>

          {/* Getting Started Section */}
          <section
            id="getting-started"
            className="mb-16 scroll-mt-24"
            ref={setSectionRef('getting-started')}
          >
            <h2 className="text-3xl font-bold font-heading text-primary mb-6 flex items-center gap-3">
              <Map className="text-secondary" size={32} />
              Getting Started
            </h2>
            <div className="prose max-w-none">
              <p className="text-foreground leading-relaxed mb-4 text-lg">
                All three tools are accessible directly through your web browser
                at{' '}
                <a
                  href="https://necessaryreunions.org"
                  className="text-primary hover:text-secondary font-semibold"
                >
                  necessaryreunions.org
                </a>
                . No installation or account creation is required for viewing
                and exploring the data.
              </p>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Quick Start Guide
              </h3>

              <div className="bg-secondary/10 border-l-4 border-secondary p-6 my-6 rounded-r">
                <p className="text-foreground font-bold mb-2 text-lg">
                  Step 1: Choose Your Tool
                </p>
                <p className="text-foreground">
                  Navigate to the homepage and select the tool that fits your
                  research needs. Use re:Charted for map exploration, GAVOC for
                  place name research, or Gazetteer for quick searches.
                </p>
              </div>

              <div className="bg-secondary/10 border-l-4 border-secondary p-6 my-6 rounded-r">
                <p className="text-foreground font-bold mb-2 text-lg">
                  Step 2: Explore the Interface
                </p>
                <p className="text-foreground">
                  Each tool has an intuitive interface designed for researchers.
                  Hover over buttons and interface elements for tooltips
                  explaining their function.
                </p>
              </div>

              <div className="bg-secondary/10 border-l-4 border-secondary p-6 my-6 rounded-r">
                <p className="text-foreground font-bold mb-2 text-lg">
                  Step 3: Use Search and Filter Functions
                </p>
                <p className="text-foreground">
                  All tools support searching by historical or modern place
                  names. Use filters to narrow down results by category, time
                  period, or geographic region.
                </p>
              </div>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Accessing the Data
              </h3>
              <p className="text-foreground leading-relaxed mb-4">
                All data created in the scope of this project will eventually be
                part of the larger{' '}
                <a
                  href="https://globalise.huygens.knaw.nl"
                  className="text-primary hover:text-secondary font-semibold"
                >
                  GLOBALISE project
                </a>
                . The code is freely available on{' '}
                <a
                  href="https://github.com/globalise-huygens/necessary-reunions"
                  className="text-primary hover:text-secondary font-semibold"
                >
                  GitHub
                </a>
                , and the data can be accessed via public APIs.
              </p>
            </div>
          </section>

          {/* re:Charted Section */}
          <section
            id="recharted"
            className="mb-16 scroll-mt-24"
            ref={setSectionRef('recharted')}
          >
            <h2 className="text-3xl font-bold font-heading text-primary mb-6 flex items-center gap-3">
              <Map className="text-secondary" size={32} />
              re:Charted: IIIF Map Viewer and Editor
            </h2>
            <div className="prose max-w-none">
              <p className="text-foreground leading-relaxed mb-4 text-lg">
                re:Charted is an IIIF (International Image Interoperability
                Framework) viewer and editor specifically designed for viewing
                and annotating historical Kerala maps from the VOC archives. The
                tool provides comprehensive functionality for browsing maps,
                viewing AI-generated annotations, and creating new annotations
                with linking to external gazetteers.
              </p>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                1. Info Tab: IIIF Viewer Basics
              </h3>
              <p className="text-foreground mb-4">
                The Info tab provides the foundation for navigating historical
                maps using the IIIF standard. This interface is designed for
                researchers who need to examine high-resolution digitised maps
                in detail.
              </p>

              <div className="bg-primary/5 border-l-4 border-primary p-6 my-6 rounded-r">
                <h4 className="font-bold text-foreground mb-3">
                  Core Navigation Features
                </h4>
                <ul className="space-y-2 text-foreground text-sm">
                  <li>
                    <strong>Pan:</strong> Click and drag to move around the map
                    surface
                  </li>
                  <li>
                    <strong>Zoom:</strong> Use scroll wheel or on-screen
                    controls to zoom in/out with deep zoom capabilities
                  </li>
                  <li>
                    <strong>Rotate:</strong> Rotate the map view to align with
                    different orientations for easier reading
                  </li>
                  <li>
                    <strong>Full Screen:</strong> Expand to full-screen mode for
                    immersive examination
                  </li>
                  <li>
                    <strong>Home:</strong> Reset view to default position and
                    zoom level
                  </li>
                </ul>
              </div>

              <VideoPlayer
                src="/video/neru_recharted_info-tab-and-manifest.mp4"
                title="Info Tab and Manifest Loading"
                description="Navigate the IIIF viewer interface and load map manifests"
              />

              <h3 className="text-2xl font-semibold font-heading text-primary mt-12 mb-4">
                2. Manifest: Metadata and Map Information
              </h3>
              <p className="text-foreground mb-4">
                Each map in re:Charted is served through an IIIF manifest
                containing essential metadata. The manifest panel displays
                comprehensive information about the historical map you are
                viewing.
              </p>

              <ul className="list-disc pl-6 text-foreground space-y-2 mb-6">
                <li>
                  <strong>Title:</strong> Full title of the historical map as
                  recorded in archival sources
                </li>
                <li>
                  <strong>Dimensions:</strong> Physical size and digital
                  resolution of the map
                </li>
                <li>
                  <strong>Source:</strong> Archival institution and collection
                  reference (e.g., Leupe collection, National Archives)
                </li>
                <li>
                  <strong>Date:</strong> Creation date or estimated date range
                  of the map
                </li>
                <li>
                  <strong>Attribution:</strong> Cartographer, draughtsman, or
                  surveyor information when available
                </li>
                <li>
                  <strong>Rights:</strong> Usage rights and copyright
                  information
                </li>
              </ul>

              <p className="text-foreground mb-4">
                This metadata is crucial for proper citation and understanding
                the historical context of each map. The manifest follows IIIF
                Presentation API 3.0 standards, ensuring interoperability with
                other IIIF-compatible tools and viewers.
              </p>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-12 mb-4">
                3. Map Tab: Georeferencing and Modern Overlay
              </h3>
              <p className="text-foreground mb-4">
                The Map tab provides georeferenced overlays that align
                historical maps with modern geographic coordinates. This
                powerful feature uses Allmaps and Leaflet to enable spatial
                comparison between historical and contemporary cartography.
              </p>

              <VideoPlayer
                src="/video/neru_recharted_map-tab.mp4"
                title="Map Tab: Georeferencing"
                description="Explore georeferenced overlays and adjust map alignment with modern coordinates"
              />

              <h4 className="text-xl font-semibold font-heading text-primary mt-8 mb-3">
                Georeferencing Features
              </h4>
              <ul className="list-disc pl-6 text-foreground space-y-2 mb-6">
                <li>
                  <strong>Allmaps Integration:</strong> Uses Allmaps
                  georeferencing engine to transform historical map coordinates
                  to modern geographic positions
                </li>
                <li>
                  <strong>Leaflet Base Map:</strong> Displays modern
                  OpenStreetMap tiles as reference layer
                </li>
                <li>
                  <strong>Adjustable Opacity:</strong> Slider control to blend
                  historical and modern maps for visual comparison
                </li>
                <li>
                  <strong>Control Points:</strong> View georeferencing control
                  points that anchor the historical map to modern coordinates
                </li>
                <li>
                  <strong>Transformation Accuracy:</strong> Visual indicators
                  showing alignment quality and distortion
                </li>
              </ul>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-12 mb-4">
                4. Annotation Tab: Viewing Mode
              </h3>
              <p className="text-foreground mb-4">
                For users who are not signed in, the Annotation tab operates in
                viewing mode, providing read-only access to all annotations on
                the map. This mode is ideal for researchers who want to explore
                existing annotations without editing capabilities.
              </p>

              <VideoPlayer
                src="/video/neru_recharted_annotation-tab-view-mode.mp4"
                title="Annotation Viewing Mode"
                description="Browse and filter AI-generated and human-verified annotations"
              />

              <h4 className="text-xl font-semibold font-heading text-primary mt-8 mb-3">
                Display and Filtering
              </h4>
              <p className="text-foreground mb-4">
                The annotation list shows all annotations for the currently
                displayed map canvas, organised with multiple filtering options:
              </p>

              <ul className="list-disc pl-6 text-foreground space-y-2 mb-6">
                <li>
                  <strong>AI vs Human Verified:</strong> Toggle to filter
                  between AI-generated annotations (from MapReader and Loghi)
                  and human-verified annotations that have been reviewed and
                  confirmed
                </li>
                <li>
                  <strong>Annotation Type:</strong> Filter by type (Text
                  Spotting, Iconography, Georeferencing, Linking)
                </li>
                <li>
                  <strong>Source:</strong> Filter by origin (Loghi AI, Other AI,
                  Human)
                </li>
                <li>
                  <strong>Assessment Status:</strong> View which annotations
                  have been checked and validated
                </li>
              </ul>

              <h4 className="text-xl font-semibold font-heading text-primary mt-8 mb-3">
                Text Search Function
              </h4>
              <p className="text-foreground mb-4">
                Search across all annotation text content to quickly locate
                specific place names, features, or terms on the map. The search
                function operates across all annotation types and highlights
                matching results in the list.
              </p>

              <h4 className="text-xl font-semibold font-heading text-primary mt-8 mb-3">
                Visual Indicators
              </h4>
              <p className="text-foreground mb-4">
                Each annotation in the list displays icons providing quick
                information about its properties:
              </p>

              <ul className="list-disc pl-6 text-foreground space-y-2 mb-6">
                <li>
                  <strong>Link Icon:</strong> Indicates the annotation is part
                  of a linking annotation connecting to geographic location
                </li>
                <li>
                  <strong>Comment Icon:</strong> Shows annotation has associated
                  comments or notes
                </li>
                <li>
                  <strong>Classification Icon:</strong> Displays assigned
                  iconography classification (fort, settlement, ship, etc.)
                </li>
                <li>
                  <strong>Checkmark Badge:</strong> Indicates human verification
                  and assessment status
                </li>
              </ul>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-12 mb-4">
                5. Annotation Tab: Editing Mode
              </h3>
              <p className="text-foreground mb-4">
                For authenticated users with editing permissions, the Annotation
                tab transforms into a comprehensive annotation workbench. This
                mode provides complete control over the annotation process,
                allowing researchers to refine AI-generated annotations, create
                new annotations, and establish geographic connections.
              </p>

              <div className="bg-secondary/10 border-2 border-secondary/30 rounded-lg p-6 my-8">
                <h4 className="font-bold font-heading text-secondary mb-3 text-lg">
                  Flexible Workflow
                </h4>
                <p className="text-foreground">
                  The editing steps can be performed in any order according to
                  your research workflow. There is no prescribed sequence –
                  annotators can delete incorrect annotations, add new ones,
                  correct existing content, assign classifications, add
                  comments, and create linking annotations as needed for each
                  map.
                </p>
              </div>

              <h4 className="text-xl font-semibold font-heading text-primary mt-8 mb-3">
                5a. Deletion: Managing Annotations
              </h4>
              <p className="text-foreground mb-4">
                Remove incorrect or duplicate annotations to maintain data
                quality. The deletion function supports both individual and bulk
                operations for efficient curation.
              </p>

              <VideoPlayer
                src="/video/neru_recharted_deleting.mp4"
                title="Deleting Annotations"
                description="Remove individual annotations or perform bulk deletion operations"
              />

              <ul className="list-disc pl-6 text-foreground space-y-2 mb-6">
                <li>
                  <strong>Single Deletion:</strong> Select and delete individual
                  annotations that are incorrect or unnecessary
                </li>
                <li>
                  <strong>Bulk Deletion:</strong> Select multiple annotations
                  using checkboxes and delete them in a single operation
                </li>
                <li>
                  <strong>Confirmation Dialog:</strong> Safety prompt prevents
                  accidental deletion of annotations
                </li>
                <li>
                  <strong>Undo Support:</strong> Recent deletions can be
                  reversed if removed in error
                </li>
              </ul>

              <p className="text-foreground mb-4">
                Deletion is particularly useful for removing AI-generated
                annotations that incorrectly identified map decorations,
                cartouches, or other non-geographic features as text or icons.
              </p>

              <h4 className="text-xl font-semibold font-heading text-primary mt-8 mb-3">
                5b. Correction: Refining Text and Geometry
              </h4>
              <p className="text-foreground mb-4">
                Correct and refine existing annotations by editing text content
                and adjusting SVG polygon boundaries. This step improves the
                accuracy of AI-generated annotations.
              </p>

              <VideoPlayer
                src="/video/neru_recharted_correct.mp4"
                title="Correcting Annotations"
                description="Edit text fields and adjust SVG polygon geometry for precise annotation"
              />

              <ul className="list-disc pl-6 text-foreground space-y-2 mb-6">
                <li>
                  <strong>Text Field Editing:</strong> Click to edit annotation
                  text, correcting OCR errors or incomplete transcriptions
                </li>
                <li>
                  <strong>SVG Polygon Adjustment:</strong> Drag polygon vertices
                  to precisely match the boundaries of text or iconography on
                  the map
                </li>
                <li>
                  <strong>Add/Remove Points:</strong> Add new vertices to
                  complex shapes or remove unnecessary points for cleaner
                  geometry
                </li>
                <li>
                  <strong>Live Preview:</strong> See changes reflected
                  immediately on the map as you edit
                </li>
              </ul>

              <div className="bg-accent/10 border-l-4 border-accent p-6 my-6 rounded-r">
                <h5 className="font-bold text-foreground mb-3">
                  Polygon Coverage Guidelines
                </h5>
                <p className="text-foreground mb-3">
                  When drawing or correcting SVG polygons, ensure all characters
                  are fully enclosed within the boundary. Zoom in close to
                  verify that polygon edges are near the character edges but do
                  not crop or pass through any part of the letters.
                </p>
                <ul className="space-y-2 text-foreground text-sm">
                  <li>
                    <strong>Full Coverage:</strong> All characters must be
                    completely visible within the polygon boundary
                  </li>
                  <li>
                    <strong>Tall Letters:</strong> Pay special attention to
                    ascending and descending letters like "f", "p", "g", "y" and
                    capital initials
                  </li>
                  <li>
                    <strong>Close Fit:</strong> Keep boundaries close to
                    character edges without overlapping the text itself
                  </li>
                  <li>
                    <strong>Avoid Inclusions:</strong> Try not to include other
                    map elements (icons, borders, other text) within the polygon
                    when possible
                  </li>
                </ul>
                <p className="text-foreground text-sm mt-3">
                  These guidelines follow the{' '}
                  <a
                    href="https://github.com/machines-reading-maps/Tutorials-Newsletters/wiki/Map-Text-Annotation-Guidelines"
                    className="text-primary hover:text-secondary font-semibold"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Machines Reading Maps annotation standards
                  </a>
                  .
                </p>
              </div>

              <h4 className="text-xl font-semibold font-heading text-primary mt-8 mb-3">
                5c. Add New: Creating Text and Iconography Annotations
              </h4>
              <p className="text-foreground mb-4">
                Create new annotations for map features that were not detected
                by AI systems. This includes both text spotting (place names,
                labels) and iconography (symbols, icons) annotations.
              </p>

              <VideoPlayer
                src="/video/neru_recharted_addnew.mp4"
                title="Adding New Annotations"
                description="Create new text spotting and iconography annotations from scratch"
              />

              <ul className="list-disc pl-6 text-foreground space-y-2 mb-6">
                <li>
                  <strong>Text Spotting:</strong> Draw a polygon around text on
                  the map and transcribe the content
                </li>
                <li>
                  <strong>Iconography:</strong> Draw a polygon around map
                  symbols, icons, or pictorial elements
                </li>
                <li>
                  <strong>Drawing Tools:</strong> Click to create polygon
                  vertices, double-click to complete shape
                </li>
                <li>
                  <strong>Metadata Entry:</strong> Add annotation body content
                  (text transcription or description)
                </li>
              </ul>

              <p className="text-foreground mb-4">
                When drawing new polygons, follow the same coverage guidelines
                as for corrections: ensure all characters or icon elements are
                fully enclosed without cropping. Zoom in to verify that polygon
                boundaries are close to the edges but do not pass through the
                text or symbols.
              </p>

              <p className="text-foreground mb-4">
                Adding new annotations is essential for capturing map features
                that AI systems miss, such as faded text, unusual iconography,
                or symbols in non-standard positions. This human curation
                ensures comprehensive coverage of all map content.
              </p>

              <h4 className="text-xl font-semibold font-heading text-primary mt-8 mb-3">
                5d. Assign Classification: Categorising Iconography
              </h4>
              <p className="text-foreground mb-4">
                Assign semantic classifications to iconography annotations using
                a controlled thesaurus of map symbol types. This structured
                classification enables systematic analysis of map content across
                the collection.
              </p>

              <VideoPlayer
                src="/video/neru_recharted_classification.mp4"
                title="Assigning Classifications"
                description="Categorise iconography annotations using the controlled thesaurus"
              />

              <ul className="list-disc pl-6 text-foreground space-y-2 mb-6">
                <li>
                  <strong>Thesaurus Selection:</strong> Choose from predefined
                  categories (fort, settlement, ship, church, etc.)
                </li>
                <li>
                  <strong>Hierarchical Structure:</strong> Classifications
                  organised by type and subtype
                </li>
                <li>
                  <strong>Multiple Classifications:</strong> Assign multiple
                  categories when a symbol has compound meaning
                </li>
                <li>
                  <strong>Visual Consistency:</strong> Colour-coded badges show
                  classification in annotation list
                </li>
              </ul>

              <h4 className="text-xl font-semibold font-heading text-primary mt-8 mb-3">
                5e. Comment and Mark: Assessment and Notes
              </h4>
              <p className="text-foreground mb-4">
                Add comments to annotations and mark them as assessed to track
                verification progress. This workflow feature supports
                collaborative annotation projects where multiple researchers
                review and validate map content.
              </p>

              <VideoPlayer
                src="/video/neru_recharted_commenting-assessing.mp4"
                title="Commenting and Assessment"
                description="Add comments and mark annotations as checked and verified"
              />

              <ul className="list-disc pl-6 text-foreground space-y-2 mb-6">
                <li>
                  <strong>Comment Field:</strong> Add notes about annotation
                  quality, uncertainty, or interpretation
                </li>
                <li>
                  <strong>Assessment Checkbox:</strong> Mark annotations as
                  &quot;checked&quot; after human verification
                </li>
                <li>
                  <strong>Annotation History:</strong> Track who made comments
                  and when assessments occurred
                </li>
                <li>
                  <strong>Quality Control:</strong> Filter views to show only
                  assessed or unassessed annotations
                </li>
              </ul>

              <p className="text-foreground mb-4">
                The assessment system is crucial for distinguishing between raw
                AI output and human-verified data. Researchers can focus their
                work on unassessed annotations or prioritise reviewing
                AI-generated content flagged with low confidence scores.
              </p>

              <h4 className="text-xl font-semibold font-heading text-primary mt-8 mb-3">
                5f. Link: Creating Geographic Connections
              </h4>
              <p className="text-foreground mb-4">
                The linking function is the most sophisticated editing feature,
                creating linking annotations that connect selected text spotting
                and iconography annotations in a reading order, associate them
                with external gazetteer entries, and establish geographic
                positioning on the map.
              </p>

              <VideoPlayer
                src="/video/neru_recharted_linking.mp4"
                title="Creating Linking Annotations"
                description="Link annotations to geographic locations using GAVOC, GLOBALISE, or OpenStreetMap"
              />

              <h5 className="font-semibold text-foreground mt-6 mb-3">
                Linking Annotation Components
              </h5>
              <ul className="list-disc pl-6 text-foreground space-y-3 mb-6">
                <li>
                  <strong>Reading Order:</strong> Select multiple text spotting
                  and iconography annotations and arrange them in reading order
                  (e.g., place name text + settlement icon). Numbered badges
                  appear on selected annotations showing their sequence.
                </li>
                <li>
                  <strong>Geotag from Thesaurus:</strong> Search and select a
                  matching place from one of three external thesauri:
                  <ul className="list-circle pl-6 mt-2 space-y-1 text-sm">
                    <li>
                      <strong>GAVOC:</strong> Historical place names database
                      specific to Kerala region
                    </li>
                    <li>
                      <strong>GLOBALISE Places:</strong> Broader VOC-era place
                      name dataset
                    </li>
                    <li>
                      <strong>Nominatim/OpenStreetMap:</strong> Modern place
                      names and coordinates
                    </li>
                  </ul>
                </li>
                <li>
                  <strong>Point Placement:</strong> Click on the map image to
                  add an x/y coordinate point showing the geographic centre of
                  the place. This point serves multiple purposes:
                  <ul className="list-circle pl-6 mt-2 space-y-1 text-sm">
                    <li>Visual marker of the place location on the map</li>
                    <li>
                      Data for improving georeferencing accuracy in future
                      iterations
                    </li>
                    <li>
                      Reference point for spatial analysis of place distribution
                    </li>
                  </ul>
                </li>
              </ul>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-12 mb-4">
                Interface Elements
              </h3>
              <ul className="list-disc pl-6 text-foreground space-y-2">
                <li>
                  <strong>Left Panel:</strong> Map collection browser with
                  thumbnails and search
                </li>
                <li>
                  <strong>Centre Viewport:</strong> Main map viewing area with
                  annotation overlays
                </li>
                <li>
                  <strong>Right Panel:</strong> Tabbed interface (Info,
                  Manifest, Map, Annotations)
                </li>
                <li>
                  <strong>Top Navigation:</strong> Project links and user
                  authentication
                </li>
              </ul>
            </div>
          </section>

          {/* GAVOC Section */}
          <section
            id="gavoc"
            className="mb-16 scroll-mt-24"
            ref={setSectionRef('gavoc')}
          >
            <h2 className="text-3xl font-bold font-heading text-primary mb-6 flex items-center gap-3">
              <Database className="text-secondary" size={32} />
              GAVOC: Historical Place Name Database
            </h2>
            <div className="prose max-w-none">
              <p className="text-foreground leading-relaxed mb-4 text-lg">
                GAVOC (Grote Atlas van de Verenigde Oost-Indische Compagnie) is
                a comprehensive database of historical place names from early
                modern Kerala, containing over 11,000 standardised entries
                linking historical and modern toponyms with geographic
                coordinates and semantic categories.
              </p>

              <p className="text-foreground leading-relaxed mb-6 text-base italic">
                The GAVOC database is based on the comprehensive index in:{' '}
                <a
                  href="https://www.nationaalarchief.nl/onderzoeken/archief/2.14.97/invnr/11.1/file/%20001%20VOC-I%20Dig"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Schilder, Gunter, Jacques Moerman, Ferjan Ormeling, Paul van
                  den Brink and Hans Ferwerda.{' '}
                  <em>
                    Grote atlas van de Verenigde Oost-Indische Compagnie. Volume
                    I: Atlas Isaak de Graaf
                  </em>
                  . Voorburg: Asia Maior, 2006. ISBN 9789074861137. [National
                  Archives, The Hague: 2.14.97, inv.nr. 11.1]
                </a>
              </p>

              <div className="bg-primary/5 border-2 border-primary/20 rounded-lg p-6 my-8">
                <h3 className="text-xl font-bold font-heading text-primary mb-4">
                  What is GAVOC?
                </h3>
                <ul className="space-y-2 text-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-1">•</span>
                    <span>
                      <strong>Historical Places:</strong> A curated collection
                      of place names from Dutch East India Company maps and
                      documents
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-1">•</span>
                    <span>
                      <strong>11,000+ Standardised Entries:</strong> Each entry
                      cleaned, verified, and structured for research use
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-1">•</span>
                    <span>
                      <strong>Comprehensive Metadata:</strong> Historical names,
                      modern equivalents, coordinates, and semantic categories
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-1">•</span>
                    <span>
                      <strong>Reference Dataset:</strong> Serves as the
                      authoritative linking target for annotations in re:Charted
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-1">•</span>
                    <span>
                      <strong>Persistent URIs:</strong> Each place has a unique,
                      citable identifier for long-term scholarly reference
                    </span>
                  </li>
                </ul>
              </div>

              <VideoPlayer
                src="/video/neru_gavoc.mp4"
                title="GAVOC Database Tutorial"
                description="Navigate the GAVOC interface, search for historical place names, and explore the map and table views"
              />

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Database Structure
              </h3>
              <div className="my-4 overflow-x-auto">
                <table className="w-full border-collapse border border-border">
                  <thead>
                    <tr className="bg-muted">
                      <th className="border border-border px-4 py-3 text-left font-semibold">
                        Field
                      </th>
                      <th className="border border-border px-4 py-3 text-left font-semibold">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    <tr>
                      <td className="border border-border px-4 py-2 font-medium">
                        Original Name
                      </td>
                      <td className="border border-border px-4 py-2">
                        Historical place name as it appears on the map
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-border px-4 py-2 font-medium">
                        Present Name
                      </td>
                      <td className="border border-border px-4 py-2">
                        Modern equivalent name
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-border px-4 py-2 font-medium">
                        Category
                      </td>
                      <td className="border border-border px-4 py-2">
                        Type of location (settlement, bay, island, region, etc.)
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-border px-4 py-2 font-medium">
                        Coordinates
                      </td>
                      <td className="border border-border px-4 py-2">
                        Modern geographic coordinates (latitude/longitude)
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-border px-4 py-2 font-medium">
                        Map Grid Square
                      </td>
                      <td className="border border-border px-4 py-2">
                        Location reference on the original atlas
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-border px-4 py-2 font-medium">
                        Map Reference
                      </td>
                      <td className="border border-border px-4 py-2">
                        Map identifier
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-border px-4 py-2 font-medium">
                        Page Reference
                      </td>
                      <td className="border border-border px-4 py-2">
                        Page number in the atlas
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Interface Overview
              </h3>
              <p className="text-foreground mb-4">
                GAVOC provides two complementary views for exploring the
                database: a map-based geographical browser and a table-based
                detailed view. Both interfaces support full-text search and
                category filtering.
              </p>

              {/* Screenshot Placeholder */}
              <div className="bg-muted border-2 border-dashed border-border rounded-lg p-8 my-6 text-center">
                <div className="text-muted-foreground">
                  <p className="font-semibold">GAVOC Interface Screenshot</p>
                  <p className="text-sm">
                    Map and table views with search functionality
                  </p>
                </div>
              </div>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Step-by-Step Workflows
              </h3>

              <div className="my-8">
                <h4 className="text-xl font-bold font-heading text-primary mb-6 flex items-center gap-2">
                  <span className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center text-sm">
                    1
                  </span>
                  Basic Search Workflow
                </h4>

                <div className="space-y-4 ml-10">
                  <div className="border-l-4 border-accent bg-accent/5 p-6 rounded-r">
                    <h5 className="font-bold text-foreground mb-2">
                      Step 1: Enter Search Terms
                    </h5>
                    <p className="text-foreground mb-3">
                      Navigate to the GAVOC page and locate the search box at
                      the top. Enter either a historical Dutch/Portuguese name
                      or a modern place name. The search is case-insensitive and
                      searches across both original and present name fields.
                    </p>
                    <div className="bg-white border border-border rounded p-3 my-3">
                      <p className="text-sm text-muted-foreground mb-1">
                        <strong>Example searches:</strong>
                      </p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• &quot;Cochin&quot; (historical Dutch name)</li>
                        <li>• &quot;Kochi&quot; (modern name)</li>
                        <li>
                          • &quot;Poorten Eyl&quot; (historical island name)
                        </li>
                        <li>• &quot;Kahatola&quot; (modern equivalent)</li>
                      </ul>
                    </div>
                  </div>

                  <div className="border-l-4 border-accent bg-accent/5 p-6 rounded-r">
                    <h5 className="font-bold text-foreground mb-2">
                      Step 2: Apply Category Filters
                    </h5>
                    <p className="text-foreground mb-3">
                      Use the category dropdown to filter results by location
                      type. This narrows down results when searching common
                      terms or exploring specific types of places.
                    </p>
                    <div className="bg-white border border-border rounded p-3 my-3">
                      <p className="text-sm text-muted-foreground mb-1">
                        <strong>Available categories:</strong>
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <div>
                          <li>• Settlement (stad)</li>
                          <li>• Bay (baai)</li>
                          <li>• Island (eiland)</li>
                          <li>• River (rivier)</li>
                        </div>
                        <div>
                          <li>• Region (regio)</li>
                          <li>• Fort (fort)</li>
                          <li>• Temple (tempel)</li>
                          <li>• Coast (kust)</li>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-l-4 border-accent bg-accent/5 p-6 rounded-r">
                    <h5 className="font-bold text-foreground mb-2">
                      Step 3: Explore Results on Map
                    </h5>
                    <p className="text-foreground mb-3">
                      Results appear immediately on the interactive map.
                      Clustered markers group nearby locations. Click clusters
                      to zoom in, or click individual markers to view place
                      details including historical context and modern location.
                    </p>
                  </div>

                  <div className="border-l-4 border-accent bg-accent/5 p-6 rounded-r">
                    <h5 className="font-bold text-foreground mb-2">
                      Step 4: Review Detailed Information
                    </h5>
                    <p className="text-foreground mb-3">
                      Switch to the Table tab to view structured data. The table
                      shows all metadata fields including map grid references,
                      page numbers from the original atlas, and precise
                      coordinates. Click any row to highlight the location on
                      the map.
                    </p>
                  </div>
                </div>
              </div>

              {/* Screenshot Placeholder */}
              <div className="bg-muted border-2 border-dashed border-border rounded-lg p-8 my-6 text-center">
                <div className="text-muted-foreground">
                  <p className="font-semibold">Search Results Screenshot</p>
                  <p className="text-sm">
                    Map view with clustered markers and popup details
                  </p>
                </div>
              </div>

              <div className="my-8">
                <h4 className="text-xl font-bold font-heading text-primary mb-6 flex items-center gap-2">
                  <span className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center text-sm">
                    2
                  </span>
                  Working with the Thesaurus
                </h4>

                <div className="space-y-4 ml-10">
                  <div className="border-l-4 border-secondary bg-secondary/5 p-6 rounded-r">
                    <h5 className="font-bold text-foreground mb-2">
                      Understanding Name Variations
                    </h5>
                    <p className="text-foreground mb-3">
                      The Thesaurus tab reveals how place names evolved over
                      time and across different cartographic traditions. It
                      shows relationships between Dutch, Portuguese, and local
                      Malayalam toponyms.
                    </p>
                    <div className="bg-white border border-border rounded p-3 my-3">
                      <p className="text-sm text-muted-foreground">
                        <strong>Example:</strong> The place &quot;Cochin&quot;
                        appears with variants like &quot;Cochim&quot;,
                        &quot;Cotchym&quot;, and &quot;Kochi&quot;, showing
                        orthographic variations and modern standardisation.
                      </p>
                    </div>
                  </div>

                  <div className="border-l-4 border-secondary bg-secondary/5 p-6 rounded-r">
                    <h5 className="font-bold text-foreground mb-2">
                      Exploring Semantic Relationships
                    </h5>
                    <p className="text-foreground mb-3">
                      The thesaurus connects related places through hierarchical
                      and associative relationships. Settlements are linked to
                      their surrounding regions, ports to their associated bays,
                      and historical administrative units to modern equivalents.
                    </p>
                  </div>
                </div>
              </div>

              <div className="my-8">
                <h4 className="text-xl font-bold font-heading text-primary mb-6 flex items-center gap-2">
                  <span className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center text-sm">
                    3
                  </span>
                  Using Persistent URIs for Citations
                </h4>

                <div className="space-y-4 ml-10">
                  <div className="border-l-4 border-primary bg-primary/5 p-6 rounded-r">
                    <h5 className="font-bold text-foreground mb-2">
                      Accessing Persistent Identifiers
                    </h5>
                    <p className="text-foreground mb-3">
                      Each place in GAVOC has a unique, persistent URI that can
                      be used in scholarly citations, linked data applications,
                      and external research projects. Click on any place detail
                      to view its URI.
                    </p>
                    <div className="bg-gray-900 rounded p-3 my-3">
                      <code className="text-green-300 text-xs">
                        https://necessaryreunions.org/gavoc/7954/cochin-kochi
                      </code>
                    </div>
                  </div>

                  <div className="border-l-4 border-primary bg-primary/5 p-6 rounded-r">
                    <h5 className="font-bold text-foreground mb-2">
                      Linking from External Projects
                    </h5>
                    <p className="text-foreground mb-3">
                      Use GAVOC URIs in your own research database, digital
                      edition, or web application. The persistent identifiers
                      ensure long-term stability and enable integration with the
                      broader GLOBALISE infrastructure.
                    </p>
                  </div>

                  <div className="border-l-4 border-primary bg-primary/5 p-6 rounded-r">
                    <h5 className="font-bold text-foreground mb-2">
                      API Integration
                    </h5>
                    <p className="text-foreground mb-3">
                      Programmatically access GAVOC data through the public API.
                      Query by name, category, or geographic bounding box.
                      Results are returned in JSON format for easy integration
                      into your workflows.
                    </p>
                    <div className="bg-gray-900 rounded p-3 my-3">
                      <code className="text-green-300 text-xs block mb-2">
                        GET /api/gavoc?search=cochin&category=settlement
                      </code>
                      <code className="text-blue-300 text-xs">
                        Returns: JSON with place details, coordinates, and
                        metadata
                      </code>
                    </div>
                  </div>
                </div>
              </div>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-12 mb-4">
                Map View Features
              </h3>
              <div className="grid md:grid-cols-2 gap-4 my-6">
                <div className="border border-border rounded-lg p-4 bg-muted/10">
                  <h4 className="font-semibold text-foreground mb-2">
                    OpenStreetMap View
                  </h4>
                  <p className="text-muted-foreground text-sm">
                    Standard street map view showing modern roads, settlements,
                    and geographic features for contextualising historical
                    locations.
                  </p>
                </div>

                <div className="border border-border rounded-lg p-4 bg-muted/10">
                  <h4 className="font-semibold text-foreground mb-2">
                    Satellite View
                  </h4>
                  <p className="text-muted-foreground text-sm">
                    Aerial imagery overlay providing visual context for coastal
                    features, river systems, and topographical relationships.
                  </p>
                </div>

                <div className="border border-border rounded-lg p-4 bg-muted/10">
                  <h4 className="font-semibold text-foreground mb-2">
                    Terrain View
                  </h4>
                  <p className="text-muted-foreground text-sm">
                    Topographic display highlighting elevation changes,
                    important for understanding defensive positions and trade
                    routes.
                  </p>
                </div>

                <div className="border border-border rounded-lg p-4 bg-muted/10">
                  <h4 className="font-semibold text-foreground mb-2">
                    Marker Clustering
                  </h4>
                  <p className="text-muted-foreground text-sm">
                    Automatic grouping of nearby locations for clarity at
                    different zoom levels, preventing marker overlap.
                  </p>
                </div>
              </div>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Integration with Other Tools
              </h3>
              <p className="text-foreground mb-4">
                GAVOC serves as the reference dataset for the entire Necessary
                Reunions project, providing authoritative place name data for:
              </p>
              <ul className="list-disc pl-6 text-foreground space-y-2 mb-6">
                <li>
                  <strong>re:Charted Linking Annotations:</strong> When creating
                  geotagging annotations in the map viewer, GAVOC provides the
                  target locations with persistent identifiers.
                </li>
                <li>
                  <strong>Gazetteer Search:</strong> The Gazetteer tool queries
                  GAVOC data to show which historical maps contain specific
                  places.
                </li>
                <li>
                  <strong>External Research Projects:</strong> The public API
                  enables integration with digital editions, databases, and web
                  applications beyond this project.
                </li>
              </ul>
            </div>
          </section>

          {/* Gazetteer Section */}
          <section
            id="gazetteer"
            className="mb-16 scroll-mt-24"
            ref={setSectionRef('gazetteer')}
          >
            <h2 className="text-3xl font-bold font-heading text-primary mb-6 flex items-center gap-3">
              <Search className="text-secondary" size={32} />
              Gazetteer: Place Search Interface
            </h2>
            <div className="prose max-w-none">
              <p className="text-foreground leading-relaxed mb-4 text-lg">
                The Gazetteer provides a streamlined search interface for
                exploring places located on the 30 maps available in re:Charted.
                It collects linked and geotagged places from map annotations,
                building comprehensive place biographies that show the history
                and transitions of locations in Kerala across different sources
                and time periods.
              </p>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Core Concept
              </h3>
              <p className="text-foreground mb-4">
                The Gazetteer aggregates all geotagged annotations from the 30
                historical maps in re:Charted, creating a searchable database of
                places that appear across the collection. Unlike GAVOC, which
                provides comprehensive historical place name data for the entire
                Kerala region, the Gazetteer focuses specifically on places that
                have been annotated and linked on the maps in this project.
              </p>

              <div className="bg-primary/5 border-2 border-primary/20 rounded-lg p-6 my-8">
                <h4 className="font-bold font-heading text-primary mb-3 text-lg">
                  What Makes the Gazetteer Unique?
                </h4>
                <ul className="space-y-2 text-foreground">
                  <li>
                    <strong>Map-Centric:</strong> Every entry is directly linked
                    to one or more historical maps where the place appears
                  </li>
                  <li>
                    <strong>Annotation-Based:</strong> Places are derived from
                    linking annotations that connect map features to geographic
                    locations
                  </li>
                  <li>
                    <strong>Contextual:</strong> Shows how often and in what
                    context each place appears across the map collection
                  </li>
                  <li>
                    <strong>Biographical:</strong> Builds a place biography by
                    aggregating information from multiple maps and time periods
                  </li>
                </ul>
              </div>

              <VideoPlayer
                src="/video/neru_gazetteer_search.mp4"
                title="Gazetteer Search Tutorial"
                description="Learn how to search for places and navigate the Gazetteer interface"
              />

              <h3 className="text-2xl font-semibold font-heading text-primary mt-12 mb-4">
                Browsing and Search
              </h3>

              <h4 className="text-xl font-semibold font-heading text-primary mt-6 mb-3">
                List View
              </h4>
              <p className="text-foreground mb-4">
                The default list view displays all places in the Gazetteer as a
                searchable table. Each entry shows:
              </p>
              <ul className="list-disc pl-6 text-foreground space-y-2 mb-6">
                <li>
                  <strong>Place Name:</strong> The standardised modern name of
                  the location
                </li>
                <li>
                  <strong>Historical Variants:</strong> Alternative names found
                  on the historical maps
                </li>
                <li>
                  <strong>Map Count:</strong> Number of maps in the collection
                  where this place appears
                </li>
                <li>
                  <strong>Classification:</strong> Category or type of place
                  (settlement, fort, port, etc.)
                </li>
              </ul>

              <h4 className="text-xl font-semibold font-heading text-primary mt-6 mb-3">
                Map View
              </h4>
              <p className="text-foreground mb-4">
                Switch to map view to see all Gazetteer places plotted on a
                modern base map. This geographic visualisation helps you:
              </p>
              <ul className="list-disc pl-6 text-foreground space-y-2 mb-6">
                <li>Understand the spatial distribution of annotated places</li>
                <li>
                  Identify clusters of frequently mapped locations along the
                  coast or inland
                </li>
                <li>
                  Explore geographic relationships between places in the
                  collection
                </li>
                <li>
                  Click on map markers to view place details and linked maps
                </li>
              </ul>

              <h4 className="text-xl font-semibold font-heading text-primary mt-6 mb-3">
                Search Functionality
              </h4>
              <p className="text-foreground mb-4">
                The Gazetteer supports flexible search across both modern and
                historical place names:
              </p>

              <div className="space-y-4 my-6">
                <div className="border-l-4 border-secondary bg-secondary/5 p-6 rounded-r">
                  <h5 className="font-bold text-foreground mb-2">
                    Modern Name Search
                  </h5>
                  <p className="text-foreground text-sm">
                    Search using contemporary place names like &quot;Kochi&quot;
                    or &quot;Kannur&quot; to find how these locations appear on
                    historical maps.
                  </p>
                </div>

                <div className="border-l-4 border-secondary bg-secondary/5 p-6 rounded-r">
                  <h5 className="font-bold text-foreground mb-2">
                    Historical Name Search
                  </h5>
                  <p className="text-foreground text-sm">
                    Search using VOC-era names like &quot;Cochin&quot; or
                    &quot;Cananoor&quot; to discover which maps include these
                    historical toponyms.
                  </p>
                </div>

                <div className="border-l-4 border-secondary bg-secondary/5 p-6 rounded-r">
                  <h5 className="font-bold text-foreground mb-2">
                    Partial Matching
                  </h5>
                  <p className="text-foreground text-sm">
                    Use partial search terms to find variations and similar
                    names across the collection.
                  </p>
                </div>
              </div>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-12 mb-4">
                Detailed Place Pages
              </h3>
              <p className="text-foreground mb-4">
                Click on any place in the Gazetteer to view its detailed page,
                which aggregates information from all maps where the place
                appears.
              </p>

              <VideoPlayer
                src="/video/neru_gazetteer-place-details.mp4"
                title="Exploring Place Details"
                description="Navigate detailed place pages and discover linked maps and annotations"
              />

              <h4 className="text-xl font-semibold font-heading text-primary mt-8 mb-3">
                Place Overview
              </h4>
              <p className="text-foreground mb-4">
                The top section of each place page provides essential
                information:
              </p>
              <ul className="list-disc pl-6 text-foreground space-y-2 mb-6">
                <li>
                  <strong>Primary Name:</strong> The standardised modern name
                  used as the main identifier
                </li>
                <li>
                  <strong>Geographic Coordinates:</strong> Latitude and
                  longitude of the location
                </li>
                <li>
                  <strong>Modern Map:</strong> Interactive map showing the
                  present-day location
                </li>
                <li>
                  <strong>Quick Stats:</strong> Number of maps featuring this
                  place and total annotations
                </li>
              </ul>

              <h4 className="text-xl font-semibold font-heading text-primary mt-6 mb-3">
                Name Variants and Classifications
              </h4>
              <p className="text-foreground mb-4">
                The Gazetteer displays all name variations found across the map
                annotations, showing:
              </p>
              <ul className="list-disc pl-6 text-foreground space-y-2 mb-6">
                <li>
                  <strong>Historical Spellings:</strong> Different orthographic
                  variants used in VOC-era maps
                </li>
                <li>
                  <strong>Language Variations:</strong> Names in Dutch,
                  Portuguese, and local languages
                </li>
                <li>
                  <strong>Classifications:</strong> Categories assigned to the
                  place (settlement, fort, port, river, etc.)
                </li>
                <li>
                  <strong>Source Attribution:</strong> Which maps contain each
                  name variant
                </li>
              </ul>

              <h4 className="text-xl font-semibold font-heading text-primary mt-6 mb-3">
                Links to Maps and Annotations
              </h4>
              <p className="text-foreground mb-4">
                Each place page shows all maps where the location appears,
                providing direct navigation to view the place in its historical
                cartographic context:
              </p>
              <ul className="list-disc pl-6 text-foreground space-y-2 mb-6">
                <li>
                  <strong>Map Thumbnails:</strong> Visual previews of each map
                  featuring the place
                </li>
                <li>
                  <strong>Map Metadata:</strong> Title, date, and source
                  information for each map
                </li>
                <li>
                  <strong>Direct Links:</strong> Click to open the map in
                  re:Charted with the place annotation highlighted
                </li>
                <li>
                  <strong>Annotation Details:</strong> View the specific
                  iconography or text annotations linked to this place
                </li>
              </ul>

              <h4 className="text-xl font-semibold font-heading text-primary mt-6 mb-3">
                Frequency and Context
              </h4>
              <p className="text-foreground mb-4">
                The Gazetteer analyses how often and in what contexts each place
                appears across the map collection:
              </p>
              <ul className="list-disc pl-6 text-foreground space-y-2 mb-6">
                <li>
                  <strong>Temporal Distribution:</strong> Timeline showing when
                  the place appears on maps across different decades
                </li>
                <li>
                  <strong>Map Coverage:</strong> Percentage of the collection
                  that includes this place
                </li>
                <li>
                  <strong>Annotation Types:</strong> Breakdown of how the place
                  is represented (iconography, text labels, fortification
                  symbols)
                </li>
                <li>
                  <strong>Cartographic Prominence:</strong> Analysis of how
                  prominently the place is featured on different maps
                </li>
              </ul>

              <h4 className="text-xl font-semibold font-heading text-primary mt-6 mb-3">
                Building Place Biographies
              </h4>
              <p className="text-foreground mb-4">
                By aggregating information across multiple maps and time
                periods, the Gazetteer constructs a &quot;biography&quot; for
                each place showing:
              </p>
              <ul className="list-disc pl-6 text-foreground space-y-2 mb-6">
                <li>
                  <strong>Name Evolution:</strong> How the place name changed or
                  was standardised over time
                </li>
                <li>
                  <strong>Functional Changes:</strong> Shifts in classification
                  (e.g., from settlement to fortified port)
                </li>
                <li>
                  <strong>Cartographic Attention:</strong> Periods when the
                  place received more or less detailed representation
                </li>
                <li>
                  <strong>Geographic Context:</strong> How the place&apos;s
                  relationship to nearby features was depicted across different
                  maps
                </li>
              </ul>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-12 mb-4">
                Integration with Other Tools
              </h3>
              <p className="text-foreground mb-4">
                The Gazetteer acts as a bridge between GAVOC&apos;s
                comprehensive historical database and re:Charted&apos;s visual
                map interface:
              </p>
              <ul className="list-disc pl-6 text-foreground space-y-2 mb-6">
                <li>
                  <strong>GAVOC Connection:</strong> Places in the Gazetteer
                  link to their GAVOC entries for additional historical and
                  geographic context
                </li>
                <li>
                  <strong>re:Charted Integration:</strong> Click through from
                  Gazetteer to view any place on its original historical map
                  with full annotation context
                </li>
                <li>
                  <strong>Cross-Reference:</strong> Use the Gazetteer to
                  discover which GAVOC places appear on which maps, and which
                  maps contain annotations for specific locations
                </li>
              </ul>

              <div className="bg-primary/10 border-2 border-primary/30 rounded-lg p-6 my-8">
                <h4 className="font-bold font-heading text-primary mb-3 text-lg">
                  Workflow: From Search to Visual Analysis
                </h4>
                <ol className="list-decimal pl-6 text-foreground space-y-2">
                  <li>
                    Search for a place in the Gazetteer using modern or
                    historical names
                  </li>
                  <li>
                    Review the place page to see frequency, name variants, and
                    map coverage
                  </li>
                  <li>
                    Click on a specific map to open it in re:Charted viewer
                  </li>
                  <li>
                    Explore the annotation in visual context with surrounding
                    features
                  </li>
                  <li>
                    Use linking annotations to discover related places and
                    iconography
                  </li>
                  <li>
                    Cross-reference with GAVOC for broader historical and
                    geographic context
                  </li>
                </ol>
              </div>
            </div>
          </section>

          {/* API Documentation Section */}
          <section
            id="api"
            className="mb-16 scroll-mt-24"
            ref={setSectionRef('api')}
          >
            <h2 className="text-3xl font-bold font-heading text-primary mb-6 flex items-center gap-3">
              <Code className="text-secondary" size={32} />
              API Documentation
            </h2>
            <div className="prose max-w-none">
              <p className="text-foreground leading-relaxed mb-4 text-lg">
                The Necessary Reunions project provides public APIs for
                accessing place name data and integrating with external research
                projects and datasets.
              </p>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                GAVOC API
              </h3>
              <p className="text-foreground mb-4">
                The GAVOC API provides programmatic access to the historical
                place name database, allowing you to query locations and
                retrieve their historical and modern names, coordinates, and
                categories.
              </p>

              <div className="bg-gray-900 rounded-lg p-4 my-6 font-mono text-sm overflow-x-auto">
                <div className="mb-3">
                  <span className="text-green-400 font-semibold">GET</span>{' '}
                  <span className="text-blue-300">/api/gavoc</span>
                </div>
                <div className="text-muted-foreground text-xs">
                  Retrieve a list of places with optional filtering
                </div>
              </div>

              <h4 className="text-xl font-semibold font-heading text-primary mt-6 mb-3">
                Query Parameters
              </h4>
              <div className="my-4 overflow-x-auto">
                <table className="w-full border-collapse border border-border text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th className="border border-border px-4 py-2 text-left font-semibold">
                        Parameter
                      </th>
                      <th className="border border-border px-4 py-2 text-left font-semibold">
                        Type
                      </th>
                      <th className="border border-border px-4 py-2 text-left font-semibold">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-border px-4 py-2 font-mono text-xs">
                        search
                      </td>
                      <td className="border border-border px-4 py-2">string</td>
                      <td className="border border-border px-4 py-2">
                        Search term for place names
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-border px-4 py-2 font-mono text-xs">
                        category
                      </td>
                      <td className="border border-border px-4 py-2">string</td>
                      <td className="border border-border px-4 py-2">
                        Filter by location category
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-border px-4 py-2 font-mono text-xs">
                        limit
                      </td>
                      <td className="border border-border px-4 py-2">
                        integer
                      </td>
                      <td className="border border-border px-4 py-2">
                        Number of results to return (default: 50)
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-border px-4 py-2 font-mono text-xs">
                        offset
                      </td>
                      <td className="border border-border px-4 py-2">
                        integer
                      </td>
                      <td className="border border-border px-4 py-2">
                        Pagination offset
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h4 className="text-xl font-semibold font-heading text-primary mt-6 mb-3">
                Example Request
              </h4>
              <CodeBlock code="GET https://necessaryreunions.org/api/gavoc?search=Cochin&category=settlement&limit=10" />

              <h4 className="text-xl font-semibold font-heading text-primary mt-6 mb-3">
                Example Response
              </h4>
              <CodeBlock
                code={`{
  "places": [
    {
      "id": 7954,
      "originalName": "Cochin",
      "presentName": "Kochi",
      "category": "stad, settlement",
      "coordinates": "9.9667° N, 76.2833° E",
      "mapGridSquare": "B3",
      "mapReference": "II-28",
      "pageReference": "p. 338"
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0
}`}
              />

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Gazetteer API
              </h3>
              <p className="text-foreground mb-4">
                Access places from the Gazetteer database, which contains all
                locations annotated on the 30 maps in re:Charted.
              </p>

              <div className="bg-gray-900 rounded-lg p-4 my-6 font-mono text-sm overflow-x-auto">
                <div className="mb-3">
                  <span className="text-green-400 font-semibold">GET</span>{' '}
                  <span className="text-blue-300">/api/gazetteer</span>
                </div>
                <div className="text-muted-foreground text-xs">
                  Search places in the gazetteer database
                </div>
              </div>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                IIIF Manifests
              </h3>
              <p className="text-foreground mb-4">
                All maps are served using the IIIF (International Image
                Interoperability Framework) protocol, allowing integration with
                any IIIF-compatible viewer or application.
              </p>

              <div className="bg-gray-900 rounded-lg p-4 my-6 font-mono text-sm overflow-x-auto">
                <div className="mb-3">
                  <span className="text-green-400 font-semibold">GET</span>{' '}
                  <span className="text-blue-300">
                    https://globalise-huygens.github.io/necessary-reunions/manifest.json
                  </span>
                </div>
                <div className="text-muted-foreground text-xs">
                  Access the main IIIF collection manifest
                </div>
              </div>

              <div className="bg-accent/10 border-l-4 border-accent p-6 my-6 rounded-r">
                <p className="text-foreground font-semibold mb-2">
                  Rate Limits & Usage
                </p>
                <p className="text-foreground text-sm">
                  The APIs are freely accessible for research purposes. Please
                  be considerate with request volume. For large-scale data
                  access, consider downloading the full datasets from GitHub.
                </p>
              </div>
            </div>
          </section>

          {/* For Developers Section */}
          <section
            id="developers"
            className="mb-16 scroll-mt-24"
            ref={setSectionRef('developers')}
          >
            <h2 className="text-3xl font-bold font-heading text-primary mb-6 flex items-center gap-3">
              <FileText className="text-secondary" size={32} />
              For Developers
            </h2>
            <div className="prose max-w-none">
              <p className="text-foreground leading-relaxed mb-4 text-lg">
                The Necessary Reunions codebase is open source and available on
                GitHub. This section provides technical details for developers
                who want to run the project locally, contribute, or adapt it for
                their own research.
              </p>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Technology Stack
              </h3>
              <ul className="list-disc pl-6 text-foreground space-y-2">
                <li>
                  <strong>Framework:</strong> Next.js 14 with App Router
                </li>
                <li>
                  <strong>Language:</strong> TypeScript
                </li>
                <li>
                  <strong>Styling:</strong> Tailwind CSS
                </li>
                <li>
                  <strong>Map Viewer:</strong> OpenSeadragon (IIIF)
                </li>
                <li>
                  <strong>Modern Maps:</strong> Leaflet with OpenStreetMap
                </li>
                <li>
                  <strong>Annotations:</strong> W3C Web Annotations (AnnoRepo)
                </li>
                <li>
                  <strong>Package Manager:</strong> pnpm
                </li>
                <li>
                  <strong>Deployment:</strong> Netlify
                </li>
              </ul>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Local Development Setup
              </h3>

              <h4 className="text-xl font-semibold font-heading text-primary mt-6 mb-3">
                Prerequisites
              </h4>
              <ul className="list-disc pl-6 text-foreground space-y-2">
                <li>Node.js 22 or higher</li>
                <li>pnpm package manager</li>
                <li>Git</li>
              </ul>

              <h4 className="text-xl font-semibold font-heading text-primary mt-6 mb-3">
                Installation Steps
              </h4>

              <div className="space-y-4 my-6">
                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <div className="text-muted-foreground text-xs mb-2">
                    1. Clone the repository
                  </div>
                  <pre className="text-green-300 text-sm">
                    {`git clone https://github.com/globalise-huygens/necessary-reunions.git
cd necessary-reunions`}
                  </pre>
                </div>

                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <div className="text-muted-foreground text-xs mb-2">
                    2. Install dependencies
                  </div>
                  <pre className="text-green-300 text-sm">pnpm install</pre>
                </div>

                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <div className="text-muted-foreground text-xs mb-2">
                    3. Set up environment variables
                  </div>
                  <pre className="text-green-300 text-sm">
                    {`cp .env.example .env.local
# Edit .env.local with your configuration`}
                  </pre>
                </div>

                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <div className="text-muted-foreground text-xs mb-2">
                    4. Run the development server
                  </div>
                  <pre className="text-green-300 text-sm">pnpm dev</pre>
                </div>
              </div>

              <p className="text-foreground mb-4">
                The application will be available at{' '}
                <code className="bg-muted px-2 py-1 rounded text-sm">
                  http://localhost:3001
                </code>
              </p>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Environment Variables
              </h3>
              <div className="my-4 overflow-x-auto">
                <table className="w-full border-collapse border border-border text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th className="border border-border px-4 py-2 text-left font-semibold">
                        Variable
                      </th>
                      <th className="border border-border px-4 py-2 text-left font-semibold">
                        Description
                      </th>
                      <th className="border border-border px-4 py-2 text-left font-semibold">
                        Required
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-border px-4 py-2 font-mono text-xs">
                        ANNO_REPO_TOKEN_JONA
                      </td>
                      <td className="border border-border px-4 py-2">
                        Authentication token for AnnoRepo
                      </td>
                      <td className="border border-border px-4 py-2">Yes</td>
                    </tr>
                    <tr>
                      <td className="border border-border px-4 py-2 font-mono text-xs">
                        NEXTAUTH_SECRET
                      </td>
                      <td className="border border-border px-4 py-2">
                        Secret for NextAuth.js authentication
                      </td>
                      <td className="border border-border px-4 py-2">Yes</td>
                    </tr>
                    <tr>
                      <td className="border border-border px-4 py-2 font-mono text-xs">
                        NEXTAUTH_URL
                      </td>
                      <td className="border border-border px-4 py-2">
                        Base URL for authentication callbacks
                      </td>
                      <td className="border border-border px-4 py-2">Yes</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Project Structure
              </h3>
              <CodeBlock
                code={`necessary-reunions/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── viewer/            # re:Charted viewer pages
│   ├── gavoc/             # GAVOC tool pages
│   └── gazetteer/         # Gazetteer pages
├── components/            # React components
│   ├── viewer/           # re:Charted components
│   ├── gavoc/            # GAVOC components
│   ├── gazetteer/        # Gazetteer components
│   └── shared/           # Shared UI components
├── hooks/                 # Custom React hooks
├── lib/                   # Utility functions and types
│   ├── viewer/           # IIIF and annotation utilities
│   ├── gavoc/            # GAVOC data processing
│   └── gazetteer/        # Gazetteer utilities
├── data/                  # Static data and scripts
│   ├── scripts/          # Python processing scripts
│   └── manifest.json     # IIIF collection manifest
└── public/               # Static assets`}
              />

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Key Architectural Patterns
              </h3>

              <h4 className="text-xl font-semibold font-heading text-primary mt-6 mb-3">
                IIIF-First Design
              </h4>
              <p className="text-foreground mb-4">
                The application is built around the International Image
                Interoperability Framework (IIIF) for handling historical maps
                and manuscripts. All images are served via IIIF Image API, and
                metadata follows the IIIF Presentation API specification.
              </p>

              <h4 className="text-xl font-semibold font-heading text-primary mt-6 mb-3">
                Multi-Layer Annotation System
              </h4>
              <p className="text-foreground mb-4">
                Four distinct annotation types with different data sources:
              </p>
              <ul className="list-disc pl-6 text-foreground space-y-2">
                <li>
                  <strong>Local:</strong> User-created annotations with full
                  CRUD operations
                </li>
                <li>
                  <strong>External:</strong> AI-generated annotations from
                  AnnoRepo service
                </li>
                <li>
                  <strong>Linking:</strong> Relationship annotations between
                  targets
                </li>
                <li>
                  <strong>Georeferencing:</strong> Generated during manifest
                  creation for map overlay
                </li>
              </ul>

              <h4 className="text-xl font-semibold font-heading text-primary mt-6 mb-3">
                Service Resilience Patterns
              </h4>
              <p className="text-foreground mb-4">
                Critical anti-pattern prevention for external service failures.
                All external API calls use timeout controllers with graceful
                fallbacks to prevent UI crashes.
              </p>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Python Scripts for Data Processing
              </h3>
              <p className="text-foreground mb-4">
                The{' '}
                <code className="bg-muted px-2 py-1 rounded text-sm">
                  data/scripts/
                </code>{' '}
                directory contains Python pipelines for:
              </p>
              <ul className="list-disc pl-6 text-foreground space-y-2">
                <li>
                  <strong>make_manifest.py:</strong> Generate IIIF manifests
                  from CSV data
                </li>
                <li>
                  <strong>download_images.py:</strong> Batch download using
                  dezoomify-rs tool
                </li>
                <li>
                  <strong>textspotting/spot_text.py:</strong> AI text
                  recognition pipeline
                </li>
                <li>
                  <strong>segmentation/segment_icons.py:</strong> Icon detection
                  with SAM model
                </li>
              </ul>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Adapting for Your Own Project
              </h3>
              <p className="text-foreground mb-4">
                To adapt this codebase for your own historical map project:
              </p>
              <ol className="list-decimal pl-6 text-foreground space-y-3">
                <li>
                  <strong>Prepare your images:</strong> Convert your historical
                  maps to IIIF-compatible format
                </li>
                <li>
                  <strong>Create manifests:</strong> Use the{' '}
                  <code className="bg-muted px-2 py-1 rounded text-sm">
                    make_manifest.py
                  </code>{' '}
                  script as a template
                </li>
                <li>
                  <strong>Set up AnnoRepo:</strong> Configure your own AnnoRepo
                  container for annotations
                </li>
                <li>
                  <strong>Customise the UI:</strong> Update branding, colours,
                  and text in the components
                </li>
                <li>
                  <strong>Deploy:</strong> Use Netlify, Vercel, or your
                  preferred hosting platform
                </li>
              </ol>
            </div>
          </section>

          {/* Contributing Section */}
          <section
            id="contributing"
            className="mb-16 scroll-mt-24"
            ref={setSectionRef('contributing')}
          >
            <h2 className="text-3xl font-bold font-heading text-primary mb-6 flex items-center gap-3">
              <LinkIcon className="text-secondary" size={32} />
              Contributing
            </h2>
            <div className="prose max-w-none">
              <p className="text-foreground leading-relaxed mb-4 text-lg">
                Contributions to the Necessary Reunions project are welcome.
                Whether you&apos;re fixing bugs, improving documentation, or
                proposing new features, your input helps advance digital
                humanities research.
              </p>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Opening Issues
              </h3>
              <p className="text-foreground mb-4">
                If you encounter bugs or have feature requests,{' '}
                <a
                  href="https://github.com/globalise-huygens/necessary-reunions/issues"
                  className="text-primary hover:text-secondary font-semibold"
                >
                  open an issue on GitHub
                </a>
                . Include:
              </p>
              <ul className="list-disc pl-6 text-foreground space-y-2 mb-6">
                <li>Clear description of the problem or suggestion</li>
                <li>Steps to reproduce (for bugs)</li>
                <li>Expected vs actual behaviour</li>
                <li>Screenshots if applicable</li>
                <li>Browser and device information</li>
              </ul>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Pull Requests
              </h3>
              <p className="text-foreground mb-4">
                To contribute code changes, fork the repository, create a
                branch, make your changes, and submit a pull request. The
                project uses automated linting and formatting (ESLint and
                Prettier).
              </p>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Contact the Team
              </h3>
              <p className="text-foreground mb-4">
                For questions about the project or collaboration opportunities,
                contact:
              </p>
              <ul className="list-disc pl-6 text-foreground space-y-2">
                <li>
                  <strong>Dr Manjusha Kuruppath</strong> - Project Lead (Huygens
                  Institute)
                </li>
                <li>
                  <strong>Leon van Wissen</strong> - Technical Lead (University
                  of Amsterdam)
                </li>
                <li>
                  <strong>Jona Schlegel</strong> - Developer (Huygens Institute
                  / archaeoINK)
                </li>
              </ul>

              <div className="bg-primary/10 border-2 border-primary/30 rounded-lg p-6 my-8">
                <h4 className="font-bold font-heading text-primary mb-3 text-lg">
                  Acknowledgements
                </h4>
                <p className="text-foreground">
                  This project is funded by the NWO XS grant (March–December
                  2025) and conducted at the Huygens Institute. It builds upon
                  the broader{' '}
                  <a
                    href="https://globalise.huygens.knaw.nl"
                    className="text-primary hover:text-secondary font-semibold"
                  >
                    GLOBALISE project
                  </a>
                  , which aims to unlock the archives of the Dutch East India
                  Company for researchers worldwide.
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
