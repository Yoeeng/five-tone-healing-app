// =============================================================
//  五音疗愈 APP 静态服务器 + 云语音 TTS 代理
//  - 静态文件:  GET  /*  (支持 HTTP Range 移动端音频流式)
//  - 健康检查:  GET  /health
//  - 云语音代理: POST /tts  → DashScope CosyVoice
// =============================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;

// 阿里云 DashScope CosyVoice 端点
const DASHSCOPE_TTS_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2audio/audio-generation';

const DASHSCOPE_CHAT_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

// 支持的 CosyVoice 音色（按"语言+性别"映射）
const COSY_VOICE_MAP = {
  'mandarin_female': 'longxiaochun',   // 温柔女声
  'mandarin_male':   'longcheng',      // 沉稳男声
  'cantonese_female':'longwan',        // 粤语女声
  'cantonese_male':  'longfei'         // 粤语男声
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.mp4': 'audio/mp4',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav'
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// 把 "x-www-form-urlencoded" 简单解析成对象（备用，CosyVoice 不需要）
function parseFormBody(s) {
  const out = {};
  s.split('&').forEach(kv => {
    if (!kv) return;
    const i = kv.indexOf('=');
    const k = decodeURIComponent(i >= 0 ? kv.slice(0, i) : kv);
    const v = decodeURIComponent(i >= 0 ? kv.slice(i + 1) : '');
    out[k] = v;
  });
  return out;
}

// 把 DashScope 异步任务返回的 audio URL 抓取成 Buffer
function fetchAudioFromUrl(audioUrl, maxRedirects) {
  maxRedirects = maxRedirects || 5;
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
    const u = new URL(audioUrl);
    const opts = {
      method: 'GET',
      hostname: u.hostname,
      path: u.pathname + u.search,
      port: u.port || 443,
      headers: {
        'User-Agent': 'wuyin-healing-tts-proxy/1.0',
        'Accept': 'audio/mpeg, audio/*;q=0.9, */*;q=0.5'
      }
    };
    const req2 = https.request(opts, res => {
      // 跟随 3xx
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = new URL(res.headers.location, audioUrl).toString();
        res.resume();
        return resolve(fetchAudioFromUrl(next, maxRedirects - 1));
      }
      if (res.statusCode !== 200) {
        return reject(new Error('Audio fetch HTTP ' + res.statusCode));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req2.on('error', reject);
    req2.setTimeout(30000, () => req2.destroy(new Error('Audio fetch timeout')));
    req2.end();
  });
}

// 调用 DashScope CosyVoice 同步 TTS 接口 → 返回 MP3 Buffer
function callDashScopeTTS(apiKey, text, voice, rate) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'cosyvoice-v2',
      voice: voice,
      text: text,
      audio_parameter: { format: 'mp3', sample_rate: 24000, volume: 50, rate: 1.0, pitch: 1.0 },
      // 注：cosyvoice-v2 使用 _v2 后缀音色（如 longxiaochun_v2），兼容 v1 的 API 格式
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
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode !== 200) {
          return reject(new Error('DashScope HTTP ' + res.statusCode + ': ' + raw.slice(0, 200)));
        }
        let data;
        try { data = JSON.parse(raw); }
        catch (e) { return reject(new Error('DashScope 非 JSON 响应: ' + raw.slice(0, 200))); }
        const audioUrl = data && data.output && data.output.audio_url;
        if (!audioUrl) {
          return reject(new Error('DashScope 响应缺少 audio_url: ' + raw.slice(0, 200)));
        }
        // 跟随重定向抓音频
        fetchAudioFromUrl(audioUrl).then(resolve, reject);
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('DashScope request timeout')));
    req.write(body);
    req.end();
  });
}

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  res.end(body);
}

function sendBuffer(res, code, buf, contentType) {
  res.writeHead(code, {
    'Content-Type': contentType,
    'Content-Length': buf.length,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });
  res.end(buf);
}

