import { Reveal } from "@/components/ui/Reveal";
import { DieFace } from "@/components/ui/Die";
import { formatDateBR, monthLabel } from "@/lib/dates";
import { MATCHES_PER_MONTH } from "@/lib/kismet";
import type { Match } from "@/lib/match";
import { SectionHeading } from "./SectionHeading";
import { WinnerBadge } from "./WinnerBadge";
import Link from "next/link";

function ScoreLine({ name, total, max, color, win }: { name: string; total: number; max: number; color: string; win: boolean }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className={`text-sm font-semibold ${win ? "text-paper" : "text-fog"}`}>{name}</span>
        <span className={`font-display text-2xl font-bold tabular ${win ? "text-paper" : "text-fog"}`}>{total}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(4, (total / max) * 100)}%` }} />
      </div>
    </div>
  );
}

export function MonthNow({
  year,
  month,
  nextRound,
  matches,
}: {
  year: number;
  month: number;
  nextRound: number;
  matches: Match[];
}) {
  const baseRound = (month - 1) * MATCHES_PER_MONTH + 1;
  const slots = Array.from({ length: MATCHES_PER_MONTH }, (_, i) => matches.find((m) => m.number === i + 1));
  const wins = {
    manoel: matches.filter((m) => m.winner === "manoel").length,
    ana: matches.filter((m) => m.winner === "ana").length,
  };
  const max = Math.max(1, ...matches.flatMap((m) => [m.totals.manoel.total, m.totals.ana.total]));

  return (
    <section id="mes" className="relative mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28">
      <SectionHeading
        index="01"
        eyebrow={`Mês em disputa · próxima: rodada ${nextRound}`}
        title={monthLabel(year, month)}
        aside={
          <Reveal delay={0.1} className="glass flex items-center gap-5 rounded-2xl px-5 py-3">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-mist">Placar do mês</p>
              <p className="font-display text-2xl font-extrabold tabular">
                <span className="text-manoel">{wins.manoel}</span>
                <span className="mx-2 text-mist">×</span>
                <span className="text-ana">{wins.ana}</span>
              </p>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-mist">Jogadas</p>
              <p className="font-display text-2xl font-extrabold tabular">
                {matches.length}
                <span className="text-mist">/{MATCHES_PER_MONTH}</span>
              </p>
            </div>
          </Reveal>
        }
      />

      <ol className="grid gap-4 md:grid-cols-3">
        {slots.map((m, i) => (
          <Reveal as="li" key={i} delay={i * 0.08}>
            {m ? (
              <article className="glass group relative h-full overflow-hidden rounded-3xl p-5 transition-transform duration-500 hover:-translate-y-1">
                <div
                  aria-hidden
                  className={`absolute -right-20 -top-20 size-56 rounded-full opacity-40 ${
                    m.winner === "manoel" ? "glow-manoel" : m.winner === "ana" ? "glow-ana" : "glow-gold"
                  }`}
                />
                <header className="relative mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <DieFace value={i + 1} size={30} />
                    <div>
                      <p className="font-display text-lg font-bold leading-none">Rodada {baseRound + i}</p>
                      <p className="mt-1 text-xs text-mist">{m.date ? formatDateBR(m.date, { withYear: true }) : "data não informada"}</p>
                    </div>
                  </div>
                  <WinnerBadge winner={m.winner} />
                </header>
                <div className="relative space-y-4">
                  <ScoreLine name="Manoel" total={m.totals.manoel.total} max={max} color="bg-manoel" win={m.winner === "manoel"} />
                  <ScoreLine name="Ana" total={m.totals.ana.total} max={max} color="bg-ana" win={m.winner === "ana"} />
                </div>
              </article>
            ) : (
              <Link
                href="/registrar"
                className="group flex h-full min-h-48 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-white/15 p-5 text-center transition-colors hover:border-gold/50 hover:bg-white/[0.02]"
              >
                <div className="opacity-40 transition-opacity group-hover:opacity-100">
                  <DieFace value={i + 1} size={34} />
                </div>
                <p className="font-display text-lg font-bold text-fog">Rodada {baseRound + i}</p>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mist group-hover:text-gold">{baseRound + i === nextRound ? "próxima · jogar" : "a jogar"}</p>
              </Link>
            )}
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
