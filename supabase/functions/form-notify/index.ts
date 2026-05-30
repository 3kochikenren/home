import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

function toPrettyBody(formType: string, table: string, recordId: number | null, data: Record<string, unknown>) {
  const lines: string[] = [];
  lines.push(`フォーム種別: ${formType}`);
  lines.push(`テーブル: ${table}`);
  lines.push(`レコードID: ${recordId ?? "(なし)"}`);
  lines.push("");
  lines.push("送信データ:");
  Object.entries(data || {}).forEach(([key, value]) => {
    lines.push(`- ${key}: ${value ?? ""}`);
  });
  return lines.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: CORS_HEADERS
    });
  }

  try {
    const payload = await req.json();
    const formType = String(payload?.formType || "unknown");
    const table = String(payload?.table || "unknown");
    const recordId = payload?.recordId ? Number(payload.recordId) : null;
    const data = (payload?.data || {}) as Record<string, unknown>;

    const to = String(payload?.notifyTo || Deno.env.get("FORM_NOTIFY_TO") || "").trim();
    const from = String(Deno.env.get("FORM_NOTIFY_FROM") || "onboarding@resend.dev").trim();
    const resendKey = String(Deno.env.get("RESEND_API_KEY") || "").trim();

    if (!to) {
      return new Response(JSON.stringify({ ok: false, error: "notifyTo is required" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    if (!resendKey) {
      return new Response(JSON.stringify({ ok: false, error: "RESEND_API_KEY is not configured" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    const subject = `【${formType}】新規送信のお知らせ`;
    const text = toPrettyBody(formType, table, recordId, data);

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text
      })
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      return new Response(JSON.stringify({ ok: false, error: errorText }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  }
});
