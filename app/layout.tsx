import { Lexend, Roboto } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/Toaster';

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
      <body className={`${lexend.variable} ${roboto.variable} antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
