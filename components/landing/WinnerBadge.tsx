import type { Winner } from "@/lib/kismet";

export function WinnerBadge({ winner, size = "sm" }: { winner: Winner; size?: "sm" | "md" }) {
  const map = {
    manoel: { label: "Manoel venceu", cls: "bg-manoel/15 text-manoel ring-manoel/30" },
    ana: { label: "Ana venceu", cls: "bg-ana/15 text-ana ring-ana/30" },
    empate: { label: "Empate", cls: "bg-gold/15 text-gold ring-gold/30" },
  }[winner];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold ring-1 ${map.cls} ${
        size === "md" ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs"
      }`}
    >
      {map.label}
    </span>
  );
}
