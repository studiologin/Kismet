import type { Metadata } from "next";
import { LiveMatch } from "@/components/registrar/LiveMatch";
import type { TakenSlot } from "@/components/registrar/MatchForm";
import { PinGate } from "@/components/registrar/PinGate";
import { AppTopBar } from "@/components/app/AppTopBar";
import { getSession, isPinConfigured } from "@/lib/auth";
import { nowInSaoPaulo } from "@/lib/dates";
import { isSheetsConfigured } from "@/lib/google-sheets";
import { PLAYER_NAME } from "@/lib/kismet";
import { getLiveState } from "@/lib/live";
import { getMatches } from "@/lib/matches";

export const metadata: Metadata = { title: "Partida" };
export const dynamic = "force-dynamic";

export default async function RegistrarPage() {
  const session = await getSession();
  if (!session) return <PinGate configured={isPinConfigured()} />;

  const [{ matches, source }, live] = await Promise.all([getMatches(), getLiveState(true).catch(() => null)]);
  const now = nowInSaoPaulo();
  const taken: TakenSlot[] =
    source === "demo"
      ? []
      : matches.map((m) => ({
          year: m.year,
          month: m.month,
          number: m.number,
          date: m.date,
          manoel: m.totals.manoel.total,
          ana: m.totals.ana.total,
          winner: m.winner === "empate" ? "empate" : `${PLAYER_NAME[m.winner]} venceu`,
        }));

  return (
    <div className="relative min-h-svh">
      <div aria-hidden className="pointer-events-none fixed -left-40 top-0 -z-10 size-96 rounded-full glow-manoel opacity-20" />
      <div aria-hidden className="pointer-events-none fixed -right-40 top-1/3 -z-10 size-96 rounded-full glow-ana opacity-20" />
      <AppTopBar player={session.player} title="Partida" />
      <main className="mx-auto max-w-2xl px-3 pt-2">
        <LiveMatch
          me={session.player}
          initialState={live}
          taken={taken}
          today={now.iso}
          sheetsReady={isSheetsConfigured()}
        />
      </main>
    </div>
  );
}
