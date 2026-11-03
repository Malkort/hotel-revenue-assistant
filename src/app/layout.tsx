import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hotel Revenue Assistant - Система управления доходами отеля',
  description: 'Автоматизация аналитики, прогнозирования и тарифов отеля',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="antialiased bg-slate-50 dark:bg-slate-950 min-h-screen">
        {children}
      </body>
    </html>
  );
}
