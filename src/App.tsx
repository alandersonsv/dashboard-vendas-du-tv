import { useState, useEffect, useCallback } from 'react';
import { VendasDUDashboard } from './components/VendasDUDashboard';
import { fetchVendasDUData } from './services/api';
import { VendasDURecord } from './types';

export default function App() {
  const [vendasDUData, setVendasDUData] = useState<VendasDURecord[]>([]);

  // Fetch Vendas DU Data safely in background
  const loadData = useCallback(async () => {
    try {
      const data = await fetchVendasDUData();
      if (Array.isArray(data) && data.length > 0) {
        setVendasDUData(data);
      }
    } catch {
      // Fallback data is automatically used inside the component
    }
  }, []);

  useEffect(() => {
    loadData();

    // Auto-refresh every 5 minutes in background for TV display
    const timer = setInterval(() => {
      loadData();
    }, 5 * 60 * 1000);

    return () => clearInterval(timer);
  }, [loadData]);

  return <VendasDUDashboard rawData={vendasDUData} />;
}
