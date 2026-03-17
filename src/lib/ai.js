// Shared Claude API utilities — proxied through Supabase Edge Function.
// The Anthropic API key lives in Supabase server env only; never in the browser.

const edgeFnUrl = () =>
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claude-feedback`;

const authHeader = () => ({
  "Content-Type": "application/json",
  "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
});

export const callClaude = async (system, userMsg, maxTokens = 900) => {
  const res = await fetch(edgeFnUrl(), {
    method: "POST",
    headers: authHeader(),
    body: JSON.stringify({ system, userMsg, maxTokens }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const d = await res.json();
  return d.content?.map(b => b.text || "").join("") || "";
};

export const callClaudeWithImage = async (system, userMsg, imageBase64, mediaType, maxTokens = 900) => {
  const res = await fetch(edgeFnUrl(), {
    method: "POST",
    headers: authHeader(),
    body: JSON.stringify({ system, userMsg, maxTokens, image: { base64: imageBase64, mediaType } }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const d = await res.json();
  return d.content?.map(b => b.text || "").join("") || "";
};
