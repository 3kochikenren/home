const SUPABASE_URL = "https://yaimsonvxpujfupstpsd.supabase.co";
const SUPABASE_KEY = "sb_publishable_vsx3v5xQggFsT-btyToaKg_OF2CzV7o";
const SUPABASE_ANON_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhaW1zb252eHB1amZ1cHN0cHNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0ODEwMjksImV4cCI6MjA5NTA1NzAyOX0.2PAKyBs8z44Ft4TXigKAsRfh6zEQwdVl2KNRZojxwzk";

async function getSettingValue(key) {
    const url = `${SUPABASE_URL}/rest/v1/settings?key=eq.${encodeURIComponent(key)}&select=value&limit=1`;
    const res = await fetch(url, {
        headers: {
            apikey: SUPABASE_KEY
        }
    });
    if (!res.ok) return "";
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return "";
    return rows[0].value || "";
}

function collectFormPayload(form) {
    const fd = new FormData(form);
    const payload = {};
    fd.forEach((value, key) => {
        if (typeof value === "string") {
            payload[key] = value.trim();
        }
    });
    payload.source_page = window.location.pathname.split("/").pop() || "";
    return payload;
}

async function insertRecord(table, payload) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Prefer: "return=minimal",
            apikey: SUPABASE_KEY
        },
        body: JSON.stringify(payload)
    });

    const body = await res.json().catch(() => null);
    if (!res.ok) {
        const msg = body && body.message ? body.message : "送信に失敗しました。";
        throw new Error(msg);
    }

    return null;
}

async function notifyByEmail(formType, table, record, payload) {
    const customEndpoint = await getSettingValue("form_notify_function_url");
    const fallbackEndpoint = `${SUPABASE_URL}/functions/v1/form-notify`;
    const endpoint = (customEndpoint || fallbackEndpoint).trim();

    if (!endpoint) return;

    const notifyTo = await getSettingValue("form_notify_to");

    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_JWT}`
        },
        body: JSON.stringify({
            formType,
            table,
            recordId: record && record.id ? record.id : null,
            notifyTo,
            data: payload
        })
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "メール通知に失敗しました。");
    }
}

function setStatus(el, message, tone) {
    if (!el) return;
    el.classList.remove("hidden", "text-red-600", "text-emerald-700", "text-amber-700");
    if (tone === "error") el.classList.add("text-red-600");
    if (tone === "success") el.classList.add("text-emerald-700");
    if (tone === "warn") el.classList.add("text-amber-700");
    el.textContent = message;
}

function bindFormSubmit(config) {
    const form = document.getElementById(config.formId);
    const submitBtn = document.getElementById(config.submitId);
    const status = document.getElementById(config.statusId);
    if (!form || !submitBtn || !status) return;

    form.addEventListener("submit", async function(e) {
        e.preventDefault();
        submitBtn.disabled = true;
        submitBtn.classList.add("opacity-70", "cursor-not-allowed");
        setStatus(status, "送信中です。しばらくお待ちください。", "warn");

        try {
            const payload = collectFormPayload(form);
            const record = await insertRecord(config.table, payload);

            try {
                await notifyByEmail(config.formType, config.table, record, payload);
                setStatus(status, "送信が完了しました。担当者へ通知メールを送信しました。", "success");
            } catch (notifyErr) {
                console.error(notifyErr);
                const detail = notifyErr && notifyErr.message ? ` (${notifyErr.message})` : "";
                setStatus(status, `送信は完了しました。通知メールの送信でエラーが発生しました。${detail}`, "warn");
            }

            form.reset();
        } catch (err) {
            console.error(err);
            setStatus(status, err.message || "送信時にエラーが発生しました。", "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.classList.remove("opacity-70", "cursor-not-allowed");
        }
    });
}
