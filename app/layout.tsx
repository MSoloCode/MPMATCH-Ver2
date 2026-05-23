import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';
import Navigation from '@/components/Navigation';
import './globals.css';

export const metadata: Metadata = {
  title: 'MPMATCH - Matching Platform',
  description: 'Full-stack matching platform built with Next.js 14',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Skip to main content link for accessibility */}
        <a
          href="#main-content"
          className="fixed top-0 left-0 bg-accent text-white px-4 py-2 -translate-y-full focus:translate-y-0 transition-transform z-50 focus-ring"
        >
          Skip to main content
        </a>
        <Navigation />
        <main id="main-content">{children}</main>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
