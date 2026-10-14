import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTileOrder,
  calculateOrderableArea,
  formatArea,
  resolveCoverage,
} from '../assets/tile-area-calculator-core.js';

const example = {
  coverageM2: '1.44',
  packPriceMinor: 2807,
  availablePacks: 102,
};

test('1 m² requires 1 pack and totals £28.07', () => {
  const result = calculateTileOrder({ ...example, requestedM2: '1' });
  assert.equal(result.valid, true);
  assert.equal(result.packs, 1);
  assert.equal(result.suppliedM2, '1.44');
  assert.equal(result.totalMinor, 2807);
});

test('6 m² requires 5 packs, supplies 7.20 m², and totals £140.35', () => {
  const result = calculateTileOrder({ ...example, requestedM2: '6' });
  assert.equal(result.valid, true);
  assert.equal(result.packs, 5);
  assert.equal(result.suppliedM2, '7.20');
  assert.equal(result.totalMinor, 14035);
});

test('2 m² requires 2 packs, supplies 2.88 m², and totals £56.14', () => {
  const result = calculateTileOrder({ ...example, requestedM2: '2' });
  assert.equal(result.packs, 2);
  assert.equal(result.suppliedM2, '2.88');
  assert.equal(result.totalMinor, 5614);
});

test('4 m² requires 3 packs and totals £84.21', () => {
  const result = calculateTileOrder({ ...example, requestedM2: '4' });
  assert.equal(result.packs, 3);
  assert.equal(result.suppliedM2, '4.32');
  assert.equal(result.totalMinor, 8421);
});

test('50 m² requires 35 packs and totals £982.45', () => {
  const result = calculateTileOrder({ ...example, requestedM2: '50' });
  assert.equal(result.valid, true);
  assert.equal(result.packs, 35);
  assert.equal(result.suppliedM2, '50.40');
  assert.equal(result.totalMinor, 98245);
});

test('uses configured 1.44 m² pack coverage', () => {
  const coverage = resolveCoverage({ coverageM2: '1.44' });
  assert.ok(coverage);
  assert.equal(formatArea(coverage.numerator, coverage.denominator), '1.44');
});

test('derives and rounds coverage independently for different tile products', () => {
  const firstCoverage = resolveCoverage({ tilesPerBox: '6', tilesPerM2: '3.33' });
  const secondCoverage = resolveCoverage({ tilesPerBox: '10', tilesPerM2: '7' });

  assert.equal(formatArea(firstCoverage.numerator, firstCoverage.denominator), '1.80');
  assert.equal(formatArea(secondCoverage.numerator, secondCoverage.denominator), '1.43');

  const firstOrder = calculateTileOrder({
    requestedM2: '6',
    tilesPerBox: '6',
    tilesPerM2: '3.33',
    packPriceMinor: 4200,
    availablePacks: 10,
  });
  const secondOrder = calculateTileOrder({
    requestedM2: '6',
    tilesPerBox: '10',
    tilesPerM2: '7',
    packPriceMinor: 3150,
    availablePacks: 10,
  });

  assert.deepEqual(
    { packs: firstOrder.packs, suppliedM2: firstOrder.suppliedM2, totalMinor: firstOrder.totalMinor },
    { packs: 4, suppliedM2: '7.20', totalMinor: 16800 }
  );
  assert.deepEqual(
    { packs: secondOrder.packs, suppliedM2: secondOrder.suppliedM2, totalMinor: secondOrder.totalMinor },
    { packs: 5, suppliedM2: '7.15', totalMinor: 15750 }
  );
});

test('rejects missing or invalid PDP tile counts', () => {
  assert.equal(resolveCoverage({ tilesPerBox: '', tilesPerM2: '2.78' }), null);
  assert.equal(resolveCoverage({ tilesPerBox: '4', tilesPerM2: 'invalid' }), null);
});

test('72 m² is exactly 50 packs and totals £1,403.50', () => {
  const result = calculateTileOrder({ ...example, requestedM2: '72' });
  assert.equal(result.packs, 50);
  assert.equal(result.suppliedM2, '72.00');
  assert.equal(result.totalMinor, 140350);
});

test('rejects invalid, zero, negative, and fractional requested areas', () => {
  for (const requestedM2 of ['', '0', '-1', '1.5', 'abc']) {
    assert.equal(calculateTileOrder({ ...example, requestedM2 }).valid, false, requestedM2);
  }
});

test('rejects missing and invalid tile metadata', () => {
  assert.equal(resolveCoverage({}), null);
  assert.equal(resolveCoverage({ tilesPerBox: 'four', tilesPerM2: '2.78' }), null);
  assert.equal(resolveCoverage({ tilesPerBox: '4.5', tilesPerM2: '2.78' }), null);
  assert.equal(resolveCoverage({ tilesPerBox: '4', tilesPerM2: '0' }), null);
});

test('checks required packs against native pack inventory at the exact boundary', () => {
  const enough = calculateTileOrder({ ...example, requestedM2: '50', availablePacks: 35 });
  const short = calculateTileOrder({ ...example, requestedM2: '50', availablePacks: 34 });
  assert.equal(enough.insufficientStock, false);
  assert.equal(short.insufficientStock, true);
});

test('sold-out inventory blocks ordering unless Shopify allows overselling', () => {
  const soldOut = calculateTileOrder({ ...example, requestedM2: '1', availablePacks: 0 });
  const overselling = calculateTileOrder({
    ...example,
    requestedM2: '1',
    availablePacks: 0,
    continueSelling: true,
  });

  assert.equal(soldOut.insufficientStock, true);
  assert.equal(overselling.insufficientStock, false);
});

test('includes reserved packs from repeated additions in the stock check', () => {
  const result = calculateTileOrder({
    ...example,
    requestedM2: '50',
    availablePacks: 69,
    reservedPacks: 35,
  });
  assert.equal(result.insufficientStock, true);
});

test('recalculates price and stock inputs supplied by a variant change', () => {
  const first = calculateTileOrder({ ...example, requestedM2: '50' });
  const second = calculateTileOrder({ ...example, requestedM2: '50', packPriceMinor: 3000, availablePacks: 34 });
  assert.equal(first.totalMinor, 98245);
  assert.equal(second.totalMinor, 105000);
  assert.equal(second.insufficientStock, true);
});

test('102 packs expose 146.88 m² as orderable availability', () => {
  assert.equal(calculateOrderableArea({ coverageM2: '1.44', availablePacks: 102 }), '146.88');
});
