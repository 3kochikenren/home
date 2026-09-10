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

const KENREN_SLUG = "kochi";
let CURRENT_KENREN_ID = null;
async function getKenrenId() {
    if (CURRENT_KENREN_ID) return CURRENT_KENREN_ID;
    const rows = await fetchDB("kenren", "slug=eq." + KENREN_SLUG + "&select=id&limit=1");
    CURRENT_KENREN_ID = (rows && rows[0] && rows[0].id) || null;
    return CURRENT_KENREN_ID;
}

// 役員の役職名を、所属グループ（org_officer_groups）の定義に沿って正規化する
function normalizeOfficerRole(role, group) {
    const text = (role || "").trim();
    if (group.group_type === "fixed") return text;
    if (group.group_type === "branch") {
        const headRole = group.head_role_label || "支部長";
        return text === headRole ? headRole : (text || "役員");
    }
    return text || "県連役員";
}

// 役員紹介の要約タイル（県連会長＋各支部代表）を、組織構造マスターから動的に組み立てる
function renderOfficerSummaryTile(officers, groups) {
    const picks = [];
    const fixedGroup = (groups || []).find(function(g) { return g.group_type === "fixed"; });
    if (fixedGroup && fixedGroup.fixed_slots && fixedGroup.fixed_slots.length > 0) {
        const chairSlot = fixedGroup.fixed_slots[0];
        const item = (officers || []).find(function(o) {
            return o.group_id === fixedGroup.id && normalizeOfficerRole(o.role, fixedGroup) === chairSlot;
        }) || null;
        picks.push({ label: chairSlot, item: item });
    }
    (groups || []).filter(function(g) { return g.group_type === "branch"; })
        .sort(function(a, b) { return (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0); })
        .forEach(function(g) {
            const headRole = g.head_role_label || "支部長";
            const item = (officers || []).find(function(o) {
                return o.group_id === g.id && normalizeOfficerRole(o.role, g) === headRole;
            }) || null;
            picks.push({ label: g.label, item: item });
        });

    return `
        <section class="bg-white rounded-2xl border border-orange-200 shadow p-4 sm:p-6">
            <div class="grid gap-2 sm:gap-4" style="grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));">
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
        </section>
    `;
}

// ヒーロー画像を表示
async function loadHeroImage() {
    const kenrenId = await getKenrenId();
    const data = await fetchDB("settings", "key=eq.hero_image&kenren_id=eq." + kenrenId);
    if (!data || data.length === 0) return;
    const url = data[0].value;
    if (!url) return;
    const hero = document.getElementById("hero-section");
    if (hero) hero.style.backgroundImage = "url(" + url + ")";
}

// 役員紹介を表示（組織構造マスターに沿って県連会長＋各支部代表を表示）
async function loadGreeting() {
    const container = document.getElementById("greeting-container");
    if (!container) return;
    const kenrenId = await getKenrenId();
    const [groups, officers] = await Promise.all([
        fetchDB("org_officer_groups", "kenren_id=eq." + kenrenId + "&order=sort_order.asc"),
        fetchDB("greeting", "kenren_id=eq." + kenrenId + "&order=sort_order.asc")
    ]);
    container.innerHTML = renderOfficerSummaryTile(officers || [], groups || []);
}

