"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { FACES, Pips } from "@/components/ui/Die";

export interface KismetEvent {
  /** id único (para reiniciar a animação a cada Kismet) */
  id: number;
  /** face que saiu 5 vezes (1–6) */
  face: number;
  /** pontos marcados (soma + 50) */
  value: number;
  /** quem fez o Kismet */
  name: string;
  /** true quando foi o próprio usuário */
  mine: boolean;
}

/** Rotação do cubo (graus) que deixa cada face virada para a tela. */
const FACE_ROT: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: -90, y: 0 },
  3: { x: 0, y: -90 },
  4: { x: 0, y: 90 },
  5: { x: 90, y: 0 },
  6: { x: 0, y: 180 },
};

const DICE = 5;
const ROLL_MS = 2600; // tempo quicando pela tela
const SETTLE_MS = 750; // alinhando no centro e virando para a face certa
const AUTO_CLOSE_MS = 7000;
const COLORS = ["#ffcc4d", "#fff1c2", "#2ef2a6", "#ff4f79", "#ffffff", "#ffa94d"];

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rx: number;
  ry: number;
  rz: number;
  wx: number;
  wy: number;
  wz: number;
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** alvo equivalente (mod 360) mais próximo, no sentido em que o dado já gira */
function nearestTurn(current: number, target: number, spin: number) {
  const base = target + 360 * Math.round((current - target) / 360);
  return spin >= 0 ? (base < current ? base + 360 : base) : base > current ? base - 360 : base;
}

export function KismetCelebration({ event, onClose }: { event: KismetEvent | null; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !event) return null;
  return createPortal(<Show key={event.id} event={event} onClose={onClose} />, document.body);
}

