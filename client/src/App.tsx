import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Car, Package, Settings, Loader2 } from 'lucide-react';
import { api } from './api';
import { Dashboard } from './Dashboard';
import { VehiclesView } from './VehiclesView';
import { InventoryView } from './InventoryView';
import { SettingsView } from './SettingsView';
import { Card } from './Ui';
import type { Vehicle, ServiceRecord, InventoryItem, Settings as AppSettings } from './types';

type Tab = 'dashboard' | 'vehicles' | 'inventory' | 'settings';

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [refresh, setRefresh] = useState(0);

  const refetch = () => setRefresh((r) => r + 1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      api.get('/vehicles').then((r) => r.data),
      api.get('/services').then((r) => r.data),
      api.get('/inventory').then((r) => r.data),
      api.get('/settings').then((r) => r.data)
    ])
      .then(([v, s, i, st]) => {
        if (!active) return;
        setVehicles(v);
        setServices(s);
        setInventory(i);
        setSettings(st);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => {
      active = false;
    };
  }, [refresh]);

  const tabs: { key: Tab; icon: typeof Home; label: string }[] = [
    { key: 'dashboard', icon: Home, label: 'Home' },
    { key: 'vehicles', icon: Car, label: 'Vehicles' },
    { key: 'inventory', icon: Package, label: 'Stock' },
    { key: 'settings', icon: Settings, label: 'Settings' }
  ];

  return (
    <div className="min-h-screen bg-base-950">
      <div className="max-w-md mx-auto min-h-screen relative bg-gradient-to-b from-base-950 to-[#0f1420] shadow-2xl">
        <main className="p-4 pt-safe-top pb-28">
          {loading ? (
            <div className="h-[80vh] flex flex-col items-center justify-center text-slate-500 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-accent-400" />
              Loading Dipstick...
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.18 }}
              >
                {tab === 'dashboard' && (
                  <Dashboard
                    vehicles={vehicles}
                    services={services}
                    inventory={inventory}
                    onAddVehicle={() => setTab('vehicles')}
                    onVehicle={() => setTab('vehicles')}
                    onService={() => setTab('vehicles')}
                    onInventory={() => setTab('inventory')}
                  />
                )}
                {tab === 'vehicles' && (
                  <VehiclesView vehicles={vehicles} onRefresh={refetch} />
                )}
                {tab === 'inventory' && (
                  <InventoryView items={inventory} onRefresh={refetch} />
                )}
                {tab === 'settings' && (
                  <SettingsView settings={settings} onRefresh={refetch} />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-50 p-3">
          <Card className="max-w-md mx-auto flex items-center justify-around p-2 rounded-2xl glass">
            {tabs.map(({ key, icon: Icon, label }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition ${
                    active ? 'text-accent-300' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{label}</span>
                  {active && (
                    <motion.div
                      layoutId="nav-dot"
                      className="absolute bottom-1 w-1 h-1 rounded-full bg-accent-400"
                    />
                  )}
                </button>
              );
            })}
          </Card>
        </nav>
      </div>
    </div>
  );
}
