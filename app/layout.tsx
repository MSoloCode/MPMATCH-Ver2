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
        <Navigation />
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
