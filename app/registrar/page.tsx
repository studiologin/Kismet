import type { Metadata } from "next";
import Link from "next/link";
import { ImportPanel } from "@/components/registrar/ImportPanel";
import { MatchForm, type TakenSlot } from "@/components/registrar/MatchForm";
import { PinGate } from "@/components/registrar/PinGate";
import { DieFace } from "@/components/ui/Die";
import { isAuthenticated, isPinConfigured } from "@/lib/auth";
import { nowInSaoPaulo } from "@/lib/dates";
import { isSheetsConfigured, sheetsConfig } from "@/lib/google-sheets";
import { PLAYER_NAME } from "@/lib/kismet";
import { getMatches } from "@/lib/matches";
import { logoutAction } from "./actions";

export const metadata: Metadata = { title: "Registrar partida" };
export const dynamic = "force-dynamic";

export default async function RegistrarPage() {
  if (!(await isAuthenticated())) return <PinGate configured={isPinConfigured()} />;

  const { matches, source, error } = await getMatches();
  const now = nowInSaoPaulo();
  const taken: TakenSlot[] = matches.map((m) => ({
    year: m.year,
    month: m.month,
    number: m.number,
    date: m.date,
    manoel: m.totals.manoel.total,
    ana: m.totals.ana.total,
    winner: m.winner === "empate" ? "empate" : `${PLAYER_NAME[m.winner]} venceu`,
  }));
  const sheetsReady = isSheetsConfigured();

  return (
    <div className="relative min-h-svh">
      <div aria-hidden className="pointer-events-none fixed -left-40 top-0 -z-10 size-96 rounded-full glow-manoel opacity-30" />
      <div aria-hidden className="pointer-events-none fixed -right-40 top-1/3 -z-10 size-96 rounded-full glow-ana opacity-30" />

      <header className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link href="/" className="flex items-center gap-2.5 text-sm font-semibold text-fog hover:text-paper">
          <DieFace value={5} size={24} />
          <span>← Placar</span>
        </Link>
        <form action={logoutAction}>
          <button className="rounded-lg px-3 py-2 text-sm font-semibold text-mist hover:bg-white/5 hover:text-paper">Sair</button>
        </form>
      </header>

      <main className="mx-auto max-w-3xl px-3 sm:px-4">
        <div className="mb-6 px-1">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-gold">Registro</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">Lançar partida</h1>
        </div>

        {source === "error" && (
          <p role="alert" className="mb-6 rounded-2xl bg-ana/10 p-4 text-sm text-ana ring-1 ring-ana/30">
            Não foi possível ler a planilha: {error}
          </p>
        )}

        <MatchForm taken={source === "demo" ? [] : taken} today={now.iso} sheetsReady={sheetsReady} />

        {sheetsReady && (
          <div className="mb-40 mt-10">
            <ImportPanel defaultYear={now.year} legacyTab={sheetsConfig().legacyTab} />
          </div>
        )}
      </main>
    </div>
  );
}
