import { NextResponse } from "next/server";
import { getLiveState } from "@/lib/live";

// Estado da partida em andamento — consultado pelos celulares a cada poucos segundos.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await getLiveState();
    return NextResponse.json(
      { state, at: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (e) {
    return NextResponse.json(
      { state: null, error: e instanceof Error ? e.message : "erro" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
