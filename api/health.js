// Vercel Serverless Function: 健康检查
module.exports = (req, res) => {
  res.status(200).json({ ok: true, time: new Date().toISOString() });
};
