import type { ReactNode } from 'react';
import '../styles/globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Shiftwise Scheduler',
  description: 'Web ready restaurant scheduling, time-off, and communication center.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={inter.className}>
        <div className="min-h-screen bg-slate-950 text-slate-100">
          {children}
        </div>
      </body>
    </html>
  );
}
