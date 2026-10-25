"use client";

import { motion, useReducedMotion } from "motion/react";
import type { CatAccessory, CatFur } from "@/types";
import type { CatMood } from "@/lib/motivation";

/** GATE CAT's original mascot: a compact, geometric loaf cat drawn in SVG. */

const FUR: Record<CatFur, { base: string; shade: string; inner: string; belly: string; stripe: string }> = {
  smoke: { base: "#5d6290", shade: "#4a4e78", inner: "#e9a6b8", belly: "#8f93bd", stripe: "#474b73" },
  ginger: { base: "#e39a55", shade: "#c97d3c", inner: "#f4b9b4", belly: "#f3cf9e", stripe: "#bd6f31" },
  cream: { base: "#efe2c6", shade: "#d9c8a6", inner: "#f2b2b8", belly: "#fbf4e4", stripe: "#d6c29a" },
  ink: { base: "#262a45", shade: "#1b1e35", inner: "#c98b9e", belly: "#383d60", stripe: "#20233c" },
  lilac: { base: "#a99be0", shade: "#8e7fcc", inner: "#f0b3c8", belly: "#d4ccf3", stripe: "#8a7bc6" },
};

export const FUR_LABEL: Record<CatFur, string> = { smoke: "Smoke grey", ginger: "Ginger", cream: "Cream", ink: "Midnight black", lilac: "Lilac" };
export const ACCESSORY_LABEL: Record<CatAccessory, string> = { none: "None", glasses: "Reading glasses", scarf: "IISc-blue scarf", bow: "Bow" };
export const MOOD_LABEL: Record<CatMood, string> = {
  sleeping: "sleeping",
  studying: "studying with you",
  curious: "curious",
  celebrating: "celebrating",
  encouraging: "cheering you on",
  resting: "on a break",
};

