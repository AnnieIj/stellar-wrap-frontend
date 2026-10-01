import './globals.css';
import type { ReactNode } from 'react';
import { Providers } from './providers';

export const metadata = {
  title: 'Stellar Wrap',
  description: 'Turn your ledger data into social proof.',
};

type Props = {
  children: ReactNode;
};

export default function RootLayout({ children }: Props) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
