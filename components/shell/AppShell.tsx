"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BookOpenCheck,
  Bot,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  FileWarning,
  Flag,
  GraduationCap,
  LayoutDashboard,
  Library,
  Menu,
  Repeat2,
  Settings2,
  Target,
  Timer,
  X,
  Compass,
} from "lucide-react";
import { useData, useTimer } from "@/components/providers";
import { useAnalytics, useToday } from "@/lib/hooks";
import { Cat, MOOD_LABEL } from "@/components/cat/Cat";
import { FocusTimer } from "@/components/planner/FocusTimer";
import { TodayMission } from "@/components/dashboard/TodayMission";
import { MilestoneWatcher } from "./MilestoneWatcher";
import { cx } from "@/components/ui";
import { dailyMessage, type CatMood } from "@/lib/motivation";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: (n: NavCounts) => number;
}
interface NavCounts {
  reviewsDue: number;
  errorsOpen: number;
}

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Daily",
    items: [
      { href: "/", label: "Mission Control", icon: LayoutDashboard },
      { href: "/planner", label: "Planner", icon: CalendarDays },
      { href: "/revision", label: "Revision", icon: Repeat2, badge: (n) => n.reviewsDue },
      { href: "/tutor", label: "AI Tutor", icon: Bot },
    ],
  },
  {
    group: "Track",
    items: [
      { href: "/syllabus", label: "Syllabus", icon: BookOpenCheck },
      { href: "/pyq", label: "PYQ Tracker", icon: ClipboardList },
      { href: "/errors", label: "Error Notebook", icon: FileWarning, badge: (n) => n.errorsOpen },
      { href: "/mocks", label: "Mock Tests", icon: Flag },
    ],
  },
  {
    group: "Understand",
    items: [
      { href: "/analytics", label: "Analytics", icon: ChartNoAxesCombined },
      { href: "/colleges", label: "College Predictor", icon: GraduationCap },
      { href: "/goals", label: "Goals & Review", icon: Target },
    ],
  },
  {
    group: "Reference",
    items: [
      { href: "/resources", label: "Resources", icon: Library },
      { href: "/strategy", label: "Strategy", icon: Compass },
      { href: "/settings", label: "Settings & Data", icon: Settings2 },
    ],
  },
];

