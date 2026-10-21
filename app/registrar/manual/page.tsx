import type { Metadata } from "next";
import { AppTopBar } from "@/components/app/AppTopBar";
import { ImportPanel } from "@/components/registrar/ImportPanel";
import { MatchForm, type TakenSlot } from "@/components/registrar/MatchForm";
import { PinGate } from "@/components/registrar/PinGate";
import { getSession, isPinConfigured } from "@/lib/auth";
import { nowInSaoPaulo } from "@/lib/dates";
import { isSheetsConfigured, sheetsConfig } from "@/lib/google-sheets";
import { PLAYER_NAME } from "@/lib/kismet";
import { getMatches } from "@/lib/matches";

export const metadata: Metadata = { title: "Lançamento manual" };
export const dynamic = "force-dynamic";

/** Lançamento das duas colunas de uma vez — para corrigir partidas ou registrar depois do jogo. */
export default async function ManualPage() {
  const session = await getSession();
  if (!session) return <PinGate configured={isPinConfigured()} />;

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
      <AppTopBar player={session.player} title="Lançamento manual" back="/registrar" />
      <main className="mx-auto max-w-3xl px-3 pt-2 sm:px-4">
        <p className="mb-5 px-1 text-sm text-fog">
          Preencha as duas colunas de uma vez — útil para corrigir uma partida ou lançar um jogo depois.
        </p>
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
