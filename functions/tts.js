
// =============================================================
// Cloudflare Pages Function: TTS 代理（对齐 server.js）
// POST /tts -> DashScope CosyVoice（新版 SpeechSynthesizer, WAV 16k 提速）
// 优先用环境变量 DASHSCOPE_API_KEY，否则用前端传的 apiKey
// =============================================================
const DASHSCOPE_TTS_URL = 'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};
function json(headers, code, obj) { return new Response(JSON.stringify(obj), { status: code, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers || {}) }); }

const COSY_VOICE_MAP = {
  'mandarin_female': 'longxiaochun_v3',
  'mandarin_male':   'longanyang',
  'cantonese_female':'longanhuan_v3',
  'cantonese_male':  'longanyue_v3'
};

export async function onRequestPost({ request, env }) {
  let payload;
  try { payload = await request.json(); }
  catch (e) { return json({ 'Content-Type': 'application/json' }, 400, { error: 'Invalid JSON body' }); }

  const envKey = (env && env.DASHSCOPE_API_KEY) || '';
  const apiKey = (payload.apiKey || '').trim() || envKey;
  const text = (payload.text || '').trim();
  const voice = (payload.voice || '').trim();
  const language = (payload.language || 'mandarin').toLowerCase();
  const gender = (payload.gender || 'female').toLowerCase();
  const model = (payload.model || '').trim();
  const instruction = (payload.instruction || '').trim();

  if (!apiKey) return json(corsHeaders, 400, { error: '缺少 apiKey' });
  if (!text)  return json(corsHeaders, 400, { error: '缺少 text' });

  let resolvedVoice = voice;
  if (!resolvedVoice) resolvedVoice = COSY_VOICE_MAP[language + '_' + gender] || COSY_VOICE_MAP['mandarin_female'];

  const input = { text, voice: resolvedVoice, format: 'wav', sample_rate: 16000, volume: 50, rate: 1.0, pitch: 1.0 };
  if (instruction) input.instruction = instruction;
  const body = JSON.stringify({ model: (model || 'cosyvoice-v3-flash'), input });

  const ttsResp = await fetch(DASHSCOPE_TTS_URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'User-Agent': 'wuyin-healing-tts-proxy/1.0' },
    body: body
  });
  if (!ttsResp.ok) {
    const t = await ttsResp.text();
    return json(corsHeaders, 500, { error: 'DashScope HTTP ' + ttsResp.status + ': ' + t.slice(0, 200) });
  }
  const data = await ttsResp.json();
  const audioUrl = data && data.output && data.output.audio && data.output.audio.url;
  if (!audioUrl) return json(corsHeaders, 500, { error: 'DashScope 响应缺少 audio_url' });

  const audioResp = await fetch(audioUrl);
  if (!audioResp.ok) return json(corsHeaders, 500, { error: 'Audio fetch HTTP ' + audioResp.status });
  const buf = await audioResp.arrayBuffer();
  return new Response(buf, { status: 200, headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store', ...corsHeaders } });
}
export async function onRequestOptions() { return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Max-Age': '86400' } }); }

export async function onRequestGet({ env }) {
  const hasKey = !!(env && env.DASHSCOPE_API_KEY);
  return new Response(JSON.stringify({ ok: true, serverKeyConfigured: hasKey, hint: 'POST {apiKey,text,voice?,language?,gender?,model?,instruction?}' }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}
