import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async (context) => {
  // Explicitly ensure the locale is a string to satisfy Next.js type constraints
  const locale = typeof context.locale === 'string' ? context.locale : 'en';

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});