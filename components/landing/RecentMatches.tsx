import { Reveal } from "@/components/ui/Reveal";
import { formatDateBR, MONTHS_SHORT } from "@/lib/dates";
import { roundOf, type Match } from "@/lib/match";
import { SectionHeading } from "./SectionHeading";
import { WinnerBadge } from "./WinnerBadge";

export function RecentMatches({ matches }: { matches: Match[] }) {
  const recent = [...matches].reverse().slice(0, 6);
  return (
    <section id="partidas" className="relative scroll-mt-24 py-20 sm:py-28">
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-ink-2 to-transparent" />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading index="05" eyebrow="Últimas partidas" title="Na mesa" />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recent.map((m, i) => {
            const margin = Math.abs(m.totals.manoel.total - m.totals.ana.total);
            const kismet = (["manoel", "ana"] as const).filter((p) => m.scores[p].kismet > 0);
            return (
              <Reveal as="li" key={m.id} delay={(i % 3) * 0.08}>
                <article
                  className={`glass group relative h-full overflow-hidden rounded-3xl p-5 transition-all duration-500 hover:-translate-y-1.5 hover:rotate-[-0.6deg] ${
                    i === 0 ? "ring-1 ring-gold/30" : ""
                  }`}
                >
                  <div
                    aria-hidden
                    className={`absolute inset-x-0 top-0 h-px ${
                      m.winner === "manoel" ? "bg-gradient-to-r from-manoel to-transparent" : m.winner === "ana" ? "bg-gradient-to-l from-ana to-transparent" : "bg-gold"
                    }`}
                  />
                  <header className="mb-5 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-mist">
                        {i === 0 ? <span className="text-gold">mais recente</span> : `${m.number}ª de ${MONTHS_SHORT[m.month - 1]}`}
                      </p>
                      <p className="mt-1 font-display text-lg font-bold">
                        Rodada {roundOf(m)} · {MONTHS_SHORT[m.month - 1]}/{String(m.year).slice(2)}
                      </p>
                      {m.date && <p className="text-xs text-fog">{formatDateBR(m.date, { withYear: true })}</p>}
                    </div>
                    <WinnerBadge winner={m.winner} />
                  </header>
                  <div className="grid grid-cols-2 gap-3">
                    {(["manoel", "ana"] as const).map((p) => {
                      const win = m.winner === p;
                      return (
                        <div
                          key={p}
                          className={`rounded-2xl p-3 ${win ? (p === "manoel" ? "bg-manoel/10 ring-1 ring-manoel/25" : "bg-ana/10 ring-1 ring-ana/25") : "bg-white/[0.03]"}`}
                        >
                          <p className={`text-xs font-bold ${p === "manoel" ? "text-manoel" : "text-ana"}`}>
                            {p === "manoel" ? "Manoel" : "Ana"}
                          </p>
                          <p className={`font-display text-4xl font-extrabold tabular ${win ? "text-paper" : "text-paper/50"}`}>
                            {m.totals[p].total}
                          </p>
                          <p className="text-[0.7rem] text-mist tabular">
                            sup {m.totals[p].upperTotal} · inf {m.totals[p].lowerTotal}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <footer className="mt-4 flex flex-wrap items-center gap-2 text-xs text-fog">
                    {m.winner !== "empate" && <span className="tabular">diferença de {margin} pts</span>}
                    {kismet.map((p) => (
                      <span key={p} className="rounded-full bg-gold/15 px-2 py-0.5 font-bold text-gold">
                        KISMET · {p === "manoel" ? "Manoel" : "Ana"}
                      </span>
                    ))}
                  </footer>
                </article>
              </Reveal>
            );
          })}
        </ul>
        {recent.length === 0 && <p className="glass rounded-3xl p-8 text-center text-fog">Nenhuma partida ainda.</p>}
      </div>
    </section>
  );
}
