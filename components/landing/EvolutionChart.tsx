"use client";

import { AnimatePresence, useInView } from "motion/react";
import * as m from "motion/react-m";
import { useEffect, useId, useMemo, useRef, useState } from "react";

export interface MonthPoint {
  label: string;
  full: string;
  avg: { manoel: number; ana: number };
  wins: { manoel: number; ana: number };
  cumulative: { manoel: number; ana: number };
}

type Mode = "avg" | "wins" | "cumulative";

const MODES: { id: Mode; label: string; short: string; hint: string }[] = [
  { id: "avg", label: "Média de pontos", short: "Média", hint: "média de pontos por partida em cada mês" },
  { id: "wins", label: "Vitórias no mês", short: "Vitórias", hint: "vitórias de cada jogador no mês" },
  { id: "cumulative", label: "Placar acumulado", short: "Acumulado", hint: "vitórias somadas desde o início" },
];

const COLORS = { manoel: "#2ef2a6", ana: "#ff4f79" };

function niceTicks(min: number, max: number, count = 4) {
  const span = max - min || 1;
  const raw = span / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * pow).find((s) => span / s <= count) ?? raw;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

export function EvolutionChart({ data }: { data: MonthPoint[] }) {
  const [mode, setMode] = useState<Mode>("avg");
  const [active, setActive] = useState<number | null>(null);
  const [width, setWidth] = useState(720);
  const wrap = useRef<HTMLDivElement>(null);
  const inView = useInView(wrap, { once: true, margin: "0px 0px -15% 0px" });
  const gid = useId().replace(/:/g, "");

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = width < 500 ? 260 : 340;
  const pad = { t: 24, r: width < 500 ? 16 : 28, b: 34, l: 38 };
  const iw = width - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  const series = useMemo(
    () =>
      data.map((d) => ({
        manoel: mode === "avg" ? d.avg.manoel : mode === "wins" ? d.wins.manoel : d.cumulative.manoel,
        ana: mode === "avg" ? d.avg.ana : mode === "wins" ? d.wins.ana : d.cumulative.ana,
      })),
    [data, mode],
  );

  const values = series.flatMap((s) => [s.manoel, s.ana]);
  const lo = mode === "avg" ? Math.min(...values) * 0.85 : 0;
  const hi = Math.max(...values, mode === "wins" ? 3 : 1);
  const ticks = niceTicks(lo, hi);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const y = (v: number) => pad.t + ih - ((v - yMin) / (yMax - yMin || 1)) * ih;
  const step = data.length > 1 ? iw / (data.length - 1) : 0;
  const x = (i: number) => (data.length > 1 ? pad.l + i * step : pad.l + iw / 2);
  const band = iw / Math.max(1, data.length);
  const bx = (i: number) => pad.l + band * i + band / 2;

  const path = (key: "manoel" | "ana") =>
    series
      .map((s, i) => {
        const px = x(i);
        const py = y(s[key]);
        if (i === 0) return `M${px},${py}`;
        const prevX = x(i - 1);
        const prevY = y(series[i - 1][key]);
        const cx = (prevX + px) / 2;
        return `C${cx},${prevY} ${cx},${py} ${px},${py}`;
      })
      .join(" ");

  const fmt = (v: number) => (mode === "avg" ? v.toFixed(0) : String(v));

  const onMove = (clientX: number) => {
    const el = wrap.current;
    if (!el || !data.length) return;
    const rx = clientX - el.getBoundingClientRect().left - pad.l;
    const idx = mode === "wins" ? Math.floor(rx / band) : Math.round(rx / (step || 1));
    setActive(Math.min(data.length - 1, Math.max(0, idx)));
  };

  if (!data.length) {
    return <p className="glass rounded-3xl p-8 text-center text-fog">Sem partidas registradas ainda.</p>;
  }

  const activeX = active === null ? 0 : mode === "wins" ? bx(active) : x(active);
  const current = MODES.find((md) => md.id === mode)!;

  return (
    <div className="glass rounded-[2rem] p-4 sm:p-7">
      <div role="tablist" aria-label="Tipo de gráfico" className="mb-5 flex gap-1 overflow-x-auto rounded-2xl bg-white/[0.04] p-1">
        {MODES.map((md) => (
          <button
            key={md.id}
            role="tab"
            aria-selected={mode === md.id}
            onClick={() => {
              setMode(md.id);
              setActive(null);
            }}
            className="relative flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition-colors sm:text-sm"
          >
            {mode === md.id && (
              <m.span layoutId={`tab-${gid}`} className="absolute inset-0 rounded-xl bg-white/10 ring-1 ring-white/15" />
            )}
            <span className={`relative ${mode === md.id ? "text-paper" : "text-mist"}`}>
              <span className="sm:hidden">{md.short}</span>
              <span className="hidden sm:inline">{md.label}</span>
            </span>
          </button>
        ))}
      </div>

      <div
        ref={wrap}
        className="relative touch-pan-y select-none overflow-hidden"
        onPointerMove={(e) => onMove(e.clientX)}
        onPointerDown={(e) => onMove(e.clientX)}
        onPointerLeave={() => setActive(null)}
      >
        <svg width={width} height={H} role="img" aria-label={`Gráfico: ${current.hint}`} className="block overflow-visible">
          <defs>
            {(["manoel", "ana"] as const).map((k) => (
              <linearGradient key={k} id={`${gid}-${k}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={COLORS[k]} stopOpacity="0.28" />
                <stop offset="100%" stopColor={COLORS[k]} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,.07)" strokeDasharray="3 5" />
              <text x={pad.l - 10} y={y(t)} dy="0.32em" textAnchor="end" className="fill-mist text-[11px] tabular">
                {t}
              </text>
            </g>
          ))}

          {data.map((d, i) => (
            <text
              key={d.full}
              x={mode === "wins" ? bx(i) : x(i)}
              y={H - 10}
              textAnchor="middle"
              className={`text-[11px] font-semibold ${active === i ? "fill-paper" : "fill-mist"}`}
            >
              {d.label}
            </text>
          ))}

          {active !== null && (
            <line x1={activeX} x2={activeX} y1={pad.t} y2={pad.t + ih} stroke="rgba(255,255,255,.18)" />
          )}

          <AnimatePresence mode="wait">
            {mode === "wins" ? (
              <m.g key="bars" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {series.map((s, i) => {
                  const bw = Math.min(22, band * 0.3);
                  return (["manoel", "ana"] as const).map((k, j) => {
                    const h = pad.t + ih - y(s[k]);
                    return (
                      <m.rect
                        key={`${k}-${i}`}
                        x={bx(i) + (j === 0 ? -bw - 2 : 2)}
                        width={bw}
                        rx={Math.min(6, bw / 2)}
                        fill={COLORS[k]}
                        opacity={active === null || active === i ? 1 : 0.35}
                        initial={{ y: pad.t + ih, height: 0 }}
                        animate={inView ? { y: y(s[k]), height: h } : undefined}
                        transition={{ duration: 0.7, delay: i * 0.04 }}
                      />
                    );
                  });
                })}
              </m.g>
            ) : (
              <m.g key={`lines-${mode}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {(["ana", "manoel"] as const).map((k) => (
                  <g key={k}>
                    <m.path
                      d={`${path(k)} L${x(series.length - 1)},${pad.t + ih} L${x(0)},${pad.t + ih} Z`}
                      fill={`url(#${gid}-${k})`}
                      initial={{ opacity: 0 }}
                      animate={inView ? { opacity: 1 } : undefined}
                      transition={{ duration: 1, delay: 0.6 }}
                    />
                    <m.path
                      d={path(k)}
                      fill="none"
                      stroke={COLORS[k]}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={inView ? { pathLength: 1 } : undefined}
                      transition={{ duration: 1.4, ease: [0.65, 0, 0.35, 1] }}
                    />
                    {series.map((s, i) => (
                      <circle
                        key={i}
                        cx={x(i)}
                        cy={y(s[k])}
                        r={active === i ? 5.5 : 3.5}
                        fill="#07060d"
                        stroke={COLORS[k]}
                        strokeWidth={2}
                      />
                    ))}
                  </g>
                ))}
              </m.g>
            )}
          </AnimatePresence>
        </svg>

        {active !== null && (
          <div
            className="glass pointer-events-none absolute top-0 z-10 min-w-36 rounded-xl px-3 py-2 text-xs shadow-xl"
            style={{
              left: Math.min(Math.max(activeX - 72, 0), width - 150),
            }}
          >
            <p className="mb-1 font-bold text-paper">{data[active].full}</p>
            <p className="flex justify-between gap-4 text-manoel">
              Manoel <span className="font-bold tabular">{fmt(series[active].manoel)}</span>
            </p>
            <p className="flex justify-between gap-4 text-ana">
              Ana <span className="font-bold tabular">{fmt(series[active].ana)}</span>
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-mist">
        <span>{current.hint[0].toUpperCase() + current.hint.slice(1)}</span>
        <span className="flex gap-4 font-bold">
          <span className="flex items-center gap-1.5 text-manoel"><span className="h-0.5 w-4 rounded bg-manoel" />Manoel</span>
          <span className="flex items-center gap-1.5 text-ana"><span className="h-0.5 w-4 rounded bg-ana" />Ana</span>
        </span>
      </div>

      <table className="sr-only">
        <caption>{current.label} por mês</caption>
        <thead>
          <tr>
            <th>Mês</th>
            <th>Manoel</th>
            <th>Ana</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={d.full}>
              <td>{d.full}</td>
              <td>{fmt(series[i].manoel)}</td>
              <td>{fmt(series[i].ana)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
