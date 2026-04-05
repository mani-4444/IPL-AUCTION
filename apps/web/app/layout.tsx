import type { Metadata } from 'next';
import { Bebas_Neue, Rajdhani, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
  display: 'swap',
});

const rajdhani = Rajdhani({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-rajdhani',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'IPL Auction 2026',
  description: 'Real-time multiplayer IPL player auction. Build your dream team.',
};

export const viewport = {
  themeColor: '#0A0A0F',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${bebasNeue.variable} ${rajdhani.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body
        className="mesh-bg min-h-full font-body antialiased"
        style={{ fontFamily: 'var(--font-rajdhani), sans-serif' }}
      >
        {children}
      </body>
    </html>
  );
}
