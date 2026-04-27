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

// During beta, all tiers are capped at the free limit regardless of account type.
const BETA_MODE = true;
const BETA_DAILY_LIMIT = 30;

// Daily call budgets per tier (post-beta)
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
    const body = await req.json();
    const { promptKey, userMsg, image, questionId, studentAnswer, diagnosisJson } = body;

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
    let profileMemory: Record<string, any> = { recurring_weaknesses: [], current_focus: "", topics_practised: [], command_words: [] };

    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tier, memory")
        .eq("id", userId)
        .single();
      tier = profile?.tier ?? "free-account";
      if (profile?.memory) profileMemory = profile.memory;
    }

    const dailyLimit = BETA_MODE ? BETA_DAILY_LIMIT : (DAILY_LIMITS[tier] ?? 10);
    const today = new Date().toISOString().split("T")[0];

    if (userId) {
      const { data: usage, error: usageErr } = await supabase.rpc("increment_usage", {
        p_user_id: userId,
        p_date: today,
      });

      if (usageErr) {
        console.error("Usage tracking error:", usageErr.message);
      } else if (usage > dailyLimit) {
        return new Response(
          JSON.stringify({ error: "Daily limit reached", limit: dailyLimit, tier }),
          { status: 429, headers: JSON_HEADERS }
        );
      }
    }

    // ── Coach: enrich userMsg with memory + attempt history ────────────────
    let enrichedUserMsg = userMsg;
    let attemptNumber = 1;

    if (promptKey === "coach" && userId && questionId) {
      const { data: history } = await supabase
        .from("question_sessions")
        .select("attempt_number, student_answer, revision_target, target_addressed, moved_on")
        .eq("user_id", userId)
        .eq("question_id", questionId)
        .order("attempt_number", { ascending: true });

      attemptNumber = (history?.length ?? 0) + 1;

      const memoryBlock = `STUDENT MEMORY
recurring_weaknesses: ${profileMemory.recurring_weaknesses?.join(", ") || "none yet"}
current_focus: ${profileMemory.current_focus || "none yet"}
topics_practised: ${profileMemory.topics_practised?.join(", ") || "none yet"}
command_words: ${profileMemory.command_words?.join(", ") || "none yet"}`;

      const historyLines = (history ?? []).map((row: any) =>
        `  Attempt ${row.attempt_number}: ${row.student_answer?.slice(0, 120)}…\n    Revision target: ${row.revision_target ?? "—"}\n    Addressed: ${row.target_addressed === true ? "yes" : row.target_addressed === false ? "no" : "—"}`
      ).join("\n");
      const historyBlock = `ATTEMPT HISTORY\n${historyLines || "  (none — this is the first attempt)"}`;

      enrichedUserMsg = `${memoryBlock}\n\n${historyBlock}\n\nCURRENT ATTEMPT: ${attemptNumber} of 4\n\n${userMsg}`;
    }

    // ── Anthropic API call ──────────────────────────────────────────────────
    const messageContent = image
      ? [
          { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } },
          { type: "text", text: enrichedUserMsg },
        ]
      : enrichedUserMsg;

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
    const rawText: string = data.content?.[0]?.text ?? "";

    // ── Coach: parse METADATA, persist to DB, strip from response ──────────
    if (promptKey === "coach" && userId && questionId) {
      const metaSep = rawText.indexOf("---METADATA---");
      const feedbackText = metaSep !== -1 ? rawText.slice(0, metaSep).trim() : rawText;
      let metadata: Record<string, any> = {};
      if (metaSep !== -1) {
        try { metadata = JSON.parse(rawText.slice(metaSep + 14).trim()); } catch { /* ignore malformed */ }
      }

      // Persist question_session row
      await supabase.from("question_sessions").upsert({
        user_id: userId,
        question_id: questionId,
        attempt_number: attemptNumber,
        student_answer: studentAnswer ?? "",
        diagnosis: diagnosisJson ?? null,
        revision_target: metadata.revision_target ?? null,
        target_addressed: metadata.target_addressed ?? null,
        coaching_message: feedbackText,
        moved_on: metadata.moved_on ?? false,
      }, { onConflict: "user_id,question_id,attempt_number" });

      // Update student profile memory
      if (metadata.memory_update && Object.keys(metadata.memory_update).length > 0) {
        const mu = metadata.memory_update;
        const updated = { ...profileMemory };

        if (mu.add_weakness && !updated.recurring_weaknesses?.includes(mu.add_weakness)) {
          updated.recurring_weaknesses = [...(updated.recurring_weaknesses ?? []), mu.add_weakness];
        }
        if (mu.add_topic && !updated.topics_practised?.includes(mu.add_topic)) {
          updated.topics_practised = [...(updated.topics_practised ?? []), mu.add_topic];
        }
        if (mu.add_command_word && !updated.command_words?.includes(mu.add_command_word)) {
          updated.command_words = [...(updated.command_words ?? []), mu.add_command_word];
        }
        if (mu.set_focus) updated.current_focus = mu.set_focus;

        await supabase.from("profiles").update({ memory: updated }).eq("id", userId);
      }

      // Return only the feedback text, not the METADATA block
      const strippedData = { ...data, content: [{ ...data.content[0], text: feedbackText }] };
      return new Response(JSON.stringify(strippedData), { headers: JSON_HEADERS });
    }

    return new Response(JSON.stringify(data), { headers: JSON_HEADERS });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error", detail: String(err) }),
      { status: 500, headers: JSON_HEADERS }
    );
  }
});
