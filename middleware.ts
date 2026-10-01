import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all paths except internal api, static assets (_next), and favicons
  matcher: ['/', '/(en|es|fr)/:path*', '/((?!_next|_vercel|.*\\..*).*)'],
};

