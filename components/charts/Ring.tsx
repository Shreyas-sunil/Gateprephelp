"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

export interface RingSpec {
  value: number | null; // 0–100
  color: string;
  label: string;
}

/** Concentric progress rings. A null value renders a dashed track (no data), never a fake arc. */
export function Rings({ rings, size = 220, stroke = 12, gap = 8, children }: { rings: RingSpec[]; size?: number; stroke?: number; gap?: number; children?: ReactNode }) {
  const c = size / 2;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={rings.map((r) => `${r.label}: ${r.value === null ? "no data" : Math.round(r.value) + "%"}`).join(", ")}>
        {rings.map((r, i) => {
          const radius = c - stroke / 2 - i * (stroke + gap);
          if (radius <= 0) return null;
          const v = r.value === null ? 0 : Math.max(0, Math.min(100, r.value)) / 100;
          return (
            <g key={r.label} transform={`rotate(-90 ${c} ${c})`}>
              <circle cx={c} cy={c} r={radius} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} strokeDasharray={r.value === null ? "2 6" : undefined} />
              {r.value !== null && v > 0 && (
                <motion.circle
                  cx={c}
                  cy={c}
                  r={radius}
                  fill="none"
                  stroke={r.color}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: Math.max(0.004, v) }}
                  transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.1 + i * 0.12 }}
                />
              )}
            </g>
          );
        })}
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  );
}

export function MiniRing({ value, color = "var(--violet)", size = 40, stroke = 5, label }: { value: number | null; color?: string; size?: number; stroke?: number; label: string }) {
  return (
    <Rings rings={[{ value, color, label }]} size={size} stroke={stroke}>
      <span className="num text-[10px] font-semibold text-ink-2">{value === null ? "—" : Math.round(value)}</span>
    </Rings>
  );
}
