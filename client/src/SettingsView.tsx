import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Settings, Save, Download, Upload, AlertTriangle } from 'lucide-react';
import { api } from './api';
import { Button, Input, Card } from './Ui';
import type { Settings as AppSettings } from './types';

interface SettingsViewProps {
  settings: AppSettings | null;
  onRefresh: () => void;
}

export function SettingsView({ settings, onRefresh }: SettingsViewProps) {
  const [data, setData] = useState<{
    defaultIntervalMiles?: number;
    defaultIntervalMonths?: number;
    defaultReminderLeadMiles?: number;
    defaultReminderLeadDays?: number;
  }>({
    defaultIntervalMiles: 5000,
    defaultIntervalMonths: 6,
    defaultReminderLeadMiles: 500,
    defaultReminderLeadDays: 30
  });

  useEffect(() => {
    if (settings) {
      setData({
        defaultIntervalMiles: settings.defaultIntervalMiles ?? 5000,
        defaultIntervalMonths: settings.defaultIntervalMonths ?? 6,
        defaultReminderLeadMiles: settings.defaultReminderLeadMiles ?? 500,
        defaultReminderLeadDays: settings.defaultReminderLeadDays ?? 30
      });
    }
  }, [settings]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put('/settings', {
        defaultIntervalMiles: Number(data.defaultIntervalMiles) || 5000,
        defaultIntervalMonths: Number(data.defaultIntervalMonths) || 6,
        defaultReminderLeadMiles: Number(data.defaultReminderLeadMiles) || 500,
        defaultReminderLeadDays: Number(data.defaultReminderLeadDays) || 30
      });
      toast.success('Settings saved');
      onRefresh();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const backup = () => {
    window.open('/api/backups/export', '_blank');
  };

  const [importing, setImporting] = useState(false);

  const importBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('This will replace ALL current data. Continue?')) {
      e.target.value = '';
      return;
    }
    setImporting(true);
    try {
      const form = new FormData();
      form.append('backup', file);
      await api.post('/backups/import', form);
      toast.success('Backup restored');
      onRefresh();
    } catch (err) {
      toast.error(`Import failed: ${String(err)}`);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="pb-24 space-y-6"
    >
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Settings className="w-6 h-6 text-accent-300" /> Settings
      </h2>

      <form onSubmit={submit} className="space-y-4">
        <Card className="p-4 space-y-4">
          <h3 className="font-semibold text-slate-200">Default service intervals</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Interval miles"
              type="number"
              value={data.defaultIntervalMiles}
              onChange={(v) => setData({ ...data, defaultIntervalMiles: v === '' ? undefined : Number(v) })}
            />
            <Input
              label="Interval months"
              type="number"
              value={data.defaultIntervalMonths}
              onChange={(v) => setData({ ...data, defaultIntervalMonths: v === '' ? undefined : Number(v) })}
            />
            <Input
              label="Lead miles"
              type="number"
              value={data.defaultReminderLeadMiles}
              onChange={(v) => setData({ ...data, defaultReminderLeadMiles: v === '' ? undefined : Number(v) })}
            />
            <Input
              label="Lead days"
              type="number"
              value={data.defaultReminderLeadDays}
              onChange={(v) => setData({ ...data, defaultReminderLeadDays: v === '' ? undefined : Number(v) })}
            />
          </div>
        </Card>

        <Button type="submit" className="w-full gap-2">
          <Save className="w-4 h-4" /> Save defaults
        </Button>
      </form>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-slate-200">Data backup & restore</h3>
        <p className="text-sm text-slate-400">
          Export a full backup including all vehicles, services, inventory, receipts, settings, and uploaded images as a zip file.
        </p>
        <Button onClick={backup} variant="secondary" className="w-full gap-2">
          <Download className="w-4 h-4" /> Export full backup
        </Button>
        <div className="pt-2 border-t border-white/5 space-y-2">
          <p className="text-sm text-slate-400">
            Restore from a previously exported backup file. This will replace all current data.
          </p>
          <label className="block group cursor-pointer">
            <input type="file" accept=".zip,application/zip" className="hidden" onChange={importBackup} />
            <div className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-base-900/40 px-4 py-3 text-sm text-slate-400 hover:border-accent-500/50 transition">
              {importing ? (
                <span className="text-accent-400">Restoring...</span>
              ) : (
                <>
                  <Upload className="w-4 h-4" /> Import backup
                </>
              )}
            </div>
          </label>
          <div className="flex items-start gap-2 text-xs text-amber-400/80">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Importing will overwrite all existing data. Make sure you have a current backup first.</span>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-2 text-sm text-slate-400">
        <h3 className="font-semibold text-slate-200">About Dipstick v2</h3>
        <p>A fresh, modern oil-change and service tracker. Built from scratch with Vite, React, Tailwind, and SQLite.</p>
      </Card>
    </motion.div>
  );
}
