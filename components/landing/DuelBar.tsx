import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

interface Props {
  label: string;
  manoel: number;
  ana: number;
  decimals?: number;
  note?: string;
}

/** Barra de comparação dividida: Manoel (esq.) × Ana (dir.) — barras animadas via CSS */
export function DuelBar({ label, manoel, ana, decimals = 0, note }: Props) {
  const total = manoel + ana;
  const pm = total ? (manoel / total) * 100 : 50;
  const lead = manoel === ana ? null : manoel > ana ? "manoel" : "ana";
  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-3">
        <AnimatedNumber
          value={manoel}
          decimals={decimals}
          className={`font-display text-3xl font-extrabold tabular sm:text-4xl ${lead === "manoel" ? "text-manoel" : "text-paper/70"}`}
        />
        <div className="pb-1 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-fog">{label}</p>
          {note && <p className="mt-0.5 text-[0.7rem] text-mist">{note}</p>}
        </div>
        <AnimatedNumber
          value={ana}
          decimals={decimals}
          className={`font-display text-3xl font-extrabold tabular sm:text-4xl ${lead === "ana" ? "text-ana" : "text-paper/70"}`}
        />
      </div>
      <div className="flex h-2.5 gap-1 overflow-hidden rounded-full" role="img" aria-label={`${label}: Manoel ${manoel.toFixed(decimals)}, Ana ${ana.toFixed(decimals)}`}>
        <div className="grow-x h-full origin-right rounded-full bg-gradient-to-l from-manoel to-manoel-deep" style={{ width: `${pm}%` }} />
        <div className="grow-x h-full flex-1 origin-left rounded-full bg-gradient-to-r from-ana to-ana-deep" />
      </div>
    </div>
  );
}
