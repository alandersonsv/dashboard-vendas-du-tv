import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { VendasHoraRecord } from '../types';
import { Flame, Clock, Calendar, HelpCircle, Layers, Filter, Sparkles, BarChart2 } from 'lucide-react';

interface VendasHoraHeatmapProps {
  rawData: VendasHoraRecord[];
  selectedMonthKey: string; // e.g. "2026-08"
  isLoading?: boolean;
}

type ViewMode = 'days' | 'weekdays';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const WEEKDAYS_ORDER = [
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
  'Domingo',
];

const WEEKDAY_SHORT: Record<string, string> = {
  'Segunda-feira': 'Seg',
  'Terça-feira': 'Ter',
  'Quarta-feira': 'Qua',
  'Quinta-feira': 'Qui',
  'Sexta-feira': 'Sex',
  'Sábado': 'Sáb',
  'Domingo': 'Dom',
};

// Definition of structured motives and groups
export interface MotivoItem {
  key: string;
  label: string;
  code?: string;
  tag?: string;
}

export const MOTIVOS_CNH: MotivoItem[] = [
  { key: 'CNH - Renovação', label: 'CNH - Renovação', code: 'R', tag: 'Renovação' },
  { key: 'CNH - Exame Periódico', label: 'CNH - Exame Periódico', code: 'W', tag: 'Periódico' },
  { key: 'CNH - Periódico', label: 'CNH - Periódico', code: 'K', tag: 'Periódico' },
  { key: 'CNH - Primeira Habilitação A e B', label: 'CNH - Primeira Habilitação A e B', code: 'C', tag: 'Emissão' },
  { key: 'CNH - Mudança de categoria', label: 'CNH - Mudança de categoria', code: 'H', tag: 'Mudança' },
];

export const MOTIVOS_CLT: MotivoItem[] = [
  { key: 'Admissão', label: 'Admissão', code: 'A', tag: 'B2B' },
  { key: 'Demissional', label: 'Demissional', code: 'D', tag: 'B2B' },
  { key: 'Randômico', label: 'Randômico', code: 'N', tag: 'B2B' },
  { key: 'CLT - Retorno ao Trabalho', label: 'CLT - Retorno ao Trabalho', code: 'T', tag: 'B2B' },
  { key: 'CLT - Mudança de Função', label: 'CLT - Mudança de Função', code: 'F', tag: 'B2B' },
  { key: 'CLT + CNH', label: 'CLT + CNH', code: 'G', tag: 'B2B' },
];

export const MOTIVOS_OUTROS: MotivoItem[] = [
  { key: 'Outro - Uso Pessoal', label: 'Outro - Uso Pessoal', code: 'P', tag: 'Outros' },
  { key: 'Outro - Investigação Pessoal', label: 'Outro - Investigação Pessoal', code: 'I', tag: 'Outros' },
  { key: 'Outro - Menor de Idade', label: 'Outro - Menor de Idade', code: 'M', tag: 'Outros' },
  { key: 'Outros', label: 'Outros', code: 'E', tag: 'Outros' },
];

const ALL_SPECIFIC_MOTIVOS = [...MOTIVOS_CNH, ...MOTIVOS_CLT, ...MOTIVOS_OUTROS];

const normalizeMotivoKey = (str: string): string =>
  str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

// Helper to extract specific motivo value from record
function getRecordMotivoValue(r: VendasHoraRecord, key: string): number {
  if (r[key] !== undefined && r[key] !== null) {
    return Number(r[key]) || 0;
  }

  const targetNormalized = normalizeMotivoKey(key);

  for (const [k, v] of Object.entries(r)) {
    if (v === undefined || v === null) continue;
    if (normalizeMotivoKey(k) === targetNormalized) {
      return Number(v) || 0;
    }
  }

  return 0;
}

// Master number extractor helper tolerant to multiple key aliases
function getRecordNumber(r: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const val = r[k];
    if (val !== undefined && val !== null && val !== '') {
      const n = Number(val);
      if (!isNaN(n)) return n;
    }
  }
  return 0;
}

// Master value extractor for any selected metric key
function extractMetricValue(r: VendasHoraRecord, metricKey: string): number {
  const rec = r as Record<string, unknown>;
  if (metricKey === 'total') {
    return getRecordNumber(
      rec,
      'Vendas_Total',
      'vendas_total',
      'VendasTotal',
      'vendasTotal',
      'vendas_totais',
      'Vendas_Totais',
      'Total_Vendas',
      'total_vendas',
      'Total',
      'total'
    );
  }
  if (metricKey === 'b2c') {
    return getRecordNumber(
      rec,
      'Vendas_B2C',
      'vendas_b2c',
      'VendasB2C',
      'vendasB2c',
      'vendas_total_b2c',
      'B2C',
      'b2c'
    );
  }
  if (metricKey === 'b2b') {
    return getRecordNumber(
      rec,
      'Vendas_B2B',
      'vendas_b2b',
      'VendasB2B',
      'vendasB2b',
      'vendas_total_b2b',
      'B2B',
      'b2b'
    );
  }
  if (metricKey === 'CNH_ALL') {
    return MOTIVOS_CNH.reduce((acc, m) => acc + getRecordMotivoValue(r, m.key), 0);
  }
  if (metricKey === 'CLT_ALL') {
    return MOTIVOS_CLT.reduce((acc, m) => acc + getRecordMotivoValue(r, m.key), 0);
  }
  if (metricKey === 'OUTROS_ALL') {
    return MOTIVOS_OUTROS.reduce((acc, m) => acc + getRecordMotivoValue(r, m.key), 0);
  }
  return getRecordMotivoValue(r, metricKey);
}

