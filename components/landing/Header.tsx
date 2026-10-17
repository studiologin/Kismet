import Link from "next/link";
import { DieFace } from "@/components/ui/Die";

const NAV = [
  { href: "#mes", label: "Mês" },
  { href: "#estatisticas", label: "Números" },
  { href: "#evolucao", label: "Evolução" },
  { href: "#historico", label: "Histórico" },
];

export function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
      <nav className="glass mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-2xl py-2 pl-3 pr-2">
        <Link href="/" className="flex items-center gap-2.5">
          <DieFace value={5} size={26} />
          <span className="font-display text-lg font-extrabold tracking-tight">
            KISMET<span className="text-fog font-medium">score</span>
          </span>
        </Link>
        <ul className="hidden items-center gap-1 text-sm text-fog md:flex">
          {NAV.map((n) => (
            <li key={n.href}>
              <a href={n.href} className="rounded-lg px-3 py-2 transition-colors hover:bg-white/5 hover:text-paper">
                {n.label}
              </a>
            </li>
          ))}
        </ul>
        <Link
          href="/registrar"
          className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-paper px-3.5 py-2 text-sm font-bold text-ink transition-transform active:scale-95"
        >
          <span className="relative z-10">Registrar</span>
          <span aria-hidden className="relative z-10 text-base leading-none transition-transform group-hover:rotate-90">+</span>
          <span aria-hidden className="absolute inset-0 -translate-x-full bg-gold transition-transform duration-500 ease-[var(--ease-spring)] group-hover:translate-x-0" />
        </Link>
      </nav>
    </header>
  );
}
