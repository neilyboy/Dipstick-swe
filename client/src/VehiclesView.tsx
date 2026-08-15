import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Car,
  AlertTriangle,
  Clock,
  Wrench,
  FileText,
  Plus,
  Save,
  Trash,
  Camera,
  Search,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { api } from './api';
import { Button, Input, Card, Badge } from './Ui';
import type { ServiceRecord, Vehicle } from './types';

interface VehiclesViewProps {
  vehicles: Vehicle[];
  onRefresh: () => void;
}

type Mode = 'list' | 'form' | 'detail' | 'service';

const statusColors: Record<string, 'green' | 'amber' | 'red' | 'neutral'> = {
  up_to_date: 'green',
  due_soon: 'amber',
  overdue: 'red',
  unknown: 'neutral'
};

export function VehiclesView({ vehicles, onRefresh }: VehiclesViewProps) {
  const [mode, setMode] = useState<Mode>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const selected = useMemo(
    () => vehicles.find((v) => v.id === selectedId) || null,
    [vehicles, selectedId]
  );

  const filtered = useMemo(() => {
    let list = vehicles;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (v) =>
          v.displayName.toLowerCase().includes(q) ||
          (v.make && v.make.toLowerCase().includes(q)) ||
          (v.model && v.model.toLowerCase().includes(q)) ||
          (v.vin && v.vin.toLowerCase().includes(q))
      );
    }
    if (filter !== 'all') list = list.filter((v) => v.status === filter);
    return list;
  }, [vehicles, search, filter]);

  const openDetail = (v: Vehicle) => {
    setSelectedId(v.id);
    setMode('detail');
  };

  const openForm = (v?: Vehicle) => {
    setSelectedId(v?.id || null);
    setMode('form');
  };

  const openService = (v: Vehicle) => {
    setSelectedId(v.id);
    setMode('service');
  };

  const backToList = () => {
    setMode('list');
    setSelectedId(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="pb-24"
    >
      {mode === 'list' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Vehicles</h2>
            <Button onClick={() => openForm()} className="gap-2 p-3">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                value={search}
                onChange={setSearch}
                placeholder="Search..."
                className="!pl-9"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-base-900/60 px-3 text-sm text-slate-100"
            >
              <option value="all">All</option>
              <option value="up_to_date">Good</option>
              <option value="due_soon">Due soon</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          {filtered.length === 0 ? (
            <Card className="p-8 text-center text-slate-400">
              <Car className="w-10 h-10 mx-auto text-slate-600 mb-3" />
              No vehicles yet.
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((v) => (
                <Card
                  key={v.id}
                  onClick={() => openDetail(v)}
                  className="flex items-center gap-4 p-4 shine"
                >
                  <div className="shrink-0 w-16 h-16 rounded-xl bg-gradient-to-br from-base-800 to-base-700 overflow-hidden flex items-center justify-center">
                    {v.coverPhoto ? (
                      <img
                        src={v.coverPhoto}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Car className="w-8 h-8 text-slate-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{v.displayName}</div>
                    <div className="text-xs text-slate-400 truncate">
                      {v.year} {v.make} {v.model}
                    </div>
                    <div className="text-xs text-slate-500">
                      {v.currentMileage?.toLocaleString()} mi
                    </div>
                  </div>
                  <Badge color={statusColors[v.status] || 'neutral'}>
                    {v.status.replace(/_/g, ' ')}
                  </Badge>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === 'detail' && selected && (
        <VehicleDetail
          vehicle={selected}
          onBack={backToList}
          onEdit={() => openForm(selected)}
          onAddService={() => openService(selected)}
          onRefresh={onRefresh}
        />
      )}

      {mode === 'form' && (
        <VehicleForm
          vehicle={selected || undefined}
          onBack={backToList}
          onSaved={() => {
            onRefresh();
            backToList();
          }}
        />
      )}

      {mode === 'service' && selected && (
        <ServiceForm
          vehicle={selected}
          onBack={() => setMode('detail')}
          onSaved={() => {
            onRefresh();
            setMode('detail');
          }}
        />
      )}
    </motion.div>
  );
}

function VehicleDetail({
  vehicle,
  onBack,
  onEdit,
  onAddService,
  onRefresh
}: {
  vehicle: Vehicle;
  onBack: () => void;
  onEdit: () => void;
  onAddService: () => void;
  onRefresh: () => void;
}) {
  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('photo', file);
    try {
      await api.post(`/vehicles/${vehicle.id}/photos`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Photo updated');
      onRefresh();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const exportPdf = () => {
    window.open(`/api/exports/vehicle/${vehicle.id}/pdf`, '_blank');
  };

  const deleteVehicle = async () => {
    if (!confirm('Archive this vehicle?')) return;
    await api.delete(`/vehicles/${vehicle.id}`);
    toast.success('Archived');
    onRefresh();
    onBack();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-white/5">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold truncate">{vehicle.displayName}</h2>
      </div>

      <div className="relative h-48 rounded-2xl overflow-hidden bg-gradient-to-br from-base-800 to-base-700 flex items-center justify-center">
        {vehicle.coverPhoto ? (
          <img src={vehicle.coverPhoto} alt="" className="w-full h-full object-cover" />
        ) : (
          <Car className="w-20 h-20 text-slate-600" />
        )}
        <label className="absolute bottom-3 right-3 glass rounded-xl p-2 cursor-pointer hover:bg-white/10 transition">
          <Camera className="w-4 h-4" />
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
        </label>
      </div>

      <div className="flex items-center justify-between">
        <Badge color={statusColors[vehicle.status] || 'neutral'}>
          {vehicle.status.replace(/_/g, ' ')}
        </Badge>
        <div className="text-sm text-slate-400">
          {vehicle.currentMileage?.toLocaleString()} mi
        </div>
      </div>

      {vehicle.status !== 'up_to_date' && vehicle.status !== 'unknown' && (
        <Card className="p-4 border-l-4 border-l-amber-400 bg-amber-500/5">
          <div className="flex items-start gap-3">
            {vehicle.status === 'overdue' ? (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            ) : (
              <Clock className="w-5 h-5 text-amber-400 shrink-0" />
            )}
            <div>
              <div className="font-medium">
                {vehicle.status === 'overdue' ? 'Service overdue' : 'Service due soon'}
              </div>
              <div className="text-sm text-slate-400">
                {vehicle.milesRemaining != null
                  ? `${vehicle.milesRemaining.toLocaleString()} miles remaining`
                  : 'Check service date'}
                {vehicle.daysRemaining != null && ` · ${vehicle.daysRemaining} days`}
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button onClick={onAddService} className="gap-2">
          <Wrench className="w-4 h-4" /> Add service
        </Button>
        <Button onClick={exportPdf} variant="secondary" className="gap-2">
          <FileText className="w-4 h-4" /> PDF
        </Button>
      </div>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-slate-200">Vehicle details</h3>
        <DetailRow label="VIN" value={vehicle.vin} />
        <DetailRow label="Year" value={vehicle.year} />
        <DetailRow label="Make" value={vehicle.make} />
        <DetailRow label="Model" value={vehicle.model} />
        <DetailRow label="Engine" value={vehicle.engine} />
        <DetailRow label="Plate" value={vehicle.licensePlate} />
        <DetailRow label="Oil spec" value={`${vehicle.oilBrandPref} ${vehicle.oilViscosity}`} />
        <DetailRow label="Filter" value={vehicle.filterPartNumber} />
        <DetailRow label="Interval" value={`${vehicle.intervalMiles} mi / ${vehicle.intervalMonths} mo`} />
        {vehicle.notes && <div className="text-sm text-slate-400 pt-2 border-t border-white/5">{vehicle.notes}</div>}
      </Card>

      <ServiceHistory vehicleId={vehicle.id} />

      <div className="flex gap-3">
        <Button onClick={onEdit} variant="secondary" className="flex-1 gap-2">
          <SlidersHorizontal className="w-4 h-4" /> Edit
        </Button>
        <Button onClick={deleteVehicle} variant="danger" className="flex-1 gap-2">
          <Trash className="w-4 h-4" /> Archive
        </Button>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200">{value}</span>
    </div>
  );
}

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 p-2 rounded-full glass hover:bg-white/10 transition"
        onClick={onClose}
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={src}
        alt=""
        className="max-w-full max-h-full rounded-xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function ServiceHistory({ vehicleId }: { vehicleId: string }) {
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    api.get<ServiceRecord[]>(`/services?vehicleId=${vehicleId}`)
      .then((res) => setServices(res.data))
      .catch(() => setServices([]));
  }, [vehicleId]);

  if (services.length === 0) return null;

  return (
    <>
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-slate-200">Service history</h3>
        <div className="space-y-2">
          {services.map((s) => {
            const isOpen = expanded === s.id;
            return (
              <div key={s.id} className="rounded-xl border border-white/10 bg-base-900/40 overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : s.id)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-white/5 transition"
                >
                  <div>
                    <div className="font-medium text-sm">
                      {new Date(s.serviceDate).toLocaleDateString()} · {s.mileage.toLocaleString()} mi
                    </div>
                    <div className="text-xs text-slate-500">
                      {s.oilBrand ? `${s.oilBrand} ${s.oilViscosity}` : 'Service record'}
                      {s.cost != null ? ` · $${s.cost.toFixed(2)}` : ''}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">{isOpen ? '▾' : '▸'}</div>
                </button>
                {isOpen && (
                  <div className="p-3 pt-0 space-y-3 border-t border-white/5">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <DetailRow label="Oil" value={`${s.oilBrand ?? ''} ${s.oilProduct ?? ''} ${s.oilViscosity ?? ''}`.trim()} />
                      <DetailRow label="Filter" value={`${s.filterBrand ?? ''} ${s.filterModel ?? ''}`.trim()} />
                      <DetailRow label="Qty" value={s.oilQuantity} />
                      <DetailRow label="Performed by" value={s.performedBy} />
                      <DetailRow label="Cost" value={s.cost != null ? `$${s.cost.toFixed(2)}` : undefined} />
                      <DetailRow label="Notes" value={s.notes} />
                    </div>
                    {s.photos && s.photos.length > 0 && (
                      <div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Photos</div>
                        <div className="grid grid-cols-4 gap-2">
                          {s.photos.map((p) => (
                            <img
                              key={p}
                              src={`/uploads/${p}`}
                              alt=""
                              className="h-16 w-full object-cover rounded-lg cursor-pointer hover:opacity-80 transition"
                              onClick={() => setLightboxSrc(`/uploads/${p}`)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {s.receipts && s.receipts.length > 0 && (
                      <div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Receipts</div>
                        <div className="grid grid-cols-4 gap-2">
                          {s.receipts.map((r) => (
                            <img
                              key={r}
                              src={`/uploads/${r}`}
                              alt=""
                              className="h-16 w-full object-cover rounded-lg cursor-pointer hover:opacity-80 transition"
                              onClick={() => setLightboxSrc(`/uploads/${r}`)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}

function VehicleForm({
  vehicle,
  onBack,
  onSaved
}: {
  vehicle?: Vehicle;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [data, setData] = useState<Partial<Vehicle>>({
    displayName: vehicle?.displayName ?? '',
    vin: vehicle?.vin ?? '',
    year: vehicle?.year,
    make: vehicle?.make ?? '',
    model: vehicle?.model ?? '',
    engine: vehicle?.engine ?? '',
    currentMileage: vehicle?.currentMileage,
    licensePlate: vehicle?.licensePlate ?? '',
    oilBrandPref: vehicle?.oilBrandPref ?? '',
    oilViscosity: vehicle?.oilViscosity ?? '',
    filterPartNumber: vehicle?.filterPartNumber ?? '',
    intervalMiles: vehicle?.intervalMiles ?? 5000,
    intervalMonths: vehicle?.intervalMonths ?? 6,
    reminderLeadMiles: vehicle?.reminderLeadMiles ?? 500,
    reminderLeadDays: vehicle?.reminderLeadDays ?? 30,
    notes: vehicle?.notes ?? ''
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [vinLoading, setVinLoading] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const decodeVin = async () => {
    const vin = data.vin?.trim() ?? '';
    if (vin.length !== 17) {
      toast.error('Enter a 17-character VIN');
      return;
    }
    setVinLoading(true);
    try {
      const res = await api.get(`/vin/${vin}`);
      const d = res.data as Partial<Vehicle>;
      setData((prev) => ({
        ...prev,
        year: d.year ?? prev.year,
        make: d.make ?? prev.make,
        model: d.model ?? prev.model,
        engine: d.engine ?? prev.engine
      }));
      toast.success('VIN decoded');
    } catch (err) {
      toast.error(String(err));
    } finally {
      setVinLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (vehicle) {
        await api.put(`/vehicles/${vehicle.id}`, data);
      } else {
        const form = new FormData();
        Object.entries(data).forEach(([key, val]) => {
          if (val === undefined || val === null) return;
          form.append(key, String(val));
        });
        if (coverFile) form.append('coverPhoto', coverFile);
        await api.post('/vehicles', form);
      }
      toast.success(vehicle ? 'Vehicle updated' : 'Vehicle added');
      onSaved();
    } catch (err) {
      toast.error(String(err));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="p-2 rounded-full hover:bg-white/5">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold">{vehicle ? 'Edit vehicle' : 'New vehicle'}</h2>
      </div>

      {!vehicle && (
        <label className="block group cursor-pointer">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1.5">Cover photo</span>
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
          <div className="relative h-40 rounded-2xl border border-dashed border-white/20 bg-base-900/40 flex flex-col items-center justify-center overflow-hidden hover:border-accent-500/50 transition">
            {previewUrl ? (
              <img src={previewUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <>
                <Camera className="w-8 h-8 text-slate-500 mb-2" />
                <span className="text-sm text-slate-500">Tap to take a photo or choose from gallery</span>
              </>
            )}
          </div>
        </label>
      )}

      <Input label="Display name" value={data.displayName} onChange={(v) => setData({ ...data, displayName: v })} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Year" type="number" value={data.year} onChange={(v) => setData({ ...data, year: v === '' ? undefined : Number(v) })} />
        <Input label="Make" value={data.make} onChange={(v) => setData({ ...data, make: v })} />
        <Input label="Model" value={data.model} onChange={(v) => setData({ ...data, model: v })} />
        <Input label="Engine" value={data.engine} onChange={(v) => setData({ ...data, engine: v })} />
      </div>
      <div className="grid grid-cols-[1fr,auto] gap-3 items-end">
        <Input
          label="VIN"
          value={data.vin}
          onChange={(v) => setData({ ...data, vin: v.toUpperCase() })}
          placeholder="1HGBH41JXMN109186"
        />
        <Button
          type="button"
          onClick={decodeVin}
          disabled={vinLoading}
          variant="secondary"
          className="gap-2 h-[46px]"
        >
          <Search className="w-4 h-4" /> {vinLoading ? '...' : 'Lookup'}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="License plate" value={data.licensePlate} onChange={(v) => setData({ ...data, licensePlate: v })} />
        <Input
          label="Current mileage"
          type="number"
          value={data.currentMileage}
          onChange={(v) => setData({ ...data, currentMileage: v === '' ? undefined : Number(v) })}
        />
      </div>

      <div className="space-y-3 pt-4 border-t border-white/5">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Oil preferences</h3>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Brand" value={data.oilBrandPref} onChange={(v) => setData({ ...data, oilBrandPref: v })} />
          <Input label="Viscosity" value={data.oilViscosity} onChange={(v) => setData({ ...data, oilViscosity: v })} />
        </div>
        <Input label="Filter part number" value={data.filterPartNumber} onChange={(v) => setData({ ...data, filterPartNumber: v })} />
      </div>

      <div className="space-y-3 pt-4 border-t border-white/5">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Intervals</h3>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Miles" type="number" value={data.intervalMiles} onChange={(v) => setData({ ...data, intervalMiles: v === '' ? undefined : Number(v) })} />
          <Input label="Months" type="number" value={data.intervalMonths} onChange={(v) => setData({ ...data, intervalMonths: v === '' ? undefined : Number(v) })} />
          <Input label="Lead miles" type="number" value={data.reminderLeadMiles} onChange={(v) => setData({ ...data, reminderLeadMiles: v === '' ? undefined : Number(v) })} />
          <Input label="Lead days" type="number" value={data.reminderLeadDays} onChange={(v) => setData({ ...data, reminderLeadDays: v === '' ? undefined : Number(v) })} />
        </div>
      </div>

      <Input label="Notes" rows={3} value={data.notes} onChange={(v) => setData({ ...data, notes: v })} />

      <Button type="submit" className="w-full gap-2">
        <Save className="w-4 h-4" /> Save vehicle
      </Button>
    </form>
  );
}

function ServiceForm({
  vehicle,
  onBack,
  onSaved
}: {
  vehicle: Vehicle;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [data, setData] = useState<{
    serviceDate: string;
    mileage?: number;
    oilBrand: string;
    oilProduct: string;
    oilViscosity: string;
    oilQuantity?: number;
    filterBrand: string;
    filterModel: string;
    performedBy: string;
    cost: string;
    notes: string;
  }>({
    serviceDate: new Date().toISOString().split('T')[0],
    mileage: vehicle.currentMileage ?? 0,
    oilBrand: '',
    oilProduct: '',
    oilViscosity: vehicle.oilViscosity ?? '',
    oilQuantity: 5,
    filterBrand: '',
    filterModel: vehicle.filterPartNumber ?? '',
    performedBy: 'self',
    cost: '',
    notes: ''
  });
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);

  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoFiles((prev) => [...prev, ...Array.from(e.target.files || [])]);
  };

  const handleReceipts = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReceiptFiles((prev) => [...prev, ...Array.from(e.target.files || [])]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const form = new FormData();
      form.append('vehicleId', vehicle.id);
      form.append('serviceDate', new Date(data.serviceDate).toISOString());
      form.append('mileage', String(data.mileage ?? 0));
      form.append('oilBrand', data.oilBrand);
      form.append('oilProduct', data.oilProduct);
      form.append('oilViscosity', data.oilViscosity);
      form.append('oilQuantity', String(data.oilQuantity ?? 0));
      form.append('filterBrand', data.filterBrand);
      form.append('filterModel', data.filterModel);
      form.append('performedBy', data.performedBy);
      form.append('cost', data.cost ? String(Number(data.cost)) : '');
      form.append('notes', data.notes);
      photoFiles.forEach((f) => form.append('photos', f));
      receiptFiles.forEach((f) => form.append('receipts', f));
      await api.post('/services', form);
      toast.success('Service logged');
      onSaved();
    } catch (err) {
      toast.error(String(err));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="p-2 rounded-full hover:bg-white/5">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold">Add service</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Date"
          type="date"
          value={data.serviceDate}
          onChange={(v) => setData({ ...data, serviceDate: v })}
        />
        <Input
          label="Mileage"
          type="number"
          value={data.mileage}
          onChange={(v) => setData({ ...data, mileage: v === '' ? undefined : Number(v) })}
        />
      </div>

      <div className="space-y-3 pt-2 border-t border-white/5">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Oil</h3>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Brand" value={data.oilBrand} onChange={(v) => setData({ ...data, oilBrand: v })} />
          <Input label="Product" value={data.oilProduct} onChange={(v) => setData({ ...data, oilProduct: v })} />
          <Input label="Viscosity" value={data.oilViscosity} onChange={(v) => setData({ ...data, oilViscosity: v })} />
          <Input label="Quantity" type="number" step="0.1" value={data.oilQuantity} onChange={(v) => setData({ ...data, oilQuantity: v === '' ? undefined : Number(v) })} />
        </div>
      </div>

      <div className="space-y-3 pt-2 border-t border-white/5">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Filter</h3>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Brand" value={data.filterBrand} onChange={(v) => setData({ ...data, filterBrand: v })} />
          <Input label="Model" value={data.filterModel} onChange={(v) => setData({ ...data, filterModel: v })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Performed by" value={data.performedBy} onChange={(v) => setData({ ...data, performedBy: v })} />
        <Input label="Cost" type="number" step="0.01" value={data.cost} onChange={(v) => setData({ ...data, cost: v })} />
      </div>

      <Input label="Notes" rows={3} value={data.notes} onChange={(v) => setData({ ...data, notes: v })} />

      <div className="space-y-3 pt-2 border-t border-white/5">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Attachments</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="block group cursor-pointer">
            <input type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={handlePhotos} />
            <div className="h-28 rounded-2xl border border-dashed border-white/20 bg-base-900/40 flex flex-col items-center justify-center gap-1 hover:border-accent-500/50 transition">
              <Camera className="w-6 h-6 text-slate-500" />
              <span className="text-sm text-slate-500">Photos (oil, filter)</span>
              {photoFiles.length > 0 && <span className="text-xs text-accent-400">{photoFiles.length} selected</span>}
            </div>
          </label>
          <label className="block group cursor-pointer">
            <input type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={handleReceipts} />
            <div className="h-28 rounded-2xl border border-dashed border-white/20 bg-base-900/40 flex flex-col items-center justify-center gap-1 hover:border-accent-500/50 transition">
              <FileText className="w-6 h-6 text-slate-500" />
              <span className="text-sm text-slate-500">Receipts</span>
              {receiptFiles.length > 0 && <span className="text-xs text-accent-400">{receiptFiles.length} selected</span>}
            </div>
          </label>
        </div>
      </div>

      <Button type="submit" className="w-full gap-2">
        <Save className="w-4 h-4" /> Log service
      </Button>
    </form>
  );
}
