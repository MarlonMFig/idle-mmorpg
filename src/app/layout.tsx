import type { Metadata } from 'next';
import { Orbitron, Rajdhani } from 'next/font/google';
import './globals.css';

const display = Orbitron({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['600', '700', '800'],
});

const body = Rajdhani({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Ninja Idle RPG',
  description: 'Crie sua lenda no universo shinobi',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${display.variable} ${body.variable} antialiased`}>{children}</body>
    </html>
  );
}
