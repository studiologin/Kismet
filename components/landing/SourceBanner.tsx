import type { DataSource } from "@/lib/matches";

export function SourceBanner({ source, error }: { source: DataSource; error?: string }) {
  if (source === "sheets") return null;
  const demo = source === "demo";
  return (
    <div className="relative z-40 mx-auto mt-24 max-w-6xl px-4 sm:px-6">
      <div
        role="status"
        className={`glass flex items-start gap-3 rounded-2xl px-4 py-3 text-sm ${demo ? "text-gold" : "text-ana"}`}
      >
        <span aria-hidden className="mt-0.5 text-base">{demo ? "◆" : "!"}</span>
        <p className="text-paper/85">
          {demo ? (
            <>
              <strong className="text-gold">Modo demonstração.</strong> Exibindo o histórico da planilha local (jan–ago 2026).
              Configure as variáveis do Google Sheets para ler e gravar ao vivo.
            </>
          ) : (
            <>
              <strong className="text-ana">Não foi possível ler a planilha.</strong> {error}
            </>
          )}
        </p>
      </div>
    </div>
  );
}
