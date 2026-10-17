import { Reveal } from "@/components/ui/Reveal";
import type { ReactNode } from "react";

export function SectionHeading({
  index,
  eyebrow,
  title,
  aside,
}: {
  index: string;
  eyebrow: string;
  title: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <Reveal className="mb-8 flex flex-col gap-4 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-3 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em] text-mist">
          <span className="text-gold">{index}</span>
          <span className="h-px w-8 bg-white/20" />
          {eyebrow}
        </p>
        <h2 className="font-display text-4xl font-extrabold leading-[0.95] tracking-[-0.03em] sm:text-6xl">{title}</h2>
      </div>
      {aside}
    </Reveal>
  );
}
