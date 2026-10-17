"use client";

import { useScroll, useTransform, useReducedMotion, type MotionValue } from "motion/react";
import * as m from "motion/react-m";
import { useRef, type ReactNode, type CSSProperties } from "react";

interface ParallaxProps {
  children: ReactNode;
  /** deslocamento total em px durante a passagem pela tela (negativo sobe mais rápido) */
  offset?: number;
  axis?: "y" | "x";
  className?: string;
  style?: CSSProperties;
}

/** Camada com parallax ligada ao scroll do próprio elemento. */
export function Parallax({ children, offset = 80, axis = "y", className, style }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const v: MotionValue<number> = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [offset, -offset]);
  return (
    <m.div ref={ref} className={className} style={{ ...style, [axis]: v, willChange: "transform" }}>
      {children}
    </m.div>
  );
}
