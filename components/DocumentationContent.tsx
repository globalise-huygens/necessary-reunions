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

// CodeBlock component with copy functionality
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

// SectionHeading component with anchor link
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
        className="opacity-0 group-hover/heading:opacity-100 transition-opacity p-2 hover:bg-gray-100 rounded print:hidden"
        aria-label="Copy link to section"
        type="button"
      >
        {copied ? (
          <Check size={18} className="text-secondary" />
        ) : (
          <LinkIcon size={18} className="text-gray-400" />
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

// Navigation items constant (moved outside component to avoid memoization issues)
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
        const viewportMiddle = 200; // Target position for active section

        // Calculate distance from section top to target position
        const distance = Math.abs(rect.top - viewportMiddle);

        // Only consider sections that are visible in viewport
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          // Prioritize sections near the top of viewport
          if (rect.top <= viewportMiddle && rect.bottom >= viewportMiddle) {
            currentSection = id;
          } else if (
            distance < closestDistance &&
            rect.top > 0 &&
            rect.top < viewportMiddle + 100
          ) {
            // If no section spans the target position, use the closest one
            closestDistance = distance;
            currentSection = id;
          }
        }
      });

      setActiveSection(currentSection);

      // Show back-to-top button after scrolling 300px
      setShowBackToTop(scrollContainer.scrollTop > 300);

      // Calculate scroll progress percentage
      const scrollTop = scrollContainer.scrollTop;
      const scrollHeight =
        scrollContainer.scrollHeight - scrollContainer.clientHeight;
      const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
      setScrollProgress(progress);
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  // Search functionality
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to open search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
      // Escape to close search
      if (e.key === 'Escape') {
        setShowSearch(false);
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Compute search results directly
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

      // Close search after navigation
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
    <div className="h-full overflow-auto bg-gray-50" ref={scrollContainerRef}>
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
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 border border-gray-200"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
                <div className="flex items-center gap-3 flex-1 bg-gray-50 px-4 py-3 rounded-lg border border-gray-200 focus-within:border-primary focus-within:bg-white transition-all">
                  <Search size={20} className="text-gray-400" />
                  <input
                    placeholder="Search documentation..."
                    className="flex-1 outline-none text-base bg-transparent text-gray-900 placeholder:text-gray-400"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1.5 text-xs font-mono bg-gray-100 text-gray-600 border border-gray-300 rounded shadow-sm">
                  ⌘K
                </kbd>
                <button
                  onClick={() => setShowSearch(false)}
                  className="text-gray-500 hover:text-gray-900 hover:bg-gray-100 px-3 py-1.5 rounded transition-colors"
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
                        <div className="font-semibold text-gray-900 group-hover:text-primary transition-colors">
                          {result.label}
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 group-hover:text-primary transition-colors">
                        Jump to section →
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {searchQuery && searchResults.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Search size={48} className="mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">No results found</p>
                  <p className="text-sm mt-1">
                    Try searching for &quot;GAVOC&quot;, &quot;API&quot;, or
                    &quot;maps&quot;
                  </p>
                </div>
              )}

              {!searchQuery && (
                <div className="text-center py-12 text-gray-400">
                  <Search size={48} className="mx-auto mb-3 text-gray-300" />
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
              className="w-full flex items-center justify-between text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 hover:text-primary transition-colors"
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
                            : 'text-gray-700 hover:bg-gray-100'
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
                <p className="text-xl text-gray-600">
                  User Guide & Technical Reference for Necessary Reunions Tools
                </p>
              </div>
              <button
                onClick={() => setShowSearch(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm print:hidden"
              >
                <Search size={18} />
                <span className="text-sm text-gray-700">Search</span>
                <kbd className="hidden md:inline-block px-2 py-1 text-xs bg-gray-100 border border-gray-300 rounded">
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
              <p className="text-gray-700 leading-relaxed mb-4 text-lg">
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
                <div className="border-2 border-primary/20 rounded-lg p-6 bg-gray-50 hover:border-primary/40 transition-colors">
                  <h4 className="font-bold font-heading text-primary text-lg mb-2">
                    re:Charted
                  </h4>
                  <p className="text-gray-700">
                    An IIIF viewer and editor for browsing and annotating 30
                    historical Kerala maps from various archives, including the
                    Leupe collection at the National Archives in The Hague.
                  </p>
                </div>

                <div className="border-2 border-primary/20 rounded-lg p-6 bg-gray-50 hover:border-primary/40 transition-colors">
                  <h4 className="font-bold font-heading text-primary text-lg mb-2">
                    GAVOC (Grote Atlas van de Verenigde Oost-Indische Compagnie)
                  </h4>
                  <p className="text-gray-700">
                    A historical place name database with over 11,000
                    standardised entries linking historical and modern names
                    with coordinates and categories, serving as a reference
                    dataset for external linking.
                  </p>
                </div>

                <div className="border-2 border-primary/20 rounded-lg p-6 bg-gray-50 hover:border-primary/40 transition-colors">
                  <h4 className="font-bold font-heading text-primary text-lg mb-2">
                    Gazetteer
                  </h4>
                  <p className="text-gray-700">
                    A searchable interface for exploring places located on the
                    30 maps in re:Charted, showing the history and transitions
                    of places in the Kerala region.
                  </p>
                </div>
              </div>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Key Features
              </h3>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
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
              <p className="text-gray-700 leading-relaxed mb-4">
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
              <p className="text-gray-700 leading-relaxed mb-4 text-lg">
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
                <p className="text-gray-800 font-bold mb-2 text-lg">
                  Step 1: Choose Your Tool
                </p>
                <p className="text-gray-700">
                  Navigate to the homepage and select the tool that fits your
                  research needs. Use re:Charted for map exploration, GAVOC for
                  place name research, or Gazetteer for quick searches.
                </p>
              </div>

              <div className="bg-secondary/10 border-l-4 border-secondary p-6 my-6 rounded-r">
                <p className="text-gray-800 font-bold mb-2 text-lg">
                  Step 2: Explore the Interface
                </p>
                <p className="text-gray-700">
                  Each tool has an intuitive interface designed for researchers.
                  Hover over buttons and interface elements for tooltips
                  explaining their function.
                </p>
              </div>

              <div className="bg-secondary/10 border-l-4 border-secondary p-6 my-6 rounded-r">
                <p className="text-gray-800 font-bold mb-2 text-lg">
                  Step 3: Use Search and Filter Functions
                </p>
                <p className="text-gray-700">
                  All tools support searching by historical or modern place
                  names. Use filters to narrow down results by category, time
                  period, or geographic region.
                </p>
              </div>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Accessing the Data
              </h3>
              <p className="text-gray-700 leading-relaxed mb-4">
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
              re:Charted: IIIF Map Viewer
            </h2>
            <div className="prose max-w-none">
              <p className="text-gray-700 leading-relaxed mb-4 text-lg">
                re:Charted is an IIIF (International Image Interoperability
                Framework) viewer and editor specifically designed for viewing
                and annotating historical Kerala maps from the VOC archives.
              </p>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Features
              </h3>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>
                  <strong>IIIF Manifest Loading:</strong> Browse 30 curated
                  historical maps with high-resolution images
                </li>
                <li>
                  <strong>Pan, Zoom, and Rotate:</strong> Navigate maps with
                  intuitive controls
                </li>
                <li>
                  <strong>View Annotations:</strong> See existing SVG
                  annotations on maps including text spotting, iconography, and
                  geotagging
                </li>
                <li>
                  <strong>Linking Annotations:</strong> Explore relationships
                  between annotations across multiple canvases
                </li>
                <li>
                  <strong>Manifest Information Panel:</strong> Access metadata
                  including title, dimensions, and source information
                </li>
                <li>
                  <strong>Multiple Annotation Types:</strong> Local annotations,
                  external AI-generated annotations, and linking annotations
                </li>
              </ul>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                How to Use re:Charted
              </h3>

              <div className="my-6 space-y-6">
                <div className="border-l-4 border-primary bg-primary/5 p-6 rounded-r">
                  <h4 className="font-bold font-heading text-primary mb-3 text-lg">
                    1. Browse the Map Collection
                  </h4>
                  <p className="text-gray-700 mb-2">
                    From the re:Charted homepage, you&apos;ll see a collection
                    sidebar with available maps. Each entry shows a thumbnail,
                    title, and basic metadata.
                  </p>
                </div>

                <div className="border-l-4 border-primary bg-primary/5 p-6 rounded-r">
                  <h4 className="font-bold font-heading text-primary mb-3 text-lg">
                    2. Open a Map
                  </h4>
                  <p className="text-gray-700 mb-2">
                    Click on any map to open it in the full viewer. The map will
                    load at its optimal viewing size with OpenSeadragon&apos;s
                    deep zoom capabilities.
                  </p>
                </div>

                <div className="border-l-4 border-primary bg-primary/5 p-6 rounded-r">
                  <h4 className="font-bold font-heading text-primary mb-3 text-lg">
                    3. Navigate the Map
                  </h4>
                  <p className="text-gray-700 mb-2">
                    Use your mouse to pan (click and drag), zoom (scroll wheel),
                    or use the on-screen controls. The rotation function allows
                    you to orient the map as needed.
                  </p>
                </div>

                <div className="border-l-4 border-primary bg-primary/5 p-6 rounded-r">
                  <h4 className="font-bold font-heading text-primary mb-3 text-lg">
                    4. View and Filter Annotations
                  </h4>
                  <p className="text-gray-700 mb-2">
                    The right sidebar shows all annotations for the current map.
                    Filter by type (Text, Icon, Georeferencing, Linking) and
                    source (Human, Loghi AI, Other AI). Click any annotation to
                    highlight it on the map and view its details.
                  </p>
                </div>

                <div className="border-l-4 border-primary bg-primary/5 p-6 rounded-r">
                  <h4 className="font-bold font-heading text-primary mb-3 text-lg">
                    5. Explore Linking Annotations
                  </h4>
                  <p className="text-gray-700 mb-2">
                    Linking annotations connect places on maps to geographic
                    locations and other annotations. When you select a linking
                    annotation, you&apos;ll see connected annotations
                    highlighted with numbered badges showing their
                    relationships.
                  </p>
                </div>

                <div className="border-l-4 border-primary bg-primary/5 p-6 rounded-r">
                  <h4 className="font-bold font-heading text-primary mb-3 text-lg">
                    6. Use the Geotag Map
                  </h4>
                  <p className="text-gray-700 mb-2">
                    For annotations with geotagging data, click the map icon to
                    see the location on a modern map. This helps you understand
                    the historical location in contemporary geographic context.
                  </p>
                </div>
              </div>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Interface Elements
              </h3>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>
                  <strong>Left Panel:</strong> Map collection browser with
                  thumbnails and search
                </li>
                <li>
                  <strong>Centre Viewport:</strong> Main map viewing area with
                  annotation overlays
                </li>
                <li>
                  <strong>Right Panel:</strong> Annotation list with filtering
                  and detail views
                </li>
                <li>
                  <strong>Top Navigation:</strong> Project links and manifest
                  switcher
                </li>
              </ul>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Annotation Types
              </h3>
              <div className="grid gap-4 my-6">
                <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                  <h4 className="font-semibold text-gray-800 mb-2">
                    Text Annotations
                  </h4>
                  <p className="text-gray-600 text-sm">
                    Handwritten text detected using MapReader and Loghi AI,
                    showing place names and other textual information on
                    historical maps.
                  </p>
                </div>

                <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                  <h4 className="font-semibold text-gray-800 mb-2">
                    Icon Annotations
                  </h4>
                  <p className="text-gray-600 text-sm">
                    Symbols and icons detected using Meta AI Segment Everything,
                    representing settlements, fortifications, churches, and
                    other features.
                  </p>
                </div>

                <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                  <h4 className="font-semibold text-gray-800 mb-2">
                    Georeferencing Annotations
                  </h4>
                  <p className="text-gray-600 text-sm">
                    Control points linking historical map coordinates to modern
                    geographic positions, enabling map overlay and
                    transformation.
                  </p>
                </div>

                <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                  <h4 className="font-semibold text-gray-800 mb-2">
                    Linking Annotations
                  </h4>
                  <p className="text-gray-600 text-sm">
                    Connections between annotations and geographic places,
                    showing relationships across maps and linking to external
                    gazetteers like GAVOC.
                  </p>
                </div>
              </div>
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
              <p className="text-gray-700 leading-relaxed mb-4 text-lg">
                GAVOC (Grote Atlas van de Verenigde Oost-Indische Compagnie) is
                a comprehensive database of historical place names from early
                modern Kerala, containing over 11,000 standardised entries
                linking historical and modern toponyms with geographic
                coordinates and semantic categories.
              </p>

              <div className="bg-primary/5 border-2 border-primary/20 rounded-lg p-6 my-8">
                <h3 className="text-xl font-bold font-heading text-primary mb-4">
                  What is GAVOC?
                </h3>
                <ul className="space-y-2 text-gray-700">
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

              {/* Video Tutorial Placeholder */}
              <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 my-8 text-center">
                <div className="text-gray-500 mb-3">
                  <Database size={48} className="mx-auto mb-3" />
                  <p className="font-semibold text-lg">Video Tutorial</p>
                  <p className="text-sm">
                    Introduction to GAVOC: Navigating Historical Place Names
                  </p>
                </div>
                <p className="text-gray-400 text-xs italic">
                  Video placeholder - Duration: 3-5 minutes
                </p>
              </div>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Database Structure
              </h3>
              <div className="my-4 overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-3 text-left font-semibold">
                        Field
                      </th>
                      <th className="border border-gray-300 px-4 py-3 text-left font-semibold">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    <tr>
                      <td className="border border-gray-300 px-4 py-2 font-medium">
                        Original Name
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        Historical place name as it appears on the map
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2 font-medium">
                        Present Name
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        Modern equivalent name
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2 font-medium">
                        Category
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        Type of location (settlement, bay, island, region, etc.)
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2 font-medium">
                        Coordinates
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        Modern geographic coordinates (latitude/longitude)
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2 font-medium">
                        Map Grid Square
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        Location reference on the original atlas
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2 font-medium">
                        Map Reference
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        Map identifier
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2 font-medium">
                        Page Reference
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        Page number in the atlas
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Interface Overview
              </h3>
              <p className="text-gray-700 mb-4">
                GAVOC provides two complementary views for exploring the
                database: a map-based geographical browser and a table-based
                detailed view. Both interfaces support full-text search and
                category filtering.
              </p>

              {/* Screenshot Placeholder */}
              <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 my-6 text-center">
                <div className="text-gray-500">
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
                    <h5 className="font-bold text-gray-800 mb-2">
                      Step 1: Enter Search Terms
                    </h5>
                    <p className="text-gray-700 mb-3">
                      Navigate to the GAVOC page and locate the search box at
                      the top. Enter either a historical Dutch/Portuguese name
                      or a modern place name. The search is case-insensitive and
                      searches across both original and present name fields.
                    </p>
                    <div className="bg-white border border-gray-300 rounded p-3 my-3">
                      <p className="text-sm text-gray-600 mb-1">
                        <strong>Example searches:</strong>
                      </p>
                      <ul className="text-sm text-gray-600 space-y-1">
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
                    <h5 className="font-bold text-gray-800 mb-2">
                      Step 2: Apply Category Filters
                    </h5>
                    <p className="text-gray-700 mb-3">
                      Use the category dropdown to filter results by location
                      type. This narrows down results when searching common
                      terms or exploring specific types of places.
                    </p>
                    <div className="bg-white border border-gray-300 rounded p-3 my-3">
                      <p className="text-sm text-gray-600 mb-1">
                        <strong>Available categories:</strong>
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
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
                    <h5 className="font-bold text-gray-800 mb-2">
                      Step 3: Explore Results on Map
                    </h5>
                    <p className="text-gray-700 mb-3">
                      Results appear immediately on the interactive map.
                      Clustered markers group nearby locations. Click clusters
                      to zoom in, or click individual markers to view place
                      details including historical context and modern location.
                    </p>
                  </div>

                  <div className="border-l-4 border-accent bg-accent/5 p-6 rounded-r">
                    <h5 className="font-bold text-gray-800 mb-2">
                      Step 4: Review Detailed Information
                    </h5>
                    <p className="text-gray-700 mb-3">
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
              <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 my-6 text-center">
                <div className="text-gray-500">
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
                    <h5 className="font-bold text-gray-800 mb-2">
                      Understanding Name Variations
                    </h5>
                    <p className="text-gray-700 mb-3">
                      The Thesaurus tab reveals how place names evolved over
                      time and across different cartographic traditions. It
                      shows relationships between Dutch, Portuguese, and local
                      Malayalam toponyms.
                    </p>
                    <div className="bg-white border border-gray-300 rounded p-3 my-3">
                      <p className="text-sm text-gray-600">
                        <strong>Example:</strong> The place &quot;Cochin&quot;
                        appears with variants like &quot;Cochim&quot;,
                        &quot;Cotchym&quot;, and &quot;Kochi&quot;, showing
                        orthographic variations and modern standardisation.
                      </p>
                    </div>
                  </div>

                  <div className="border-l-4 border-secondary bg-secondary/5 p-6 rounded-r">
                    <h5 className="font-bold text-gray-800 mb-2">
                      Exploring Semantic Relationships
                    </h5>
                    <p className="text-gray-700 mb-3">
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
                    <h5 className="font-bold text-gray-800 mb-2">
                      Accessing Persistent Identifiers
                    </h5>
                    <p className="text-gray-700 mb-3">
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
                    <h5 className="font-bold text-gray-800 mb-2">
                      Linking from External Projects
                    </h5>
                    <p className="text-gray-700 mb-3">
                      Use GAVOC URIs in your own research database, digital
                      edition, or web application. The persistent identifiers
                      ensure long-term stability and enable integration with the
                      broader GLOBALISE infrastructure.
                    </p>
                  </div>

                  <div className="border-l-4 border-primary bg-primary/5 p-6 rounded-r">
                    <h5 className="font-bold text-gray-800 mb-2">
                      API Integration
                    </h5>
                    <p className="text-gray-700 mb-3">
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
                <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                  <h4 className="font-semibold text-gray-800 mb-2">
                    OpenStreetMap View
                  </h4>
                  <p className="text-gray-600 text-sm">
                    Standard street map view showing modern roads, settlements,
                    and geographic features for contextualising historical
                    locations.
                  </p>
                </div>

                <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                  <h4 className="font-semibold text-gray-800 mb-2">
                    Satellite View
                  </h4>
                  <p className="text-gray-600 text-sm">
                    Aerial imagery overlay providing visual context for coastal
                    features, river systems, and topographical relationships.
                  </p>
                </div>

                <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                  <h4 className="font-semibold text-gray-800 mb-2">
                    Terrain View
                  </h4>
                  <p className="text-gray-600 text-sm">
                    Topographic display highlighting elevation changes,
                    important for understanding defensive positions and trade
                    routes.
                  </p>
                </div>

                <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                  <h4 className="font-semibold text-gray-800 mb-2">
                    Marker Clustering
                  </h4>
                  <p className="text-gray-600 text-sm">
                    Automatic grouping of nearby locations for clarity at
                    different zoom levels, preventing marker overlap.
                  </p>
                </div>
              </div>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Integration with Other Tools
              </h3>
              <p className="text-gray-700 mb-4">
                GAVOC serves as the reference dataset for the entire Necessary
                Reunions project, providing authoritative place name data for:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-6">
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

              <div className="bg-blue-50 border-l-4 border-blue-600 p-6 my-8 rounded-r">
                <h4 className="font-bold text-gray-800 mb-3">
                  Research Use Case Example
                </h4>
                <p className="text-gray-700 mb-3">
                  A researcher studying VOC trade networks can search GAVOC for
                  all settlements along the Malabar Coast, filter by category
                  (port, settlement), view their historical names and modern
                  locations, then cross-reference these places with annotations
                  in re:Charted to see which maps depict them and what
                  additional information (fortifications, surrounding features)
                  is shown.
                </p>
              </div>

              {/* Video Tutorial Placeholder */}
              <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 my-8 text-center">
                <div className="text-gray-500 mb-3">
                  <Database size={48} className="mx-auto mb-3" />
                  <p className="font-semibold text-lg">
                    Advanced Workflow Tutorial
                  </p>
                  <p className="text-sm">
                    Using GAVOC for Historical Geographic Research
                  </p>
                </div>
                <p className="text-gray-400 text-xs italic">
                  Video placeholder - Duration: 5-7 minutes
                </p>
              </div>
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
              <p className="text-gray-700 leading-relaxed mb-4 text-lg">
                The Gazetteer provides a streamlined search interface for
                exploring places located on the 30 maps available in re:Charted,
                with direct connections showing the history and transitions of
                places in Kerala.
              </p>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Key Features
              </h3>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>Quick search functionality for place names</li>
                <li>Integration with re:Charted map annotations</li>
                <li>Direct links to view places in their map context</li>
                <li>Historical place name variations and connections</li>
                <li>
                  Geographic visualisation on modern maps with historical
                  context
                </li>
              </ul>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Using the Gazetteer
              </h3>

              <div className="my-6 space-y-6">
                <div className="border-l-4 border-secondary bg-secondary/5 p-6 rounded-r">
                  <h4 className="font-bold font-heading text-primary mb-3 text-lg">
                    Simple Search
                  </h4>
                  <p className="text-gray-700 mb-2">
                    Enter a place name in the search box. The Gazetteer searches
                    across all annotated places on the 30 maps in the
                    collection, including both historical and modern names.
                  </p>
                </div>

                <div className="border-l-4 border-secondary bg-secondary/5 p-6 rounded-r">
                  <h4 className="font-bold font-heading text-primary mb-3 text-lg">
                    View in Context
                  </h4>
                  <p className="text-gray-700 mb-2">
                    Click on any search result to view the place in its map
                    context within re:Charted. This seamless integration allows
                    you to move from search to visual exploration instantly.
                  </p>
                </div>

                <div className="border-l-4 border-secondary bg-secondary/5 p-6 rounded-r">
                  <h4 className="font-bold font-heading text-primary mb-3 text-lg">
                    Explore Connections
                  </h4>
                  <p className="text-gray-700 mb-2">
                    The Gazetteer shows how places are connected across
                    different maps and time periods, revealing the historical
                    evolution of place names and locations.
                  </p>
                </div>

                <div className="border-l-4 border-secondary bg-secondary/5 p-6 rounded-r">
                  <h4 className="font-bold font-heading text-primary mb-3 text-lg">
                    Geographic Context
                  </h4>
                  <p className="text-gray-700 mb-2">
                    See each place displayed on a modern map to understand its
                    contemporary location and geographic relationships.
                  </p>
                </div>
              </div>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Integration with Other Tools
              </h3>
              <p className="text-gray-700 leading-relaxed">
                The Gazetteer acts as a bridge between GAVOC&apos;s
                comprehensive database and re:Charted&apos;s visual map
                interface. It provides quick access to specific locations while
                maintaining connections to the broader historical context.
              </p>
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
              <p className="text-gray-700 leading-relaxed mb-4 text-lg">
                The Necessary Reunions project provides public APIs for
                accessing place name data and integrating with external research
                projects and datasets.
              </p>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                GAVOC API
              </h3>
              <p className="text-gray-700 mb-4">
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
                <div className="text-gray-400 text-xs">
                  Retrieve a list of places with optional filtering
                </div>
              </div>

              <h4 className="text-xl font-semibold font-heading text-primary mt-6 mb-3">
                Query Parameters
              </h4>
              <div className="my-4 overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300 text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                        Parameter
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                        Type
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2 font-mono text-xs">
                        search
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        string
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        Search term for place names
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2 font-mono text-xs">
                        category
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        string
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        Filter by location category
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2 font-mono text-xs">
                        limit
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        integer
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        Number of results to return (default: 50)
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2 font-mono text-xs">
                        offset
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        integer
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
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
              <p className="text-gray-700 mb-4">
                Access places from the Gazetteer database, which contains all
                locations annotated on the 30 maps in re:Charted.
              </p>

              <div className="bg-gray-900 rounded-lg p-4 my-6 font-mono text-sm overflow-x-auto">
                <div className="mb-3">
                  <span className="text-green-400 font-semibold">GET</span>{' '}
                  <span className="text-blue-300">/api/gazetteer</span>
                </div>
                <div className="text-gray-400 text-xs">
                  Search places in the gazetteer database
                </div>
              </div>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                IIIF Manifests
              </h3>
              <p className="text-gray-700 mb-4">
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
                <div className="text-gray-400 text-xs">
                  Access the main IIIF collection manifest
                </div>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-600 p-6 my-6 rounded-r">
                <p className="text-gray-800 font-semibold mb-2">
                  Rate Limits & Usage
                </p>
                <p className="text-gray-700 text-sm">
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
              <p className="text-gray-700 leading-relaxed mb-4 text-lg">
                The Necessary Reunions codebase is open source and available on
                GitHub. This section provides technical details for developers
                who want to run the project locally, contribute, or adapt it for
                their own research.
              </p>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Technology Stack
              </h3>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
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
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>Node.js 22 or higher</li>
                <li>pnpm package manager</li>
                <li>Git</li>
              </ul>

              <h4 className="text-xl font-semibold font-heading text-primary mt-6 mb-3">
                Installation Steps
              </h4>

              <div className="space-y-4 my-6">
                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <div className="text-gray-400 text-xs mb-2">
                    1. Clone the repository
                  </div>
                  <pre className="text-green-300 text-sm">
                    {`git clone https://github.com/globalise-huygens/necessary-reunions.git
cd necessary-reunions`}
                  </pre>
                </div>

                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <div className="text-gray-400 text-xs mb-2">
                    2. Install dependencies
                  </div>
                  <pre className="text-green-300 text-sm">pnpm install</pre>
                </div>

                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <div className="text-gray-400 text-xs mb-2">
                    3. Set up environment variables
                  </div>
                  <pre className="text-green-300 text-sm">
                    {`cp .env.example .env.local
# Edit .env.local with your configuration`}
                  </pre>
                </div>

                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <div className="text-gray-400 text-xs mb-2">
                    4. Run the development server
                  </div>
                  <pre className="text-green-300 text-sm">pnpm dev</pre>
                </div>
              </div>

              <p className="text-gray-700 mb-4">
                The application will be available at{' '}
                <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                  http://localhost:3001
                </code>
              </p>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Environment Variables
              </h3>
              <div className="my-4 overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300 text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                        Variable
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                        Description
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                        Required
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2 font-mono text-xs">
                        ANNO_REPO_TOKEN_JONA
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        Authentication token for AnnoRepo
                      </td>
                      <td className="border border-gray-300 px-4 py-2">Yes</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2 font-mono text-xs">
                        NEXTAUTH_SECRET
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        Secret for NextAuth.js authentication
                      </td>
                      <td className="border border-gray-300 px-4 py-2">Yes</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2 font-mono text-xs">
                        NEXTAUTH_URL
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        Base URL for authentication callbacks
                      </td>
                      <td className="border border-gray-300 px-4 py-2">Yes</td>
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
              <p className="text-gray-700 mb-4">
                The application is built around the International Image
                Interoperability Framework (IIIF) for handling historical maps
                and manuscripts. All images are served via IIIF Image API, and
                metadata follows the IIIF Presentation API specification.
              </p>

              <h4 className="text-xl font-semibold font-heading text-primary mt-6 mb-3">
                Multi-Layer Annotation System
              </h4>
              <p className="text-gray-700 mb-4">
                Four distinct annotation types with different data sources:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
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
              <p className="text-gray-700 mb-4">
                Critical anti-pattern prevention for external service failures.
                All external API calls use timeout controllers with graceful
                fallbacks to prevent UI crashes.
              </p>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Python Scripts for Data Processing
              </h3>
              <p className="text-gray-700 mb-4">
                The{' '}
                <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                  data/scripts/
                </code>{' '}
                directory contains Python pipelines for:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
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
              <p className="text-gray-700 mb-4">
                To adapt this codebase for your own historical map project:
              </p>
              <ol className="list-decimal pl-6 text-gray-700 space-y-3">
                <li>
                  <strong>Prepare your images:</strong> Convert your historical
                  maps to IIIF-compatible format
                </li>
                <li>
                  <strong>Create manifests:</strong> Use the{' '}
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm">
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
              <p className="text-gray-700 leading-relaxed mb-4 text-lg">
                Contributions to the Necessary Reunions project are welcome.
                Whether you&apos;re fixing bugs, improving documentation, or
                proposing new features, your input helps advance digital
                humanities research.
              </p>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                How to Contribute
              </h3>

              <div className="space-y-4 my-6">
                <div className="border-l-4 border-primary bg-primary/5 p-6 rounded-r">
                  <h4 className="font-bold font-heading text-primary mb-3 text-lg">
                    1. Fork the Repository
                  </h4>
                  <p className="text-gray-700 mb-2">
                    Create a fork of the{' '}
                    <a
                      href="https://github.com/globalise-huygens/necessary-reunions"
                      className="text-primary hover:text-secondary font-semibold"
                    >
                      necessary-reunions repository
                    </a>{' '}
                    on GitHub.
                  </p>
                </div>

                <div className="border-l-4 border-primary bg-primary/5 p-6 rounded-r">
                  <h4 className="font-bold font-heading text-primary mb-3 text-lg">
                    2. Create a Branch
                  </h4>
                  <p className="text-gray-700 mb-2">
                    Create a new branch for your changes. Use descriptive names
                    like{' '}
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                      fix-annotation-display
                    </code>{' '}
                    or{' '}
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                      add-export-feature
                    </code>
                    .
                  </p>
                </div>

                <div className="border-l-4 border-primary bg-primary/5 p-6 rounded-r">
                  <h4 className="font-bold font-heading text-primary mb-3 text-lg">
                    3. Make Your Changes
                  </h4>
                  <p className="text-gray-700 mb-2">
                    Follow the existing code style and patterns. Keep commits
                    concise (maximum 5 words as per project guidelines).
                  </p>
                </div>

                <div className="border-l-4 border-primary bg-primary/5 p-6 rounded-r">
                  <h4 className="font-bold font-heading text-primary mb-3 text-lg">
                    4. Test Thoroughly
                  </h4>
                  <p className="text-gray-700 mb-2">
                    Run the application locally and verify your changes work as
                    expected. Test on different screen sizes for responsive
                    design changes.
                  </p>
                </div>

                <div className="border-l-4 border-primary bg-primary/5 p-6 rounded-r">
                  <h4 className="font-bold font-heading text-primary mb-3 text-lg">
                    5. Submit a Pull Request
                  </h4>
                  <p className="text-gray-700 mb-2">
                    Open a pull request with a clear description of your
                    changes, the problem they solve, and any relevant context.
                  </p>
                </div>
              </div>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Coding Standards
              </h3>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>
                  <strong>TypeScript:</strong> Use TypeScript for all new code
                </li>
                <li>
                  <strong>British English:</strong> Use British spelling in all
                  text and documentation
                </li>
                <li>
                  <strong>No Emojis:</strong> Avoid emojis anywhere in the
                  codebase or documentation
                </li>
                <li>
                  <strong>Scientific Tone:</strong> Write in active voice with
                  clear, direct language
                </li>
                <li>
                  <strong>Accessibility:</strong> Ensure colour contrast meets
                  WCAG standards
                </li>
                <li>
                  <strong>Responsive Design:</strong> Test on both desktop and
                  mobile viewports
                </li>
              </ul>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Reporting Issues
              </h3>
              <p className="text-gray-700 mb-4">
                If you encounter bugs or have feature requests, please{' '}
                <a
                  href="https://github.com/globalise-huygens/necessary-reunions/issues"
                  className="text-primary hover:text-secondary font-semibold"
                >
                  open an issue on GitHub
                </a>
                . Include:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>A clear description of the problem or suggestion</li>
                <li>Steps to reproduce (for bugs)</li>
                <li>Expected vs actual behaviour</li>
                <li>Screenshots if applicable</li>
                <li>Browser and device information</li>
              </ul>

              <h3 className="text-2xl font-semibold font-heading text-primary mt-8 mb-4">
                Contact the Team
              </h3>
              <p className="text-gray-700 mb-4">
                For questions about the project or collaboration opportunities,
                contact:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
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
                <p className="text-gray-700">
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