function Show({ event, onClose }: { event: KismetEvent; onClose: () => void }) {
  const dieRefs = useRef<(HTMLDivElement | null)[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [landed, setLanded] = useState(false);
  const [size, setSize] = useState(64);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const s = Math.round(Math.max(44, Math.min(76, W / 7.8)));
    setSize(s);
    const gap = Math.round(s * 0.42);
    const rowW = DICE * s + (DICE - 1) * gap;
    const finalY = H * 0.42 - s / 2;
    const finalX = (i: number) => (W - rowW) / 2 + i * (s + gap);
    const tgt = FACE_ROT[event.face] ?? FACE_ROT[1];

    const place = (el: HTMLDivElement | null, b: Body) => {
      if (!el) return;
      el.style.transform = `translate3d(${b.x}px, ${b.y}px, 0)`;
      const cube = el.firstElementChild as HTMLElement | null;
      if (cube) cube.style.transform = `rotateX(-14deg) rotateY(16deg) rotateX(${b.rx}deg) rotateY(${b.ry}deg) rotateZ(${b.rz}deg)`;
    };

    navigator.vibrate?.([60, 40, 60, 40, 160]);

    if (reduce) {
      for (let i = 0; i < DICE; i++) {
        place(dieRefs.current[i], { x: finalX(i), y: finalY, vx: 0, vy: 0, rx: tgt.x, ry: tgt.y, rz: 0, wx: 0, wy: 0, wz: 0 });
      }
      setLanded(true);
      const t = setTimeout(onClose, AUTO_CLOSE_MS);
      return () => clearTimeout(t);
    }

    /* ── dados: lançados de baixo, quicam nas bordas, perdem força e se alinham ── */
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const bodies: Body[] = Array.from({ length: DICE }, (_, i) => ({
      x: rnd(W * 0.15, W * 0.85 - s),
      y: H - s - rnd(0, 40),
      vx: rnd(-1, 1) * W * 1.6 + (i - 2) * 120,
      vy: -rnd(H * 1.4, H * 2.1),
      rx: rnd(0, 360),
      ry: rnd(0, 360),
      rz: rnd(0, 360),
      wx: rnd(500, 1100) * (Math.random() < 0.5 ? -1 : 1),
      wy: rnd(500, 1100) * (Math.random() < 0.5 ? -1 : 1),
      wz: rnd(200, 600) * (Math.random() < 0.5 ? -1 : 1),
    }));
    let from: Body[] | null = null;
    let to: { rx: number; ry: number; rz: number }[] = [];

    /* ── fogos ── */
    const cv = canvasRef.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr;
    cv.height = H * dpr;
    const ctx = cv.getContext("2d")!;
    ctx.scale(dpr, dpr);
    type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; c: string; r: number };
    const parts: P[] = [];
    const burst = (x: number, y: number, n = 70) => {
      const c1 = COLORS[Math.floor(Math.random() * COLORS.length)];
      const c2 = COLORS[Math.floor(Math.random() * COLORS.length)];
      for (let k = 0; k < n; k++) {
        const a = (Math.PI * 2 * k) / n + Math.random() * 0.2;
        const sp = rnd(90, 330);
        const max = rnd(0.9, 1.6);
        parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: max, max, c: k % 3 ? c1 : c2, r: rnd(1.4, 2.8) });
      }
    };
    let nextBurst = 250;
    const FIRE_UNTIL = ROLL_MS + SETTLE_MS + 2600;

    const start = performance.now();
    let last = start;
    let raf = 0;
    let landedFlag = false;

    const frame = (now: number) => {
      const t = now - start;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;

      if (t < ROLL_MS) {
        const drag = Math.pow(0.35, dt); // perde ~65% da velocidade por segundo
        for (const b of bodies) {
          b.vy += 1400 * dt; // gravidade leve "de mesa"
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.vx *= drag;
          b.vy *= drag;
          b.wx *= Math.pow(0.6, dt);
          b.wy *= Math.pow(0.6, dt);
          b.wz *= Math.pow(0.6, dt);
          // bate nas extremidades da tela
          if (b.x < 0) {
            b.x = 0;
            b.vx = Math.abs(b.vx) * 0.78;
            b.wy = -b.wy + rnd(-200, 200);
          } else if (b.x > W - s) {
            b.x = W - s;
            b.vx = -Math.abs(b.vx) * 0.78;
            b.wy = -b.wy + rnd(-200, 200);
          }
          if (b.y < 0) {
            b.y = 0;
            b.vy = Math.abs(b.vy) * 0.78;
            b.wx = -b.wx + rnd(-200, 200);
          } else if (b.y > H - s) {
            b.y = H - s;
            b.vy = -Math.abs(b.vy) * 0.72;
            b.wx = -b.wx + rnd(-200, 200);
            if (Math.abs(b.vy) > 260) navigator.vibrate?.(8);
          }
          b.rx += b.wx * dt;
          b.ry += b.wy * dt;
          b.rz += b.wz * dt;
        }
      } else {
        if (!from) {
          from = bodies.map((b) => ({ ...b }));
          to = bodies.map((b) => ({
            rx: nearestTurn(b.rx, tgt.x, b.wx),
            ry: nearestTurn(b.ry, tgt.y, b.wy),
            rz: nearestTurn(b.rz, 0, b.wz),
          }));
        }
        const p = ease(Math.min(1, (t - ROLL_MS) / SETTLE_MS));
        bodies.forEach((b, i) => {
          const f = from![i];
          b.x = lerp(f.x, finalX(i), p);
          b.y = lerp(f.y, finalY, p) - Math.sin(p * Math.PI) * s * 0.6;
          b.rx = lerp(f.rx, to[i].rx, p);
          b.ry = lerp(f.ry, to[i].ry, p);
          b.rz = lerp(f.rz, to[i].rz, p);
        });
        if (p >= 1 && !landedFlag) {
          landedFlag = true;
          setLanded(true);
          navigator.vibrate?.([30, 50, 120]);
          burst(W / 2, finalY + s / 2, 110);
        }
      }
      bodies.forEach((b, i) => place(dieRefs.current[i], b));

      // fogos
      if (t < FIRE_UNTIL && t >= nextBurst) {
        burst(rnd(W * 0.12, W * 0.88), rnd(H * 0.08, H * 0.5));
        nextBurst = t + rnd(260, 520);
      }
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      for (let k = parts.length - 1; k >= 0; k--) {
        const q = parts[k];
        q.life -= dt;
        if (q.life <= 0) {
          parts.splice(k, 1);
          continue;
        }
        q.vx *= Math.pow(0.25, dt);
        q.vy = q.vy * Math.pow(0.25, dt) + 160 * dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        ctx.globalAlpha = Math.max(0, q.life / q.max);
        ctx.fillStyle = q.c;
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (t < FIRE_UNTIL + 1800 || parts.length) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const close = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(close);
    };
  }, [event, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Kismet de ${event.face}! ${event.value} pontos`}
      onClick={onClose}
      className="fixed inset-0 z-[95] cursor-pointer overflow-hidden bg-ink/85"
    >
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 size-full" />
      {Array.from({ length: DICE }, (_, i) => (
        <div
          key={i}
          ref={(el) => {
            dieRefs.current[i] = el;
          }}
          aria-hidden
          className="die-scene absolute left-0 top-0 will-change-transform"
          style={{ transform: `translate3d(-200px, -200px, 0)` }}
        >
          <div className="die" style={{ "--s": `${size}px`, animation: "none" } as CSSProperties}>
            {FACES.map((v) => (
              <div key={v} className="die-face">
                <Pips value={v} />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div
        className={`pointer-events-none absolute inset-x-4 top-[calc(42%+var(--k-s)*0.9)] text-center transition-all duration-500 ${
          landed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
        style={{ "--k-s": `${size}px` } as CSSProperties}
      >
        <p className="shine-text font-display drop-shadow-[0_0_24px_rgba(255,204,77,0.55)] text-6xl font-extrabold tracking-tight sm:text-7xl">KISMET!</p>
        <p className="mt-2 text-base font-bold text-paper">
          {event.mine ? "Você fez" : `${event.name} fez`} Kismet de {event.face}
        </p>
        <p className="mt-1 text-sm text-fog">
          5 × {event.face} = {event.face * 5} + 50 de bônus = <span className="font-bold text-gold">{event.value} pts</span>
        </p>
        <p className="mt-6 text-xs text-mist">toque para continuar</p>
      </div>
    </div>
  );
}
