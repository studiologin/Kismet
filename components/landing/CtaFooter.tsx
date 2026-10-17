import Link from "next/link";
import { Die } from "@/components/ui/Die";
import { Parallax } from "@/components/ui/Parallax";
import { Reveal } from "@/components/ui/Reveal";

export function CtaFooter({ updatedLabel }: { updatedLabel: string }) {
  return (
    <footer className="relative overflow-hidden px-4 pb-10 pt-16 sm:px-6">
      <div className="relative mx-auto max-w-6xl">
        <Reveal className="glass relative overflow-hidden rounded-[2.5rem] px-6 py-14 text-center sm:px-12 sm:py-20">
          <div aria-hidden className="absolute -left-24 -top-24 size-72 rounded-full glow-manoel opacity-60" />
          <div aria-hidden className="absolute -bottom-24 -right-24 size-72 rounded-full glow-ana opacity-60" />
          <Parallax offset={50} className="pointer-events-none absolute left-[6%] top-8 hidden sm:block">
            <Die size={54} rx={30} ry={-20} duration={20} />
          </Parallax>
          <Parallax offset={-60} className="pointer-events-none absolute bottom-8 right-[7%]">
            <Die size={44} rx={-10} ry={50} duration={16} delay={-5} />
          </Parallax>
          <p className="relative text-xs font-bold uppercase tracking-[0.3em] text-gold">Jogaram agora?</p>
          <h2 className="relative mx-auto mt-4 max-w-2xl font-display text-4xl font-extrabold leading-[0.95] tracking-[-0.03em] sm:text-6xl">
            Lance a cartela antes que alguém esqueça os pontos.
          </h2>
          <Link
            href="/registrar"
            className="relative mt-8 inline-flex items-center gap-3 rounded-2xl bg-paper px-6 py-4 font-bold text-ink shadow-[0_20px_60px_-15px_rgba(255,204,77,.5)] transition-transform hover:-translate-y-0.5 active:scale-95"
          >
            Registrar partida
            <span aria-hidden>→</span>
          </Link>
        </Reveal>
        <div className="mt-10 flex flex-col items-center justify-between gap-2 text-xs text-mist sm:flex-row">
          <p>Kismet Score · Manoel × Ana · 3 partidas por mês</p>
          <p>{updatedLabel}</p>
        </div>
      </div>
    </footer>
  );
}
