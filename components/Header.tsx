import OrcidAuth from '@/components/OrcidAuth';
import Image from 'next/image';
import Link from 'next/link';

export function Header() {
  return (
    <header className="bg-primary text-primary-foreground border-b border-border">
      <div className="w-full px-2 sm:px-4 flex flex-row items-center justify-between py-2 gap-2 sm:gap-0">
        <div className="flex items-center space-x-2 w-auto justify-center sm:justify-start">
          <Link href="/" aria-label="Home">
            <Image
              src="/image/recharted-logo.png"
              alt="re:Charted Logo"
              className="h-8 w-8"
              width={32}
              height={32}
            />
          </Link>
          <h1 className="text-xl hidden sm:block font-heading text-white">
            re:Charted
          </h1>
        </div>
        <nav aria-label="Main" className="w-auto flex justify-end">
          <ul className="flex space-x-4 items-center">
            <li>
              <OrcidAuth />
            </li>
            <li className="hidden sm:block">
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
