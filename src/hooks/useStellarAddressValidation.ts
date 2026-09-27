import { useState, useEffect, useRef, useCallback } from 'react';
import { Horizon } from 'stellar-sdk';
import { Network, RPC_ENDPOINTS } from '../config';
import { validateStellarAddress, ValidationState } from '../utils/validateStellarAddress';
import { logger } from '../../app/utils/logger';

const log = logger.child('useStellarAddressValidation');

interface UseStellarAddressValidationProps {
  initialAddress?: string;
  network?: Network;
  debounceMs?: number;
}

interface ValidationCacheEntry {
  state: ValidationState;
  error: string | null;
  timestamp: number;
}

// Validation cache with TTL (5 minutes)
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const validationCache = new Map<string, ValidationCacheEntry>();

/**
 * Clear cache entries for a specific network when network changes
 */
const clearCacheForNetwork = (_network: Network) => {
  // Clear all expired entries and reset for network change
  validationCache.clear();
};

/**
 * Get cached validation result if available and not expired
 */
const getCachedValidation = (address: string, network: Network): ValidationCacheEntry | null => {
  const cacheKey = `${network}:${address}`;
  const cached = validationCache.get(cacheKey);
  
  if (!cached) return null;
  
  const now = Date.now();
  if (now - cached.timestamp > CACHE_TTL) {
    validationCache.delete(cacheKey);
    return null;
  }
  
  return cached;
};

/**
 * Store validation result in cache
 */
const setCachedValidation = (
  address: string, 
  network: Network, 
  state: ValidationState, 
  error: string | null
) => {
  const cacheKey = `${network}:${address}`;
  validationCache.set(cacheKey, {
    state,
    error,
    timestamp: Date.now()
  });
};

export const useStellarAddressValidation = ({
  initialAddress = '',
  network = 'mainnet' as Network,
  debounceMs = 300,
}: UseStellarAddressValidationProps = {}) => {
  const [address, setAddress] = useState(initialAddress);
  const [debouncedAddress, setDebouncedAddress] = useState(initialAddress);
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const previousNetworkRef = useRef<Network>(network);

  // Clear cache when network changes
  useEffect(() => {
    if (previousNetworkRef.current !== network) {
      clearCacheForNetwork(network);
      previousNetworkRef.current = network;
      // Note: Re-validation happens automatically via the validation effect
      // since 'network' is in its dependency array
    }
  }, [network]);

  // Auto-format address: remove spaces and uppercase
  const formatAddress = (rawAddress: string) => {
    return rawAddress.replace(/\s+/g, '').toUpperCase();
  };

  const handleAddressChange = useCallback((newAddress: string) => {
    const formatted = formatAddress(newAddress);
    setAddress(formatted);
    
    // Clear previous timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    if (!formatted) {
      setValidationState('idle');
      setErrorMessage(null);
      setDebouncedAddress('');
      return;
    }

    // Check cache first for instant feedback
    const cached = getCachedValidation(formatted, network);
    if (cached) {
      setValidationState(cached.state);
      setErrorMessage(cached.error);
      setDebouncedAddress(formatted);
      return;
    }

    // Set formatting validation state while typing
    setValidationState('validating');
    setErrorMessage(null);

    // Debounce the actual network validation
    timerRef.current = setTimeout(() => {
      setDebouncedAddress(formatted);
    }, debounceMs);
  }, [debounceMs, network]);

  // Network check effect
  useEffect(() => {
    if (!debouncedAddress) return;

    let isMounted = true;

    const validateAccountNetwork = async () => {
      // Check cache first
      const cached = getCachedValidation(debouncedAddress, network);
      if (cached && isMounted) {
        setValidationState(cached.state);
        setErrorMessage(cached.error);
        return;
      }

      // 1. Format validation first
      const formatResult = validateStellarAddress(debouncedAddress, network);
      
      if (!isMounted) return;

      if (!formatResult.isValid) {
        setValidationState(formatResult.state);
        const errorMsg = formatResult.error || 'Invalid address format';
        setErrorMessage(errorMsg);
        setCachedValidation(debouncedAddress, network, formatResult.state, errorMsg);
        return;
      }

      // 2. Network existence check
      setValidationState('validating');
      setErrorMessage(null);

      try {
        const rpcUrl = RPC_ENDPOINTS[network];
        const server = new Horizon.Server(rpcUrl);
        
        // Use Horizon API call to check if account exists on the network
        await server.loadAccount(debouncedAddress);
        
        if (!isMounted) return;

        setValidationState('valid');
        setErrorMessage(null);
        setCachedValidation(debouncedAddress, network, 'valid', null);
        
      } catch (error) {
        if (!isMounted) return;

        log.error("Account validation error:", error);
        
        const err = error as { response?: { status?: number } };
        if (err?.response?.status === 404) {
          const errorMsg = `Account not found on ${network === 'mainnet' ? 'Stellar Mainnet' : 'Stellar Testnet'}`;
          setValidationState('not-found');
          setErrorMessage(errorMsg);
          setCachedValidation(debouncedAddress, network, 'not-found', errorMsg);
        } else {
          const errorMsg = 'Unable to verify account on Stellar network';
          setValidationState('error');
          setErrorMessage(errorMsg);
          // Don't cache network errors as they might be temporary
        }
      }
    };

    validateAccountNetwork();

    return () => {
      isMounted = false;
    };
  }, [debouncedAddress, network]);

  const reset = useCallback(() => {
    setAddress('');
    setDebouncedAddress('');
    setValidationState('idle');
    setErrorMessage(null);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return {
    address,
    debouncedAddress,
    validationState,
    errorMessage,
    setValidationState, // Exposed for indexer to update state
    handleAddressChange,
    formatAddress,
    reset,
    isValid: validationState === 'valid'
  };
};