async function handleTTS(req, res) {
  try {
    const raw = await readBody(req);
    let payload = {};
    try { payload = JSON.parse(raw); }
    catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON body' }); }

    const apiKey = (payload.apiKey || '').trim();
    const text = (payload.text || '').trim();
    const voice = (payload.voice || '').trim();
    const language = (payload.language || 'mandarin').toLowerCase();
    const gender = (payload.gender || 'female').toLowerCase();

    if (!apiKey) return sendJSON(res, 400, { error: '缺少 apiKey（请先在"我的"页设置 DashScope API Key）' });
    if (!text)  return sendJSON(res, 400, { error: '缺少 text' });
    if (!apiKey.startsWith('sk-')) return sendJSON(res, 400, { error: 'apiKey 格式错误（应以 sk- 开头）' });

    // voice 优先使用调用方传参；否则按 language+gender 自动选
    let resolvedVoice = voice;
    if (!resolvedVoice) {
      resolvedVoice = COSY_VOICE_MAP[language + '_' + gender] || COSY_VOICE_MAP['mandarin_female'];
    }

    console.log('[tts] lang=' + language + ' gender=' + gender + ' voice=' + resolvedVoice + ' text=' + text.slice(0, 30) + '...');

    const mp3 = await callDashScopeTTS(apiKey, text, resolvedVoice);
    sendBuffer(res, 200, mp3, 'audio/mpeg');
  } catch (e) {
    console.error('[tts] error:', e.message);
    sendJSON(res, 500, { error: e.message || 'TTS failed' });
  }
}

async function handleChat(req, res) {
  try {
    const raw = await readBody(req);
    let payload = {};
    try { payload = JSON.parse(raw); }
    catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON body' }); }

    const envKey = process.env.DASHSCOPE_API_KEY || '';
    const apiKey = (payload.apiKey && payload.apiKey.trim()) || envKey;
    const messages = (payload.messages && payload.messages.length > 0)
      ? payload.messages
      : (payload.input && payload.input.messages ? payload.input.messages : []);
    const model = payload.model || 'qwen3.7-plus';
    const maxTokens = payload.max_tokens || (payload.parameters && payload.parameters.max_tokens) || 100;
    const temperature = (typeof payload.temperature === 'number') ? payload.temperature : (payload.parameters && payload.parameters.temperature) || 0.7;

    console.log('[chat] apiKey=' + (apiKey ? 'OK' : 'MISSING') + ' messages=' + messages.length);

    if (!apiKey || !apiKey.startsWith('sk-')) {
      return sendJSON(res, 400, { error: '缺少 apiKey（请先在"我的"页设置 DashScope API Key）' });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return sendJSON(res, 400, { error: '缺少 messages' });
    }

    const body = JSON.stringify({
      model: model,
      messages: messages,
      max_tokens: maxTokens,
      temperature: temperature
    });

    const dashResp = await fetch(DASHSCOPE_CHAT_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: body
    });

    if (!dashResp.ok) {
      const errText = await dashResp.text();
      console.error('[chat] DashScope HTTP ' + dashResp.status + ': ' + errText.slice(0, 300));
      return sendJSON(res, 500, { error: 'DashScope HTTP ' + dashResp.status + ': ' + errText.slice(0, 200) });
    }

    const data = await dashResp.json();
    sendJSON(res, 200, data);
  } catch (e) {
    console.error('[chat] error:', e.message);
    sendJSON(res, 500, { error: e.message || 'Chat failed' });
  }
}

