import { type ReactNode } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  className,
  disabled,
  type = 'button'
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  const variants = {
    primary: 'bg-accent-500 text-white hover:bg-accent-400 shadow-lg shadow-accent-500/25',
    secondary: 'bg-base-800 text-slate-100 hover:bg-base-700 border border-white/10',
    ghost: 'bg-transparent text-slate-300 hover:bg-white/5',
    danger: 'bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30'
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-medium transition active:scale-95 disabled:opacity-40',
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  className,
  min,
  step,
  rows
}: {
  label?: string;
  value: string | number | undefined;
  onChange: (val: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
  min?: string | number;
  step?: string;
  rows?: number;
}) {
  const base =
    'w-full rounded-xl border border-white/10 bg-base-900/60 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 transition';
  return (
    <label className={cn('block space-y-1.5', className)}>
      {label && <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>}
      {rows ? (
        <textarea
          rows={rows}
          className={cn(base, 'min-h-[80px] resize-none')}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          type={type}
          min={min}
          step={step}
          className={base}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'glass rounded-2xl p-4 transition hover:border-white/15',
        onClick && 'cursor-pointer active:scale-[0.98]',
        className
      )}
    >
      {children}
    </div>
  );
}

export function Badge({ children, color = 'neutral' }: { children: ReactNode; color?: 'neutral' | 'green' | 'amber' | 'red' | 'violet' }) {
  const colors = {
    neutral: 'bg-slate-800 text-slate-300 border-slate-700',
    green: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    red: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    violet: 'bg-violet-500/15 text-violet-300 border-violet-500/30'
  };
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', colors[color])}>
      {children}
    </span>
  );
}

export function Section({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('animate-fade-in', className)}>{children}</section>;
}
