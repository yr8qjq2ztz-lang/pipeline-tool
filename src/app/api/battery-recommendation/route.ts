import { NextResponse } from "next/server";

export const runtime = "nodejs";

type BatteryRecommendationRequest = {
  batterySolution?: string;
  brand?: string;
  model?: string;
  market?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as BatteryRecommendationRequest;

    const batterySolution = String(body.batterySolution ?? "").trim();
    const brand = String(body.brand ?? "").trim();
    const model = String(body.model ?? "").trim();
    const market = String(body.market ?? "NZ").trim() || "NZ";

    const brandMax = 80;
    const modelMax = 120;
    const solutionMax = 120;
    const marketMax = 20;

    if (brand.length > brandMax || model.length > modelMax) {
      return NextResponse.json(
        { error: `Vehicle brand/model too long (max ${brandMax}/${modelMax} chars).` },
        { status: 400 }
      );
    }
    if (batterySolution.length > solutionMax) {
      return NextResponse.json(
        { error: `Battery solution too long (max ${solutionMax} chars).` },
        { status: 400 }
      );
    }
    if (market.length > marketMax) {
      return NextResponse.json(
        { error: `Market too long (max ${marketMax} chars).` },
        { status: 400 }
      );
    }

    if (!brand || !model) {
      return NextResponse.json(
        { error: "Vehicle brand and model are required." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        recommendation:
          "AI suggestions are not configured yet. Set OPENAI_API_KEY in .env.local to enable recommendations.",
      });
    }

    const openaiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const system =
      "You are a battery solutions specialist for New Zealand. " +
      "Given a vehicle brand/model and the segment, propose a best-fit battery solution approach. " +
      "Be practical: call out typical battery type/chemistry/form-factor considerations and what to confirm (CCA, Ah, dimensions, terminals, duty cycle). " +
      "Keep it short and actionable. Do not invent specific OEM part numbers.";

    const user =
      `Market: ${market}\n` +
      `Segment (Battery Solution): ${batterySolution || "(not specified)"}\n` +
      `Vehicle: ${brand} ${model}\n\n` +
      "Provide: (1) recommended battery category/spec guidance, (2) 3 questions to confirm fitment.";

    const ac = new AbortController();
    const timeoutMs = 15_000;
    const t = setTimeout(() => ac.abort(), timeoutMs);

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: ac.signal,
      body: JSON.stringify({
        model: openaiModel,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    clearTimeout(t);

    if (!resp.ok) {
      let detail = "";
      try {
        const maybeJson: unknown = await resp.json();

        if (typeof maybeJson === "object" && maybeJson !== null && "error" in maybeJson) {
          const err = (maybeJson as { error?: unknown }).error;
          if (typeof err === "object" && err !== null && "message" in err) {
            const message = (err as { message?: unknown }).message;
            if (typeof message === "string") detail = message.trim();
          }
        }
      } catch {
        // ignore
      }

      const extra = detail ? ` ${detail}` : "";
      return NextResponse.json(
        { error: `OpenAI request failed (${resp.status}).${extra}` },
        { status: 502 }
      );
    }

    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const recommendation =
      data.choices?.[0]?.message?.content?.trim() ||
      "No recommendation returned.";

    return NextResponse.json({ recommendation });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return NextResponse.json(
        { error: "AI request timed out. Please try again." },
        { status: 504 }
      );
    }

    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
