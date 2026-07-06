const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
const allJs = scripts.map(s => s.replace(/<script[^>]*>/, '').replace(/<\/script>/, '')).join('\n');
try {
  new Function(allJs);
  console.log('JS syntax valid, total length:', allJs.length);
} catch (e) {
  console.log('Syntax error:', e.message);
  // try to locate the error
  const lines = e.stack ? e.stack.split('\n').slice(0, 5).join('\n') : '';
  console.log(lines);
}
