"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type LoginState } from "@/app/registrar/actions";
import { Die } from "@/components/ui/Die";

export function PinGate({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden px-4 py-16">
      <div aria-hidden className="absolute -left-40 top-10 size-96 rounded-full glow-manoel opacity-45" />
      <div aria-hidden className="absolute -right-40 bottom-10 size-96 rounded-full glow-ana opacity-45" />
      <div className="glass relative w-full max-w-sm rounded-[2rem] p-7 text-center">
        <div className="mx-auto mb-6 grid h-24 place-items-center">
          <Die size={64} duration={14} />
        </div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Área de registro</h1>
        <p className="mt-2 text-sm text-fog">Digite o PIN para lançar uma partida.</p>
        {!configured ? (
          <p className="mt-6 rounded-2xl bg-ana/10 p-4 text-sm text-ana ring-1 ring-ana/30">
            ADMIN_PIN não está configurado. Defina a variável de ambiente e faça um novo deploy.
          </p>
        ) : (
          <form action={action} className="mt-6 space-y-3">
            <label htmlFor="pin" className="sr-only">PIN</label>
            <input
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              maxLength={12}
              placeholder="••••"
              aria-invalid={Boolean(state.error)}
              aria-describedby={state.error ? "pin-error" : undefined}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-center font-display text-3xl font-bold tracking-[0.5em] outline-none transition focus:border-gold/60 focus:bg-white/[0.07] aria-invalid:border-ana/60"
            />
            {state.error && (
              <p id="pin-error" role="alert" className="text-sm font-semibold text-ana">
                {state.error}
              </p>
            )}
            <button
              disabled={pending}
              className="w-full rounded-2xl bg-paper py-4 font-bold text-ink transition active:scale-[.98] disabled:opacity-60"
            >
              {pending ? "Verificando…" : "Entrar"}
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
