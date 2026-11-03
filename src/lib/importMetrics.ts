import * as XLSX from '@e965/xlsx';
import type { DailyMetricInput } from './types';

type ImportField = keyof Omit<DailyMetricInput, 'date'>;

const HEADER_ALIASES: Record<keyof DailyMetricInput, string[]> = {
  date: ['date', 'дата', 'metricdate'],
  roomsSold: ['roomssold', 'soldrooms', 'rooms sold', 'проданономеров', 'номеровпродано', 'продано'],
  oooRooms: ['ooorooms', 'outoforder', 'номераооо', 'номераooo', 'ооо', 'ремонт'],
  standardRate: ['standardrate', 'standard rate', 'тарифстандарт', 'тарифстанд', 'стандартныйтариф'],
  pickupYesterday: ['pickup', 'pickupyesterday', 'pickup за день', 'забронировановчера', 'забронировановчераpickup', 'приростброней'],
  actualizedOccupancy: ['actualizedoccupancy', 'актуализированнаязагрузка', 'ручнаязагрузка', 'ручнойпроцентзагрузки'],
  senatorRate: ['senatorrate', 'senator', 'тарифsenator', 'тарифсенатор'],
  updatedRate: ['updatedrate', 'обновленныйтариф', 'обновлтарифдня', 'тарифдня', 'новыйтариф'],
  notes: ['notes', 'comment', 'комментарий', 'примечание'],
};

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]/g, '');
}

