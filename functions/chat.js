// =============================================================
// Cloudflare Pages Function: AI Chat 代理
// POST /chat → DashScope qwen-plus
// 优先用环境变量 DASHSCOPE_API_KEY，否则用前端传的 apiKey
// =============================================================

const DASHSCOPE_CHAT_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

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
    const apiKey = (payload.apiKey && payload.apiKey.trim()) || envKey;
    // 兼容两种格式：OpenAI 兼容（payload.messages）或 DashScope 原生（payload.input.messages）
    const messages = (payload.messages && payload.messages.length > 0)
      ? payload.messages
      : (payload.input && payload.input.messages ? payload.input.messages : []);
    const model = payload.model || 'qwen3.7-plus';
    const maxTokens = payload.max_tokens || (payload.parameters && payload.parameters.max_tokens) || 100;
    const temperature = (typeof payload.temperature === 'number') ? payload.temperature : (payload.parameters && payload.parameters.temperature) || 0.7;
    console.log('[chat] apiKey=' + (apiKey ? 'OK' : 'MISSING') + ' envKey=' + (envKey ? 'OK' : 'MISSING') + ' messages=' + messages.length);

    if (!envKey) {
      console.error('[chat] 缺少 env.DASHSCOPE_API_KEY');
      return new Response(JSON.stringify({ error: '服务端未配置 DASHSCOPE_API_KEY 环境变量' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: '缺少 messages' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const body = JSON.stringify({
      model: model,
      messages: messages,
      max_tokens: maxTokens,
      temperature: temperature,
      stream: false
    });

    // ✅ 直接用 envKey（不再依赖前端传的 apiKey），简化调用
    const dashResp = await fetch(DASHSCOPE_CHAT_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + envKey,
        'Content-Type': 'application/json'
      },
      body: body
    });

    if (!dashResp.ok) {
      const errText = await dashResp.text();
      console.error('[chat] DashScope HTTP ' + dashResp.status + ': ' + errText.slice(0, 300));
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

export async function onRequestGet({ env }) {
  const hasKey = !!(env && env.DASHSCOPE_API_KEY);
  return new Response(JSON.stringify({ ok: true, serverKeyConfigured: hasKey, hint: 'POST {messages, model?, max_tokens?, temperature?, apiKey?}' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

