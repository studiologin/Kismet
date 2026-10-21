"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  cancelLiveAction,
  finalizeLiveAction,
  saveMyScoresAction,
  startLiveAction,
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
import type { LiveState } from "@/lib/live";
import type { TakenSlot } from "./MatchForm";

const PLAYERS: PlayerId[] = ["manoel", "ana"];
const POLL_MS = 3000;
const SAVE_DEBOUNCE_MS = 900;

type Strs = Record<CategoryId, string>;
type Nums = Partial<Record<CategoryId, number | null>>;

const emptyStrs = (): Strs => Object.fromEntries(CATEGORIES.map((c) => [c.id, ""])) as Strs;
const strsFrom = (n?: Nums): Strs =>
  Object.fromEntries(CATEGORIES.map((c) => [c.id, n?.[c.id] === null || n?.[c.id] === undefined ? "" : String(n[c.id])])) as Strs;
const numsFrom = (s: Strs): Nums =>
  Object.fromEntries(CATEGORIES.map((c) => [c.id, s[c.id].trim() === "" ? null : Number(s[c.id])])) as Nums;

function cardStatus(n: Nums | undefined) {
  let filled = 0;
  let invalid = 0;
  for (const c of CATEGORIES) {
    const v = n?.[c.id];
    if (v === null || v === undefined) continue;
    filled++;
    if (validateScore(c, v)) invalid++;
  }
  return { filled, invalid, complete: filled === CATEGORIES.length && invalid === 0 };
}

function ago(iso?: string) {
  if (!iso) return "";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 5) return "agora";
  if (s < 60) return `há ${s}s`;
  const m = Math.round(s / 60);
  return m < 60 ? `há ${m} min` : `há ${Math.round(m / 60)} h`;
}

/* ───────────── célula editável (minha coluna) ───────────── */

