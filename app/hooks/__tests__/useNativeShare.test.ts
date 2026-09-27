import { isNativeShareSupported, nativeShare } from '../useNativeShare';

type MockNavigator = Parameters<typeof nativeShare>[1];

function makeNavigator(overrides: Record<string, unknown>): MockNavigator {
  return overrides as unknown as MockNavigator;
}

function abortError(): Error {
  const error = new Error('Share canceled');
  error.name = 'AbortError';
  return error;
}

describe('isNativeShareSupported', () => {
  it('is false when there is no navigator (SSR)', () => {
    expect(isNativeShareSupported(undefined)).toBe(false);
  });

  it('is false when navigator has no share method', () => {
    expect(isNativeShareSupported(makeNavigator({}))).toBe(false);
  });

  it('is true when navigator.share is a function', () => {
    expect(isNativeShareSupported(makeNavigator({ share: jest.fn() }))).toBe(true);
  });
});

describe('nativeShare', () => {
  const data = { title: 'Stellar Wrapped 2026', text: 'my wrap', url: 'https://example.com/share' };

  it('returns "unsupported" when the Web Share API is missing', async () => {
    await expect(nativeShare(data, makeNavigator({}))).resolves.toBe('unsupported');
  });

  it('returns "unsupported" when canShare rejects the payload', async () => {
    const share = jest.fn();
    const nav = makeNavigator({ share, canShare: () => false });

    await expect(nativeShare(data, nav)).resolves.toBe('unsupported');
    expect(share).not.toHaveBeenCalled();
  });

  it('passes the payload to navigator.share and returns "shared"', async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    const nav = makeNavigator({ share, canShare: () => true });

    await expect(nativeShare(data, nav)).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith(data);
  });

  it('returns "cancelled" — not an error — when the user dismisses the sheet', async () => {
    const nav = makeNavigator({ share: jest.fn().mockRejectedValue(abortError()) });

    await expect(nativeShare(data, nav)).resolves.toBe('cancelled');
  });

  it('never throws on cancellation', async () => {
    const nav = makeNavigator({ share: jest.fn().mockRejectedValue(abortError()) });

    let threw = false;
    try {
      await nativeShare(data, nav);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });

  it('returns "failed" for genuine errors so callers can fall back', async () => {
    const nav = makeNavigator({
      share: jest.fn().mockRejectedValue(new Error('Permission denied')),
    });

    await expect(nativeShare(data, nav)).resolves.toBe('failed');
  });
});
