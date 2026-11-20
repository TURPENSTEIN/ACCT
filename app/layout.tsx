import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'ACCT — Affective Cognitive Control Training',
  description:
    'Affective Cognitive Control Training (PASAT + N-Back) with unobstructed YouTube phobia exposure backgrounds and affective background audio.',
  openGraph: {
    title: 'ACCT — Affective Cognitive Control Training',
    description:
      'Affective Cognitive Control Training (PASAT + N-Back) with unobstructed YouTube phobia exposure backgrounds and affective background audio.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ACCT — Affective Cognitive Control Training',
    description:
      'Affective Cognitive Control Training (PASAT + N-Back) with unobstructed YouTube phobia exposure backgrounds and affective background audio.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${jetbrainsMono.variable} dark`}
    >
      <body
        suppressHydrationWarning
        className="min-h-screen bg-[#0B1018] text-[#F1F5F9] font-sans antialiased selection:bg-[#38BDF8]/25 selection:text-white"
      >
        {children}
      </body>
    </html>
  );
}
