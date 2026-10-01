"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, RotateCcw, Clock } from 'lucide-react';
import { useRateLimit } from '@/src/hooks/useRateLimit';

export function RateLimitBanner() {
    const { isRateLimited, secondsRemaining, retryAttempt, message } = useRateLimit();

    const showBanner = isRateLimited || retryAttempt > 0;

    return (
        <AnimatePresence>
            {showBanner && (
                <motion.div
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -100, opacity: 0 }}
                    className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4"
                >
                    <div className="relative group overflow-hidden rounded-2xl p-[1px]"
                        style={{
                            background: isRateLimited
                                ? 'linear-gradient(to right, #ef4444, #f59e0b)'
                                : 'linear-gradient(to right, var(--color-theme-primary), #3b82f6)'
                        }}
                    >
                        <div className="relative flex items-center gap-4 px-6 py-4 rounded-2xl bg-black/90 backdrop-blur-xl">
                            {/* Icon */}
                            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isRateLimited ? 'bg-red-500/20 text-red-500' : 'bg-primary/20 text-theme-primary'
                                }`}>
                                {isRateLimited ? <AlertTriangle className="w-6 h-6" data-testid="rate-limit-alert-icon" /> : <RotateCcw className="w-5 h-5 animate-spin" data-testid="rate-limit-retry-icon" />}
                            </div>

                            {/* Text */}
                            <div className="flex-1">
                                <p className="text-sm font-black text-white uppercase tracking-wider mb-0.5">
                                    {isRateLimited ? 'Rate Limit Reached' : 'API Congestion'}
                                </p>
                                <p className="text-xs font-bold text-white/60">
                                    {isRateLimited
                                        ? `Horizon is taking a breather. Resuming in ${secondsRemaining}s...`
                                        : message || `Retrying connection (Attempt ${retryAttempt}/5)`}
                                </p>
                            </div>

                            {/* Countdown/Status */}
                            {isRateLimited && secondsRemaining !== null && (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                                    <Clock className="w-3 h-3 text-white/40" data-testid="rate-limit-clock-icon" />
                                    <span className="text-xs font-mono font-bold text-white">
                                        {secondsRemaining}s
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Animated progress bar if retrying */}
                        {!isRateLimited && (
                            <motion.div
                                className="absolute bottom-0 left-0 h-[2px] bg-theme-primary"
                                initial={{ width: '0%' }}
                                animate={{ width: '100%' }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            />
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
