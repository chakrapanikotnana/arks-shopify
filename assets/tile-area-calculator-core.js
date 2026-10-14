/**
 * Exact, integer-backed calculations for the tile-area preview.
 * Decimal strings are converted to fractions so box-boundary checks never
 * depend on binary floating-point arithmetic.
 * Shared by the PDP calculator and cart area editor.
 */

const DECIMAL_PATTERN = /^\d+(?:\.\d+)?$/;

function gcd(a, b) {
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

export function parsePositiveDecimal(value) {
  const text = String(value ?? '').trim();
  if (!DECIMAL_PATTERN.test(text)) return null;

  const [whole, fraction = ''] = text.split('.');
  const denominator = 10n ** BigInt(fraction.length);
  const numerator = BigInt(`${whole}${fraction}`);
  if (numerator <= 0n) return null;

  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

export function resolveCoverage({ coverageM2, tilesPerBox, tilesPerM2 }) {
  const configuredCoverage = parsePositiveDecimal(coverageM2);
  if (configuredCoverage) return configuredCoverage;

  const packTiles = parsePositiveDecimal(tilesPerBox);
  const density = parsePositiveDecimal(tilesPerM2);
  if (!packTiles || !density || packTiles.denominator !== 1n) return null;

  const rawNumerator = packTiles.numerator * density.denominator;
  const rawDenominator = density.numerator;
  const roundedHundredths = divideAndRound(rawNumerator * 100n, rawDenominator);
  if (roundedHundredths <= 0n) return null;

  const divisor = gcd(roundedHundredths, 100n);
  return { numerator: roundedHundredths / divisor, denominator: 100n / divisor };
}

function divideAndRound(numerator, denominator) {
  return (numerator + denominator / 2n) / denominator;
}

export function formatArea(numerator, denominator, precision = 2) {
  const scale = 10n ** BigInt(precision);
  const scaled = divideAndRound(numerator * scale, denominator);
  const whole = scaled / scale;
  const fraction = String(scaled % scale).padStart(precision, '0');
  return precision > 0 ? `${whole}.${fraction}` : String(whole);
}

export function calculateTileOrder({
  requestedM2,
  coverageM2,
  tilesPerBox,
  tilesPerM2,
  packPriceMinor,
  availablePacks,
  reservedPacks = 0,
  continueSelling = false,
}) {
  const requestedText = String(requestedM2 ?? '').trim();
  if (!/^\d+$/.test(requestedText) || BigInt(requestedText) <= 0n) {
    return { valid: false, error: 'Enter a positive whole number of square metres.' };
  }

  const coverage = resolveCoverage({ coverageM2, tilesPerBox, tilesPerM2 });
  if (!coverage) {
    return { valid: false, error: 'Pack coverage is unavailable. Please contact us before ordering.' };
  }

  const price = Number(packPriceMinor);
  if (!Number.isSafeInteger(price) || price < 0) {
    return { valid: false, error: 'Price information is unavailable.' };
  }

  const requested = BigInt(requestedText);
  const packs = (requested * coverage.denominator + coverage.numerator - 1n) / coverage.numerator;
  const suppliedNumerator = packs * coverage.numerator;
  const suppliedDenominator = coverage.denominator;
  const totalMinor = packs * BigInt(price);

  let insufficientStock = false;
  const available = Number(availablePacks);
  const reserved = Number(reservedPacks);
  if (
    !continueSelling &&
    Number.isSafeInteger(available) &&
    available >= 0 &&
    Number.isSafeInteger(reserved) &&
    reserved >= 0
  ) {
    insufficientStock = Number(packs) + reserved > available;
  }

  return {
    valid: true,
    packs: Number(packs),
    coverageM2: formatArea(coverage.numerator, coverage.denominator),
    suppliedM2: formatArea(suppliedNumerator, suppliedDenominator),
    totalMinor: Number(totalMinor),
    insufficientStock,
  };
}

export function calculateOrderableArea({ coverageM2, tilesPerBox, tilesPerM2, availablePacks }) {
  const coverage = resolveCoverage({ coverageM2, tilesPerBox, tilesPerM2 });
  const packs = Number(availablePacks);
  if (!coverage || !Number.isSafeInteger(packs) || packs < 0) return null;
  return formatArea(BigInt(packs) * coverage.numerator, coverage.denominator);
}

