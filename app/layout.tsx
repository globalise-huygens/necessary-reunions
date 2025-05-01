import { Lexend, Roboto } from 'next/font/google';
import './globals.css';
import 'leaflet/dist/leaflet.css';

import { Toaster } from '@/components/Toaster';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

const lexend = Lexend({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-lexend',
});
const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-roboto',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${lexend.variable} ${roboto.variable}font-body bg-white text-foreground antialiased grid grid-rows-[auto_1fr_auto] h-full overflow-hidden`}
      >
        <Header />
        <main className="flex-1 overflow-hidden">{children}</main>
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
