"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "kismet-install-dismissed";

/** Registra o service worker e oferece "Instalar app" (Android/Chrome) ou explica o passo no iPhone. */
export function PwaSetup() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {}
    if (standalone || dismissed) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
    let t: ReturnType<typeof setTimeout> | undefined;
    if (isIos) {
      setIos(true);
      t = setTimeout(() => setShow(true), 4000);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      if (t) clearTimeout(t);
    };
  }, []);

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => null);
    setDeferred(null);
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (deferred || ios) && (
        <m.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
          className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-sm md:bottom-6"
          role="dialog"
          aria-label="Instalar o app"
        >
          <div className="glass flex items-center gap-3 rounded-2xl !bg-ink-2/95 p-3 pl-3.5">
            <img src="/icons/icon-192.png" alt="" className="size-11 rounded-xl" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-bold">Instalar o Kismet</p>
              <p className="text-xs leading-snug text-fog">
                {ios ? (
                  <>
                    Toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.
                  </>
                ) : (
                  "Abre em tela cheia, direto da tela inicial."
                )}
              </p>
            </div>
            {!ios && (
              <button onClick={install} className="min-h-10 rounded-xl bg-paper px-3.5 text-sm font-extrabold text-ink">
                Instalar
              </button>
            )}
            <button onClick={dismiss} aria-label="Dispensar" className="grid size-8 place-items-center text-mist">
              ✕
            </button>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
