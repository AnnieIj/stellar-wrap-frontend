import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';


export const routing = defineRouting({
  locales: ['en', 'es', 'fr'],
  defaultLocale: 'en',
  localeCookie: {
    name: 'NEXT_LOCALE',
    maxAge: 31536000 // 1 year
  }
});

export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);