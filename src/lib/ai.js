// Shared Claude API utilities — proxied through Supabase Edge Function.
// The Anthropic API key and system prompts live in Supabase server env only; never in the browser.

const edgeFnUrl = () =>
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claude-feedback`;

const authHeader = () => ({
  "Content-Type": "application/json",
  "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
});

const handleResponse = async (res) => {
  if (!res.ok) {
    let detail = "";
    try { detail = ` — ${(await res.json()).error}`; } catch { /* ignore */ }
    throw new Error(`API ${res.status}${detail}`);
  }
  const d = await res.json();
  return d.content?.map(b => b.text || "").join("") || "";
};

export const callClaude = async (promptKey, userMsg) => {
  const res = await fetch(edgeFnUrl(), {
    method: "POST",
    headers: authHeader(),
    body: JSON.stringify({ promptKey, userMsg }),
  });
  return handleResponse(res);
};

export const callClaudeWithImage = async (promptKey, userMsg, imageBase64, mediaType) => {
  const res = await fetch(edgeFnUrl(), {
    method: "POST",
    headers: authHeader(),
    body: JSON.stringify({ promptKey, userMsg, image: { base64: imageBase64, mediaType } }),
  });
  return handleResponse(res);
};
