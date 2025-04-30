import Link from 'next/link';

export function Header() {
  return (
    <header className="bg-primary text-primary-foreground border-b border-border">
      <div className="w-full px-4 flex items-center justify-between py-2">
        {' '}
        <Link href="/" aria-label="Home">
          <h1 className="text-2xl font-heading text-white">
            IIIF Manifest Viewer & Editor
          </h1>
        </Link>
        <nav aria-label="Main">
          <ul className="flex space-x-4">
            <li>
              <Link href="/about" className="font-medium hover:underline">
                About
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