const MOBILE_TABS = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/planner", label: "Plan", icon: CalendarDays },
  { href: "/syllabus", label: "Syllabus", icon: BookOpenCheck },
  { href: "/revision", label: "Revise", icon: Repeat2 },
  { href: "/tutor", label: "Tutor", icon: Bot },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const data = useData();
  const today = useToday();
  const a = useAnalytics(data, today);
  const timer = useTimer();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("gatecat.sidebar") === "collapsed");
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => setMobileOpen(false), [path]);

  // Idle detection for the sleeping cat (5 minutes without input)
  useEffect(() => {
    let t = window.setTimeout(() => setIdle(true), 5 * 60_000);
    const wake = () => {
      setIdle(false);
      window.clearTimeout(t);
      t = window.setTimeout(() => setIdle(true), 5 * 60_000);
    };
    const evs = ["pointerdown", "keydown", "scroll"] as const;
    evs.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    return () => {
      window.clearTimeout(t);
      evs.forEach((e) => window.removeEventListener(e, wake));
    };
  }, []);

  const counts: NavCounts = { reviewsDue: a ? a.reviews.overdue.length + a.reviews.today.length : 0, errorsOpen: a?.openErrors ?? 0 };
  const msg = useMemo(() => (data && a ? dailyMessage(data, a) : null), [data, a]);
  let mood: CatMood = msg?.mood ?? "curious";
  if (timer.state.status === "running") mood = timer.state.phase === "focus" ? "studying" : "resting";
  else if (idle) mood = "sleeping";

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("gatecat.sidebar", c ? "expanded" : "collapsed");
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  const cat = data?.settings.cat ?? { name: "Mochi", fur: "smoke" as const, accessory: "glasses" as const };
  const showRail = path !== "/tutor";

  const nav = (onNavigate?: () => void, compact = false) => (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {NAV.map((g) => (
        <div key={g.group}>
          {!compact && <p className="mb-1.5 px-2.5 text-[11.5px] font-medium text-ink-3">{g.group}</p>}
          <ul className="flex flex-col gap-0.5">
            {g.items.map((item) => {
              const active = isActive(path, item.href);
              const n = item.badge?.(counts) ?? 0;
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={compact ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "group relative flex h-9 items-center gap-2.5 rounded-md text-[13.5px] transition-colors",
                      compact ? "justify-center px-0" : "px-2.5",
                      active ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface hover:text-ink",
                    )}
                  >
                    {active && <span className="absolute top-2 bottom-2 left-0 w-[2px] rounded-full bg-violet" aria-hidden />}
                    <Icon size={17} strokeWidth={1.8} className={active ? "text-violet-2" : "text-ink-3 group-hover:text-ink-2"} />
                    {!compact && <span className="truncate">{item.label}</span>}
                    {n > 0 && (
                      <span className={cx("num rounded px-1.5 text-[11px] leading-[18px] font-semibold", compact ? "absolute top-0.5 right-0.5 bg-violet text-white" : "ml-auto bg-violet-soft text-violet-2")}>
                        {n > 99 ? "99+" : n}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="relative z-10 flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded focus:bg-violet focus:px-3 focus:py-2 focus:text-white">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className={cx("sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-bg-2/80 backdrop-blur lg:flex", collapsed ? "w-[64px]" : "w-[228px]")}>
        <div className={cx("flex h-14 items-center gap-2 border-b border-line", collapsed ? "justify-center" : "px-4")}>
          <Cat mood="curious" fur={cat.fur} accessory="none" size={28} title="GATE CAT" />
          {!collapsed && (
            <div className="leading-tight">
              <div className="display text-[17px] font-semibold">GATE CAT</div>
              <div className="text-[11px] text-ink-3">The IISc Mission Control</div>
            </div>
          )}
        </div>
        <div className={cx("flex-1 overflow-y-auto py-4", collapsed ? "px-2" : "px-2.5")}>{nav(undefined, collapsed)}</div>
        <div className={cx("border-t border-line p-2", collapsed ? "flex justify-center" : "")}>
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-8 w-full items-center justify-center gap-2 rounded-md text-xs text-ink-3 hover:bg-surface hover:text-ink"
          >
            {collapsed ? <ChevronsRight size={16} /> : <><ChevronsLeft size={16} /> Collapse</>}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-13 items-center justify-between border-b border-line bg-bg/90 px-3 backdrop-blur lg:hidden" style={{ height: 52 }}>
        <Link href="/" className="flex items-center gap-2">
          <Cat mood={mood} fur={cat.fur} accessory={cat.accessory} size={30} />
          <span className="display text-[17px] font-semibold">GATE CAT</span>
        </Link>
        <div className="flex items-center gap-1">
          {timer.state.status !== "idle" && (
            <Link href="/planner#timer" className="flex h-8 items-center gap-1.5 rounded-md bg-cyan-soft px-2 text-xs font-medium text-cyan">
              <Timer size={14} /> {timer.state.phase === "focus" ? "Focusing" : "Break"}
            </Link>
          )}
          <button type="button" aria-label="Open menu" onClick={() => setMobileOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-md text-ink-2 hover:bg-surface">
            <Menu size={20} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} aria-hidden />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className="absolute top-0 right-0 bottom-0 flex w-[82%] max-w-[300px] flex-col border-l border-line bg-bg-2"
              initial={{ x: 40 }}
              animate={{ x: 0 }}
              exit={{ x: 40 }}
              transition={{ type: "tween", duration: 0.18 }}
            >
              <div className="flex h-13 items-center justify-between border-b border-line px-4" style={{ height: 52 }}>
                <span className="text-sm font-medium text-ink-2">Menu</span>
                <button type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-md text-ink-2">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">{nav(() => setMobileOpen(false))}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex min-w-0 flex-1">
        <main id="main" className="min-w-0 flex-1 px-4 pt-[68px] pb-24 sm:px-6 lg:px-8 lg:pt-7 lg:pb-10">
          <div className="mx-auto w-full max-w-[1180px]">{children}</div>
        </main>

        {showRail && (
          <aside className="sticky top-0 hidden h-dvh w-[300px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-line bg-bg-2/40 p-3.5 2xl:flex" aria-label="Today panel">
            <div className="flex items-center gap-3 rounded-lg border border-line bg-surface/60 p-3">
              <Cat mood={mood} fur={cat.fur} accessory={cat.accessory} size={64} />
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink">
                  {cat.name} is {MOOD_LABEL[mood]}
                </p>
                {msg && !data?.settings.quietMode && <p className="mt-0.5 text-[12.5px] leading-snug text-ink-2">{msg.text}</p>}
              </div>
            </div>
            <FocusTimer compact />
            <TodayMission compact />
          </aside>
        )}
      </div>

      {/* Mobile bottom tabs */}
      <nav aria-label="Quick" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {MOBILE_TABS.map((t) => {
          const active = isActive(path, t.href);
          const Icon = t.icon;
          return (
            <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={cx("flex h-14 flex-col items-center justify-center gap-0.5 text-[11px]", active ? "text-violet-2" : "text-ink-3")}>
              <Icon size={19} strokeWidth={1.8} />
              {t.label}
            </Link>
          );
        })}
      </nav>

      <MilestoneWatcher />
    </div>
  );
}
