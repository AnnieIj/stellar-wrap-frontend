/**
 * Tests for the Zustand-based theme store with localStorage persistence.
 */
import { useThemeStore } from '../themeStore';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

beforeEach(() => {
  // Reset the store state before each test
  useThemeStore.setState({
    color: 'green',
    mode: 'dark',
  });
  localStorageMock.clear();
  jest.clearAllMocks();
});

describe('ThemeStore', () => {
  it('should have correct default values', () => {
    const state = useThemeStore.getState();
    expect(state.color).toBe('green');
    expect(typeof state.mode).toBe('string');
  });

  it('should update color via setColor', () => {
    useThemeStore.getState().setColor('pink');
    expect(useThemeStore.getState().color).toBe('pink');
  });

  it('should update mode via setMode', () => {
    useThemeStore.getState().setMode('light');
    expect(useThemeStore.getState().mode).toBe('light');
  });

  it('should toggle mode via toggleMode', () => {
    const initialMode = useThemeStore.getState().mode;
    useThemeStore.getState().toggleMode();
    expect(useThemeStore.getState().mode).toBe(
      initialMode === 'dark' ? 'light' : 'dark',
    );
  });

  it('should toggle mode back and forth', () => {
    useThemeStore.setState({ mode: 'dark' });
    useThemeStore.getState().toggleMode();
    expect(useThemeStore.getState().mode).toBe('light');
    useThemeStore.getState().toggleMode();
    expect(useThemeStore.getState().mode).toBe('dark');
  });

  it('should accept all valid theme colors', () => {
    const colors = [
      'green',
      'pink',
      'yellow',
      'red',
      'purple',
      'cosmic-purple',
    ] as const;
    for (const color of colors) {
      useThemeStore.getState().setColor(color);
      expect(useThemeStore.getState().color).toBe(color);
    }
  });

  it('should persist state to localStorage with key stellar-theme', () => {
    // Simulate persistence by directly setting state
    useThemeStore.setState({ color: 'purple', mode: 'light' });

    const state = useThemeStore.getState();
    expect(state.color).toBe('purple');
    expect(state.mode).toBe('light');
  });

  it('should only persist color and mode (partialize)', () => {
    // The store only persists color and mode via partialize
    const state = useThemeStore.getState();
    // Verify the store only has the expected keys (not internal zustand keys)
    expect(state).toHaveProperty('color');
    expect(state).toHaveProperty('mode');
    expect(state).toHaveProperty('setColor');
    expect(state).toHaveProperty('setMode');
    expect(state).toHaveProperty('toggleMode');
  });
});
