'use client';

import React, { useRef, useState } from 'react';
import { DailyMetricInput, DailyMetricRow, CalendarViewMode } from '../lib/types';
import { getOccupancyStyles } from '../lib/calculations';
import { 
  FileSpreadsheet, 
  Percent, 
  Tag, 
  Layers,
  ChevronLeft,
  ChevronRight,
  Upload,
  RefreshCw,
  Loader2,
} from 'lucide-react';

type EditableField =
  | 'roomsSold'
  | 'oooRooms'
  | 'standardRate'
  | 'pickupYesterday'
  | 'actualizedOccupancy'
  | 'senatorRate'
  | 'updatedRate'
  | 'notes';

interface EditableCellProps {
  row: DailyMetricInput;
  totalRooms: number;
  field: EditableField;
  value: string | number | null;
  onSave: (updated: DailyMetricInput) => Promise<void>;
  placeholder?: string;
}

const EditableCell: React.FC<EditableCellProps> = ({ row, totalRooms, field, value, onSave, placeholder }) => {
  const [draft, setDraft] = useState(String(value ?? ''));
  const [hasError, setHasError] = useState(false);

  React.useEffect(() => {
    setDraft(String(value ?? ''));
    setHasError(false);
  }, [value]);

  const commit = async () => {
    const nullable = field === 'actualizedOccupancy' || field === 'senatorRate' || field === 'updatedRate';
    let nextValue: string | number | null;
    if (field === 'notes') {
      nextValue = draft;
    } else if (draft.trim() === '' && nullable) {
      nextValue = null;
    } else if (draft.trim() === '') {
      setDraft(String(value ?? ''));
      return;
    } else {
      nextValue = Number(draft);
      if (!Number.isFinite(nextValue)) {
        setHasError(true);
        return;
      }
    }

    if (nextValue === value) return;
    const updated: DailyMetricInput = { ...row };
    if (field === 'notes') {
      updated.notes = String(nextValue);
    } else {
      const numericValue = nextValue === null ? null : Number(nextValue);
      switch (field) {
        case 'roomsSold':
          updated.roomsSold = numericValue ?? 0;
          break;
        case 'oooRooms':
          updated.oooRooms = numericValue ?? 0;
          break;
        case 'standardRate':
          updated.standardRate = numericValue ?? 0;
          break;
        case 'pickupYesterday':
          updated.pickupYesterday = numericValue ?? 0;
          break;
        case 'actualizedOccupancy':
          updated.actualizedOccupancy = numericValue;
          break;
        case 'senatorRate':
          updated.senatorRate = numericValue;
          break;
        case 'updatedRate':
          updated.updatedRate = numericValue;
          break;
      }
    }
    if (
      updated.roomsSold > totalRooms - updated.oooRooms ||
      updated.oooRooms > totalRooms ||
      (field === 'actualizedOccupancy' &&
        updated.actualizedOccupancy != null &&
        (updated.actualizedOccupancy < 0 || updated.actualizedOccupancy > 100)) ||
      (typeof nextValue === 'number' &&
        field !== 'pickupYesterday' &&
        nextValue < 0)
    ) {
      setHasError(true);
      return;
    }
    try {
      await onSave(updated);
      setHasError(false);
    } catch {
      setHasError(true);
    }
  };

  return (
    <input
      type={field === 'notes' ? 'text' : 'number'}
      min={field === 'roomsSold' || field === 'oooRooms' || field === 'standardRate' || field === 'senatorRate' || field === 'updatedRate' ? 0 : undefined}
      max={field === 'roomsSold' || field === 'oooRooms' ? totalRooms : field === 'actualizedOccupancy' ? 100 : undefined}
      step={field === 'actualizedOccupancy' ? '0.1' : field === 'standardRate' || field === 'senatorRate' || field === 'updatedRate' ? '50' : '1'}
      value={draft}
      placeholder={placeholder}
      title={hasError ? 'Не удалось сохранить значение. Проверьте его и повторите.' : 'Вводится вручную; сохранение после выхода из ячейки'}
      aria-label={`${field} за ${row.date}`}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => { void commit(); }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          setDraft(String(value ?? ''));
          event.currentTarget.blur();
        }
      }}
      className={`w-full min-w-[72px] max-w-[150px] rounded px-1.5 py-1 text-center text-xs tabular-nums text-blue-900 dark:text-blue-100 bg-blue-50 dark:bg-blue-950/30 border ${
        hasError
          ? 'border-red-400'
          : 'border-blue-200 dark:border-blue-800 focus:border-blue-500'
      } focus:outline-none focus:ring-1 focus:ring-blue-500`}
    />
  );
};

