import { CtaFooter } from "@/components/landing/CtaFooter";
import { EvolutionChart, type MonthPoint } from "@/components/landing/EvolutionChart";
import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { Marquee } from "@/components/landing/Marquee";
import { MonthHistory } from "@/components/landing/MonthHistory";
import { MonthNow } from "@/components/landing/MonthNow";
import { RecentMatches } from "@/components/landing/RecentMatches";
import { SectionHeading } from "@/components/landing/SectionHeading";
import { SourceBanner } from "@/components/landing/SourceBanner";
import { StatsSection } from "@/components/landing/StatsSection";
import { LiveBanner } from "@/components/app/LiveBanner";
import { Reveal } from "@/components/ui/Reveal";
import { MONTHS, MONTHS_SHORT, nowInSaoPaulo } from "@/lib/dates";
import { getMatches } from "@/lib/matches";
import { computeStats } from "@/lib/stats";

// ISR: a página é regenerada a cada 5 min e imediatamente após cada registro.
export const revalidate = 300;

export default async function HomePage() {
  const { matches, source, error } = await getMatches();
  const stats = computeStats(matches);
  const now = nowInSaoPaulo();
  const monthMatches = matches.filter((m) => m.year === now.year && m.month === now.month);

  const years = [...new Set(matches.map((m) => m.year))];
  const seasonLabel = years.length
    ? years.length === 1
      ? `Temporada ${years[0]}`
      : `${years[0]}–${years[years.length - 1]}`
    : `Temporada ${now.year}`;

  const chartData: MonthPoint[] = stats.months.map((mo) => ({
    label: years.length > 1 ? `${MONTHS_SHORT[mo.month - 1]}/${String(mo.year).slice(2)}` : MONTHS_SHORT[mo.month - 1],
    full: `${MONTHS[mo.month - 1]} ${mo.year}`,
    avg: mo.avg,
    wins: mo.wins,
    cumulative: mo.cumulative,
  }));

  return (
    <>
      <Header />
      <SourceBanner source={source} error={error} />
      <LiveBanner />
      <main>
        <Hero
          wins={{ manoel: stats.players.manoel.wins, ana: stats.players.ana.wins }}
          avg={{ manoel: stats.players.manoel.avg, ana: stats.players.ana.avg }}
          kismets={{ manoel: stats.players.manoel.kismets, ana: stats.players.ana.kismets }}
          leader={stats.leader}
          lead={stats.lead}
          played={stats.played}
          ties={stats.ties}
          streak={stats.currentStreak}
          seasonLabel={seasonLabel}
        />
        <Marquee words={["Ases", "Trinca", "Full House", "Flush", "Quadra", "Yarborough", "Kismet"]} />
        <MonthNow year={now.year} month={now.month} matches={monthMatches} />
        <StatsSection stats={stats} />
        <section id="evolucao" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28">
          <SectionHeading index="03" eyebrow="Evolução mensal" title="A curva da disputa" />
          <Reveal>
            <EvolutionChart data={chartData} />
          </Reveal>
        </section>
        <Marquee reverse words={["Manoel", "×", "Ana", "3 partidas por mês", "Cinco dados"]} />
        <MonthHistory months={stats.months} />
        <RecentMatches matches={matches} />
      </main>
      <CtaFooter updatedLabel={`Atualizado em ${now.stamp}`} />
    </>
  );
}
