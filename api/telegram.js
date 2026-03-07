import { IncomingForm } from 'formidable';
import { readFileSync } from 'fs';

export const config = { api: { bodyParser: false } };

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT  = process.env.TELEGRAM_CHAT_ID;
const TG    = `https://api.telegram.org/bot${TOKEN}`;

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({ multiples: true, maxFileSize: 10 * 1024 * 1024 });
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      // formidable v3: fields and files are arrays
      const f = {};
      for (const [k, v] of Object.entries(fields)) {
        f[k] = Array.isArray(v) ? v[0] : v;
      }
      // files.files can be a single file or array
      let fileList = files.files || [];
      if (!Array.isArray(fileList)) fileList = [fileList];
      resolve({ fields: f, files: fileList });
    });
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!TOKEN || !CHAT) {
      console.error('Missing env: TOKEN=', !!TOKEN, 'CHAT=', !!CHAT);
      return res.status(500).json({ error: 'Telegram not configured' });
    }

    let name, phone, city, diagnosis, description, uploadedFiles = [];

    const ct = (req.headers['content-type'] || '');

    if (ct.includes('multipart/form-data')) {
      const { fields, files } = await parseForm(req);
      name        = (fields.name        || '').trim();
      phone       = (fields.phone       || '').trim();
      city        = (fields.city        || '').trim();
      diagnosis   = (fields.diagnosis   || 'не указан').trim();
      description = (fields.description || '').trim();
      uploadedFiles = files.filter(f => f && f.size > 0);
    } else {
      // JSON fallback
      const body = req.body || {};
      name        = (body.name        || '').trim();
      phone       = (body.phone       || '').trim();
      city        = (body.city        || '').trim();
      diagnosis   = (body.diagnosis   || 'не указан').trim();
      description = (body.description || '').trim();
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
      `👤 <b>ФИО:</b> ${esc(name)}`,
      `📞 <b>Телефон:</b> ${esc(phone)}`,
      `🏙 <b>Город:</b> ${esc(city)}`,
      `🩺 <b>Диагноз:</b> ${esc(diagnosis)}`,
      ``,
      `📝 <b>Описание:</b>`,
      esc(description),
      ``,
      `🕐 <i>${time} (Алматы)</i>`,
      uploadedFiles.length ? `📎 <b>Файлов:</b> ${uploadedFiles.length}` : '',
    ].filter(Boolean).join('\n');

    // 1. Send text message
    const msgRes = await fetch(`${TG}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT, text, parse_mode: 'HTML' }),
    });

    if (!msgRes.ok) {
      const err = await msgRes.text();
      console.error('Telegram sendMessage error:', err);
      return res.status(500).json({ error: 'Telegram send failed' });
    }

    // 2. Send each file as document
    for (const file of uploadedFiles) {
      try {
        const fileData = readFileSync(file.filepath || file.path);
        const blob = new Blob([fileData], { type: file.mimetype || 'application/octet-stream' });

        const fd = new FormData();
        fd.append('chat_id', CHAT);
        fd.append('document', blob, file.originalFilename || file.newFilename || 'document');
        fd.append('caption', `📎 Документ от: ${name} (${phone})`);

        const docRes = await fetch(`${TG}/sendDocument`, { method: 'POST', body: fd });

        if (!docRes.ok) {
          const err = await docRes.text();
          console.error('Telegram sendDocument error:', err);
        }
      } catch (fileErr) {
        console.error('File send error:', fileErr);
      }
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('Handler error:', e);
    return res.status(500).json({ error: e.message });
  }
}

function esc(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
