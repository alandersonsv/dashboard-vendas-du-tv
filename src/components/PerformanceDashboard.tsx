import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  BarController,
  LineController,
} from 'chart.js';
import {
  PerformanceRow,
  EnrichedPerformanceRow,
  GroupedMonthData,
  WeeklyData,
  VendasHoraRecord,
} from '../types';
import {
  fmtCurrency,
  fmtCurrencyWhole,
  fmtNumber,
  fmtPercent,
  fmtDate,
  getWeekOfMonth,
} from '../utils/formatters';
import { uploadMetasCSV } from '../services/api';
import { VendasHoraHeatmap } from './VendasHoraHeatmap';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  BarController,
  LineController
);

interface PerformanceDashboardProps {
  rawData: PerformanceRow[];
  vendasHoraData?: VendasHoraRecord[];
  isLoadingVendasHora?: boolean;
  purchasesToday: number;
  isSyncing: boolean;
  onSync: () => Promise<void>;
  errorMsg: string | null;
  lastUpdatedText?: string;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  rawData,
  vendasHoraData = [],
  isLoadingVendasHora = false,
  purchasesToday,
  isSyncing,
  onSync,
  errorMsg,
  lastUpdatedText,
}) => {
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<ChartJS | null>(null);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Group raw data by month
  const globalDataByMonth = useMemo(() => {
    const grouped: Record<string, GroupedMonthData> = {};
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    rawData.forEach((row) => {
      if (!row.data) return;
      const d = new Date(row.data);
      const dt = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
      const monthKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = dt.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

      if (!grouped[monthKey]) {
        grouped[monthKey] = { label: monthLabel, allRows: [], pastRows: [] };
      }

      const wppMkt = Number(row.inv_wpp_mkt || row.invest_wpp_marketing) || 0;
      const wppUtil = Number(row.inv_wpp_util || row.invest_wpp_utility) || 0;
      const gemini = Number(row.inv_gemini || row.invest_gemini) || 0;
      const gcp = Number(row.inv_outros_gcp || row.invest_outros_gcp) || 0;

      const enrichedRow: EnrichedPerformanceRow = {
        ...row,
        dateObj: dt,
        isFuture: dt > today,
        wppMkt,
        wppUtil,
        gemini,
        gcp,
      };

      grouped[monthKey].allRows.push(enrichedRow);
      if (!enrichedRow.isFuture) {
        grouped[monthKey].pastRows.push(enrichedRow);
      }
    });

    Object.values(grouped).forEach((group) => {
      group.allRows.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
      group.pastRows.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
    });

    return grouped;
  }, [rawData]);

  const monthKeys = useMemo(() => {
    return Object.keys(globalDataByMonth).sort().reverse();
  }, [globalDataByMonth]);

  // Initialize default month when monthKeys become available or if current selection is invalid
  useEffect(() => {
    if (monthKeys.length > 0) {
      setSelectedMonthKey((prev) => {
        // If user already has a valid selected month in data, preserve it!
        if (prev && globalDataByMonth[prev]) {
          return prev;
        }
        // Otherwise, default to current calendar month if available, or first available month
        const today = new Date();
        const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        if (globalDataByMonth[currentMonthKey]) {
          return currentMonthKey;
        }
        return monthKeys[0];
      });
    }
  }, [monthKeys, globalDataByMonth]);

  const activeMonthData = useMemo(() => {
    return globalDataByMonth[selectedMonthKey] || { label: '', allRows: [], pastRows: [] };
  }, [globalDataByMonth, selectedMonthKey]);

  // Compute aggregations
  const stats = useMemo(() => {
    let investGoogle = 0;
    let investMeta = 0;
    let investSMS = 0;
    let vendasOn = 0;
    let vendasTotais = 0;
    let vendasB2C = 0;
    let metaInvest = 0;
    let metaVendas = 0;

    let metaGoogleTot = 0;
    let metaMetaTot = 0;
    let metaSMSTot = 0;
    let metaGoogleHoje = 0;
    let metaMetaHoje = 0;
    let metaSMSHoje = 0;

    const weekly: Record<number, WeeklyData> = {};

    activeMonthData.allRows.forEach((d) => {
      const mV = Number(d.meta_vendas_on) || 0;
      const mI = Number(d.meta_investimento) || 0;
      metaVendas += mV;
      metaInvest += mI;

      metaGoogleTot += Number(d.meta_investimento_google) || 0;
      metaMetaTot += Number(d.meta_investimento_meta) || 0;
      metaSMSTot += Number(d.meta_investimento_sms) || 0;

      const w = getWeekOfMonth(d.dateObj);
      if (!weekly[w]) weekly[w] = { metaVendas: 0, metaInvest: 0, realVendas: 0, realInvest: 0 };
      weekly[w].metaVendas += mV;
      weekly[w].metaInvest += mI;
    });

    activeMonthData.pastRows.forEach((d) => {
      const vOn = Number(d.vendas_on) || 0;
      const vTot = Number(
        d.vendas_total ||
          (d as Record<string, unknown>).vendas_totais ||
          (d as Record<string, unknown>).total_vendas ||
          (d as Record<string, unknown>).Vendas_Total ||
          (d as Record<string, unknown>).Total
      ) || 0;
      const vB2C = Number(
        d.vendas_b2c ||
          d.vendas_total_b2c ||
          (d as Record<string, unknown>).Vendas_B2C ||
          (d as Record<string, unknown>).B2C
      ) || 0;
      const iG = Number(d.invest_google) || 0;
      const iM = Number(d.invest_meta) || 0;
      const iS = Number(d.invest_sms) || 0;

      vendasOn += vOn;
      vendasTotais += vTot;
      vendasB2C += vB2C;
      investGoogle += iG;
      investMeta += iM;
      investSMS += iS;

      metaGoogleHoje += Number(d.meta_investimento_google) || 0;
      metaMetaHoje += Number(d.meta_investimento_meta) || 0;
      metaSMSHoje += Number(d.meta_investimento_sms) || 0;

      const w = getWeekOfMonth(d.dateObj);
      if (!weekly[w]) weekly[w] = { metaVendas: 0, metaInvest: 0, realVendas: 0, realInvest: 0 };
      weekly[w].realVendas += vOn;
      weekly[w].realInvest += iG + iM;
    });

    const investOn = investGoogle + investMeta;
    const investTotal = investOn + investSMS;
    const cpaGlobal = vendasTotais > 0 ? investTotal / vendasTotais : 0;
    const baseVendasB2C = vendasB2C > 0 ? vendasB2C : vendasTotais;
    const shareOnline = baseVendasB2C > 0 ? (vendasOn / baseVendasB2C) * 100 : 0;
    const saldoInvest = metaInvest - investOn;

    return {
      investGoogle,
      investMeta,
      investSMS,
      investOn,
      investTotal,
      vendasOn,
      vendasTotais,
      shareOnline,
      metaInvest,
      metaVendas,
      cpaGlobal,
      saldoInvest,
      metaGoogleTot,
      metaMetaTot,
      metaSMSTot,
      metaGoogleHoje,
      metaMetaHoje,
      metaSMSHoje,
      weekly,
    };
  }, [activeMonthData]);

  // Render Chart.js chart
  useEffect(() => {
    if (!chartCanvasRef.current) return;
    const chartData = [...activeMonthData.pastRows].slice(0, 31).reverse();

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const ctx = chartCanvasRef.current.getContext('2d');
    if (!ctx) return;

    chartInstanceRef.current = new ChartJS(ctx, {
      type: 'bar',
      data: {
        // Only day number (e.g., "01", "02", "03", ...)
        labels: chartData.map((d) => String(d.dateObj.getDate()).padStart(2, '0')),
        datasets: [
          {
            type: 'bar',
            label: 'Vendas Realizadas (ON)',
            data: chartData.map((d) => Number(d.vendas_on) || 0),
            backgroundColor: '#1D4ED8',
            order: 2,
            yAxisID: 'y',
          },
          {
            type: 'line',
            label: 'Meta de Vendas (ON)',
            data: chartData.map((d) => Number(d.meta_vendas_on) || 0),
            borderColor: '#A1A1AA',
            borderDash: [5, 5],
            fill: false,
            tension: 0.3,
            order: 1,
            yAxisID: 'y',
          },
          {
            type: 'line',
            label: 'Investimento ON (R$)',
            data: chartData.map(
              (d) => (Number(d.invest_google) || 0) + (Number(d.invest_meta) || 0)
            ),
            borderColor: '#F97316',
            backgroundColor: 'rgba(249, 115, 22, 0.1)',
            fill: true,
            tension: 0.4,
            order: 0,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              title: (items) => {
                if (!items || !items.length) return '';
                const idx = items[0].dataIndex;
                const d = chartData[idx];
                if (!d) return '';
                const dayStr = String(d.dateObj.getDate()).padStart(2, '0');
                const weekdayStr = d.dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
                return `Dia ${dayStr} (${weekdayStr.charAt(0).toUpperCase() + weekdayStr.slice(1)})`;
              },
              label: (context) => {
                const datasetLabel = context.dataset.label || '';
                const val = Number(context.parsed.y) || 0;
                if (datasetLabel.includes('R$') || datasetLabel.includes('Investimento')) {
                  return `${datasetLabel}: ${fmtCurrency(val)}`;
                }
                return `${datasetLabel}: ${fmtNumber(val)} un.`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            title: { display: true, text: 'Dia do Mês' },
          },
          y: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: 'Vendas' },
          },
          y1: {
            type: 'linear',
            position: 'right',
            title: { display: true, text: 'Valor (R$)' },
            grid: { drawOnChartArea: false },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [activeMonthData]);

  // CSV Upload handler
  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    alert('Iniciando importação de metas. A visualização será atualizada automaticamente.');
    try {
      await uploadMetasCSV(file);
      await onSync();
    } catch (err) {
      alert(`Erro ao enviar CSV: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Aggregations for Outros Custos
  const outrosCustosTotals = useMemo(() => {
    let sumWppMkt = 0;
    let sumWppUtil = 0;
    let sumGemini = 0;
    let sumGcp = 0;

    activeMonthData.pastRows.forEach((row) => {
      sumWppMkt += row.wppMkt || 0;
      sumWppUtil += row.wppUtil || 0;
      sumGemini += row.gemini || 0;
      sumGcp += row.gcp || 0;
    });

    const totalGeral = sumWppMkt + sumWppUtil + sumGemini + sumGcp;
    const wppTotal = sumWppMkt + sumWppUtil;

    return { sumWppMkt, sumWppUtil, sumGemini, sumGcp, totalGeral, wppTotal };
  }, [activeMonthData]);

  // Table summary totals for Intradiário
  const intradiarioTotals = useMemo(() => {
    let sumGoogle = 0;
    let sumMeta = 0;
    let sumSMS = 0;
    let sumVendasTot = 0;
    let sumVendasOn = 0;
    let sumMetaVendas = 0;

    activeMonthData.pastRows.forEach((row) => {
      sumGoogle += Number(row.invest_google) || 0;
      sumMeta += Number(row.invest_meta) || 0;
      sumSMS += Number(row.invest_sms) || 0;
      sumVendasTot += Number(row.vendas_total) || 0;
      sumVendasOn += Number(row.vendas_on) || 0;
      sumMetaVendas += Number(row.meta_vendas_on) || 0;
    });

    const sumInvOn = sumGoogle + sumMeta;
    const sumInvTotal = sumInvOn + sumSMS;
    const cpaOnTotal = sumVendasOn > 0 ? sumInvOn / sumVendasOn : 0;
    const atingTotal = sumMetaVendas > 0 ? (sumVendasOn / sumMetaVendas) * 100 : 0;

    return {
      sumGoogle,
      sumMeta,
      sumSMS,
      sumInvTotal,
      sumVendasTot,
      sumVendasOn,
      sumMetaVendas,
      cpaOnTotal,
      atingTotal,
    };
  }, [activeMonthData]);

  // Weekly pacing totals
  const weeklyTotals = useMemo(() => {
    let totMetaV = 0;
    let totMetaI = 0;
    let totRealV = 0;
    let totRealI = 0;

    Object.keys(stats.weekly).forEach((w) => {
      const d = stats.weekly[Number(w)];
      totMetaV += d.metaVendas;
      totMetaI += d.metaInvest;
      totRealV += d.realVendas;
      totRealI += d.realInvest;
    });

    const varTotVendas = totMetaV > 0 ? (totRealV / totMetaV - 1) * 100 : 0;
    const varTotInvest = totMetaI > 0 ? (totRealI / totMetaI - 1) * 100 : 0;

    return { totMetaV, totMetaI, totRealV, totRealI, varTotVendas, varTotInvest };
  }, [stats.weekly]);

  const latestDateLabel = activeMonthData.pastRows.length > 0 ? fmtDate(activeMonthData.pastRows[0].dateObj) : '—';

  return (
    <div id="page-performance" className="page tab-content active">
      {/* Header */}
      <div className="doc-header">
        <div>
          <div className="doc-logo-fallback">LABEST</div>
          <h1 className="doc-title">Performance Marketing &amp; Vendas</h1>
          <p className="doc-subtitle">Dashboard de acompanhamento consolidado</p>
        </div>
        <div className="doc-header-right">
          <div className="header-actions">
            <button
              id="btn-sync-perf"
              className={`refresh-btn ${isSyncing ? 'spinning' : ''}`}
              onClick={onSync}
              disabled={isSyncing}
            >
              <span className="refresh-icon">↻</span> {isSyncing ? 'Atualizando...' : 'Atualizar Dados'}
            </button>
          </div>
          <div className="doc-meta" style={{ marginTop: '8px' }}>
            Última leitura: <span>{lastUpdatedText || new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div id="error-banner" className="error-banner">
          <strong>Aviso:</strong> {errorMsg}
        </div>
      )}

      {/* Filter wrapper */}
      <div className="filter-wrapper">
        <div className="filter-group" style={{ flex: 1, maxWidth: '300px' }}>
          <label className="filter-label">Mês de Referência</label>
          <select
            id="month-select"
            className="filter-select"
            value={selectedMonthKey}
            onChange={(e) => setSelectedMonthKey(e.target.value)}
          >
            {monthKeys.map((key) => (
              <option key={key} value={key}>
                {globalDataByMonth[key]?.label?.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group filter-group-metas" style={{ alignItems: 'flex-end', flex: 1 }}>
          <label className="filter-label">Atualizar Metas (Futuro ou Atual)</label>
          <div className="metas-btn-container" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', width: '100%', justifyContent: 'flex-end' }}>
            <a
              href="data:text/csv;charset=utf-8,data,meta_investimento,meta_vendas_on%0A2026-08-01,5000.00,200"
              download="modelo_metas.csv"
              className="action-btn btn-secondary"
            >
              📄 Modelo CSV
            </a>
            <button
              className="action-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              📥 Importar Metas
            </button>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            id="csv-upload"
            style={{ display: 'none' }}
            accept=".csv"
            onChange={handleCSVUpload}
          />
        </div>
      </div>

      {/* Submenu / Quick Jump Navigation */}
      <div className="perf-subnav-container">
        <div className="perf-subnav-label">Ir para seção:</div>
        <div className="perf-subnav-scroll">
          <button type="button" onClick={() => scrollToSection('sec-kpis')} className="perf-subnav-chip">
            📊 Resumo KPIs
          </button>
          <button type="button" onClick={() => scrollToSection('sec-intradiario')} className="perf-subnav-chip">
            📋 Extrato Intradiário
          </button>
          <button type="button" onClick={() => scrollToSection('sec-tendencia')} className="perf-subnav-chip">
            📈 Tendência Diária
          </button>
          <button type="button" onClick={() => scrollToSection('sec-heatmap')} className="perf-subnav-chip highlight-chip">
            🔥 Mapa de Calor
          </button>
          <button type="button" onClick={() => scrollToSection('sec-canais')} className="perf-subnav-chip">
            💼 Canais de Mídia
          </button>
          <button type="button" onClick={() => scrollToSection('sec-semanal')} className="perf-subnav-chip">
            📅 Pacing Semanal
          </button>
          <button type="button" onClick={() => scrollToSection('sec-custos')} className="perf-subnav-chip">
            ⚙️ APIs &amp; Cloud
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-strip" id="sec-kpis">
        <div className="kpi-card blue">
          <div className="kpi-label">Vendas ON (Mês)</div>
          <div className="kpi-value" id="kpi-vendas-on">{fmtNumber(stats.vendasOn)}</div>
          <div className="kpi-sub" id="kpi-vendas-total">Vendas Totais: {fmtNumber(stats.vendasTotais)}</div>
        </div>
        <div className="kpi-card purple">
          <div className="kpi-label">Share Online</div>
          <div className="kpi-value" id="kpi-share-online">{fmtPercent(stats.shareOnline)}</div>
          <div className="kpi-sub">Do volume total de vendas B2C</div>
        </div>
        <div className="kpi-card orange">
          <div className="kpi-label">Investimento Total (Mês)</div>
          <div className="kpi-value" id="kpi-invest-total">{fmtCurrencyWhole(stats.investTotal)}</div>
          <div className="kpi-sub" id="kpi-invest-meta">
            Budget ON: {fmtCurrencyWhole(stats.metaInvest)} | Saldo: {fmtCurrencyWhole(stats.saldoInvest)}
          </div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-label">CPA Global (Mês)</div>
          <div className="kpi-value" id="kpi-cpa-global">{fmtCurrency(stats.cpaGlobal)}</div>
          <div className="kpi-sub">Vendas Totais Empresa</div>
        </div>
      </div>

      {/* Detalhamento Intradiário */}
      <div className="section" id="sec-intradiario">
        <div className="section-heading">
          Detalhamento Intradiário
          {purchasesToday > 0 && (
            <span className="live-badge blue" id="badge-purchases" style={{ display: 'inline-flex' }}>
              <span className="live-dot" /> Purchases Hoje: <strong id="val-purchases" style={{ marginLeft: '4px' }}>{purchasesToday}</strong>
            </span>
          )}
        </div>
        <p className="section-desc">Extrato de performance dia a dia ordenado pelo mais recente.</p>
        <div className="table-card">
          <div className="dt-wrapper">
            <table className="dt" id="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Invest. Google</th>
                  <th>Invest. Meta</th>
                  <th>Invest. SMS</th>
                  <th>Total Investido</th>
                  <th>Vendas Totais</th>
                  <th>Vendas ON</th>
                  <th>Meta Vendas ON</th>
                  <th>% Ating.</th>
                  <th>CPA ON</th>
                </tr>
              </thead>
              <tbody>
                {activeMonthData.pastRows.map((row, idx) => {
                  const invGoogle = Number(row.invest_google) || 0;
                  const invMeta = Number(row.invest_meta) || 0;
                  const invSMS = Number(row.invest_sms) || 0;
                  const vTot = Number(row.vendas_total) || 0;
                  const vOn = Number(row.vendas_on) || 0;
                  const mVendas = Number(row.meta_vendas_on) || 0;
                  const invOn = invGoogle + invMeta;
                  const invTotal = invOn + invSMS;
                  const cpaOn = vOn > 0 ? invOn / vOn : 0;
                  const atingimento = mVendas > 0 ? (vOn / mVendas) * 100 : 0;
                  const atingColor =
                    atingimento >= 100
                      ? 'var(--green)'
                      : atingimento > 0 && atingimento < 70
                      ? 'var(--red)'
                      : undefined;

                  return (
                    <tr key={idx}>
                      <td>{fmtDate(row.dateObj)}</td>
                      <td>{fmtCurrency(invGoogle)}</td>
                      <td>{fmtCurrency(invMeta)}</td>
                      <td>{fmtCurrency(invSMS)}</td>
                      <td style={{ fontWeight: 600, color: 'var(--text)' }}>{fmtCurrency(invTotal)}</td>
                      <td style={{ fontWeight: 500 }}>{fmtNumber(vTot)}</td>
                      <td style={{ fontWeight: 600, color: 'var(--blue)' }}>{fmtNumber(vOn)}</td>
                      <td>{fmtNumber(mVendas)}</td>
                      <td style={{ color: atingColor, fontWeight: atingColor ? 'bold' : undefined }}>
                        {fmtPercent(atingimento)}
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--purple)' }}>{fmtCurrency(cpaOn)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot id="data-table-foot">
                <tr>
                  <td>TOTAIS</td>
                  <td>{fmtCurrency(intradiarioTotals.sumGoogle)}</td>
                  <td>{fmtCurrency(intradiarioTotals.sumMeta)}</td>
                  <td>{fmtCurrency(intradiarioTotals.sumSMS)}</td>
                  <td style={{ color: 'var(--text)' }}>{fmtCurrency(intradiarioTotals.sumInvTotal)}</td>
                  <td>{fmtNumber(intradiarioTotals.sumVendasTot)}</td>
                  <td style={{ color: 'var(--blue)' }}>{fmtNumber(intradiarioTotals.sumVendasOn)}</td>
                  <td>{fmtNumber(intradiarioTotals.sumMetaVendas)}</td>
                  <td
                    style={{
                      color:
                        intradiarioTotals.atingTotal >= 100
                          ? 'var(--green)'
                          : intradiarioTotals.atingTotal > 0 && intradiarioTotals.atingTotal < 70
                          ? 'var(--red)'
                          : undefined,
                      fontWeight: 'bold',
                    }}
                  >
                    {fmtPercent(intradiarioTotals.atingTotal)}
                  </td>
                  <td style={{ color: 'var(--purple)' }}>{fmtCurrency(intradiarioTotals.cpaOnTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Gráfico */}
      <div className="section" id="sec-tendencia">
        <div className="section-heading">Tendência de Vendas vs Investimento Diário</div>
        <p className="section-desc">Evolução diária (Datas futuras são omitidas do gráfico e tabela).</p>
        <div className="table-card">
          <div className="chart-container">
            <canvas ref={chartCanvasRef} id="performanceChart" />
          </div>
        </div>
      </div>

      {/* Mapa de Calor por Horário (Heatmap) */}
      <VendasHoraHeatmap
        rawData={vendasHoraData}
        selectedMonthKey={selectedMonthKey}
        isLoading={isLoadingVendasHora}
      />

      {/* Canal e Semanal */}
      <div className="section" id="sec-canais">
        <div className="section-heading">Investimento Realizado por Canal (Mês)</div>
        <p className="section-desc">Distribuição real do orçamento executado no mês filtrado.</p>
        <div className="channel-grid">
          <div className="channel-card highlight">
            <div className="channel-title">Total Investido Real</div>
            <div className="channel-val">{fmtCurrencyWhole(stats.investTotal)}</div>
            <div className="channel-sub">Soma de todas as plataformas</div>
          </div>

          <div className="channel-card">
            <div className="channel-title">Google Ads</div>
            <div className="channel-val">{fmtCurrencyWhole(stats.investGoogle)}</div>
            <div className="channel-sub">
              Meta (até hoje): {fmtCurrencyWhole(stats.metaGoogleHoje)} (
              {fmtPercent(stats.metaGoogleHoje > 0 ? (stats.investGoogle / stats.metaGoogleHoje) * 100 : 0)})<br />
              Meta Mês: {fmtCurrencyWhole(stats.metaGoogleTot)} (
              {fmtPercent(stats.metaGoogleTot > 0 ? (stats.investGoogle / stats.metaGoogleTot) * 100 : 0)})
            </div>
          </div>

          <div className="channel-card">
            <div className="channel-title">SMS / Twilio</div>
            <div className="channel-val">{fmtCurrencyWhole(stats.investSMS)}</div>
            <div className="channel-sub">
              Meta (até hoje): {fmtCurrencyWhole(stats.metaSMSHoje)} (
              {fmtPercent(stats.metaSMSHoje > 0 ? (stats.investSMS / stats.metaSMSHoje) * 100 : 0)})<br />
              Meta Mês: {fmtCurrencyWhole(stats.metaSMSTot)} (
              {fmtPercent(stats.metaSMSTot > 0 ? (stats.investSMS / stats.metaSMSTot) * 100 : 0)})
            </div>
          </div>

          <div className="channel-card">
            <div className="channel-title">Meta Ads</div>
            <div className="channel-val">{fmtCurrencyWhole(stats.investMeta)}</div>
            <div className="channel-sub">
              Meta (até hoje): {fmtCurrencyWhole(stats.metaMetaHoje)} (
              {fmtPercent(stats.metaMetaHoje > 0 ? (stats.investMeta / stats.metaMetaHoje) * 100 : 0)})<br />
              Meta Mês: {fmtCurrencyWhole(stats.metaMetaTot)} (
              {fmtPercent(stats.metaMetaTot > 0 ? (stats.investMeta / stats.metaMetaTot) * 100 : 0)})
            </div>
          </div>

          <div className="channel-card">
            <div className="channel-title">TikTok Ads</div>
            <div className="channel-val">R$ 0</div>
            <div className="channel-sub">Canal Inativo</div>
          </div>
        </div>
      </div>

      {/* Acompanhamento Semanal */}
      <div className="section" id="sec-semanal">
        <div className="section-heading">Acompanhamento Semanal de Pacing (Meta x Realizado)</div>
        <p className="section-desc">Evolução do ritmo de vendas e gastos agrupados por semana do mês (Domingo a Sábado).</p>
        <div className="table-card">
          <div className="dt-wrapper" style={{ overflowY: 'hidden' }}>
            <table className="dt" id="weekly-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', paddingLeft: '20px' }}>Semana</th>
                  <th>Meta Vendas ON</th>
                  <th>Meta Invest. (ON)</th>
                  <th>Realizado Invest. (ON)</th>
                  <th>Realizado Vendas</th>
                  <th>Real x Meta Vendas (%)</th>
                  <th>Real x Meta Invest (%)</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(stats.weekly)
                  .sort((a, b) => Number(a) - Number(b))
                  .map((wStr) => {
                    const w = Number(wStr);
                    const d = stats.weekly[w];
                    const varVendas = d.metaVendas > 0 ? (d.realVendas / d.metaVendas - 1) * 100 : 0;
                    const varInvest = d.metaInvest > 0 ? (d.realInvest / d.metaInvest - 1) * 100 : 0;
                    const colorV = varVendas >= 0 ? 'var(--green)' : 'var(--red)';
                    const colorI = varInvest <= 0 ? 'var(--green)' : 'var(--red)';

                    return (
                      <tr key={w}>
                        <td style={{ textAlign: 'left', paddingLeft: '20px', fontWeight: 600 }}>Semana {w}</td>
                        <td>{fmtNumber(d.metaVendas)}</td>
                        <td>{fmtCurrencyWhole(d.metaInvest)}</td>
                        <td style={{ fontWeight: 600, color: 'var(--text)' }}>{fmtCurrencyWhole(d.realInvest)}</td>
                        <td style={{ fontWeight: 600, color: 'var(--blue)' }}>{fmtNumber(d.realVendas)}</td>
                        <td style={{ color: colorV, fontWeight: 600 }}>
                          {(varVendas > 0 ? '+' : '') + fmtPercent(varVendas)}
                        </td>
                        <td style={{ color: colorI, fontWeight: 600 }}>
                          {(varInvest > 0 ? '+' : '') + fmtPercent(varInvest)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
              <tfoot id="weekly-table-foot">
                <tr style={{ background: '#F6F5F3', fontWeight: 'bold' }}>
                  <td style={{ textAlign: 'left', paddingLeft: '20px' }}>TOTAL ACUMULADO</td>
                  <td>{fmtNumber(weeklyTotals.totMetaV)}</td>
                  <td>{fmtCurrencyWhole(weeklyTotals.totMetaI)}</td>
                  <td style={{ color: 'var(--text)' }}>{fmtCurrencyWhole(weeklyTotals.totRealI)}</td>
                  <td style={{ color: 'var(--blue)' }}>{fmtNumber(weeklyTotals.totRealV)}</td>
                  <td style={{ color: weeklyTotals.varTotVendas >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {(weeklyTotals.varTotVendas > 0 ? '+' : '') + fmtPercent(weeklyTotals.varTotVendas)}
                  </td>
                  <td style={{ color: weeklyTotals.varTotInvest <= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {(weeklyTotals.varTotInvest > 0 ? '+' : '') + fmtPercent(weeklyTotals.varTotInvest)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Outros Custos (APIs e Infraestrutura) */}
      <div className="section" id="sec-custos">
        <div className="section-heading">Outros Custos (APIs e Infraestrutura)</div>
        <p className="section-desc">
          Acompanhamento dos custos de disparos de WhatsApp (Twilio), tokens de IA (Gemini) e Google Cloud.
        </p>

        {/* Cards de Resumo */}
        <div className="channel-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '20px' }}>
          <div className="channel-card highlight">
            <div className="channel-title">Custo WhatsApp (Mês)</div>
            <div className="channel-val">{fmtCurrency(outrosCustosTotals.wppTotal)}</div>
            <div className="channel-sub">Marketing e Utility via Twilio</div>
          </div>
          <div className="channel-card highlight">
            <div className="channel-title">Custo Gemini AI (Mês)</div>
            <div className="channel-val">{fmtCurrency(outrosCustosTotals.sumGemini)}</div>
            <div className="channel-sub">Consumo de tokens na GCP</div>
          </div>
          <div className="channel-card">
            <div className="channel-title">Outros Custos GCP (Mês)</div>
            <div className="channel-val">{fmtCurrency(outrosCustosTotals.sumGcp)}</div>
            <div className="channel-sub">Serviços adicionais em nuvem</div>
          </div>
        </div>

        {/* Tabela Diária */}
        <div className="table-card">
          <div className="dt-wrapper">
            <table className="dt" id="outros-custos-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>WPP Marketing</th>
                  <th>WPP Utility</th>
                  <th>Gemini AI</th>
                  <th>Outros GCP</th>
                  <th>Custo Total do Dia</th>
                </tr>
              </thead>
              <tbody>
                {activeMonthData.pastRows.map((row, idx) => {
                  const wppMkt = row.wppMkt || 0;
                  const wppUtil = row.wppUtil || 0;
                  const gemini = row.gemini || 0;
                  const gcp = row.gcp || 0;
                  const totalDia = wppMkt + wppUtil + gemini + gcp;

                  return (
                    <tr key={idx}>
                      <td>{fmtDate(row.dateObj)}</td>
                      <td>{fmtCurrency(wppMkt)}</td>
                      <td>{fmtCurrency(wppUtil)}</td>
                      <td style={{ color: 'var(--orange)', fontWeight: 500 }}>{fmtCurrency(gemini)}</td>
                      <td>{fmtCurrency(gcp)}</td>
                      <td style={{ fontWeight: 600, color: 'var(--text)' }}>{fmtCurrency(totalDia)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot id="outros-custos-table-foot">
                <tr>
                  <td>TOTAIS</td>
                  <td>{fmtCurrency(outrosCustosTotals.sumWppMkt)}</td>
                  <td>{fmtCurrency(outrosCustosTotals.sumWppUtil)}</td>
                  <td style={{ color: 'var(--orange)', fontWeight: 'bold' }}>
                    {fmtCurrency(outrosCustosTotals.sumGemini)}
                  </td>
                  <td>{fmtCurrency(outrosCustosTotals.sumGcp)}</td>
                  <td style={{ color: 'var(--text)' }}>{fmtCurrency(outrosCustosTotals.totalGeral)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <div className="doc-footer">Labest · Diretoria de Marketing &amp; Growth · Confidencial</div>
    </div>
  );
};