// 議員情報を表示
async function loadMembers() {
    const kenrenId = await getKenrenId();
    const members = await fetchDB("members", "kenren_id=eq." + kenrenId + "&order=sort_order.asc");
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

    const renderCard = (m) => {
        const data = encodeURIComponent(JSON.stringify({
            photo_url: m.photo_url || "",
            name: m.name || "",
            role: m.role || "",
            plainBio: m.plainBio || ""
        }));
        return `
        <div class="hover-card bg-white border border-gray-100 rounded-xl p-4 shadow-md text-center cursor-pointer" onclick="openMemberModal(decodeURIComponent('${data}'))">
            <img src="${m.photo_url || 'https://placehold.co/200x200/f97316/ffffff?text=議員写真'}"
                 alt="${m.name}" class="w-20 h-20 rounded-full object-cover mx-auto mb-3 border-2 border-orange-100">
            <h3 class="text-base font-bold text-gray-800 mb-1">${m.name}</h3>
            <p class="text-secondary font-medium text-xs mb-2">${m.role || ""}</p>
        </div>`;
    };

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

    const topCandidatesSection = document.getElementById("top-candidates-section");
    const topCandidatesContainer = document.getElementById("top-candidates-container");
    if (topCandidatesSection && topCandidatesContainer) {
        if (candidates.length > 0) {
            topCandidatesSection.classList.remove("hidden");
            topCandidatesContainer.innerHTML = candidates.map(m => {
                const days = ["日", "月", "火", "水", "木", "金", "土"];
                let voteDateLabel = "";
                if (m.vote_date) {
                    const d = new Date(m.vote_date + "T00:00:00");
                    if (!Number.isNaN(d.getTime())) {
                        voteDateLabel = `${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`;
                    }
                }
                const electionLabel = [m.election_district, m.election_type].filter(Boolean).join(" ");
                return `
                <div class="bg-white rounded-2xl shadow-lg overflow-hidden border-2 border-red-200 text-center w-72">
                    ${m.photo_url ? `<img src="${m.photo_url}" alt="${m.name}" class="w-full h-56 object-cover object-top">` : `<div class="w-full h-56 bg-gray-100 flex items-center justify-center"><i class="fa-solid fa-user text-5xl text-gray-300"></i></div>`}
                    <div class="p-5">
                        ${voteDateLabel ? `<div class="inline-block bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-lg mb-3">投票日　${voteDateLabel}</div>` : ""}
                        ${electionLabel ? `<p class="text-gray-600 font-bold text-sm mb-2">${electionLabel}</p>` : ""}
                        <h3 class="text-xl font-black text-gray-800">${m.name}</h3>
                    </div>
                </div>`;
            }).join("");
        } else {
            topCandidatesSection.classList.add("hidden");
        }
    }

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
function formatActivityDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    if (Number.isNaN(d.getTime())) return dateStr;
    const days = ["日", "月", "火", "水", "木", "金", "土"];
    const toFull = function(n) {
        return String(n).replace(/[0-9]/g, function(c) {
            return String.fromCharCode(c.charCodeAt(0) + 0xFEE0);
        });
    };
    return toFull(d.getFullYear()) + "年" + toFull(d.getMonth() + 1) + "月" + toFull(d.getDate()) + "日（" + days[d.getDay()] + "）";
}

async function loadActivities() {
    const kenrenId = await getKenrenId();
    const activities = await fetchDB("activities", "kenren_id=eq." + kenrenId + "&is_published=eq.true&order=activity_date.desc&limit=21");
    const section = document.getElementById("activity");
    const container = document.getElementById("activities-container");
    if (!container || !section) return;
    if (!activities || activities.length === 0) {
        section.classList.add("hidden");
        container.innerHTML = "";
        return;
    }
    section.classList.remove("hidden");
    container.innerHTML = activities.map(a => {
        const thumb = a.photo_url || a.photo_url2 || a.photo_url3 || "";
        const imgHtml = thumb
            ? `<img src="${thumb}" alt="${a.title}" class="w-full h-48 object-cover">`
            : `<div class="w-full h-48 bg-gray-100 flex items-center justify-center"><i class="fa-solid fa-image text-4xl text-gray-300"></i></div>`;
        const dataAttr = encodeURIComponent(JSON.stringify(a));
        return `
        <div class="bg-white rounded-lg shadow overflow-hidden hover-card cursor-pointer" onclick="openActivityModal(decodeURIComponent('${dataAttr}'))">
            ${imgHtml}
            <div class="p-5">
                <span class="text-sm text-gray-500 mb-2 block">${formatActivityDate(a.activity_date)}</span>
                <h3 class="text-base font-bold text-gray-800 line-clamp-2">${a.title}</h3>
            </div>
        </div>`;
    }).join("");
}

