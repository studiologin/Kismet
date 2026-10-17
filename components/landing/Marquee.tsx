"use client";

import { useReducedMotion, useScroll, useTransform } from "motion/react";
import * as m from "motion/react-m";
import { useRef } from "react";

/** Faixa tipográfica com parallax horizontal entre seções */
export function Marquee({ words, reverse = false }: { words: string[]; reverse?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const x = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : reverse ? ["-25%", "0%"] : ["0%", "-25%"]);
  const line = [...words, ...words, ...words, ...words];
  return (
    <div ref={ref} aria-hidden className="relative -rotate-2 overflow-hidden border-y border-white/[0.07] bg-white/[0.02] py-4 backdrop-blur-sm">
      <m.div style={{ x }} className="flex w-max gap-8 whitespace-nowrap font-display text-4xl font-extrabold uppercase tracking-tight sm:text-6xl">
        {line.map((w, i) => (
          <span key={i} className={i % 2 ? "text-outline" : "text-paper/90"}>
            {w}
            <span aria-hidden className="ml-8 inline-block size-3 rotate-45 rounded-[3px] bg-gold align-middle sm:size-4" />
          </span>
        ))}
      </m.div>
    </div>
  );
}
