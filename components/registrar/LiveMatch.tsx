"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  cancelLiveAction,
  finalizeLiveAction,
  playAction,
  startLiveAction,
  undoPlayAction,
  type FinalizeResult,
} from "@/app/registrar/actions";
import { DieFace } from "@/components/ui/Die";
import { MONTHS, formatDateBR } from "@/lib/dates";
import {
  CATEGORIES,
  LOWER,
  MATCHES_PER_MONTH,
  PLAYER_NAME,
  UPPER,
  computeTotals,
  decideWinner,
  nextBonusTier,
  validateScore,
  type Category,
  type CategoryId,
  type PlayerId,
} from "@/lib/kismet";
import { TOTAL_ROUNDS, otherPlayer, timeline, type LiveScores, type LiveState, type Play } from "@/lib/turns";
import type { TakenSlot } from "./MatchForm";

const PLAYERS: PlayerId[] = ["manoel", "ana"];
const POLL_MS = 3000;

const catOf = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)!;
const nameColor = (p: PlayerId) => (p === "manoel" ? "text-manoel" : "text-ana");
const fmtValue = (v: number) => (v === 0 ? "riscou" : `${v} pts`);
const totalsOf = (s?: LiveScores) => computeTotals((s ?? {}) as Record<CategoryId, number>);

/* ───────────── compositor da jogada (sua vez) ───────────── */

