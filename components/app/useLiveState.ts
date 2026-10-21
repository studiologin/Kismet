"use client";

import { useEffect, useState } from "react";
import type { LiveState } from "@/lib/live";

/** Consulta a partida em andamento em intervalos (pausa com a aba em segundo plano). */
export function useLiveState(intervalMs: number) {
  const [state, setState] = useState<LiveState | null>(null);
  useEffect(() => {
    let stop = false;
    const poll = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/ao-vivo", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { state: LiveState | null };
        if (!stop) setState(data.state);
      } catch {}
    };
    poll();
    const id = setInterval(poll, intervalMs);
    const onVis = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [intervalMs]);
  return state;
}
