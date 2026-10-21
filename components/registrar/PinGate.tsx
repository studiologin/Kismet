"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { loginAction, type LoginState } from "@/app/registrar/actions";
import { Die } from "@/components/ui/Die";
import type { PlayerId } from "@/lib/kismet";

const PROFILES: { id: PlayerId; name: string; color: string; ring: string; glow: string }[] = [
  { id: "manoel", name: "Manoel", color: "text-manoel", ring: "ring-manoel/60", glow: "glow-manoel" },
  { id: "ana", name: "Ana", color: "text-ana", ring: "ring-ana/60", glow: "glow-ana" },
];

export function PinGate({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [player, setPlayer] = useState<PlayerId | null>(null);
  const profile = PROFILES.find((p) => p.id === player);

  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden px-4 pb-28 pt-12">
      <div aria-hidden className="absolute -left-40 top-10 size-96 rounded-full glow-manoel opacity-30" />
      <div aria-hidden className="absolute -right-40 bottom-10 size-96 rounded-full glow-ana opacity-30" />
      <div className="glass relative w-full max-w-sm rounded-[2rem] p-6 text-center sm:p-7">
        <div className="mx-auto mb-5 grid h-20 place-items-center">
          <Die size={56} duration={14} />
        </div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Quem vai jogar?</h1>
        <p className="mt-2 text-sm text-fog">Escolha o seu perfil e digite o seu PIN.</p>

        {!configured ? (
          <p className="mt-6 rounded-2xl bg-ana/10 p-4 text-sm text-ana ring-1 ring-ana/30">
            PINs não configurados. Defina MANOEL_PIN e ANA_PIN nas variáveis de ambiente e faça um novo deploy.
          </p>
        ) : (
          <form action={action} className="mt-6 space-y-4">
            <div role="radiogroup" aria-label="Perfil" className="grid grid-cols-2 gap-3">
              {PROFILES.map((p) => {
                const active = player === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setPlayer(p.id)}
                    className={`relative overflow-hidden rounded-2xl p-4 ring-1 transition active:scale-95 ${
                      active ? `bg-white/10 ${p.ring} ring-2` : "bg-white/[0.03] ring-white/10"
                    }`}
                  >
                    <span aria-hidden className={`absolute -right-6 -top-6 size-20 rounded-full ${p.glow} opacity-40`} />
                    <span className={`relative block font-display text-2xl font-extrabold ${p.color}`}>{p.name}</span>
                    <span className="relative mt-1 block text-xs text-mist">{active ? "selecionado" : "tocar para escolher"}</span>
                  </button>
                );
              })}
            </div>
            <input type="hidden" name="player" value={player ?? ""} />

            <label htmlFor="pin" className="sr-only">PIN</label>
            <input
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              required
              maxLength={12}
              disabled={!player}
              placeholder={player ? `PIN de ${profile?.name}` : "escolha o perfil"}
              aria-invalid={Boolean(state.error)}
              aria-describedby={state.error ? "pin-error" : undefined}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-center font-display text-2xl font-bold tracking-[0.3em] outline-none transition placeholder:text-base placeholder:tracking-normal placeholder:text-mist focus:border-gold/60 focus:bg-white/[0.07] disabled:opacity-50 aria-invalid:border-ana/60"
            />
            {state.error && (
              <p id="pin-error" role="alert" className="text-sm font-semibold text-ana">
                {state.error}
              </p>
            )}
            <button
              disabled={pending || !player}
              className="w-full rounded-2xl bg-paper py-4 font-bold text-ink transition active:scale-[.98] disabled:opacity-50"
            >
              {pending ? "Verificando…" : profile ? `Entrar como ${profile.name}` : "Entrar"}
            </button>
          </form>
        )}
        <Link href="/" className="mt-6 inline-block text-sm text-mist hover:text-paper">
          ← Voltar ao placar
        </Link>
      </div>
    </main>
  );
}
