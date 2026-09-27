'use client';

/**
 * MotionProvider
 *
 * Wraps children in framer-motion's LazyMotion so that the full animation
 * feature-set (domAnimation) is loaded as a dynamic import rather than being
 * bundled into every route's initial JS.
 *
 * Reduced-motion behaviour
 * -------------------------
 * When the user has `prefers-reduced-motion: reduce` set, we skip loading the
 * animation features entirely: the dynamic import never fires, so the ~50 kB
 * domAnimation chunk is never fetched for those users.  Animated components
 * that use `<m.*>` tags will still render — they just won't animate because
 * no features are registered.
 *
 * Placement: mount once in the root layout so all routes are covered without
 * duplicating the provider.
 */

import { LazyMotion } from 'framer-motion';
import { useReducedMotion } from '@/app/hooks/useReducedMotion';

// Lazy-load the full set of DOM animation features.
// This import is intentionally a dynamic function so Next.js splits it into
// a separate chunk that is only fetched when the provider decides to load it.
const loadFeatures = () =>
  import('framer-motion').then((mod) => mod.domAnimation);

// Exported for testing — lets unit tests check the "skip" branch without
// needing a real MediaQuery.
export const MOTION_FEATURES_LOADER = loadFeatures;

interface MotionProviderProps {
  children: React.ReactNode;
}

export function MotionProvider({ children }: MotionProviderProps) {
  const prefersReducedMotion = useReducedMotion();

  // When reduced motion is preferred, wrap with LazyMotion but supply an
  // empty feature loader so the animation chunk is never fetched.
  const features = prefersReducedMotion
    ? () => Promise.resolve({})
    : loadFeatures;

  return (
    <LazyMotion features={features} strict>
      {children}
    </LazyMotion>
  );
}
