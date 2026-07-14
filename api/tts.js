// =============================================================
// Vercel Serverless Function: TTS 代理
// 从 server.js 迁移：POST /api/tts -> DashScope CosyVoice
// 优先用环境变量 DASHSCOPE_API_KEY，否则用前端传的 apiKey
// =============================================================
const https = require('https');
const { URL } = require('url');

const DASHSCOPE_TTS_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2audio/audio-generation';

const COSY_VOICE_MAP = {
  'mandarin_female': 'longxiaochun',
  'mandarin_male':   'longcheng',
  'cantonese_female':'longwan',
  'cantonese_male':  'longfei'
};

function fetchAudioFromUrl(audioUrl, maxRedirects) {
  maxRedirects = maxRedirects || 5;
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error("Too many redirects"));
    const u = new URL(audioUrl);
    const opts = {
      method: "GET",
      hostname: u.hostname,
      path: u.pathname + u.search,
      port: u.port || 443,
      headers: {
        'User-Agent': 'wuyin-healing-tts-proxy/1.0',
        'Accept': 'audio/mpeg, audio/*;q=0.9, */*;q=0.5'
      }
    };
    const req = https.request(opts, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = new URL(res.headers.location, audioUrl).toString();
        res.resume();
        return resolve(fetchAudioFromUrl(next, maxRedirects - 1));
      }
      if (res.statusCode !== 200) return reject(new Error("Audio fetch HTTP " + res.statusCode));
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(30000, () => req.destroy(new Error("Audio fetch timeout")));
    req.end();
  });
}

function callDashScopeTTS(apiKey, text, voice) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'cosyvoice-v1',
      voice: voice,
      text: text,
      audio_parameter: { format: 'mp3', sample_rate: 24000, volume: 50, rate: 1.0, pitch: 1.0 }
    });
    const u = new URL(DASHSCOPE_TTS_URL);
    const req = https.request({
      method: 'POST',
      hostname: u.hostname,
      path: u.pathname,
      port: 443,
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'wuyin-healing-tts-proxy/1.0'
      }
    }, res => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        if (res.statusCode !== 200) {
          return reject(new Error("DashScope HTTP " + res.statusCode + ": " + raw.slice(0, 200)));
        }
        let data;
        try { data = JSON.parse(raw); }
        catch (e) { return reject(new Error("DashScope 非 JSON 响应: " + raw.slice(0, 200))); }
        const audioUrl = data && data.output && data.output.audio_url;
        if (!audioUrl) return reject(new Error("DashScope 响应缺少 audio_url"));
        fetchAudioFromUrl(audioUrl).then(resolve, reject);
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(30000, () => req.destroy(new Error("DashScope request timeout")));
    req.write(body);
    req.end();
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, hint: 'POST {apiKey, text, voice?, language?, gender?}' });
  }

  try {
    const raw = await readBody(req);
    let payload = {};
    try { payload = JSON.parse(raw); }
    catch (e) { return res.status(400).json({ error: "Invalid JSON body" }); }

    const envKey = process.env.DASHSCOPE_API_KEY || '';
    const apiKey = (payload.apiKey || '').trim() || envKey;
    const text = (payload.text || '').trim();
    const voice = (payload.voice || '').trim();
    const language = (payload.language || 'mandarin').toLowerCase();
    const gender = (payload.gender || 'female').toLowerCase();

    if (!apiKey) return res.status(400).json({ error: '缺少 apiKey（请先在"我的"页设置 DashScope API Key）' });
    if (!text)  return res.status(400).json({ error: '缺少 text' });

    let resolvedVoice = voice;
    if (!resolvedVoice) {
      resolvedVoice = COSY_VOICE_MAP[language + '_' + gender] || COSY_VOICE_MAP['mandarin_female'];
    }

    const mp3 = await callDashScopeTTS(apiKey, text, resolvedVoice);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(mp3);
  } catch (e) {
    console.error('[tts] error:', e.message);
    return res.status(500).json({ error: e.message || 'TTS failed' });
  }
};
