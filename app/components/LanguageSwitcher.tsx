"use client";

import { useTransition } from 'react';
import { usePathname, useRouter, routing } from '@/i18n/routing'; // Fixed import path alias
import { useLocale } from 'next-intl';

export function LanguageSwitcher() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = useLocale();

  function onSelectChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value;
    
    startTransition(() => {
      // Switches the locale prefix while staying on the exact same sub-route path
      router.replace(pathname, { locale: nextLocale });
    });
  }

  return (
    <div className="relative inline-block text-left">
      <select
        defaultValue={currentLocale}
        disabled={isPending}
        onChange={onSelectChange}
        className="bg-zinc-900 text-white border border-zinc-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all disabled:opacity-50 cursor-pointer"
      >
        {routing.locales.map((loc) => (
          <option key={loc} value={loc} className="bg-zinc-950 text-white">
            {loc.toUpperCase()}
          </option>
        ))}
      </select>
    </div>
  );
}