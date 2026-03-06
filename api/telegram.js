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
      console.error('Missing env vars: TELEGRAM_BOT_TOKEN=', !!TOKEN, 'TELEGRAM_CHAT_ID=', !!CHAT);
      return res.status(500).json({ error: 'Telegram not configured' });
    }

    // Handle both JSON and FormData
    let name, phone, city, diagnosis, description;
    const ct = req.headers['content-type'] || '';

    if (ct.includes('application/json')) {
      const body = req.body || {};
      name        = (body.name        || '').trim();
      phone       = (body.phone       || '').trim();
      city        = (body.city        || '').trim();
      diagnosis   = (body.diagnosis   || 'не указан').trim();
      description = (body.description || '').trim();
    } else {
      // parse raw body as JSON fallback
      let raw = '';
      await new Promise((resolve) => {
        req.on('data', chunk => { raw += chunk; });
        req.on('end', resolve);
      });
      try {
        const body = JSON.parse(raw);
        name        = (body.name        || '').trim();
        phone       = (body.phone       || '').trim();
        city        = (body.city        || '').trim();
        diagnosis   = (body.diagnosis   || 'не указан').trim();
        description = (body.description || '').trim();
      } catch {
        return res.status(400).json({ error: 'Invalid body' });
      }
    }

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
      console.error('Telegram error:', r.status, err);
      return res.status(500).json({ error: 'Telegram send failed', detail: err });
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('Handler error:', e);
    return res.status(500).json({ error: e.message });
  }
}
