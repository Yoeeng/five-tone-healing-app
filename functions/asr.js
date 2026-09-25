
// =============================================================
// Cloudflare Pages Function: 语音识别 (Paraformer 实时 v2) 代理（对齐 server.js）
// POST /asr {apiKey, audio(base64), format, sampleRate} -> {text}
// =============================================================
const ASR_WS = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference';
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
  const apiKey = (payload.apiKey || '').trim() || envKey;
  const audioB64 = (payload.audio || '').trim();
  const format = (payload.format || 'wav');
  const sampleRate = Number(payload.sampleRate) || 16000;

  if (!apiKey) return json(corsHeaders, 400, { error: '缺少 apiKey' });
  if (!audioB64) return json(corsHeaders, 400, { error: '缺少 audio' });

  const bin = atob(audioB64);
  const audioBuf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) audioBuf[i] = bin.charCodeAt(i);

  const taskId = crypto.randomUUID();
  const transcript = await new Promise((resolve, reject) => {
    let ws;
    try { ws = new WebSocket(ASR_WS + '?Authorization=Bearer%20' + encodeURIComponent(apiKey)); }
    catch (e) { return reject(e); }
    let t = ''; let sentAudio = false; let done = false;
    const timer = setTimeout(function () { try { ws.close(); } catch(e){} if (!done) { done = true; reject(new Error('ASR 超时')); } }, 120000);
    const finish = function (err) {
      if (done) return; done = true; clearTimeout(timer);
      try { ws.close(); } catch (e) {}
      err ? reject(err) : resolve(t);
    };
    ws.addEventListener('open', function () {
      ws.send(JSON.stringify({
        header: { action: 'run-task', task_id: taskId, streaming: 'duplex' },
        payload: { task_group: 'audio', task: 'asr', function: 'recognition', model: 'paraformer-realtime-v2',
          input: {}, parameters: { format: format, sample_rate: sampleRate, language_hints: ['zh', 'yue'] } }
      }));
    });
    ws.addEventListener('message', function (ev) {
      const data = ev.data;
      if (typeof data !== 'string') return;
      let j; try { j = JSON.parse(data); } catch (e) { return; }
      const h = j.header || {};
      const evt = h.event;
      if (evt === 'task-started' && !sentAudio) {
        sentAudio = true;
        ws.send(audioBuf);
        ws.send(JSON.stringify({ header: { action: 'finish-task', task_id: taskId, streaming: 'duplex' }, payload: { input: {} } }));
      }
      if (evt === 'task-finished') { finish(null); return; }
      if (evt === 'error' || evt === 'task-failed') { finish(new Error('ASR ' + evt + ': ' + (h.error_message || '协议错误'))); return; }
      const out = j.payload && j.payload.output;
      const s = out && out.sentence;
      if (s && typeof s.text === 'string' && s.text && s.sentence_end === true) t += s.text;
    });
    ws.addEventListener('error', function () { finish(new Error('ASR 连接失败（检查 API Key/是否开通语音识别）')); });
  });
  return json(corsHeaders, 200, { text: transcript });
}
export async function onRequestOptions() { return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Max-Age': '86400' } }); }

export async function onRequestGet() {
  return new Response(JSON.stringify({ ok: true, hint: 'POST {apiKey, audio(base64), format, sampleRate}' }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}