interface CalendarGridProps {
  data: DailyMetricRow[];
  totalRooms: number;
  currency: string;
  onSaveCell: (updated: DailyMetricInput) => Promise<void>;
  importMessage: string | null;
  importError: string | null;
  isImporting: boolean;
  onImportFile: (file: File) => void;
  onFetchGoogleRates: (year: number, month: number) => void;
  isFetchingGoogleRates: boolean;
  googleRatesMessage: string | null;
  googleRatesError: string | null;
}

function createEmptyMetric(date: string): DailyMetricInput {
  return {
    date,
    roomsSold: 0,
    oooRooms: 0,
    standardRate: 0,
    pickupYesterday: 0,
    actualizedOccupancy: null,
    senatorRate: null,
    updatedRate: null,
    notes: '',
  };
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  data,
  totalRooms,
  currency,
  onSaveCell,
  importMessage,
  importError,
  isImporting,
  onImportFile,
  onFetchGoogleRates,
  isFetchingGoogleRates,
  googleRatesMessage,
  googleRatesError,
}) => {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('all');
  const importInputRef = useRef<HTMLInputElement>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const firstDate = data[0]?.date;
    if (!firstDate) return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [year, month] = firstDate.split('-').map(Number);
    return new Date(year, month - 1, 1);
  });

  // Экспорт данных в CSV (для совместимости с Excel)
  const handleExportCSV = () => {
    const headers = [
      'Дата',
      'День недели',
      'Продано номеров',
      'Доступный фонд',
      '% Загрузки',
      'Тариф стандарт (₸)',
      'Забронировано вчера (Pickup)',
      'Актуализированный %',
      'Тариф SENATOR (₸)',
      'Номера OOO',
      'Обновленный тариф (₸)',
      'Выручка (₸)',
      'ADR (₸)',
      'RevPAR (₸)',
    ];

    const rows = data.map((r) => [
      r.date,
      r.dayOfWeek,
      r.roomsSold,
      r.availableRooms,
      `${r.effectiveOccupancy}%`,
      r.standardRate,
      r.pickupYesterday,
      r.actualizedOccupancy ?? r.calculatedOccupancy,
      r.senatorRate ?? '-',
      r.oooRooms,
      r.updatedRate ?? r.standardRate,
      r.revenue,
      r.adr,
      r.revpar,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `hotel_revenue_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dates = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    return {
      date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      day,
      dayOfWeek: new Date(year, month, day).getDay(),
    };
  });
  const rowsByDate = new Map(data.map((row) => [row.date, row]));
  const monthLabel = new Intl.DateTimeFormat('ru-RU', {
    month: 'long',
    year: 'numeric',
  }).format(currentMonth);

  const metricRows: {
    label: string;
    visible: boolean;
    kind: 'manual' | 'computed';
    field?: EditableField;
    value?: (row: DailyMetricRow) => string | number | null;
    render: (row: DailyMetricRow) => React.ReactNode;
    formula?: string;
  }[] = [
    {
      label: 'Продано номеров',
      visible: viewMode === 'all' || viewMode === 'occupancy',
      kind: 'manual',
      field: 'roomsSold',
      value: (row) => row.roomsSold,
      render: (row) => row.roomsSold,
    },
    {
      label: 'Номера OOO',
      visible: viewMode === 'all' || viewMode === 'occupancy',
      kind: 'manual',
      field: 'oooRooms',
      value: (row) => row.oooRooms,
      render: (row) => row.oooRooms,
    },
    {
      label: 'Тариф стандарт',
      visible: viewMode === 'all' || viewMode === 'rates',
      kind: 'manual',
      field: 'standardRate',
      value: (row) => row.standardRate,
      render: (row) => `${row.standardRate.toLocaleString('ru-RU')} ${currency}`,
    },
    {
      label: 'Pickup за день',
      visible: viewMode === 'all' || viewMode === 'occupancy',
      kind: 'manual',
      field: 'pickupYesterday',
      value: (row) => row.pickupYesterday,
      render: (row) => row.pickupYesterday,
    },
    {
      label: 'Ручная загрузка (%)',
      visible: viewMode === 'all' || viewMode === 'occupancy',
      kind: 'manual',
      field: 'actualizedOccupancy',
      value: (row) => row.actualizedOccupancy ?? null,
      render: (row) => row.actualizedOccupancy ?? '',
    },
    {
      label: 'Тариф SENATOR',
      visible: viewMode === 'all' || viewMode === 'rates',
      kind: 'manual',
      field: 'senatorRate',
      value: (row) => row.senatorRate ?? null,
      render: (row) => row.senatorRate
        ? `${row.senatorRate.toLocaleString('ru-RU')} ${currency}`
        : <span className="text-slate-300 dark:text-slate-600">—</span>,
    },
    {
      label: 'Обновленный тариф',
      visible: viewMode === 'all' || viewMode === 'rates',
      kind: 'manual',
      field: 'updatedRate',
      value: (row) => row.updatedRate ?? null,
      render: (row) => `${(row.updatedRate ?? row.standardRate).toLocaleString('ru-RU')} ${currency}`,
    },
    {
      label: `Доступно (фонд ${totalRooms} − OOO)`,
      visible: viewMode === 'all' || viewMode === 'occupancy',
      kind: 'computed',
      render: (row) => row.availableRooms,
      formula: `Общий фонд ${totalRooms} − номера OOO`,
    },
    {
      label: 'Загрузка (расчет)',
      visible: viewMode === 'all' || viewMode === 'occupancy',
      kind: 'computed',
      render: (row) => `${row.calculatedOccupancy}%`,
      formula: 'Продано номеров ÷ доступный фонд × 100%',
    },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Режим:</span>
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5 text-xs font-medium">
              {([
                ['all', 'Все данные', Layers],
                ['occupancy', 'Загрузка %', Percent],
                ['rates', 'Тарифы', Tag],
              ] as const).map(([mode, label, Icon]) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                    viewMode === mode
                      ? 'bg-slate-900 text-white dark:bg-blue-600 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1">
            <button
              onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
              className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              aria-label="Предыдущий месяц"
              title="Предыдущий месяц"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="min-w-32 text-center text-sm font-semibold capitalize text-slate-800 dark:text-slate-100">
              {monthLabel}
            </span>
            <button
              onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
              className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              aria-label="Следующий месяц"
              title="Следующий месяц"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => onFetchGoogleRates(year, month + 1)}
            disabled={isFetchingGoogleRates}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition disabled:opacity-50"
            title="Официальный тариф из Google Travel, иначе минимальный тариф партнёров. Обновит значения за выбранный месяц."
          >
            {isFetchingGoogleRates
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <RefreshCw className="w-4 h-4" />}
            {isFetchingGoogleRates ? 'Поиск тарифов...' : 'Обновить тарифы Google'}
          </button>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />≤30%</span>
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />31-70%</span>
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />&gt;70%</span>
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            title="Экспорт в Excel / CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Экспорт Excel
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onImportFile(file);
              event.target.value = '';
            }}
          />
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
            title="Импортировать CSV или Excel"
          >
            <Upload className="w-4 h-4" />
            {isImporting ? 'Импорт...' : 'Импорт CSV / Excel'}
          </button>
        </div>
      </div>

      {(importMessage || importError) && (
        <div className={`px-4 py-2 text-xs border-b ${
          importError
            ? 'text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/30 dark:border-red-900'
            : 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-900'
        }`}>
          {importError ?? importMessage}
        </div>
      )}

      {(googleRatesMessage || googleRatesError) && (
        <div
          role={googleRatesError ? 'alert' : 'status'}
          className={`px-4 py-2 text-xs border-b ${
            googleRatesError
              ? 'text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/30 dark:border-red-900'
              : 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-900'
          }`}
        >
          {googleRatesError ?? googleRatesMessage}
        </div>
      )}

      <div className="px-4 py-2 text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
        «Тариф стандарт» можно обновить из Google Travel; остальные синие ячейки вводятся вручную и сохраняются после выхода из поля. Серые показатели рассчитываются автоматически. Импорт CSV / Excel остаётся доступен.
      </div>

      <div className="overflow-x-auto relative max-h-[620px] scrollbar-thin">
        <table className="min-w-max w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-[11px]">
            <tr>
              <th className="py-3 px-3 sticky left-0 z-30 min-w-48 bg-slate-100 dark:bg-slate-800 shadow-[1px_0_0_0_#e2e8f0]">
                Показатель
              </th>
              {dates.map(({ date, day, dayOfWeek }) => {
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                return (
                  <th
                    key={date}
                    className={`py-2 px-2 text-center min-w-[82px] ${
                      isWeekend ? 'text-rose-600 dark:text-rose-400' : ''
                    }`}
                  >
                    <div>{String(day).padStart(2, '0')}.{String(month + 1).padStart(2, '0')}</div>
                    <div className="mt-1 text-[10px] font-medium normal-case">
                      {['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][dayOfWeek]}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
            <tr>
              <th colSpan={dates.length + 1} className="sticky left-0 py-2 px-3 text-left text-[10px] uppercase tracking-wider text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30">
                Вводимые вручную данные
              </th>
            </tr>
            {metricRows.filter((metric) => metric.visible && metric.kind === 'manual').map((metric) => (
              <tr key={metric.label} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/60">
                <th className="py-2.5 px-3 text-left sticky left-0 z-10 min-w-48 bg-blue-50/70 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200 shadow-[1px_0_0_0_#bfdbfe] dark:shadow-[1px_0_0_0_#1e3a8a]">
                  {metric.label}
                </th>
                {dates.map(({ date, dayOfWeek }) => {
                  const row = rowsByDate.get(date);
                  return (
                    <td key={date} className={`py-2 px-1 text-center whitespace-nowrap bg-blue-50/20 dark:bg-blue-950/10 ${
                      dayOfWeek === 0 || dayOfWeek === 6 ? 'bg-blue-100/30 dark:bg-blue-900/20' : ''
                    }`}>
                      {metric.field && metric.value ? (
                        <EditableCell
                          row={row ?? createEmptyMetric(date)}
                          totalRooms={totalRooms}
                          field={metric.field}
                          value={row ? metric.value(row) : null}
                          placeholder={metric.field === 'actualizedOccupancy' ? (row ? `Авто ${row.calculatedOccupancy}%` : 'Авто') : undefined}
                          onSave={onSaveCell}
                        />
                      ) : row ? metric.render(row) : <span className="text-slate-300 dark:text-slate-700">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <th colSpan={dates.length + 1} className="sticky left-0 py-2 px-3 text-left text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800">
                Рассчитывается автоматически
              </th>
            </tr>
            {metricRows.filter((metric) => metric.visible && metric.kind === 'computed').map((metric) => (
              <tr key={metric.label} className="hover:bg-slate-100/70 dark:hover:bg-slate-800/60">
                <th className="py-2.5 px-3 text-left sticky left-0 z-10 min-w-48 bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 shadow-[1px_0_0_0_#e2e8f0] dark:shadow-[1px_0_0_0_#1e293b]">
                  {metric.label}
                </th>
                {dates.map(({ date, dayOfWeek }) => {
                  const row = rowsByDate.get(date);
                  return (
                    <td
                      key={date}
                      title={metric.formula}
                      className={`py-2.5 px-2 text-center whitespace-nowrap bg-slate-50/40 dark:bg-slate-800/20 ${
                        dayOfWeek === 0 || dayOfWeek === 6 ? 'bg-slate-100/60 dark:bg-slate-800/40' : ''
                      }`}
                    >
                      {row ? metric.render(row) : <span className="text-slate-300 dark:text-slate-700">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