// Helper to get friendly metric label
function getMetricLabel(metricKey: string): string {
  if (metricKey === 'total') return 'Vendas Totais';
  if (metricKey === 'b2c') return 'Vendas B2C';
  if (metricKey === 'b2b') return 'Vendas B2B';
  if (metricKey === 'CNH_ALL') return 'Grupo CNH (Todos os Motivos)';
  if (metricKey === 'CLT_ALL') return 'Grupo CLT & B2B (Todos os Motivos)';
  if (metricKey === 'OUTROS_ALL') return 'Grupo Outros (Todos os Motivos)';
  const matched = ALL_SPECIFIC_MOTIVOS.find((m) => m.key === metricKey);
  return matched ? matched.label : metricKey;
}

// Helper to parse dates strictly and reliably from raw API records
function parseRecordDate(r: VendasHoraRecord): {
  yearMonth: string;
  dateKey: string;
  dateBR: string;
  dayNum: number;
  weekday: string;
} | null {
  let yearMonth = '';
  let dateKey = '';
  let dateBR = '';

  // 1. Check DataBR (e.g. "31/07/2026") - explicit date of sale
  const rawDataBR = r.DataBR || r.databr;
  if (rawDataBR && typeof rawDataBR === 'string') {
    const matchBR = rawDataBR.trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (matchBR) {
      const d = matchBR[1].padStart(2, '0');
      const m = matchBR[2].padStart(2, '0');
      const y = matchBR[3];
      dateKey = `${y}-${m}-${d}`;
      dateBR = `${d}/${m}/${y}`;
      yearMonth = `${y}-${m}`;
    }
  }

  // 2. Check Data (e.g. "2026-07-31T03:00:00.000Z" or "2026-05-01")
  const rawData = r.Data || r.data;
  if (rawData && typeof rawData === 'string') {
    const clean = rawData.trim();
    const matchISO = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (matchISO) {
      const y = matchISO[1];
      const m = matchISO[2].padStart(2, '0');
      const d = matchISO[3].padStart(2, '0');
      if (!dateKey) dateKey = `${y}-${m}-${d}`;
      if (!dateBR) dateBR = `${d}/${m}/${y}`;
      if (!yearMonth) yearMonth = `${y}-${m}`;
    }
  }

  // 3. Check AnoMes (e.g. "2026-07")
  const rawAM = r.AnoMes || r.anomes || (r as Record<string, unknown>).Ano_Mes || (r as Record<string, unknown>).ano_mes;
  if (rawAM && typeof rawAM === 'string') {
    const clean = rawAM.trim();
    if (/^\d{4}-\d{2}$/.test(clean)) {
      yearMonth = clean;
    } else if (/^\d{4}\/\d{2}$/.test(clean)) {
      yearMonth = clean.replace('/', '-');
    }
  }

  // 4. Fallback for DataReferencia if BR format
  if (!dateKey) {
    const rawRef = r.DataReferencia || r.datareferencia;
    if (rawRef && typeof rawRef === 'string') {
      const matchBR = rawRef.trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
      if (matchBR) {
        const d = matchBR[1].padStart(2, '0');
        const m = matchBR[2].padStart(2, '0');
        const y = matchBR[3];
        dateKey = `${y}-${m}-${d}`;
        dateBR = `${d}/${m}/${y}`;
        if (!yearMonth) yearMonth = `${y}-${m}`;
      }
    }
  }

  if (!dateKey && yearMonth) {
    dateKey = `${yearMonth}-01`;
    dateBR = `01/${yearMonth.slice(5, 7)}/${yearMonth.slice(0, 4)}`;
  }

  if (!dateKey || !yearMonth) return null;

  const parts = dateKey.split('-');
  const dayNum = parseInt(parts[2], 10) || 1;

  let weekday = r.DiaSemana || r.diasemana || '';
  if (!weekday) {
    try {
      const dt = new Date(`${dateKey}T12:00:00`);
      weekday = dt.toLocaleDateString('pt-BR', { weekday: 'long' });
      weekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    } catch {
      weekday = '';
    }
  }

  return {
    yearMonth,
    dateKey,
    dateBR,
    dayNum,
    weekday,
  };
}

export interface CellInspectionData {
  dateLabel: string;
  weekday: string;
  hour: number;
  value: number;
  totalDay: number;
  accumulatedDay: number;
  vendasTotal: number;
  vendasB2c: number;
  vendasB2b: number;
  topMotivos: { label: string; val: number }[];
  x?: number;
  y?: number;
}

