// =============================================================
// Cloudflare Pages Function: TTS 代理
// POST /tts → DashScope CosyVoice
// 优先用环境变量 DASHSCOPE_API_KEY，否则用前端传的 apiKey
// =============================================================

const DASHSCOPE_TTS_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2audio/audio-generation';

const COSY_VOICE_MAP = {
  'mandarin_female': 'longxiaochun',
  'mandarin_male':   'longcheng',
  'cantonese_female':'longwan',
  'cantonese_male':  'longfei'
};

export async function onRequestPost({ request, env }) {
  // CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  try {
    let payload;
    try { payload = await request.json(); }
    catch (e) { return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { "Content-Type": "application/json" } }); }

    const envKey = (env && env.DASHSCOPE_API_KEY) || '';
    const apiKey = (payload.apiKey || '').trim() || envKey;
    const text = (payload.text || '').trim();
    const voice = (payload.voice || '').trim();
    const language = (payload.language || 'mandarin').toLowerCase();
    const gender = (payload.gender || 'female').toLowerCase();

    if (!apiKey) return new Response(JSON.stringify({ error: '缺少 apiKey' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    if (!text)  return new Response(JSON.stringify({ error: '缺少 text' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    let resolvedVoice = voice;
    if (!resolvedVoice) {
      resolvedVoice = COSY_VOICE_MAP[language + '_' + gender] || COSY_VOICE_MAP['mandarin_female'];
    }

    // 调用 DashScope TTS
    const body = JSON.stringify({
      model: 'cosyvoice-v1',
      voice: resolvedVoice,
      text: text,
      audio_parameter: { format: 'mp3', sample_rate: 24000, volume: 50, rate: 1.0, pitch: 1.0 }
    });

    const ttsResp = await fetch(DASHSCOPE_TTS_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'wuyin-healing-tts-proxy/1.0'
      },
      body: body
    });

    if (!ttsResp.ok) {
      const errText = await ttsResp.text();
      return new Response(JSON.stringify({ error: "DashScope HTTP " + ttsResp.status + ": " + errText.slice(0, 200) }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const data = await ttsResp.json();
    const audioUrl = data && data.output && data.output.audio_url;
    if (!audioUrl) {
      return new Response(JSON.stringify({ error: "DashScope 响应缺少 audio_url" }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // 下载音频
    const audioResp = await fetch(audioUrl);
    if (!audioResp.ok) {
      return new Response(JSON.stringify({ error: "Audio fetch HTTP " + audioResp.status }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const mp3Buffer = await audioResp.arrayBuffer();
    return new Response(mp3Buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
        ...corsHeaders
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || "TTS failed" }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
}

// 处理 OPTIONS 预检
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Max-Age': '86400'
    }
  });
}

// GET 返回提示信息
export async function onRequestGet() {
  return new Response(JSON.stringify({ ok: true, hint: "POST {apiKey, text, voice?, language?, gender?}" }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}
