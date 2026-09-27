/**
 * RFC 5322-compatible email address validator.
 *
 * The regex covers the common practical subset of RFC 5322:
 *   - Local part: printable ASCII chars, dots, plus signs, hyphens
 *   - Domain: labels separated by dots, each 1–63 chars
 *   - TLD: at least 2 alphabetic characters
 *
 * Edge cases intentionally rejected:
 *   - Quoted local parts  ("foo bar"@example.com)
 *   - IP-address domains  (user@[192.168.0.1])
 *   - Internationalised domain names without punycode encoding
 *
 * These are valid per the full RFC but extremely rare in practice and
 * unsupported by most email services.
 */
const EMAIL_REGEX =
  /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

/**
 * Returns `true` when `email` conforms to the RFC 5322-compatible format,
 * `false` otherwise.
 */
export function isValidEmail(email: string): boolean {
  if (typeof email !== "string") return false;
  // Reject leading/trailing whitespace (must be stripped by the caller)
  if (email !== email.trim()) return false;
  // Hard length guard (RFC 5321 §4.5.3 limits the total address to 254 chars)
  if (email.length > 254) return false;
  return EMAIL_REGEX.test(email);
}