export const VendasHoraHeatmap: React.FC<VendasHoraHeatmapProps> = ({
  rawData,
  selectedMonthKey,
  isLoading = false,
}) => {
  const [metric, setMetric] = useState<string>('total');
  const [viewMode, setViewMode] = useState<ViewMode>('weekdays');
  const [hoveredCell, setHoveredCell] = useState<CellInspectionData | null>(null);

  // Extract all available months present in the raw data
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    (rawData || []).forEach((r) => {
      const parsed = parseRecordDate(r);
      if (parsed?.yearMonth) set.add(parsed.yearMonth);
    });
    return Array.from(set).sort().reverse();
  }, [rawData]);

  // Selected Month Key for the Heatmap (defaults to selectedMonthKey or the latest available month in heatmap dataset)
  const [internalMonthKey, setInternalMonthKey] = useState<string>('');

  const activeMonthKey = useMemo(() => {
    if (internalMonthKey && availableMonths.includes(internalMonthKey)) {
      return internalMonthKey;
    }
    if (selectedMonthKey && availableMonths.includes(selectedMonthKey)) {
      return selectedMonthKey;
    }
    return availableMonths[0] || selectedMonthKey || '';
  }, [internalMonthKey, selectedMonthKey, availableMonths]);

  // Normalize and filter data strictly for the active month
  const monthRows = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];
    if (!activeMonthKey) return [];

    return rawData.filter((r) => {
      const parsed = parseRecordDate(r);
      return parsed !== null && parsed.yearMonth === activeMonthKey;
    });
  }, [rawData, activeMonthKey]);

  const effectiveRows = monthRows;

  // Group by date (days matrix for the selected month)
  const daysMatrix = useMemo(() => {
    const map = new Map<
      string,
      {
        dateStr: string;
        dateBR: string;
        weekday: string;
        dayNum: number;
        hours: Record<
          number,
          {
            val: number;
            total: number;
            b2c: number;
            b2b: number;
            motivos: Record<string, number>;
          }
        >;
        totalSales: number;
      }
    >();

    effectiveRows.forEach((r) => {
      const parsed = parseRecordDate(r);
      if (!parsed) return;

      const { dateKey, dateBR, weekday, dayNum } = parsed;
      const hour = Number(r.Hora ?? r.hora ?? 0);
      if (hour < 0 || hour > 23) return;

      if (!map.has(dateKey)) {
        map.set(dateKey, {
          dateStr: dateKey,
          dateBR,
          weekday,
          dayNum,
          hours: {},
          totalSales: 0,
        });
      }

      const entry = map.get(dateKey)!;
      const vTot = getRecordNumber(
        r as Record<string, unknown>,
        'Vendas_Total',
        'vendas_total',
        'VendasTotal',
        'vendasTotal',
        'vendas_totais',
        'Vendas_Totais',
        'Total_Vendas',
        'total_vendas',
        'Total',
        'total'
      );
      const vB2c = getRecordNumber(
        r as Record<string, unknown>,
        'Vendas_B2C',
        'vendas_b2c',
        'VendasB2C',
        'vendasB2c',
        'vendas_total_b2c',
        'B2C',
        'b2c'
      );
      const vB2b = getRecordNumber(
        r as Record<string, unknown>,
        'Vendas_B2B',
        'vendas_b2b',
        'VendasB2B',
        'vendasB2b',
        'vendas_total_b2b',
        'B2B',
        'b2b'
      );
      const val = extractMetricValue(r, metric);

      // Collect specific motivos breakdown for tooltip
      const motivosBreakdown: Record<string, number> = {};
      ALL_SPECIFIC_MOTIVOS.forEach((m) => {
        const mv = getRecordMotivoValue(r, m.key);
        if (mv > 0) motivosBreakdown[m.label] = mv;
      });

      if (!entry.hours[hour]) {
        entry.hours[hour] = {
          val: 0,
          total: 0,
          b2c: 0,
          b2b: 0,
          motivos: {},
        };
      }

      entry.hours[hour].val += val;
      entry.hours[hour].total += vTot;
      entry.hours[hour].b2c += vB2c;
      entry.hours[hour].b2b += vB2b;
      Object.entries(motivosBreakdown).forEach(([mName, mv]) => {
        entry.hours[hour].motivos[mName] = (entry.hours[hour].motivos[mName] || 0) + mv;
      });
    });

    // Compute exact daily total as sum of 24 hours
    map.forEach((entry) => {
      entry.totalSales = Object.values(entry.hours).reduce((acc, h) => acc + (h.val || 0), 0);
    });

    // Sort by date key ascending (e.g. 2026-08-01 to 2026-08-31)
    return Array.from(map.values()).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [effectiveRows, metric]);

  // Group by Weekday Average matrix
  const weekdayMatrix = useMemo(() => {
    const map = new Map<
      string,
      {
        weekday: string;
        dayCounts: Record<number, number>;
        hourSums: Record<
          number,
          {
            val: number;
            total: number;
            b2c: number;
            b2b: number;
            motivos: Record<string, number>;
          }
        >;
        totalAvg: number;
      }
    >();

    const distinctDatesPerWeekday: Record<string, Set<string>> = {};
    WEEKDAYS_ORDER.forEach((w) => {
      distinctDatesPerWeekday[w] = new Set();
      map.set(w, {
        weekday: w,
        dayCounts: {},
        hourSums: {},
        totalAvg: 0,
      });
    });

    effectiveRows.forEach((r) => {
      const parsed = parseRecordDate(r);
      if (!parsed) return;

      const matchedW = WEEKDAYS_ORDER.find(
        (w) => w.toLowerCase().replace('-feira', '') === parsed.weekday.toLowerCase().replace('-feira', '')
      );
      if (!matchedW) return;

      distinctDatesPerWeekday[matchedW].add(parsed.dateKey);

      const hour = Number(r.Hora ?? r.hora ?? 0);
      if (hour < 0 || hour > 23) return;

      const vTot = getRecordNumber(
        r as Record<string, unknown>,
        'Vendas_Total',
        'vendas_total',
        'VendasTotal',
        'vendasTotal',
        'vendas_totais',
        'Vendas_Totais',
        'Total_Vendas',
        'total_vendas',
        'Total',
        'total'
      );
      const vB2c = getRecordNumber(
        r as Record<string, unknown>,
        'Vendas_B2C',
        'vendas_b2c',
        'VendasB2C',
        'vendasB2c',
        'vendas_total_b2c',
        'B2C',
        'b2c'
      );
      const vB2b = getRecordNumber(
        r as Record<string, unknown>,
        'Vendas_B2B',
        'vendas_b2b',
        'VendasB2B',
        'vendasB2b',
        'vendas_total_b2b',
        'B2B',
        'b2b'
      );
      const val = extractMetricValue(r, metric);

      const entry = map.get(matchedW)!;
      if (!entry.hourSums[hour]) {
        entry.hourSums[hour] = { val: 0, total: 0, b2c: 0, b2b: 0, motivos: {} };
        entry.dayCounts[hour] = 0;
      }

      entry.hourSums[hour].val += val;
      entry.hourSums[hour].total += vTot;
      entry.hourSums[hour].b2c += vB2c;
      entry.hourSums[hour].b2b += vB2b;

      ALL_SPECIFIC_MOTIVOS.forEach((m) => {
        const mv = getRecordMotivoValue(r, m.key);
        if (mv > 0) {
          entry.hourSums[hour].motivos[m.label] = (entry.hourSums[hour].motivos[m.label] || 0) + mv;
        }
      });

      entry.dayCounts[hour] += 1;
    });

    return WEEKDAYS_ORDER.map((w) => {
      const item = map.get(w)!;
      const numDays = distinctDatesPerWeekday[w]?.size || 1;
      const hoursAverages: Record<
        number,
        {
          val: number;
          total: number;
          b2c: number;
          b2b: number;
          motivos: Record<string, number>;
        }
      > = {};
      let sumAvg = 0;

      HOURS.forEach((h) => {
        const sums = item.hourSums[h] || { val: 0, total: 0, b2c: 0, b2b: 0, motivos: {} };
        const avgVal = sums.val / numDays;
        const avgTot = sums.total / numDays;
        const avgB2c = sums.b2c / numDays;
        const avgB2b = sums.b2b / numDays;

        const avgMotivos: Record<string, number> = {};
        Object.entries(sums.motivos || {}).forEach(([mName, mSum]) => {
          avgMotivos[mName] = Math.round(mSum / numDays);
        });

        hoursAverages[h] = {
          val: Math.round(avgVal),
          total: Math.round(avgTot),
          b2c: Math.round(avgB2c),
          b2b: Math.round(avgB2b),
          motivos: avgMotivos,
        };

        sumAvg += avgVal;
      });

      return {
        weekday: w,
        hours: hoursAverages,
        totalAvg: Math.round(sumAvg),
      };
    });
  }, [effectiveRows, metric]);

  // Find max value in current view to scale color opacity
  const maxVal = useMemo(() => {
    let max = 0;
    if (viewMode === 'days') {
      daysMatrix.forEach((d) => {
        HOURS.forEach((h) => {
          const val = d.hours[h]?.val || 0;
          if (val > max) max = val;
        });
      });
    } else {
      weekdayMatrix.forEach((w) => {
        HOURS.forEach((h) => {
          const val = w.hours[h]?.val || 0;
          if (val > max) max = val;
        });
      });
    }
    return max > 0 ? max : 1;
  }, [daysMatrix, weekdayMatrix, viewMode]);

  // Hourly Totals across all days (for bottom distribution bar)
  const hourlyTotals = useMemo(() => {
    const totals: Record<number, number> = {};
    HOURS.forEach((h) => (totals[h] = 0));

    daysMatrix.forEach((d) => {
      HOURS.forEach((h) => {
        totals[h] += d.hours[h]?.val || 0;
      });
    });

    return totals;
  }, [daysMatrix]);

  const maxHourlyTotal = useMemo(() => {
    const vals = Object.values(hourlyTotals) as number[];
    return Math.max(...vals, 1);
  }, [hourlyTotals]);

  // Key Insights Summary
  const insights = useMemo(() => {
    let peakHour = 0;
    let peakHourVolume = 0;

    HOURS.forEach((h) => {
      if (hourlyTotals[h] > peakHourVolume) {
        peakHourVolume = hourlyTotals[h];
        peakHour = h;
      }
    });

    let bestDayName = '—';
    let bestDayVolume = 0;

    if (viewMode === 'weekdays') {
      weekdayMatrix.forEach((w) => {
        if (w.totalAvg > bestDayVolume) {
          bestDayVolume = w.totalAvg;
          bestDayName = w.weekday;
        }
      });
    } else {
      daysMatrix.forEach((d) => {
        if (d.totalSales > bestDayVolume) {
          bestDayVolume = d.totalSales;
          bestDayName = `${d.dateBR} (${d.weekday})`;
        }
      });
    }

    const totalPeriodSales = daysMatrix.reduce((acc, d) => acc + d.totalSales, 0);

    return {
      peakHour,
      peakHourStr: `${String(peakHour).padStart(2, '0')}:00 - ${String(peakHour + 1).padStart(2, '0')}:00`,
      peakHourVolume,
      bestDayName,
      bestDayVolume,
      totalPeriodSales,
    };
  }, [hourlyTotals, daysMatrix, weekdayMatrix, viewMode]);

  // Heatmap Color Calculator (5 distinct shades of vibrant blue/indigo)
  const getCellColor = (val: number) => {
    if (!val || val === 0) {
      return {
        bg: '#F8FAFC',
        text: '#94A3B8',
        border: '#E2E8F0',
      };
    }

    const ratio = val / maxVal;

    if (ratio < 0.2) {
      return { bg: '#DBEAFE', text: '#1E40AF', border: '#BFDBFE' }; // Level 1: soft blue
    } else if (ratio < 0.45) {
      return { bg: '#93C5FD', text: '#1E3A8A', border: '#60A5FA' }; // Level 2: medium sky blue
    } else if (ratio < 0.7) {
      return { bg: '#3B82F6', text: '#FFFFFF', border: '#2563EB' }; // Level 3: vibrant blue
    } else if (ratio < 0.9) {
      return { bg: '#1D4ED8', text: '#FFFFFF', border: '#1E40AF' }; // Level 4: royal navy
    } else {
      return { bg: '#1E3A8A', text: '#FFFFFF', border: '#172554' }; // Level 5: peak dark blue
    }
  };

  const metricLabel = getMetricLabel(metric);

  return (
    <div className="section" id="sec-heatmap">
      {/* Header & Controls */}
      <div
        className="section-header-row"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '16px',
        }}
      >
        <div>
          <div className="section-heading" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Flame size={22} style={{ color: 'var(--orange)' }} />
            <span>Mapa de Calor</span>
            {activeMonthKey && (
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#2563EB',
                  background: '#EFF6FF',
                  padding: '3px 10px',
                  borderRadius: '16px',
                  border: '1px solid #DBEAFE',
                }}
              >
                Mês: {activeMonthKey}
              </span>
            )}
          </div>
          <p className="section-desc">
            Densidade e picos de conversão ao longo das 24 horas para: <strong style={{ color: 'var(--orange)' }}>{metricLabel}</strong>.
          </p>
        </div>

        {/* View Mode Toggle & Optional Month Switcher */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {availableMonths.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B' }}>Mês:</span>
              <select
                className="filter-select"
                value={activeMonthKey}
                onChange={(e) => setInternalMonthKey(e.target.value)}
                style={{ height: '34px', fontSize: '12px', padding: '0 8px', fontWeight: 600 }}
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="seg-btns">
            <button
              type="button"
              className={`seg-btn ${viewMode === 'days' ? 'active' : ''}`}
              onClick={() => setViewMode('days')}
            >
              <Calendar size={14} />
              <span>Visão Mensal</span>
            </button>
            <button
              type="button"
              className={`seg-btn ${viewMode === 'weekdays' ? 'active' : ''}`}
              onClick={() => setViewMode('weekdays')}
            >
              <Layers size={14} />
              <span>Média Semanal</span>
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Motivos & Categories Filter Bar */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '18px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        {/* Quick Macro Groups */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Filtros Rápidos:
          </span>

          <button
            type="button"
            className={`action-btn ${metric === 'total' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              fontSize: '11.5px',
              padding: '6px 12px',
              borderRadius: '20px',
              background: metric === 'total' ? 'var(--orange)' : '#F8FAFC',
              color: metric === 'total' ? '#FFFFFF' : '#334155',
              borderColor: metric === 'total' ? 'var(--orange)' : '#CBD5E1',
            }}
            onClick={() => setMetric('total')}
          >
            🌐 Total Geral
          </button>

          <button
            type="button"
            className={`action-btn ${metric === 'b2c' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              fontSize: '11.5px',
              padding: '6px 12px',
              borderRadius: '20px',
              background: metric === 'b2c' ? '#2563EB' : '#F8FAFC',
              color: metric === 'b2c' ? '#FFFFFF' : '#334155',
              borderColor: metric === 'b2c' ? '#2563EB' : '#CBD5E1',
            }}
            onClick={() => setMetric('b2c')}
          >
            👨 B2C
          </button>

          <button
            type="button"
            className={`action-btn ${metric === 'b2b' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              fontSize: '11.5px',
              padding: '6px 12px',
              borderRadius: '20px',
              background: metric === 'b2b' ? '#7C3AED' : '#F8FAFC',
              color: metric === 'b2b' ? '#FFFFFF' : '#334155',
              borderColor: metric === 'b2b' ? '#7C3AED' : '#CBD5E1',
            }}
            onClick={() => setMetric('b2b')}
          >
            🏢 B2B
          </button>

          <button
            type="button"
            className={`action-btn ${metric === 'CNH_ALL' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              fontSize: '11.5px',
              padding: '6px 12px',
              borderRadius: '20px',
              background: metric === 'CNH_ALL' ? '#0D9488' : '#F8FAFC',
              color: metric === 'CNH_ALL' ? '#FFFFFF' : '#334155',
              borderColor: metric === 'CNH_ALL' ? '#0D9488' : '#CBD5E1',
            }}
            onClick={() => setMetric('CNH_ALL')}
          >
            🪪 Grupo CNH
          </button>

          <button
            type="button"
            className={`action-btn ${metric === 'CLT_ALL' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              fontSize: '11.5px',
              padding: '6px 12px',
              borderRadius: '20px',
              background: metric === 'CLT_ALL' ? '#C026D3' : '#F8FAFC',
              color: metric === 'CLT_ALL' ? '#FFFFFF' : '#334155',
              borderColor: metric === 'CLT_ALL' ? '#C026D3' : '#CBD5E1',
            }}
            onClick={() => setMetric('CLT_ALL')}
          >
            📋 Grupo CLT & B2B
          </button>

          <button
            type="button"
            className={`action-btn ${metric === 'OUTROS_ALL' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              fontSize: '11.5px',
              padding: '6px 12px',
              borderRadius: '20px',
              background: metric === 'OUTROS_ALL' ? '#475569' : '#F8FAFC',
              color: metric === 'OUTROS_ALL' ? '#FFFFFF' : '#334155',
              borderColor: metric === 'OUTROS_ALL' ? '#475569' : '#CBD5E1',
            }}
            onClick={() => setMetric('OUTROS_ALL')}
          >
            🔍 Outros
          </button>
        </div>

        {/* Structured Dropdown with Optgroups */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 320px', minWidth: '260px' }}>
          <label
            htmlFor="select-motivo-heatmap"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 700,
              color: '#64748B',
              whiteSpace: 'nowrap',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            <Filter size={14} style={{ color: '#64748B', flexShrink: 0 }} />
            <span>Motivo Específico:</span>
          </label>
          <select
            id="select-motivo-heatmap"
            className="filter-select"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            style={{ height: '36px', fontSize: '12.5px', fontWeight: 600, width: '100%', minWidth: '180px' }}
          >
            <optgroup label="── 🌐 TOTAIS GERAIS ──">
              <option value="total">Total Geral (Todas as Vendas)</option>
              <option value="b2c">Total B2C</option>
              <option value="b2b">Total B2B</option>
            </optgroup>

            <optgroup label="── 🪪 GRUPO CNH ──">
              <option value="CNH_ALL">★ Todos os Motivos CNH (Consolidado)</option>
              {MOTIVOS_CNH.map((m) => (
                <option key={m.key} value={m.key}>
                  [{m.code}] {m.label}
                </option>
              ))}
            </optgroup>

            <optgroup label="── 📋 GRUPO CLT & B2B ──">
              <option value="CLT_ALL">★ Todos CLT & B2B (Consolidado)</option>
              {MOTIVOS_CLT.map((m) => (
                <option key={m.key} value={m.key}>
                  [{m.code}] {m.label}
                </option>
              ))}
            </optgroup>

            <optgroup label="── 🔍 OUTROS MOTIVOS ──">
              <option value="OUTROS_ALL">★ Todos os Outros Motivos (Consolidado)</option>
              {MOTIVOS_OUTROS.map((m) => (
                <option key={m.key} value={m.key}>
                  [{m.code}] {m.label}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      {/* Highlights Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: '#EFF6FF',
              color: '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
              Horário com Maior Pico
            </div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
              {insights.peakHourStr}
            </div>
            <div style={{ fontSize: '11.5px', color: '#2563EB', fontWeight: 500 }}>
              {insights.peakHourVolume.toLocaleString('pt-BR')} vendas ({metricLabel})
            </div>
          </div>
        </div>

        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: '#FFF7ED',
              color: '#EA580C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Calendar size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
              Melhor Desempenho
            </div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
              {insights.bestDayName}
            </div>
            <div style={{ fontSize: '11.5px', color: '#EA580C', fontWeight: 500 }}>
              {insights.bestDayVolume.toLocaleString('pt-BR')} vendas {viewMode === 'weekdays' ? 'médias' : 'no dia'}
            </div>
          </div>
        </div>

        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: '#F0FDF4',
              color: '#16A34A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Flame size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
              Total no Mês Filtrado
            </div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
              {insights.totalPeriodSales.toLocaleString('pt-BR')}
            </div>
            <div style={{ fontSize: '11.5px', color: '#16A34A', fontWeight: 500 }}>
              {metricLabel}
            </div>
          </div>
        </div>
      </div>

      {/* Heatmap Card */}
      <div className="table-card" style={{ padding: '20px', background: '#FFFFFF' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748B' }}>
            <div className="refresh-icon" style={{ fontSize: '24px', marginBottom: '8px' }}>↻</div>
            Carregando mapa de calor...
          </div>
        ) : effectiveRows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748B' }}>
            <HelpCircle size={32} style={{ margin: '0 auto 12px', color: '#94A3B8' }} />
            <div style={{ fontWeight: 600, fontSize: '15px', color: '#334155' }}>
              Nenhum registro de vendas por hora encontrado para o mês selecionado
            </div>
            <p style={{ fontSize: '13px', marginTop: '4px', maxWidth: '450px', margin: '4px auto 0', color: '#64748B' }}>
              Os dados de horários e motivos de exames são sincronizados através do webhook do n8n (<code>/webhook/vendas-hora</code>).
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ minWidth: '940px' }}>
              {/* Grid Header: Hours (00h to 23h) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px repeat(24, 1fr) 70px',
                  gap: '4px',
                  alignItems: 'center',
                  paddingBottom: '8px',
                  borderBottom: '1.5px solid #E2E8F0',
                  marginBottom: '8px',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {viewMode === 'days' ? 'Data / Dia' : 'Dia da Semana'}
                </div>
                {HOURS.map((h) => (
                  <div
                    key={h}
                    style={{
                      textAlign: 'center',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#64748B',
                      fontFamily: 'var(--sans)',
                    }}
                  >
                    {String(h).padStart(2, '0')}h
                  </div>
                ))}
                <div style={{ textAlign: 'right', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                  Total
                </div>
              </div>

              {/* Grid Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {viewMode === 'days'
                  ? daysMatrix.map((d) => (
                      <div
                        key={d.dateStr}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '140px repeat(24, 1fr) 70px',
                          gap: '4px',
                          alignItems: 'center',
                        }}
                      >
                        {/* Row Header */}
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#1E293B',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <span style={{ color: 'var(--orange)', fontWeight: 700 }}>
                            {String(d.dayNum).padStart(2, '0')}
                          </span>
                          <span style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 500 }}>
                            {WEEKDAY_SHORT[d.weekday] || d.weekday.slice(0, 3)}
                          </span>
                        </div>

                        {/* 24 Hour Cells */}
                        {HOURS.map((h) => {
                          const hourData = d.hours[h] || { val: 0, total: 0, b2c: 0, b2b: 0, motivos: {} };
                          const val = hourData.val || 0;
                          const colors = getCellColor(val);

                          const topMotivos = (Object.entries(hourData.motivos || {}) as [string, number][])
                            .filter(([, mv]) => mv > 0)
                            .sort((a, b) => b[1] - a[1])
                            .map(([mLabel, mv]) => ({ label: mLabel, val: mv }));

                          let accumulatedDay = 0;
                          for (let i = 0; i <= h; i++) {
                            accumulatedDay += d.hours[i]?.total || 0;
                          }

                          const cellData: CellInspectionData = {
                            dateLabel: d.dateBR,
                            weekday: d.weekday,
                            hour: h,
                            value: val,
                            totalDay: d.totalSales,
                            accumulatedDay,
                            vendasTotal: hourData.total,
                            vendasB2c: hourData.b2c,
                            vendasB2b: hourData.b2b,
                            topMotivos,
                          };

                          const isHovered = hoveredCell?.hour === h && hoveredCell?.dateLabel === d.dateBR;

                          return (
                            <div
                              key={h}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoveredCell({
                                  ...cellData,
                                  x: rect.left + rect.width / 2,
                                  y: rect.top,
                                });
                              }}
                              onMouseLeave={() => setHoveredCell(null)}
                              style={{
                                height: '28px',
                                background: colors.bg,
                                color: colors.text,
                                border: isHovered ? '2px solid #0284C7' : `1px solid ${colors.border}`,
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: val > 0 ? 700 : 400,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                transform: isHovered ? 'scale(1.18)' : 'none',
                                zIndex: isHovered ? 10 : 1,
                                boxShadow: isHovered ? '0 6px 16px rgba(0,0,0,0.25)' : 'none',
                              }}
                            >
                              {val > 0 ? val : ''}
                            </div>
                          );
                        })}

                        {/* Row Total */}
                        <div
                          style={{
                            textAlign: 'right',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: d.totalSales > 0 ? 'var(--blue)' : '#94A3B8',
                          }}
                        >
                          {d.totalSales}
                        </div>
                      </div>
                    ))
                  : weekdayMatrix.map((w) => (
                      <div
                        key={w.weekday}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '140px repeat(24, 1fr) 70px',
                          gap: '4px',
                          alignItems: 'center',
                        }}
                      >
                        {/* Row Header */}
                        <div
                          style={{
                            fontSize: '12.5px',
                            fontWeight: 600,
                            color: '#1E293B',
                          }}
                        >
                          {w.weekday}
                        </div>

                        {/* 24 Hour Cells */}
                        {HOURS.map((h) => {
                          const hourData = w.hours[h] || { val: 0, total: 0, b2c: 0, b2b: 0, motivos: {} };
                          const val = hourData.val || 0;
                          const colors = getCellColor(val);

                          const topMotivos = (Object.entries(hourData.motivos || {}) as [string, number][])
                            .filter(([, mv]) => mv > 0)
                            .sort((a, b) => b[1] - a[1])
                            .map(([mLabel, mv]) => ({ label: mLabel, val: mv }));

                          let accumulatedDay = 0;
                          for (let i = 0; i <= h; i++) {
                            accumulatedDay += w.hours[i]?.total || 0;
                          }

                          const cellData: CellInspectionData = {
                            dateLabel: w.weekday,
                            weekday: 'Média Semanal',
                            hour: h,
                            value: val,
                            totalDay: w.totalAvg,
                            accumulatedDay: Math.round(accumulatedDay),
                            vendasTotal: hourData.total,
                            vendasB2c: hourData.b2c,
                            vendasB2b: hourData.b2b,
                            topMotivos,
                          };

                          const isHovered = hoveredCell?.hour === h && hoveredCell?.dateLabel === w.weekday;

                          return (
                            <div
                              key={h}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoveredCell({
                                  ...cellData,
                                  x: rect.left + rect.width / 2,
                                  y: rect.top,
                                });
                              }}
                              onMouseLeave={() => setHoveredCell(null)}
                              style={{
                                height: '34px',
                                background: colors.bg,
                                color: colors.text,
                                border: isHovered ? '2px solid #0284C7' : `1px solid ${colors.border}`,
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11.5px',
                                fontWeight: val > 0 ? 700 : 400,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                transform: isHovered ? 'scale(1.18)' : 'none',
                                zIndex: isHovered ? 10 : 1,
                                boxShadow: isHovered ? '0 6px 16px rgba(0,0,0,0.25)' : 'none',
                              }}
                            >
                              {val > 0 ? Math.round(val) : ''}
                            </div>
                          );
                        })}

                        {/* Row Total */}
                        <div
                          style={{
                            textAlign: 'right',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: w.totalAvg > 0 ? 'var(--blue)' : '#94A3B8',
                          }}
                        >
                          {Math.round(w.totalAvg)}
                        </div>
                      </div>
                    ))}
              </div>

              {/* Bottom Volume Distribution Bar */}
              <div
                style={{
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderTop: '1.5px dashed #E2E8F0',
                  display: 'grid',
                  gridTemplateColumns: '140px repeat(24, 1fr) 70px',
                  gap: '4px',
                  alignItems: 'flex-end',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                  Volume Acumulado
                </div>
                {HOURS.map((h) => {
                  const hVol = hourlyTotals[h] || 0;
                  const barHeight = Math.max(Math.round((hVol / maxHourlyTotal) * 36), 3);
                  const isPeak = hVol === maxHourlyTotal && maxHourlyTotal > 0;

                  return (
                    <div
                      key={h}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title={`${String(h).padStart(2, '0')}:00h - ${hVol} vendas`}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: `${barHeight}px`,
                          background: isPeak ? 'var(--orange)' : '#3B82F6',
                          borderRadius: '2px',
                          opacity: hVol > 0 ? 0.85 : 0.15,
                        }}
                      />
                      <span style={{ fontSize: '9.5px', color: isPeak ? 'var(--orange)' : '#64748B', fontWeight: isPeak ? 700 : 500 }}>
                        {hVol}
                      </span>
                    </div>
                  );
                })}
                <div style={{ textAlign: 'right', fontSize: '12px', fontWeight: 800, color: 'var(--blue)' }}>
                  {insights.totalPeriodSales.toLocaleString('pt-BR')}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Legend & Details */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginTop: '16px',
            paddingTop: '12px',
            borderTop: '1px solid #F1F5F9',
            fontSize: '11.5px',
            color: '#64748B',
          }}
        >
          <div>
            * Exibindo dados de: <strong style={{ color: '#0F172A' }}>{metricLabel}</strong>. Passe o mouse sobre os blocos do mapa para ver o detalhamento completo.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Sem vendas</span>
            <div style={{ width: '14px', height: '14px', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '3px' }} />
            <div style={{ width: '14px', height: '14px', background: '#DBEAFE', border: '1px solid #BFDBFE', borderRadius: '3px' }} />
            <div style={{ width: '14px', height: '14px', background: '#93C5FD', border: '1px solid #60A5FA', borderRadius: '3px' }} />
            <div style={{ width: '14px', height: '14px', background: '#3B82F6', border: '1px solid #2563EB', borderRadius: '3px' }} />
            <div style={{ width: '14px', height: '14px', background: '#1E3A8A', border: '1px solid #172554', borderRadius: '3px' }} />
            <span style={{ fontWeight: 600, color: '#1E3A8A' }}>Pico Máximo</span>
          </div>
        </div>
      </div>

      {/* Floating Hover Tooltip with React Portal to Document Body */}
      {hoveredCell &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: `${Math.max(150, Math.min(window.innerWidth - 150, (hoveredCell.x ?? 0)))}px`,
              top: (hoveredCell.y ?? 0) < 280 ? `${(hoveredCell.y ?? 0) + 40}px` : `${(hoveredCell.y ?? 0) - 12}px`,
              transform: (hoveredCell.y ?? 0) < 280 ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
              background: '#0F172A',
              color: '#FFFFFF',
              borderRadius: '8px',
              padding: '12px 16px',
              fontSize: '12px',
              zIndex: 999999,
              pointerEvents: 'none',
              boxShadow: '0 14px 35px rgba(0,0,0,0.45)',
              whiteSpace: 'nowrap',
              lineHeight: 1.4,
              minWidth: '230px',
            }}
          >
            <div style={{ fontWeight: 700, color: '#FDBA74', marginBottom: '8px', fontSize: '13px' }}>
              {hoveredCell.dateLabel} {hoveredCell.weekday !== 'Média Semanal' ? `(${hoveredCell.weekday})` : '(Média Semanal)'} &middot; {String(hoveredCell.hour).padStart(2, '0')}:00h
            </div>

            {metric === 'total' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '3px 14px', marginBottom: '8px' }}>
                <span style={{ color: '#94A3B8' }}>Vendas na Hora ({String(hoveredCell.hour).padStart(2, '0')}h):</span>
                <strong style={{ color: '#38BDF8', textAlign: 'right', fontSize: '13.5px' }}>{hoveredCell.vendasTotal}</strong>

                <span style={{ color: '#94A3B8' }}>B2C:</span>
                <span style={{ color: '#93C5FD', textAlign: 'right', fontWeight: 600 }}>{hoveredCell.vendasB2c}</span>

                <span style={{ color: '#94A3B8' }}>B2B:</span>
                <span style={{ color: '#FCA5A5', textAlign: 'right', fontWeight: 600 }}>{hoveredCell.vendasB2b}</span>

                <span style={{ color: '#94A3B8' }}>Acumulado até {String(hoveredCell.hour).padStart(2, '0')}:00h:</span>
                <strong style={{ color: '#FDBA74', textAlign: 'right', fontWeight: 700 }}>{hoveredCell.accumulatedDay} vendas</strong>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '3px 14px', marginBottom: '8px' }}>
                <span style={{ color: '#94A3B8' }}>{metricLabel} (na hora):</span>
                <strong style={{ color: '#38BDF8', textAlign: 'right', fontSize: '13.5px' }}>{hoveredCell.value}</strong>

                <span style={{ color: '#94A3B8' }}>Total Vendas na Hora:</span>
                <span style={{ color: '#FFFFFF', textAlign: 'right', fontWeight: 600 }}>
                  {hoveredCell.vendasTotal} <span style={{ fontSize: '10.5px', color: '#94A3B8', fontWeight: 400 }}>(B2C: {hoveredCell.vendasB2c}, B2B: {hoveredCell.vendasB2b})</span>
                </span>

                <span style={{ color: '#94A3B8' }}>Acumulado até {String(hoveredCell.hour).padStart(2, '0')}:00h:</span>
                <strong style={{ color: '#FDBA74', textAlign: 'right', fontWeight: 700 }}>{hoveredCell.accumulatedDay} vendas</strong>
              </div>
            )}

            {/* Breakdown of Motivos without scrollbar */}
            {hoveredCell.topMotivos && hoveredCell.topMotivos.length > 0 && (
              <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #334155' }}>
                <div style={{ fontSize: '10.5px', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                  Detalhamento dos Motivos:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {hoveredCell.topMotivos.slice(0, 6).map((m, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '11px' }}>
                      <span style={{ color: '#E2E8F0' }}>• {m.label}:</span>
                      <strong style={{ color: '#FDBA74' }}>{m.val}</strong>
                    </div>
                  ))}
                  {hoveredCell.topMotivos.length > 6 && (
                    <div style={{ fontSize: '10px', color: '#94A3B8', fontStyle: 'italic', marginTop: '2px', textAlign: 'right' }}>
                      + outros {hoveredCell.topMotivos.length - 6} motivos
                    </div>
                  )}
                </div>
              </div>
            )}

            {hoveredCell.totalDay > 0 && (
              <div style={{ marginTop: '6px', paddingTop: '4px', borderTop: '1px solid #334155', fontSize: '10.5px', color: '#CBD5E1' }}>
                Representa <strong>{((hoveredCell.vendasTotal / hoveredCell.totalDay) * 100).toFixed(1)}%</strong> do volume do dia (Total: <strong>{hoveredCell.totalDay}</strong>).
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
