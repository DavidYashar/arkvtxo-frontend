export function formatTokenAmount(
  amount: string | bigint,
  decimals: number,
  opts?: { trimTrailingZeros?: boolean; alwaysShowDecimals?: boolean }
): string {
  const trimTrailingZeros = opts?.trimTrailingZeros ?? true;
  const alwaysShowDecimals = opts?.alwaysShowDecimals ?? false;
  const value = typeof amount === 'string' ? BigInt(amount) : amount;

  if (decimals <= 0) return value.toString();

  const base = BigInt(10) ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;

  if (fraction === BigInt(0)) {
    if (!alwaysShowDecimals) return whole.toString();
    return `${whole.toString()}.${'0'.repeat(decimals)}`;
  }

  let fractionStr = fraction.toString().padStart(decimals, '0');
  if (trimTrailingZeros) fractionStr = fractionStr.replace(/0+$/, '');
  if (fractionStr.length === 0) {
    if (!alwaysShowDecimals) return whole.toString();
    fractionStr = '0';
  }

  return `${whole.toString()}.${fractionStr}`;
}

export function parseTokenAmount(input: string, decimals: number): bigint {
  const raw = String(input ?? '').trim();
  if (raw.length === 0) throw new Error('Amount is required');

  // Disallow signs and exponent notation.
  if (/[eE+-]/.test(raw)) throw new Error('Amount must be a plain number');

  if (decimals <= 0) {
    if (raw.includes('.')) throw new Error('This token does not support decimals');
    if (!/^[0-9]+$/.test(raw)) throw new Error('Invalid amount');
    return BigInt(raw);
  }

  if (!/^[0-9]+(\.[0-9]+)?$/.test(raw)) throw new Error('Invalid amount');

  const [wholePart, fracPartRaw = ''] = raw.split('.');
  const fracPart = fracPartRaw ?? '';

  if (fracPart.length > decimals) {
    throw new Error(`Too many decimal places (max ${decimals})`);
  }

  const paddedFrac = fracPart.padEnd(decimals, '0');
  const combined = `${wholePart}${paddedFrac}`;

  // Remove leading zeros, but keep at least one digit.
  const normalized = combined.replace(/^0+(?=\d)/, '');
  return BigInt(normalized);
}
