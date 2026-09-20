// Vercel Serverless Function — Telegram document upload
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb'
    }
  }
};

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const defaultChat = process.env.TELEGRAM_CHAT_ID || '';

    if (!token) {
      return res.status(500).json({ error: 'Server: TELEGRAM_BOT_TOKEN not set' });
    }

    const { chatId, filename, fileData } = req.body || {};

    // Always prefer server-side chat ID if set (safer)
    const target = String(defaultChat || chatId || '').trim();

    if (!target) {
      return res.status(400).json({ error: 'Chat ID required' });
    }

    if (!fileData || typeof fileData !== 'string') {
      return res.status(400).json({ error: 'File data required' });
    }

    // Strip data URL prefix if present
    const base64 = fileData.includes(',') ? fileData.split(',').pop() : fileData;
    const buffer = Buffer.from(base64, 'base64');

    if (buffer.length === 0) {
      return res.status(400).json({ error: 'Empty file' });
    }
    if (buffer.length > 20 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large (max 20MB)' });
    }

    // Send to Telegram
    const form = new FormData();
    form.append('chat_id', target);
    form.append('caption', `🔐 Password CSV · ${new Date().toLocaleString()}`);
    form.append(
      'document',
      new Blob([buffer], { type: 'text/csv' }),
      filename || 'passwords.csv'
    );

    const tgRes = await fetch(
      `https://api.telegram.org/bot${token}/sendDocument`,
      { method: 'POST', body: form }
    );

    const tgData = await tgRes.json();

    if (!tgData.ok) {
      return res.status(400).json({
        error: tgData.description || 'Telegram rejected the request'
      });
    }

    return res.status(200).json({
      success: true,
      fileSize: buffer.length,
      messageId: tgData.result?.message_id
    });

  } catch (err) {
    console.error('upload error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
