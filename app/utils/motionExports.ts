/**
 * Centralised re-export for framer-motion's code-split API.
 *
 * Consumers import `m` (the lightweight component factory) and
 * `AnimatePresence` from here instead of directly from framer-motion.
 * The full animation feature-set is loaded lazily by `MotionProvider`;
 * routes that never import animated components pay zero runtime cost.
 *
 * Usage:
 *   import { m, AnimatePresence } from '@/app/utils/motionExports';
 *   // use <m.div> instead of <motion.div>
 */
export { m, AnimatePresence } from 'framer-motion';
