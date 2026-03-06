const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT  = process.env.TELEGRAM_CHAT_ID;
const TG    = `https://api.telegram.org/bot${TOKEN}`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!TOKEN || !CHAT) {
      return res.status(500).json({ error: 'Telegram not configured' });
    }

    const body = req.body || {};
    const name        = (body.name        || '').trim();
    const phone       = (body.phone       || '').trim();
    const city        = (body.city        || '').trim();
    const diagnosis   = (body.diagnosis   || 'не указан').trim();
    const description = (body.description || '').trim();

    if (!name || !phone || !city || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const time = new Date().toLocaleString('ru-RU', {
      timeZone: 'Asia/Almaty', dateStyle: 'short', timeStyle: 'short',
    });

    const text = [
      `🔔 <b>Новая заявка — НОРМОГЕН</b>`,
      ``,
      `👤 <b>ФИО:</b> ${name}`,
      `📞 <b>Телефон:</b> ${phone}`,
      `🏙 <b>Город:</b> ${city}`,
      `🩺 <b>Диагноз:</b> ${diagnosis}`,
      ``,
      `📝 <b>Описание:</b>`,
      description,
      ``,
      `🕐 <i>${time} (Алматы)</i>`,
    ].join('\n');

    const r = await fetch(`${TG}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT, text, parse_mode: 'HTML' }),
    });

    if (!r.ok) {
      const err = await r.text();
      console.error('Telegram error:', err);
      return res.status(500).json({ error: 'Telegram send failed' });
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
}
