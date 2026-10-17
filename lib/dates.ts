export const TIMEZONE = "America/Sao_Paulo";

export const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
export const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Data/hora atual no fuso de São Paulo */
export function nowInSaoPaulo() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const hour = get("hour") === "24" ? "00" : get("hour");
  return {
    year,
    month,
    day,
    iso: `${year}-${get("month")}-${get("day")}`,
    stamp: `${get("day")}/${get("month")}/${year} ${hour}:${get("minute")}`,
  };
}

export function formatDateBR(iso: string, opts: { withYear?: boolean } = {}) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return opts.withYear
    ? `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`
    : `${String(d).padStart(2, "0")} ${MONTHS_SHORT[m - 1]}`;
}

export function monthLabel(year: number, month: number, short = false) {
  return `${short ? MONTHS_SHORT[month - 1] : MONTHS[month - 1]} ${year}`;
}
