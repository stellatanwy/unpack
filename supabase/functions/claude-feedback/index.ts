// @ts-nocheck — Deno runtime; TS server does not resolve Deno globals or esm.sh imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PROMPTS } from "./prompts.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const JSON_HEADERS = { ...CORS, "Content-Type": "application/json" };

// Daily call budgets per tier
const DAILY_LIMITS: Record<string, number> = {
  plus: 100,
  basic: 50,
  "free-account": 30,
  free: 30,
  anon: 30,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }

  try {
    const { promptKey, userMsg, image } = await req.json();

    if (!promptKey || !userMsg) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: promptKey, userMsg" }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    const prompt = PROMPTS[promptKey];
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: `Unknown promptKey: ${promptKey}` }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: JSON_HEADERS }
      );
    }

    // ── Per-user rate limiting ──────────────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Resolve user from JWT (falls back to anon if not authenticated)
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);

    let userId = user?.id ?? null;
    let tier = "anon";

    if (userId) {
      // Fetch tier from profiles table
      const { data: profile } = await supabase
        .from("profiles")
        .select("tier")
        .eq("id", userId)
        .single();
      tier = profile?.tier ?? "free-account";
    }

    const dailyLimit = DAILY_LIMITS[tier] ?? 10;
    const today = new Date().toISOString().split("T")[0];

    if (userId) {
      // Atomically increment counter and check limit
      const { data: usage, error: usageErr } = await supabase.rpc("increment_usage", {
        p_user_id: userId,
        p_date: today,
      });

      if (usageErr) {
        console.error("Usage tracking error:", usageErr.message);
        // Don't block the request if usage tracking fails — log and continue
      } else if (usage > dailyLimit) {
        return new Response(
          JSON.stringify({ error: "Daily limit reached", limit: dailyLimit, tier }),
          { status: 429, headers: JSON_HEADERS }
        );
      }
    }
    // Unauthenticated users are not tracked (no user_id) but still allowed up to anon limit
    // — IP-based limiting would require a proxy layer outside Supabase

    // ── Anthropic API call ──────────────────────────────────────────────────
    const messageContent = image
      ? [
          { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } },
          { type: "text", text: userMsg },
        ]
      : userMsg;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: prompt.maxTokens,
        system: prompt.system,
        messages: [{ role: "user", content: messageContent }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return new Response(
        JSON.stringify({ error: `Anthropic API error ${anthropicRes.status}`, detail: errText }),
        { status: anthropicRes.status, headers: JSON_HEADERS }
      );
    }

    const data = await anthropicRes.json();
    return new Response(JSON.stringify(data), { headers: JSON_HEADERS });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error", detail: String(err) }),
      { status: 500, headers: JSON_HEADERS }
    );
  }
});
