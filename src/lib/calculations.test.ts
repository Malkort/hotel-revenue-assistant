import assert from 'node:assert';
import {
  calculateAvailableRooms,
  calculateOccupancy,
  calculateADR,
  calculateRevPAR,
  calculateRevenue,
  getOccupancyBand,
  calculateRowMetrics,
} from './calculations';

function runTests() {
  console.log('Running tests for Hotel Revenue calculations...');

  // 1. Available rooms
  assert.strictEqual(calculateAvailableRooms(50, 5), 45);
  assert.strictEqual(calculateAvailableRooms(50, 60), 0, 'Cannot be negative');
  assert.strictEqual(calculateAvailableRooms(50, -5), 50, 'Negative OOO handled safely');

  // 2. Occupancy %
  assert.strictEqual(calculateOccupancy(15, 50), 30);
  assert.strictEqual(calculateOccupancy(35, 50), 70);
  assert.strictEqual(calculateOccupancy(40, 50), 80);
  assert.strictEqual(calculateOccupancy(10, 0), 0, 'Zero rooms handled safely');

  // 3. Revenue & ADR & RevPAR
  const revenue = calculateRevenue(20, 5000);
  assert.strictEqual(revenue, 100000);
  assert.strictEqual(calculateADR(100000, 20), 5000);
  assert.strictEqual(calculateRevPAR(100000, 40), 2500);

  // 4. Bands
  assert.strictEqual(getOccupancyBand(25), 'low');
  assert.strictEqual(getOccupancyBand(30), 'low');
  assert.strictEqual(getOccupancyBand(30.1), 'medium');
  assert.strictEqual(getOccupancyBand(70), 'medium');
  assert.strictEqual(getOccupancyBand(70.1), 'high');
  assert.strictEqual(getOccupancyBand(95), 'high');

  // 5. Full row calculation
  const row = calculateRowMetrics(
    {
      date: '2026-11-01',
      roomsSold: 12,
      oooRooms: 2,
      standardRate: 4500,
      pickupYesterday: 3,
      actualizedOccupancy: null,
      senatorRate: 5000,
      updatedRate: 4800,
    },
    50
  );

  assert.strictEqual(row.availableRooms, 48);
  assert.strictEqual(row.calculatedOccupancy, 25);
  assert.strictEqual(row.effectiveOccupancy, 25);
  assert.strictEqual(row.revenue, 12 * 4800);
  assert.strictEqual(row.band, 'low');

  console.log('✅ All calculations tests passed successfully!');
}

runTests();
