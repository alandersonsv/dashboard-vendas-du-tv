export interface PerformanceRow {
  data: string;
  invest_google?: number | string;
  invest_meta?: number | string;
  invest_sms?: number | string;
  vendas_total?: number | string;
  vendas_on?: number | string;
  meta_vendas_on?: number | string;
  meta_investimento?: number | string;
  meta_investimento_google?: number | string;
  meta_investimento_meta?: number | string;
  meta_investimento_sms?: number | string;
  vendas_b2c?: number | string;
  vendas_total_b2c?: number | string;
  inv_wpp_mkt?: number | string;
  invest_wpp_marketing?: number | string;
  inv_wpp_util?: number | string;
  invest_wpp_utility?: number | string;
  inv_gemini?: number | string;
  invest_gemini?: number | string;
  inv_outros_gcp?: number | string;
  invest_outros_gcp?: number | string;
}

export interface EnrichedPerformanceRow extends PerformanceRow {
  dateObj: Date;
  isFuture: boolean;
  wppMkt?: number;
  wppUtil?: number;
  gemini?: number;
  gcp?: number;
}

export interface GroupedMonthData {
  label: string;
  allRows: EnrichedPerformanceRow[];
  pastRows: EnrichedPerformanceRow[];
}

export interface WeeklyData {
  metaVendas: number;
  metaInvest: number;
  realVendas: number;
  realInvest: number;
}

export interface ShareItem {
  tipo?: string;
  semana?: string;
  campanha?: string;
  canal?: string;
  status?: string;
  parcela_impressao?: number | string;
  perda_rank?: number | string;
  perda_orcamento?: number | string;
  topo_pagina?: number | string;
  topo_absoluto?: number | string;
  parcela_topo?: number | string;
  parcela_topo_absoluto?: number | string;
  [key: string]: unknown;
}

export interface ShareMetricConfig {
  key: string;
  label: string;
  cls: string;
  higherBetter: boolean;
}

export interface VendasDURecord {
  TipoDado?: string;
  tipodado?: string;
  DataReferencia?: string;
  datareferencia?: string;
  Regiao?: string;
  regiao?: string;
  Subtipo?: string;
  subtipo?: string;
  Consultor?: string;
  consultor?: string;
  MotivoExame?: string;
  motivoexame?: string;
  Categoria?: string;
  categoria?: string;
  Valor?: number | string;
  valor?: number | string;
  json?: {
    TipoDado?: string;
    tipodado?: string;
    DataReferencia?: string;
    datareferencia?: string;
    Regiao?: string;
    regiao?: string;
    Subtipo?: string;
    subtipo?: string;
    Consultor?: string;
    consultor?: string;
    MotivoExame?: string;
    motivoexame?: string;
    Categoria?: string;
    categoria?: string;
    Valor?: number | string;
    valor?: number | string;
  };
}

export interface ParsedDURecord {
  data: string;
  regiao: string;
  subtipo: string;
  consultor: string;
  motivo: string;
  categoria: string;
  valor: number;
}

export interface MesDU {
  key: string;
  label: string;
  ts: number;
}

export interface VendasHoraRecord {
  Data?: string;
  data?: string;
  DataBR?: string;
  databr?: string;
  AnoMes?: string;
  anomes?: string;
  DataReferencia?: string;
  datareferencia?: string;
  DiaSemana?: string;
  diasemana?: string;
  Hora?: number | string;
  hora?: number | string;
  HoraFormatada?: string;
  horaformatada?: string;
  Vendas_Total?: number | string;
  vendas_total?: number | string;
  Vendas_B2C?: number | string;
  vendas_b2c?: number | string;
  Vendas_B2B?: number | string;
  vendas_b2b?: number | string;
  [key: string]: unknown;
}
