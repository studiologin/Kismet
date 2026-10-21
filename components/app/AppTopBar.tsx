import Link from "next/link";
import { logoutAction } from "@/app/registrar/actions";
import { DieFace } from "@/components/ui/Die";
import type { PlayerId } from "@/lib/kismet";

/** Barra superior compacta das telas internas (estilo app). */
export function AppTopBar({ player, title, back }: { player: PlayerId; title: string; back?: string }) {
  const color = player === "manoel" ? "text-manoel bg-manoel/10 ring-manoel/30" : "text-ana bg-ana/10 ring-ana/30";
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-ink/80 px-3 pb-2.5 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {back ? (
            <Link href={back} aria-label="Voltar" className="grid size-9 place-items-center rounded-xl bg-white/[0.06] text-lg">
              ←
            </Link>
          ) : (
            <Link href="/" aria-label="Placar">
              <DieFace value={5} size={28} />
            </Link>
          )}
          <h1 className="truncate font-display text-xl font-extrabold tracking-tight">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${color}`}>
            {player === "manoel" ? "Manoel" : "Ana"}
          </span>
          <form action={logoutAction}>
            <button className="rounded-lg px-2 py-1.5 text-xs font-semibold text-mist hover:text-paper">Sair</button>
          </form>
        </div>
      </div>
    </header>
  );
}
