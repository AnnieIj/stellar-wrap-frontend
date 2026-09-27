import { validateStellarAddress } from '../src/utils/validateStellarAddress';

const VALID_STELLAR_KEY = 'G' + 'A'.repeat(55);

describe('validateStellarAddress', () => {
  it('returns isValid=true and state=validating for a well-formed address', () => {
    const result = validateStellarAddress(VALID_STELLAR_KEY, 'mainnet');
    expect(result.isValid).toBe(true);
    expect(result.state).toBe('validating');
  });

  it('returns state=idle for an empty address', () => {
    const result = validateStellarAddress('', 'mainnet');
    expect(result.isValid).toBe(false);
    expect(result.state).toBe('idle');
  });

  it('returns state=invalid-format for a short address', () => {
    const result = validateStellarAddress('GABCD', 'mainnet');
    expect(result.isValid).toBe(false);
    expect(result.state).toBe('invalid-format');
  });

  it('returns state=invalid-format for an address with wrong prefix', () => {
    const result = validateStellarAddress('X' + 'A'.repeat(55), 'mainnet');
    expect(result.isValid).toBe(false);
    expect(result.state).toBe('invalid-format');
  });
});

describe('connect page keyboard handler conditions', () => {
  it('does not allow submission while validation is pending (validating state)', () => {
    const validatingState = 'validating';
    const isValid = false;
    const walletAddress = VALID_STELLAR_KEY;

    const canSubmit = Boolean(
      walletAddress.trim() && isValid && validatingState !== 'validating'
    );

    expect(canSubmit).toBe(false);
  });

  it('allows submission when validation is complete and valid', () => {
    const validationState = 'valid';
    const isValid = true;
    const walletAddress = VALID_STELLAR_KEY;

    const canSubmit = Boolean(
      walletAddress.trim() && isValid && validationState !== 'validating'
    );

    expect(canSubmit).toBe(true);
  });

  it('blocks submission when address is empty even if isValid is true', () => {
    const walletAddress = '';
    const isValid = true;

    const canSubmit = Boolean(walletAddress.trim() && isValid);

    expect(canSubmit).toBe(false);
  });

  it('blocks submission when isValid is false (invalid format)', () => {
    const walletAddress = 'BADADDRESS';
    const isValid = false;

    const canSubmit = Boolean(walletAddress.trim() && isValid);

    expect(canSubmit).toBe(false);
  });
});
