'use client';

import {
  ArrowUp,
  BookOpen,
  ChevronRight,
  Code,
  Database,
  FileText,
  Link as LinkIcon,
  Map,
  Menu,
  Search,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import React, {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { LanguageToggle } from './shared/LanguageToggle';
import { VideoPlayer } from './shared/VideoPlayer';

/* ------------------------------------------------------------------ */
/*  Helper Components                                                   */
/* ------------------------------------------------------------------ */

function CodeBlock({ children, title }: { children: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="my-4 rounded-lg overflow-hidden border border-border">
      {title && (
        <div className="bg-muted px-4 py-2 text-xs font-mono text-muted-foreground border-b border-border">
          {title}
        </div>
      )}
      <div className="relative bg-card">
        <pre className="p-4 overflow-x-auto text-sm">
          <code className="text-foreground">{children}</code>
        </pre>
        <button
          onClick={copy}
          className="absolute top-2 right-2 px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded border border-border text-muted-foreground"
          type="button"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

function SectionHeading({
  id,
  children,
  level = 2,
}: {
  id: string;
  children: ReactNode;
  level?: 2 | 3;
}) {
  const HeadingTag = level === 2 ? 'h2' : 'h3';
  return (
    <HeadingTag
      id={id}
      className={`group scroll-mt-24 ${
        level === 2
          ? 'text-3xl font-bold text-foreground mt-16 mb-6'
          : 'text-xl font-semibold text-foreground mt-10 mb-4'
      }`}
    >
      <a
        href={`#${id}`}
        className="flex items-center gap-2 hover:text-primary transition-colors no-underline"
      >
        {children}
        <LinkIcon
          size={level === 2 ? 20 : 16}
          className="opacity-0 group-hover:opacity-50 transition-opacity"
        />
      </a>
    </HeadingTag>
  );
}

/* ------------------------------------------------------------------ */
/*  Navigation Items                                                    */
/* ------------------------------------------------------------------ */

const NAV_ITEMS = [
  { id: 'overview', icon: BookOpen, labelKey: 'nav.overview' },
  { id: 'getting-started', icon: Map, labelKey: 'nav.gettingStarted' },
  { id: 'recharted', icon: Map, labelKey: 'nav.recharted' },
  { id: 'gavoc', icon: Database, labelKey: 'nav.gavoc' },
  { id: 'gazetteer', icon: Search, labelKey: 'nav.gazetteer' },
  { id: 'api', icon: Code, labelKey: 'nav.api' },
  { id: 'developers', icon: FileText, labelKey: 'nav.developers' },
  { id: 'contributing', icon: LinkIcon, labelKey: 'nav.contributing' },
] as const;

/* ------------------------------------------------------------------ */
/*  Main Component                                                      */
/* ------------------------------------------------------------------ */

export function DocumentationContent({
  locale = 'en',
}: {
  locale?: string;
}) {
  const t = useTranslations('documentation');

  // Rich-text helpers shared across all t.rich() calls
  const rc = {
    b: (c: ReactNode) => <strong>{c}</strong>,
    em: (c: ReactNode) => <em>{c}</em>,
  };

  /* ---------- state ---------- */
  const [activeSection, setActiveSection] = useState('overview');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* ---------- scroll / progress ---------- */
  const handleScroll = useCallback(() => {
    const scrollY = window.scrollY;
    setShowBackToTop(scrollY > 400);

    const docHeight =
      document.documentElement.scrollHeight - window.innerHeight;
    setReadingProgress(docHeight > 0 ? (scrollY / docHeight) * 100 : 0);

    const sections = NAV_ITEMS.map((item) => {
      const el = document.getElementById(item.id);
      return el ? { id: item.id, top: el.offsetTop - 120 } : null;
    }).filter(Boolean) as { id: string; top: number }[];

    for (let i = sections.length - 1; i >= 0; i--) {
      if (scrollY >= sections[i].top) {
        setActiveSection(sections[i].id);
        break;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  /* ---------- keyboard shortcut for search ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  /* ---------- search filtering ---------- */
  const filteredNav = searchQuery
    ? NAV_ITEMS.filter((item) =>
        t(item.labelKey).toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : NAV_ITEMS;

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileNavOpen(false);
    setSearchOpen(false);
    setSearchQuery('');
  };

  /* ---------- common css ---------- */
  const linkCls =
    'text-primary hover:text-secondary font-semibold underline underline-offset-2';
  const pCls = 'text-muted-foreground leading-relaxed mb-4';
  const liRichCls = 'text-muted-foreground';

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <>
      {/* ---- print styles ---- */}
      <style jsx global>{`
        @media print {
          nav,
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          body {
            font-size: 11pt;
          }
          a[href]:after {
            content: ' (' attr(href) ')';
            font-size: 9pt;
            color: #666;
          }
        }
      `}</style>

      {/* ---- reading progress bar ---- */}
      <div
        className="fixed top-0 left-0 h-0.5 bg-primary z-50 transition-all duration-150 print:hidden"
        style={{ width: `${readingProgress}%` }}
      />

      {/* ---- search modal ---- */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] print:hidden">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setSearchOpen(false)}
            onKeyDown={() => {}}
            role="presentation"
          />
          <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center border-b border-border px-4">
              <Search size={18} className="text-muted-foreground" />
              <input
                ref={searchInputRef}
                
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 py-4 px-3 bg-transparent text-foreground outline-none"
              />
              <kbd className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 text-xs text-muted-foreground bg-muted rounded border border-border">
                ESC
              </kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {searchQuery ? (
                filteredNav.length > 0 ? (
                  filteredNav.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={`nav-${item.id}`}
                        onClick={() => scrollTo(item.id)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-muted transition-colors"
                        type="button"
                      >
                        <Icon size={16} className="text-primary" />
                        <span className="text-foreground font-medium">
                          {t(item.labelKey)}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="font-medium">{t('noResults')}</p>
                    <p className="text-sm mt-1">{t('noResultsHint')}</p>
                  </div>
                )
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {t('startTyping')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 py-8 lg:grid lg:grid-cols-[260px_1fr] lg:gap-8">
          {/* ====================== SIDEBAR ====================== */}
          <aside className="hidden lg:block print:hidden">
            <nav className="sticky top-24 space-y-1">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {t('contents')}
              </div>
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={`nav-${item.id}`}
                    onClick={() => scrollTo(item.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      active
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                    type="button"
                  >
                    <Icon size={16} />
                    <span className="truncate">{t(item.labelKey)}</span>
                    {active && (
                      <ChevronRight size={14} className="ml-auto text-primary" />
                    )}
                  </button>
                );
              })}

              <div className="mt-6 pt-4 border-t border-border">
                <button
                  onClick={() => setSearchOpen(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                  type="button"
                >
                  <Search size={16} />
                  <span>{t('searchButton')}</span>
                  <kbd className="ml-auto text-[10px] text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded border border-border">
                    ⌘K
                  </kbd>
                </button>
              </div>
            </nav>
          </aside>

          {/* ---- mobile nav toggle ---- */}
          <div className="lg:hidden mb-6 print:hidden">
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-sm font-medium text-foreground"
              type="button"
            >
              <Menu size={16} />
              {t('jumpTo')}: {t(NAV_ITEMS.find((n) => n.id === activeSection)?.labelKey ?? 'nav.overview')}
            </button>
            {mobileNavOpen && (
              <div className="mt-2 bg-card border border-border rounded-lg shadow-lg p-2">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={`nav-${item.id}`}
                      onClick={() => scrollTo(item.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                        activeSection === item.id
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-muted-foreground'
                      }`}
                      type="button"
                    >
                      <Icon size={16} />
                      {t(item.labelKey)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ====================== CONTENT ====================== */}
          <main ref={contentRef} className="min-w-0">
            {/* ---- header ---- */}
            <div className="mb-12">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-4xl font-bold text-foreground">
                  {t('title')}
                </h1>
                <LanguageToggle locale={locale} />
              </div>
              <p className="text-lg text-muted-foreground max-w-2xl">
                {t('subtitle')}
              </p>
            </div>

            {/* ========================================================= */}
            {/*  SECTION 1 — OVERVIEW                                      */}
            {/* ========================================================= */}
            <section>
              <SectionHeading id="overview">{t('overview.heading')}</SectionHeading>
              <p className={pCls}>{t('overview.intro')}</p>

              <SectionHeading id="three-tools" level={3}>
                {t('overview.threeTools')}
              </SectionHeading>

              <div className="grid md:grid-cols-3 gap-4 my-6">
                {(['recharted', 'gavoc', 'gazetteer'] as const).map((tool) => (
                  <div
                    key={`tool-${tool}`}
                    className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <h4 className="font-semibold text-foreground mb-2">
                      {t(`overview.${tool}Title`)}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {t(`overview.${tool}Desc`)}
                    </p>
                  </div>
                ))}
              </div>

              <SectionHeading id="key-features" level={3}>
                {t('overview.keyFeatures')}
              </SectionHeading>
              <ul className="space-y-2 my-4">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <li key={`step-${n}`} className="flex items-start gap-2 text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                    {t(`overview.feature${n}`)}
                  </li>
                ))}
              </ul>

              <SectionHeading id="why-project" level={3}>
                {t('overview.whyTitle')}
              </SectionHeading>
              <p className={pCls}>{t('overview.whyText')}</p>
            </section>

            {/* ========================================================= */}
            {/*  SECTION 2 — GETTING STARTED                               */}
            {/* ========================================================= */}
            <section>
              <SectionHeading id="getting-started">
                {t('gettingStarted.heading')}
              </SectionHeading>
              <p className={pCls}>
                {t.rich('gettingStarted.intro', {
                  link: (c) => (
                    <a
                      href="https://necessaryreunions.org"
                      className={linkCls}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {c}
                    </a>
                  ),
                })}
              </p>

              <SectionHeading id="quick-start" level={3}>
                {t('gettingStarted.quickStart')}
              </SectionHeading>
              <div className="space-y-6 my-6">
                {[1, 2, 3].map((n) => (
                  <div key={`step-${n}`} className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-sm">
                      {n}
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">
                        {t(`gettingStarted.step${n}Title`)}
                      </h4>
                      <p className="text-muted-foreground text-sm">
                        {t(`gettingStarted.step${n}Text`)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <SectionHeading id="accessing-data" level={3}>
                {t('gettingStarted.accessingData')}
              </SectionHeading>
              <p className={pCls}>
                {t.rich('gettingStarted.accessingDataText', {
                  globaliseLink: (c) => (
                    <a
                      href="https://globalise.huygens.knaw.nl"
                      className={linkCls}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {c}
                    </a>
                  ),
                  githubLink: (c) => (
                    <a
                      href="https://github.com/globalise-huygens/necessary-reunions"
                      className={linkCls}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {c}
                    </a>
                  ),
                })}
              </p>
            </section>

            {/* ========================================================= */}
            {/*  SECTION 3 — re:Charted                                    */}
            {/* ========================================================= */}
            <section>
              <SectionHeading id="recharted">
                {t('recharted.heading')}
              </SectionHeading>
              <p className={pCls}>{t('recharted.intro')}</p>

              {/* --- 1. Info Tab --- */}
              <SectionHeading id="info-tab" level={3}>
                {t('recharted.infoTab.heading')}
              </SectionHeading>
              <p className={pCls}>{t('recharted.infoTab.intro')}</p>
              <h4 className="font-semibold text-foreground mt-6 mb-3">
                {t('recharted.infoTab.coreNav')}
              </h4>
              <ul className="space-y-2 my-4">
                {(['pan', 'zoom', 'rotate', 'fullScreen', 'home'] as const).map(
                  (k) => (
                    <li key={`item-${k}`} className={liRichCls}>
                      {t.rich(`recharted.infoTab.${k}`, rc)}
                    </li>
                  ),
                )}
              </ul>
              <VideoPlayer
                src="/video/info-tab-manifest.mp4"
                title={t('recharted.infoTab.videoTitle')}
                description={t('recharted.infoTab.videoDesc')}
              />

              {/* --- 2. Manifest --- */}
              <SectionHeading id="manifest" level={3}>
                {t('recharted.manifest.heading')}
              </SectionHeading>
              <p className={pCls}>{t('recharted.manifest.intro')}</p>
              <ul className="space-y-2 my-4">
                {(
                  [
                    'title',
                    'dimensions',
                    'source',
                    'date',
                    'attribution',
                    'rights',
                  ] as const
                ).map((k) => (
                  <li key={`item-${k}`} className={liRichCls}>
                    {t.rich(`recharted.manifest.${k}`, rc)}
                  </li>
                ))}
              </ul>
              <p className={pCls}>{t('recharted.manifest.note')}</p>

              {/* --- 3. Map Tab --- */}
              <SectionHeading id="map-tab" level={3}>
                {t('recharted.mapTab.heading')}
              </SectionHeading>
              <p className={pCls}>{t('recharted.mapTab.intro')}</p>
              <VideoPlayer
                src="/video/map-tab-georef.mp4"
                title={t('recharted.mapTab.videoTitle')}
                description={t('recharted.mapTab.videoDesc')}
              />
              <h4 className="font-semibold text-foreground mt-6 mb-3">
                {t('recharted.mapTab.featuresHeading')}
              </h4>
              <ul className="space-y-2 my-4">
                {(
                  [
                    'allmaps',
                    'leaflet',
                    'opacity',
                    'controlPoints',
                    'accuracy',
                  ] as const
                ).map((k) => (
                  <li key={`item-${k}`} className={liRichCls}>
                    {t.rich(`recharted.mapTab.${k}`, rc)}
                  </li>
                ))}
              </ul>

              {/* --- 4. Viewing Mode --- */}
              <SectionHeading id="viewing-mode" level={3}>
                {t('recharted.viewingMode.heading')}
              </SectionHeading>
              <p className={pCls}>{t('recharted.viewingMode.intro')}</p>
              <VideoPlayer
                src="/video/annotation-viewing.mp4"
                title={t('recharted.viewingMode.videoTitle')}
                description={t('recharted.viewingMode.videoDesc')}
              />
              <h4 className="font-semibold text-foreground mt-6 mb-3">
                {t('recharted.viewingMode.filterHeading')}
              </h4>
              <p className="text-muted-foreground text-sm mb-3">
                {t('recharted.viewingMode.filterIntro')}
              </p>
              <ul className="space-y-2 my-4">
                {(['aiVsHuman', 'type', 'source', 'assessment'] as const).map(
                  (k) => (
                    <li key={`item-${k}`} className={liRichCls}>
                      {t.rich(`recharted.viewingMode.${k}`, rc)}
                    </li>
                  ),
                )}
              </ul>
              <h4 className="font-semibold text-foreground mt-6 mb-3">
                {t('recharted.viewingMode.searchHeading')}
              </h4>
              <p className={pCls}>{t('recharted.viewingMode.searchText')}</p>
              <h4 className="font-semibold text-foreground mt-6 mb-3">
                {t('recharted.viewingMode.indicatorsHeading')}
              </h4>
              <p className="text-muted-foreground text-sm mb-3">
                {t('recharted.viewingMode.indicatorsIntro')}
              </p>
              <ul className="space-y-2 my-4">
                {(
                  [
                    'linkIcon',
                    'commentIcon',
                    'classificationIcon',
                    'checkmark',
                  ] as const
                ).map((k) => (
                  <li key={`item-${k}`} className={liRichCls}>
                    {t.rich(`recharted.viewingMode.${k}`, rc)}
                  </li>
                ))}
              </ul>

              {/* --- 5. Editing Mode --- */}
              <SectionHeading id="editing-mode" level={3}>
                {t('recharted.editingMode.heading')}
              </SectionHeading>
              <p className={pCls}>{t('recharted.editingMode.intro')}</p>
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 my-4">
                <p className="text-amber-800 dark:text-amber-200 text-sm">
                  {t('recharted.editingMode.permissionsNote')}
                </p>
              </div>
              <h4 className="font-semibold text-foreground mt-6 mb-3">
                {t('recharted.editingMode.flexibleWorkflow')}
              </h4>
              <p className={pCls}>
                {t('recharted.editingMode.flexibleWorkflowText')}
              </p>

              {/* --- 5a. Deletion --- */}
              <SectionHeading id="deletion" level={3}>
                {t('recharted.deletion.heading')}
              </SectionHeading>
              <p className={pCls}>{t('recharted.deletion.intro')}</p>
              <VideoPlayer
                src="/video/deletion.mp4"
                title={t('recharted.deletion.videoTitle')}
                description={t('recharted.deletion.videoDesc')}
              />
              <ul className="space-y-2 my-4">
                {(['single', 'bulk', 'confirmation', 'undo'] as const).map(
                  (k) => (
                    <li key={`item-${k}`} className={liRichCls}>
                      {t.rich(`recharted.deletion.${k}`, rc)}
                    </li>
                  ),
                )}
              </ul>
              <p className={pCls}>{t('recharted.deletion.note')}</p>

              {/* --- 5b. Correction --- */}
              <SectionHeading id="correction" level={3}>
                {t('recharted.correction.heading')}
              </SectionHeading>
              <p className={pCls}>{t('recharted.correction.intro')}</p>
              <VideoPlayer
                src="/video/correction.mp4"
                title={t('recharted.correction.videoTitle')}
                description={t('recharted.correction.videoDesc')}
              />
              <ul className="space-y-2 my-4">
                {(
                  [
                    'textField',
                    'svgPolygon',
                    'addRemovePoints',
                    'livePreview',
                  ] as const
                ).map((k) => (
                  <li key={`item-${k}`} className={liRichCls}>
                    {t.rich(`recharted.correction.${k}`, rc)}
                  </li>
                ))}
              </ul>
              <h4 className="font-semibold text-foreground mt-6 mb-3">
                {t('recharted.correction.guidelinesHeading')}
              </h4>
              <p className="text-muted-foreground text-sm mb-3">
                {t('recharted.correction.guidelinesIntro')}
              </p>
              <ul className="space-y-2 my-4">
                {(
                  [
                    'fullCoverage',
                    'tallLetters',
                    'closeFit',
                    'avoidInclusions',
                  ] as const
                ).map((k) => (
                  <li key={`item-${k}`} className={liRichCls}>
                    {t.rich(`recharted.correction.${k}`, rc)}
                  </li>
                ))}
              </ul>
              <p className={pCls}>
                {t.rich('recharted.correction.standardsNote', {
                  link: (c) => (
                    <a
                      href="https://machines-reading-maps.github.io/"
                      className={linkCls}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {c}
                    </a>
                  ),
                })}
              </p>

              {/* --- 5c. Add New --- */}
              <SectionHeading id="add-new" level={3}>
                {t('recharted.addNew.heading')}
              </SectionHeading>
              <p className={pCls}>{t('recharted.addNew.intro')}</p>
              <VideoPlayer
                src="/video/add-new.mp4"
                title={t('recharted.addNew.videoTitle')}
                description={t('recharted.addNew.videoDesc')}
              />
              <ul className="space-y-2 my-4">
                {(
                  [
                    'textSpotting',
                    'iconography',
                    'drawingTools',
                    'metadata',
                  ] as const
                ).map((k) => (
                  <li key={`item-${k}`} className={liRichCls}>
                    {t.rich(`recharted.addNew.${k}`, rc)}
                  </li>
                ))}
              </ul>
              <p className={pCls}>{t('recharted.addNew.polygonNote')}</p>
              <p className={pCls}>{t('recharted.addNew.importanceNote')}</p>

              {/* --- 5d. Classification --- */}
              <SectionHeading id="classification" level={3}>
                {t('recharted.classification.heading')}
              </SectionHeading>
              <p className={pCls}>{t('recharted.classification.intro')}</p>
              <VideoPlayer
                src="/video/classification.mp4"
                title={t('recharted.classification.videoTitle')}
                description={t('recharted.classification.videoDesc')}
              />
              <ul className="space-y-2 my-4">
                {(
                  ['thesaurus', 'hierarchical', 'multiple', 'visual'] as const
                ).map((k) => (
                  <li key={`item-${k}`} className={liRichCls}>
                    {t.rich(`recharted.classification.${k}`, rc)}
                  </li>
                ))}
              </ul>

              {/* --- 5e. Commenting --- */}
              <SectionHeading id="commenting" level={3}>
                {t('recharted.commenting.heading')}
              </SectionHeading>
              <p className={pCls}>{t('recharted.commenting.intro')}</p>
              <VideoPlayer
                src="/video/commenting.mp4"
                title={t('recharted.commenting.videoTitle')}
                description={t('recharted.commenting.videoDesc')}
              />
              <ul className="space-y-2 my-4">
                {(
                  [
                    'commentField',
                    'assessment',
                    'history',
                    'qualityControl',
                  ] as const
                ).map((k) => (
                  <li key={`item-${k}`} className={liRichCls}>
                    {t.rich(`recharted.commenting.${k}`, rc)}
                  </li>
                ))}
              </ul>
              <p className={pCls}>{t('recharted.commenting.note')}</p>

              {/* --- 5f. Linking --- */}
              <SectionHeading id="linking" level={3}>
                {t('recharted.linking.heading')}
              </SectionHeading>
              <p className={pCls}>{t('recharted.linking.intro')}</p>
              <VideoPlayer
                src="/video/linking.mp4"
                title={t('recharted.linking.videoTitle')}
                description={t('recharted.linking.videoDesc')}
              />
              <h4 className="font-semibold text-foreground mt-6 mb-3">
                {t('recharted.linking.componentsHeading')}
              </h4>
              <ul className="space-y-2 my-4">
                <li className={liRichCls}>
                  {t.rich('recharted.linking.readingOrder', rc)}
                </li>
                <li className={liRichCls}>
                  {t.rich('recharted.linking.geotag', rc)}
                  <ul className="ml-6 mt-2 space-y-1">
                    {(
                      [
                        'gavoc',
                        'globalise',
                        'neru',
                        'nominatim',
                        'wikidata',
                      ] as const
                    ).map((k) => (
                      <li key={`item-${k}`} className={liRichCls}>
                        {t.rich(`recharted.linking.${k}`, rc)}
                      </li>
                    ))}
                  </ul>
                </li>
                <li className={liRichCls}>
                  {t.rich('recharted.linking.point', rc)}
                  <ul className="ml-6 mt-2 space-y-1">
                    {(['pointVisual', 'pointGeoref', 'pointSpatial'] as const).map(
                      (k) => (
                        <li key={`item-${k}`} className="flex items-start gap-2 text-muted-foreground">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                          {t(`recharted.linking.${k}`)}
                        </li>
                      ),
                    )}
                  </ul>
                </li>
              </ul>

              {/* --- Interface Elements --- */}
              <SectionHeading id="interface" level={3}>
                {t('recharted.interface.heading')}
              </SectionHeading>
              <ul className="space-y-2 my-4">
                {(
                  [
                    'leftPanel',
                    'centreViewport',
                    'rightPanel',
                    'topNav',
                  ] as const
                ).map((k) => (
                  <li key={`item-${k}`} className={liRichCls}>
                    {t.rich(`recharted.interface.${k}`, rc)}
                  </li>
                ))}
              </ul>

              {/* --- Multi-Project --- */}
              <SectionHeading id="multi-project" level={3}>
                {t('recharted.multiProject.heading')}
              </SectionHeading>
              <p className={pCls}>{t('recharted.multiProject.intro')}</p>
              <ul className="space-y-2 my-4">
                {(['neru', 'stm'] as const).map((k) => (
                  <li key={`item-${k}`} className={liRichCls}>
                    {t.rich(`recharted.multiProject.${k}`, rc)}
                  </li>
                ))}
              </ul>
              <p className={pCls}>{t('recharted.multiProject.permissions')}</p>

              {/* --- Sharing --- */}
              <SectionHeading id="sharing" level={3}>
                {t('recharted.sharing.heading')}
              </SectionHeading>
              <p className={pCls}>{t('recharted.sharing.intro')}</p>
              <p className={pCls}>{t('recharted.sharing.contentState')}</p>
            </section>

            {/* ========================================================= */}
            {/*  SECTION 4 — GAVOC                                         */}
            {/* ========================================================= */}
            <section>
              <SectionHeading id="gavoc">{t('gavoc.heading')}</SectionHeading>
              <p className={pCls}>{t('gavoc.intro')}</p>
              <blockquote className="border-l-4 border-primary/30 pl-4 my-6 text-sm text-muted-foreground italic">
                {t.rich('gavoc.citation', { em: (c) => <em>{c}</em> })}
              </blockquote>

              <h4 className="font-semibold text-foreground mt-6 mb-3">
                {t('gavoc.whatIs')}
              </h4>
              <ul className="space-y-2 my-4">
                {(
                  [
                    'historicalPlaces',
                    'entries',
                    'metadata',
                    'reference',
                    'persistentUris',
                  ] as const
                ).map((k) => (
                  <li key={`item-${k}`} className={liRichCls}>
                    {t.rich(`gavoc.${k}`, rc)}
                  </li>
                ))}
              </ul>

              <VideoPlayer
                src="/video/gavoc-tutorial.mp4"
                title={t('gavoc.videoTitle')}
                description={t('gavoc.videoDesc')}
              />

              {/* Database Structure */}
              <SectionHeading id="gavoc-structure" level={3}>
                {t('gavoc.structureHeading')}
              </SectionHeading>
              <div className="overflow-x-auto my-6">
                <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-muted">
                      <th className="px-4 py-2 text-left font-semibold text-foreground border-b border-border">
                        {t('gavoc.fieldLabel')}
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-foreground border-b border-border">
                        {t('gavoc.descriptionLabel')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    {(
                      [
                        ['Original Name', 'originalName'],
                        ['Present Name', 'presentName'],
                        ['Category', 'category'],
                        ['Coordinates', 'coordinates'],
                        ['Map Grid Square', 'mapGridSquare'],
                        ['Map Reference', 'mapReference'],
                        ['Page Reference', 'pageReference'],
                      ] as const
                    ).map(([field, key]) => (
                      <tr key={`row-${key}`} className="border-b border-border last:border-0">
                        <td className="px-4 py-2 font-medium text-foreground">
                          {field}
                        </td>
                        <td className="px-4 py-2">{t(`gavoc.${key}`)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Interface Overview */}
              <SectionHeading id="gavoc-interface" level={3}>
                {t('gavoc.interfaceHeading')}
              </SectionHeading>
              <p className={pCls}>{t('gavoc.interfaceText')}</p>

              {/* Workflows */}
              <SectionHeading id="gavoc-workflows" level={3}>
                {t('gavoc.workflowsHeading')}
              </SectionHeading>
              <h4 className="font-semibold text-foreground mt-6 mb-3">
                {t('gavoc.basicSearch')}
              </h4>

              {/* Step 1 */}
              <div className="space-y-6 my-6">
                <div>
                  <h5 className="font-semibold text-foreground mb-2">
                    {t('gavoc.step1Title')}
                  </h5>
                  <p className="text-muted-foreground text-sm mb-3">
                    {t('gavoc.step1Text')}
                  </p>
                  <p className="text-muted-foreground text-sm font-medium mb-2">
                    {t('gavoc.examplesLabel')}
                  </p>
                  <ul className="space-y-1 text-sm text-muted-foreground ml-4">
                    {[1, 2, 3, 4].map((n) => (
                      <li key={`step-${n}`}>{t(`gavoc.example${n}`)}</li>
                    ))}
                  </ul>
                </div>

                {/* Step 2 */}
                <div>
                  <h5 className="font-semibold text-foreground mb-2">
                    {t('gavoc.step2Title')}
                  </h5>
                  <p className="text-muted-foreground text-sm mb-3">
                    {t('gavoc.step2Text')}
                  </p>
                  <p className="text-muted-foreground text-sm font-medium mb-2">
                    {t('gavoc.categoriesLabel')}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    {(
                      [
                        'catSettlement',
                        'catBay',
                        'catIsland',
                        'catRiver',
                        'catRegion',
                        'catFort',
                        'catTemple',
                        'catCoast',
                      ] as const
                    ).map((k) => (
                      <span
                        key={`item-${k}`}
                        className="bg-muted px-2 py-1 rounded text-muted-foreground text-center"
                      >
                        {t(`gavoc.${k}`)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Step 3 */}
                <div>
                  <h5 className="font-semibold text-foreground mb-2">
                    {t('gavoc.step3Title')}
                  </h5>
                  <p className="text-muted-foreground text-sm">
                    {t('gavoc.step3Text')}
                  </p>
                </div>

                {/* Step 4 */}
                <div>
                  <h5 className="font-semibold text-foreground mb-2">
                    {t('gavoc.step4Title')}
                  </h5>
                  <p className="text-muted-foreground text-sm">
                    {t('gavoc.step4Text')}
                  </p>
                </div>
              </div>

              {/* Thesaurus */}
              <SectionHeading id="gavoc-thesaurus" level={3}>
                {t('gavoc.thesaurusHeading')}
              </SectionHeading>
              <div className="space-y-4 my-4">
                <div>
                  <h5 className="font-semibold text-foreground mb-1">
                    {t('gavoc.nameVariationsTitle')}
                  </h5>
                  <p className="text-muted-foreground text-sm">
                    {t('gavoc.nameVariationsText')}
                  </p>
                  <p className="text-muted-foreground text-sm mt-2 italic">
                    {t('gavoc.nameVariationsExample')}
                  </p>
                </div>
                <div>
                  <h5 className="font-semibold text-foreground mb-1">
                    {t('gavoc.semanticTitle')}
                  </h5>
                  <p className="text-muted-foreground text-sm">
                    {t('gavoc.semanticText')}
                  </p>
                </div>
              </div>

              {/* URIs */}
              <SectionHeading id="gavoc-uris" level={3}>
                {t('gavoc.urisHeading')}
              </SectionHeading>
              <div className="space-y-4 my-4">
                {(['accessing', 'linking', 'api'] as const).map((k) => (
                  <div key={`item-${k}`}>
                    <h5 className="font-semibold text-foreground mb-1">
                      {t(`gavoc.${k}Title`)}
                    </h5>
                    <p className="text-muted-foreground text-sm">
                      {t(`gavoc.${k}Text`)}
                    </p>
                  </div>
                ))}
                <CodeBlock title="GET /api/gavoc">{`GET /api/gavoc?search=cochin&category=settlement&limit=10`}</CodeBlock>
                <p className="text-sm text-muted-foreground italic">
                  {t('gavoc.apiReturns')}
                </p>
              </div>

              {/* Map View */}
              <SectionHeading id="gavoc-map-views" level={3}>
                {t('gavoc.mapViewHeading')}
              </SectionHeading>
              <div className="grid md:grid-cols-2 gap-4 my-6">
                {(['osm', 'satellite', 'terrain', 'clustering'] as const).map(
                  (k) => (
                    <div
                      key={`item-${k}`}
                      className="bg-card border border-border rounded-lg p-4"
                    >
                      <h5 className="font-semibold text-foreground mb-1">
                        {t(`gavoc.${k}Title`)}
                      </h5>
                      <p className="text-sm text-muted-foreground">
                        {t(`gavoc.${k}Text`)}
                      </p>
                    </div>
                  ),
                )}
              </div>

              {/* Integration */}
              <SectionHeading id="gavoc-integration" level={3}>
                {t('gavoc.integrationHeading')}
              </SectionHeading>
              <p className={pCls}>{t('gavoc.integrationIntro')}</p>
              <ul className="space-y-2 my-4">
                {(
                  [
                    'rechartedLinking',
                    'gazetteerSearch',
                    'externalResearch',
                  ] as const
                ).map((k) => (
                  <li key={`item-${k}`} className={liRichCls}>
                    {t.rich(`gavoc.${k}`, rc)}
                  </li>
                ))}
              </ul>
            </section>

            {/* ========================================================= */}
            {/*  SECTION 5 — GAZETTEER                                     */}
            {/* ========================================================= */}
            <section>
              <SectionHeading id="gazetteer">
                {t('gazetteer.heading')}
              </SectionHeading>
              <p className={pCls}>{t('gazetteer.intro')}</p>

              <SectionHeading id="core-concept" level={3}>
                {t('gazetteer.coreConceptHeading')}
              </SectionHeading>
              <p className={pCls}>{t('gazetteer.coreConceptText')}</p>

              <SectionHeading id="gazetteer-unique" level={3}>
                {t('gazetteer.uniqueHeading')}
              </SectionHeading>
              <ul className="space-y-2 my-4">
                {(
                  [
                    'mapCentric',
                    'annotationBased',
                    'contextual',
                    'biographical',
                  ] as const
                ).map((k) => (
                  <li key={`item-${k}`} className={liRichCls}>
                    {t.rich(`gazetteer.${k}`, rc)}
                  </li>
                ))}
              </ul>

              <VideoPlayer
                src="/video/gazetteer-search.mp4"
                title={t('gazetteer.videoTitle')}
                description={t('gazetteer.videoDesc')}
              />

              {/* Browsing and Search */}
              <SectionHeading id="gazetteer-browsing" level={3}>
                {t('gazetteer.browsingHeading')}
              </SectionHeading>

              <h4 className="font-semibold text-foreground mt-6 mb-3">
                {t('gazetteer.listViewHeading')}
              </h4>
              <p className="text-muted-foreground text-sm mb-3">
                {t('gazetteer.listViewIntro')}
              </p>
              <ul className="space-y-2 my-4">
                {(
                  ['placeName', 'variants', 'mapCount', 'classificationList'] as const
                ).map((k) => (
                  <li key={`item-${k}`} className={liRichCls}>
                    {t.rich(`gazetteer.${k}`, rc)}
                  </li>
                ))}
              </ul>

              <h4 className="font-semibold text-foreground mt-6 mb-3">
                {t('gazetteer.mapViewHeading')}
              </h4>
              <p className="text-muted-foreground text-sm mb-3">
                {t('gazetteer.mapViewIntro')}
              </p>
              <ul className="space-y-2 my-4">
                {(
                  ['spatial', 'clusters', 'relationships', 'clickMarkers'] as const
                ).map((k) => (
                  <li key={`item-${k}`} className="flex items-start gap-2 text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                    {t(`gazetteer.${k}`)}
                  </li>
                ))}
              </ul>

              {/* Search */}
              <SectionHeading id="gazetteer-search" level={3}>
                {t('gazetteer.searchHeading')}
              </SectionHeading>
              <p className={pCls}>{t('gazetteer.searchIntro')}</p>
              <div className="space-y-4 my-4">
                {(['modernName', 'historicalName', 'partial'] as const).map(
                  (k) => (
                    <div key={`item-${k}`}>
                      <h5 className="font-semibold text-foreground mb-1">
                        {t(`gazetteer.${k}Title`)}
                      </h5>
                      <p className="text-muted-foreground text-sm">
                        {t(`gazetteer.${k}Text`)}
                      </p>
                    </div>
                  ),
                )}
              </div>

              {/* Detailed Place Pages */}
              <SectionHeading id="detailed-pages" level={3}>
                {t('gazetteer.detailedHeading')}
              </SectionHeading>
              <p className={pCls}>{t('gazetteer.detailedIntro')}</p>

              <VideoPlayer
                src="/video/gazetteer-details.mp4"
                title={t('gazetteer.detailedVideoTitle')}
                description={t('gazetteer.detailedVideoDesc')}
              />

              <h4 className="font-semibold text-foreground mt-6 mb-3">
                {t('gazetteer.overviewHeading')}
              </h4>
              <p className="text-muted-foreground text-sm mb-3">
                {t('gazetteer.overviewIntro')}
              </p>
              <ul className="space-y-2 my-4">
                {(
                  [
                    'primaryName',
                    'geoCoordinates',
                    'modernMap',
                    'quickStats',
                  ] as const
                ).map((k) => (
                  <li key={`item-${k}`} className={liRichCls}>
                    {t.rich(`gazetteer.${k}`, rc)}
                  </li>
                ))}
              </ul>

              <h4 className="font-semibold text-foreground mt-6 mb-3">
                {t('gazetteer.nameVariantsHeading')}
              </h4>
              <p className="text-muted-foreground text-sm mb-3">
                {t('gazetteer.nameVariantsIntro')}
              </p>
              <ul className="space-y-2 my-4">
                {(
                  [
                    'spellings',
                    'languages',
                    'classifications',
                    'sourceAttrib',
                  ] as const
                ).map((k) => (
                  <li key={`item-${k}`} className={liRichCls}>
                    {t.rich(`gazetteer.${k}`, rc)}
                  </li>
                ))}
              </ul>

              <h4 className="font-semibold text-foreground mt-6 mb-3">
                {t('gazetteer.linksHeading')}
              </h4>
              <p className="text-muted-foreground text-sm mb-3">
                {t('gazetteer.linksIntro')}
              </p>
              <ul className="space-y-2 my-4">
                {(
                  [
                    'thumbnails',
                    'mapMetadata',
                    'directLinks',
                    'annotationDetails',
                  ] as const
                ).map((k) => (
                  <li key={`item-${k}`} className={liRichCls}>
                    {t.rich(`gazetteer.${k}`, rc)}
                  </li>
                ))}
              </ul>

              <h4 className="font-semibold text-foreground mt-6 mb-3">
                {t('gazetteer.frequencyHeading')}
              </h4>
              <p className="text-muted-foreground text-sm mb-3">
                {t('gazetteer.frequencyIntro')}
              </p>
              <ul className="space-y-2 my-4">
                {(
                  [
                    'temporal',
                    'coverage',
                    'annotationTypes',
                    'prominence',
                  ] as const
                ).map((k) => (
                  <li key={`item-${k}`} className={liRichCls}>
                    {t.rich(`gazetteer.${k}`, rc)}
                  </li>
                ))}
              </ul>

              {/* Building Place Biographies */}
              <SectionHeading id="biographies" level={3}>
                {t('gazetteer.biographiesHeading')}
              </SectionHeading>
              <p className={pCls}>{t('gazetteer.biographiesIntro')}</p>
              <ul className="space-y-2 my-4">
                {(
                  [
                    'nameEvolution',
                    'functionalChanges',
                    'cartoAttention',
                    'geoContext',
                  ] as const
                ).map((k) => (
                  <li key={`item-${k}`} className={liRichCls}>
                    {t.rich(`gazetteer.${k}`, rc)}
                  </li>
                ))}
              </ul>

              {/* Integration */}
              <SectionHeading id="gazetteer-integration" level={3}>
                {t('gazetteer.integrationHeading')}
              </SectionHeading>
              <p className={pCls}>{t('gazetteer.integrationIntro')}</p>
              <ul className="space-y-2 my-4">
                {(
                  [
                    'gavocConnection',
                    'rechartedIntegration',
                    'crossReference',
                  ] as const
                ).map((k) => (
                  <li key={`item-${k}`} className={liRichCls}>
                    {t.rich(`gazetteer.${k}`, rc)}
                  </li>
                ))}
              </ul>

              {/* Workflow */}
              <SectionHeading id="gazetteer-workflow" level={3}>
                {t('gazetteer.workflowHeading')}
              </SectionHeading>
              <ol className="space-y-2 my-4 list-decimal list-inside text-muted-foreground">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <li key={`step-${n}`}>{t(`gazetteer.workflowStep${n}`)}</li>
                ))}
              </ol>
            </section>

            {/* ========================================================= */}
            {/*  SECTION 6 — API                                           */}
            {/* ========================================================= */}
            <section>
              <SectionHeading id="api">{t('api.heading')}</SectionHeading>
              <p className={pCls}>{t('api.intro')}</p>

              <SectionHeading id="gavoc-api" level={3}>
                {t('api.gavocHeading')}
              </SectionHeading>
              <p className={pCls}>{t('api.gavocIntro')}</p>

              <CodeBlock title="GET /api/gavoc">
                {t('api.gavocEndpoint')}
              </CodeBlock>

              <h4 className="font-semibold text-foreground mt-6 mb-3">
                {t('api.queryParams')}
              </h4>
              <div className="overflow-x-auto my-4">
                <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-muted">
                      <th className="px-4 py-2 text-left font-semibold text-foreground border-b border-border">
                        {t('api.parameterLabel')}
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-foreground border-b border-border">
                        {t('api.typeLabel')}
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-foreground border-b border-border">
                        {t('gavoc.descriptionLabel')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    {(
                      [
                        ['search', 'string', 'paramSearch'],
                        ['category', 'string', 'paramCategory'],
                        ['limit', 'number', 'paramLimit'],
                        ['offset', 'number', 'paramOffset'],
                      ] as const
                    ).map(([param, type, key]) => (
                      <tr key={`param-${param}`} className="border-b border-border last:border-0">
                        <td className="px-4 py-2 font-mono text-sm">
                          {param}
                        </td>
                        <td className="px-4 py-2">{type}</td>
                        <td className="px-4 py-2">{t(`api.${key}`)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h4 className="font-semibold text-foreground mt-6 mb-3">
                {t('api.exampleRequest')}
              </h4>
              <CodeBlock title="curl">{`curl "https://necessaryreunions.org/api/gavoc?search=cochin&limit=5"`}</CodeBlock>

              <h4 className="font-semibold text-foreground mt-6 mb-3">
                {t('api.exampleResponse')}
              </h4>
              <CodeBlock title="JSON">{`{
  "results": [
    {
      "id": "gavoc-1234",
      "originalName": "Cochin",
      "presentName": "Kochi",
      "category": "settlement",
      "latitude": 9.9312,
      "longitude": 76.2673
    }
  ],
  "total": 1,
  "limit": 5,
  "offset": 0
}`}</CodeBlock>

              <SectionHeading id="gazetteer-api" level={3}>
                {t('api.gazetteerHeading')}
              </SectionHeading>
              <p className={pCls}>{t('api.gazetteerIntro')}</p>
              <CodeBlock title="GET /api/gazetteer">
                {t('api.gazetteerEndpoint')}
              </CodeBlock>

              <SectionHeading id="iiif-manifests" level={3}>
                {t('api.iiifHeading')}
              </SectionHeading>
              <p className={pCls}>{t('api.iiifIntro')}</p>
              <CodeBlock title="Main Manifest">{`https://globalise-huygens.github.io/necessary-reunions/manifest.json`}</CodeBlock>
              <p className={pCls}>{t('api.iiifEndpoint')}</p>

              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 my-6">
                <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">
                  {t('api.rateLimitTitle')}
                </h4>
                <p className="text-blue-700 dark:text-blue-300 text-sm">
                  {t('api.rateLimitText')}
                </p>
              </div>
            </section>

            {/* ========================================================= */}
            {/*  SECTION 7 — DEVELOPERS                                    */}
            {/* ========================================================= */}
            <section>
              <SectionHeading id="developers">
                {t('developers.heading')}
              </SectionHeading>
              <p className={pCls}>{t('developers.intro')}</p>

              <SectionHeading id="tech-stack" level={3}>
                {t('developers.techStackHeading')}
              </SectionHeading>
              <div className="grid md:grid-cols-2 gap-3 my-6">
                {(
                  [
                    'framework',
                    'language',
                    'styling',
                    'mapViewer',
                    'modernMaps',
                    'annotations',
                    'packageManager',
                    'deployment',
                  ] as const
                ).map((k) => (
                  <div
                    key={`item-${k}`}
                    className="bg-card border border-border rounded-lg px-4 py-2 text-sm text-muted-foreground"
                  >
                    {t.rich(`developers.${k}`, rc)}
                  </div>
                ))}
              </div>

              <SectionHeading id="local-setup" level={3}>
                {t('developers.localSetupHeading')}
              </SectionHeading>
              <h4 className="font-semibold text-foreground mt-6 mb-3">
                {t('developers.prerequisites')}
              </h4>
              <ul className="space-y-1 my-4 text-muted-foreground text-sm">
                {(['nodeReq', 'pnpmReq', 'gitReq'] as const).map((k) => (
                  <li key={`item-${k}`} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                    {t(`developers.${k}`)}
                  </li>
                ))}
              </ul>

              <h4 className="font-semibold text-foreground mt-6 mb-3">
                {t('developers.installSteps')}
              </h4>
              <p className="text-sm text-muted-foreground mb-2">
                {t('developers.cloneStep')}
              </p>
              <CodeBlock>{`git clone https://github.com/globalise-huygens/necessary-reunions.git\ncd necessary-reunions`}</CodeBlock>
              <p className="text-sm text-muted-foreground mb-2">
                {t('developers.installStep')}
              </p>
              <CodeBlock>{`pnpm install`}</CodeBlock>
              <p className="text-sm text-muted-foreground mb-2">
                {t('developers.envStep')}
              </p>
              <CodeBlock>{`cp .env.example .env.local\n${t('developers.envComment')}`}</CodeBlock>
              <p className="text-sm text-muted-foreground mb-2">
                {t('developers.runStep')}
              </p>
              <CodeBlock>{`pnpm dev`}</CodeBlock>
              <p className="text-sm text-muted-foreground mt-2">
                {t('developers.availableAt')}{' '}
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                  http://localhost:3000
                </code>
              </p>

              {/* Environment Variables */}
              <SectionHeading id="env-vars" level={3}>
                {t('developers.envVarsHeading')}
              </SectionHeading>
              <div className="overflow-x-auto my-6">
                <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-muted">
                      <th className="px-4 py-2 text-left font-semibold text-foreground border-b border-border">
                        {t('developers.variableLabel')}
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-foreground border-b border-border">
                        {t('gavoc.descriptionLabel')}
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-foreground border-b border-border">
                        {t('developers.requiredLabel')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    {(
                      [
                        ['ANNO_REPO_TOKEN_JONA', 'annoRepoDesc'],
                        ['NEXTAUTH_SECRET', 'nextAuthSecretDesc'],
                        ['NEXTAUTH_URL', 'nextAuthUrlDesc'],
                      ] as const
                    ).map(([variable, key]) => (
                      <tr key={`var-${variable}`} className="border-b border-border last:border-0">
                        <td className="px-4 py-2 font-mono text-xs">
                          {variable}
                        </td>
                        <td className="px-4 py-2">
                          {t(`developers.${key}`)}
                        </td>
                        <td className="px-4 py-2">{t('developers.yes')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Project Structure */}
              <SectionHeading id="project-structure" level={3}>
                {t('developers.projectStructureHeading')}
              </SectionHeading>
              <CodeBlock title="Project Structure">{`necessary-reunions/
├── app/              # Next.js App Router pages
│   ├── api/          # API routes
│   ├── viewer/       # re:Charted viewer
│   ├── gavoc/        # GAVOC interface
│   └── gazetteer/    # Gazetteer interface
├── components/       # React components
│   ├── viewer/       # Viewer components
│   ├── gavoc/        # GAVOC components
│   ├── gazetteer/    # Gazetteer components
│   └── shared/       # Shared components
├── hooks/            # Custom React hooks
├── lib/              # Utilities and helpers
├── data/             # Manifest and annotation data
│   └── scripts/      # Python processing scripts
├── messages/         # i18n translation files
└── public/           # Static assets`}</CodeBlock>

              {/* Architecture */}
              <SectionHeading id="architecture" level={3}>
                {t('developers.architectureHeading')}
              </SectionHeading>

              <h4 className="font-semibold text-foreground mt-6 mb-3">
                {t('developers.iiifFirstHeading')}
              </h4>
              <p className={pCls}>{t('developers.iiifFirstText')}</p>

              <h4 className="font-semibold text-foreground mt-6 mb-3">
                {t('developers.multiLayerHeading')}
              </h4>
              <p className="text-muted-foreground text-sm mb-3">
                {t('developers.multiLayerIntro')}
              </p>
              <ul className="space-y-2 my-4">
                {(
                  [
                    'localAnno',
                    'externalAnno',
                    'linkingAnno',
                    'georeferencingAnno',
                  ] as const
                ).map((k) => (
                  <li key={`item-${k}`} className={liRichCls}>
                    {t.rich(`developers.${k}`, rc)}
                  </li>
                ))}
              </ul>

              <h4 className="font-semibold text-foreground mt-6 mb-3">
                {t('developers.resilienceHeading')}
              </h4>
              <p className={pCls}>{t('developers.resilienceText')}</p>
              <CodeBlock title="Timeout Pattern">{`const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);
try {
  const response = await fetch(url, { signal: controller.signal });
  // Handle success...
} catch (error) {
  return { items: [], hasMore: false, message: 'Service unavailable' };
} finally {
  clearTimeout(timeoutId);
}`}</CodeBlock>

              {/* Python */}
              <h4 className="font-semibold text-foreground mt-6 mb-3">
                {t('developers.pythonHeading')}
              </h4>
              <p className="text-muted-foreground text-sm mb-3">
                {t('developers.pythonIntro')}
              </p>
              <ul className="space-y-2 my-4">
                {(
                  [
                    'makeManifest',
                    'downloadImages',
                    'textSpotting',
                    'segmentation',
                  ] as const
                ).map((k) => (
                  <li key={`item-${k}`} className={liRichCls}>
                    {t.rich(`developers.${k}`, rc)}
                  </li>
                ))}
              </ul>

              {/* Adapting */}
              <SectionHeading id="adapting" level={3}>
                {t('developers.adaptingHeading')}
              </SectionHeading>
              <p className={pCls}>{t('developers.adaptingIntro')}</p>
              <ol className="space-y-3 my-4">
                {[1, 2, 3, 4, 5].map((n) => (
                  <li key={`step-${n}`} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-bold">
                      {n}
                    </span>
                    <span className={liRichCls}>
                      {t.rich(`developers.adaptStep${n}`, rc)}
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            {/* ========================================================= */}
            {/*  SECTION 8 — CONTRIBUTING                                   */}
            {/* ========================================================= */}
            <section>
              <SectionHeading id="contributing">
                {t('contributing.heading')}
              </SectionHeading>
              <p className={pCls}>{t('contributing.intro')}</p>

              <SectionHeading id="issues" level={3}>
                {t('contributing.issuesHeading')}
              </SectionHeading>
              <p className={pCls}>
                {t.rich('contributing.issuesIntro', {
                  link: (c) => (
                    <a
                      href="https://github.com/globalise-huygens/necessary-reunions/issues"
                      className={linkCls}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {c}
                    </a>
                  ),
                })}
              </p>
              <ul className="space-y-1 my-4 text-muted-foreground text-sm">
                {(
                  [
                    'issueDesc',
                    'issueReproduce',
                    'issueExpected',
                    'issueScreenshots',
                    'issueBrowser',
                  ] as const
                ).map((k) => (
                  <li key={`item-${k}`} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                    {t(`contributing.${k}`)}
                  </li>
                ))}
              </ul>

              <SectionHeading id="pull-requests" level={3}>
                {t('contributing.prHeading')}
              </SectionHeading>
              <p className={pCls}>{t('contributing.prText')}</p>

              <SectionHeading id="contact" level={3}>
                {t('contributing.contactHeading')}
              </SectionHeading>
              <p className={pCls}>{t('contributing.contactIntro')}</p>
              <ul className="space-y-2 my-4">
                {(['manjusha', 'leon', 'jona'] as const).map((k) => (
                  <li key={`item-${k}`} className={liRichCls}>
                    {t.rich(`contributing.${k}`, rc)}
                  </li>
                ))}
              </ul>

              <SectionHeading id="acknowledgements" level={3}>
                {t('contributing.acknowledgements')}
              </SectionHeading>
              <p className={pCls}>
                {t.rich('contributing.acknowledgementsText', {
                  link: (c) => (
                    <a
                      href="https://globalise.huygens.knaw.nl"
                      className={linkCls}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {c}
                    </a>
                  ),
                })}
              </p>
            </section>

            {/* ---- footer spacer ---- */}
            <div className="h-32" />
          </main>
        </div>
      </div>

      {/* ---- back to top ---- */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 bg-primary text-primary-foreground p-3 rounded-full shadow-lg hover:bg-primary/90 transition-all z-40 print:hidden"
          aria-label="Back to top"
          type="button"
        >
          <ArrowUp size={20} />
        </button>
      )}
    </>
  );
}
