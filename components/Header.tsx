import Image from 'next/image';
import Link from 'next/link';
import OrcidAuth from './OrcidAuth';

export function Header() {
  return (
    <header className="bg-primary text-primary-foreground border-b border-border">
      <div className="w-full px-4 flex items-center justify-between py-2">
        <div className="flex items-center space-x-2">
          <Link href="/" aria-label="Home">
            <Image
              src="/image/recharted-logo.png"
              alt="re:Charted Logo"
              className="h-8 w-8"
              width={32}
              height={32}
            />
          </Link>
          <h1 className="text-2xl font-heading text-white">re:Charted</h1>
        </div>
        <nav aria-label="Main">
          <ul className="flex space-x-4 items-center">
            <li>
              <OrcidAuth />
            </li>
            <li>
              <Link href="/about" className="font-medium text-white">
                About
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
