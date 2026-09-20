export default function handler(req, res) {
  res.json({
    status: 'ok',
    botTokenSet: !!process.env.TELEGRAM_BOT_TOKEN,
    defaultChatIdSet: !!process.env.TELEGRAM_CHAT_ID,
    time: new Date().toISOString()
  });
}
