// 各ページ共通のブランディング（県連名・住所・連絡先等）を、Supabaseの
// kenren/settingsから読み込んで data-brand 属性の要素に反映する。
// 値が未設定の項目は、HTMLに元から書かれている既定文言をそのまま残す
// （＝どの項目も「上書きされないと壊れる」ことがない設計）。
const SUPABASE_URL = "https://yaimsonvxpujfupstpsd.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhaW1zb252eHB1amZ1cHN0cHNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0ODEwMjksImV4cCI6MjA5NTA1NzAyOX0.2PAKyBs8z44Ft4TXigKAsRfh6zEQwdVl2KNRZojxwzk";

const DEFAULT_KENREN_SLUG = "kochi";
function resolveKenrenSlug() {
    const params = new URLSearchParams(window.location.search);
    return params.get("k") || DEFAULT_KENREN_SLUG;
}
const KENREN_SLUG = resolveKenrenSlug();

async function fetchBrandingJson(table, query) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

function applyText(selectorSuffix, value) {
    if (!value) return;
    document.querySelectorAll('[data-brand="' + selectorSuffix + '"]').forEach(function(el) {
        el.textContent = value;
    });
}

function applyHtml(selectorSuffix, value) {
    if (!value) return;
    const html = value.split("\n").map(function(line) { return line; }).join("<br>");
    document.querySelectorAll('[data-brand="' + selectorSuffix + '"]').forEach(function(el) {
        el.innerHTML = html;
    });
}

function applyHref(selectorSuffix, value) {
    if (!value) return;
    document.querySelectorAll('[data-brand="' + selectorSuffix + '"]').forEach(function(el) {
        el.href = value;
    });
}

async function applyBranding() {
    const kenrenRows = await fetchBrandingJson("kenren", "slug=eq." + encodeURIComponent(KENREN_SLUG) + "&select=id,display_name");
    const kenren = kenrenRows[0];
    if (!kenren) return;

    const settingsRows = await fetchBrandingJson("settings", "kenren_id=eq." + kenren.id + "&select=key,value");
    const settings = {};
    settingsRows.forEach(function(s) { settings[s.key] = s.value; });

    const siteName = settings.site_title || kenren.display_name;
    applyText("site-name", siteName);
    if (siteName) {
        document.title = document.title.replace(/参政党\s*高知県支部連合会|参政党\s*高知県連/g, siteName);
    }

    applyHtml("hero-headline", settings.hero_headline);
    applyText("hero-subheadline", settings.hero_subheadline);
    applyHtml("footer-address", settings.footer_address);
    applyText("footer-email", settings.footer_email);
    applyHref("footer-email-link", settings.footer_email ? "mailto:" + settings.footer_email : "");
    applyHref("footer-x-url", settings.footer_x_url);
    applyHref("footer-facebook-url", settings.footer_facebook_url);
}

document.addEventListener("DOMContentLoaded", applyBranding);
