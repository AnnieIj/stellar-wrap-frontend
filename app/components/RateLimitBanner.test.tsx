/**
 * Unit tests for RateLimitBanner component
 * Tests rendering and behavior for rate-limited API responses
 */

import { render, screen, act } from '@testing-library/react';
import { RateLimitBanner } from './RateLimitBanner';
import { useRateLimitStore } from '@/src/store/rateLimitStore';

// Mock the store
jest.mock('@/src/store/rateLimitStore', () => ({
  useRateLimitStore: jest.fn(),
}));

const mockUseRateLimitStore = useRateLimitStore as jest.Mock;

describe('RateLimitBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const mockStore = (overrides: Partial<{
    isRateLimited: boolean;
    resetTime: number | null;
    retryAttempt: number;
    message: string | null;
  }> = {}) => {
    mockUseRateLimitStore.mockReturnValue({
      isRateLimited: false,
      resetTime: null,
      retryAttempt: 0,
      message: null,
      ...overrides,
    });
  };

  it('renders nothing when not rate limited and not retrying', () => {
    mockStore({ isRateLimited: false, retryAttempt: 0 });

    render(<RateLimitBanner />);

    expect(screen.queryByText('Rate Limit Reached')).not.toBeInTheDocument();
    expect(screen.queryByText('API Congestion')).not.toBeInTheDocument();
  });

  it('renders rate limit banner when isRateLimited is true', () => {
    const resetTime = Date.now() + 30000; // 30 seconds from now
    mockStore({ isRateLimited: true, resetTime, retryAttempt: 0 });

    render(<RateLimitBanner />);

    expect(screen.getByText('Rate Limit Reached')).toBeInTheDocument();
    expect(screen.getByText(/Horizon is taking a breather/)).toBeInTheDocument();
    expect(screen.getByText(/Resuming in \d+s/)).toBeInTheDocument();
  });

  it('renders countdown timer when rate limited', () => {
    const resetTime = Date.now() + 45000; // 45 seconds from now
    mockStore({ isRateLimited: true, resetTime, retryAttempt: 0 });

    render(<RateLimitBanner />);

    // Find the countdown element with exact text match
    const countdownText = screen.getAllByText(/45s/);
    expect(countdownText.length).toBeGreaterThan(0);
  });

  it('renders retrying banner when retryAttempt > 0', () => {
    mockStore({
      isRateLimited: false,
      resetTime: null,
      retryAttempt: 2,
      message: 'Retrying connection...',
    });

    render(<RateLimitBanner />);

    expect(screen.getByText('API Congestion')).toBeInTheDocument();
    expect(screen.getByText(/Retrying connection/)).toBeInTheDocument();
  });

  it('displays custom message when retrying', () => {
    mockStore({
      isRateLimited: false,
      resetTime: null,
      retryAttempt: 1,
      message: 'Custom retry message',
    });

    render(<RateLimitBanner />);

    expect(screen.getByText('Custom retry message')).toBeInTheDocument();
  });

  it('shows AlertTriangle icon when rate limited', () => {
    const resetTime = Date.now() + 30000;
    mockStore({ isRateLimited: true, resetTime, retryAttempt: 0 });

    render(<RateLimitBanner />);

    // Check for the AlertTriangle SVG icon by class name (aria-hidden makes it inaccessible via role)
    const alertIcon = screen.getByTestId('rate-limit-alert-icon');
    expect(alertIcon).toBeInTheDocument();
  });

  it('shows RotateCcw icon when retrying', () => {
    mockStore({
      isRateLimited: false,
      resetTime: null,
      retryAttempt: 2,
      message: 'Retrying...',
    });

    render(<RateLimitBanner />);

    // Check for the RotateCcw SVG icon by class name (aria-hidden makes it inaccessible via role)
    const rotateIcon = screen.getByTestId('rate-limit-retry-icon');
    expect(rotateIcon).toBeInTheDocument();
  });

  it('shows Clock icon with countdown when rate limited', () => {
    const resetTime = Date.now() + 30000;
    mockStore({ isRateLimited: true, resetTime, retryAttempt: 0 });

    render(<RateLimitBanner />);

    // Check for the Clock SVG icon by class name (aria-hidden makes it inaccessible via role)
    const clockIcon = screen.getByTestId('rate-limit-clock-icon');
    expect(clockIcon).toBeInTheDocument();
    // Check for countdown text in the clock container - use the span with font-mono class
    const countdownSpan = clockIcon.closest('div')?.querySelector('span.text-xs.font-mono');
    expect(countdownSpan).toBeInTheDocument();
    expect(countdownSpan).toHaveTextContent(/30s/);
  });

  it('updates countdown as time passes', () => {
    const initialResetTime = Date.now() + 30000;
    mockStore({ isRateLimited: true, resetTime: initialResetTime, retryAttempt: 0 });

    render(<RateLimitBanner />);

    // Find the countdown span element
    const countdownElements = screen.getAllByText(/30s/);
    expect(countdownElements.length).toBeGreaterThan(0);

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // Should update to 25s
    const updatedCountdown = screen.getAllByText(/25s/);
    expect(updatedCountdown.length).toBeGreaterThan(0);
  });

  it('applies red gradient background when rate limited', () => {
    const resetTime = Date.now() + 30000;
    mockStore({ isRateLimited: true, resetTime, retryAttempt: 0 });

    render(<RateLimitBanner />);

    const banner = screen.getByText('Rate Limit Reached').closest('div');
    expect(banner).toHaveStyle({ background: expect.stringContaining('linear-gradient') });
  });

  it('applies blue gradient background when retrying', () => {
    mockStore({
      isRateLimited: false,
      resetTime: null,
      retryAttempt: 2,
      message: 'Retrying...',
    });

    render(<RateLimitBanner />);

    const banner = screen.getByText('API Congestion').closest('div');
    expect(banner).toHaveStyle({ background: expect.stringContaining('linear-gradient') });
  });

  it('hides banner when rate limit clears', () => {
    const resetTime = Date.now() + 30000;
    mockStore({ isRateLimited: true, resetTime, retryAttempt: 0 });

    const { unmount } = render(<RateLimitBanner />);

    expect(screen.getByText('Rate Limit Reached')).toBeInTheDocument();

    unmount();

    mockStore({ isRateLimited: false, resetTime: null, retryAttempt: 0 });
    render(<RateLimitBanner />);

    expect(screen.queryByText('Rate Limit Reached')).not.toBeInTheDocument();
  });

  it('renders progress bar animation when retrying', () => {
    mockStore({
      isRateLimited: false,
      resetTime: null,
      retryAttempt: 1,
      message: 'Retrying...',
    });

    render(<RateLimitBanner />);

    // The animated progress bar should be present when retrying
    expect(screen.getByText('API Congestion')).toBeInTheDocument();
  });
});
