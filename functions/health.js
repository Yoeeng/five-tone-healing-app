// Cloudflare Pages Functions：/health 健康检查
// 让生产环境 resolveTTSProvider 探测 /health 返回 200，从而判定"云语音在线"、使用云端 CosyVoice
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json'
};
export async function onRequest(context) {
  return new Response(JSON.stringify({ ok: true, service: 'health' }), { status: 200, headers: CORS });
}