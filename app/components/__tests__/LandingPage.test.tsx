import React from 'react';
import { renderToString } from 'react-dom/server';
import { LandingPage } from '../LandingPage';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

// Mock Zustand wrapStore
jest.mock('../../store/wrapStore', () => ({
  useWrapStore: () => ({
    period: 'yearly',
    setPeriod: jest.fn(),
    reset: jest.fn(),
    network: 'mainnet',
  }),
  WrapPeriod: {},
}));

// Mock sub-components to isolate LandingPage testing
jest.mock('../ColorToggle', () => ({
  ColorToggle: () => <div data-testid="color-toggle" />,
}));
jest.mock('../NetworkToggle', () => ({
  NetworkToggle: () => <div data-testid="network-toggle" />,
}));
jest.mock('../CommunityWrapsCarousel', () => ({
  CommunityWrapsCarousel: () => <div data-testid="community-wraps-carousel" />,
}));
jest.mock('../LiveWrapCounter', () => ({
  LiveWrapCounter: () => <div data-testid="live-wrap-counter" />,
}));

describe('LandingPage Component - ParticleField Regression Test', () => {
  it('renders exactly one ParticleField instance (prevents duplicate background layers)', () => {
    const html = renderToString(<LandingPage />);

    // Count occurrences of the stable data-testid marker for particle field
    const matches = html.match(/data-testid="particle-field"/g) || [];
    expect(matches.length).toBe(1);
  });
});
