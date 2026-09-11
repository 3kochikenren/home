// SUPABASE_URL / SUPABASE_KEY / KENREN_SLUG は branding.js（先に読み込み）で定義済み
async function fetchDB(table, query = "") {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
        headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`
        }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
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

let CURRENT_KENREN_ID = null;
let CURRENT_KENREN_PREFECTURE_NAME = null;
async function getKenrenId() {
    if (CURRENT_KENREN_ID) return CURRENT_KENREN_ID;
    const rows = await fetchDB("kenren", "slug=eq." + encodeURIComponent(KENREN_SLUG) + "&select=id,prefecture_name&limit=1");
    const row = rows && rows[0];
    CURRENT_KENREN_ID = row ? row.id : null;
    CURRENT_KENREN_PREFECTURE_NAME = row ? row.prefecture_name : null;
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

// 役員1名分のカード（県連役員タイル・支部役員タイルで共通利用）
function renderPublicOfficerCard(item, roleText, empty) {
    const photo = (!empty && item && item.photo_url) ? item.photo_url : "https://placehold.co/200x200/fdf2e8/f97316?text=写真";
    const name = (!empty && item && item.name) ? item.name : "未登録";
    const content = (!empty && item && item.content) ? `<p class="text-xs text-gray-600 leading-relaxed mt-2 text-left">${item.content}</p>` : "";
    return `
        <article class="bg-white rounded-xl shadow-sm border border-orange-100 p-4 text-center ${empty ? "border-dashed bg-gray-50 opacity-60" : ""}">
            <img src="${photo}" alt="${name}" class="w-28 h-28 rounded-full object-cover mx-auto mb-3 border-4 border-orange-100 shadow-sm">
            <p class="text-xs font-bold text-orange-500 mb-1">${roleText}</p>
            <h3 class="text-base font-black text-gray-900 leading-tight">${name}</h3>
            ${content}
        </article>
    `;
}

// 1つの役員グループ（県連4役／県連役員／各支部）をカード群として描画する
function renderOfficerGroupSection(group, officers) {
    const items = (officers || []).filter(function(o) { return o.group_id === group.id; });
    let bodyHtml = "";
    if (group.group_type === "fixed") {
        const byRole = new Map();
        items.forEach(function(item) { byRole.set(normalizeOfficerRole(item.role, group), item); });
        bodyHtml = (group.fixed_slots || []).map(function(slot) {
            const item = byRole.get(slot);
            return item ? renderPublicOfficerCard(item, slot, false) : renderPublicOfficerCard(null, slot, true);
        }).join("");
    } else if (group.group_type === "branch") {
        const headRole = group.head_role_label || "支部長";
        const head = items.find(function(item) { return normalizeOfficerRole(item.role, group) === headRole; }) || null;
        const others = items.filter(function(item) { return normalizeOfficerRole(item.role, group) !== headRole; })
            .sort(function(a, b) { return (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0); });
        bodyHtml = renderPublicOfficerCard(head, headRole, !head) +
            others.map(function(item) { return renderPublicOfficerCard(item, normalizeOfficerRole(item.role, group), false); }).join("");
    } else {
        const sorted = items.slice().sort(function(a, b) { return (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0); });
        if (sorted.length === 0) return "";
        bodyHtml = sorted.map(function(item) { return renderPublicOfficerCard(item, normalizeOfficerRole(item.role, group), false); }).join("");
    }
    if (!bodyHtml) return "";
    return `
        <div>
            <div class="flex items-center justify-center gap-3 mb-5">
                <div class="h-px flex-1 bg-gradient-to-r from-transparent via-orange-200 to-transparent"></div>
                <h3 class="text-lg font-black text-gray-800 whitespace-nowrap">${group.label}</h3>
                <div class="h-px flex-1 bg-gradient-to-r from-transparent via-orange-200 to-transparent"></div>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">${bodyHtml}</div>
        </div>
    `;
}

// ヒーロー画像を表示
async function loadHeroImage() {
    const kenrenId = await getKenrenId();
    const data = await fetchDB("settings", "key=eq.hero_image&kenren_id=eq." + kenrenId);
    const url = data && data[0] && data[0].value;
    const overlay = document.getElementById("hero-overlay");
    if (!url) {
        // 写真未設定: ブランドカラーの既定背景をそのまま見せる（黒オーバーレイは不要）
        return;
    }
    const hero = document.getElementById("hero-section");
    if (hero) hero.style.backgroundImage = "url(" + url + ")";
    // 写真がある場合のみ、文字を読みやすくする黒オーバーレイを表示する
    if (overlay) overlay.classList.remove("hidden");
}

// 県連役員タイル（県連4役＋県連役員）
async function loadOfficersKenrenTile() {
    const container = document.getElementById("officers-kenren-container");
    if (!container) return;
    const kenrenId = await getKenrenId();
    const [groups, officers] = await Promise.all([
        fetchDB("org_officer_groups", "kenren_id=eq." + kenrenId + "&group_type=in.(fixed,multi)&order=sort_order.asc"),
        fetchDB("greeting", "kenren_id=eq." + kenrenId + "&is_published=eq.true&order=sort_order.asc")
    ]);
    const html = (groups || []).map(function(g) { return renderOfficerGroupSection(g, officers); }).filter(Boolean).join('<div class="h-4"></div>');
    container.innerHTML = html || '<p class="text-center text-gray-400">役員情報は準備中です。</p>';
}

// 支部役員タイル（各支部）
async function loadOfficersBranchTile() {
    const container = document.getElementById("officers-branch-container");
    if (!container) return;
    const kenrenId = await getKenrenId();
    const [groups, officers] = await Promise.all([
        fetchDB("org_officer_groups", "kenren_id=eq." + kenrenId + "&group_type=eq.branch&order=sort_order.asc"),
        fetchDB("greeting", "kenren_id=eq." + kenrenId + "&is_published=eq.true&order=sort_order.asc")
    ]);
    const html = (groups || []).map(function(g) { return renderOfficerGroupSection(g, officers); }).filter(Boolean).join('<div class="h-4"></div>');
    container.innerHTML = html || '<p class="text-center text-gray-400">支部役員情報は準備中です。</p>';
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
    const newsList = await fetchDB("news", "kenren_id=eq." + kenrenId + "&is_published=eq.true&show_in_events=eq.true&order=published_date.asc&limit=200");
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

// ===== ホーム画面のタイル表示 =====
// 各タイル種別の外枠HTML（読み込み中プレースホルダー込み）。
// 実データはこの枠を挿入した後、対応するローダー関数が埋める。
const TILE_SECTIONS = {
    events: function() {
        return `
        <section id="news" class="py-16 bg-white">
            <div class="container mx-auto px-4 max-w-4xl">
                <div class="text-center mb-10">
                    <h2 class="text-3xl font-bold section-title">イベント</h2>
                </div>
                <div class="bg-gray-50 rounded-lg p-6 shadow-inner">
                    <ul id="news-container" class="divide-y divide-gray-200">
                        <li class="py-6 text-center text-gray-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>読み込み中...</li>
                    </ul>
                </div>
                <div class="text-center mt-6">
                    <a id="news-toggle-link" href="#" onclick="toggleNewsList(event)" class="text-primary hover:underline font-medium inline-flex items-center gap-1">
                        イベント一覧を見る <i class="fa-solid fa-angle-right"></i>
                    </a>
                </div>
            </div>
        </section>`;
    },
    announcements: function() {
        return `
        <section id="announcements-section" class="py-14 bg-white border-t border-gray-100">
            <div class="container mx-auto px-4 max-w-6xl">
                <h2 class="text-2xl font-bold text-center text-gray-800 mb-2">お知らせ</h2>
                <div class="w-12 h-1 bg-primary rounded mx-auto mb-10"></div>
                <div id="announcements-container" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <p class="col-span-full text-center text-gray-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>読み込み中...</p>
                </div>
            </div>
        </section>`;
    },
    officers_kenren: function() {
        return `
        <section id="about" class="py-20 bg-gray-50">
            <div class="container mx-auto px-4 max-w-6xl">
                <div class="text-center mb-16">
                    <h2 class="text-3xl font-bold section-title">県連役員</h2>
                </div>
                <div id="officers-kenren-container" class="space-y-10">
                    <p class="text-center text-gray-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>読み込み中...</p>
                </div>
            </div>
        </section>`;
    },
    officers_branch: function() {
        return `
        <section id="branch-officers" class="py-20 bg-white">
            <div class="container mx-auto px-4 max-w-6xl">
                <div class="text-center mb-16">
                    <h2 class="text-3xl font-bold section-title">支部役員</h2>
                </div>
                <div id="officers-branch-container" class="space-y-10">
                    <p class="text-center text-gray-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>読み込み中...</p>
                </div>
            </div>
        </section>`;
    },
    members: function() {
        const membersHeading = (CURRENT_KENREN_PREFECTURE_NAME || "") + "所属議員";
        return `
        <section id="policy" class="py-20 bg-white">
            <div class="container mx-auto px-4 max-w-4xl">
                <div class="text-center mb-16">
                    <h2 class="text-3xl font-bold section-title">${membersHeading}</h2>
                </div>
                <div id="members-container" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <p class="md:col-span-2 text-center text-gray-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>読み込み中...</p>
                </div>
                <div id="candidates-section" class="mt-16">
                    <div class="text-center mb-10">
                        <h3 class="text-2xl font-bold text-gray-800">公認候補者の紹介</h3>
                        <p class="mt-3 text-gray-600">地域の未来に向けて活動する公認候補者を表示します。</p>
                    </div>
                    <div id="candidates-container" class="grid grid-cols-1 md:grid-cols-2 gap-12"></div>
                </div>
                <div id="reformers-section" class="mt-16">
                    <div class="text-center mb-10">
                        <h3 class="text-2xl font-bold text-gray-800">改革委員の紹介</h3>
                    </div>
                    <div id="reformers-container" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"></div>
                </div>
            </div>
        </section>`;
    },
    activities: function() {
        return `
        <section id="activity" class="py-20 bg-gray-50">
            <div class="container mx-auto px-4 max-w-6xl">
                <div class="text-center mb-16">
                    <h2 class="text-3xl font-bold section-title">活動報告</h2>
                </div>
                <div id="activities-container" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div class="bg-white rounded-lg shadow overflow-hidden p-6 text-center text-gray-400">
                        <i class="fa-solid fa-spinner fa-spin text-2xl mb-3"></i>
                        <p class="text-sm">活動報告を読み込み中です...</p>
                    </div>
                </div>
                <div class="text-center mt-10">
                    <a href="activities.html" class="inline-block border-2 border-primary text-primary font-bold px-8 py-3 rounded-full hover:bg-primary hover:text-white transition">
                        活動報告をもっと見る
                    </a>
                </div>
            </div>
        </section>`;
    },
    recruiting: function(tile) {
        const cfg = tile.config || {};
        const title = cfg.title || "募集のご案内";
        const description = cfg.description || "";
        const linkUrl = cfg.link_url || "contact.html";
        const linkLabel = cfg.link_label || "お問い合わせ";
        return `
        <section class="py-16 bg-gradient-to-br from-orange-50 to-amber-50">
            <div class="container mx-auto px-4 max-w-3xl text-center">
                <h2 class="text-2xl md:text-3xl font-black text-gray-900 mb-4">${title}</h2>
                ${description ? `<p class="text-gray-700 mb-8 whitespace-pre-line leading-relaxed">${description}</p>` : ""}
                <a href="${linkUrl}" class="inline-block bg-primary text-white font-bold px-8 py-4 rounded-full hover:bg-orange-700 transition shadow-md">${linkLabel}</a>
            </div>
        </section>`;
    },
    event_highlight: function(tile) {
        return `
        <section id="event-highlight-${tile.id}" class="hidden py-16 bg-white border-t border-gray-100">
            <div class="container mx-auto px-4 max-w-3xl">
                <div id="event-highlight-${tile.id}-container">
                    <p class="text-center text-gray-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>読み込み中...</p>
                </div>
            </div>
        </section>`;
    },
    election_support: function(tile) {
        const cfg = tile.config || {};
        const heading = cfg.heading || "選挙中の公認候補者　応援をお願いします！";
        return `
        <section id="election-support-${tile.id}" class="hidden py-14 bg-red-50 border-b-4 border-red-400">
            <div class="container mx-auto px-4 max-w-5xl">
                <h2 class="text-2xl font-black text-center text-red-700 mb-10">${heading}</h2>
                <div id="election-support-${tile.id}-container" class="flex flex-wrap justify-center gap-8"></div>
            </div>
        </section>`;
    },
    event_calendar: function(tile) {
        return `
        <section id="event-calendar-${tile.id}" class="py-16 bg-white border-t border-gray-100">
            <div class="container mx-auto px-4 max-w-5xl">
                <div id="event-calendar-${tile.id}-description" class="mb-6 text-sm text-gray-600 whitespace-pre-line"></div>
                <div id="event-calendar-${tile.id}-toggle-wrap" class="hidden text-center mb-6">
                    <button onclick="toggleEventCalendar('${tile.id}')" class="text-primary hover:underline font-bold inline-flex items-center gap-1">
                        <span id="event-calendar-${tile.id}-toggle-label">イベントカレンダーを見る</span> <i id="event-calendar-${tile.id}-toggle-icon" class="fa-solid fa-angle-down transition-transform"></i>
                    </button>
                </div>
                <div id="event-calendar-${tile.id}-body">
                    <div class="flex items-center justify-between mb-4">
                        <h2 class="text-2xl font-bold section-title">イベントカレンダー</h2>
                        <div class="flex items-center gap-2">
                            <button onclick="shiftCalendarMonth('${tile.id}', -1)" class="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center"><i class="fa-solid fa-chevron-left"></i></button>
                            <span id="event-calendar-${tile.id}-month-label" class="font-bold text-base w-24 text-center"></span>
                            <button onclick="shiftCalendarMonth('${tile.id}', 1)" class="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center"><i class="fa-solid fa-chevron-right"></i></button>
                        </div>
                    </div>
                    <div id="event-calendar-${tile.id}-grid" class="overflow-x-auto"></div>
                </div>
            </div>
        </section>`;
    },
    event_carousel: function(tile) {
        return `
        <section id="event-carousel-${tile.id}" class="hidden py-16 bg-gray-50">
            <div class="container mx-auto px-4 max-w-3xl">
                <h2 class="text-2xl font-bold section-title text-center mb-10">イベント</h2>
                <div class="relative rounded-2xl overflow-hidden shadow-lg bg-white">
                    <div id="event-carousel-${tile.id}-slide"></div>
                    <button onclick="shiftCarousel('${tile.id}', -1)" class="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center"><i class="fa-solid fa-chevron-left"></i></button>
                    <button onclick="shiftCarousel('${tile.id}', 1)" class="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center"><i class="fa-solid fa-chevron-right"></i></button>
                </div>
                <div id="event-carousel-${tile.id}-dots" class="flex items-center justify-center gap-2 mt-4"></div>
            </div>
        </section>`;
    }
};

// ===== イベントカレンダー =====
const calendarState = {};
const newsEventCache = {}; // id -> newsレコード（カレンダー・カルーセル共通の詳細モーダルで使う）

function toggleEventCalendar(tileId) {
    const body = document.getElementById("event-calendar-" + tileId + "-body");
    const icon = document.getElementById("event-calendar-" + tileId + "-toggle-icon");
    const label = document.getElementById("event-calendar-" + tileId + "-toggle-label");
    if (!body) return;
    const willShow = body.classList.contains("hidden");
    body.classList.toggle("hidden");
    if (icon) icon.classList.toggle("rotate-180", willShow);
    if (label) label.textContent = willShow ? "イベントカレンダーを閉じる" : "イベントカレンダーを見る";
}

function shiftCalendarMonth(tileId, delta) {
    const st = calendarState[tileId];
    if (!st) return;
    st.month += delta;
    if (st.month < 0) { st.month = 11; st.year -= 1; }
    if (st.month > 11) { st.month = 0; st.year += 1; }
    renderCalendarGrid(tileId);
}

function renderCalendarGrid(tileId) {
    const st = calendarState[tileId];
    const grid = document.getElementById("event-calendar-" + tileId + "-grid");
    const label = document.getElementById("event-calendar-" + tileId + "-month-label");
    if (!st || !grid) return;
    if (label) label.textContent = st.year + "年" + (st.month + 1) + "月";

    const firstDay = new Date(st.year, st.month, 1);
    const startWeekday = (firstDay.getDay() + 6) % 7; // 月曜始まり
    const daysInMonth = new Date(st.year, st.month + 1, 0).getDate();
    const todayStr = new Date().toISOString().slice(0, 10);

    const eventsByDate = {};
    (st.events || []).forEach(function(e) {
        if (!e.published_date) return;
        if (!eventsByDate[e.published_date]) eventsByDate[e.published_date] = [];
        eventsByDate[e.published_date].push(e);
    });

    const weekdayLabels = ["月", "火", "水", "木", "金", "土", "日"];
    let html = '<div class="grid grid-cols-7 border-t border-l border-gray-200 min-w-[560px]">';
    weekdayLabels.forEach(function(w, i) {
        html += '<div class="border-r border-b border-gray-200 bg-orange-50 text-center text-xs font-bold py-2 ' + (i === 5 ? "text-blue-600" : i === 6 ? "text-red-600" : "text-gray-600") + '">' + w + '</div>';
    });

    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
    for (let i = 0; i < totalCells; i++) {
        const dayNum = i - startWeekday + 1;
        if (dayNum < 1 || dayNum > daysInMonth) {
            html += '<div class="border-r border-b border-gray-200 bg-gray-50 min-h-[90px]"></div>';
            continue;
        }
        const dateStr = st.year + "-" + String(st.month + 1).padStart(2, "0") + "-" + String(dayNum).padStart(2, "0");
        const isToday = dateStr === todayStr;
        const dayEvents = eventsByDate[dateStr] || [];
        html += '<div class="border-r border-b border-gray-200 min-h-[90px] p-1">' +
            '<div class="text-xs font-bold mb-1 ' + (isToday ? "inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white" : "text-gray-500") + '">' + dayNum + '</div>' +
            dayEvents.map(function(e) {
                return '<button type="button" onclick="openCalendarEventModal(\'' + e.id + '\')" class="block w-full text-left truncate text-[11px] leading-tight px-1 py-0.5 mb-0.5 rounded hover:bg-orange-100 text-gray-700">' + (e.title || "") + '</button>';
            }).join("") +
            '</div>';
    }
    html += '</div>';
    grid.innerHTML = html;
}

async function loadEventCalendarTile(tile) {
    const kenrenId = await getKenrenId();
    const cfg = tile.config || {};
    const descEl = document.getElementById("event-calendar-" + tile.id + "-description");
    if (descEl) descEl.textContent = cfg.description || "";

    const toggleWrap = document.getElementById("event-calendar-" + tile.id + "-toggle-wrap");
    const body = document.getElementById("event-calendar-" + tile.id + "-body");
    if (cfg.display_mode === "toggle") {
        if (toggleWrap) toggleWrap.classList.remove("hidden");
        if (body) body.classList.add("hidden");
    } else {
        if (toggleWrap) toggleWrap.classList.add("hidden");
        if (body) body.classList.remove("hidden");
    }

    const events = await fetchDB("news", "kenren_id=eq." + kenrenId + "&is_published=eq.true&show_in_calendar=eq.true&order=published_date.asc&limit=500");
    const now = new Date();
    calendarState[tile.id] = { year: now.getFullYear(), month: now.getMonth(), events: events || [] };
    (events || []).forEach(function(e) { newsEventCache[e.id] = e; });
    renderCalendarGrid(tile.id);
}

function formatCalendarTimeHM(value) {
    if (!value) return "";
    const text = String(value).trim();
    const m = text.match(/^(\d{1,2}):(\d{2})/);
    return m ? m[1].padStart(2, "0") + ":" + m[2] : text;
}

function openCalendarEventModal(eventId) {
    const found = newsEventCache[eventId];
    if (!found) return;
    const categoryColors = {
        "イベント": "bg-orange-100 text-orange-700",
        "活動報告": "bg-green-100 text-green-800",
        "重要": "bg-red-100 text-red-800",
        "その他": "bg-gray-100 text-gray-600"
    };
    const categoryEl = document.getElementById("calendar-event-modal-category");
    categoryEl.textContent = found.category || "";
    categoryEl.className = "text-xs px-2 py-1 rounded font-bold " + (categoryColors[found.category] || "bg-gray-100 text-gray-600");
    const photoEl = document.getElementById("calendar-event-modal-photo");
    if (photoEl) {
        if (found.photo_url) { photoEl.src = found.photo_url; photoEl.classList.remove("hidden"); }
        else { photoEl.classList.add("hidden"); }
    }
    document.getElementById("calendar-event-modal-date").textContent = found.published_date || "";
    document.getElementById("calendar-event-modal-title").textContent = found.title || "";
    document.getElementById("calendar-event-modal-content").textContent = found.content || "";

    const detailRows = [];
    if (found.reception_time) detailRows.push("受付時間: " + formatCalendarTimeHM(found.reception_time));
    if (found.start_time || found.end_time) {
        detailRows.push("時間: " + formatCalendarTimeHM(found.start_time) + (found.end_time ? " - " + formatCalendarTimeHM(found.end_time) : ""));
    }
    if (found.venue_name) detailRows.push("会場名: " + found.venue_name);
    if (found.venue_address) detailRows.push("会場住所: " + found.venue_address);
    if (found.target_audience) detailRows.push("対象者: " + found.target_audience);
    if (found.participation_fee) detailRows.push("参加費: " + found.participation_fee);
    const detailsEl = document.getElementById("calendar-event-modal-details");
    detailsEl.innerHTML = detailRows.map(function(r) { return "<li>" + r + "</li>"; }).join("");
    if (found.application_url) {
        detailsEl.innerHTML += '<li><a href="' + found.application_url + '" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline break-all">申込URL: ' + found.application_url + '</a></li>';
    }
    document.getElementById("calendar-event-modal").classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

function closeCalendarEventModal() {
    document.getElementById("calendar-event-modal").classList.add("hidden");
    document.body.style.overflow = "";
}

// ===== イベントカルーセル =====
const carouselState = {};

function renderCarouselSlide(tileId) {
    const st = carouselState[tileId];
    const slideEl = document.getElementById("event-carousel-" + tileId + "-slide");
    const dotsEl = document.getElementById("event-carousel-" + tileId + "-dots");
    if (!st || !slideEl) return;
    const e = st.events[st.index];
    if (!e) return;
    slideEl.innerHTML = `
        <div onclick="openCalendarEventModal('${e.id}')" class="cursor-pointer">
            <img src="${e.photo_url}" alt="${e.title || ""}" class="w-full h-64 sm:h-80 object-cover">
            <div class="p-5">
                <p class="text-xs text-gray-400 font-mono mb-1">${e.published_date || ""}</p>
                <h3 class="font-bold text-gray-800">${e.title || ""}</h3>
            </div>
        </div>
    `;
    if (dotsEl) {
        dotsEl.innerHTML = st.events.map(function(_, i) {
            return '<span class="w-2 h-2 rounded-full ' + (i === st.index ? "bg-primary" : "bg-gray-300") + '"></span>';
        }).join("");
    }
}

function shiftCarousel(tileId, delta) {
    const st = carouselState[tileId];
    if (!st || st.events.length === 0) return;
    st.index = (st.index + delta + st.events.length) % st.events.length;
    renderCarouselSlide(tileId);
    resetCarouselAutoplay(tileId);
}

function resetCarouselAutoplay(tileId) {
    const st = carouselState[tileId];
    if (!st) return;
    if (st.timer) clearInterval(st.timer);
    if (st.events.length > 1) {
        st.timer = setInterval(function() { shiftCarouselAuto(tileId); }, 6000);
    }
}

function shiftCarouselAuto(tileId) {
    const st = carouselState[tileId];
    if (!st || st.events.length === 0) return;
    st.index = (st.index + 1) % st.events.length;
    renderCarouselSlide(tileId);
}

async function loadEventCarouselTile(tile) {
    const section = document.getElementById("event-carousel-" + tile.id);
    if (!section) return;
    const kenrenId = await getKenrenId();
    const today = new Date().toISOString().slice(0, 10);
    const events = (await fetchDB("news", "kenren_id=eq." + kenrenId + "&is_published=eq.true&show_in_carousel=eq.true&published_date=gte." + today + "&order=published_date.asc&limit=50"))
        .filter(function(e) { return !!e.photo_url; });
    if (events.length === 0) { section.classList.add("hidden"); return; }
    section.classList.remove("hidden");
    events.forEach(function(e) { newsEventCache[e.id] = e; });
    carouselState[tile.id] = { events: events, index: 0, timer: null };
    renderCarouselSlide(tile.id);
    resetCarouselAutoplay(tile.id);
}

// イベント紹介タイル: 指定イベント（未指定・削除済みなら直近の公開イベント）を大きく紹介
async function loadEventHighlightTile(tile) {
    const section = document.getElementById("event-highlight-" + tile.id);
    const container = document.getElementById("event-highlight-" + tile.id + "-container");
    if (!section || !container) return;
    const kenrenId = await getKenrenId();
    const cfg = tile.config || {};
    let picked = null;
    if (cfg.news_id) {
        const rows = await fetchDB("news", "id=eq." + encodeURIComponent(cfg.news_id) + "&kenren_id=eq." + kenrenId + "&is_published=eq.true");
        picked = rows && rows[0] ? rows[0] : null;
    }
    if (!picked) {
        const today = new Date().toISOString().slice(0, 10);
        const rows = await fetchDB("news", "kenren_id=eq." + kenrenId + "&is_published=eq.true&published_date=gte." + today + "&order=published_date.asc&limit=1");
        picked = rows && rows[0] ? rows[0] : null;
    }
    if (!picked) { section.classList.add("hidden"); return; }
    section.classList.remove("hidden");
    const formatTimeHM = function(value) {
        if (!value) return "";
        const text = String(value).trim();
        const m = text.match(/^(\d{1,2}):(\d{2})/);
        return m ? m[1].padStart(2, "0") + ":" + m[2] : text;
    };
    const detailRows = [];
    if (picked.start_time) detailRows.push(`<li><span class="font-bold text-gray-700">開始時間:</span> ${formatTimeHM(picked.start_time)}</li>`);
    if (picked.venue_name) detailRows.push(`<li><span class="font-bold text-gray-700">会場名:</span> ${picked.venue_name}</li>`);
    if (picked.venue_address) detailRows.push(`<li><span class="font-bold text-gray-700">会場住所:</span> ${picked.venue_address}</li>`);
    if (picked.participation_fee) detailRows.push(`<li><span class="font-bold text-gray-700">参加費:</span> ${picked.participation_fee}</li>`);
    const applyHtml = picked.application_url
        ? `<a href="${picked.application_url}" target="_blank" rel="noopener noreferrer" class="inline-block mt-6 bg-primary text-white font-bold px-8 py-3 rounded-full hover:bg-orange-700 transition">お申し込みはこちら</a>`
        : "";
    container.innerHTML = `
        <div class="bg-gray-50 rounded-2xl shadow-inner p-8 text-center">
            <p class="text-sm text-orange-500 font-bold mb-2">注目のイベント</p>
            <p class="text-sm text-gray-500 font-mono mb-3">${picked.published_date}</p>
            <h2 class="text-2xl font-black text-gray-900 mb-4">${picked.title}</h2>
            ${picked.content ? `<p class="text-gray-700 leading-relaxed whitespace-pre-line text-left max-w-xl mx-auto mb-4">${picked.content}</p>` : ""}
            ${detailRows.length ? `<ul class="text-left max-w-xl mx-auto space-y-1 text-sm text-gray-600">${detailRows.join("")}</ul>` : ""}
            ${applyHtml}
        </div>
    `;
}

// 選挙タイル: 選挙中（member_type=候補者）の議員候補への応援バナー
async function loadElectionSupportTile(tile) {
    const section = document.getElementById("election-support-" + tile.id);
    const container = document.getElementById("election-support-" + tile.id + "-container");
    if (!section || !container) return;
    const kenrenId = await getKenrenId();
    const members = await fetchDB("members", "kenren_id=eq." + kenrenId + "&member_type=eq." + encodeURIComponent("候補者") + "&is_deleted=eq.false&order=sort_order.asc");
    if (!members || members.length === 0) { section.classList.add("hidden"); return; }
    section.classList.remove("hidden");
    const days = ["日", "月", "火", "水", "木", "金", "土"];
    container.innerHTML = members.map(function(m) {
        let voteDateLabel = "";
        if (m.vote_date) {
            const d = new Date(m.vote_date + "T00:00:00");
            if (!Number.isNaN(d.getTime())) voteDateLabel = `${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`;
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
}

const TILE_LOADERS = {
    events: loadNews,
    announcements: loadAnnouncements,
    officers_kenren: loadOfficersKenrenTile,
    officers_branch: loadOfficersBranchTile,
    members: loadMembers,
    activities: loadActivities,
    event_highlight: loadEventHighlightTile,
    election_support: loadElectionSupportTile,
    event_calendar: loadEventCalendarTile,
    event_carousel: loadEventCarouselTile
};

// admin.htmlの「ホーム画面構成」で選ばれた順番・表示設定に沿って
// トップページのコンポーネントを組み立てる
async function loadHomeTiles() {
    const container = document.getElementById("home-tiles");
    if (!container) return;
    const kenrenId = await getKenrenId();
    if (!kenrenId) { container.innerHTML = ""; return; }
    const tiles = await fetchDB("kenren_home_tiles", "kenren_id=eq." + kenrenId + "&is_visible=eq.true&order=sort_order.asc");
    const knownTiles = (tiles || []).filter(function(t) { return TILE_SECTIONS[t.tile_type]; });
    if (knownTiles.length === 0) { container.innerHTML = ""; return; }

    const wrapper = document.createElement("div");
    knownTiles.forEach(function(tile) {
        wrapper.insertAdjacentHTML("beforeend", TILE_SECTIONS[tile.tile_type](tile));
    });
    container.innerHTML = "";
    while (wrapper.firstChild) container.appendChild(wrapper.firstChild);

    knownTiles.forEach(function(tile) {
        const loaderFn = TILE_LOADERS[tile.tile_type];
        if (loaderFn) loaderFn(tile);
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
    loadHomeTiles();
});