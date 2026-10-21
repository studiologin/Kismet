"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const CHECK_MS = 60_000;
const BUILD = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";

type Kind = "app" | "data";

/**
 * Avisa quando há atualização e só aplica depois que o usuário confirma:
 *  - "app": um deploy novo foi publicado → recarrega com o visual/código novo
 *  - "data": novos resultados na planilha → atualiza os dados da página
 * Verifica a cada minuto, ao voltar para o app e quando a conexão retorna.
 */
export function UpdateWatcher({ dataStamp }: { dataStamp: string | null }) {
  const router = useRouter();
  const path = usePathname();
  const [kind, setKind] = useState<Kind | null>(null);
  const [busy, setBusy] = useState(false);
  const reg = useRef<ServiceWorkerRegistration | null>(null);
  const dismissed = useRef<{ build?: string; data?: string }>({});
  const stampRef = useRef(dataStamp);

  // nova página/dados renderizados → o aviso de dados deixa de valer
  useEffect(() => {
    stampRef.current = dataStamp;
    setKind((k) => (k === "data" ? null : k));
  }, [dataStamp]);

  /* service worker: registra e detecta versão nova "em espera" */
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker
      .register("/sw.js")
      .then((r) => {
        reg.current = r;
        if (r.waiting && navigator.serviceWorker.controller) setKind("app");
        r.addEventListener("updatefound", () => {
          const w = r.installing;
          w?.addEventListener("statechange", () => {
            if (w.state === "installed" && navigator.serviceWorker.controller) setKind("app");
          });
        });
      })
      .catch(() => {});
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  /* consulta versão do app e carimbo dos dados */
  const check = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const res = await fetch("/api/status", { cache: "no-store" });
      if (!res.ok) return;
      const s = (await res.json()) as { build: string; data: string | null };
      if (s.build && s.build !== BUILD && dismissed.current.build !== s.build) {
        reg.current?.update().catch(() => {});
        setKind("app");
        return;
      }
      // durante a partida ao vivo a tela já se sincroniza sozinha — não interrompe o jogo
      const onLiveGame = window.location.pathname === "/registrar";
      if (
        !onLiveGame &&
        s.data &&
        stampRef.current &&
        s.data !== stampRef.current &&
        dismissed.current.data !== s.data
      ) {
        setKind((k) => k ?? "data");
      }
    } catch {
      /* offline: tenta de novo depois */
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(check, 8000);
    const id = setInterval(check, CHECK_MS);
    const onVis = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", check);
    return () => {
      clearTimeout(first);
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", check);
    };
  }, [check]);

  // ao trocar de tela, reavalia (ex.: saiu da partida ao vivo com dados novos pendentes)
  useEffect(() => {
    const t = setTimeout(check, 1200);
    return () => clearTimeout(t);
  }, [path, check]);

  const apply = async () => {
    setBusy(true);
    if (kind === "data") {
      router.refresh();
      setTimeout(() => {
        setBusy(false);
        setKind(null);
      }, 1500);
      return;
    }
    // versão nova do app: ativa o service worker em espera (recarrega no controllerchange)
    const w = reg.current?.waiting;
    if (w) {
      w.postMessage("SKIP_WAITING");
      setTimeout(() => window.location.reload(), 3000); // garantia
    } else {
      window.location.reload();
    }
  };

  const later = async () => {
    try {
      const res = await fetch("/api/status", { cache: "no-store" });
      const s = (await res.json()) as { build: string; data: string | null };
      if (kind === "app") dismissed.current.build = s.build;
      else if (s.data) dismissed.current.data = s.data;
    } catch {}
    setKind(null);
  };

  const copy =
    kind === "app"
      ? { title: "Nova versão do app", text: "Melhorias no visual e nas funções. Atualize para usar a versão mais recente." }
      : { title: "Novos resultados", text: "Há partidas novas ou alteradas na planilha. Atualize para ver o placar em dia." };

  return (
    <AnimatePresence>
      {kind && (
        <m.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="fixed inset-x-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+0.25rem)] z-[90] mx-auto max-w-md"
          role="alertdialog"
          aria-labelledby="update-title"
          aria-describedby="update-text"
        >
          <div className="glass flex items-start gap-3 rounded-2xl !bg-ink-2/95 p-4 ring-1 ring-gold/40">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold ring-1 ring-gold/30" aria-hidden>
              {kind === "app" ? (
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" />
                </svg>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p id="update-title" className="font-display text-base font-extrabold">
                {copy.title}
              </p>
              <p id="update-text" className="mt-0.5 text-xs leading-snug text-fog">
                {copy.text}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={apply}
                  disabled={busy}
                  className="min-h-10 rounded-xl bg-gold px-4 text-sm font-extrabold text-ink transition active:scale-95 disabled:opacity-60"
                >
                  {busy ? "Atualizando…" : "Atualizar"}
                </button>
                <button type="button" onClick={later} disabled={busy} className="min-h-10 rounded-xl px-3 text-sm font-semibold text-mist">
                  Depois
                </button>
              </div>
            </div>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
