import type { ReactNode } from 'react';

interface PersonaLayoutProps {
  children: ReactNode;
}

export default function PersonaLayout({ children }: PersonaLayoutProps) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-start bg-background px-4 py-6 sm:px-6 sm:py-8 md:py-10 lg:px-8">
      <main className="flex w-full max-w-3xl flex-col gap-4 sm:gap-6 md:gap-8">
        {children}
      </main>
    </div>
  );
}
