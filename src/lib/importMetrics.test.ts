import assert from 'node:assert/strict';
import * as XLSX from '@e965/xlsx';
import { parseMetricsFile } from './importMetrics';

async function runTests() {
  const csv = new File(
    ['Дата;Продано номеров;Номера OOO;Тариф станд.;Pickup\n01.11.2026;14;2;4 500;3'],
    'metrics.csv'
  );
  const parsedCsv = await parseMetricsFile(csv, 92);
  assert.deepEqual(parsedCsv[0], {
    date: '2026-11-01',
    roomsSold: 14,
    oooRooms: 2,
    standardRate: 4500,
    pickupYesterday: 3,
    actualizedOccupancy: null,
    senatorRate: null,
    updatedRate: null,
    notes: '',
  });

  const kztCsv = new File(
    ['Дата,Продано номеров,Тариф стандарт,Тариф SENATOR\n03.11.2026,1,5 000 ₸,KZT 6 000'],
    'kzt-rates.csv'
  );
  const parsedKztCsv = await parseMetricsFile(kztCsv);
  assert.equal(parsedKztCsv[0].standardRate, 5000);
  assert.equal(parsedKztCsv[0].senatorRate, 6000);

  await assert.rejects(
    parseMetricsFile(new File(
      ['Дата,Продано номеров,Тариф стандарт\n03.11.2026,1,$500'],
      'foreign-currency.csv'
    )),
    /должна быть указана в тенге/
  );

  const sheet = XLSX.utils.aoa_to_sheet([
    ['Дата', 'Продано номеров', 'Тариф стандарт', 'Ручная загрузка'],
    ['2026-11-02', 20, 5000, 40],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Данные');
  const xlsx = new File(
    [XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as BlobPart],
    'metrics.xlsx'
  );
  const parsedXlsx = await parseMetricsFile(xlsx);
  assert.equal(parsedXlsx[0].date, '2026-11-02');
  assert.equal(parsedXlsx[0].actualizedOccupancy, 40);

  const foreignCurrencySheet = XLSX.utils.aoa_to_sheet([
    ['Дата', 'Продано номеров', 'Тариф стандарт'],
    ['2026-11-03', 1, 5000],
  ]);
  foreignCurrencySheet.C2.z = '$#,##0.00';
  const foreignCurrencyWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(foreignCurrencyWorkbook, foreignCurrencySheet, 'Данные');
  const foreignCurrencyXlsx = new File(
    [XLSX.write(foreignCurrencyWorkbook, { type: 'buffer', bookType: 'xlsx' }) as BlobPart],
    'foreign-currency.xlsx'
  );
  await assert.rejects(parseMetricsFile(foreignCurrencyXlsx), /должна быть указана в тенге/);

  await assert.rejects(
    parseMetricsFile(new File(['Дата,Продано номеров\n01.11.2026,1\n01.11.2026,2'], 'duplicate.csv')),
    /повторяется/
  );
  await assert.rejects(
    parseMetricsFile(new File(['Дата,Продано номеров,Номера OOO\n01.11.2026,91,2'], 'over-capacity.csv'), 92),
    /не могут превышать фонд/
  );

  console.log('All spreadsheet import tests passed.');
}

void runTests();
