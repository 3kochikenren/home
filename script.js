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

// ご挨拶を表示（3名）
async function loadGreeting() {
    const data = await fetchDB("greeting", "order=sort_order.asc");
    const container = document.getElementById("greeting-container");
    if (!container || !data || data.length === 0) return;
    container.innerHTML = data.map(g => `
        <div class="bg-white rounded-2xl shadow-md p-8 flex flex-col items-center text-center hover:shadow-lg transition">
            <img src="${g.photo_url || "https://placehold.co/200x200/fff7ed/f97316?text=写真"}"
                 alt="${g.name || ""}" class="w-32 h-32 rounded-full object-cover border-4 border-orange-100 mb-4">
            <p class="text-sm font-bold text-orange-500 mb-1">${g.position_label || ""}</p>
            <h3 class="text-xl font-bold text-gray-800 mb-3">${g.name || ""}</h3>
            <p class="text-sm font-bold text-gray-600 mb-3">${g.role || ""}</p>
            <p class="text-gray-600 text-sm leading-relaxed text-left">${g.content || ""}</p>
        </div>
    `).join("");
}

// 議員情報を表示
async function loadMembers() {
    const members = await fetchDB("members", "order=sort_order.asc");
    const container = document.getElementById("members-container");
    if (!container || members.length === 0) return;
    container.innerHTML = members.map(m => `
        <div class="hover-card bg-white border border-gray-100 rounded-xl p-8 shadow-md text-center">
            <img src="${m.photo_url || 'https://placehold.co/200x200/f97316/ffffff?text=議員写真'}"
                 alt="${m.name}" class="w-40 h-40 rounded-full object-cover mx-auto mb-6 border-4 border-orange-100">
            <h3 class="text-xl font-bold text-gray-800 mb-1">${m.name}</h3>
            <p class="text-secondary font-medium text-sm mb-4">${m.role || ""}</p>
            <p class="text-gray-600 text-sm leading-relaxed text-left">${m.bio || ""}</p>
        </div>
    `).join("");
}

// イベント（削除済み - お知らせに統合）

// 活動報告を表示
async function loadActivities() {
    const activities = await fetchDB("activities", "is_published=eq.true&order=activity_date.desc&limit=3");
    const container = document.getElementById("activities-container");
    if (!container || activities.length === 0) return;
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
    const newsList = await fetchDB("news", "is_published=eq.true&order=published_date.desc&limit=10");
    const container = document.getElementById("news-container");
    if (!container) return;
    if (!newsList || newsList.length === 0) {
        container.innerHTML = `<li class="py-6 text-center text-gray-400">お知らせはありません</li>`;
        return;
    }
    const categoryColors = {
        "イベント": "bg-blue-100 text-blue-800",
        "活動報告": "bg-green-100 text-green-800",
        "重要": "bg-red-100 text-red-800",
        "その他": "bg-gray-100 text-gray-600"
    };
    container.innerHTML = newsList.map(n => {
        const color = categoryColors[n.category] || "bg-gray-100 text-gray-600";
        return `
        <li class="py-4 flex flex-col md:flex-row md:items-center gap-2 md:gap-6 hover:bg-gray-100 transition px-2 rounded">
            <div class="flex items-center gap-4 md:w-48 shrink-0">
                <span class="text-sm text-gray-700 font-mono font-bold">${n.published_date}</span>
                <span class="${color} text-xs px-2 py-1 rounded font-bold">${n.category || ""}</span>
            </div>
            <span class="text-gray-800 font-medium flex-grow">${n.title}</span>
        </li>`;
    }).join("");
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
    loadGreeting();
    loadMembers();
    loadActivities();
    loadNews();
});