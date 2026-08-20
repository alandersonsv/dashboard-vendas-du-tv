import { PerformanceRow, ShareItem, VendasDURecord, VendasHoraRecord } from '../types';

export const WEBHOOK_SYNC_URL = 'https://n8n.labest.com.br/webhook/unificado_vendas_invest';
export const WEBHOOK_GET_URL = 'https://n8n.labest.com.br/webhook/obter-dashboard';
export const WEBHOOK_CSV_UPLOAD = 'https://n8n.labest.com.br/webhook/import-metas';
export const WEBHOOK_PURCHASES_URL = 'https://n8n.labest.com.br/webhook/obter-purchase';
export const WEBHOOK_SHARE_URL = 'https://n8n.labest.com.br/webhook/gads-impression-share';
export const WEBHOOK_VENDAS_DU_URL = 'https://n8n.labest.com.br/webhook/get-vendas-du';
export const WEBHOOK_VENDAS_HORA_URL = 'https://n8n.labest.com.br/webhook/vendas-hora';
export const N8N_CHAT_WEBHOOK = 'https://n8n.labest.com.br/webhook/04c5d4bd-5051-4138-9cee-2bae4e849f06/chat';

export async function syncPerformanceData(): Promise<void> {
  const res = await fetch(WEBHOOK_SYNC_URL, { method: 'POST' });
  if (!res.ok) {
    throw new Error(`HTTP Error ${res.status} ao sincronizar com n8n`);
  }
}

export async function fetchPerformanceData(): Promise<PerformanceRow[]> {
  const res = await fetch(WEBHOOK_GET_URL);
  if (!res.ok) {
    throw new Error(`HTTP Error ${res.status} ao obter dados de performance`);
  }
  return res.json();
}

export async function fetchPurchasesToday(): Promise<number> {
  try {
    const res = await fetch(WEBHOOK_PURCHASES_URL);
    if (!res.ok) return 0;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      const todayStr = `${dd}/${mm}/${yyyy}`;

      const todayRec = data.find((d: { Dia?: string; purchases?: number; Purchases?: number }) =>
        d.Dia && d.Dia.includes(todayStr)
      );

      if (todayRec) {
        return Number(todayRec.Purchases || todayRec.purchases || 0);
      } else {
        const lastRec = data[data.length - 1];
        return Number(lastRec.Purchases || lastRec.purchases || 0);
      }
    }
    return 0;
  } catch (e) {
    console.warn('Erro ao buscar Purchases Hoje:', e);
    return 0;
  }
}

export async function uploadMetasCSV(file: File): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(WEBHOOK_CSV_UPLOAD, { method: 'POST', body: formData });
  if (!res.ok) {
    throw new Error(`HTTP Error ${res.status} ao enviar CSV`);
  }
}

export async function fetchShareData(): Promise<ShareItem[]> {
  const res = await fetch(WEBHOOK_SHARE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`HTTP Error ${res.status} ao obter dados de Share de Impressão`);
  }
  return res.json();
}

export async function fetchVendasDUData(): Promise<VendasDURecord[]> {
  try {
    const res = await fetch(WEBHOOK_VENDAS_DU_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    });
    if (res.ok) {
      const text = await res.text();
      if (text) {
        const json = JSON.parse(text);
        if (Array.isArray(json)) return json;
      }
    }
  } catch {
    // Silent catch, try GET fallback
  }

  // Fallback to GET
  try {
    const resGet = await fetch(WEBHOOK_VENDAS_DU_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (resGet.ok) {
      const text = await resGet.text();
      if (text) {
        const json = JSON.parse(text);
        if (Array.isArray(json)) return json;
      }
    }
  } catch {
    // Silent catch
  }

  return [];
}

// Load / Sync Vendas por Hora via /webhook/vendas-hora
export async function fetchVendasHoraData(): Promise<VendasHoraRecord[]> {
  try {
    const res = await fetch(WEBHOOK_VENDAS_HORA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch (postErr) {
    console.warn('POST para vendas-hora falhou, tentando GET:', postErr);
  }

  // Fallback GET
  try {
    const resGet = await fetch(WEBHOOK_VENDAS_HORA_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (resGet.ok) {
      const data = await resGet.json();
      if (Array.isArray(data)) return data;
    }
  } catch (getErr) {
    console.warn('GET para vendas-hora também falhou:', getErr);
  }

  return [];
}

export const syncAndFetchVendasHora = fetchVendasHoraData;
export const fetchVendasHoraInitial = fetchVendasHoraData;

