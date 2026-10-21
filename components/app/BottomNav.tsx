"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLiveState } from "./useLiveState";

const ITEMS = [
  { href: "/", label: "Placar", icon: "M4 19V9m6 10V5m6 14v-7m4 7H2" },
  { href: "/registrar", label: "Partida", icon: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm3.5 5.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01" },
  { href: "/#historico", label: "Histórico", icon: "M12 8v4l3 2m6-2a9 9 0 1 1-3-6.7M21 4v4h-4" },
];

/** Navegação inferior estilo app (celular). */
export function BottomNav() {
  const path = usePathname();
  const live = useLiveState(15000);
  const active = (href: string) => (href === "/" ? path === "/" : href.startsWith("/registrar") ? path.startsWith("/registrar") : false);

  return (
    <>
      <div aria-hidden className="h-[calc(4.25rem+env(safe-area-inset-bottom))] md:hidden" />
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.08] bg-ink/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <ul className="mx-auto grid h-[4.25rem] max-w-md grid-cols-3">
          {ITEMS.map((it) => {
            const on = active(it.href);
            const showLive = it.href === "/registrar" && live;
            return (
              <li key={it.href}>
                <Link
                  href={it.href}
                  aria-current={on ? "page" : undefined}
                  className={`relative flex h-full flex-col items-center justify-center gap-1 text-[0.7rem] font-bold transition-colors ${
                    on ? "text-paper" : "text-mist"
                  }`}
                >
                  {on && <span className="absolute top-0 h-0.5 w-10 rounded-full bg-gold" />}
                  <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d={it.icon} />
                  </svg>
                  {it.label}
                  {showLive && (
                    <span className="absolute right-[calc(50%-1.4rem)] top-2.5 flex size-2.5">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-ana opacity-75" />
                      <span className="relative inline-flex size-2.5 rounded-full bg-ana" />
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
