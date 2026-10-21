"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { saveMatchAction, type SaveResult } from "@/app/registrar/actions";
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

export interface TakenSlot {
  year: number;
  month: number;
  number: number;
  date: string;
  manoel: number;
  ana: number;
  winner: string;
}

type Values = Record<PlayerId, Record<CategoryId, string>>;

const PLAYERS: PlayerId[] = ["manoel", "ana"];
const DRAFT_KEY = "kismet-draft-v1";

const emptyValues = (): Values => ({
  manoel: Object.fromEntries(CATEGORIES.map((c) => [c.id, ""])) as Record<CategoryId, string>,
  ana: Object.fromEntries(CATEGORIES.map((c) => [c.id, ""])) as Record<CategoryId, string>,
});

const toNum = (s: string) => (s.trim() === "" ? null : Number(s));

function useDraft<T>(key: string, value: T, restore: (v: T) => void) {
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) restore(JSON.parse(raw) as T);
    } catch {}
    loaded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);
}

/* ───────────── célula de pontuação ───────────── */

function ScoreCell({
  cat,
  player,
  value,
  error,
  onChange,
  onBlur,
}: {
  cat: Category;
  player: PlayerId;
  value: string;
  error: string | null;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  const ring = player === "manoel" ? "focus-within:ring-manoel/70" : "focus-within:ring-ana/70";
  const accent = player === "manoel" ? "bg-manoel text-ink" : "bg-ana text-ink";
  const id = `${player}-${cat.id}`;
  const label = `${PLAYER_NAME[player]} — ${cat.label}`;

  if (cat.rule.kind === "fixed") {
    const fixed = String(cat.rule.value);
    return (
      <div className="flex flex-col items-stretch">
        <div
          role="radiogroup"
          aria-label={label}
          aria-invalid={Boolean(error)}
          className={`grid grid-cols-2 gap-1 rounded-xl bg-white/[0.04] p-1 ring-1 ${error ? "ring-ana/70" : "ring-white/10"}`}
        >
          {["0", fixed].map((opt) => (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={value === opt}
              onClick={() => onChange(value === opt ? "" : opt)}
              className={`rounded-lg py-2 text-sm font-bold transition-all active:scale-95 ${
                value === opt ? (opt === "0" ? "bg-white/15 text-paper" : accent) : "text-mist hover:text-paper"
              }`}
            >
              {opt === "0" ? "✕" : opt}
            </button>
          ))}
        </div>
        {error && <span className="mt-1 text-center text-[0.65rem] font-semibold text-ana">{error}</span>}
      </div>
    );
  }

  const n = toNum(value);
  const diceHint =
    cat.rule.kind === "multiple" && n !== null && !error && n > 0 ? `${n / cat.rule.face} dado${n / cat.rule.face > 1 ? "s" : ""}` : null;

  return (
    <div className="flex flex-col items-stretch">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className={`rounded-xl ring-1 transition focus-within:ring-2 ${ring} ${error ? "ring-ana/70" : "ring-white/10"}`}>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          min={0}
          enterKeyHint="next"
          value={value}
          placeholder="–"
          aria-invalid={Boolean(error)}
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
          onBlur={onBlur}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full rounded-xl bg-white/[0.04] py-2.5 text-center font-display text-xl font-bold tabular text-paper outline-none placeholder:text-mist/60"
        />
      </div>
      {error ? (
        <span className="mt-1 text-center text-[0.65rem] font-semibold leading-tight text-ana">{error}</span>
      ) : diceHint ? (
        <span className="mt-1 text-center text-[0.65rem] text-mist">{diceHint}</span>
      ) : null}
    </div>
  );
}

function TotalRow({
  label,
  hint,
  values,
  strong = false,
}: {
  label: string;
  hint?: string;
  values: Record<PlayerId, number | string>;
  strong?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[1fr_5.25rem_5.25rem] items-center gap-2 px-3 sm:grid-cols-[1fr_7rem_7rem] sm:gap-4 sm:px-5 ${
        strong ? "py-4" : "py-2.5"
      }`}
    >
      <div>
        <p className={strong ? "font-display text-lg font-extrabold" : "text-sm font-semibold text-fog"}>{label}</p>
        {hint && <p className="text-[0.7rem] text-mist">{hint}</p>}
      </div>
      {PLAYERS.map((p) => (
        <p
          key={p}
          className={`text-center font-display font-extrabold tabular ${strong ? "text-3xl" : "text-lg"} ${
            p === "manoel" ? "text-manoel" : "text-ana"
          }`}
        >
          {values[p]}
        </p>
      ))}
    </div>
  );
}

/* ───────────── formulário ───────────── */

export function MatchForm({
  taken,
  today,
  sheetsReady,
}: {
  taken: TakenSlot[];
  today: string;
  sheetsReady: boolean;
}) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [ref, setRef] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }));
  const [refLinked, setRefLinked] = useState(true);
  const [number, setNumber] = useState(1);
  const [overwrite, setOverwrite] = useState(false);
  const [values, setValues] = useState<Values>(emptyValues);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "error"; text: string; list?: string[] } | null>(null);
  const [saved, setSaved] = useState<Extract<SaveResult, { ok: true }> | null>(null);
  const [pending, startTransition] = useTransition();

  useDraft(DRAFT_KEY, { date, values }, (d) => {
    if (d?.values?.manoel && d?.values?.ana) setValues({ ...emptyValues(), ...d.values });
    if (d?.date && /^\d{4}-\d{2}-\d{2}$/.test(d.date)) setDate(d.date);
  });

  // mês de referência acompanha a data, até o usuário alterar manualmente
  useEffect(() => {
    if (!refLinked || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    setRef({ year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) });
  }, [date, refLinked]);

  const monthTaken = useMemo(
    () => taken.filter((t) => t.year === ref.year && t.month === ref.month),
    [taken, ref.year, ref.month],
  );
  const monthFull = monthTaken.length >= MATCHES_PER_MONTH;
  const slotTaken = monthTaken.find((t) => t.number === number);

  // sugere o próximo nº livre ao trocar de mês
  useEffect(() => {
    const used = new Set(monthTaken.map((t) => t.number));
    const free = Array.from({ length: MATCHES_PER_MONTH }, (_, i) => i + 1).find((n) => !used.has(n));
    setNumber(free ?? MATCHES_PER_MONTH);
    setOverwrite(false);
  }, [monthTaken]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.kind === "ok" ? 4000 : 7000);
    return () => clearTimeout(t);
  }, [toast]);

  const numbers = useMemo(() => {
    const out = {} as Record<PlayerId, Partial<Record<CategoryId, number | null>>>;
    for (const p of PLAYERS) out[p] = Object.fromEntries(CATEGORIES.map((c) => [c.id, toNum(values[p][c.id])]));
    return out;
  }, [values]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    for (const p of PLAYERS)
      for (const c of CATEGORIES) {
        const msg = validateScore(c, numbers[p][c.id]);
        if (msg) e[`${p}-${c.id}`] = msg;
      }
    return e;
  }, [numbers]);

  const totals = useMemo(
    () => ({
      manoel: computeTotals(numbers.manoel as Record<CategoryId, number>),
      ana: computeTotals(numbers.ana as Record<CategoryId, number>),
    }),
    [numbers],
  );
  const winner = decideWinner(totals.manoel.total, totals.ana.total);
  const filled = PLAYERS.reduce((a, p) => a + CATEGORIES.filter((c) => values[p][c.id] !== "").length, 0);
  const totalFields = CATEGORIES.length * 2;

  const visibleError = (key: string) => {
    const msg = errors[key];
    if (!msg) return null;
    const [p, c] = key.split("-") as [PlayerId, CategoryId];
    if (msg.startsWith("Preencha")) return showAll ? msg : null;
    return showAll || touched.has(key) || values[p][c] !== "" ? msg : null;
  };

  const setValue = (p: PlayerId, c: CategoryId, v: string) =>
    setValues((prev) => ({ ...prev, [p]: { ...prev[p], [c]: v } }));
  const touch = (key: string) => setTouched((prev) => new Set(prev).add(key));

  const fillEmptyWithZero = () =>
    setValues((prev) => {
      const next = emptyValues();
      for (const p of PLAYERS)
        for (const c of CATEGORIES) next[p][c.id] = prev[p][c.id] === "" ? "0" : prev[p][c.id];
      return next;
    });

  const resetForm = () => {
    setValues(emptyValues());
    setTouched(new Set());
    setShowAll(false);
    setOverwrite(false);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
  };

  const headerError =
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
      ? "Informe a data da partida."
      : slotTaken && !overwrite
        ? monthFull
          ? `${MONTHS[ref.month - 1]} já tem ${MATCHES_PER_MONTH} partidas. Marque “sobrescrever” para substituir a partida ${number}.`
          : `A partida ${number} de ${MONTHS[ref.month - 1]} já foi registrada. Escolha outro número ou marque “sobrescrever”.`
        : null;

  const review = () => {
    setShowAll(true);
    const errCount = Object.keys(errors).length;
    if (headerError || errCount) {
      setToast({
        kind: "error",
        text: headerError ?? `${errCount} campo(s) precisam de atenção.`,
      });
      const first = document.querySelector<HTMLElement>("[aria-invalid='true']");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (first instanceof HTMLInputElement) setTimeout(() => first.focus({ preventScroll: true }), 400);
      return;
    }
    setToast(null);
    setConfirmOpen(true);
  };

  const save = () =>
    startTransition(async () => {
      const r = await saveMatchAction({
        date,
        year: ref.year,
        month: ref.month,
        number,
        overwrite,
        scores: numbers,
      });
      setConfirmOpen(false);
      if (r.ok) {
        setSaved(r);
        resetForm();
        router.refresh();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setToast({ kind: "error", text: r.error, list: r.fieldErrors });
        if (r.conflict) setShowAll(true);
      }
    });

  const years = [ref.year - 1, ref.year, ref.year + 1];

  /* ───────────── sucesso ───────────── */
  if (saved) {
    const s = saved.summary;
    return (
      <m.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass mx-auto max-w-lg rounded-[2rem] p-8 text-center"
        role="status"
      >
        <m.div
          initial={{ rotate: -180, scale: 0 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 160, damping: 14 }}
          className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-manoel/15 text-3xl text-manoel ring-1 ring-manoel/40"
        >
          ✓
        </m.div>
        <h2 className="font-display text-3xl font-extrabold">
          {saved.status === "updated" ? "Partida sobrescrita" : "Partida registrada"}
        </h2>
        <p className="mt-2 text-fog">Gravada na planilha KISMET RESULTADOS · {s.id}</p>
        <p className="mt-6 font-display text-5xl font-extrabold tabular">
          <span className="text-manoel">{s.manoel}</span>
          <span className="mx-3 text-mist">×</span>
          <span className="text-ana">{s.ana}</span>
        </p>
        <p className="mt-2 font-bold text-gold">{s.winner === "Empate" ? "Empate!" : `${s.winner} venceu`}</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link href="/" className="rounded-2xl bg-paper py-3.5 font-bold text-ink">
            Ver placar
          </Link>
          <button onClick={() => setSaved(null)} className="rounded-2xl bg-white/10 py-3.5 font-bold ring-1 ring-white/15">
            Registrar outra
          </button>
        </div>
      </m.div>
    );
  }

  /* ───────────── formulário ───────────── */
  return (
    <div className="pb-44">
      {!sheetsReady && (
        <p className="mb-6 rounded-2xl bg-gold/10 p-4 text-sm text-gold ring-1 ring-gold/30">
          O Google Sheets ainda não está configurado: dá para preencher e conferir a cartela, mas a gravação vai falhar até as
          variáveis de ambiente serem definidas.
        </p>
      )}

      {/* 1. dados da partida */}
      <section aria-labelledby="sec-partida" className="glass mb-6 rounded-[1.75rem] p-4 sm:p-6">
        <h2 id="sec-partida" className="mb-4 flex items-center gap-3 font-display text-xl font-extrabold">
          <span className="grid size-7 place-items-center rounded-lg bg-gold/15 text-sm text-gold">1</span>
          Nova partida
        </h2>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-mist">Data</span>
            <input
              type="date"
              value={date}
              max="2100-12-31"
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 font-semibold text-paper outline-none [color-scheme:dark] focus:border-gold/60"
            />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-mist">Mês / ano de referência</span>
            <div className="grid grid-cols-[1fr_6rem] gap-2">
              <select
                aria-label="Mês de referência"
                value={ref.month}
                onChange={(e) => {
                  setRefLinked(false);
                  setRef((r) => ({ ...r, month: Number(e.target.value) }));
                }}
                className="rounded-xl border border-white/10 bg-ink-3 px-3 py-3 font-semibold text-paper outline-none focus:border-gold/60"
              >
                {MONTHS.map((mo, i) => (
                  <option key={mo} value={i + 1}>
                    {mo}
                  </option>
                ))}
              </select>
              <select
                aria-label="Ano de referência"
                value={ref.year}
                onChange={(e) => {
                  setRefLinked(false);
                  setRef((r) => ({ ...r, year: Number(e.target.value) }));
                }}
                className="rounded-xl border border-white/10 bg-ink-3 px-3 py-3 font-semibold text-paper outline-none focus:border-gold/60"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <fieldset className="mt-5">
          <legend className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-mist">
            Nº da partida no mês · {monthTaken.length}/{MATCHES_PER_MONTH} registradas
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: MATCHES_PER_MONTH }, (_, i) => i + 1).map((n) => {
              const t = monthTaken.find((s) => s.number === n);
              const active = number === n;
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setNumber(n);
                    setOverwrite(false);
                  }}
                  className={`relative flex flex-col items-center gap-1.5 rounded-2xl p-3 ring-1 transition active:scale-95 ${
                    active ? "bg-white/10 ring-gold/60" : "bg-white/[0.03] ring-white/10 hover:bg-white/[0.06]"
                  }`}
                >
                  <DieFace value={n} size={26} />
                  <span className="text-sm font-bold">Partida {n}</span>
                  <span className={`text-[0.65rem] font-semibold ${t ? "text-gold" : "text-mist"}`}>
                    {t ? `registrada · ${t.manoel}×${t.ana}` : "livre"}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <AnimatePresence>
          {(monthFull || slotTaken) && (
            <m.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 rounded-2xl bg-ana/10 p-4 ring-1 ring-ana/30">
                <p className="text-sm font-bold text-ana">
                  {monthFull
                    ? `${MONTHS[ref.month - 1]} já tem as ${MATCHES_PER_MONTH} partidas — não dá para registrar uma 4ª.`
                    : `A partida ${number} deste mês já está na planilha.`}
                </p>
                {slotTaken && (
                  <>
                    <p className="mt-1 text-xs text-fog">
                      Registro atual da partida {number}:{" "}
                      {slotTaken.date ? formatDateBR(slotTaken.date, { withYear: true }) + " · " : ""}
                      Manoel {slotTaken.manoel} × {slotTaken.ana} Ana ({slotTaken.winner}).
                    </p>
                    <label className="mt-3 flex cursor-pointer items-center gap-3 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={overwrite}
                        onChange={(e) => setOverwrite(e.target.checked)}
                        className="size-5 accent-[#ff4f79]"
                      />
                      Sobrescrever a partida {number} com esta cartela
                    </label>
                  </>
                )}
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </section>

      {/* 2. cartela */}
      <section aria-labelledby="sec-cartela" className="glass overflow-hidden rounded-[1.75rem]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-6 sm:pt-6">
          <h2 id="sec-cartela" className="flex items-center gap-3 font-display text-xl font-extrabold">
            <span className="grid size-7 place-items-center rounded-lg bg-gold/15 text-sm text-gold">2</span>
            Cartela
          </h2>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-mist tabular">
              {filled}/{totalFields}
            </span>
            <button type="button" onClick={fillEmptyWithZero} className="rounded-lg bg-white/[0.06] px-2.5 py-1.5 font-semibold text-fog hover:text-paper">
              Vazios = 0
            </button>
            <button type="button" onClick={resetForm} className="rounded-lg bg-white/[0.06] px-2.5 py-1.5 font-semibold text-fog hover:text-ana">
              Limpar
            </button>
          </div>
        </div>

        {/* cabeçalho fixo com nomes */}
        <div className="sticky top-0 z-20 grid grid-cols-[1fr_5.25rem_5.25rem] gap-2 border-y border-white/[0.07] bg-ink/85 px-3 py-2.5 backdrop-blur-xl sm:grid-cols-[1fr_7rem_7rem] sm:gap-4 sm:px-5">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-mist">Categoria</span>
          <span className="text-center text-sm font-extrabold text-manoel">Manoel</span>
          <span className="text-center text-sm font-extrabold text-ana">Ana</span>
        </div>

        <div className="divide-y divide-white/[0.05]">
          <p className="bg-white/[0.02] px-3 py-2 text-[0.7rem] font-bold uppercase tracking-[0.25em] text-gold sm:px-5">
            Seção superior
          </p>
          {UPPER.map((c) => (
            <div key={c.id} className="grid grid-cols-[1fr_5.25rem_5.25rem] items-start gap-2 px-3 py-2.5 sm:grid-cols-[1fr_7rem_7rem] sm:gap-4 sm:px-5">
              <div className="flex items-center gap-2.5 pt-1.5">
                <DieFace value={UPPER.indexOf(c) + 1} size={22} />
                <div>
                  <p className="text-sm font-bold leading-tight">{c.label}</p>
                  <p className="text-[0.7rem] text-mist">{c.hint}</p>
                </div>
              </div>
              {PLAYERS.map((p) => (
                <ScoreCell
                  key={p}
                  cat={c}
                  player={p}
                  value={values[p][c.id]}
                  error={visibleError(`${p}-${c.id}`)}
                  onChange={(v) => setValue(p, c.id, v)}
                  onBlur={() => touch(`${p}-${c.id}`)}
                />
              ))}
            </div>
          ))}
          <div className="bg-white/[0.02]">
            <TotalRow label="Subtotal" values={{ manoel: totals.manoel.upperSubtotal, ana: totals.ana.upperSubtotal }} />
            <TotalRow
              label="Bônus"
              hint="63–70: 35 · 71–77: 55 · 78+: 75"
              values={Object.fromEntries(
                PLAYERS.map((p) => {
                  const nb = nextBonusTier(totals[p].upperSubtotal);
                  return [p, totals[p].bonus ? `+${totals[p].bonus}` : nb ? `faltam ${nb.missing}` : "0"];
                }),
              ) as Record<PlayerId, string>}
            />
            <TotalRow label="Total superior" values={{ manoel: totals.manoel.upperTotal, ana: totals.ana.upperTotal }} />
          </div>

          <p className="bg-white/[0.02] px-3 py-2 text-[0.7rem] font-bold uppercase tracking-[0.25em] text-gold sm:px-5">
            Seção inferior
          </p>
          {LOWER.map((c) => (
            <div key={c.id} className="grid grid-cols-[1fr_5.25rem_5.25rem] items-start gap-2 px-3 py-2.5 sm:grid-cols-[1fr_7rem_7rem] sm:gap-4 sm:px-5">
              <div className="pt-1.5">
                <p className={`text-sm font-bold leading-tight ${c.id === "kismet" ? "shine-text" : ""}`}>{c.label}</p>
                <p className="text-[0.7rem] text-mist">{c.hint}</p>
              </div>
              {PLAYERS.map((p) => (
                <ScoreCell
                  key={p}
                  cat={c}
                  player={p}
                  value={values[p][c.id]}
                  error={visibleError(`${p}-${c.id}`)}
                  onChange={(v) => setValue(p, c.id, v)}
                  onBlur={() => touch(`${p}-${c.id}`)}
                />
              ))}
            </div>
          ))}
          <div className="bg-white/[0.02]">
            <TotalRow label="Total inferior" values={{ manoel: totals.manoel.lowerTotal, ana: totals.ana.lowerTotal }} />
            <TotalRow label="Total geral" strong values={{ manoel: totals.manoel.total, ana: totals.ana.total }} />
          </div>
        </div>
      </section>

      {/* barra fixa de totais */}
      <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 px-3 md:bottom-4">
        <div className="glass mx-auto flex max-w-3xl items-center gap-3 rounded-2xl !bg-ink/80 p-2.5 pl-4">
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xl font-extrabold leading-none tabular">
              <span className="text-manoel">{totals.manoel.total}</span>
              <span className="mx-1.5 text-mist">×</span>
              <span className="text-ana">{totals.ana.total}</span>
            </p>
            <p className="mt-1 truncate text-xs text-fog">
              {filled === 0
                ? "Preencha a cartela"
                : winner === "empate"
                  ? "Empatados"
                  : `${PLAYER_NAME[winner]} na frente por ${Math.abs(totals.manoel.total - totals.ana.total)}`}
            </p>
          </div>
          <button
            type="button"
            onClick={review}
            className="shrink-0 rounded-xl bg-paper px-5 py-3.5 text-sm font-extrabold text-ink transition active:scale-95"
          >
            Revisar e salvar
          </button>
        </div>
      </div>

      {/* confirmação */}
      <AnimatePresence>
        {confirmOpen && (
          <m.div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/70 p-3 backdrop-blur-sm sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !pending && setConfirmOpen(false)}
          >
            <m.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
              initial={{ y: 40, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass w-full max-w-md rounded-[2rem] !bg-ink-2/95 p-6"
            >
              <h2 id="confirm-title" className="font-display text-2xl font-extrabold">
                Confirmar registro
              </h2>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-white/[0.04] p-3">
                  <dt className="text-xs text-mist">Data</dt>
                  <dd className="font-bold">{formatDateBR(date, { withYear: true })}</dd>
                </div>
                <div className="rounded-xl bg-white/[0.04] p-3">
                  <dt className="text-xs text-mist">Referência</dt>
                  <dd className="font-bold">
                    Partida {number} · {MONTHS[ref.month - 1]}/{ref.year}
                  </dd>
                </div>
              </dl>
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
                    <p className="text-[0.7rem] text-mist tabular">
                      sup {totals[p].upperTotal} · inf {totals[p].lowerTotal}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-center font-bold text-gold">
                {winner === "empate" ? "Resultado: empate" : `Vencedor: ${PLAYER_NAME[winner]}`}
              </p>
              {overwrite && slotTaken && (
                <p className="mt-3 rounded-xl bg-ana/10 p-3 text-xs font-semibold text-ana ring-1 ring-ana/30">
                  Isto vai substituir o registro atual da partida {number} ({slotTaken.manoel} × {slotTaken.ana}).
                </p>
              )}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirmOpen(false)}
                  className="rounded-2xl bg-white/10 py-3.5 font-bold ring-1 ring-white/15 disabled:opacity-50"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={save}
                  className="relative rounded-2xl bg-paper py-3.5 font-extrabold text-ink disabled:opacity-70"
                >
                  {pending ? "Gravando…" : overwrite ? "Sobrescrever" : "Salvar"}
                </button>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      {/* toast */}
      <AnimatePresence>
        {toast && (
          <m.div
            role={toast.kind === "error" ? "alert" : "status"}
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -30, opacity: 0 }}
            className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[80] mx-auto max-w-md"
          >
            <div
              className={`glass rounded-2xl !bg-ink-2/95 p-4 text-sm ring-1 ${
                toast.kind === "error" ? "ring-ana/50" : "ring-manoel/50"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className={toast.kind === "error" ? "text-ana" : "text-manoel"}>{toast.kind === "error" ? "!" : "✓"}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{toast.text}</p>
                  {toast.list && toast.list.length > 0 && (
                    <ul className="mt-2 max-h-32 space-y-0.5 overflow-auto text-xs text-fog">
                      {toast.list.map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <button type="button" aria-label="Fechar" onClick={() => setToast(null)} className="text-mist hover:text-paper">
                  ✕
                </button>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
