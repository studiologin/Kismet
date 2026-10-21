"use client";

import Link from "next/link";
import { MONTHS } from "@/lib/dates";
import { computeTotals, type CategoryId } from "@/lib/kismet";
import { useLiveState } from "./useLiveState";

/** Faixa "ao vivo" na página inicial enquanto há uma partida em andamento. */
export function LiveBanner() {
  const live = useLiveState(8000);
  if (!live) return null;
  const t = (p: "manoel" | "ana") =>
    computeTotals((live.entries[p]?.scores ?? {}) as Record<CategoryId, number>).total;
  return (
    <div className="fixed inset-x-0 top-[calc(4.75rem+env(safe-area-inset-top))] z-40 px-3 sm:px-6">
      <Link
        href="/registrar"
        className="glass mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl !bg-ink/85 px-4 py-2.5 ring-1 ring-ana/40"
      >
        <span className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.2em] text-ana">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-ana opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-ana" />
          </span>
          Ao vivo
        </span>
        <span className="text-xs text-fog">
          {live.number}ª · {MONTHS[live.month - 1]}
        </span>
        <span className="font-display text-lg font-extrabold tabular">
          <span className="text-manoel">{t("manoel")}</span>
          <span className="mx-1 text-mist">×</span>
          <span className="text-ana">{t("ana")}</span>
        </span>
      </Link>
    </div>
  );
}
