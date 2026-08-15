import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Package, Plus, ArrowLeft, Save, Minus, Plus as PlusIcon, Search } from 'lucide-react';
import { api } from './api';
import { Button, Input, Card, Badge } from './Ui';
import type { InventoryItem } from './types';

interface InventoryViewProps {
  items: InventoryItem[];
  onRefresh: () => void;
}

const categories = ['all', 'oil', 'filter', 'washer', 'gasket', 'tool', 'supply', 'other'];

export function InventoryView({ items, onRefresh }: InventoryViewProps) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const filtered = useMemo(() => {
    let list = items;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q) || (i.brand && i.brand.toLowerCase().includes(q)));
    }
    if (category !== 'all') list = list.filter((i) => i.category === category);
    return list;
  }, [items, search, category]);

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
              {c}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-slate-400">
          <Package className="w-10 h-10 mx-auto text-slate-600 mb-3" />
          No inventory yet.
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{item.name}</div>
                  <div className="text-xs text-slate-400">
                    {item.brand} {item.partNumber}
                  </div>
                  <div className="text-xs text-slate-500">{item.storageLocation}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-semibold">
                    {item.quantity} <span className="text-xs font-normal text-slate-400">{item.unitType}</span>
                  </div>
                  {item.lowStock && <Badge color="red">Low</Badge>}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button
                  variant="ghost"
                  onClick={() => adjust(item.id, -1)}
                  className="flex-1 py-2"
                  disabled={item.quantity <= 0}
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => adjust(item.id, 1)}
                  className="flex-1 py-2"
                >
                  <PlusIcon className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
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
      <Input label="Name" value={data.name} onChange={(v) => setData({ ...data, name: v })} />
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
                  {c}
                </option>
              ))}
          </select>
        </label>
        <Input label="Brand" value={data.brand} onChange={(v) => setData({ ...data, brand: v })} />
        <Input label="Part number" value={data.partNumber} onChange={(v) => setData({ ...data, partNumber: v })} />
        <Input label="Barcode" value={data.barcode} onChange={(v) => setData({ ...data, barcode: v })} />
        <Input label="Quantity" type="number" value={data.quantity} onChange={(v) => setData({ ...data, quantity: v === '' ? undefined : Number(v) })} />
        <Input label="Unit" value={data.unitType} onChange={(v) => setData({ ...data, unitType: v })} />
        <Input label="Low stock threshold" type="number" value={data.lowStockThreshold} onChange={(v) => setData({ ...data, lowStockThreshold: v === '' ? undefined : Number(v) })} />
        <Input label="Cost per unit" type="number" step="0.01" value={data.costPerUnit} onChange={(v) => setData({ ...data, costPerUnit: v })} />
        <Input label="Storage" value={data.storageLocation} onChange={(v) => setData({ ...data, storageLocation: v })} />
      </div>
      <Input label="Notes" rows={3} value={data.notes} onChange={(v) => setData({ ...data, notes: v })} />
      <Button type="submit" className="w-full gap-2">
        <Save className="w-4 h-4" /> Save item
      </Button>
    </form>
  );
}
