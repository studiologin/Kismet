import "server-only";
import { createSign } from "node:crypto";

/**
 * Cliente mínimo da Google Sheets API v4 autenticado por Service Account.
 * Sem dependências: assina o JWT com node:crypto e troca por access token.
 * Roda apenas no servidor (Server Components / Server Actions).
 */

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://sheets.googleapis.com/v4/spreadsheets";

export class SheetsConfigError extends Error {}

export function sheetsConfig() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n").replace(/^"|"$/g, "");
  const sheetId = process.env.GOOGLE_SHEET_ID?.trim();
  const tab = process.env.GOOGLE_SHEET_TAB?.trim() || "Partidas";
  const legacyTab = process.env.GOOGLE_LEGACY_TAB?.trim() || "Nucha & Manoel";
  return { email, key, sheetId, tab, legacyTab, ok: Boolean(email && key && sheetId) };
}

export function isSheetsConfigured() {
  return sheetsConfig().ok;
}

let cachedToken: { token: string; exp: number } | null = null;

function b64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const { email, key, ok } = sheetsConfig();
  if (!ok || !email || !key) throw new SheetsConfigError("Credenciais do Google não configuradas.");

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const signature = b64url(signer.sign(key));

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claim}.${signature}`,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Falha na autenticação Google (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, exp: now + data.expires_in };
  return data.access_token;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const { sheetId } = sheetsConfig();
  const token = await getAccessToken();
  const res = await fetch(`${API}/${sheetId}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    let msg = body;
    try {
      msg = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? body;
    } catch {}
    if (res.status === 403) msg = `Sem permissão na planilha. Compartilhe-a com a Service Account como Editor. (${msg})`;
    if (res.status === 404) msg = `Planilha não encontrada. Confira GOOGLE_SHEET_ID. (${msg})`;
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

const q = (range: string) => encodeURIComponent(range);
/** Nome de aba entre aspas simples (necessário para nomes com espaço ou &) */
export const tabRef = (tab: string) => `'${tab.replace(/'/g, "''")}'`;

export async function listTabs(): Promise<string[]> {
  const data = await api<{ sheets: { properties: { title: string } }[] }>(`?fields=sheets.properties.title`);
  return data.sheets.map((s) => s.properties.title);
}

export async function addTab(title: string) {
  await api(`:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: { title, gridProperties: { frozenRowCount: 1 } },
          },
        },
      ],
    }),
  });
}

export async function getValues(range: string): Promise<unknown[][]> {
  const data = await api<{ values?: unknown[][] }>(
    `/values/${q(range)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`,
  );
  return data.values ?? [];
}

export async function updateValues(range: string, values: (string | number)[][]) {
  await api(`/values/${q(range)}?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({ range, majorDimension: "ROWS", values }),
  });
}

export async function appendValues(range: string, values: (string | number)[][]) {
  await api(`/values/${q(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    body: JSON.stringify({ range, majorDimension: "ROWS", values }),
  });
}