function openMemberModal(jsonStr) {
    const m = typeof jsonStr === "string" ? JSON.parse(jsonStr) : jsonStr;
    const photo = document.getElementById("member-modal-photo");
    photo.src = m.photo_url || "https://placehold.co/200x200/f97316/ffffff?text=写真";
    photo.classList.toggle("hidden", !m.photo_url);
    document.getElementById("member-modal-name").textContent = m.name || "";
    document.getElementById("member-modal-role").textContent = m.role || "";
    document.getElementById("member-modal-bio").textContent = m.plainBio || "";
    document.getElementById("member-modal").classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

function closeMemberModal() {
    document.getElementById("member-modal").classList.add("hidden");
    document.body.style.overflow = "";
}

function openActivityModal(jsonStr) {
    const a = typeof jsonStr === "string" ? JSON.parse(jsonStr) : jsonStr;
    const photos = [a.photo_url, a.photo_url2, a.photo_url3].filter(Boolean);
    const photosHtml = photos.length > 0
        ? `<div class="flex flex-col gap-3">${photos.map(u => `<img src="${u}" alt="" class="w-full rounded-xl object-cover">`).join("")}</div>`
        : "";
    document.getElementById("activity-modal-date").textContent = formatActivityDate(a.activity_date);
    document.getElementById("activity-modal-title").textContent = a.title || "";
    document.getElementById("activity-modal-photos").innerHTML = photosHtml;
    const videoHtml = a.video_url
        ? `<a href="${a.video_url}" target="_blank" rel="noopener noreferrer" class="mt-4 flex items-center gap-2 text-sm font-bold text-orange-500 hover:text-orange-600 underline underline-offset-2">
               <i class="fa-solid fa-circle-play text-lg"></i>動画を見る
           </a>`
        : "";
    document.getElementById("activity-modal-content").innerHTML =
        `<p class="whitespace-pre-line text-gray-700 text-sm leading-relaxed">${a.content || ""}</p>${videoHtml}`;
    document.getElementById("activity-modal").classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

function closeActivityModal() {
    document.getElementById("activity-modal").classList.add("hidden");
    document.body.style.overflow = "";
}

let allAnnouncements = [];

async function loadAnnouncements() {
    const today = new Date().toISOString().slice(0, 10);
    const kenrenId = await getKenrenId();
    const data = await fetchDB("announcements", "kenren_id=eq." + kenrenId + "&is_published=eq.true&end_date=gte." + today + "&order=published_date.desc");
    const section = document.getElementById("announcements-section");
    const container = document.getElementById("announcements-container");
    if (!section || !container) return;
    if (!data || data.length === 0) { section.classList.add("hidden"); return; }
    section.classList.remove("hidden");
    allAnnouncements = data;
    const sizeMap = { xs: "0.75rem", sm: "0.875rem", base: "1rem", lg: "1.125rem", xl: "1.25rem", "2xl": "1.5rem" };
    const LINE_LIMIT = 5;
    container.innerHTML = data.map(function(a, idx) {
        const titleStyle = "color:" + (a.title_color || "#1f2937") + ";font-size:" + (sizeMap[a.title_size] || "1.125rem");
        const contentStyle = "color:" + (a.content_color || "#4b5563") + ";font-size:" + (sizeMap[a.content_size] || "0.875rem");
        const lines = (a.content || "").split("\n");
        const truncated = lines.slice(0, LINE_LIMIT).join("\n");
        const needsMore = lines.length > LINE_LIMIT;
        return `<div class="bg-white rounded-xl shadow border border-gray-100 overflow-hidden flex flex-col">
            ${a.image_url ? `<img src="${a.image_url}" alt="${a.title}" class="w-full h-44 object-cover">` : ""}
            <div class="p-5 flex flex-col flex-1">
                <p class="text-xs text-gray-400 mb-2">${a.published_date}</p>
                <h3 class="font-bold mb-3 leading-snug" style="${titleStyle}">${a.title}</h3>
                ${a.content ? `<p class="leading-relaxed whitespace-pre-line" style="${contentStyle}">${truncated}</p>` : ""}
                ${needsMore ? `<button onclick="openAnnouncementModal(${idx})" class="mt-3 text-left text-primary font-bold text-sm hover:underline inline-flex items-center gap-1">詳しくはこちら <i class="fa-solid fa-angle-right"></i></button>` : ""}
            </div>
        </div>`;
    }).join("");
}

function openAnnouncementModal(idx) {
    const a = allAnnouncements[idx];
    if (!a) return;
    const sizeMap = { xs: "0.75rem", sm: "0.875rem", base: "1rem", lg: "1.125rem", xl: "1.25rem", "2xl": "1.5rem" };
    const titleEl = document.getElementById("announcement-modal-title");
    titleEl.textContent = a.title;
    titleEl.style.color = a.title_color || "#1f2937";
    titleEl.style.fontSize = sizeMap[a.title_size] || "1.125rem";
    document.getElementById("announcement-modal-date").textContent = a.published_date || "";
    const contentEl = document.getElementById("announcement-modal-content");
    contentEl.textContent = a.content || "";
    contentEl.style.color = a.content_color || "#4b5563";
    contentEl.style.fontSize = sizeMap[a.content_size] || "0.875rem";
    const imgEl = document.getElementById("announcement-modal-image");
    if (a.image_url) { imgEl.src = a.image_url; imgEl.classList.remove("hidden"); }
    else { imgEl.classList.add("hidden"); }
    const linkEl = document.getElementById("announcement-modal-link");
    if (a.link_url && a.link_title) {
        linkEl.href = a.link_url;
        linkEl.textContent = a.link_title;
        linkEl.classList.remove("hidden");
    } else { linkEl.classList.add("hidden"); }
    document.getElementById("announcement-modal").classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

function closeAnnouncementModal() {
    document.getElementById("announcement-modal").classList.add("hidden");
    document.body.style.overflow = "";
}

const NEWS_DEFAULT_COUNT = 3;
let allSortedNews = [];

function toggleNewsList(e) {
    e.preventDefault();
    const container = document.getElementById("news-container");
    const link = document.getElementById("news-toggle-link");
    const isExpanded = container.dataset.expanded === "true";
    if (isExpanded) {
        renderNewsList(allSortedNews.slice(0, NEWS_DEFAULT_COUNT));
        container.dataset.expanded = "false";
        link.innerHTML = 'イベント一覧を見る <i class="fa-solid fa-angle-right"></i>';
    } else {
        renderNewsList(allSortedNews);
        container.dataset.expanded = "true";
        link.innerHTML = '閉じる <i class="fa-solid fa-angle-up"></i>';
    }
}

// お知らせ・イベントを表示（統合）
async function loadNews() {
    const kenrenId = await getKenrenId();
    const newsList = await fetchDB("news", "kenren_id=eq." + kenrenId + "&is_published=eq.true&order=published_date.asc&limit=200");
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

    allSortedNews = sortedNews;

    const link = document.getElementById("news-toggle-link");
    if (link) {
        link.classList.toggle("hidden", sortedNews.length <= NEWS_DEFAULT_COUNT);
    }

    renderNewsList(sortedNews.slice(0, NEWS_DEFAULT_COUNT));
}

function renderNewsList(list) {
    const container = document.getElementById("news-container");
    if (!container) return;

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

    container.innerHTML = list.map((n, idx) => {
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
    loadAnnouncements();
    loadNews();
});