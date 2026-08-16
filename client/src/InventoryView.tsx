import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Package,
  Plus,
  ArrowLeft,
  Save,
  Minus,
  Search,
  Droplet,
  Filter,
  CircleDot,
  Wrench,
  Boxes,
  MapPin,
  Tag
} from 'lucide-react';
import { api } from './api';
import { Button, Input, Card, Badge } from './Ui';
import type { InventoryItem } from './types';

interface InventoryViewProps {
  items: InventoryItem[];
  onRefresh: () => void;
}

const categoryConfig: Record<string, { icon: typeof Package; label: string }> = {
  oil: { icon: Droplet, label: 'Oil' },
  filter: { icon: Filter, label: 'Filter' },
  washer: { icon: CircleDot, label: 'Washer' },
  gasket: { icon: CircleDot, label: 'Gasket' },
  tool: { icon: Wrench, label: 'Tool' },
  supply: { icon: Boxes, label: 'Supply' },
  other: { icon: Package, label: 'Other' }
};

const categories = ['all', 'oil', 'filter', 'washer', 'gasket', 'tool', 'supply', 'other'];

export function InventoryView({ items, onRefresh }: InventoryViewProps) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const filtered = useMemo(() => {
    let list = items;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.brand && i.brand.toLowerCase().includes(q)) ||
          (i.partNumber && i.partNumber.toLowerCase().includes(q))
      );
    }
    if (category !== 'all') list = list.filter((i) => i.category === category);
    return list;
  }, [items, search, category]);

  const stats = useMemo(() => {
    const total = items.length;
    const lowStock = items.filter((i) => i.lowStock).length;
    const totalValue = items.reduce((sum, i) => sum + (i.costPerUnit ?? 0) * i.quantity, 0);
    return { total, lowStock, totalValue };
  }, [items]);

  const adjust = async (id: string, delta: number) => {
    try {
      await api.post(`/inventory/${id}/adjust`, { quantity: delta });
      onRefresh();
    } catch (err) {
      toast.error(String(err));
    }
  };

  if (showForm) {
    return <InventoryForm onBack={() => setShowForm(false)} onSaved={onRefresh} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="pb-24 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Inventory</h2>
        <Button onClick={() => setShowForm(true)} className="p-3">
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-accent-300">{stats.total}</div>
          <div className="text-xs text-slate-500 mt-0.5">Items</div>
        </Card>
        <Card className={`p-3 text-center ${stats.lowStock > 0 ? 'border-rose-500/30' : ''}`}>
          <div className={`text-2xl font-bold ${stats.lowStock > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
            {stats.lowStock}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Low stock</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-emerald-400">
            ${stats.totalValue.toFixed(0)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Value</div>
        </Card>
      </div>

      {/* Search + filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input value={search} onChange={setSearch} placeholder="Search items..." className="!pl-9" />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-xl border border-white/10 bg-base-900/60 px-3 text-sm text-slate-100"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === 'all' ? 'All' : categoryConfig[c]?.label ?? c}
            </option>
          ))}
        </select>
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
        {categories.map((c) => {
          const isActive = category === c;
          const cfg = c !== 'all' ? categoryConfig[c] : null;
          const Icon = cfg?.icon ?? Boxes;
          const count = c === 'all' ? items.length : items.filter((i) => i.category === c).length;
          if (count === 0 && c !== 'all') return null;
          return (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                isActive
                  ? 'bg-accent-500 text-white'
                  : 'bg-base-900/60 text-slate-400 hover:bg-base-800 border border-white/10'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {c === 'all' ? 'All' : cfg?.label ?? c}
              <span className={`ml-0.5 ${isActive ? 'text-white/70' : 'text-slate-600'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-slate-400">
          <Package className="w-10 h-10 mx-auto text-slate-600 mb-3" />
          No inventory items found.
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const catCfg = categoryConfig[item.category] ?? categoryConfig.other;
            const CatIcon = catCfg.icon;
            const stockPct = item.lowStockThreshold > 0
              ? Math.min(100, (item.quantity / (item.lowStockThreshold * 3)) * 100)
              : 100;
            const stockColor = item.lowStock
              ? 'bg-rose-500'
              : stockPct < 50
                ? 'bg-amber-500'
                : 'bg-emerald-500';

            return (
              <Card key={item.id} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                    item.lowStock ? 'bg-rose-500/15' : 'bg-base-800'
                  }`}>
                    <CatIcon className={`w-5 h-5 ${item.lowStock ? 'text-rose-400' : 'text-slate-400'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{item.name}</div>
                    <div className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                      {item.brand && <span className="inline-flex items-center gap-0.5">
                        <Tag className="w-3 h-3" />{item.brand}
                      </span>}
                      {item.partNumber && <span className="text-slate-500">#{item.partNumber}</span>}
                    </div>
                    {item.storageLocation && (
                      <div className="text-xs text-slate-500 flex items-center gap-0.5 mt-0.5">
                        <MapPin className="w-3 h-3" />{item.storageLocation}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-semibold">
                      {item.quantity}
                      <span className="text-xs font-normal text-slate-400 ml-1">{item.unitType}</span>
                    </div>
                    {item.lowStock ? (
                      <Badge color="red">Low</Badge>
                    ) : (
                      <Badge color="green">OK</Badge>
                    )}
                  </div>
                </div>

                {/* Stock progress bar */}
                <div className="h-1.5 rounded-full bg-base-900 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${stockColor}`}
                    style={{ width: `${stockPct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  {item.costPerUnit != null && (
                    <div className="text-xs text-slate-500">
                      ${item.costPerUnit.toFixed(2)}/{item.unitType}
                      {item.quantity > 1 && (
                        <span className="text-slate-600 ml-1">
                          · ${((item.costPerUnit ?? 0) * item.quantity).toFixed(2)} total
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2 ml-auto">
                    <Button
                      variant="ghost"
                      onClick={() => adjust(item.id, -1)}
                      className="px-3 py-1.5"
                      disabled={item.quantity <= 0}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => adjust(item.id, 1)}
                      className="px-3 py-1.5"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function InventoryForm({
  onBack,
  onSaved
}: {
  onBack: () => void;
  onSaved: () => void;
}) {
  const [data, setData] = useState<{
    name: string;
    category: string;
    brand: string;
    partNumber: string;
    barcode: string;
    quantity?: number;
    unitType: string;
    lowStockThreshold?: number;
    costPerUnit: string;
    storageLocation: string;
    notes: string;
  }>({
    name: '',
    category: 'oil',
    brand: '',
    partNumber: '',
    barcode: '',
    quantity: 1,
    unitType: 'quart',
    lowStockThreshold: 1,
    costPerUnit: '',
    storageLocation: '',
    notes: ''
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/inventory', {
        ...data,
        quantity: Number(data.quantity) || 0,
        lowStockThreshold: Number(data.lowStockThreshold) || 0,
        costPerUnit: data.costPerUnit ? Number(data.costPerUnit) : undefined
      });
      toast.success('Inventory added');
      onSaved();
      onBack();
    } catch (err) {
      toast.error(String(err));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="p-2 rounded-full hover:bg-white/5">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold">Add inventory</h2>
      </div>

      <Input label="Name" value={data.name} onChange={(v) => setData({ ...data, name: v })} placeholder="e.g. Mobil 1 5W-30" />

      <div className="space-y-3 pt-2 border-t border-white/5">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Classification</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Category</span>
            <select
              value={data.category}
              onChange={(e) => setData({ ...data, category: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-base-900/60 px-4 py-3 text-sm text-slate-100"
            >
              {categories
                .filter((c) => c !== 'all')
                .map((c) => (
                  <option key={c} value={c}>
                    {categoryConfig[c]?.label ?? c}
                  </option>
                ))}
            </select>
          </label>
          <Input label="Brand" value={data.brand} onChange={(v) => setData({ ...data, brand: v })} placeholder="e.g. Mobil 1" />
          <Input label="Part number" value={data.partNumber} onChange={(v) => setData({ ...data, partNumber: v })} placeholder="e.g. M1-110" />
          <Input label="Barcode" value={data.barcode} onChange={(v) => setData({ ...data, barcode: v })} placeholder="Optional" />
        </div>
      </div>

      <div className="space-y-3 pt-2 border-t border-white/5">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Stock</h3>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Quantity" type="number" value={data.quantity} onChange={(v) => setData({ ...data, quantity: v === '' ? undefined : Number(v) })} />
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Unit type</span>
            <select
              value={data.unitType}
              onChange={(e) => setData({ ...data, unitType: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-base-900/60 px-4 py-3 text-sm text-slate-100"
            >
              <option value="quart">quart</option>
              <option value="gallon">gallon</option>
              <option value="liter">liter</option>
              <option value="each">each</option>
              <option value="set">set</option>
              <option value="box">box</option>
              <option value="pair">pair</option>
            </select>
          </label>
          <Input label="Low stock alert" type="number" value={data.lowStockThreshold} onChange={(v) => setData({ ...data, lowStockThreshold: v === '' ? undefined : Number(v) })} />
          <Input label="Cost per unit" type="number" step="0.01" value={data.costPerUnit} onChange={(v) => setData({ ...data, costPerUnit: v })} placeholder="0.00" />
        </div>
      </div>

      <div className="space-y-3 pt-2 border-t border-white/5">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Location</h3>
        <Input label="Storage location" value={data.storageLocation} onChange={(v) => setData({ ...data, storageLocation: v })} placeholder="e.g. Garage shelf B" />
      </div>

      <Input label="Notes" rows={3} value={data.notes} onChange={(v) => setData({ ...data, notes: v })} />

      <Button type="submit" className="w-full gap-2">
        <Save className="w-4 h-4" /> Save item
      </Button>
    </form>
  );
}
