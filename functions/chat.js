
// =============================================================
// Cloudflare Pages Function: AI Chat 代理（对齐 server.js，支持流式 SSE）
// 优先用环境变量 DASHSCOPE_API_KEY，否则用前端传的 apiKey
// =============================================================
const DASHSCOPE_CHAT_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};
function json(headers, code, obj) { return new Response(JSON.stringify(obj), { status: code, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers || {}) }); }


export async function onRequestPost({ request, env }) {
  let payload;
  try { payload = await request.json(); }
  catch (e) { return json({ 'Content-Type': 'application/json' }, 400, { error: 'Invalid JSON body' }); }

  const envKey = (env && env.DASHSCOPE_API_KEY) || '';
  const apiKey = (payload.apiKey && payload.apiKey.trim()) || envKey;
  const messages = (payload.messages && payload.messages.length > 0) ? payload.messages : (payload.input && payload.input.messages ? payload.input.messages : []);
  const model = payload.model || 'qwen-plus';
  const maxTokens = payload.max_tokens || (payload.parameters && payload.parameters.max_tokens) || 100;
  const temperature = (typeof payload.temperature === 'number') ? payload.temperature : (payload.parameters && payload.parameters.temperature) || 0.7;
  const wantStream = !!(payload.stream);

  if (!apiKey) return json(corsHeaders, 400, { error: '缺少 apiKey' });
  if (!Array.isArray(messages) || messages.length === 0) return json(corsHeaders, 400, { error: '缺少 messages' });

  const body = JSON.stringify({ model, messages, max_tokens: maxTokens, temperature, stream: wantStream ? true : undefined });

  const dashResp = await fetch(DASHSCOPE_CHAT_URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: body
  });
  if (!dashResp.ok) {
    const t = await dashResp.text();
    return json(corsHeaders, 500, { error: 'DashScope HTTP ' + dashResp.status + ': ' + t.slice(0, 200) });
  }
  if (wantStream) {
    return new Response(dashResp.body, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no', ...corsHeaders }
    });
  }
  const data = await dashResp.json();
  return json(corsHeaders, 200, data);
}
export async function onRequestOptions() { return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Max-Age': '86400' } }); }

export async function onRequestGet({ env }) {
  const hasKey = !!(env && env.DASHSCOPE_API_KEY);
  return new Response(JSON.stringify({ ok: true, serverKeyConfigured: hasKey, hint: 'POST {messages,model?}' }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}
