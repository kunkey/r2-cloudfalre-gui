import './globals.css';
import 'sileo/styles.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Toaster } from 'sileo';

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
      <body className={`min-h-screen bg-[#F8F9FB] dark:bg-[#0f172a] text-gray-900 dark:text-gray-100 antialiased ${inter.className}`}>
        <ThemeProvider>
          {children}
          {/* Sileo toast: theme light in Sileo uses #1a1a1a dark background + fill #161e31 */}
          <Toaster
            position="top-right"
            theme="light"
            options={{
              fill: '#161e31',
              roundness: 16,
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
