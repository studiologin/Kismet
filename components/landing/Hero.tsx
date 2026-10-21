"use client";

import { useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "motion/react";
import * as m from "motion/react-m";
import { useRef, type PointerEvent, type ReactNode } from "react";
import { SlotNumber } from "@/components/ui/SlotNumber";
import { Die } from "@/components/ui/Die";
import type { PlayerId, Winner } from "@/lib/kismet";

export interface HeroProps {
  wins: Record<PlayerId, number>;
  avg: Record<PlayerId, number>;
  kismets: Record<PlayerId, number>;
  leader: Winner | null;
  lead: number;
  played: number;
  ties: number;
  streak: { player: PlayerId; length: number } | null;
  seasonLabel: string;
}

const NAMES: Record<PlayerId, string> = { manoel: "Manoel", ana: "Ana" };

export function Crown({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M3 7.5 7.5 11 12 4l4.5 7L21 7.5 19 18H5L3 7.5Zm2 12.5h14v1.5H5V20Z" />
    </svg>
  );
}

/** camada de dado com profundidade: scroll + leve reação ao ponteiro */
function DiceLayer({
  children,
  className,
  scroll,
  depth,
  mx,
  my,
}: {
  children: ReactNode;
  className: string;
  scroll: MotionValue<number>;
  depth: number;
  mx: MotionValue<number>;
  my: MotionValue<number>;
}) {
  const y = useTransform(scroll, (v) => v * depth);
  const px = useTransform(mx, (v) => v * depth * 40);
  const py = useTransform(my, (v) => v * depth * 40);
  return (
    <m.div aria-hidden className={`pointer-events-none absolute ${className}`} style={{ y }}>
      <m.div style={{ x: px, y: py }}>{children}</m.div>
    </m.div>
  );
}

function PlayerScore({ id, wins, leader, align }: { id: PlayerId; wins: number; leader: boolean; align: "left" | "right" }) {
  const color = id === "manoel" ? "text-manoel" : "text-ana";
  return (
    <div className={`flex flex-col ${align === "right" ? "items-end text-right" : "items-start text-left"}`}>
      <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] sm:text-sm ${color}`}>
        {align === "left" && leader && <Crown className="size-4 text-gold" />}
        <span className={`size-2 rounded-full ${id === "manoel" ? "bg-manoel" : "bg-ana"}`} />
        {NAMES[id]}
        {align === "right" && leader && <Crown className="size-4 text-gold" />}
      </div>
      <div
        className="font-display font-extrabold leading-[0.82] tracking-[-0.06em] tabular text-[clamp(4.5rem,min(26vw,34svh),15rem)] short:text-[clamp(4rem,30svh,9rem)]"
      >
        <SlotNumber value={wins} className="text-paper" />
      </div>
      <span className="mt-1 text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-mist">vitórias</span>
    </div>
  );
}

export function Hero(props: HeroProps) {
  const { wins, avg, kismets, leader, lead, played, ties, streak, seasonLabel } = props;
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const scroll = useTransform(scrollY, (v) => (reduce ? 0 : Math.min(v, 1200)));

  const yGlow = useTransform(scroll, (v) => v * 0.45);
  const yWord = useTransform(scroll, (v) => v * 0.3);
  const yContent = useTransform(scroll, (v) => v * 0.18);
  const fade = useTransform(scroll, [0, 520], [1, 0]);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const mx = useSpring(rawX, { stiffness: 60, damping: 18 });
  const my = useSpring(rawY, { stiffness: 60, damping: 18 });

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (reduce || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    rawX.set((e.clientX - r.left) / r.width - 0.5);
    rawY.set((e.clientY - r.top) / r.height - 0.5);
  };

  const leaderText =
    leader === null
      ? "A disputa ainda não começou"
      : leader === "empate"
        ? "Disputa empatada"
        : `${NAMES[leader]} lidera a disputa`;

  return (
    <section
      ref={ref}
      id="placar"
      onPointerMove={onPointerMove}
      className="relative isolate flex min-h-[100svh] items-center overflow-hidden pb-20 pt-28"
    >
      {/* camada 1 — luzes */}
      <m.div aria-hidden style={{ y: yGlow }} className="absolute inset-0 -z-30">
        <div className="absolute -left-48 top-[8%] size-[34rem] rounded-full glow-manoel opacity-45" />
        <div className="absolute -right-48 top-[30%] size-[34rem] rounded-full glow-ana opacity-45" />
        <div className="absolute left-1/2 top-[55%] size-[22rem] -translate-x-1/2 rounded-full glow-gold opacity-30" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(ellipse 70% 55% at 50% 45%, black 20%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse 70% 55% at 50% 45%, black 20%, transparent 75%)",
          }}
        />
      </m.div>

      {/* camada 2 — palavra gigante */}
      <m.div
        aria-hidden
        style={{ y: yWord }}
        className="text-outline absolute inset-x-0 top-[14%] -z-20 select-none text-center font-display text-[30vw] font-extrabold leading-none tracking-[-0.06em] sm:top-[8%]"
      >
        KISMET
      </m.div>

      {/* camada 3 — dados em profundidades diferentes */}
      <DiceLayer scroll={scroll} depth={-0.55} mx={mx} my={my} className="left-[4%] top-[17%] sm:left-[8%] sm:top-[20%]">
        <div className="float" style={{ ["--fdur" as string]: "8s" }}>
          <Die size={78} rx={-28} ry={36} duration={26} className="drop-shadow-[0_30px_40px_rgba(0,0,0,.55)] sm:scale-125" />
        </div>
      </DiceLayer>
      <DiceLayer scroll={scroll} depth={-0.9} mx={mx} my={my} className="right-[5%] top-[13%] sm:right-[10%]">
        <div className="float" style={{ ["--fdur" as string]: "6s" }}>
          <Die size={56} rx={18} ry={-40} duration={18} delay={-6} className="drop-shadow-[0_24px_30px_rgba(0,0,0,.55)] sm:scale-150" />
        </div>
      </DiceLayer>
      <DiceLayer scroll={scroll} depth={-0.25} mx={mx} my={my} className="bottom-[9%] left-[12%] opacity-70 blur-[1.5px]">
        <Die size={38} rx={40} ry={10} duration={30} delay={-12} />
      </DiceLayer>
      <DiceLayer scroll={scroll} depth={-1.2} mx={mx} my={my} className="bottom-[14%] right-[8%] sm:right-[16%]">
        <div className="float" style={{ ["--fdur" as string]: "9s" }}>
          <Die size={64} rx={-12} ry={60} duration={24} delay={-3} className="drop-shadow-[0_30px_40px_rgba(0,0,0,.6)]" />
        </div>
      </DiceLayer>
      <DiceLayer scroll={scroll} depth={-0.15} mx={mx} my={my} className="right-[34%] top-[9%] hidden opacity-50 blur-[2px] sm:block">
        <Die size={30} rx={10} ry={20} duration={34} delay={-20} />
      </DiceLayer>

      {/* conteúdo */}
      <m.div style={{ y: yContent, opacity: fade }} className="relative mx-auto w-full max-w-6xl px-4 sm:px-6">
        <m.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="glass mx-auto mb-8 flex w-fit items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-fog sm:text-sm"
        >
          <span className="size-1.5 animate-pulse rounded-full bg-gold" />
          {seasonLabel} · {played} {played === 1 ? "partida" : "partidas"}
          {ties > 0 && ` · ${ties} ${ties === 1 ? "empate" : "empates"}`}
        </m.div>

        <h1 className="sr-only">
          Placar geral: Manoel {wins.manoel} vitórias, Ana {wins.ana} vitórias. {leaderText}.
        </h1>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-8">
          <PlayerScore id="manoel" wins={wins.manoel} leader={leader === "manoel"} align="right" />
          <div className="flex flex-col items-center gap-2 pt-6 font-display text-2xl font-light text-mist sm:text-4xl">
            <span className="h-10 w-px bg-gradient-to-b from-transparent to-white/25 sm:h-16" />
            ×
            <span className="h-10 w-px bg-gradient-to-t from-transparent to-white/25 sm:h-16" />
          </div>
          <PlayerScore id="ana" wins={wins.ana} leader={leader === "ana"} align="left" />
        </div>

        <m.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35 }}
          className="mx-auto mt-10 flex max-w-xl flex-col items-center gap-4"
        >
          <div className="glass flex w-full items-center gap-4 rounded-3xl p-4 sm:p-5">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gold/15 text-gold ring-1 ring-gold/30">
              <Crown className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-lg font-bold leading-tight sm:text-xl">
                {leader && leader !== "empate" ? (
                  <>
                    <span className={leader === "manoel" ? "text-manoel" : "text-ana"}>{NAMES[leader]}</span> lidera a
                    disputa
                  </>
                ) : (
                  leaderText
                )}
              </p>
              <p className="text-sm text-fog">
                {leader && leader !== "empate"
                  ? `Vantagem de ${lead} ${lead === 1 ? "vitória" : "vitórias"}`
                  : "Tudo igual no placar geral"}
                {streak && streak.length > 1 && ` · ${NAMES[streak.player]} vem de ${streak.length} seguidas`}
              </p>
            </div>
          </div>

          <dl className="grid w-full grid-cols-2 gap-3 text-center">
            <div className="glass rounded-2xl px-3 py-3">
              <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-mist">Média de pontos</dt>
              <dd className="mt-1 font-display text-xl font-bold tabular">
                <span className="text-manoel">{Math.round(avg.manoel)}</span>
                <span className="mx-1.5 text-mist">×</span>
                <span className="text-ana">{Math.round(avg.ana)}</span>
              </dd>
            </div>
            <div className="glass rounded-2xl px-3 py-3">
              <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-mist">Kismets</dt>
              <dd className="mt-1 font-display text-xl font-bold tabular">
                <span className="text-manoel">{kismets.manoel}</span>
                <span className="mx-1.5 text-mist">×</span>
                <span className="text-ana">{kismets.ana}</span>
              </dd>
            </div>
          </dl>
        </m.div>
      </m.div>

      <a
        href="#mes"
        aria-label="Rolar para o mês atual"
        className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-mist"
      >
        rolar
        <span className="relative h-9 w-5 rounded-full border border-white/20">
          <span className="absolute left-1/2 top-1.5 h-2 w-1 -translate-x-1/2 animate-bounce rounded-full bg-white/60" />
        </span>
      </a>
    </section>
  );
}
