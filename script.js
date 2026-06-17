const SUPABASE_URL = "https://yaimsonvxpujfupstpsd.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhaW1zb252eHB1amZ1cHN0cHNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0ODEwMjksImV4cCI6MjA5NTA1NzAyOX0.2PAKyBs8z44Ft4TXigKAsRfh6zEQwdVl2KNRZojxwzk";

async function fetchDB(table, query = "") {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
        headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`
        }
    });
    return res.json();
}

function formatVoteDateJa(dateValue) {
    if (!dateValue) return "";
    const m = String(dateValue).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
        return `${Number(m[2])}月${Number(m[3])}日`;
    }
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}

const OFFICER_GROUPS = [
    {
        label: "県連4役",
        columns: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
        type: "fixed",
        slots: ["県連会長", "県連副会長", "事務局長", "財政局長"],
        note: "4人の固定役職を順番どおりに表示します"
    },
    {
        label: "県連役員",
        columns: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
        type: "multi",
        note: "複数名を順番に表示します"
    },
    {
        label: "第一支部役員",
        columns: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
        type: "branch",
        headRole: "支部長",
        note: "支部長を先頭に、他の役員を順番に表示します"
    },
    {
        label: "第二支部役員",
        columns: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
        type: "branch",
        headRole: "支部長",
        note: "支部長を先頭に、他の役員を順番に表示します"
    }
];

function getOfficerGroup(label) {
    return OFFICER_GROUPS.find(group => group.label === label) || OFFICER_GROUPS[0];
}

function normalizeOfficerRole(role, group) {
    const text = (role || "").trim();
    if (group.type === "fixed") return text || "";
    if (group.type === "branch") {
        if (text.includes("支部長")) return group.headRole;
        return text || "役員";
    }
    if (text === "県連役員") return text;
    return text || "県連役員";
}

function renderOfficerCard(g, options = {}) {
    const roleText = options.roleText !== undefined ? options.roleText : (g.role || "");
    const empty = options.empty === true;
    return `
        <article class="bg-white rounded-xl shadow-sm border border-orange-100 p-3 text-center hover:shadow-md transition ${empty ? "border-dashed bg-gray-50" : ""}">
            <img src="${g.photo_url || "https://placehold.co/200x200/fdf2e8/f97316?text=写真"}"
                 alt="${g.name || ""}" class="w-40 h-40 rounded-full object-cover mx-auto mb-6 border-4 border-orange-100 shadow-sm ${empty ? "opacity-40" : ""}">
            <p class="text-[11px] font-bold text-orange-500 mb-1">${roleText}</p>
            <h3 class="text-sm sm:text-base font-black text-gray-900 leading-tight mb-1">${g.name || (empty ? "未登録" : "")}</h3>
            ${g.content ? `<p class="text-[11px] text-gray-600 leading-relaxed text-left">${g.content}</p>` : empty ? `<p class="text-[11px] text-gray-400">登録されていません</p>` : ""}
        </article>
    `;
}

function findOfficer(data, groupLabel, roleIncludes) {
    const roleText = (roleIncludes || "").trim();
    return (data || []).find(function(item) {
        const group = (item.position_label || "県連役員") === groupLabel;
        if (!group) return false;
        const role = (item.role || "").trim();
        if (!roleText) return true;
        return role.indexOf(roleText) >= 0;
    }) || null;
}

function renderOfficerSummaryTile(data) {
    const chairman = findOfficer(data, "県連4役", "県連会長");
    const firstBranchHead = findOfficer(data, "第一支部役員", "支部長");
    const secondBranchHead = findOfficer(data, "第二支部役員", "支部長");
    const picks = [
        { label: "県連会長", item: chairman },
        { label: "第一支部長", item: firstBranchHead },
        { label: "第二支部長", item: secondBranchHead }
    ];
    return `
        <section class="bg-white rounded-2xl border border-orange-200 shadow p-4 sm:p-6">
            <div class="grid grid-cols-3 gap-2 sm:gap-4">
                ${picks.map(function(p) {
                    const image = p.item && p.item.photo_url ? p.item.photo_url : "https://placehold.co/120x120/f3f4f6/9ca3af?text=未登録";
                    const name = p.item && p.item.name ? p.item.name : "未登録";
                    const content = p.item && p.item.content ? p.item.content : "";
                    return `
                        <article class="rounded-xl border border-orange-100 bg-orange-50/40 p-2 sm:p-3 text-center">
                            <img src="${image}" alt="${name}" class="w-40 h-40 rounded-full object-cover mx-auto mb-6 border-4 border-white shadow">
                            <p class="text-sm font-medium text-secondary leading-tight">${p.label}</p>
                            <p class="text-xl font-bold text-gray-800 mt-1 leading-tight">${name}</p>
                            ${content ? `<p class="mt-2 text-[11px] text-gray-700 leading-relaxed text-left whitespace-pre-line">${content}</p>` : ""}
                        </article>
                    `;
                }).join("")}
            </div>
            <div class="text-center mt-4">
                <button id="officer-detail-toggle" type="button" class="inline-flex items-center gap-2 rounded-full border border-orange-300 bg-white px-5 py-2 text-sm font-bold text-orange-700 hover:bg-orange-100 transition">
                    詳細表示
                    <i class="fa-solid fa-chevron-down text-xs"></i>
                </button>
            </div>
        </section>
    `;
}

function renderOfficerSection(group, data) {
    const items = (data || []).filter(item => (item.position_label || "県連役員") === group.label);
    if (group.type === "fixed") {
        const byRole = new Map();
        items.forEach(item => byRole.set(normalizeOfficerRole(item.role, group), item));
        return `
            <section class="space-y-4">
                <div class="flex items-center justify-center gap-3">
                    <div class="h-px flex-1 bg-gradient-to-r from-transparent via-orange-200 to-transparent"></div>
                    <h3 class="text-base sm:text-lg font-black text-gray-800 whitespace-nowrap">${group.label}</h3>
                    <div class="h-px flex-1 bg-gradient-to-r from-transparent via-orange-200 to-transparent"></div>
                </div>
                <div class="grid ${group.columns} gap-4 sm:gap-5">
                    ${group.slots.map(function(slot) {
                        const item = byRole.get(slot);
                        return item ? renderOfficerCard(item, { roleText: slot }) : renderOfficerCard({ role: slot, name: "未登録" }, { roleText: slot, empty: true });
                    }).join("")}
                </div>
            </section>
        `;
    }

    if (group.type === "branch") {
        const head = items.find(item => normalizeOfficerRole(item.role, group) === group.headRole) || null;
        const others = items.filter(item => normalizeOfficerRole(item.role, group) !== group.headRole)
            .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
        return `
            <section class="space-y-4">
                <div class="flex items-center justify-center gap-3">
                    <div class="h-px flex-1 bg-gradient-to-r from-transparent via-orange-200 to-transparent"></div>
                    <h3 class="text-base sm:text-lg font-black text-gray-800 whitespace-nowrap">${group.label}</h3>
                    <div class="h-px flex-1 bg-gradient-to-r from-transparent via-orange-200 to-transparent"></div>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                    ${head ? renderOfficerCard(head, { roleText: group.headRole }) : renderOfficerCard({ role: group.headRole, name: "未登録" }, { roleText: group.headRole, empty: true })}
                    ${others.map(function(item) { return renderOfficerCard(item, { roleText: normalizeOfficerRole(item.role, group) }); }).join("")}
                </div>
            </section>
        `;
    }

    const sortedItems = items.slice().sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
    return `
        <section class="space-y-4">
            <div class="flex items-center justify-center gap-3">
                <div class="h-px flex-1 bg-gradient-to-r from-transparent via-orange-200 to-transparent"></div>
                <h3 class="text-base sm:text-lg font-black text-gray-800 whitespace-nowrap">${group.label}</h3>
                <div class="h-px flex-1 bg-gradient-to-r from-transparent via-orange-200 to-transparent"></div>
            </div>
            <div class="grid ${group.columns} gap-4 sm:gap-5">
                ${sortedItems.map(function(item) { return renderOfficerCard(item, { roleText: normalizeOfficerRole(item.role, group) }); }).join("")}
            </div>
        </section>
    `;
}

// ヒーロー画像を表示
async function loadHeroImage() {
    const data = await fetchDB("settings", "key=eq.hero_image");
    if (!data || data.length === 0) return;
    const url = data[0].value;
    if (!url) return;
    const hero = document.getElementById("hero-section");
    if (hero) hero.style.backgroundImage = "url(" + url + ")";
}

// 役員組織図を表示
async function loadGreeting() {
    const data = await fetchDB("greeting", "order=sort_order.asc");
    const container = document.getElementById("greeting-container");
    if (!container) return;
    const officers = data || [];
    const detailHtml = OFFICER_GROUPS.map(function(group) {
        return renderOfficerSection(group, officers);
    }).join('<div class="h-6"></div>');

    container.innerHTML = `
        ${renderOfficerSummaryTile(officers)}
        <div id="officer-detail-panel" class="hidden mt-5 bg-white rounded-2xl border border-orange-200 shadow p-4 sm:p-5">
            ${detailHtml}
        </div>
    `;

    const toggleBtn = document.getElementById("officer-detail-toggle");
    const detailPanel = document.getElementById("officer-detail-panel");
    if (!toggleBtn || !detailPanel) return;
    toggleBtn.addEventListener("click", function() {
        const isHidden = detailPanel.classList.contains("hidden");
        detailPanel.classList.toggle("hidden", !isHidden);
        toggleBtn.innerHTML = isHidden
            ? '詳細を閉じる <i class="fa-solid fa-chevron-up text-xs"></i>'
            : '詳細表示 <i class="fa-solid fa-chevron-down text-xs"></i>';
    });
}

// 議員情報を表示
async function loadMembers() {
    const members = await fetchDB("members", "order=sort_order.asc");
    const membersContainer = document.getElementById("members-container");
    const candidatesSection = document.getElementById("candidates-section");
    const candidatesContainer = document.getElementById("candidates-container");
    const reformersSection = document.getElementById("reformers-section");
    const reformersContainer = document.getElementById("reformers-container");
    if (!membersContainer || !candidatesSection || !candidatesContainer || !reformersSection || !reformersContainer) return;

    const cards = (members || []).map(m => {
        const category = m.member_type || "議員";
        const deleted = m.is_deleted === true;
        const electionDistrict = m.election_district || "";
        const voteDateRaw = m.vote_date || "";
        const voteDateLabel = formatVoteDateJa(voteDateRaw);
        const plainBio = m.bio || "";
        return { ...m, category, deleted, electionDistrict, voteDateLabel, plainBio };
    });
    const activeCards = cards.filter(m => !m.deleted);
    const lawmakers = activeCards.filter(m => m.category === "議員");
    const candidates = activeCards.filter(m => m.category === "候補者");
    const reformers = activeCards.filter(m => m.category === "改革委員");

    const renderCard = (m) => `
        <div class="hover-card bg-white border border-gray-100 rounded-xl p-8 shadow-md text-center">
            <img src="${m.photo_url || 'https://placehold.co/200x200/f97316/ffffff?text=議員写真'}"
                 alt="${m.name}" class="w-40 h-40 rounded-full object-cover mx-auto mb-6 border-4 border-orange-100">
            <h3 class="text-xl font-bold text-gray-800 mb-1">${m.name}</h3>
            <p class="text-secondary font-medium text-sm mb-4">${m.role || ""}</p>
            <p class="text-gray-600 text-sm leading-relaxed text-left">${m.plainBio || ""}</p>
        </div>
    `;

    const renderCandidateCard = (m) => `
        <article class="hover-card relative overflow-hidden rounded-2xl border-2 border-red-300 bg-gradient-to-br from-red-50 via-orange-50 to-amber-100 p-8 shadow-lg text-center">
            <div class="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-red-200 opacity-60 blur-2xl"></div>
            <div class="absolute -bottom-10 -left-8 h-24 w-24 rounded-full bg-yellow-200 opacity-60 blur-xl"></div>
            ${(m.electionDistrict || m.voteDateLabel) ? `
            <div class="relative mb-4 mx-auto max-w-xs rounded-xl bg-red-600 text-white px-4 py-3 shadow-xl border-2 border-white">
                <p class="text-sm font-black tracking-wide leading-tight">${m.electionDistrict ? `${m.electionDistrict}議会議員選挙` : "議会議員選挙"}</p>
                <p class="text-base font-black leading-none mt-2">${m.voteDateLabel ? `投票日 ${m.voteDateLabel}` : "投票日 未設定"}</p>
            </div>
            ` : ""}
            <div class="relative mx-auto mb-5 w-44 h-44">
                <img src="${m.photo_url || 'https://placehold.co/220x220/f97316/ffffff?text=候補者写真'}"
                     alt="${m.name}" class="w-44 h-44 rounded-full object-cover mx-auto border-[6px] border-white shadow-xl ring-4 ring-red-300">
            </div>
            <p class="text-xs font-black tracking-widest text-red-700 mb-2">公認候補者</p>
            <h3 class="text-2xl font-black text-gray-900 mb-2">${m.name}</h3>
            <p class="text-red-700 font-bold text-sm mb-4">${m.role || ""}</p>
            <p class="text-gray-700 text-sm leading-relaxed text-left">${m.plainBio || ""}</p>
        </article>
    `;

    membersContainer.innerHTML = lawmakers.length > 0
        ? lawmakers.map(renderCard).join("")
        : '<div class="md:col-span-2 bg-gray-50 rounded-xl p-8 text-center text-gray-400">所属議員は現在準備中です。</div>';

    if (candidates.length > 0) {
        candidatesSection.classList.remove("hidden");
        candidatesContainer.innerHTML = candidates.map(renderCandidateCard).join("");
    } else {
        candidatesSection.classList.add("hidden");
        candidatesContainer.innerHTML = "";
    }

    if (reformers.length > 0) {
        reformersSection.classList.remove("hidden");
        reformersContainer.innerHTML = reformers.map(renderCard).join("");
    } else {
        reformersSection.classList.add("hidden");
        reformersContainer.innerHTML = "";
    }
}

// イベント（削除済み - お知らせに統合）

// 活動報告を表示
async function loadActivities() {
    const activities = await fetchDB("activities", "is_published=eq.true&order=activity_date.desc&limit=21");
    const section = document.getElementById("activity");
    const container = document.getElementById("activities-container");
    if (!container || !section) return;
    if (!activities || activities.length === 0) {
        section.classList.add("hidden");
        container.innerHTML = "";
        return;
    }
    section.classList.remove("hidden");
    container.innerHTML = activities.map(a => `
        <div class="bg-white rounded-lg shadow overflow-hidden hover-card">
            <img src="${a.photo_url || 'https://placehold.co/400x250/e5e7eb/6b7280?text=Activity+Image'}"
                 alt="${a.title}" class="w-full h-48 object-cover">
            <div class="p-6">
                <span class="text-xs text-gray-500 font-mono mb-2 block">${a.activity_date}</span>
                <h3 class="text-lg font-bold text-gray-800 mb-2">${a.title}</h3>
                <p class="text-gray-600 text-sm line-clamp-3">${a.content || ""}</p>
            </div>
        </div>
    `).join("");
}

// お知らせ・イベントを表示（統合）
async function loadNews() {
    const newsList = await fetchDB("news", "is_published=eq.true&order=published_date.asc&limit=10");
    const container = document.getElementById("news-container");
    if (!container) return;
    if (!newsList || newsList.length === 0) {
        container.innerHTML = `<li class="py-6 text-center text-gray-400">お知らせはありません</li>`;
        return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sortedNews = newsList.slice().filter(function(n) {
        const d = new Date(n.published_date || "");
        if (Number.isNaN(d.getTime())) return true;
        return d >= today;
    }).sort(function(a, b) {
        const da = new Date(a.published_date || "");
        const db = new Date(b.published_date || "");
        const aValid = !Number.isNaN(da.getTime());
        const bValid = !Number.isNaN(db.getTime());
        if (!aValid && !bValid) return 0;
        if (!aValid) return 1;
        if (!bValid) return -1;
        return da - db;
    });

    const categoryColors = {
        "イベント": "bg-orange-100 text-orange-700",
        "活動報告": "bg-green-100 text-green-800",
        "重要": "bg-red-100 text-red-800",
        "その他": "bg-gray-100 text-gray-600"
    };
    const formatTimeHM = function(value) {
        if (!value) return "";
        const text = String(value).trim();
        const m = text.match(/^(\d{1,2}):(\d{2})/);
        if (m) return m[1].padStart(2, "0") + ":" + m[2];
        return text;
    };
    const renderDetailRows = function(n) {
        const rows = [];
        if (n.reception_time) rows.push(`<li><span class="font-bold text-gray-700">受付時間:</span> ${formatTimeHM(n.reception_time)}</li>`);
        if (n.start_time) rows.push(`<li><span class="font-bold text-gray-700">開始時間:</span> ${formatTimeHM(n.start_time)}</li>`);
        if (n.end_time) rows.push(`<li><span class="font-bold text-gray-700">終了時間:</span> ${formatTimeHM(n.end_time)}</li>`);
        if (n.venue_name) rows.push(`<li><span class="font-bold text-gray-700">会場名:</span> ${n.venue_name}</li>`);
        if (n.venue_address) rows.push(`<li><span class="font-bold text-gray-700">会場住所:</span> ${n.venue_address}</li>`);
        if (n.target_audience) rows.push(`<li><span class="font-bold text-gray-700">対象者:</span> ${n.target_audience}</li>`);
        if (n.participation_fee) rows.push(`<li><span class="font-bold text-gray-700">参加費:</span> ${n.participation_fee}</li>`);
        if (n.application_url) {
            rows.push(`<li><span class="font-bold text-gray-700">申込URL:</span> <a href="${n.application_url}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline break-all">${n.application_url}</a></li>`);
        }
        return rows.join("");
    };

    container.innerHTML = sortedNews.map((n, idx) => {
        const color = categoryColors[n.category] || "bg-gray-100 text-gray-600";
        const detailRows = renderDetailRows(n);
        const detailContent = (n.content || "").trim();
        return `
        <li class="py-2 px-2 rounded">
            <button type="button" data-news-toggle="${idx}" class="w-full py-2 flex flex-col md:flex-row md:items-center gap-2 md:gap-6 hover:bg-gray-100 transition rounded text-left">
                <div class="flex items-center gap-4 md:w-48 shrink-0">
                    <span class="text-sm text-gray-700 font-mono font-bold">${n.published_date}</span>
                    <span class="${color} text-xs px-2 py-1 rounded font-bold">${n.category || ""}</span>
                </div>
                <span class="text-gray-800 font-medium flex-grow">${n.title}</span>
                <i data-news-icon="${idx}" class="fa-solid fa-chevron-down text-gray-400 text-sm transition-transform"></i>
            </button>
            <div data-news-detail="${idx}" class="hidden mt-2 mb-1 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 leading-relaxed">
                ${detailContent ? `<p class="whitespace-pre-line">${detailContent}</p>` : '<p class="text-gray-400">内容は準備中です。</p>'}
                ${detailRows ? `<ul class="mt-3 space-y-1">${detailRows}</ul>` : ""}
            </div>
        </li>`;
    }).join("");

    container.querySelectorAll("[data-news-toggle]").forEach(function(btn) {
        btn.addEventListener("click", function() {
            const idx = btn.getAttribute("data-news-toggle");
            const detail = container.querySelector('[data-news-detail="' + idx + '"]');
            const icon = container.querySelector('[data-news-icon="' + idx + '"]');
            if (!detail) return;
            detail.classList.toggle("hidden");
            if (icon) icon.classList.toggle("rotate-180");
        });
    });
}

document.addEventListener("DOMContentLoaded", function () {
    // ハンバーガーメニュー
    const btn = document.getElementById("mobile-menu-btn");
    const menu = document.getElementById("mobile-menu");
    const icon = btn.querySelector("i");
    btn.addEventListener("click", () => {
        menu.classList.toggle("hidden");
        icon.classList.toggle("fa-bars");
        icon.classList.toggle("fa-xmark");
    });
    menu.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => {
            menu.classList.add("hidden");
            icon.classList.remove("fa-xmark");
            icon.classList.add("fa-bars");
        });
    });

    // Supabaseからデータ読み込み
    loadHeroImage();
    loadGreeting();
    loadMembers();
    loadActivities();
    loadNews();
});