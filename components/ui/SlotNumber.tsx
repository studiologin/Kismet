/**
 * Número estilo "rolo de caça-níquel": cada dígito gira até o valor final só com CSS.
 * O texto nunca muda após o primeiro paint — bom para LCP e sem JavaScript.
 */
export function SlotNumber({ value, className = "" }: { value: number; className?: string }) {
  const digits = String(Math.max(0, Math.round(value))).split("");
  return (
    <span className={`slot ${className}`}>
      <span className="sr-only">{value}</span>
      {digits.map((d, i) => (
        <span key={i} aria-hidden className="slot-digit">
          <span className="slot-reel" style={{ ["--d" as string]: d, animationDelay: `${i * 0.12}s` }}>
            {Array.from({ length: 10 }, (_, n) => (
              <span key={n}>{n}</span>
            ))}
          </span>
        </span>
      ))}
    </span>
  );
}