export function Cat({
  mood = "curious",
  fur = "smoke",
  accessory = "none",
  size = 96,
  className,
  title,
}: {
  mood?: CatMood;
  fur?: CatFur;
  accessory?: CatAccessory;
  size?: number;
  className?: string;
  title?: string;
}) {
  const c = FUR[fur];
  const reduce = useReducedMotion();
  const headY = mood === "sleeping" || mood === "resting" ? 8 : 0;
  const tilt = mood === "curious" ? -9 : mood === "encouraging" ? 5 : 0;
  const pawsUp = mood === "celebrating";
  const eye = "#14172e";

  return (
    <motion.svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title ?? `Cat companion, ${MOOD_LABEL[mood]}`}
      initial={false}
      animate={mood === "celebrating" && !reduce ? { y: [0, -5, 0, -3, 0] } : { y: 0 }}
      transition={{ duration: 0.9, ease: "easeOut" }}
    >
      {/* ground shadow */}
      <ellipse cx="60" cy="106" rx="36" ry="5" fill="#000" opacity="0.18" />

      {/* tail */}
      <motion.path
        d={mood === "sleeping" ? "M30 100 C 12 100, 12 82, 28 84" : "M88 98 C 108 96, 106 70, 96 62"}
        fill="none"
        stroke={c.shade}
        strokeWidth="8"
        strokeLinecap="round"
        style={{ originX: "88px", originY: "98px" }}
        whileHover={reduce ? undefined : { rotate: [0, 6, -4, 0] }}
      />

      {/* body (loaf) */}
      <path d="M30 104 C 26 78, 36 62, 60 62 C 84 62, 94 78, 90 104 Z" fill={c.base} />
      <path d="M44 104 C 42 86, 48 74, 60 74 C 72 74, 78 86, 76 104 Z" fill={c.belly} opacity="0.75" />
      <path d="M33 86 q 6 -2 9 2 M31 95 q 6 -2 9 2" stroke={c.stripe} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.7" />

      {/* paws */}
      {pawsUp ? (
        <>
          <ellipse cx="34" cy="62" rx="6.5" ry="8" fill={c.base} transform="rotate(-25 34 62)" />
          <ellipse cx="86" cy="62" rx="6.5" ry="8" fill={c.base} transform="rotate(25 86 62)" />
        </>
      ) : mood === "encouraging" ? (
        <>
          <ellipse cx="48" cy="103" rx="8" ry="4.5" fill={c.belly} />
          <ellipse cx="88" cy="66" rx="6" ry="7.5" fill={c.base} transform="rotate(20 88 66)" />
        </>
      ) : (
        <>
          <ellipse cx="48" cy="103" rx="8" ry="4.5" fill={c.belly} />
          <ellipse cx="72" cy="103" rx="8" ry="4.5" fill={c.belly} />
        </>
      )}

      {/* study props */}
      {mood === "studying" && (
        <g>
          <path d="M40 100 L60 95 L80 100 L80 106 L60 101 L40 106 Z" fill="#7c6cff" />
          <path d="M60 95 L60 101" stroke="#f3eedf" strokeWidth="1.2" />
          <path d="M43 101 L58 97.5 M62 97.5 L77 101" stroke="#f3eedf" strokeWidth="0.8" opacity="0.6" />
        </g>
      )}
      {mood === "resting" && (
        <g>
          <rect x="88" y="92" width="14" height="13" rx="3" fill="#5fd4e6" />
          <path d="M102 95 q 5 1 0 7" stroke="#5fd4e6" strokeWidth="2.2" fill="none" />
          <path d="M92 87 q 2 -3 0 -6 M97 87 q 2 -3 0 -6" stroke="#b4aed6" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.7" />
        </g>
      )}

      {/* head */}
      <g transform={`translate(0 ${headY}) rotate(${tilt} 60 46)`}>
        <path d="M36 34 L40 10 L54 26 Z" fill={c.base} />
        <path d="M84 34 L80 10 L66 26 Z" fill={c.base} />
        <path d="M40 30 L42 16 L50 26 Z" fill={c.inner} opacity="0.85" />
        <path d="M80 30 L78 16 L70 26 Z" fill={c.inner} opacity="0.85" />
        <ellipse cx="60" cy="44" rx="27" ry="23" fill={c.base} />
        <path d="M54 23 q 6 6 12 0" stroke={c.stripe} strokeWidth="2.4" fill="none" strokeLinecap="round" opacity="0.8" />
        <ellipse cx="60" cy="54" rx="13" ry="8.5" fill={c.belly} opacity="0.9" />

        {/* eyes */}
        {mood === "sleeping" || mood === "resting" ? (
          <>
            <path d="M44 45 q 5 4 10 0" stroke={eye} strokeWidth="2.4" fill="none" strokeLinecap="round" />
            <path d="M66 45 q 5 4 10 0" stroke={eye} strokeWidth="2.4" fill="none" strokeLinecap="round" />
          </>
        ) : mood === "celebrating" ? (
          <>
            <path d="M44 47 q 5 -6 10 0" stroke={eye} strokeWidth="2.6" fill="none" strokeLinecap="round" />
            <path d="M66 47 q 5 -6 10 0" stroke={eye} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          </>
        ) : mood === "studying" ? (
          <>
            <ellipse cx="49" cy="47" rx="3.6" ry="3.2" fill={eye} />
            <ellipse cx="71" cy="47" rx="3.6" ry="3.2" fill={eye} />
            <circle cx="50" cy="46" r="1" fill="#fff" opacity="0.8" />
            <circle cx="72" cy="46" r="1" fill="#fff" opacity="0.8" />
          </>
        ) : (
          <>
            <ellipse cx="49" cy="44" rx="4.3" ry={mood === "curious" ? 5.4 : 4.6} fill={eye} />
            <ellipse cx="71" cy="44" rx="4.3" ry={mood === "curious" ? 5.4 : 4.6} fill={eye} />
            <circle cx="50.5" cy="42.5" r="1.4" fill="#fff" />
            <circle cx="72.5" cy="42.5" r="1.4" fill="#fff" />
          </>
        )}

        {/* nose + mouth */}
        <path d="M57.5 52 L62.5 52 L60 55 Z" fill={c.inner} />
        <path d={mood === "celebrating" || mood === "encouraging" ? "M55 56 q 5 5 10 0" : "M56 57 q 2 2 4 0 q 2 2 4 0"} stroke={eye} strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.8" />
        {/* whiskers */}
        <path d="M34 50 L46 52 M34 56 L46 55 M86 50 L74 52 M86 56 L74 55" stroke="#f3eedf" strokeWidth="0.9" opacity="0.55" strokeLinecap="round" />

        {accessory === "glasses" && (
          <g fill="none" stroke="#f2b45a" strokeWidth="1.8">
            <circle cx="49" cy="45" r="7.5" />
            <circle cx="71" cy="45" r="7.5" />
            <path d="M56.5 45 q 3.5 -2 7 0" />
          </g>
        )}
        {accessory === "bow" && (
          <g transform="translate(74 22) rotate(18)">
            <path d="M0 0 L-8 -5 L-8 5 Z M0 0 L8 -5 L8 5 Z" fill="#f0727a" />
            <circle cx="0" cy="0" r="2.4" fill="#c84b55" />
          </g>
        )}
      </g>

      {accessory === "scarf" && (
        <g>
          <path d="M38 64 q 22 10 44 0 l 1 6 q -23 10 -46 0 Z" fill="#3f5bd8" />
          <path d="M70 68 l 4 16 l 6 -2 l -3 -15 Z" fill="#334bbf" />
        </g>
      )}

      {/* mood marks */}
      {mood === "sleeping" && (
        <g fill="#b4aed6" fontFamily="var(--font-display)" fontWeight="600">
          <text x="88" y="30" fontSize="12" className="z-float">
            z
          </text>
          <text x="96" y="20" fontSize="9" className="z-float-2">
            z
          </text>
        </g>
      )}
      {mood === "curious" && (
        <text x="92" y="26" fontSize="16" fill="#5fd4e6" fontFamily="var(--font-display)" fontWeight="600">
          ?
        </text>
      )}
      {mood === "celebrating" && (
        <g fill="#f2b45a">
          <path d="M18 30 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 Z" />
          <path d="M100 22 l1.5 3.5 l3.5 1.5 l-3.5 1.5 l-1.5 3.5 l-1.5 -3.5 l-3.5 -1.5 l3.5 -1.5 Z" />
          <path d="M104 50 l1 2.5 l2.5 1 l-2.5 1 l-1 2.5 l-1 -2.5 l-2.5 -1 l2.5 -1 Z" />
        </g>
      )}
      {mood === "encouraging" && <path d="M98 40 c -3 -4 -9 -1 -6 4 l 6 6 l 6 -6 c 3 -5 -3 -8 -6 -4 Z" fill="#f0727a" />}
    </motion.svg>
  );
}
