export const fmtCurrency = (val: number): string =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);

export const fmtCurrencyWhole = (val: number): string =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(val);

export const fmtNumber = (val: number): string =>
  new Intl.NumberFormat('pt-BR').format(val);

export const fmtPercent = (val: number): string =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(val) + '%';

export const fmtDate = (dtObj: Date): string =>
  dtObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

export function getWeekOfMonth(date: Date): number {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstDayOfWeek = firstDay.getDay();
  const offsetDate = date.getDate() + firstDayOfWeek - 1;
  return Math.floor(offsetDate / 7) + 1;
}

export function fmtPctShare(v: number | string | null | undefined): string {
  if (v == null || isNaN(Number(v))) return '—';
  return Number(v).toFixed(2) + '%';
}

export function avgShare(arr: (number | string | null | undefined)[]): number | null {
  const v = arr
    .map((x) => (typeof x === 'string' ? parseFloat(x.replace(',', '.')) : Number(x)))
    .filter((x) => x != null && !isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function getPeriodKeyShare(s: string | undefined, m: string): string {
  if (!s) return '';
  return m === 'Mensal' ? s.substring(0, 7) : s;
}

export function fmtPeriodLabelShare(s: string | undefined, m: string): string {
  if (!s) return '—';
  if (m === 'Mensal') {
    const [y, mon] = s.split('-');
    return new Date(Number(y), Number(mon) - 1, 1)
      .toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
      .toUpperCase()
      .replace('.', '');
  }
  return new Date(s + 'T12:00:00')
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    .toUpperCase()
    .replace('.', '');
}

export function parsePctDU(s: string | null | undefined): number | null {
  if (!s || s.trim() === '' || s === '-') return null;
  return parseFloat(s.replace('%', '').replace(',', '.').replace('+', '').trim());
}

export function fpDU(v: number | null | undefined): string {
  return v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2).replace('.', ',') + '%';
}
