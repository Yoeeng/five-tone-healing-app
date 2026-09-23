(function(){
  var shown = false;
  var du = 'min'; // 显示单位: min=分钟 sec=秒钟
  // 导出面板状态
  var exScope = 'cur';       // cur=当前用户 all=全部用户
  var exTime = 'full';       // full=全部历史 today=当日 range=自选日期
  var exFrom = '', exTo = '';// 自选日期起止
  var exContent = { profile:1, usage:1, healing:1, chat:1, emotion:1, rating:1, recommend:1 };
  var exFmt = 'txt';         // txt=可读文本 json=JSON csv=CSV表格
  var CSS = [
    '#oyAdminMask{position:absolute;top:0;left:0;right:0;bottom:0;z-index:99999;background:rgba(20,20,20,.55);display:none;align-items:center;justify-content:center;font-family:"Noto Sans SC",system-ui,sans-serif}',
    '#oyAdminMask.on{display:flex}',
    '#oyAdminBox{background:#FDFAF5;border:1px solid #E8E4DC;border-radius:16px;width:88%;max-width:100%;max-height:88%;height:auto;overflow:auto;padding:14px 16px;box-sizing:border-box;color:#2C2C2C}',
    '#oyAdminBox h3{margin:0 0 2px;font-size:19px;color:#2C2C2C}',
    '#oyAdminBox .sub{font-size:13px;color:#8a8575;margin-bottom:12px;line-height:1.6}',
    '#oyAdminBox .oyRow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0}',
    '#oyAdminBox button{font-size:15px;padding:7px 12px;border-radius:10px;border:1px solid #C9A94E;background:#fff;color:#8a6d3b;margin:2px;cursor:pointer}',
    '#oyAdminBox button.primary{background:#6B8E6B;border-color:#6B8E6B;color:#fff}',
    '#oyAdminBox button.danger{background:#fff;border-color:#C85A3D;color:#C85A3D}',
    '#oyAdminBox button.big{font-size:16px;padding:9px 22px}',
    '#oyAdminBox .oyUser{display:flex;align-items:center;justify-content:space-between;border:1px solid #E8E4DC;border-radius:10px;padding:8px 10px;margin:6px 0;background:#fff;flex-wrap:wrap}',
    '#oyAdminBox .oyUser .cur{color:#6B8E6B;font-weight:600}',
    '#oyAdminBox input[type=text],#oyAdminBox input[type=password]{font-size:15px;padding:6px 8px;border:1px solid #D8D2C2;border-radius:8px;background:#fff;width:150px;box-sizing:border-box}',
    '#oyAdminBox input[type=date]{font-size:15px;padding:5px 6px;border:1px solid #D8D2C2;border-radius:8px;background:#fff;box-sizing:border-box}',
    '#oyAdminBox .sec{margin:10px 0;padding:10px;background:#F7F3EA;border-radius:10px}',
    '#oyAdminBox .sec>div.t{font-size:14px;color:#6b6450;font-weight:600;margin-bottom:6px}',
    '#oyAdminBox .dl{font-size:12px;color:#8a8575;line-height:1.7}',
    '#oyAdminBox .step{font-size:15px;color:#2C2C2C;font-weight:600;margin:10px 0 4px}',
    '#oyAdminBox .step span{font-size:12px;color:#8a8575;font-weight:normal;margin-left:6px}',
    '#oyAdminBox .oyOpt{font-size:14px;padding:6px 12px;border-radius:16px;border:1px solid #C9A94E;background:#fff;color:#8a6d3b;margin:3px 4px 3px 0;cursor:pointer}',
    '#oyAdminBox .oyOpt.on{background:#6B8E6B;border-color:#6B8E6B;color:#fff}',
    '#oyPin{position:absolute;top:0;left:0;right:0;bottom:0;z-index:100001;background:rgba(20,20,20,.55);display:none;align-items:center;justify-content:center;font-family:"Noto Sans SC",system-ui,sans-serif}',
    '#oyPin.on{display:flex}',
    '#oyPinBox{background:#FDFAF5;border:1px solid #E8E4DC;border-radius:14px;padding:18px;width:260px;text-align:center;color:#2C2C2C}',
    '#oyPinBox h4{margin:0 0 10px;font-size:16px}'
  ].join('');
  function injectStyle(){ if (document.getElementById('oyStyle')) return; var s = document.createElement('style'); s.id = 'oyStyle'; s.textContent = CSS; document.head.appendChild(s); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function dt(ts){ var d = new Date(ts); var m = d.getMonth()+1, dd = d.getDate(); return d.getFullYear()+'.'+m+'.'+dd; }
  function ufmt(sec){
    sec = Math.round(sec||0);
    if (du === 'sec') return sec + '秒';
    return (sec/60).toFixed(1) + '分钟';
  }
  var CONTENT_LABELS = [
    ['profile','用户资料'],
    ['usage','使用时长'],
    ['healing','疗愈使用'],
    ['chat','AI对话'],
    ['emotion','情志分析'],
    ['rating','评分趋势'],
    ['recommend','推荐命中']
  ];
  function showPin(){
    var pinBox = document.getElementById('oyPin'); if (!pinBox) return;
    pinBox.className = 'on';
    var inp = pinBox.querySelector('input'); if (inp) { inp.value = ''; setTimeout(function(){ inp.focus(); }, 60); }
  }
  function optBtn(act, v, on, label){
    return '<button class="oyOpt' + (on ? ' on' : '') + '" data-act="' + act + '" data-v="' + v + '">' + label + '</button>';
  }
  function render(){
    var OY = window.OY; if (!OY) return;
    var box = document.getElementById('oyAdminBox'); if (!box) return;
    var cur = OY.current(); var curId = cur ? String(cur.id) : '0';
    var today = OY.todayUsage(); var tot = OY.totalUsage();
    var userRows = OY.users().map(function(u){
      var c = String(u.id) === curId ? ' <span class="cur">✔当前</span>' : '';
      var btns = '<button data-act="sw" data-id="' + u.id + '"' + (String(u.id) === curId ? ' disabled style="opacity:.5"' : '') + '>切换</button>' +
        '<button data-act="rn" data-id="' + u.id + '">重命名</button>' +
        '<button class="danger" data-act="del" data-id="' + u.id + '">删除</button>';
      var code = '编号' + (u.id < 10 ? '0' : '') + u.id;
      
      return '<div class="oyUser"><span>' + code + c + '</span><span>' + btns + '</span></div>';
    }).join('');
    // 导出面板
    var allOn = CONTENT_LABELS.every(function(x){ return exContent[x[0]]; });
    var contentBtns = CONTENT_LABELS.map(function(x){
      return optBtn('exc', x[0], !!exContent[x[0]], (exContent[x[0]] ? '✓' : '') + x[1]);
    }).join('');
    var scopeBtns = optBtn('exs', 'cur', exScope === 'cur', '当前用户（' + esc(cur ? cur.name : '-') + '）') +
      optBtn('exs', 'all', exScope === 'all', '全部用户（' + OY.users().length + '人）');
    var timeBtns = optBtn('ext', 'full', exTime === 'full', '全部历史') +
      optBtn('ext', 'today', exTime === 'today', '当日') +
      optBtn('ext', 'range', exTime === 'range', '自选日期');
    var rangeInputs = exTime === 'range' ?
      '<div class="oyRow" style="margin-top:4px">起 <input type="date" id="oyFrom" value="' + exFrom + '"> 止 <input type="date" id="oyTo" value="' + exTo + '"></div>' : '';
    var fmtBtns = optBtn('exf', 'txt', exFmt === 'txt', '可读文本') +
      optBtn('exf', 'json', exFmt === 'json', 'JSON') +
      optBtn('exf', 'csv', exFmt === 'csv', 'CSV表格');
    box.innerHTML =
      '<h3>研究管理后台</h3>' +
      '<div class="sub">研究者专用入口。所有数据仅存储于本机，用于本地区分用户与导出研究数据。</div>' +
      '<div class="sec"><div class="t">用户列表</div>' + userRows +
        '<div class="oyRow"><button class="primary" data-act="add">+新增用户</button><input type="text" id="oyNewName" placeholder="新用户昵称（可空，自动编号）"></div></div>' +
      '<div class="sec"><div class="t">数据导出</div>' +
        '<div class="step">① 导出范围</div><div>' + scopeBtns + '</div>' +
        '<div class="step">② 时间范围</div><div>' + timeBtns + '</div>' + rangeInputs +
        '<div class="step">③ 数据内容<span>默认全选</span></div><div>' + contentBtns + '</div>' +
        '<div class="oyRow" style="margin-top:2px"><button data-act="exall">' + (allOn ? '全不选' : '全选') + '</button></div>' +
        '<div class="step">④ 导出格式</div><div>' + fmtBtns + '</div>' +
        '<div class="oyRow" style="margin-top:10px"><button class="primary big" data-act="doExport">开始导出</button></div>' +
        '<div class="dl">可读文本：中文分节排版，直接阅读｜JSON：原始完整数据，供程序处理｜CSV表格：单个文件内按逻辑分多个表格，Excel/WPS 可打开</div></div>' +
      '<div class="sec"><button data-act="diag" class="big">⚡ 一键诊断（数据是否完整）</button><div class="dl">诊断会检查每个用户各块数据量及原始 localStorage 键是否存在，结果以弹窗展示。</div></div>' +
      '<div class="sec"><div class="t">使用时长 <button data-act="unit" style="font-size:12px;padding:3px 8px">' + (du === 'sec' ? '秒钟' : '分钟') + '</button></div><div class="dl">' +
      '今日：疗愈 ' + ufmt(today.healing) + '；对话 ' + ufmt(today.chat) + '；问卷 ' + ufmt(today.quiz) + '（合计 ' + ufmt(today.total) + '）<br>' +
      '累计：疗愈 ' + ufmt(tot.healing) + '；对话 ' + ufmt(tot.chat) + '；问卷 ' + ufmt(tot.quiz) + '<br>' +
      '总时长合计 ' + ufmt(tot.total) + '；使用 ' + usageDays() + ' 天</div></div>' +
      '<div class="sec"><div class="t">密码</div><div class="oyRow"><input type="password" id="oyOldPin" placeholder="旧密码"><input type="password" id="oyNewPin" placeholder="新密码"><button data-act="setPin">修改</button></div></div>' +
      '<div style="text-align:right;margin-top:10px"><button data-act="close" class="danger">关闭</button></div>';
    // 绑定日期输入（render 后重新绑定）
    var f = document.getElementById('oyFrom'); if (f) f.addEventListener('change', function(){ exFrom = this.value; });
    var t2 = document.getElementById('oyTo'); if (t2) t2.addEventListener('change', function(){ exTo = this.value; });
  }
  function usageDays(){
    var OY = window.OY; if (!OY) return 0;
    var days = 0;
    try {
      var all = (typeof OY.rawUsageDaily === 'function') ? OY.rawUsageDaily() : {};
      Object.keys(all).forEach(function(k){ var x = all[k]||{}; var h=Math.max(x.healing||0, Math.round((x.healingMins||0)*60)); var c=Math.max(x.chat||0, Math.round((x.chatMins||0)*60)); var q=Math.max(x.quiz||0, Math.round((x.quizMins||0)*60)); if (h+c+q > 0) days++; });
    } catch(e){}
    return days;
  }
  function openAdmin(){
    if (!window.OY) return;
    injectStyle();
    if (!document.getElementById('oyAdminMask')) buildOverlay();
    render();
    document.getElementById('oyAdminMask').className = 'on';
  }
  function buildOverlay(){
    var m = document.createElement('div'); m.id = 'oyAdminMask'; m.className = '';
    m.innerHTML = '<div id="oyAdminBox"></div>';
    var host = document.getElementById('phoneScreen') || document.body;
    host.appendChild(m);
    var p = document.createElement('div'); p.id = 'oyPin'; p.className = '';
    p.innerHTML = '<div id="oyPinBox"><h4>输入研究管理密码</h4><input type="password" id="oyPinInput" style="width:140px;font-size:16px;padding:6px;border:1px solid #D8D2C2;border-radius:8px;text-align:center"><div style="margin-top:10px"><button id="oyPinOk">确定</button><button id="oyPinCancel">取消</button></div></div>';
    host.appendChild(p);
    // 事件
    m.addEventListener('click', function(e){
      var el = e.target; var act = el && el.getAttribute('data-act'); if (!act) return;
      var OY = window.OY; if (!OY) return;
      if (act === 'close'){ m.className = ''; return; }
      if (act === 'add'){ OY.createUser(document.getElementById('oyNewName') && document.getElementById('oyNewName').value); render(); return; }
      if (act === 'sw'){ OY.switchUser(el.getAttribute('data-id')); return; }
      if (act === 'del'){ var id = el.getAttribute('data-id'); if (confirm('确认删除该用户及其全部数据？')) OY.deleteUser(id); return; }
      if (act === 'rn'){ var id2 = el.getAttribute('data-id'); var nm = prompt('输入新昵称'); if (nm) OY.renameUser(id2, nm); render(); return; }
      if (act === 'unit'){ du = (du === 'min' ? 'sec' : 'min'); render(); return; }
      if (act === 'setPin'){ var o = document.getElementById('oyOldPin').value, n = document.getElementById('oyNewPin').value; if (OY.setPin(o, n)) { document.getElementById('oyOldPin').value=''; document.getElementById('oyNewPin').value=''; alert('密码已修改'); } else alert('旧密码错误或新密码不能为空'); return; }
      // ===== 四步导出 =====
      if (act === 'exs'){ exScope = el.getAttribute('data-v'); render(); return; }
      if (act === 'ext'){ exTime = el.getAttribute('data-v'); render(); return; }
      if (act === 'exc'){ var k = el.getAttribute('data-v'); exContent[k] = exContent[k] ? 0 : 1; render(); return; }
      if (act === 'exall'){
        var allOn = CONTENT_LABELS.every(function(x){ return exContent[x[0]]; });
        CONTENT_LABELS.forEach(function(x){ exContent[x[0]] = allOn ? 0 : 1; });
        render(); return;
      }
      if (act === 'exf'){ exFmt = el.getAttribute('data-v'); render(); return; }
      if (act === 'doExport'){ doExport(); return; }
      if (act === 'diag'){ doDiag(); return; }
    });
    m.addEventListener('click', function(e){ if (e.target === m) m.className = ''; });
    // PIN
    document.getElementById('oyPinOk').addEventListener('click', function(){
      var v = document.getElementById('oyPinInput').value;
      if (window.OY.pinOk(v)){ p.className = ''; openAdmin(); } else { alert('密码错误'); }
    });
    document.getElementById('oyPinCancel').addEventListener('click', function(){ p.className = ''; });
    // 回车提交
    document.getElementById('oyPinInput').addEventListener('keydown', function(e){ if (e.key === 'Enter') document.getElementById('oyPinOk').click(); });
  }
  
  function doDiag(){
    var OY = window.OY; if (!OY) return;
    var lines = [];
    var keys = []; for (var i=0;i<localStorage.length;i++){ var k=localStorage.key(i); if (k) keys.push(k); }
    var pref = {}; keys.forEach(function(k){ var m=/^(wuyin\d+):/.exec(k); var g = m ? m[1] : '(全局/无前缀)'; (pref[g]=pref[g]||[]).push(k); });
    lines.push('■ localStorage 键 (共'+keys.length+'个):');
    Object.keys(pref).forEach(function(g){ lines.push('  ' + g + ': ' + pref[g].length + '个'); });
    // 列出无前缀的【业务】键（用正则 /^wuyin\d+:/ 判定，与分组逻辑一致；修正 charAt 索引 bug）
    var GLOBAL = { 'wuyin_users':1,'wuyin_current_user':1,'wuyin_schema_version':1,'wuyin_dashscope_api_key':1,'wuyin_admin_pin':1 };
    var isPrefixed = function(k){ return /^wuyin\d+:/.test(k); };
    var unprefBiz = keys.filter(function(k){ return !isPrefixed(k) && !GLOBAL[k]; });
    if (unprefBiz.length){ lines.push('  ⚠️ 无前缀业务键 (' + unprefBiz.length + '个):'); unprefBiz.forEach(function(k){ lines.push('      [' + k + ']'); });
      lines.push('      → 判断标准: 不以 wuyin数字: 开头，且不属于全局键'); } else { lines.push('  ✅ 无前缀业务键: 0 个'); }
    // 前缀 shim 生效自检: 写入测试键 check 是否被改写成 wuyin{uid}: 前缀
    try {
      var _uid = (OY.uid && OY.uid()) || String((OY.users()||[])[0] && (OY.users())[0].id || 1);
      var _probe = 'wuyin_selfcheck_' + Date.now();
      localStorage.setItem(_probe, '1');
      var _hit = keys.concat(Array.from({length:localStorage.length},function(_,i){return localStorage.key(i);})).indexOf('wuyin'+_uid+':'+_probe.slice(6)) >= 0;
      // 清理探针键
      for (var i2=0;i2<localStorage.length;i2++){ var kk=localStorage.key(i2); if (kk && kk.indexOf('selfcheck_') >= 0){ localStorage.removeItem(kk); } }
      lines.push('  前缀 shim 自检: ' + (_hit ? '✅ 生效' : '❌ 未生效(写入可能绕过前缀)'));
    } catch(e){ lines.push('  前缀 shim 自检: 错误 - ' + (e&&e.message||e)); }
    (OY.users()||[]).forEach(function(u){
      lines.push(''); lines.push('■ 用户' + u.id + ' (' + (u.name||'') + '):');
      try {
        var rep = OY.buildReport(String(u.id), {}); var b = rep.blocks||{};
        lines.push('  profile: 创建=' + (b.profile&&b.profile.createdAtStr||'空') + ' 最后=' + (b.profile&&b.profile.lastActiveStr||'空'));
        lines.push('  usage(使用时长): daily=' + (b.usage&&b.usage.daily&&b.usage.daily.length) + '条 合计=' + (b.usage&&b.usage.summary&&b.usage.summary.totalSec) + '秒');
        lines.push('  healing(疗愈): ' + (b.healing&&b.healing.detail&&b.healing.detail.length) + '条');
        lines.push('  chat(对话分析): ' + (b.chat&&b.chat.detail&&b.chat.detail.length) + '条 总时长=' + (b.chat&&b.chat.summary&&b.chat.summary.totalSec) + '秒');
        lines.push('  emotion(情志): 问卷=' + (b.emotion&&b.emotion.questionnaire&&b.emotion.questionnaire.length) + '条 关键词=' + Object.keys((b.emotion&&b.emotion.summary&&b.emotion.summary.keywordFreq)||{}).length + '个');
        lines.push('  rating(评分): ' + (b.rating&&b.rating.detail&&b.rating.detail.length) + '条');
        lines.push('  recommend(命中): ' + (b.recommend&&b.recommend.detail&&b.recommend.detail.length) + '条 命中率=' + (b.recommend&&b.recommend.summary&&b.recommend.summary.hitRate));
      } catch(err){ lines.push('  buildReport 出错: ' + (err&&err.message||err)); }
    });
    lines.push(''); lines.push('原始键 wuyin{id}:usage_daily 是否存在: ' + keys.some(function(k){ return /^wuyin\d+:usage_daily$/.test(k); }));
    alert(lines.join('\n'));
  }
  function doExport(){
    var OY = window.OY; if (!OY) return;
    if (exTime === 'range'){
      if (!exFrom || !exTo){ alert('请选择起止日期'); return; }
      if (exFrom > exTo){ alert('开始日期不能晚于结束日期'); return; }
    }
    var anySel = CONTENT_LABELS.some(function(x){ return exContent[x[0]]; });
    if (!anySel){ alert('请至少勾选一项数据内容'); return; }
    var cur = OY.current();
    var ids = (exScope === 'cur' && cur) ? [cur.id] : OY.users().map(function(u){ return u.id; });
    var opts = { time: { mode: exTime, from: exFrom, to: exTo }, content: exContent };
    var dstr = new Date().toISOString().slice(0, 10);
    var scopeLabel = (exScope === 'cur' && cur) ? ('用户' + cur.id) : '全部用户';
    try {
      if (exFmt === 'json'){
        var rep = OY.exportReport(ids, opts);
        OY.download('五音疗愈数据_' + scopeLabel + '_' + dstr + '.json', JSON.stringify(rep, null, 2));
      } else if (exFmt === 'txt'){
        var txt = OY.exportReportText(ids, opts, du);
        OY.download('五音疗愈数据_' + scopeLabel + '_' + dstr + '.txt', txt, 'text/plain;charset=utf-8');
      } else {
        var fc = OY.exportReportCSV(ids, opts, du);
        if (!fc || !fc.csv){ alert('所选范围内没有可导出的数据'); return; }
        OY.download(fc.name, fc.csv, 'text/csv;charset=utf-8');
      }
    } catch(e){
      console.error('[oyAdmin] export failed:', e);
      alert('导出失败：' + (e && e.message ? e.message : e));
    }
  }
  // 长按 .me-header 进入（1.1s），抑制随后的点击
  function bindEntry(){
    // 已切换到“我的→系统→后台管理”按钮入口，禁用原长按头像入口
    return; var hd = document.querySelector('.me-header'); if (!hd) return;
    var timer = null, held = false;
    hd.addEventListener('pointerdown', function(){ held = false; timer = setTimeout(function(){ held = true; showPin(); }, 1100); });
    hd.addEventListener('pointerup', function(ev){ clearTimeout(timer); ev.stopPropagation(); if (held){ held = false; if (ev) { ev.preventDefault(); if (window.__oyJustAdmin) {} window.__oyJustAdmin = true; } } });
    hd.addEventListener('pointercancel', function(){ clearTimeout(timer); });
  }
  // 后台管理入口改为普通按钮（window.__oyOpenAdmin），不再用长按头像
  window.__oyOpenAdmin = function(){ if (typeof showPin === 'function') showPin(); };
  // 包裹 openEditName：长按进入后台时抑制编辑名字弹窗
  window.addEventListener('DOMContentLoaded', function(){
    injectStyle(); buildOverlay(); bindEntry();
    if (typeof window.openEditName === 'function'){ var oe = window.openEditName; window.openEditName = function(){ if (window.__oyJustAdmin){ window.__oyJustAdmin = false; return; } oe.apply(this, arguments); }; }
  });
})();
