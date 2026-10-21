"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importLegacyAction, type ImportResult } from "@/app/registrar/actions";

export function ImportPanel({ defaultYear, legacyTab }: { defaultYear: number; legacyTab: string }) {
  const [year, setYear] = useState(defaultYear);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <details className="glass group rounded-3xl p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-display text-lg font-bold">
        Importar histórico da planilha antiga
        <span aria-hidden className="text-mist transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="mt-4 space-y-4 text-sm text-fog">
        <p>
          Lê a aba <strong className="text-paper">“{legacyTab}”</strong> (partidas em colunas, 3 por mês) e grava cada
          partida como uma linha na aba de resultados. Partidas já existentes no mesmo mês/número são ignoradas — pode rodar
          mais de uma vez sem duplicar.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-mist">Ano do histórico</span>
            <input
              type="number"
              inputMode="numeric"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-28 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-bold text-paper outline-none focus:border-gold/60"
            />
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await importLegacyAction(year);
                setResult(r);
                if (r.ok) router.refresh();
              })
            }
            className="rounded-xl bg-white/10 px-4 py-2.5 font-bold text-paper ring-1 ring-white/15 transition hover:bg-white/15 disabled:opacity-50"
          >
            {pending ? "Importando…" : "Importar"}
          </button>
        </div>
        {result && (
          <p role="status" className={result.ok ? "font-semibold text-manoel" : "font-semibold text-ana"}>
            {result.ok
              ? `${result.imported} partida(s) importada(s), ${result.skipped} já existiam.`
              : result.error}
          </p>
        )}
      </div>
    </details>
  );
}