function parseDate(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return `${String(parsed.y).padStart(4, '0')}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }

  const text = String(value ?? '').trim();
  const dmy = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmy) {
    const [, day, month, year] = dmy;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (
      date.getUTCFullYear() !== Number(year) ||
      date.getUTCMonth() !== Number(month) - 1 ||
      date.getUTCDate() !== Number(day)
    ) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, year, month, day] = iso;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (
      date.getUTCFullYear() !== Number(year) ||
      date.getUTCMonth() !== Number(month) - 1 ||
      date.getUTCDate() !== Number(day)
    ) return null;
    return text;
  }

  if (/^\d{5}(?:\.\d+)?$/.test(text)) return parseDate(Number(text));
  return null;
}

function parseNumber(
  value: unknown,
  rowNumber: number,
  label: string,
  isCurrency = false
): number | null {
  if (value === '' || value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value).trim();
  const normalized = isCurrency
    ? text
        .replace(/(?:KZT|тенге|тг|₸)/gi, '')
        .replace(/[\s\u00a0\u202f]/g, '')
        .replace(',', '.')
    : text.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
  if (isCurrency && !/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) {
    throw new Error(`Строка ${rowNumber}: «${label}» должна быть указана в тенге (₸/KZT).`);
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`Строка ${rowNumber}: некорректное значение «${label}».`);
  return parsed;
}

function assertKztFormat(value: unknown, rowNumber: number, label: string): void {
  if (typeof value !== 'string') return;
  const normalized = value.replace(/(?:KZT|тенге|тг|₸)/gi, '');
  if (/[$€₽£¥₹₩₺₴₫¢]|[A-Za-zА-Яа-яЁё]/.test(normalized)) {
    throw new Error(`Строка ${rowNumber}: «${label}» должна быть указана в тенге (₸/KZT).`);
  }
}

function parseCsv(text: string): unknown[][] {
  const content = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const firstLine = content.split('\n').find((line) => line.trim() !== '') ?? '';
  let inQuotes = false;
  let semicolons = 0;
  let commas = 0;
  for (let index = 0; index < firstLine.length; index += 1) {
    const character = firstLine[index];
    if (character === '"') {
      if (inQuotes && firstLine[index + 1] === '"') index += 1;
      else inQuotes = !inQuotes;
    } else if (!inQuotes && character === ';') semicolons += 1;
    else if (!inQuotes && character === ',') commas += 1;
  }
  const delimiter = semicolons > commas ? ';' : ',';
  const rows: unknown[][] = [];
  let row: string[] = [];
  let cell = '';
  inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (character === '"') {
      if (inQuotes && content[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && character === delimiter) {
      row.push(cell);
      cell = '';
    } else if (!inQuotes && character === '\n') {
      row.push(cell);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  if (inQuotes) throw new Error('В CSV-файле не закрыта кавычка.');
  return rows;
}

export async function parseMetricsFile(file: File, totalRooms = 92): Promise<DailyMetricInput[]> {
  let records: unknown[][];
  let displayRecords: unknown[][];
  if (/\.csv$/i.test(file.name)) {
    records = parseCsv(await file.text());
    displayRecords = records;
  } else {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new Error('В файле не найден лист с данными.');
    const sheet = workbook.Sheets[firstSheetName];
    records = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      defval: '',
    });
    displayRecords = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
    });
  }
  if (records.length < 2) throw new Error('В таблице должны быть заголовки и хотя бы одна строка данных.');

  const headers = records[0].map(normalizeHeader);
  const columns = new Map<keyof DailyMetricInput, number>();
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [keyof DailyMetricInput, string[]][]) {
    const aliasSet = new Set(aliases.map(normalizeHeader));
    const index = headers.findIndex((header) => aliasSet.has(header));
    if (index >= 0) columns.set(field, index);
  }

  if (!columns.has('date') || !columns.has('roomsSold')) {
    throw new Error('Не найдены обязательные столбцы «Дата» и «Продано номеров».');
  }

  const imported: DailyMetricInput[] = [];
  const seenDates = new Set<string>();
  for (let index = 1; index < records.length; index += 1) {
    const cells = records[index];
    if (cells.every((cell) => String(cell ?? '').trim() === '')) continue;
    const rowNumber = index + 1;
    const date = parseDate(cells[columns.get('date')!]);
    if (!date) throw new Error(`Строка ${rowNumber}: не удалось распознать дату.`);
    if (seenDates.has(date)) throw new Error(`Строка ${rowNumber}: дата ${date} повторяется в файле.`);
    seenDates.add(date);

    const roomsSold = parseNumber(cells[columns.get('roomsSold')!], rowNumber, 'Продано номеров');
    if (roomsSold === null || roomsSold < 0 || !Number.isInteger(roomsSold)) {
      throw new Error(`Строка ${rowNumber}: количество проданных номеров должно быть целым числом не меньше нуля.`);
    }

    const getNumber = (field: ImportField, label: string, defaultValue: number | null) => {
      const column = columns.get(field);
      if (column === undefined) return defaultValue;
      const isCurrency = field === 'standardRate' || field === 'senatorRate' || field === 'updatedRate';
      if (isCurrency) {
        assertKztFormat(displayRecords[index]?.[column], rowNumber, label);
      }
      return parseNumber(cells[column], rowNumber, label, isCurrency) ?? defaultValue;
    };

    const oooRooms = getNumber('oooRooms', 'OOO', 0)!;
    const pickupYesterday = getNumber('pickupYesterday', 'Pickup', 0)!;
    const standardRate = getNumber('standardRate', 'Тариф стандарт', 0)!;
    const actualizedOccupancy = getNumber('actualizedOccupancy', 'Ручная загрузка', null);
    const senatorRate = getNumber('senatorRate', 'Тариф SENATOR', null);
    const updatedRate = getNumber('updatedRate', 'Обновленный тариф', null);
    if (![oooRooms, standardRate].every((value) => value >= 0) || !Number.isInteger(oooRooms) || !Number.isInteger(pickupYesterday)) {
      throw new Error(`Строка ${rowNumber}: OOO и Pickup должны быть целыми числами, тарифы — не меньше нуля.`);
    }
    if (oooRooms > totalRooms || roomsSold + oooRooms > totalRooms) {
      throw new Error(`Строка ${rowNumber}: проданные и недоступные номера не могут превышать фонд ${totalRooms}.`);
    }
    if (actualizedOccupancy !== null && (actualizedOccupancy < 0 || actualizedOccupancy > 100)) {
      throw new Error(`Строка ${rowNumber}: ручная загрузка должна быть от 0 до 100%.`);
    }

    const notesColumn = columns.get('notes');
    imported.push({
      date,
      roomsSold,
      oooRooms,
      standardRate,
      pickupYesterday,
      actualizedOccupancy,
      senatorRate,
      updatedRate,
      notes: notesColumn === undefined ? '' : String(cells[notesColumn] ?? ''),
    });
  }

  if (imported.length === 0) throw new Error('В таблице нет строк с данными для импорта.');
  return imported;
}
