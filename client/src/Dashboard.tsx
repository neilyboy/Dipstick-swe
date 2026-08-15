import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Car,
  Droplet,
  Package,
  Wrench,
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus
} from 'lucide-react';
import { Card, Badge, Button } from './Ui';
import type { Vehicle, ServiceRecord, InventoryItem } from './types';

interface DashboardProps {
  vehicles: Vehicle[];
  services: ServiceRecord[];
  inventory: InventoryItem[];
  onAddVehicle: () => void;
  onVehicle: (v: Vehicle) => void;
  onService: (s: ServiceRecord) => void;
  onInventory: () => void;
}

export function Dashboard({
  vehicles,
  services,
  inventory,
  onAddVehicle,
  onVehicle,
  onService,
  onInventory
}: DashboardProps) {
  const stats = useMemo(() => {
    const due = vehicles.filter((v) => v.status === 'due_soon' || v.status === 'overdue');
    const overdue = vehicles.filter((v) => v.status === 'overdue');
    const lowStock = inventory.filter((i) => i.lowStock);
    return { due, overdue, lowStock };
  }, [vehicles, inventory]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6 pb-24"
    >
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="gradient-text">Dipstick</span>
        </h1>
        <p className="text-slate-400 text-sm">Track oil, services, and supplies.</p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Card className="shine relative overflow-hidden bg-gradient-to-br from-accent-500/20 to-violet-500/10 p-4">
          <Car className="w-6 h-6 text-accent-300" />
          <div className="mt-2 text-2xl font-bold">{vehicles.length}</div>
          <div className="text-xs text-slate-400">Vehicles</div>
        </Card>
        <Card className="p-4" onClick={onInventory}>
          <Package className="w-6 h-6 text-emerald-300" />
          <div className="mt-2 text-2xl font-bold">{inventory.length}</div>
          <div className="text-xs text-slate-400">Inventory</div>
        </Card>
        <Card className="p-4">
          <Wrench className="w-6 h-6 text-violet-300" />
          <div className="mt-2 text-2xl font-bold">{services.length}</div>
          <div className="text-xs text-slate-400">Services</div>
        </Card>
        <Card className="p-4" onClick={onInventory}>
          <Droplet className="w-6 h-6 text-amber-300" />
          <div className="mt-2 text-2xl font-bold">{stats.lowStock.length}</div>
          <div className="text-xs text-slate-400">Low stock</div>
        </Card>
      </div>

      <div className="flex gap-3">
        <Button onClick={onAddVehicle} className="flex-1 gap-2">
          <Plus className="w-4 h-4" /> Add vehicle
        </Button>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" /> Attention
        </h2>
        {stats.due.length === 0 ? (
          <Card className="p-6 text-center text-slate-400">
            <CheckCircle className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
            Everything looks good. No upcoming services.
          </Card>
        ) : (
          <div className="space-y-3">
            {stats.due.slice(0, 5).map((v) => (
              <Card
                key={v.id}
                onClick={() => onVehicle(v)}
                className="flex items-center gap-4 p-4"
              >
                <div className="shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br from-base-800 to-base-700 flex items-center justify-center overflow-hidden">
                  {v.coverPhoto ? (
                    <img src={v.coverPhoto} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Car className="w-7 h-7 text-slate-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{v.displayName}</div>
                  <div className="text-xs text-slate-400">
                    {v.milesRemaining != null ? `${v.milesRemaining.toLocaleString()} mi left` : 'No mileage data'}
                  </div>
                </div>
                <Badge color={v.status === 'overdue' ? 'red' : 'amber'}>
                  {v.status === 'overdue' ? 'Overdue' : 'Due soon'}
                </Badge>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Clock className="w-5 h-5 text-accent-300" /> Recent services
        </h2>
        {services.length === 0 ? (
          <Card className="p-6 text-center text-slate-400">No services logged yet.</Card>
        ) : (
          <div className="space-y-3">
            {services.slice(0, 5).map((s) => (
              <Card
                key={s.id}
                onClick={() => onService(s)}
                className="flex items-center justify-between p-4"
              >
                <div>
                  <div className="font-medium">{s.vehicle?.displayName}</div>
                  <div className="text-xs text-slate-400">
                    {new Date(s.serviceDate).toLocaleDateString()} · {s.mileage.toLocaleString()} mi
                  </div>
                </div>
                <div className="text-right text-sm text-slate-300">
                  {s.oilBrand} {s.oilViscosity}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </motion.div>
  );
}
