import type { CSSProperties } from "react";

/** Cor do pip segundo os dados do Kismet: 1/6 preto · 2/5 vermelho · 3/4 verde */
export const PIP_COLOR: Record<number, string> = {
  1: "#16141d",
  6: "#16141d",
  2: "#e0263f",
  5: "#e0263f",
  3: "#109a59",
  4: "#109a59",
};

const LAYOUT: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

// frente, direita, trás, esquerda, topo, base — faces opostas somam 7
const FACES = [1, 3, 6, 4, 2, 5];

export function Pips({ value }: { value: number }) {
  return (
    <>
      {LAYOUT[value].map((i) => (
        <span
          key={i}
          className="pip"
          style={{ background: PIP_COLOR[value], gridRow: Math.floor(i / 3) + 1, gridColumn: (i % 3) + 1 }}
        />
      ))}
    </>
  );
}

interface DieProps {
  size: number;
  rx?: number;
  ry?: number;
  duration?: number;
  delay?: number;
  className?: string;
  style?: CSSProperties;
}

/** Dado 3D em CSS puro (sem WebGL) — leve e acessível (decorativo). */
export function Die({ size, rx = -24, ry = 32, duration = 22, delay = 0, className = "", style }: DieProps) {
  return (
    <div aria-hidden className={`die-scene ${className}`} style={style}>
      <div
        className="die"
        style={
          {
            "--s": `${size}px`,
            "--rx": `${rx}deg`,
            "--ry": `${ry}deg`,
            "--dur": `${duration}s`,
            "--delay": `${delay}s`,
          } as CSSProperties
        }
      >
        {FACES.map((v) => (
          <div key={v} className="die-face">
            <Pips value={v} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Face 2D de dado (para chips e ícones) */
export function DieFace({ value, size = 28, className = "" }: { value: number; size?: number; className?: string }) {
  return (
    <div
      aria-hidden
      className={`die-face !relative !transform-none ${className}`}
      style={{ width: size, height: size, ["--s" as string]: `${size}px` } as CSSProperties}
    >
      <Pips value={value} />
    </div>
  );
}
