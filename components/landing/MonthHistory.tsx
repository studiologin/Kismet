import { Reveal } from "@/components/ui/Reveal";
import { MONTHS } from "@/lib/dates";
import { MATCHES_PER_MONTH } from "@/lib/kismet";
import type { MonthSummary } from "@/lib/stats";
import { SectionHeading } from "./SectionHeading";

function MatchDot({ winner }: { winner?: "manoel" | "ana" | "empate" }) {
  const cls = !winner
    ? "border border-dashed border-white/20"
    : winner === "manoel"
      ? "bg-manoel shadow-[0_0_12px_rgba(46,242,166,.6)]"
      : winner === "ana"
        ? "bg-ana shadow-[0_0_12px_rgba(255,79,121,.6)]"
        : "bg-gold";
  return <span className={`size-3 rounded-full ${cls}`} />;
}

export function MonthHistory({ months }: { months: MonthSummary[] }) {
  const list = [...months].reverse();
  return (
    <section id="historico" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28">
      <SectionHeading index="04" eyebrow="Histórico" title="Mês a mês" />
      {list.length === 0 ? (
        <p className="glass rounded-3xl p-8 text-center text-fog">Nenhum mês registrado ainda.</p>
      ) : (
        <ol className="relative space-y-3 before:absolute before:bottom-4 before:left-[1.35rem] before:top-4 before:w-px before:bg-gradient-to-b before:from-white/20 before:to-transparent sm:before:left-[1.6rem]">
          {list.map((mo, i) => {
            const slots = Array.from({ length: MATCHES_PER_MONTH }, (_, k) => mo.matches.find((m) => m.number === k + 1));
            const winColor = mo.winner === "manoel" ? "text-manoel" : mo.winner === "ana" ? "text-ana" : "text-gold";
            return (
              <Reveal as="li" key={mo.key} delay={Math.min(i * 0.05, 0.3)}>
                <div className="glass relative grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl p-3 pr-4 transition-colors hover:bg-white/[0.06] sm:gap-6 sm:p-4 sm:pr-6">
                  <div className="relative z-10 grid size-11 place-items-center rounded-xl bg-ink-3 ring-1 ring-white/10 sm:size-12">
                    <span className="font-display text-sm font-extrabold">{String(mo.month).padStart(2, "0")}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-display text-lg font-bold leading-tight sm:text-xl">
                      {MONTHS[mo.month - 1]} <span className="text-mist">{mo.year}</span>
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fog">
                      <span className="flex items-center gap-1.5">
                        {slots.map((s, k) => (
                          <MatchDot key={k} winner={s?.winner} />
                        ))}
                      </span>
                      <span className="tabular">
                        pts <span className="text-manoel">{mo.points.manoel}</span> · <span className="text-ana">{mo.points.ana}</span>
                      </span>
                      <span className="hidden tabular sm:inline">
                        acumulado <span className="font-bold text-paper">{mo.cumulative.manoel} × {mo.cumulative.ana}</span>
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-display text-2xl font-extrabold tabular sm:text-3xl ${winColor}`}>
                      {mo.wins.manoel}
                      <span className="mx-1 text-mist">×</span>
                      {mo.wins.ana}
                    </p>
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-mist sm:hidden">
                      acum. {mo.cumulative.manoel}×{mo.cumulative.ana}
                    </p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </ol>
      )}
    </section>
  );
}
