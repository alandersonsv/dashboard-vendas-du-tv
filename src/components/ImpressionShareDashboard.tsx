import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ShareItem, ShareMetricConfig } from '../types';
import {
  fmtPctShare,
  avgShare,
  getPeriodKeyShare,
  fmtPeriodLabelShare,
} from '../utils/formatters';

const METRICAS_SHARE: ShareMetricConfig[] = [
  { key: 'parcela_impressao', label: 'Parcela de impressão', cls: 'metric-primary', higherBetter: true },
  { key: 'perda_rank', label: 'Perda por ranking', cls: '', higherBetter: false },
  { key: 'perda_orcamento', label: 'Perda por orçamento', cls: '', higherBetter: false },
  { key: 'topo_pagina', label: 'Topo da página', cls: 'metric-blue', higherBetter: true },
  { key: 'topo_absoluto', label: 'Topo absoluto', cls: '', higherBetter: true },
  { key: 'parcela_topo', label: 'Parcela topo pág.', cls: 'metric-green', higherBetter: true },
  { key: 'parcela_topo_absoluto', label: 'Parcela topo abs.', cls: '', higherBetter: true },
];

interface ImpressionShareDashboardProps {
  rawData: ShareItem[];
  isSyncing: boolean;
  onRefresh: () => Promise<void>;
  lastUpdatedText: string;
  isActive?: boolean;
}

