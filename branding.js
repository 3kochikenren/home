// 各ページ共通のブランディング（県連名・住所・連絡先等）を、Supabaseの
// kenren/settingsから読み込んで data-brand 属性の要素に反映する。
// 県連ごとに設定した値があればそれを使い、無い場合は都道府県名から
// 自動生成した文言を使う（＝高知の文言が他県にそのまま出ないようにする）。
// 高知（既定の?kなしURL）は、設定が無ければ元々のHTML文言をそのまま使う。
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
    const html = value.split("\n").join("<br>");
    document.querySelectorAll('[data-brand="' + selectorSuffix + '"]').forEach(function(el) {
        el.innerHTML = html;
    });
}

function applyHref(selectorSuffix, value) {
    if (!value) return;
    document.querySelectorAll('[data-brand="' + selectorSuffix + '"]').forEach(function(el) {
        el.href = value;
        el.classList.remove("hidden");
    });
}

// 他県のページで、値が未設定のまま高知固有の情報（住所・連絡先・SNS）を
// 見せないよう、該当要素を空にする／隠す
function clearIfNotKochi(selectorSuffix, mode) {
    document.querySelectorAll('[data-brand="' + selectorSuffix + '"]').forEach(function(el) {
        if (mode === "hide") el.classList.add("hidden");
        else el.innerHTML = "";
    });
}

// 「高知県」→「高知」のように、都道府県名の末尾（県/府/都）を外した短縮形
function stripPrefectureSuffix(name) {
    if (!name) return "";
    return name.replace(/(県|府|都)$/, "");
}

async function applyBranding() {
    const kenrenRows = await fetchBrandingJson("kenren", "slug=eq." + encodeURIComponent(KENREN_SLUG) + "&select=id,display_name,prefecture_name");
    const kenren = kenrenRows[0];
    if (!kenren) return;
    const isKochi = KENREN_SLUG === "kochi";
    const prefectureFull = kenren.prefecture_name || "";
    const prefectureShort = stripPrefectureSuffix(prefectureFull);

    const settingsRows = await fetchBrandingJson("settings", "kenren_id=eq." + kenren.id + "&select=key,value");
    const settings = {};
    settingsRows.forEach(function(s) { settings[s.key] = s.value; });

    const siteName = settings.site_title || kenren.display_name;
    applyText("site-name", siteName);
    if (siteName) {
        document.title = document.title.replace(/参政党\s*高知県支部連合会|参政党\s*高知県連/g, siteName);
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.content = metaDesc.content.replace(/[〇○]+党高知県連|参政党\s*高知県支部連合会|参政党\s*高知県連/g, siteName);
    }

    // 所属議員の見出し・ナビ表記、参加を呼びかける見出しは都道府県名から自動生成
    if (prefectureFull) applyText("members-heading", prefectureFull + "所属議員");
    if (prefectureShort) applyText("join-heading", "あなたの力が、" + prefectureShort + "を変え、そして日本を変える");

    // ヒーロー見出し: 設定があればそれを使う。無ければ、高知はHTMLの既定文言の
    // まま、それ以外は県名から自動生成する（「高知の未来を、共に創る。」を
    // 他県にそのまま出さないため）
    if (settings.hero_headline) {
        applyHtml("hero-headline", settings.hero_headline);
    } else if (!isKochi && prefectureShort) {
        applyHtml("hero-headline", prefectureShort + "の未来を、\n共に創る。");
    }
    applyText("hero-subheadline", settings.hero_subheadline);

    // フッター住所・連絡先・SNS: 設定があればそれを使う。無ければ、高知は
    // 既定のまま、それ以外は高知の実際の連絡先を出さないよう空にする
    if (settings.footer_address) {
        applyHtml("footer-address", settings.footer_address);
    } else if (!isKochi) {
        clearIfNotKochi("footer-address", "clear");
    }

    if (settings.footer_email) {
        applyText("footer-email", settings.footer_email);
        applyHref("footer-email-link", "mailto:" + settings.footer_email);
    } else if (!isKochi) {
        clearIfNotKochi("footer-email", "clear");
    }

    if (settings.footer_x_url) {
        applyHref("footer-x-url", settings.footer_x_url);
    } else if (!isKochi) {
        clearIfNotKochi("footer-x-url", "hide");
    }

    if (settings.footer_facebook_url) {
        applyHref("footer-facebook-url", settings.footer_facebook_url);
    } else if (!isKochi) {
        clearIfNotKochi("footer-facebook-url", "hide");
    }
}

document.addEventListener("DOMContentLoaded", applyBranding);