// 解析 Range 头，返回 { start, end } 或 null
function parseRangeHeader(rangeHeader, fileSize) {
  if (!rangeHeader || typeof rangeHeader !== 'string') return null;
  // 支持 bytes=start-end / bytes=start- / bytes=-suffixLen
  const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!m) return null;
  const startStr = m[1];
  const endStr = m[2];
  let start, end;
  if (startStr === '' && endStr === '') return null;
  if (startStr === '') {
    // 后缀长度：bytes=-500 表示最后 500 字节
    const suffix = parseInt(endStr, 10);
    if (isNaN(suffix) || suffix <= 0) return null;
    start = Math.max(0, fileSize - suffix);
    end = fileSize - 1;
  } else {
    start = parseInt(startStr, 10);
    if (isNaN(start) || start < 0 || start >= fileSize) return null;
    if (endStr === '') {
      end = fileSize - 1;
    } else {
      end = parseInt(endStr, 10);
      if (isNaN(end) || end < start) return null;
      if (end >= fileSize) end = fileSize - 1;
    }
  }
  return { start: start, end: end };
}

// 流式发送静态文件（支持 HTTP Range 请求，移动端音频/图片必需）
function sendStaticFile(req, res, filePath, stat) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';
  const fileSize = stat.size;
  const rangeHeader = req.headers['range'];

  // 是否为可流式播放的多媒体
  const isStreamable = /\.(mp3|m4a|mp4|wav|ogg|webm|jpg|jpeg|png|gif|webp)$/i.test(ext);

  // 图片/字体长期缓存（文件名带 hash 或内容不变的资源可以激进缓存）
  const isImmutableAsset = /\.(webp|png|jpg|jpeg|svg|gif|woff2?)$/i.test(ext);
  const cacheControl = isImmutableAsset
    ? 'public, max-age=31536000, immutable'
    : 'no-store, no-cache, must-revalidate';

  if (rangeHeader && isStreamable) {
    const range = parseRangeHeader(rangeHeader, fileSize);
    if (range) {
      const chunkSize = range.end - range.start + 1;
      res.writeHead(206, {
        'Content-Range': 'bytes ' + range.start + '-' + range.end + '/' + fileSize,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': cacheControl
      });
      const stream = fs.createReadStream(filePath, { start: range.start, end: range.end });
      stream.on('error', function(err) {
        console.error('[static] range stream error:', err.message);
        try { res.destroy(err); } catch (e) {}
      });
      stream.pipe(res);
      return;
    }
  }

  // 无 Range 头 或 Range 解析失败：返回完整文件（流式）
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': fileSize,
    'Accept-Ranges': 'bytes',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': cacheControl
  });
  const stream = fs.createReadStream(filePath);
  stream.on('error', function(err) {
    console.error('[static] stream error:', err.message);
    try { res.destroy(err); } catch (e) {}
  });
  stream.pipe(res);
}

const server = http.createServer(async (req, res) => {
  // CORS 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length',
      'Access-Control-Max-Age': '86400'
    });
    return res.end();
  }

  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  console.log('[' + req.method + '] ' + urlPath);

  // 健康检查
  if (urlPath === '/health') {
    return sendJSON(res, 200, { ok: true, time: new Date().toISOString() });
  }
  // TTS 代理
  if (urlPath === '/tts' && req.method === 'POST') {
    return handleTTS(req, res);
  }
  if (urlPath === '/tts') {
    return sendJSON(res, 200, { ok: true, hint: 'POST {apiKey, text, voice?, language?, gender?}' });
  }

  // Chat 代理（DashScope qwen-plus）
  if (urlPath === '/chat' && req.method === 'POST') {
    return handleChat(req, res);
  }
  if (urlPath === '/chat') {
    return sendJSON(res, 200, { ok: true, hint: 'POST {messages, model?, max_tokens?, temperature?, apiKey?}' });
  }

  // 静态文件
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found: ' + urlPath);
    }
    sendStaticFile(req, res, filePath, stat);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('=========================================');
  console.log('[server] http://localhost:' + PORT + '/');
  console.log('[tts]    POST http://localhost:' + PORT + '/tts');
  console.log('[health] GET  http://localhost:' + PORT + '/health');
  console.log('[chat]   POST http://localhost:' + PORT + '/chat');
  console.log('[range]  HTTP Range requests supported ✓ (mobile audio fix)');
  console.log('=========================================');
});



