import type { CSSProperties, ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  /** atraso relativo (0–0.4) — vira deslocamento no intervalo da animação */
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "li" | "section" | "article";
}

/**
 * Entrada ao rolar usando CSS scroll-driven animations (animation-timeline: view()).
 * Zero JavaScript — não pesa na hidratação. Navegadores sem suporte ou com
 * prefers-reduced-motion simplesmente exibem o conteúdo.
 */
export function Reveal({ children, delay = 0, y = 28, className = "", as: Comp = "div" }: RevealProps) {
  return (
    <Comp
      className={`reveal ${className}`}
      style={{ "--reveal-y": `${y}px`, "--reveal-offset": `${Math.min(delay, 0.4) * 60}%` } as CSSProperties}
    >
      {children}
    </Comp>
  );
}