function PlayComposer({
  me,
  scores,
  round,
  onSaved,
  onError,
}: {
  me: PlayerId;
  scores: LiveScores;
  round: number;
  onSaved: (s: LiveState | null, play: { cat: CategoryId; value: number }) => void;
  onError: (msg: string) => void;
}) {
  const [cat, setCat] = useState<CategoryId | null>(null);
  const [value, setValue] = useState<string>("");
  const [pending, start] = useTransition();
  const remaining = CATEGORIES.filter((c) => scores[c.id] === undefined);
  const category = cat ? catOf(cat) : null;
  const n = value === "" ? null : Number(value);
  const err = category && n !== null ? validateScore(category, n) : null;
  const ready = Boolean(category && n !== null && !err);
  const accent = me === "manoel" ? "bg-manoel text-ink" : "bg-ana text-ink";
  const accentRing = me === "manoel" ? "ring-manoel/70" : "ring-ana/70";

  const before = totalsOf(scores);
  const after = ready && cat ? totalsOf({ ...scores, [cat]: n! }) : null;
  const bonusGain = after ? after.bonus - before.bonus : 0;

  const choose = (id: CategoryId) => {
    setCat(id);
    setValue("");
  };

  const save = () =>
    start(async () => {
      if (!cat || n === null) return;
      const r = await playAction(cat, n);
      if (r.ok) {
        onSaved(r.state, { cat, value: n });
        setCat(null);
        setValue("");
      } else onError(r.error);
    });

  const group = (title: string, list: Category[]) => {
    const left = list.filter((c) => remaining.includes(c));
    if (!left.length) return null;
    return (
      <div>
        <p className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.25em] text-gold">{title}</p>
        <div className="grid grid-cols-3 gap-2">
          {left.map((c) => {
            const face = UPPER.indexOf(c) + 1;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => choose(c.id)}
                className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-white/[0.04] px-1.5 py-2 text-center ring-1 ring-white/10 transition active:scale-95"
              >
                {face > 0 && <DieFace value={face} size={18} />}
                <span className="text-[0.8rem] font-bold leading-tight">{c.label}</span>
                {face === 0 && <span className="text-[0.62rem] text-mist">{c.hint}</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <section aria-label="Sua jogada" className={`glass rounded-[1.5rem] p-4 ring-1 ${accentRing}`}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className={`text-xs font-extrabold uppercase tracking-[0.25em] ${nameColor(me)}`}>Sua vez</p>
          <p className="font-display text-2xl font-extrabold">
            Rodada {round}
            <span className="text-mist">/{TOTAL_ROUNDS}</span>
          </p>
        </div>
        <p className="max-w-[9rem] text-right text-xs text-fog">
          {category ? "Marque os pontos e salve a jogada." : "Em qual categoria vai marcar?"}
        </p>
      </div>

      {!category ? (
        <div className="space-y-4">
          {group("Seção superior", UPPER)}
          {group("Seção inferior", LOWER)}
        </div>
      ) : (
        <div>
          <button type="button" onClick={() => setCat(null)} className="mb-3 text-sm font-semibold text-mist">
            ← trocar categoria
          </button>
          <div className="mb-4 flex items-center gap-3">
            {UPPER.includes(category) && <DieFace value={UPPER.indexOf(category) + 1} size={34} />}
            <div>
              <p className={`font-display text-2xl font-extrabold ${category.id === "kismet" ? "shine-text" : ""}`}>{category.label}</p>
              <p className="text-sm text-fog">{category.hint}</p>
            </div>
          </div>

          {category.rule.kind === "multiple" && (
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2, 3, 4, 5].map((k) => {
                const v = String(k * (category.rule as { face: number }).face);
                const on = value === v;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setValue(v)}
                    className={`flex min-h-16 flex-col items-center justify-center rounded-2xl ring-1 transition active:scale-95 ${
                      on ? `${accent} ring-transparent` : "bg-white/[0.05] ring-white/10"
                    }`}
                  >
                    <span className="font-display text-2xl font-extrabold tabular">{k === 0 ? "✕" : v}</span>
                    <span className={`text-[0.68rem] font-semibold ${on ? "text-ink/70" : "text-mist"}`}>
                      {k === 0 ? "riscar" : `${k} dado${k > 1 ? "s" : ""}`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {category.rule.kind === "fixed" && (
            <div className="grid grid-cols-2 gap-2">
              {["0", String(category.rule.value)].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setValue(v)}
                  className={`flex min-h-20 flex-col items-center justify-center rounded-2xl ring-1 transition active:scale-95 ${
                    value === v ? `${accent} ring-transparent` : "bg-white/[0.05] ring-white/10"
                  }`}
                >
                  <span className="font-display text-3xl font-extrabold">{v === "0" ? "✕" : v}</span>
                  <span className={`text-xs font-semibold ${value === v ? "text-ink/70" : "text-mist"}`}>{v === "0" ? "riscar" : "fez!"}</span>
                </button>
              ))}
            </div>
          )}

          {category.rule.kind === "range" && (
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div className={`rounded-2xl ring-1 focus-within:ring-2 ${err ? "ring-ana/70" : "ring-white/15"}`}>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoFocus
                  aria-label={`Pontos em ${category.label}`}
                  value={value === "0" ? "" : value}
                  placeholder={`${category.rule.min}–${category.rule.max}`}
                  onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
                  className="min-h-16 w-full rounded-2xl bg-white/[0.05] text-center font-display text-3xl font-extrabold tabular text-paper outline-none placeholder:text-lg placeholder:text-mist/60"
                />
              </div>
              <button
                type="button"
                onClick={() => setValue("0")}
                className={`min-h-16 rounded-2xl px-5 text-sm font-bold ring-1 transition active:scale-95 ${
                  value === "0" ? `${accent} ring-transparent` : "bg-white/[0.05] text-fog ring-white/10"
                }`}
              >
                ✕ riscar
              </button>
            </div>
          )}
          {err && <p className="mt-2 text-sm font-semibold text-ana">{err}</p>}

          {after && (
            <p className="mt-4 rounded-xl bg-white/[0.04] px-3 py-2 text-sm text-fog">
              {n === 0 ? "Riscar" : `+${n}`} em {category.label} → total <b className="text-paper">{after.total}</b>
              {bonusGain > 0 && <b className="text-gold"> · bônus +{bonusGain}!</b>}
            </p>
          )}

          <button
            type="button"
            disabled={!ready || pending}
            onClick={save}
            className="mt-4 min-h-14 w-full rounded-2xl bg-paper text-base font-extrabold text-ink transition active:scale-[.98] disabled:opacity-40"
          >
            {pending ? "Salvando…" : ready ? `Salvar jogada · ${category.label} ${n === 0 ? "✕" : n}` : "Marque os pontos"}
          </button>
        </div>
      )}
    </section>
  );
}

/* ───────────── tela inicial: começar partida ───────────── */

function StartPanel({
  me,
  taken,
  today,
  onStarted,
}: {
  me: PlayerId;
  taken: TakenSlot[];
  today: string;
  onStarted: (s: LiveState | null) => void;
}) {
  const [date, setDate] = useState(today);
  const [ref, setRef] = useState({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) });
  const [linked, setLinked] = useState(true);
  const [number, setNumber] = useState(1);
  const [first, setFirst] = useState<PlayerId>(me);
  const [overwrite, setOverwrite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!linked || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    setRef({ year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) });
  }, [date, linked]);

  const monthTaken = useMemo(() => taken.filter((t) => t.year === ref.year && t.month === ref.month), [taken, ref.year, ref.month]);
  const monthFull = monthTaken.length >= MATCHES_PER_MONTH;
  const slotTaken = monthTaken.find((t) => t.number === number);

  useEffect(() => {
    const used = new Set(monthTaken.map((t) => t.number));
    const free = Array.from({ length: MATCHES_PER_MONTH }, (_, i) => i + 1).find((n) => !used.has(n));
    setNumber(free ?? MATCHES_PER_MONTH);
    setOverwrite(false);
  }, [monthTaken]);

  return (
    <section className="glass rounded-[1.75rem] p-5">
      <h2 className="font-display text-2xl font-extrabold">Nova partida</h2>
      <p className="mt-1 text-sm text-fog">
        As jogadas são intercaladas: cada um marca uma categoria por vez. {PLAYER_NAME[otherPlayer(me)]} entra na partida sozinho ao abrir o app.
      </p>

      <div className="mt-5 grid gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-mist">Data</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-h-12 rounded-xl border border-white/10 bg-white/[0.04] px-3 font-semibold text-paper outline-none [color-scheme:dark] focus:border-gold/60"
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-mist">Mês de referência</span>
          <div className="grid grid-cols-[1fr_6rem] gap-2">
            <select
              aria-label="Mês"
              value={ref.month}
              onChange={(e) => {
                setLinked(false);
                setRef((r) => ({ ...r, month: Number(e.target.value) }));
              }}
              className="min-h-12 rounded-xl border border-white/10 bg-ink-3 px-3 font-semibold text-paper outline-none"
            >
              {MONTHS.map((mo, i) => (
                <option key={mo} value={i + 1}>
                  {mo}
                </option>
              ))}
            </select>
            <select
              aria-label="Ano"
              value={ref.year}
              onChange={(e) => {
                setLinked(false);
                setRef((r) => ({ ...r, year: Number(e.target.value) }));
              }}
              className="min-h-12 rounded-xl border border-white/10 bg-ink-3 px-3 font-semibold text-paper outline-none"
            >
              {[ref.year - 1, ref.year, ref.year + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-mist">
            Partida do mês · {monthTaken.length}/{MATCHES_PER_MONTH} jogadas
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: MATCHES_PER_MONTH }, (_, i) => i + 1).map((n) => {
              const t = monthTaken.find((s) => s.number === n);
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={number === n}
                  onClick={() => {
                    setNumber(n);
                    setOverwrite(false);
                  }}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 ring-1 transition active:scale-95 ${
                    number === n ? "bg-white/10 ring-gold/60" : "bg-white/[0.03] ring-white/10"
                  }`}
                >
                  <DieFace value={n} size={24} />
                  <span className="text-sm font-bold">{n}ª</span>
                  <span className={`text-[0.65rem] font-semibold ${t ? "text-gold" : "text-mist"}`}>{t ? `${t.manoel}×${t.ana}` : "livre"}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-mist">Quem começa?</legend>
          <div className="grid grid-cols-2 gap-2">
            {PLAYERS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={first === p}
                onClick={() => setFirst(p)}
                className={`min-h-12 rounded-2xl font-display text-lg font-extrabold ring-1 transition active:scale-95 ${
                  first === p
                    ? `bg-white/10 ring-2 ${p === "manoel" ? "text-manoel ring-manoel/70" : "text-ana ring-ana/70"}`
                    : "bg-white/[0.03] text-fog ring-white/10"
                }`}
              >
                {PLAYER_NAME[p]}
              </button>
            ))}
          </div>
        </fieldset>

        {(monthFull || slotTaken) && (
          <div className="rounded-2xl bg-ana/10 p-4 ring-1 ring-ana/30">
            <p className="text-sm font-bold text-ana">
              {monthFull
                ? `${MONTHS[ref.month - 1]} já tem as ${MATCHES_PER_MONTH} partidas — não dá para jogar uma 4ª.`
                : `A ${number}ª partida deste mês já está registrada.`}
            </p>
            {slotTaken && (
              <label className="mt-3 flex items-center gap-3 text-sm font-semibold">
                <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="size-5 accent-[#ff4f79]" />
                Jogar de novo e sobrescrever a {number}ª ({slotTaken.manoel}×{slotTaken.ana})
              </label>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm font-semibold text-ana">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={pending || Boolean(slotTaken && !overwrite)}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await startLiveAction({ date, year: ref.year, month: ref.month, number, overwrite, firstPlayer: first });
              if (r.ok) onStarted(r.state);
              else setError(r.error);
            })
          }
          className="min-h-14 rounded-2xl bg-paper text-base font-extrabold text-ink transition active:scale-[.98] disabled:opacity-50"
        >
          {pending ? "Criando…" : `Começar a ${number}ª partida`}
        </button>
      </div>
    </section>
  );
}

/* ───────────── cartela (somente leitura, ao vivo) ───────────── */

function ScoreSheet({
  me,
  live,
  flash,
  lastPlay,
}: {
  me: PlayerId;
  live: LiveState;
  flash: Set<string>;
  lastPlay: { player: PlayerId; cat: CategoryId } | null;
}) {
  const totals = { manoel: totalsOf(live.entries.manoel?.scores), ana: totalsOf(live.entries.ana?.scores) };

  const cell = (p: PlayerId, c: Category) => {
    const v = live.entries[p]?.scores[c.id];
    const has = v !== undefined;
    const isFlash = flash.has(`${p}:${c.id}`);
    const isLast = lastPlay?.player === p && lastPlay.cat === c.id;
    const tint = p === "manoel" ? "bg-manoel/20 ring-manoel/60" : "bg-ana/20 ring-ana/60";
    return (
      <div
        key={p}
        className={`grid min-h-10 place-items-center rounded-xl ring-1 transition-colors duration-700 ${
          isFlash ? tint : isLast ? "bg-white/[0.06] ring-gold/50" : "ring-white/[0.05]"
        }`}
      >
        <span className={`font-display text-lg font-bold tabular ${has ? (p === me ? "text-paper" : "text-paper/80") : "text-mist/40"}`}>
          {has ? (v === 0 ? "✕" : v) : "·"}
        </span>
      </div>
    );
  };

  const row = (c: Category, icon?: React.ReactNode) => (
    <div key={c.id} className="grid grid-cols-[1fr_4.75rem_4.75rem] items-center gap-2 px-3 py-1.5">
      <div className="flex items-center gap-2">
        {icon}
        <p className={`text-sm font-semibold leading-tight ${c.id === "kismet" ? "shine-text" : ""}`}>{c.label}</p>
      </div>
      {PLAYERS.map((p) => cell(p, c))}
    </div>
  );

  const totalRow = (label: string, vals: Record<PlayerId, string | number>, strong = false) => (
    <div className={`grid grid-cols-[1fr_4.75rem_4.75rem] items-center gap-2 px-3 ${strong ? "py-3" : "py-1.5"}`}>
      <p className={strong ? "font-display text-lg font-extrabold" : "text-sm font-semibold text-fog"}>{label}</p>
      {PLAYERS.map((p) => (
        <p key={p} className={`text-center font-display font-extrabold tabular ${strong ? "text-2xl" : "text-sm"} ${nameColor(p)}`}>
          {vals[p]}
        </p>
      ))}
    </div>
  );

  return (
    <section aria-label="Cartela" className="glass overflow-hidden rounded-[1.5rem]">
      <div className="sticky top-0 z-20 grid grid-cols-[1fr_4.75rem_4.75rem] gap-2 border-b border-white/[0.07] bg-ink/90 px-3 py-2.5 backdrop-blur-xl">
        <span className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-mist">Cartela</span>
        {PLAYERS.map((p) => (
          <span key={p} className={`text-center text-sm font-extrabold ${nameColor(p)}`}>
            {p === me ? "Você" : PLAYER_NAME[p]}
          </span>
        ))}
      </div>
      <div className="divide-y divide-white/[0.05]">
        {UPPER.map((c, i) => row(c, <DieFace value={i + 1} size={18} />))}
        <div className="bg-white/[0.02]">
          {totalRow(
            "Bônus",
            Object.fromEntries(
              PLAYERS.map((p) => {
                const nb = nextBonusTier(totals[p].upperSubtotal);
                return [p, totals[p].bonus ? `+${totals[p].bonus}` : nb ? `falta ${nb.missing}` : "0"];
              }),
            ) as Record<PlayerId, string>,
          )}
        </div>
        {LOWER.map((c) => row(c))}
        <div className="bg-white/[0.02]">{totalRow("Total", { manoel: totals.manoel.total, ana: totals.ana.total }, true)}</div>
      </div>
    </section>
  );
}

/* ───────────── tela principal ───────────── */

type FeedItem = Play & { player: PlayerId; round: number };

export function LiveMatch({
  me,
  initialState,
  taken,
  today,
  sheetsReady,
}: {
  me: PlayerId;
  initialState: LiveState | null;
  taken: TakenSlot[];
  today: string;
  sheetsReady: boolean;
}) {
  const router = useRouter();
  const other = otherPlayer(me);
  const [live, setLive] = useState<LiveState | null>(initialState);
  const [offline, setOffline] = useState(false);
  const [confirm, setConfirm] = useState<null | "finalize" | "cancel">(null);
  const [result, setResult] = useState<Extract<FinalizeResult, { ok: true }> | null>(null);
  const [endedByOther, setEndedByOther] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error" | "info"; text: string; list?: string[] } | null>(null);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const liveKey = useRef(initialState?.key ?? null);
  const finishing = useRef(false);
  const seen = useRef<number>(initialState?.entries[other]?.plays.length ?? 0);

  const notify = useCallback((kind: "ok" | "error" | "info", text: string, list?: string[]) => setMessage({ kind, text, list }), []);

  const flashCell = useCallback((player: PlayerId, cat: CategoryId) => {
    const k = `${player}:${cat}`;
    setFlash((s) => new Set(s).add(k));
    setTimeout(
      () =>
        setFlash((s) => {
          const n = new Set(s);
          n.delete(k);
          return n;
        }),
      1800,
    );
  }, []);

  /* aplica estado vindo do servidor */
  const applyServer = useCallback(
    (state: LiveState | null) => {
      if (!state && liveKey.current && !finishing.current) setEndedByOther(true);
      if (state && state.key !== liveKey.current) {
        seen.current = state.entries[other]?.plays.length ?? 0;
        setEndedByOther(false);
      } else if (state) {
        const plays = state.entries[other]?.plays ?? [];
        if (plays.length > seen.current) {
          const last = plays.at(-1)!;
          flashCell(other, last.cat);
          notify("info", `${PLAYER_NAME[other]} marcou ${catOf(last.cat).label}: ${last.value === 0 ? "riscou ✕" : last.value}`);
          if (state.turn === me) navigator.vibrate?.([40, 60, 40]);
        }
        seen.current = plays.length;
      }
      liveKey.current = state?.key ?? null;
      setLive(state);
    },
    [me, other, notify, flashCell],
  );

  /* polling */
  useEffect(() => {
    let stop = false;
    const poll = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/ao-vivo", { cache: "no-store" });
        const data = (await res.json()) as { state: LiveState | null };
        if (!stop) {
          applyServer(data.state);
          setOffline(false);
        }
      } catch {
        if (!stop) setOffline(true);
      }
    };
    const id = setInterval(poll, POLL_MS);
    const onVis = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", poll);
    return () => {
      stop = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", poll);
    };
  }, [applyServer]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), message.kind === "error" ? 7000 : 3500);
    return () => clearTimeout(t);
  }, [message]);

  const feed: FeedItem[] = useMemo(() => (live ? timeline(live) : []), [live]);
  const lastOverall = feed.at(-1) ?? null;
  const myPlays = live?.entries[me]?.plays ?? [];
  const otherPlays = live?.entries[other]?.plays ?? [];
  const canUndo = Boolean(lastOverall && lastOverall.player === me);

  const undo = () =>
    startTransition(async () => {
      const r = await undoPlayAction();
      if (r.ok) {
        applyServer(r.state);
        notify("ok", "Jogada desfeita — é a sua vez de novo.");
      } else notify("error", r.error);
    });

  const finalize = () =>
    startTransition(async () => {
      finishing.current = true;
      const r = await finalizeLiveAction();
      setConfirm(null);
      if (r.ok) {
        setResult(r);
        liveKey.current = null;
        setLive(null);
        router.refresh();
      } else {
        finishing.current = false;
        notify("error", r.error, r.fieldErrors);
      }
    });

  const cancel = () =>
    startTransition(async () => {
      finishing.current = true;
      await cancelLiveAction();
      setConfirm(null);
      liveKey.current = null;
      setLive(null);
      finishing.current = false;
      notify("ok", "Partida cancelada.");
    });

  /* ───── resultado final ───── */
  if (result) {
    const s = result.summary;
    return (
      <m.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="glass rounded-[2rem] p-7 text-center" role="status">
        <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-gold/15 text-3xl ring-1 ring-gold/40">🏆</div>
        <h2 className="font-display text-3xl font-extrabold">Partida gravada</h2>
        <p className="mt-1 text-sm text-fog">Salva na planilha · {s.id}</p>
        <p className="mt-6 font-display text-5xl font-extrabold tabular">
          <span className="text-manoel">{s.manoel}</span>
          <span className="mx-3 text-mist">×</span>
          <span className="text-ana">{s.ana}</span>
        </p>
        <p className="mt-2 font-bold text-gold">{s.winner === "Empate" ? "Empate!" : `${s.winner} venceu`}</p>
        <div className="mt-8 grid gap-3">
          <Link href="/" className="min-h-12 rounded-2xl bg-paper py-3.5 font-bold text-ink">
            Ver placar
          </Link>
          <button onClick={() => setResult(null)} className="min-h-12 rounded-2xl bg-white/10 py-3.5 font-bold ring-1 ring-white/15">
            Nova partida
          </button>
        </div>
      </m.div>
    );
  }

  /* ───── sem partida em andamento ───── */
  if (!live) {
    return (
      <div className="space-y-4">
        {endedByOther && (
          <div className="glass rounded-2xl p-4 text-sm">
            <p className="font-bold text-gold">A partida foi encerrada no outro celular.</p>
            <Link href="/" className="mt-1 inline-block font-semibold text-paper underline underline-offset-4">
              Ver o placar atualizado →
            </Link>
          </div>
        )}
        {!sheetsReady && (
          <p className="rounded-2xl bg-gold/10 p-4 text-sm text-gold ring-1 ring-gold/30">
            Google Sheets não configurado: a partida funciona só neste servidor e não será gravada.
          </p>
        )}
        <StartPanel
          me={me}
          taken={taken}
          today={today}
          onStarted={(s) => {
            setEndedByOther(false);
            applyServer(s);
          }}
        />
        <p className="px-2 text-center text-xs text-mist">Esperando? Se {PLAYER_NAME[other]} criar a partida, ela aparece aqui sozinha.</p>
      </div>
    );
  }

  /* ───── partida em andamento ───── */
  const totals = { manoel: totalsOf(live.entries.manoel?.scores), ana: totalsOf(live.entries.ana?.scores) };
  const done = live.turn === null;
  const myTurn = live.turn === me;
  const winner = decideWinner(totals.manoel.total, totals.ana.total);
  const lastMine = myPlays.at(-1);

  return (
    <div className="space-y-4 pb-36">
      {/* cabeçalho + placar da partida */}
      <div className="glass rounded-[1.5rem] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <DieFace value={live.number} size={28} />
            <div>
              <p className="font-display text-lg font-extrabold leading-tight">
                {live.number}ª partida · {MONTHS[live.month - 1]}
              </p>
              <p className="text-xs text-mist">
                {formatDateBR(live.date, { withYear: true })}
                {live.overwrite && <span className="text-ana"> · sobrescreve</span>}
              </p>
            </div>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[0.7rem] font-bold ${offline ? "bg-ana/15 text-ana" : "bg-manoel/10 text-manoel"}`}>
            {offline ? "sem conexão" : "ao vivo"}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {PLAYERS.map((p) => {
            const isTurn = live.turn === p;
            const plays = live.entries[p]?.plays.length ?? 0;
            return (
              <div
                key={p}
                className={`relative rounded-2xl p-3 ring-1 transition ${
                  isTurn ? (p === "manoel" ? "bg-manoel/10 ring-manoel/50" : "bg-ana/10 ring-ana/50") : "bg-white/[0.03] ring-white/10"
                }`}
              >
                <p className={`flex items-center gap-1.5 text-xs font-bold ${nameColor(p)}`}>
                  {isTurn && <span className={`size-2 animate-pulse rounded-full ${p === "manoel" ? "bg-manoel" : "bg-ana"}`} />}
                  {p === me ? "Você" : PLAYER_NAME[p]}
                  {isTurn && <span className="ml-auto text-[0.62rem] uppercase tracking-[0.15em] text-paper/70">na vez</span>}
                </p>
                <p className="font-display text-3xl font-extrabold tabular">{totals[p].total}</p>
                <p className="text-[0.68rem] text-mist">
                  {plays}/{TOTAL_ROUNDS} jogadas
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* sua vez / aguardando / fim */}
      {done ? (
        <section className="glass rounded-[1.5rem] p-5 text-center ring-1 ring-gold/40">
          <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-gold">Cartelas completas</p>
          <p className="mt-2 font-display text-4xl font-extrabold tabular">
            <span className="text-manoel">{totals.manoel.total}</span>
            <span className="mx-2 text-mist">×</span>
            <span className="text-ana">{totals.ana.total}</span>
          </p>
          <p className="mt-1 font-bold text-gold">{winner === "empate" ? "Empate!" : `${PLAYER_NAME[winner]} venceu`}</p>
          <button
            type="button"
            onClick={() => setConfirm("finalize")}
            className="mt-5 min-h-14 w-full rounded-2xl bg-gold text-base font-extrabold text-ink transition active:scale-[.98]"
          >
            Gravar resultado
          </button>
          {canUndo && (
            <button type="button" disabled={pending} onClick={undo} className="mt-3 text-sm font-semibold text-mist disabled:opacity-50">
              Desfazer minha última jogada
            </button>
          )}
        </section>
      ) : myTurn ? (
        <PlayComposer
          key={myPlays.length}
          me={me}
          scores={live.entries[me]?.scores ?? {}}
          round={myPlays.length + 1}
          onSaved={(s, play) => {
            applyServer(s);
            flashCell(me, play.cat);
            notify("ok", `Jogada salva · vez de ${PLAYER_NAME[other]}`);
          }}
          onError={(msg) => notify("error", msg)}
        />
      ) : (
        <section className="glass rounded-[1.5rem] p-5" aria-live="polite">
          <div className="flex items-center gap-3">
            <span className="relative flex size-3">
              <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-75 ${other === "manoel" ? "bg-manoel" : "bg-ana"}`} />
              <span className={`relative inline-flex size-3 rounded-full ${other === "manoel" ? "bg-manoel" : "bg-ana"}`} />
            </span>
            <p className="font-display text-xl font-extrabold">
              Vez de <span className={nameColor(other)}>{PLAYER_NAME[other]}</span>
            </p>
            <span className="ml-auto text-xs text-mist">
              rodada {otherPlays.length + 1}/{TOTAL_ROUNDS}
            </span>
          </div>
          {!live.entries[other] && <p className="mt-2 text-sm text-fog">Aguardando {PLAYER_NAME[other]} abrir o app…</p>}
          {lastMine && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5 text-sm">
              <span className="text-fog">
                Sua jogada: <b className="text-paper">{catOf(lastMine.cat).label}</b> · {fmtValue(lastMine.value)}
              </span>
              {canUndo && (
                <button type="button" disabled={pending} onClick={undo} className="shrink-0 font-bold text-gold disabled:opacity-50">
                  Desfazer
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* últimas jogadas */}
      {feed.length > 0 && (
        <section aria-label="Últimas jogadas" className="glass rounded-[1.5rem] p-4">
          <p className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.25em] text-mist">Últimas jogadas</p>
          <ol className="space-y-1.5">
            {[...feed]
              .reverse()
              .slice(0, 4)
              .map((p) => (
                <li key={`${p.player}-${p.at}`} className="flex items-center gap-2 text-sm">
                  <span className="w-14 shrink-0 text-xs text-mist">rod. {p.round}</span>
                  <span className={`font-bold ${nameColor(p.player)}`}>{p.player === me ? "Você" : PLAYER_NAME[p.player]}</span>
                  <span className="truncate text-fog">{catOf(p.cat).label}</span>
                  <span className="ml-auto font-display font-bold tabular">{p.value === 0 ? "✕" : `+${p.value}`}</span>
                </li>
              ))}
          </ol>
        </section>
      )}

      <ScoreSheet me={me} live={live} flash={flash} lastPlay={lastOverall ? { player: lastOverall.player, cat: lastOverall.cat } : null} />

      <div className="flex flex-wrap justify-center gap-4 pt-2 text-sm">
        <button type="button" onClick={() => setConfirm("cancel")} className="font-semibold text-mist hover:text-ana">
          Cancelar partida
        </button>
        <Link href="/registrar/manual" className="font-semibold text-mist hover:text-paper">
          Lançamento manual
        </Link>
      </div>

      {/* barra fixa com o placar da partida */}
      <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 px-3 md:bottom-4">
        <div className="glass mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-2xl !bg-ink/85 px-4 py-2.5">
          <p className="font-display text-2xl font-extrabold leading-none tabular">
            <span className="text-manoel">{totals.manoel.total}</span>
            <span className="mx-1.5 text-mist">×</span>
            <span className="text-ana">{totals.ana.total}</span>
          </p>
          <p className="truncate text-right text-xs font-semibold text-fog">
            {done ? "Pronto para gravar" : myTurn ? <span className={nameColor(me)}>Sua vez</span> : `Vez de ${PLAYER_NAME[other]}`}
          </p>
        </div>
      </div>

      {/* confirmação */}
      <AnimatePresence>
        {confirm && (
          <m.div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/70 p-3 backdrop-blur-sm sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !pending && setConfirm(null)}
          >
            <m.div
              role="dialog"
              aria-modal="true"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass w-full max-w-md rounded-[2rem] !bg-ink-2/95 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            >
              {confirm === "finalize" ? (
                <>
                  <h2 className="font-display text-2xl font-extrabold">Gravar resultado?</h2>
                  <p className="mt-1 text-sm text-fog">
                    {live.number}ª partida de {MONTHS[live.month - 1]}/{live.year}
                    {live.overwrite ? " — vai substituir o registro anterior." : "."}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {PLAYERS.map((p) => (
                      <div
                        key={p}
                        className={`rounded-2xl p-4 text-center ring-1 ${
                          winner === p ? (p === "manoel" ? "bg-manoel/10 ring-manoel/40" : "bg-ana/10 ring-ana/40") : "ring-white/10"
                        }`}
                      >
                        <p className={`text-xs font-bold ${nameColor(p)}`}>{PLAYER_NAME[p]}</p>
                        <p className="font-display text-4xl font-extrabold tabular">{totals[p].total}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h2 className="font-display text-2xl font-extrabold">Cancelar a partida?</h2>
                  <p className="mt-1 text-sm text-fog">Todas as jogadas desta partida serão apagadas. Nada é gravado no placar.</p>
                </>
              )}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirm(null)}
                  className="min-h-12 rounded-2xl bg-white/10 font-bold ring-1 ring-white/15 disabled:opacity-50"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={confirm === "finalize" ? finalize : cancel}
                  className={`min-h-12 rounded-2xl font-extrabold disabled:opacity-70 ${confirm === "finalize" ? "bg-paper text-ink" : "bg-ana text-ink"}`}
                >
                  {pending ? "Aguarde…" : confirm === "finalize" ? "Gravar" : "Cancelar partida"}
                </button>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      {/* mensagens */}
      <AnimatePresence>
        {message && (
          <m.div
            role={message.kind === "error" ? "alert" : "status"}
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -30, opacity: 0 }}
            className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[80] mx-auto max-w-md"
          >
            <div
              className={`glass rounded-2xl !bg-ink-2/95 p-4 text-sm ring-1 ${
                message.kind === "error" ? "ring-ana/50" : message.kind === "info" ? "ring-gold/50" : "ring-manoel/50"
              }`}
            >
              <p className="font-semibold">{message.text}</p>
              {message.list && message.list.length > 0 && (
                <ul className="mt-2 max-h-32 space-y-0.5 overflow-auto text-xs text-fog">
                  {message.list.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
