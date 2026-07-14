// =============================================================
// Cloudflare Pages Function: AI Chat 代理
// POST /chat → DashScope qwen-plus
// 优先用环境变量 DASHSCOPE_API_KEY，否则用前端传的 apiKey
// =============================================================

const DASHSCOPE_CHAT_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

export async function onRequestPost({ request, env }) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
  try {
    let payload;
    try { payload = await request.json(); }
    catch (e) { return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }

    const envKey = (env && env.DASHSCOPE_API_KEY) || '';
    const apiKey = (payload.apiKey || '').trim() || envKey;
    const messages = payload.messages || [];
    const model = payload.model || 'qwen-plus';
    const maxTokens = payload.max_tokens || 100;
    const temperature = (typeof payload.temperature === 'number') ? payload.temperature : 0.7;

    if (!apiKey) return new Response(JSON.stringify({ error: '缺少 apiKey' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: '缺少 messages' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const body = JSON.stringify({
      model: model,
      input: { messages: messages },
      parameters: { max_tokens: maxTokens, temperature: temperature, result_format: 'message' }
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
      return new Response(JSON.stringify({ error: 'DashScope HTTP ' + dashResp.status + ': ' + errText.slice(0, 200) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const data = await dashResp.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || 'Chat failed' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}

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

export async function onRequestGet() {
  return new Response(JSON.stringify({ ok: true, hint: 'POST {messages, model?, max_tokens?, temperature?, apiKey?}' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