function MyCell({
  cat,
  me,
  value,
  onChange,
  showError,
}: {
  cat: Category;
  me: PlayerId;
  value: string;
  onChange: (v: string) => void;
  showError: boolean;
}) {
  const n = value.trim() === "" ? null : Number(value);
  const err = n === null ? null : validateScore(cat, n);
  const visibleErr = err ?? (showError && n === null ? "Preencha" : null);
  const accent = me === "manoel" ? "bg-manoel text-ink" : "bg-ana text-ink";
  const ring = me === "manoel" ? "focus-within:ring-manoel/80" : "focus-within:ring-ana/80";

  if (cat.rule.kind === "fixed") {
    const fixed = String(cat.rule.value);
    return (
      <div className="flex flex-col">
        <div
          role="radiogroup"
          aria-label={cat.label}
          aria-invalid={Boolean(visibleErr)}
          className={`grid grid-cols-2 gap-1 rounded-xl bg-white/[0.05] p-1 ring-1 ${visibleErr ? "ring-ana/70" : "ring-white/15"}`}
        >
          {["0", fixed].map((opt) => (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={value === opt}
              onClick={() => onChange(value === opt ? "" : opt)}
              className={`min-h-10 rounded-lg text-sm font-bold transition active:scale-95 ${
                value === opt ? (opt === "0" ? "bg-white/15 text-paper" : accent) : "text-mist"
              }`}
            >
              {opt === "0" ? "✕" : opt}
            </button>
          ))}
        </div>
        {visibleErr && <span className="mt-1 text-center text-[0.65rem] font-semibold text-ana">{visibleErr}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className={`rounded-xl ring-1 transition focus-within:ring-2 ${ring} ${visibleErr ? "ring-ana/70" : "ring-white/15"}`}>
        <input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          enterKeyHint="next"
          aria-label={cat.label}
          aria-invalid={Boolean(visibleErr)}
          value={value}
          placeholder="–"
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-11 w-full rounded-xl bg-white/[0.05] text-center font-display text-xl font-bold tabular text-paper outline-none placeholder:text-mist/60"
        />
      </div>
      {visibleErr && <span className="mt-1 text-center text-[0.65rem] font-semibold leading-tight text-ana">{visibleErr}</span>}
    </div>
  );
}

/* ───────────── célula do adversário (somente leitura, ao vivo) ───────────── */

function OtherCell({ value, flash, player }: { value: number | null | undefined; flash: boolean; player: PlayerId }) {
  const has = value !== null && value !== undefined;
  const flashCls = player === "manoel" ? "bg-manoel/25 ring-manoel/60" : "bg-ana/25 ring-ana/60";
  return (
    <div
      className={`grid min-h-11 place-items-center rounded-xl ring-1 transition-colors duration-700 ${
        flash ? flashCls : "bg-transparent ring-white/[0.06]"
      }`}
    >
      <span className={`font-display text-xl font-bold tabular ${has ? "text-paper/85" : "text-mist/50"}`}>
        {has ? value === 0 ? "✕" : value : "·"}
      </span>
    </div>
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

  const blocked = Boolean(slotTaken && !overwrite);

  return (
    <section className="glass rounded-[1.75rem] p-5">
      <h2 className="font-display text-2xl font-extrabold">Nova partida</h2>
      <p className="mt-1 text-sm text-fog">
        Quem começar cria a partida; {PLAYER_NAME[me === "manoel" ? "ana" : "manoel"]} entra nela automaticamente ao abrir o app.
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
                  <span className={`text-[0.65rem] font-semibold ${t ? "text-gold" : "text-mist"}`}>
                    {t ? `${t.manoel}×${t.ana}` : "livre"}
                  </span>
                </button>
              );
            })}
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
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                  className="size-5 accent-[#ff4f79]"
                />
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
          disabled={pending || blocked}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await startLiveAction({ date, year: ref.year, month: ref.month, number, overwrite });
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

/* ───────────── tela principal ───────────── */

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
  const other: PlayerId = me === "manoel" ? "ana" : "manoel";
  const [live, setLive] = useState<LiveState | null>(initialState);
  const [mine, setMine] = useState<Strs>(() => strsFrom(initialState?.entries[me]?.scores));
  const [sync, setSync] = useState<"idle" | "saving" | "saved" | "error" | "offline">("idle");
  const [showErrors, setShowErrors] = useState(false);
  const [confirm, setConfirm] = useState<null | "finalize" | "cancel">(null);
  const [result, setResult] = useState<Extract<FinalizeResult, { ok: true }> | null>(null);
  const [endedByOther, setEndedByOther] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string; list?: string[] } | null>(null);
  const [flash, setFlash] = useState<Set<CategoryId>>(new Set());
  const [, tick] = useState(0);
  const [pending, startTransition] = useTransition();

  const dirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveKey = useRef(initialState?.key ?? null);
  const finishing = useRef(false);
  const prevOther = useRef<Nums | undefined>(initialState?.entries[other]?.scores);

  /* aplica estado vindo do servidor */
  const applyServer = useCallback(
    (state: LiveState | null) => {
      if (!state && liveKey.current && !finishing.current) setEndedByOther(true);
      if (state && state.key !== liveKey.current) {
        // nova partida: carrega minha coluna do servidor
        setMine(strsFrom(state.entries[me]?.scores));
        dirty.current = false;
        setEndedByOther(false);
      } else if (state && !dirty.current) {
        setMine(strsFrom(state.entries[me]?.scores));
      }
      // destaca o que o adversário acabou de preencher
      const next = state?.entries[other]?.scores;
      const changed = new Set<CategoryId>();
      for (const c of CATEGORIES) {
        if ((prevOther.current?.[c.id] ?? null) !== (next?.[c.id] ?? null) && next?.[c.id] !== undefined) changed.add(c.id);
      }
      prevOther.current = next;
      if (changed.size && liveKey.current === state?.key) {
        setFlash(changed);
        setTimeout(() => setFlash(new Set()), 1600);
        if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(30);
      }
      liveKey.current = state?.key ?? null;
      setLive(state);
    },
    [me, other],
  );

  /* polling da partida ao vivo */
  useEffect(() => {
    let stop = false;
    const poll = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/ao-vivo", { cache: "no-store" });
        const data = (await res.json()) as { state: LiveState | null };
        if (!stop) {
          applyServer(data.state);
          setSync((s) => (s === "offline" ? "idle" : s));
        }
      } catch {
        if (!stop) setSync("offline");
      }
    };
    const id = setInterval(poll, POLL_MS);
    const clock = setInterval(() => tick((n) => n + 1), 5000);
    const onVis = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", poll);
    return () => {
      stop = true;
      clearInterval(id);
      clearInterval(clock);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", poll);
    };
  }, [applyServer]);

  /* salva minha coluna com debounce */
  const pushMine = useCallback(
    (values: Strs) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSync("saving");
      saveTimer.current = setTimeout(async () => {
        const r = await saveMyScoresAction(numsFrom(values));
        if (r.ok) {
          dirty.current = false;
          setSync("saved");
          applyServer(r.state);
        } else {
          setSync("error");
          setMessage({ kind: "error", text: r.error });
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [applyServer],
  );

  const mineRef = useRef(mine);
  useEffect(() => {
    mineRef.current = mine;
  }, [mine]);

  const setValue = (id: CategoryId, v: string) => {
    dirty.current = true;
    const next = { ...mineRef.current, [id]: v };
    mineRef.current = next;
    setMine(next);
    pushMine(next);
  };

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), message.kind === "ok" ? 3500 : 7000);
    return () => clearTimeout(t);
  }, [message]);

  const myNums = useMemo(() => numsFrom(mine), [mine]);
  const otherNums = live?.entries[other]?.scores;
  const scores: Record<PlayerId, Nums | undefined> = me === "manoel" ? { manoel: myNums, ana: otherNums } : { manoel: otherNums, ana: myNums };
  const totals = {
    manoel: computeTotals((scores.manoel ?? {}) as Record<CategoryId, number>),
    ana: computeTotals((scores.ana ?? {}) as Record<CategoryId, number>),
  };
  const st = { manoel: cardStatus(scores.manoel), ana: cardStatus(scores.ana) };
  const bothComplete = st.manoel.complete && st.ana.complete;
  const winner = decideWinner(totals.manoel.total, totals.ana.total);
  const otherJoined = Boolean(live?.entries[other]);

  const finalize = () =>
    startTransition(async () => {
      finishing.current = true;
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        await saveMyScoresAction(myNums);
      }
      const r = await finalizeLiveAction();
      setConfirm(null);
      if (r.ok) {
        setResult(r);
        liveKey.current = null;
        setLive(null);
        setMine(emptyStrs());
        router.refresh();
      } else {
        finishing.current = false;
        setShowErrors(true);
        setMessage({ kind: "error", text: r.error, list: r.fieldErrors });
      }
    });

  const cancel = () =>
    startTransition(async () => {
      finishing.current = true;
      await cancelLiveAction();
      setConfirm(null);
      liveKey.current = null;
      setLive(null);
      setMine(emptyStrs());
      finishing.current = false;
      setMessage({ kind: "ok", text: "Partida cancelada." });
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
            Google Sheets não configurado: a partida ao vivo funciona só neste servidor e não será gravada.
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
        <p className="px-2 text-center text-xs text-mist">
          Esperando? Se {PLAYER_NAME[other]} criar a partida, ela aparece aqui sozinha.
        </p>
      </div>
    );
  }

  /* ───── partida em andamento ───── */
  const syncLabel = {
    idle: "sincronizado",
    saved: "salvo",
    saving: "salvando…",
    error: "erro ao salvar",
    offline: "sem conexão",
  }[sync];

  const header = (
    <div className="glass mb-4 rounded-[1.5rem] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <DieFace value={live.number} size={30} />
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
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-bold ${
            sync === "error" || sync === "offline" ? "bg-ana/15 text-ana" : "bg-manoel/10 text-manoel"
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${
              sync === "saving" ? "animate-pulse bg-gold" : sync === "error" || sync === "offline" ? "bg-ana" : "bg-manoel"
            }`}
          />
          {syncLabel}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-xs">
        <span className={`size-2 rounded-full ${otherJoined ? "animate-pulse " + (other === "manoel" ? "bg-manoel" : "bg-ana") : "bg-mist"}`} />
        {otherJoined ? (
          <span className="text-fog">
            <b className={other === "manoel" ? "text-manoel" : "text-ana"}>{PLAYER_NAME[other]}</b> está jogando ·{" "}
            {st[other].filled}/{CATEGORIES.length} preenchidos · {ago(live.entries[other]?.updatedAt)}
          </span>
        ) : (
          <span className="text-fog">Aguardando {PLAYER_NAME[other]} abrir o app…</span>
        )}
      </div>
    </div>
  );

  const row = (c: Category, icon?: React.ReactNode) => (
    <div key={c.id} className="grid grid-cols-[1fr_5.5rem_5.5rem] items-start gap-2 px-3 py-2">
      <div className="flex items-center gap-2 pt-2">
        {icon}
        <div>
          <p className={`text-sm font-bold leading-tight ${c.id === "kismet" ? "shine-text" : ""}`}>{c.label}</p>
          <p className="text-[0.68rem] text-mist">{c.hint}</p>
        </div>
      </div>
      {PLAYERS.map((p) =>
        p === me ? (
          <MyCell key={p} cat={c} me={me} value={mine[c.id]} onChange={(v) => setValue(c.id, v)} showError={showErrors} />
        ) : (
          <OtherCell key={p} player={p} value={otherNums?.[c.id]} flash={flash.has(c.id)} />
        ),
      )}
    </div>
  );

  const totalRow = (label: string, vals: Record<PlayerId, string | number>, strong = false, hint?: string) => (
    <div className={`grid grid-cols-[1fr_5.5rem_5.5rem] items-center gap-2 px-3 ${strong ? "py-3" : "py-2"}`}>
      <div>
        <p className={strong ? "font-display text-lg font-extrabold" : "text-sm font-semibold text-fog"}>{label}</p>
        {hint && <p className="text-[0.68rem] text-mist">{hint}</p>}
      </div>
      {PLAYERS.map((p) => (
        <p key={p} className={`text-center font-display font-extrabold tabular ${strong ? "text-2xl" : "text-base"} ${p === "manoel" ? "text-manoel" : "text-ana"}`}>
          {vals[p]}
        </p>
      ))}
    </div>
  );

  return (
    <div className="pb-44">
      {header}

      <section aria-label="Cartela" className="glass overflow-hidden rounded-[1.5rem]">
        <div className="sticky top-0 z-20 grid grid-cols-[1fr_5.5rem_5.5rem] gap-2 border-b border-white/[0.07] bg-ink/90 px-3 py-2.5 backdrop-blur-xl">
          <span className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-mist">Categoria</span>
          {PLAYERS.map((p) => (
            <span key={p} className={`text-center text-sm font-extrabold ${p === "manoel" ? "text-manoel" : "text-ana"}`}>
              {p === me ? "Você" : PLAYER_NAME[p]}
            </span>
          ))}
        </div>
        <div className="divide-y divide-white/[0.05]">
          <p className="bg-white/[0.02] px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.25em] text-gold">Seção superior</p>
          {UPPER.map((c, i) => row(c, <DieFace value={i + 1} size={20} />))}
          <div className="bg-white/[0.02]">
            {totalRow(
              "Bônus",
              Object.fromEntries(
                PLAYERS.map((p) => {
                  const nb = nextBonusTier(totals[p].upperSubtotal);
                  return [p, totals[p].bonus ? `+${totals[p].bonus}` : nb ? `falta ${nb.missing}` : "0"];
                }),
              ) as Record<PlayerId, string>,
              false,
              "63: +35 · 71: +55 · 78: +75",
            )}
            {totalRow("Total superior", { manoel: totals.manoel.upperTotal, ana: totals.ana.upperTotal })}
          </div>
          <p className="bg-white/[0.02] px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.25em] text-gold">Seção inferior</p>
          {LOWER.map((c) => row(c))}
          <div className="bg-white/[0.02]">
            {totalRow("Total inferior", { manoel: totals.manoel.lowerTotal, ana: totals.ana.lowerTotal })}
            {totalRow("Total", { manoel: totals.manoel.total, ana: totals.ana.total }, true)}
          </div>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
        <button type="button" onClick={() => setConfirm("cancel")} className="font-semibold text-mist hover:text-ana">
          Cancelar partida
        </button>
        <Link href="/registrar/manual" className="font-semibold text-mist hover:text-paper">
          Lançamento manual
        </Link>
      </div>

      {/* barra fixa — fica acima da navegação inferior */}
      <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 px-3 md:bottom-4">
        <div className="glass mx-auto flex max-w-2xl items-center gap-3 rounded-2xl !bg-ink/85 p-2.5 pl-4">
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xl font-extrabold leading-none tabular">
              <span className="text-manoel">{totals.manoel.total}</span>
              <span className="mx-1.5 text-mist">×</span>
              <span className="text-ana">{totals.ana.total}</span>
            </p>
            <p className="mt-1 truncate text-xs text-fog">
              {bothComplete
                ? winner === "empate"
                  ? "Empate — pronto para gravar"
                  : `${PLAYER_NAME[winner]} vence por ${Math.abs(totals.manoel.total - totals.ana.total)}`
                : !st[me].complete
                  ? `Você: ${st[me].filled}/${CATEGORIES.length}${st[me].invalid ? ` · ${st[me].invalid} inválido(s)` : ""}`
                  : `Aguardando ${PLAYER_NAME[other]} (${st[other].filled}/${CATEGORIES.length})`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => (bothComplete ? setConfirm("finalize") : setShowErrors(true))}
            className={`min-h-12 shrink-0 rounded-xl px-4 text-sm font-extrabold transition active:scale-95 ${
              bothComplete ? "bg-gold text-ink" : "bg-white/10 text-fog"
            }`}
          >
            {bothComplete ? "Finalizar" : "Conferir"}
          </button>
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
                        <p className={`text-xs font-bold ${p === "manoel" ? "text-manoel" : "text-ana"}`}>{PLAYER_NAME[p]}</p>
                        <p className="font-display text-4xl font-extrabold tabular">{totals[p].total}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-center font-bold text-gold">
                    {winner === "empate" ? "Empate" : `Vencedor: ${PLAYER_NAME[winner]}`}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="font-display text-2xl font-extrabold">Cancelar a partida?</h2>
                  <p className="mt-1 text-sm text-fog">As duas cartelas em andamento serão apagadas. Nada é gravado no placar.</p>
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
            <div className={`glass rounded-2xl !bg-ink-2/95 p-4 text-sm ring-1 ${message.kind === "error" ? "ring-ana/50" : "ring-manoel/50"}`}>
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