export const ImpressionShareDashboard: React.FC<ImpressionShareDashboardProps> = ({
  rawData,
  isSyncing,
  onRefresh,
  lastUpdatedText,
  isActive = true,
}) => {
  const [shareCampanha, setShareCampanha] = useState<string>('Todas');
  const [shareCanal, setShareCanal] = useState<string>('Todos');
  const [shareStatus, setShareStatus] = useState<string>('Total');
  const [shareViewMode, setShareViewMode] = useState<'Semanal' | 'Mensal'>('Mensal');
  const [shareStart, setShareStart] = useState<string>('');
  const [shareEnd, setShareEnd] = useState<string>('');
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const tableScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to rightmost (most recent) position whenever tab is activated, view mode changes, or filters change
  const scrollToLatest = useCallback(() => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollTo({
        left: tableScrollRef.current.scrollWidth,
        behavior: 'smooth',
      });
    }
  }, []);

  const scrollToOldest = useCallback(() => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollTo({
        left: 0,
        behavior: 'smooth',
      });
    }
  }, []);

  // Check scroll position for scroll arrows / indicators
  const updateScrollState = useCallback(() => {
    if (tableScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tableScrollRef.current;
      setCanScrollLeft(scrollLeft > 6);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 6);
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      // Auto-align table to the latest period (right side) on activation or view mode change
      const timer = setTimeout(() => {
        if (tableScrollRef.current) {
          tableScrollRef.current.scrollLeft = tableScrollRef.current.scrollWidth;
        }
        updateScrollState();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isActive, shareViewMode, shareCampanha, shareCanal, shareStatus, updateScrollState]);

  const handleScrollLeft = () => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollBy({ left: -240, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollBy({ left: 240, behavior: 'smooth' });
    }
  };

  // Normalized items
  const cleanData = useMemo(() => {
    return rawData
      .filter((item) => item.tipo === 'dados')
      .map((d) => {
        let canal = d.canal;
        if (canal === 'PERFORMANCE_MAX') canal = 'PMAX';
        if (canal === 'SEARCH') canal = 'Pesquisa';
        return { ...d, canal };
      });
  }, [rawData]);

  // Extract unique channels
  const canaisUnicos = useMemo(() => {
    const filtered = cleanData.filter((d) => {
      if ((shareStart && (d.semana || '') < shareStart) || (shareEnd && (d.semana || '') > shareEnd)) return false;
      const s = String(d.status || '').toUpperCase();
      if (shareStatus === 'Ativo' && s !== 'ENABLED') return false;
      if (shareStatus === 'Pausado' && s !== 'PAUSED') return false;
      return true;
    });
    return [...new Set(filtered.map((d) => d.canal).filter(Boolean) as string[])].sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    );
  }, [cleanData, shareStart, shareEnd, shareStatus]);

  // Extract unique campaigns
  const campanhasUnicas = useMemo(() => {
    const filtered = cleanData.filter((d) => {
      if ((shareStart && (d.semana || '') < shareStart) || (shareEnd && (d.semana || '') > shareEnd)) return false;
      const s = String(d.status || '').toUpperCase();
      if (shareStatus === 'Ativo' && s !== 'ENABLED') return false;
      if (shareStatus === 'Pausado' && s !== 'PAUSED') return false;
      if (shareCanal !== 'Todos' && d.canal !== shareCanal) return false;
      return true;
    });
    return [...new Set(filtered.map((d) => d.campanha).filter(Boolean) as string[])].sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    );
  }, [cleanData, shareStart, shareEnd, shareStatus, shareCanal]);

  // Final filtered dataset
  const filteredData = useMemo(() => {
    return cleanData.filter((d) => {
      if ((shareStart && (d.semana || '') < shareStart) || (shareEnd && (d.semana || '') > shareEnd)) return false;
      const s = String(d.status || '').toUpperCase();
      if (shareStatus === 'Ativo' && s !== 'ENABLED') return false;
      if (shareStatus === 'Pausado' && s !== 'PAUSED') return false;
      if (shareCampanha !== 'Todas' && d.campanha !== shareCampanha) return false;
      if (shareCanal !== 'Todos' && d.canal !== shareCanal) return false;
      return true;
    });
  }, [cleanData, shareStart, shareEnd, shareStatus, shareCampanha, shareCanal]);

  // Periods calculation
  const { periodsAsc, wa } = useMemo(() => {
    const rawPeriods = filteredData
      .map((d) => getPeriodKeyShare(d.semana, shareViewMode))
      .filter((s): s is string => typeof s === 'string' && s.length > 0);
    const periodsSet = new Set<string>(rawPeriods);
    const periods: string[] = [];
    periodsSet.forEach((item) => periods.push(item));
    periods.sort();

    const weightedAvg: Record<string, Record<string, number | null>> = {};

    periods.forEach((p: string) => {
      const pd = filteredData.filter((d) => getPeriodKeyShare(d.semana, shareViewMode) === p);
      weightedAvg[p] = {};
      METRICAS_SHARE.forEach((m) => {
        weightedAvg[p][m.key] = avgShare(pd.map((d) => d[m.key] as number | string | undefined));
      });
    });

    return { periodsAsc: periods, wa: weightedAvg };
  }, [filteredData, shareViewMode]);

  const lp = periodsAsc[periodsAsc.length - 1];
  const pp = periodsAsc[periodsAsc.length - 2];
  const ca = useMemo(() => (lp ? wa[lp] || {} : {}), [lp, wa]);
  const pa = useMemo(() => (pp ? wa[pp] || {} : {}), [pp, wa]);

  const campPill =
    shareCampanha === 'Todas' ? 'TODAS AS CAMPANHAS' : shareCampanha.split('|')[0].trim().toUpperCase();

  const displayPeriods = useMemo(() => periodsAsc, [periodsAsc]);

  const dvShare = (
    curr: number | null | undefined,
    prev: number | null | undefined,
    hb: boolean
  ) => {
    if (curr == null || prev == null || isNaN(Number(curr)) || isNaN(Number(prev))) return null;
    const c = Number(curr);
    const p = Number(prev);
    if (p === 0) return null;
    const d = ((c - p) / Math.abs(p)) * 100;
    const good = hb ? d > 0 : d < 0;
    const arrow = d > 0 ? '▲' : '▼';
    const cls = good ? 'var-cell var-up' : 'var-cell var-down';

    return (
      <>
        <span className={cls}>
          {arrow} {Math.abs(d).toFixed(2)}%
        </span>
        <span className="var-note">
          {shareViewMode === 'Mensal' ? 'vs. mês ant.' : 'vs. período ant.'}
        </span>
      </>
    );
  };

  const varBadgeShare = (
    curr: number | null | undefined,
    prev: number | null | undefined,
    hb: boolean
  ) => {
    if (curr == null || prev == null || isNaN(Number(curr)) || isNaN(Number(prev))) return '—';
    const c = Number(curr);
    const p = Number(prev);
    if (p === 0) return '—';
    const d = ((c - p) / Math.abs(p)) * 100;
    const good = hb ? d > 0 : d < 0;
    const arrow = d > 0 ? '▲' : '▼';
    const cls = good ? 'var-cell var-up' : 'var-cell var-down';

    return (
      <span className={cls}>
        {arrow} {Math.abs(d).toFixed(2)}%
      </span>
    );
  };

  // Insights generation
  const diffPI = (ca.parcela_impressao || 0) - (pa.parcela_impressao || 0);
  let txtPositivo = (
    <ul className="insight-list">
      <li>
        <span style={{ color: '#6B7280' }}>Manutenção:</span> Estabilidade no volume operacional do leilão em relação ao período base.
      </li>
    </ul>
  );
  if (diffPI > 0) {
    txtPositivo = (
      <ul className="insight-list">
        <li>
          <strong>Crescimento de Share:</strong> Aumento de +{diffPI.toFixed(2)} p.p. de participação frente aos concorrentes no leilão.
        </li>
      </ul>
    );
  } else if ((ca.topo_pagina || 0) > (pa.topo_pagina || 0)) {
    txtPositivo = (
      <ul className="insight-list">
        <li>
          <strong>Visibilidade:</strong> Crescimento de +{((ca.topo_pagina || 0) - (pa.topo_pagina || 0)).toFixed(2)} p.p. nas aparições no topo orgânico da pesquisa.
        </li>
      </ul>
    );
  }

  const ofensores: React.ReactNode[] = [];
  if ((ca.perda_orcamento || 0) > 5) {
    ofensores.push(
      <li key="orc">
        <strong>Gargalo de Orçamento:</strong> Restrição diária resultando em perda ativa de {(ca.perda_orcamento || 0).toFixed(2)}% do mercado.
      </li>
    );
  }
  if ((ca.perda_rank || 0) > 10) {
    ofensores.push(
      <li key="rank">
        <strong>Perda de Leilão (Rank):</strong> {(ca.perda_rank || 0).toFixed(2)}% das oportunidades perdidas devido ao Ad Rank baixo.
      </li>
    );
  }

  const txtAtencao =
    ofensores.length > 0 ? (
      <ul className="insight-list">{ofensores}</ul>
    ) : (
      <ul className="insight-list">
        <li>
          <span style={{ color: '#6B7280' }}>Controle:</span> Nenhuma anomalia crítica de perda identificada no último ciclo.
        </li>
      </ul>
    );

  let txtOportunidade = (
    <ul className="insight-list">
      <li>
        <strong>Otimização de Rotina:</strong> Manter a cadência padrão de monitoramento.
      </li>
    </ul>
  );
  if ((ca.perda_orcamento || 0) > (ca.perda_rank || 0) && (ca.perda_orcamento || 0) > 0) {
    txtOportunidade = (
      <ul className="insight-list">
        <li>
          <strong>Expansão Rápida:</strong> Considerar injeção de verba adicional.
        </li>
      </ul>
    );
  } else if ((ca.perda_rank || 0) > 0) {
    txtOportunidade = (
      <ul className="insight-list">
        <li>
          <strong>Revisão Algorítmica:</strong> Necessário analisar flexibilidade do tROAS/tCPA e qualidade dos ativos.
        </li>
      </ul>
    );
  }

  return (
    <div id="page-share" className="page tab-content active">
      {/* Header */}
      <div className="doc-header">
        <div>
          <div className="doc-logo-fallback">LABEST</div>
          <h1 className="doc-title">
            Relatório de Share<br />de Impressão
          </h1>
          <div className="doc-subtitle">Google Ads &middot; Desempenho Analítico</div>
        </div>
        <div className="doc-header-right">
          <div className="header-actions">
            <button
              id="btn-sync-share"
              className={`refresh-btn ${isSyncing ? 'spinning' : ''}`}
              onClick={onRefresh}
              disabled={isSyncing}
            >
              <span className="refresh-icon">↻</span> {isSyncing ? 'Atualizando...' : 'Atualizar Dados'}
            </button>
          </div>
          <div className="doc-meta" style={{ marginTop: '8px' }}>
            Última leitura: <span id="lbl-emissao">{lastUpdatedText || new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>

      {/* Primary Filters */}
      <div
        className="filter-wrapper"
        style={{
          borderBottom: '1px solid var(--border)',
          paddingBottom: '24px',
          marginBottom: '24px',
          justifyContent: 'flex-start',
        }}
      >
        <div className="filter-group">
          <div className="filter-label">VISUALIZAÇÃO</div>
          <div className="seg-btns" id="ui-view-seg">
            {(['Semanal', 'Mensal'] as const).map((s) => (
              <button
                key={s}
                className={`seg-btn ${s === shareViewMode ? 'active' : ''}`}
                onClick={() => setShareViewMode(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <div className="filter-label">DATA INICIAL</div>
          <input
            type="date"
            className="filter-select"
            style={{ minWidth: '130px', height: '38px' }}
            id="ui-date-start"
            value={shareStart}
            onChange={(e) => setShareStart(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <div className="filter-label">DATA FINAL</div>
          <input
            type="date"
            className="filter-select"
            style={{ minWidth: '130px', height: '38px' }}
            id="ui-date-end"
            value={shareEnd}
            onChange={(e) => setShareEnd(e.target.value)}
          />
        </div>

        <div className="filter-group" style={{ flex: 1, maxWidth: '300px' }}>
          <div className="filter-label">CAMPANHA</div>
          <select
            className="filter-select"
            id="ui-camp-sel"
            value={shareCampanha}
            onChange={(e) => setShareCampanha(e.target.value)}
          >
            <option value="Todas">Todas</option>
            {campanhasUnicas.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group" style={{ flex: 1, maxWidth: '200px' }}>
          <div className="filter-label">CANAL</div>
          <select
            className="filter-select"
            id="ui-can-sel"
            value={shareCanal}
            onChange={(e) => setShareCanal(e.target.value)}
          >
            <option value="Todos">Todos</option>
            {canaisUnicos.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Status Segment */}
      <div className="filter-wrapper" style={{ justifyContent: 'flex-start', marginBottom: '24px' }}>
        <div className="filter-group">
          <div className="filter-label">STATUS GADS</div>
          <div className="seg-btns" id="ui-status-seg">
            {['Total', 'Ativo', 'Pausado'].map((s) => (
              <button
                key={s}
                className={`seg-btn ${s === shareStatus ? 'active' : ''}`}
                onClick={() => setShareStatus(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-strip" id="ui-cards">
        <div className="kpi-card orange">
          <div className="kpi-label">PARCELA IMPRESSÃO</div>
          <div className="kpi-value">{fmtPctShare(ca.parcela_impressao)}</div>
          <div className="kpi-sub">{dvShare(ca.parcela_impressao, pa.parcela_impressao, true)}</div>
        </div>

        <div className="kpi-card blue">
          <div className="kpi-label">PERDA RANKING</div>
          <div className="kpi-value">{fmtPctShare(ca.perda_rank)}</div>
          <div className="kpi-sub">{dvShare(ca.perda_rank, pa.perda_rank, false)}</div>
        </div>

        <div className="kpi-card red">
          <div className="kpi-label">PERDA ORÇAMENTO</div>
          <div className="kpi-value">{fmtPctShare(ca.perda_orcamento)}</div>
          <div className="kpi-sub">{dvShare(ca.perda_orcamento, pa.perda_orcamento, false)}</div>
        </div>

        <div className="kpi-card green">
          <div className="kpi-label">TOPO PÁGINA</div>
          <div className="kpi-value">{fmtPctShare(ca.topo_pagina)}</div>
          <div className="kpi-sub">{dvShare(ca.topo_pagina, pa.topo_pagina, true)}</div>
        </div>
      </div>

      {/* Main Table */}
      <div className="table-card table-card-enhanced" style={{ marginBottom: '24px' }}>
        <div className="tc-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div className="tc-title" id="ui-tbl-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Performance {shareViewMode}</span>
              <span className="region-pill">
                {campPill}
              </span>
            </div>
            <div className="doc-meta" id="ui-tbl-meta">
              {shareCanal === 'Todos' ? 'Todos os canais' : shareCanal} &middot; Status {shareStatus} &middot; {displayPeriods.length} períodos
            </div>
          </div>

          {/* Quick Scroll Actions for Large Tables */}
          <div className="table-actions-strip no-print">
            <button
              className="tbl-nav-btn"
              onClick={scrollToOldest}
              title="Ir para o período mais antigo (Esquerda)"
            >
              ⇤ Antigo
            </button>
            <button
              className={`tbl-nav-btn ${!canScrollLeft ? 'disabled' : ''}`}
              onClick={handleScrollLeft}
              disabled={!canScrollLeft}
              title="Rolar para a esquerda"
            >
              ←
            </button>
            <button
              className={`tbl-nav-btn ${!canScrollRight ? 'disabled' : ''}`}
              onClick={handleScrollRight}
              disabled={!canScrollRight}
              title="Rolar para a direita"
            >
              →
            </button>
            <button
              className="tbl-nav-btn"
              onClick={scrollToLatest}
              title="Ir para o período mais recente (Direita)"
            >
              Recente ⇥
            </button>
          </div>
        </div>

        <div
          className="dt-wrapper"
          id="dataTableScrollShare"
          ref={tableScrollRef}
          onScroll={updateScrollState}
        >
          <table className="dt dt-share" id="page-share-table">
            <thead id="ui-tbl-head">
              <tr>
                <th className="col-metric">MÉTRICA</th>
                {displayPeriods.map((p, idx) => {
                  const isLatest = idx === displayPeriods.length - 1;
                  return (
                    <th key={p} className={isLatest ? 'col-latest-header' : ''}>
                      {isLatest && <span className="latest-indicator-tag">ÚLTIMO</span>}
                      {fmtPeriodLabelShare(p, shareViewMode)}
                    </th>
                  );
                })}
                <th className="col-var-header">ÚLT / ANT</th>
              </tr>
            </thead>
            <tbody id="ui-tbl-body">
              {METRICAS_SHARE.map((m) => (
                <tr key={m.key} className="dt-share-row">
                  <td className={`col-metric ${m.cls}`}>{m.label}</td>
                  {displayPeriods.map((p, idx) => {
                    const isLatest = idx === displayPeriods.length - 1;
                    return (
                      <td key={p} className={isLatest ? 'col-latest-cell font-semibold' : ''}>
                        {fmtPctShare(wa[p]?.[m.key])}
                      </td>
                    );
                  })}
                  <td className="col-var-cell">
                    {varBadgeShare(
                      lp ? wa[lp]?.[m.key] : null,
                      pp ? wa[pp]?.[m.key] : null,
                      m.higherBetter
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insights */}
      <div className="insights-wrap">
        <div className="insights-title">Análise &amp; Pontos de Atenção</div>
        <div className="insights-sub" id="ui-insights-sub">
          Destaques gerados com base na variação do último período ({shareViewMode.toLowerCase()}).
        </div>
        <div className="insights-grid" id="ui-insights-grid">
          <div className="insight-card insight-green">
            <div className="insight-hdr">✓ PONTOS POSITIVOS</div>
            <div className="insight-body">{txtPositivo}</div>
          </div>
          <div className="insight-card insight-red">
            <div className="insight-hdr">! PONTOS DE ATENÇÃO</div>
            <div className="insight-body">{txtAtencao}</div>
          </div>
          <div className="insight-card insight-orange">
            <div className="insight-hdr">→ OPORTUNIDADES</div>
            <div className="insight-body">{txtOportunidade}</div>
          </div>
          <div className="insight-card insight-blue">
            <div className="insight-hdr">i NOTAS METODOLÓGICAS</div>
            <div className="insight-body">
              <ul className="insight-list">
                <li>
                  <strong>Filtros ativos:</strong> Canal: {shareCanal}, Status: {shareStatus}.
                </li>
                <li>
                  <strong>Base Analítica:</strong> [
                  {lp ? fmtPeriodLabelShare(lp, shareViewMode) : '—'}] vs [
                  {pp ? fmtPeriodLabelShare(pp, shareViewMode) : '—'}].
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Legenda de Métricas */}
      <div className="legend-wrap">
        <div className="insights-title">Legenda de Métricas</div>
        <div className="insights-sub" style={{ border: 'none', paddingBottom: 0, marginBottom: 0 }}>
          Dicionário de dados com base nas definições oficiais do Google Ads.
        </div>
        <div className="legend-grid">
          <div className="legend-item">
            <strong>Parcela de impressão</strong>
            Percentual das impressões disponíveis capturadas pela campanha.
          </div>
          <div className="legend-item">
            <strong>Perda por ranking</strong>
            Percentual de impressões perdidas por classificação (Ad Rank).
          </div>
          <div className="legend-item">
            <strong>Perda por orçamento</strong>
            Percentual de impressões perdidas por limitação de orçamento.
          </div>
          <div className="legend-item">
            <strong>Topo da página</strong>
            Percentual das impressões exibidas acima dos resultados orgânicos.
          </div>
          <div className="legend-item">
            <strong>Topo absoluto</strong>
            Percentual das impressões exibidas na primeira posição.
          </div>
          <div className="legend-item">
            <strong>Parcela topo pág.</strong>
            Percentual das impressões possíveis no topo da página capturadas pela campanha.
          </div>
          <div className="legend-item">
            <strong>Parcela topo abs.</strong>
            Percentual das impressões possíveis na primeira posição capturadas pela campanha.
          </div>
        </div>
      </div>

      <div className="doc-footer">Labest · Diretoria de Marketing &amp; Growth · Confidencial</div>
    </div>
  );
};
