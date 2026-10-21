import { NextResponse } from "next/server";
import { getMatches } from "@/lib/matches";
import { BUILD_ID, dataStamp } from "@/lib/stamp";

// Versão do app e carimbo dos dados — usados pelo aviso de atualização.
export const dynamic = "force-dynamic";

export async function GET() {
  const { matches, source } = await getMatches();
  return NextResponse.json(
    { build: BUILD_ID, data: source === "error" ? null : dataStamp(matches) },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
