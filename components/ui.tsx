"use client";

import clsx from "clsx";
import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { X } from "lucide-react";

export const cx = clsx;

// ------------------------------------------------------------------ Button

type Variant = "primary" | "secondary" | "ghost" | "danger" | "amber";
type Size = "sm" | "md" | "lg";

const variantCls: Record<Variant, string> = {
  primary: "bg-violet text-white hover:bg-violet-2 border border-transparent shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset]",
  secondary: "bg-surface-2 text-ink hover:bg-surface-3 border border-line",
  ghost: "bg-transparent text-ink-2 hover:text-ink hover:bg-surface-2 border border-transparent",
  danger: "bg-rose-soft text-rose hover:bg-rose hover:text-white border border-transparent",
  amber: "bg-amber-soft text-amber hover:bg-amber hover:text-bg border border-transparent",
};
const sizeCls: Record<Size, string> = {
  sm: "h-8 px-2.5 text-[13px] gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
  lg: "h-11 px-5 text-[15px] gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "secondary", size = "md", icon, className, children, type = "button", ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        "inline-flex select-none items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-45",
        variantCls[variant],
        sizeCls[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

export function IconButton({ label, className, children, size = "md", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40",
        size === "sm" ? "h-7 w-7" : "h-9 w-9",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ Layout

export function Panel({ className, children, as: As = "section", ...rest }: { className?: string; children: ReactNode; as?: "section" | "div" | "article" } & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={cx("rounded-lg border border-line bg-surface/80", className)} {...rest}>
      {children}
    </As>
  );
}

export function PanelHeader({ title, hint, action, className }: { title: ReactNode; hint?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-4 pt-3.5 pb-2", className)}>
      <div className="min-w-[12rem] flex-1">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {hint && <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{hint}</p>}
      </div>
      {action && <div className="flex max-w-full flex-wrap items-center gap-1">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="display text-[28px] leading-tight font-medium text-ink sm:text-[32px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

// ------------------------------------------------------------------ Forms

export function Field({ label, hint, children, className, htmlFor, group }: { label: string; hint?: ReactNode; children: ReactNode; className?: string; htmlFor?: string; group?: boolean }) {
  if (group) {
    return (
      <div className={cx("flex flex-col gap-1.5", className)}>
        <span className="text-[13px] font-medium text-ink-2">{label}</span>
        {children}
        {hint && <p className="text-xs text-ink-3">{hint}</p>}
      </div>
    );
  }
  if (!htmlFor) {
    // Without an explicit id, wrap the control so the label is still programmatically associated.
    return (
      <div className={cx("flex flex-col gap-1.5", className)}>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-2">{label}</span>
          {children}
        </label>
        {hint && <p className="text-xs text-ink-3">{hint}</p>}
      </div>
    );
  }
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

const widthOf = (c?: string) => (c && /(^|\s)(sm:|md:|lg:)?w-/.test(c) ? "" : "w-full");

const inputCls =
  "rounded-md border border-line bg-bg-2 px-3 text-sm text-ink placeholder:text-ink-3 transition-colors hover:border-line-strong focus:border-violet focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-violet-soft";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(inputCls, widthOf(className), "h-9", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(inputCls, "w-full min-h-[76px] py-2 leading-relaxed", className)} {...rest} />;
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(inputCls, widthOf(className), "h-9 cursor-pointer pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

export function Checkbox({ checked, onChange, label, className, id }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; className?: string; id?: string }) {
  const autoId = useId();
  const cid = id ?? autoId;
  return (
    <label htmlFor={cid} className={cx("inline-flex cursor-pointer items-center gap-2 text-sm text-ink-2", className)}>
      <input id={cid} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 cursor-pointer rounded" />
      {label}
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options, size = "md", label }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; size?: "sm" | "md"; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line bg-bg-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-[5px] font-medium transition-colors",
            size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]",
            value === o.value ? "bg-surface-3 text-ink" : "text-ink-3 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Display

const toneCls = {
  neutral: "bg-surface-2 text-ink-2",
  violet: "bg-violet-soft text-violet-2",
  cyan: "bg-cyan-soft text-cyan",
  amber: "bg-amber-soft text-amber",
  rose: "bg-rose-soft text-rose",
  mint: "bg-mint-soft text-mint",
} as const;
export type Tone = keyof typeof toneCls;

export function Badge({ tone = "neutral", children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex h-5 items-center gap-1 rounded px-1.5 text-[11.5px] font-medium whitespace-nowrap", toneCls[tone], className)}>
      {children}
    </span>
  );
}

export function Bar({ value, max = 100, color, className, label, height = 6 }: { value: number; max?: number; color?: string; className?: string; label?: string; height?: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} className={cx("w-full overflow-hidden rounded-full bg-surface-3", className)} style={{ height }}>
      <div className="h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${pct}%`, background: color ?? "var(--violet)" }} />
    </div>
  );
}

export function Stat({ label, value, sub, tone, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: "amber" | "cyan" | "violet" | "rose" | "mint"; className?: string }) {
  const color = tone ? { amber: "text-amber", cyan: "text-cyan", violet: "text-violet-2", rose: "text-rose", mint: "text-mint" }[tone] : "text-ink";
  return (
    <div className={cx("min-w-0", className)}>
      <div className="text-[12.5px] text-ink-3">{label}</div>
      <div className={cx("num mt-0.5 text-xl font-semibold leading-tight", color)}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-ink-3">{sub}</div>}
    </div>
  );
}

export function EmptyState({ title, body, action, icon, className }: { title: string; body?: ReactNode; action?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col items-center justify-center gap-2 px-4 py-8 text-center", className)}>
      {icon && <div className="mb-1 text-ink-3">{icon}</div>}
      <p className="text-sm font-medium text-ink">{title}</p>
      {body && <p className="max-w-sm text-[13px] text-ink-3">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton rounded-md", className)} aria-hidden />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-9 w-64" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

// ------------------------------------------------------------------ Dialog

export function Dialog({ open, onClose, title, description, children, footer, wide }: { open: boolean; onClose: () => void; title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      lastFocus.current = document.activeElement as HTMLElement | null;
      d.showModal();
    } else if (!open && d.open) {
      d.close();
      lastFocus.current?.focus?.();
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cx(
        "m-auto max-h-[92vh] w-[calc(100%-24px)] overflow-hidden rounded-lg border border-line-strong bg-surface p-0 text-ink shadow-2xl",
        wide ? "max-w-3xl" : "max-w-lg",
      )}
    >
      {open && (
        <div className="flex max-h-[92vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-base font-semibold">{title}</h2>
              {description && <p className="mt-0.5 text-[13px] text-ink-3">{description}</p>}
            </div>
            <IconButton label="Close" onClick={onClose} size="sm">
              <X size={16} />
            </IconButton>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, body, confirmLabel, danger = true }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: ReactNode; confirmLabel: string; danger?: boolean }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-ink-2">{body}</div>
    </Dialog>
  );
}

// ------------------------------------------------------------------ Misc

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line bg-bg-2 px-1 font-mono text-[11px] text-ink-3">{children}</kbd>;
}

export function Pct({ value, digits = 0, empty = "—" }: { value: number | null | undefined; digits?: number; empty?: string }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return <span className="text-ink-3">{empty}</span>;
  return <span className="num">{value.toFixed(digits)}%</span>;
}

export function Stars({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} of 5`}
          onClick={() => onChange(value === n ? 0 : n)}
          className={cx("h-6 w-6 rounded text-[15px] leading-none transition-colors", n <= value ? "text-amber" : "text-ink-3 hover:text-ink-2")}
        >
          ★
        </button>
      ))}
    </div>
  );
}
