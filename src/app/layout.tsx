import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/ThemeProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'R2 CLOUDFLARE',
  description: 'A minimalist, Apple-inspired web UI to manage a Cloudflare R2 bucket.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var s=localStorage.getItem('r2-gallery-theme');var d=s==='dark'||(!s&&true);document.documentElement.classList.toggle('dark',d);})();`,
          }}
        />
      </head>
      <body className={`min-h-screen bg-[#F8F9FB] dark:bg-gray-900 text-gray-900 dark:text-gray-100 antialiased ${inter.className}`}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
