(function(){
  if (window.__oyReady) return; window.__oyReady = true;
  var LS = window.localStorage;
  if (!LS) return;
  // 原生方法引用: 改绑 Storage.prototype, 避免受后续 shim/实例同名属性影响
  var __proto = window.Storage.prototype;
  var rawGet = __proto.getItem.bind(LS), rawSet = __proto.setItem.bind(LS), rawRem = __proto.removeItem.bind(LS), rawKey = __proto.key.bind(LS);
  var GLOBAL = { 'wuyin_users':1,'wuyin_current_user':1,'wuyin_schema_version':1,'wuyin_dashscope_api_key':1,'wuyin_admin_pin':1 };
  var cur = null;
  function __defaultUid(){
    // 权威路由: 以持久化的当前用户 wuyin_current_user 为准（跨页面/异步回调也不忘本）
    try {
      var pUid = rawGet('wuyin_current_user');
      if (pUid !== null) {
        var okU = getUsers().some(function(x){ return String(x.id) === String(pUid); });
        if (okU) return String(pUid);
      }
    } catch(e){}
    if (cur) return String(cur);
    try { var uu = getUsers(); if (uu && uu.length) return String(uu[0].id); } catch(e){}
    return '1';
  }
  function __legacyOwnerId(){
    try { var uu = getUsers(); if (uu && uu.length) return String(uu[0].id); } catch(e){}
    return '1';
  }
  function resolveKey(k){
    if (typeof k !== 'string') return k;
    if (GLOBAL[k]) return k;
    if (k.indexOf('wuyin_') === 0) return 'wuyin' + __defaultUid() + ':' + k.slice(6);
    return k;
  }
  function toast(msg){
    var t = document.getElementById('oyToaster');
    if (!t){ t = document.createElement('div'); t.id = 'oyToaster'; document.body.appendChild(t); }
    t.textContent = msg; t.style.display = 'block';
    clearTimeout(t._h); t._h = setTimeout(function(){ t.style.display = 'none'; }, 2600);
  }
  function readJSON(n, fb){ try{ var v = localStorage.getItem(n); return v === null ? fb : JSON.parse(v); }catch(e){ return fb; } }
  function getUsers(){ return readJSON('wuyin_users', []); }
  function saveUsers(u){ localStorage.setItem('wuyin_users', JSON.stringify(u)); }
  function pad(n){ return n < 10 ? '0' + n : '' + n; }
  function todayStr(){ var d = new Date(), m = d.getMonth()+1, dd = d.getDate(); return d.getFullYear() + '-' + (m<10?'0'+m:m) + '-' + (dd<10?'0'+dd:dd); }
  function __isEmptyContainer(s){
    if (s === null || s === undefined) return false;
    try { var o = JSON.parse(s); return (Array.isArray(o) && o.length === 0) || (typeof o === 'object' && o !== null && Object.keys(o).length === 0); } catch(e){ return false; }
  }
  // 与 __readUserData 的兜底语义一致：当前用户前缀键为空数组/空对象时，回退读取无前缀旧值，
  // 避免"App 界面显示空白、后台导出却有数据"的读写分叉
  // ⚠️ 必须用 defineProperty 而非 `LS.setItem = fn`：手机浏览器会把同名方法名当存储键写入(getItem/setItem/removeItem垃圾键)
  // 定义在 Storage.prototype(所有 Storage 实例共享): 不会把方法名写成存储键
  function __delInst(name){ try{ if (Object.prototype.hasOwnProperty.call(LS, name)) delete LS[name]; }catch(e){} }
  function __defStoreMethod(name, fn){
    // 清掉实例上已产生的同名自有属性(垃圾键来源)
    __delInst(name); try{ (window.Storage.prototype)[name] = fn; }catch(e){ console.warn('[oy] proto def failed', name, e); }
  }
  __defStoreMethod('getItem', function(k){
    var rk = resolveKey(k);
    if (rk === k) return rawGet(k);
    var v = rawGet(rk);
    // 多用户严格隔离：未加前缀的旧业务键只归属“唯一所有者”
    // 非所有者用户只读自己的前缀键，绝不允许读/合并无前缀共享值，防止串台
    if (typeof __legacyOwnerId === 'function' && String(__defaultUid()) !== __legacyOwnerId()){
      return v;
    }
    var lv = rawGet(k);
    if (v != null && lv != null && v !== lv) {
      var vm, lm, ok = true;
      try { vm = JSON.parse(v); } catch(e){ ok = false; }
      try { lm = JSON.parse(lv); } catch(e){ ok = false; }
      if (ok && Array.isArray(vm) && Array.isArray(lm)) return JSON.stringify(__unionValues(vm, lm));
    }
    if (v === null || v === undefined) return lv;
    if (__isEmptyContainer(v)) return (lv === null || lv === undefined) ? v : lv;
    return v;
  });
  __defStoreMethod('removeItem', function(k){ return rawRem(resolveKey(k)); });
  __defStoreMethod('setItem', function(k, v){
    var kk = resolveKey(k);
    try { rawSet(kk, v); }
    catch(err){ if (err && (err.name==='QuotaExceededError' || err.code===22 || err.code===1014)) toast('存储空间已满，请导出后清理数据'); else throw err; }
  });
  function makeUid(){ var u = getUsers(), mx = 0; u.forEach(function(x){ if (Number(x.id) > mx) mx = Number(x.id); }); return mx + 1; }
  function createUser(name){
    var u = getUsers(), uid = makeUid();
    var nm = (name && String(name).trim()) || '编号' + pad(uid);
    u.push({ id: uid, name: nm, createdAt: Date.now(), lastActive: Date.now() });
    saveUsers(u); return u[u.length - 1];
  }
  function ensureDefault(){
    var u = getUsers();
    if (!u.length) u.push({ id: 1, name: '编号01', createdAt: Date.now(), lastActive: Date.now() });
    saveUsers(u);
    var uid = localStorage.getItem('wuyin_current_user');
    if (uid === null || !u.some(function(x){ return String(x.id) === String(uid); })) localStorage.setItem('wuyin_current_user', String(u[0].id));
    cur = String(localStorage.getItem('wuyin_current_user'));
  }
  // 合并两条值：绝不丢失数据。数组按关键字段去重并集；对象补齐缺失键；其余优先保留带前缀(较新)值
    function __unionValues(ex, lg){
    if (Array.isArray(ex) && Array.isArray(lg)){
      var map = {};
      ex.forEach(function(it){ map[__mergeKey(it)] = it; });
      lg.forEach(function(it){ map[__mergeKey(it)] = it; });
      return Object.keys(map).map(function(k){ return map[k]; });
    }
    if (ex && lg && typeof ex === 'object' && typeof lg === 'object' && !Array.isArray(ex) && !Array.isArray(lg)){
      var o = JSON.parse(JSON.stringify(ex));
      Object.keys(lg).forEach(function(k){ if (!Object.prototype.hasOwnProperty.call(o, k)) o[k] = lg[k]; });
      return o;
    }
    // 其余：优先保留带前缀(较新)值；若带前缀缺失则用无前缀值
    return (ex === null || ex === undefined) ? lg : ex;
  }
  function __mergeKey(it){
    if (it && typeof it === 'object') return 't' + (it.timestamp || it.ts || it.time || it.date || '') + (it.id || '');
    return 'v' + JSON.stringify(it);
  }
  function __mergeLegacyValue(existingRaw, legacyRaw){
    var ex, lg;
    try { ex = JSON.parse(existingRaw); } catch(e){ ex = existingRaw; }
    try { lg = JSON.parse(legacyRaw); } catch(e){ lg = legacyRaw; }
    if (Array.isArray(ex) && Array.isArray(lg)){
      var map = {};
      ex.forEach(function(it){ map[__mergeKey(it)] = it; });
      lg.forEach(function(it){ map[__mergeKey(it)] = it; });
      return JSON.stringify(Object.keys(map).map(function(k){ return map[k]; }));
    }
    if (ex && lg && typeof ex === 'object' && typeof lg === 'object' && !Array.isArray(ex) && !Array.isArray(lg)){
      var o = JSON.parse(JSON.stringify(ex));
      Object.keys(lg).forEach(function(k){ if (!Object.prototype.hasOwnProperty.call(o, k)) o[k] = lg[k]; });
      return JSON.stringify(o);
    }
    return existingRaw; // 兜底：优先保留带前缀(通常更新)的值
  }
  function migrateLegacy(){
    var owner = (typeof __legacyOwnerId === 'function') ? __legacyOwnerId() : '1';
    var n = 0, keys = [];
    for (var i=0;i<LS.length;i++){ var k = rawKey(i); if (k && typeof k === 'string') keys.push(k); }
    var hasUnprefixed = keys.some(function(k){
      return !GLOBAL[k] && k.charAt(5) !== ':' && k.indexOf('wuyin_') === 0;
    });
    if (localStorage.getItem('wuyin_schema_version') === '1' && !hasUnprefixed) return;
    // 无前缀旧键只归属“唯一所有者(owner)”，绝不迁给当前用户，避免被其他用户读到 → 串台
    keys.forEach(function(k){
      if (GLOBAL[k] || k.charAt(5) === ':') return;
      if (k.indexOf('wuyin_') !== 0) return;
      var v = rawGet(k);
      if (v === null) return;
      var pk = 'wuyin' + owner + ':' + k.slice(6);
      var ex = rawGet(pk);
      // 带前缀为空 → 直接采纳旧值；否则合并两份(不覆盖)，再删除无前缀副本，收敛为单一来源
      rawSet(pk, (ex === null) ? v : __mergeLegacyValue(ex, v));
      rawRem(k); n++;
    });
    localStorage.setItem('wuyin_schema_version', '1');
    if (n) console.log('[oy] merged unprefixed into owner user:', n);
  }
  // ===== 清理被污染的方法名垃圾键（getItem/setItem/removeItem 被手机浏览器当成键写入）=====
  function __purgeJunkKeys(){
    try {
      var jk = { getItem:1, setItem:1, removeItem:1, key:1, length:1 };
      for (var i=LS.length-1;i>=0;i--){
        var k = rawKey(i);
        if (k === null || k === undefined) continue;
        if (jk[k]) { rawRem(k); }
      }
    } catch(e){ console.warn('[oy] purge junk keys error:', e); }
  }

  // ===== 运行时自检 + 定时迁移兜底 =====
  // 自检: 验证 setItem 是否正确加前缀（防止旧缓存代码/包装器被覆盖导致串台）
  function __selfCheck(){
    try {
      var probe = 'wuyin___probe_' + Date.now();
      localStorage.setItem(probe, '1');
      var uid = __defaultUid();
      var hit = false, rawKeys = [];
      for (var i=0;i<LS.length;i++){ var kk = rawKey(i); if (kk) rawKeys.push(kk); if (kk === 'wuyin'+uid+':'+probe.slice(6)) hit = true; }
      rawKeys.forEach(function(k){ if (k.indexOf('__probe_') >= 0 || k.indexOf('___probe_') >= 0) rawRem(k); });
      if (!hit){
        console.warn('[oy] SELF-CHECK FAIL: setItem 未加前缀，强制重新安装包装器');
        __installWrappers();
      }
    } catch(e){ console.warn('[oy] self-check error:', e); }
  }
  // 定时迁移兜底: 每 8 秒扫描一次无前缀业务键，发现即迁移（兼容旧代码写入/缓存异常）
  function __periodicMigrate(){ try { migrateLegacy(); } catch(e){} }
  // 重新安装 localStorage 包装器（自检失败时调用）
  function __installWrappers(){
    __defStoreMethod('getItem', function(k){
      var rk = resolveKey(k);
      if (rk === k) return rawGet(k);
      var v = rawGet(rk);
      if (typeof __legacyOwnerId === 'function' && String(__defaultUid()) !== __legacyOwnerId()){ return v; }
      var lv = rawGet(k);
      if (v != null && lv != null && v !== lv) {
        var vm, lm, ok = true;
        try { vm = JSON.parse(v); } catch(e){ ok = false; }
        try { lm = JSON.parse(lv); } catch(e){ ok = false; }
        if (ok && Array.isArray(vm) && Array.isArray(lm)) return JSON.stringify(__unionValues(vm, lm));
      }
      if (v === null || v === undefined) return lv;
      if (__isEmptyContainer(v)) return (lv === null || lv === undefined) ? v : lv;
      return v;
    });
    __defStoreMethod('removeItem', function(k){ return rawRem(resolveKey(k)); });
    __defStoreMethod('setItem', function(k, v){
      var kk = resolveKey(k);
      try { rawSet(kk, v); }
      catch(err){ if (err && (err.name==='QuotaExceededError' || err.code===22 || err.code===1014)) toast('存储空间已满，请导出后清理数据'); else throw err; }
    });
  }

  // ===== 使用时长：心跳计时（秒）=====
  var __active = {};
  function __noteActive(kind){ if (kind === 'healing' || kind === 'chat' || kind === 'quiz') __active[kind] = true; }
  function __noteInactive(kind){
    if (kind === 'healing' || kind === 'chat' || kind === 'quiz') __active[kind] = false;
    else { __active.healing = __active.chat = __active.quiz = false; }
  }
  var __heartInit = false;
  function __initHeartbeat(){
    if (__heartInit) return; __heartInit = true;
    setInterval(function(){
      if (!(document && document.visibilityState === 'visible')) return;
      if (!(__active.healing || __active.chat || __active.quiz)) return;
      var t = Date.now(), today = todayStr(), all = readJSON('wuyin_usage_daily', {});
      var d = all[today] || {};
      if (!d.firstTs) d.firstTs = t;
      d.lastTs = t;
      if (__active.healing) d.healing = (d.healing||0) + 1;
      if (__active.chat)    d.chat    = (d.chat||0) + 1;
      if (__active.quiz)    d.quiz    = (d.quiz||0) + 1;
      // 按次累加：本次疗愈会话的心跳秒（供写入该次疗愈记录作为"实际聆听时长"）
      if (__active.healing){ window.__oyHealSec = (window.__oyHealSec || 0) + 1; }
      all[today] = d;
      try { localStorage.setItem('wuyin_usage_daily', JSON.stringify(all)); } catch(e){}
      __writeStatsFromDaily(all);
    }, 1000);
  }
  function __writeStatsFromDaily(all){
    try {
      var r = { healingMins:0, chatMins:0, quizMins:0 };
      Object.keys(all).forEach(function(dd){ var x = all[dd]||{}; r.healingMins += (x.healing||0)/60; r.chatMins += (x.chat||0)/60; r.quizMins += (x.quiz||0)/60; });
      localStorage.setItem('wuyin_usage_stats', JSON.stringify(r));
    } catch(e){}
    // ✅ 更新当前用户 lastActive（节流：每 5 分钟一次，供导出"最后活跃"）
    try {
      if (cur) {
        var _now = Date.now();
        if (!window.__oyLastActiveWrite || (_now - window.__oyLastActiveWrite) > 300000) {
          var us = getUsers();
          var changed2 = false;
          for (var i2 = 0; i2 < us.length; i2++){ if (String(us[i2].id) === String(cur)){ if (us[i2].lastActive !== _now){ us[i2].lastActive = _now; changed2 = true; } break; } }
          if (changed2) saveUsers(us);
          window.__oyLastActiveWrite = _now;
        }
      }
    } catch(e){}
  }
  // ===== 通用工具 =====
  function __dailyAll(){ return readJSON('wuyin_usage_daily', {}); }
  function __fmtDT(ts){ if(!ts) return '（无）'; var d = new Date(ts); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes()); }
  function __timeOf(ts){ if(!ts) return ''; var d = new Date(ts); return pad(d.getHours())+':'+pad(d.getMinutes()); }
  function __dateOf(v){
    if (v == null) return null;
    if (typeof v === 'number'){ var d = new Date(v); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
    var s = String(v);
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0,10) : null;
  }
  function __u(sec, unit){ if (sec == null) return '—'; if (unit === 'sec') return Math.round(sec) + '秒'; return (sec/60).toFixed(1) + '分'; }
  function __ul(unit){ return unit === 'sec' ? '秒' : '分钟'; }
  function __uv(sec, unit){ if (sec == null) return ''; if (unit === 'sec') return Math.round(sec); return +(sec/60).toFixed(1); }

  // ===== 研究数据导出引擎 =====
  var TONE_NAME = { jue:'角音', zhi:'徵音', gong:'宫音', shang:'商音', yu:'羽音' };
  var TONE2WUTAI = { jue:'怒', zhi:'喜', gong:'思', shang:'忧', yu:'恐' };
  function __wd(){ try { return window.WUYIN_DATA || []; } catch(e){ return []; } }
  function __toneName(id){ if (TONE_NAME[id]) return TONE_NAME[id]; var d = __wd(); for (var i=0;i<d.length;i++) if (d[i].id === id) return d[i].name; return id || ''; }
  function __musicName(toneId, musicId){
    if (!musicId) return '';
    var d = __wd(), m = /^([a-z]+)_m(\d+)$/i.exec(String(musicId));
    for (var i=0;i<d.length;i++){
      if (d[i].id === toneId || (m && d[i].id === m[1])){
        if (m){ var idx = parseInt(m[2],10)-1; var tr = d[i].audioTracks && d[i].audioTracks[idx]; if (tr){ var mm = /([^\/]+)$/.exec(String(tr)); if (mm) return mm[1].replace(/\.[a-z0-9]+$/i,''); } }
        return String(musicId);
      }
    }
    return String(musicId);
  }
  function __sceneName(toneId, sceneId){
    if (!sceneId) return '';
    var d = __wd();
    for (var i=0;i<d.length;i++){
      if (d[i].id === toneId && d[i].sceneList){
        for (var j=0;j<d[i].sceneList.length;j++) if (d[i].sceneList[j].sceneId === sceneId) return d[i].sceneList[j].name;
      }
    }
    return String(sceneId);
  }
  function __mkTR(t){
    t = t || {};
    var mode = (t.mode === 'today' || t.mode === 'range') ? t.mode : 'full';
    return { mode: mode, from: (mode === 'range' && t.from) ? t.from : '', to: (mode === 'range' && t.to) ? t.to : '' };
  }
  function __inTR(ds, TR){
    if (!ds) return false;
    if (TR.mode === 'today') return ds === todayStr();
    if (TR.mode === 'range'){ if (TR.from && ds < TR.from) return false; if (TR.to && ds > TR.to) return false; return true; }
    return true;
  }
  function __trLabel(TR){
    if (TR.mode === 'today') return '当日（' + todayStr() + '）';
    if (TR.mode === 'range') return '自选日期 ' + (TR.from || '?') + ' 至 ' + (TR.to || '?');
    return '全部历史';
  }
  function __readUserData(id){
    var out = {}, pre = 'wuyin' + id + ':';
    // 第一遍：读取该用户前缀的键（优先）
    for (var i=0;i<LS.length;i++){ var k = rawKey(i); if (typeof k === 'string' && k.indexOf(pre) === 0){ var v = rawGet(k); if (v === null) continue; var nm = k.slice(pre.length); try { out[nm] = JSON.parse(v); } catch(e){ out[nm] = v; } } }
    // 第二遍：无前缀旧键只归属“唯一所有者”。仅当本用户就是 owner 时才兜底读无前缀键，
    // 其他用户绝不可读/合并无前缀共享值，保证多用户数据严格隔离不串台
    var isOwner = (typeof __legacyOwnerId === 'function') ? (String(id) === __legacyOwnerId()) : false;
    if (isOwner) {
      for (var j=0;j<LS.length;j++){
        var k2 = rawKey(j);
        if (typeof k2 !== 'string') continue;
        if (GLOBAL[k2] || k2.charAt(5) === ':') continue;
        if (k2.indexOf('wuyin_') !== 0) continue;
        var nm2 = k2.slice(6);
        var v2 = rawGet(k2);
        if (v2 === null) continue;
        var lg2; try { lg2 = JSON.parse(v2); } catch(e){ lg2 = v2; }
        if (out.hasOwnProperty(nm2)) {
          // 带前缀与无前缀并集合并：数组按时间戳去重，对象补缺失键，保证历史不丢、不重复
          out[nm2] = __unionValues(out[nm2], lg2);
        } else {
          out[nm2] = lg2;
        }
      }
    }
    return out;
  }
  function __fbChoice(r){
    var p = [];
    if (r.needChangeMusic) p.push('换曲目');
    if (r.needChangeScene) p.push('换情境');
    if (r.keepChoice) p.push('保持现状');
    if (!p.length && r.comment) p.push(r.feedbackType === 'voice' ? '语音反馈' : '文字反馈');
    return p.length ? p.join('+') : '无';
  }
  // ===== 问卷计分辅助（answers 为 84 题数组，每轮17题=前10情绪+后7躯体）=====
  var BODY_GROUPS = [
    { name:'心血管', n:[1,2,3] },
    { name:'脑神经', n:[4,5,6,7,8,9] },
    { name:'消化', n:[10,11,12,13,14,15,16,17] },
    { name:'呼吸', n:[18,19] },
    { name:'泌尿', n:[20,21,22,23] },
    { name:'四肢肌肉', n:[24,25,26,27,28,29] },
    { name:'其他', n:[30,31,32,33,34] }
  ];
  function __ansAt(arr, type, n){
    var k = n - 1;
    if (type === 'emotion'){ var r = Math.floor(k / 10), loc = k % 10; return arr[r * 17 + loc]; }
    var r2 = Math.floor(k / 7), loc2 = k % 7; return arr[r2 * 17 + 10 + loc2];
  }
  function __scoreQuestionnaire(res){
    var scores = res.scores || {}, ans = res.answers || [];
    var emoTotal = 0, emoPos = 0, i, body = {}, bodyTotal = 0, bodyPos = 0;
    ['jue','zhi','gong','shang','yu'].forEach(function(k){ emoTotal += (scores[k] || 0); });
    for (i = 1; i <= 50; i++){ if (__ansAt(ans, 'emotion', i) >= 3) emoPos++; }
    BODY_GROUPS.forEach(function(g){
      var s = 0; g.n.forEach(function(nn){ s += (__ansAt(ans, 'body', nn) || 0); });
      body[g.name] = s; bodyTotal += s;
    });
    for (i = 1; i <= 34; i++){ if (__ansAt(ans, 'body', i) >= 3) bodyPos++; }
    return { emotionTotal: emoTotal, emotionPositive: emoPos, body: body, bodyTotal: bodyTotal, bodyPositive: bodyPos };
  }
  // ===== 当前问卷（从未归档，直接读 wuyin_questionnaire_answers 计分）=====
  var __Q_EMOTION_IDS = {
    jue:[1,2,7,11,13,17,28,29,37,43], zhi:[6,9,15,16,20,23,27,36,42,47],
    gong:[3,8,10,18,19,25,33,40,44,50], shang:[12,21,24,30,31,32,38,39,46,48],
    yu:[4,5,14,22,26,34,35,41,45,49]
  };
  // 从当前 answers（84/50 数组）计算情绪得分，供无 history 时复用计分与推荐
  function __curQuestionnaire(D){
    var answers = D.questionnaire_answers;
    if (!Array.isArray(answers) || answers.length < 1) { var qz0 = D.qingzhi; if (Array.isArray(qz0) && qz0.length >= 5) { var qzScores = { jue:qz0[0], zhi:qz0[1], gong:qz0[2], shang:qz0[3], yu:qz0[4] }; return { scores: qzScores, answers: answers || [], ts: Number(D.questionnaire_completed_time) || Date.now() }; } return null; }
    var emotionAnswers = [];
    if (answers.length >= 78) { for (var r = 0; r < 5; r++) for (var q = 0; q < 10; q++) emotionAnswers.push(answers[r * 17 + q]); }
    else if (answers.length >= 50) { emotionAnswers = answers.slice(0, 50); }
    else { var fullRounds = Math.floor(answers.length / 17); for (var rp = 0; rp < Math.min(fullRounds, 5); rp++) for (var qp = 0; qp < 10; qp++) { var ix = rp * 17 + qp; if (ix < answers.length && answers[ix] != null) emotionAnswers.push(answers[ix]); } if (!emotionAnswers.length && answers.length >= 1) emotionAnswers = answers.slice(0, Math.min(50, answers.length)); }
    var scores = { jue:0, zhi:0, gong:0, shang:0, yu:0 };
    emotionAnswers.forEach(function(ans, idx){
      if (typeof ans !== 'number' || ans < 0 || ans > 4) return;
      var qNum = idx + 1;
      for (var id in __Q_EMOTION_IDS) { if (__Q_EMOTION_IDS[id].indexOf(qNum) >= 0) { scores[id] += ans; break; } }
    });
    var hasEmo = false; for (var k2 in scores) if (scores[k2] > 0) { hasEmo = true; break; }
    if (!hasEmo) { var qz2 = D.qingzhi; if (Array.isArray(qz2) && qz2.length >= 5) { scores = { jue:qz2[0], zhi:qz2[1], gong:qz2[2], shang:qz2[3], yu:qz2[4] }; } }
    // 返回完整 answers（含躯体），供 __scoreQuestionnaire 计算情绪阳性数 + 躯体化七因子/总分/阳性数
    return { scores: scores, answers: answers, ts: Number(D.questionnaire_completed_time) || (answers.length < 50 && answers.length >= 1 ? Date.now() : 0) };
  }
  // 问卷推荐：两种情志均分(分数/10)差<=0.3 都推荐（与大卡片 prominentIds 阈值一致，原分数差<=3）
  function __qRecTones(sc){
    if (!sc) return [];
    var mx = 0;
    ['jue','zhi','gong','shang','yu'].forEach(function(k){ var v = Number(sc[k]) || 0; if (v > mx) mx = v; });
    if (mx <= 0) return [];
    var arr = ['jue','zhi','gong','shang','yu'].filter(function(k){ var v = Number(sc[k]) || 0; return v > 0 && (mx - v) <= 3; });
    arr.sort(function(a, b){ return (Number(sc[b]) || 0) - (Number(sc[a]) || 0); });
    return arr.length > 2 ? arr.slice(0, 2) : arr;
  }
  function __toneNameList(ids){ return ids.map(__toneName).join('+') || '—'; }
  // ===== 对话轮次计时：每轮 = 本轮首条用户消息 → 该轮分析结束（点击"结束并推荐"）=====
  // 返回 { rounds:[{idx,date,startTs,endTs,durationSec,msgCount,userMsgCount,src}], daily:{date:sec} }
  function __chatTiming(D, TR){
    var AH = (D.ai_chat_history || []).filter(function(x){ return x && (x.timestamp || x.ts); })
      .map(function(x){ return { t: x.timestamp || x.ts || 0, src: x }; })
      .sort(function(a,b){ return a.t - b.t; });
    // 兼容多种时间字段名：time / ts / timestamp / createdAt
    var msgs = (D.chat_messages || []).filter(function(m){ return m && m.role !== 'recommendation' && (m.time || m.ts || m.timestamp || m.createdAt); })
      .map(function(m){ return { t: m.time || m.ts || m.timestamp || m.createdAt, role: m.role }; })
      .sort(function(a,b){ return a.t - b.t; });
    // 先用全量分析计算每轮（确保本轮下界取自真实的前一轮分析，即便前一轮不在 TR 范围内），再按 TR 过滤输出，
    // 从而"单独导出当日"与"导出全部"中的该日数值保持一致
    var rawRounds = [];
    AH.forEach(function(h, i){
      var lower = (i > 0) ? AH[i-1].t : 0; // 上一轮分析时间作为本轮下界
      var firstUser = null, n = 0, un = 0;
      msgs.forEach(function(m){ if (m.t > lower && m.t <= h.t){ if (m.role === 'user' && firstUser == null) firstUser = m.t; n++; if (m.role === 'user') un++; } });
      var startTs = firstUser != null ? firstUser : lower;
      var durSec = (firstUser != null) ? Math.max(0, Math.round((h.t - firstUser) / 1000)) : 0;
      rawRounds.push({ t: h.t, date: h.src.date || __dateOf(h.src.timestamp) || '', src: h.src, startTs: startTs, endTs: h.t, durationSec: durSec, msgCount: n, userMsgCount: un });
    });
    // 兜底：若某轮未匹配到消息（msgCount=0 或 durationSec=0），从 usage_daily 取该日对话秒数，
    // 并按各轮均分；消息数则取 chat_messages 中该日的全部消息数
    var ud = D.usage_daily || {};
    rawRounds.forEach(function(r){
      if (r.msgCount === 0 || r.durationSec === 0){
        var dk = r.date;
        var dayMsgs = (D.chat_messages || []).filter(function(m){ return m && m.role !== 'recommendation' && __dateOf(m.time || m.ts || m.timestamp || m.createdAt) === dk; });
        if (r.msgCount === 0) { r.msgCount = dayMsgs.length; r.userMsgCount = dayMsgs.filter(function(m){ return m.role === 'user'; }).length; }
        if (r.durationSec === 0){
          var ux = ud[dk] || {};
          var chatSec = Math.max(ux.chat || 0, Math.round((ux.chatMins || 0) * 60));
          // 该日可能有多轮，按轮数均分（仅用于兜底估算）
          var roundsThisDay = rawRounds.filter(function(x){ return x.date === dk; }).length || 1;
          r.durationSec = Math.round(chatSec / roundsThisDay);
        }
      }
    });
    var rounds = [], daily = {};
    rawRounds.forEach(function(r, i){
      if (!__inTR(r.date, TR)) return;
      var rd = { idx: rounds.length + 1, date: r.date, time: __timeOf(r.t), startTs: r.startTs, endTs: r.endTs, durationSec: r.durationSec, msgCount: r.msgCount, userMsgCount: r.userMsgCount, recTone: r.src.primaryToneName || r.src.primaryTone || '', recDualTone: r.src.secondaryToneName || '', primaryEmotion: r.src.primaryEmotion || '', secondaryEmotion: r.src.secondaryEmotion || '', primaryWutai: r.src.primaryWutai || '', summary: r.src.summary || '', src: r.src };
      rounds.push(rd);
      if (rd.date) daily[rd.date] = (daily[rd.date] || 0) + rd.durationSec;
    });
    return { rounds: rounds, daily: daily };
  }
  // ===== 疗愈记录试听判定 =====
  // 新数据：isTrial===true 或 自选时长===1（试听恒 1 分钟，正常自选仅 10/20/30/45）
  // 历史旧数据（无 isTrial/durationMin）：非 {10,20,30,45} 且 早于该用户"完整情志测评结果"完成时间，且约1分钟 → 视为试听
  function __isTrial(r, completeTs){
    if (!r) return false;
    if (r.isTrial === true) return true;
    var dm = r.durationMin;
    if (dm === 1) return true;
    var std = [10, 20, 30, 45];
    if (typeof dm === 'number' && std.indexOf(dm) >= 0) return false; // 明确选择标准正式时长 → 正式疗愈
    // 无明确标准时长（含旧数据缺 durationMin）→ 需在完成完整情志测评之前才算试听
    if (typeof r.timestamp === 'number' && completeTs && r.timestamp < completeTs) return true;
    return false;
  }
  // 时辰→调式（子23-1羽、丑1-3羽、寅3-5角、卯5-7角、辰7-9宫、巳9-11宫、午11-13徵、未13-15徵、申15-17商、酉17-19商、戌19-21宫、亥21-23羽）
  function __shichenTone(hour){
    if (hour >= 23 || hour < 3) return 'yu';
    if (hour >= 3 && hour < 7) return 'jue';
    if (hour >= 7 && hour < 11) return 'gong';
    if (hour >= 11 && hour < 15) return 'zhi';
    if (hour >= 15 && hour < 19) return 'shang';
    return 'gong';
  }

  function buildReport(uid, opts){
    opts = opts || {};
    var TR = __mkTR(opts.time);
    var C = opts.content || { profile:1, usage:1, healing:1, chat:1, emotion:1, rating:1, recommend:1 };
    var D = __readUserData(uid);
    var u = getUsers().filter(function(x){ return String(x.id) === String(uid); })[0] || null;
    // 完整情志测评完成时间（毫秒）：用于把"完成测评之前"的历史试听从正式疗愈中识别出来
    var completeTs = Number(D.questionnaire_completed_time) || 0;
    // 编号：研究用固定标识（编号+ID），后台与导出均显示编号而非昵称（昵称仅用户本人查看）
    var code = '编号' + pad(Number(uid) || uid);
    var R = { userId: Number(uid) || uid, userName: code, userCode: code, nickname: u ? u.name : code, generatedAt: Date.now(), timeRange: TR, blocks: {}, raw: D };

    // 一、用户资料
    if (C.profile){
      R.blocks.profile = {
        createdAtStr: u ? __fmtDT(u.createdAt) : '（无）',
        lastActiveStr: u ? __fmtDT(u.lastActive || u.createdAt) : '（无）'
      };
    }

    // 二、使用时长（读秒计时：疗愈/问卷按在APP内实际停留秒数；对话=各轮实际对话时长之和）
    // 疗愈时长数据源：①usage_daily 心跳/recordUsage ②healing_records 实际聆听时长（取三者较大值，确保与疗愈记录一致）
    if (C.usage){
      var all = D.usage_daily || {}, rows = [];
      var chatT = (typeof __chatTiming === 'function') ? __chatTiming(D, TR) : { daily: {} };
      // 从疗愈记录按日汇总实际聆听秒数（含试听，因试听用户确实花费了时间）
      var healByDay = {};
      var healSess = {};
      (D.healing_records || []).forEach(function(r, idx){
        if (!r) return;
        if (__isTrial(r, completeTs)) return; // 试听不计入使用时长日明细的疗愈分钟
        var dk = __dateOf(r.timestamp != null ? r.timestamp : r.date);
        if (!dk) return;
        var sec = (typeof r.actualSec === 'number' && r.actualSec > 0) ? r.actualSec : 0;
        // 组合疗愈同一会话按调式拆成多行(相同timestamp且actualSec=整会话时长)：按会话归组只计一次
        var key = (r.timestamp != null) ? ('t' + r.timestamp) : ('x' + idx);
        if (!healSess[key]) healSess[key] = { sec: 0, dk: dk };
        if (sec > healSess[key].sec) healSess[key].sec = sec;
      });
      Object.keys(healSess).forEach(function(k){ var s = healSess[k]; if (s.sec > 0) healByDay[s.dk] = (healByDay[s.dk] || 0) + s.sec; });
      var qS = 0, sH = 0, sC = 0, sQ = 0, days = 0, firstTs = null, lastTs = null;
      var qzUsed = 0;
      var _qfU = (D.quiz_fill && Array.isArray(D.quiz_fill.rounds)) ? D.quiz_fill : null;
      var _qfUTotal = _qfU ? _qfU.rounds.reduce(function(a,b){ return a + (Number(b)||0); }, 0) : 0;
      var _qfUDate = _qfU ? __dateOf(_qfU.updatedAt) : '';
      // 遍历 usage_daily 与 healByDay 的日期并集
      var dayKeys = {};
      Object.keys(all).forEach(function(k){ dayKeys[k] = 1; });
      Object.keys(healByDay).forEach(function(k){ dayKeys[k] = 1; });
      Object.keys(dayKeys).sort().forEach(function(k){
        var x = all[k] || {};
        if (!__inTR(k, TR)) return;
        // 合并 heartbeat 秒数 + recordUsage 分钟数 + 疗愈记录实际时长（取较大值）
        var hSec = x.healing || 0, hMin = x.healingMins || 0;
        var cSec = x.chat || 0, cMin = x.chatMins || 0;
        var qSec = x.quiz || 0, qMin = x.quizMins || 0;
        var h = healByDay[k] || 0;
        var q = Math.max(qSec, Math.round(qMin * 60)); if (k === _qfUDate && _qfUTotal > q) q = _qfUTotal;
        // 对话时长：优先各轮实际对话时长，其次 heartbeat 秒数，最后 recordUsage 分钟数
        var c = chatT.daily[k] || 0;
        if (!c) c = Math.max(cSec, Math.round(cMin * 60));
        rows.push({ date: k, healing: h, chat: c, quiz: q, total: h + c + q });
        sH += h; sC += c; sQ += q; qzUsed += c;
        if (h + c + q > 0){ days++; if (firstTs == null || (x.firstTs||0) < firstTs) firstTs = x.firstTs || null; }
        if ((x.lastTs||0) > (lastTs||0)) lastTs = x.lastTs || null;
      });
      R.blocks.usage = { summary: { healingSec: sH, chatSec: sC, quizSec: sQ, totalSec: sH+sC+sQ, days: days, firstTs: firstTs, lastTs: lastTs }, daily: rows };
    }

    // 三、疗愈使用（试听记录仅进日记，不计入正式疗愈命中/正式疗愈计时）
    if (C.healing){
      var hr = (D.healing_records || []).filter(function(r){ return r && __inTR(__dateOf(r.timestamp != null ? r.timestamp : r.date), TR); });
      var sessSet = {};
      hr.forEach(function(r){ if (r.timestamp && !__isTrial(r, completeTs)) sessSet[r.timestamp] = 1; });
      // 组合疗愈在存储时写成了同一 timestamp 的多条记录（每调式一条）。将其按 (date|time) 分组合并成一行，
      // 调式/曲目/情境用“+”连接（如 羽音+宫音）。单模式每条独立一行。
      var groups = {}, order = [];
      hr.forEach(function(r){
        var actualSec = (typeof r.actualSec === 'number' && r.actualSec > 0) ? r.actualSec : null;
        var trial = __isTrial(r, completeTs);
        var selfDur = (typeof r.durationMin === 'number') ? r.durationMin : (trial ? 1 : null);
        var date = r.date || __dateOf(r.timestamp) || '';
        var time = __timeOf(r.timestamp);
        var toneId = r.toneId || '';
        var musicName = __musicName(toneId, r.musicId);
        var sceneName = __sceneName(toneId, r.sceneId);
        // 多条归并：返回是否新增，便于判断该组是否为组合行
        var key = date + '|' + time;
        if (!groups[key]){
          groups[key] = {
            date: date, time: time,
            toneIds: {}, tones: [], musicIds: {}, musics: [], sceneIds: {}, scenes: [],
            selfDurMin: selfDur, listenSec: trial ? null : actualSec,
            listenMin: (trial || actualSec == null) ? null : +(actualSec / 60).toFixed(1),
            rating: (r.rating != null ? r.rating : null), feedback: __fbChoice(r), comment: r.comment || '',
            isTrial: trial, isDual: false, n: 0
          };
          order.push(key);
        }
        var g = groups[key];
        g.n++;
        if (g.n > 1) g.isDual = true; // 同一 date|time 出现第二条 → 组合疗愈
        var tp = (g.toneIds[toneId] = (g.toneIds[toneId]||0) + 1);
        // 调式名优先由 toneId 解析（组合疗愈多条记录可能残留同一播放器调式名 r.tone，用 toneId 才能区分各条真实调式）
        if (tp === 1) g.tones.push(__toneName(toneId) || r.tone || '');
        var mp = (g.musicIds[r.musicId] = (g.musicIds[r.musicId]||0) + 1);
        if (mp === 1 && musicName) g.musics.push(musicName);
        var sp = (g.sceneIds[r.sceneId] = (g.sceneIds[r.sceneId]||0) + 1);
        if (sp === 1 && sceneName) g.scenes.push(sceneName);
        // 组合同一时刻的评分/评语取最早一条
        if (g.n === 1){ g.selfDurMin = selfDur; g.listenSec = trial ? null : actualSec; g.listenMin = (trial || actualSec == null) ? null : +(actualSec / 60).toFixed(1); g.rating = (r.rating != null ? r.rating : null); g.feedback = __fbChoice(r); g.comment = r.comment || ''; g.isTrial = trial; }
      });
      var rows = order.map(function(key){
        var g = groups[key];
        return {
          date: g.date, time: g.time,
          tone: g.tones.length ? g.tones.join('+') : '',
          music: g.musics.length ? g.musics.join('+') : '',
          scene: g.scenes.length ? g.scenes.join('+') : '',
          selfDurMin: g.selfDurMin,
          listenSec: g.listenSec,
          listenMin: g.listenMin,
          rating: g.rating,
          feedback: g.feedback,
          comment: g.comment,
          isTrial: g.isTrial
        };
      });
      // 正式疗愈计时 = 非试听记录 actualSec 之和（与明细一致）；试听(1分钟)不计入
      var healTotalSec = 0, trialN = 0;
      rows.forEach(function(r){ if (!r.isTrial && r.listenSec != null) healTotalSec += r.listenSec; if (r.isTrial) trialN++; });
      var toneCounts = {}, ratedN = 0, ratedSum = 0;
      rows.forEach(function(r){
        var tl = String(r.tone).split('+').filter(Boolean);
        if (!tl.length) tl = [r.tone];
        tl.forEach(function(t){ toneCounts[t] = (toneCounts[t]||0) + 1; });
        if (r.rating != null){ ratedN++; ratedSum += r.rating; }
      });
      R.blocks.healing = {
        summary: { sessions: Object.keys(sessSet).length || hr.filter(function(r){ return !__isTrial(r, completeTs); }).length, toneCounts: toneCounts, trialCount: trialN, actualMin: +(healTotalSec / 60).toFixed(1), avgRating: ratedN ? +(ratedSum/ratedN).toFixed(2) : null },
        detail: rows
      };
    }

    // 四、AI 对话（每轮一行=一次分析，不含对话原文）
    if (C.chat){
      // 每轮实际对话时长 = 本轮首条用户消息 → 点击"结束并推荐"（该轮分析结束）
      var cT = (typeof __chatTiming === 'function') ? __chatTiming(D, TR) : { rounds: [] };
      var srows = cT.rounds.map(function(r){
        return {
          idx: r.idx,
          date: r.date,
          time: r.time,
          durationSec: r.durationSec,
          msgCount: r.msgCount,
          userMsgCount: r.userMsgCount,
          primaryEmotion: r.primaryEmotion,
          secondaryEmotion: r.secondaryEmotion,
          primaryWutai: r.primaryWutai,
          recTone: r.recTone,
          recDualTone: r.recDualTone,
          summary: r.summary
        };
      });
      var totSec = 0, nDur = 0, totMsg = 0, totUser = 0;
      srows.forEach(function(x){
        var real = (x.durationSec || 0);
        if (x.durationSec != null && x.durationSec > 0){ totSec += real; nDur++; }
        totMsg += x.msgCount; totUser += x.userMsgCount;
      });
      R.blocks.chat = {
        summary: { sessions: srows.length, totalSec: totSec, avgSec: nDur ? Math.round(totSec/nDur) : 0, msgTotal: totMsg, userMsgTotal: totUser },
        detail: srows
      };
    }

    // 五、情志分析
    if (C.emotion){
      var el = (D.chat_emotion_log || []).filter(function(x){ return x && __inTR(__dateOf(x.time), TR); });
      var kw = {}, wutai = {};
      el.forEach(function(x){
        kw[x.emotion] = (kw[x.emotion]||0) + 1;
        var w = TONE2WUTAI[x.wuyinId] || x.wuyinId || '';
        if (w) wutai[w] = (wutai[w]||0) + 1;
      });
      var qh = (D.questionnaire_history || []).filter(function(x){ return x && __inTR(x.date, TR); });
      var qrows = qh.map(function(x){
        return Object.assign({ date: x.date || '', time: x.time || '', title: x.title || '', scores: x.scores || null, quizFillSec: (typeof x.quizFillSec === 'number') ? x.quizFillSec : 0, quizRounds: (Array.isArray(x.quizRounds)) ? x.quizRounds : [] }, __scoreQuestionnaire(x));
      });
      // 兜底：首次问卷未归档 history，但存在当前题库（wuyin_questionnaire_answers）或当前五态 qingzhi。
      // 生成一条"当前情志测评"记录，并从真实答案计算情绪总分/阳性数 + 躯体化七因子/总分/阳性数。
      if (!qrows.length) {
        var curQ2 = (typeof __curQuestionnaire === 'function') ? __curQuestionnaire(D) : null;
        if (curQ2 && curQ2.scores) {
          var qDate2 = __dateOf(curQ2.ts) || todayStr();
          var sc2 = __scoreQuestionnaire({ scores: curQ2.scores, answers: curQ2.answers });
          var _cf = (D.quiz_fill && Array.isArray(D.quiz_fill.rounds)) ? D.quiz_fill : null;
          var _cft = _cf ? _cf.rounds.reduce(function(a,b){ return a + (Number(b)||0); }, 0) : 0;
          var qrow2 = Object.assign({ date: qDate2, time: __timeOf(curQ2.ts), title: '当前情志测评', scores: curQ2.scores, isCurrent: true, quizFillSec: _cft, quizRounds: _cf ? _cf.rounds.slice() : [] }, sc2);
          qrows.push(qrow2);
        }
      }
      var inRangeHist = (D.ai_chat_history || []).filter(function(x){ return x && __inTR(x.date || __dateOf(x.timestamp), TR); });
      var rec = inRangeHist.length ? inRangeHist[inRangeHist.length-1] : null;
      var bias = null;
      if (rec){
        bias = {
          date: rec.date || __dateOf(rec.timestamp) || '',
          summary: rec.summary || '',
          primaryEmotion: rec.primaryEmotion || '',
          secondaryEmotion: rec.secondaryEmotion || '',
          primaryWutai: rec.primaryWutai || '',
          primaryTone: rec.primaryToneName || rec.primaryTone || '',
          secondaryTone: rec.secondaryToneName || '',
          evidence: (rec.evidence || []).slice(0, 3)
        };
      }
      // AI 情绪识别明细已并入"AI对话"板块，此处不再重复逐条，仅保留词云频次统计
      var _qFill = (D.quiz_fill && Array.isArray(D.quiz_fill.rounds)) ? D.quiz_fill : null;
      var quizFillSec = _qFill ? (_qFill.rounds||[]).reduce(function(a,b){ return a + (Number(b)||0); }, 0) : 0;
      R.blocks.emotion = { summary: { keywordFreq: kw, wutaiDist: wutai, quizFillSec: quizFillSec, quizRounds: _qFill ? _qFill.rounds.slice() : [] }, biasCard: bias, questionnaire: qrows };
    }

    // 六、疗愈评分趋势（按次，取自疗愈日记）
    if (C.rating){
      var vd = (D.voice_diary || []).filter(function(x){ return x && __inTR(x.date, TR); });
      var rrows = vd.map(function(x){
        return { date: x.date || '', time: x.time || '', tone: x.wuyinName || (x.wuyinNames ? x.wuyinNames.join('+') : ''), rating: (x.rating != null ? x.rating : null) };
      });
      var rn = 0, rsum = 0;
      rrows.forEach(function(r){ if (r.rating != null){ rn++; rsum += r.rating; } });
      R.blocks.rating = { summary: { count: rrows.length, avgRating: rn ? +(rsum/rn).toFixed(2) : null }, detail: rrows };
    }

    // 七、推荐命中（AI推荐调式 vs 实际疗愈调式）
    if (C.recommend){
      // 三来源推荐：AI对话（≤3天）、情志问卷（最近一次，含"当前题库"兜底）、时辰（该次疗愈所在时辰）
      var recs = (D.ai_chat_history || []).filter(function(x){ return x && x.timestamp; }).sort(function(a,b){ return a.timestamp - b.timestamp; });
      var qhRec = (D.questionnaire_history || []).filter(function(x){ return x; });
      // 无历史（从未重新测评）时，用当前题库（wuyin_questionnaire_answers / wuyin_qingzhi）作为问卷推荐来源
      var curQ = (qhRec.length === 0 && typeof __curQuestionnaire === 'function') ? __curQuestionnaire(D) : null;
      if (curQ) qhRec.push({ date: __dateOf(curQ.ts), time: __timeOf(curQ.ts), scores: curQ.scores });
      function tsOfQ(x){
        var d = new Date(String(x.date)); var t = String(x.time || '00:00').split(':'); d.setHours(+t[0] || 0, +t[1] || 0, 0, 0); return d.getTime();
      }
      var hrAll = (D.healing_records || []).filter(function(x){ return x && x.timestamp; });
      var sessMap = {}, order = [];
      hrAll.forEach(function(r){
        if (__isTrial(r, completeTs)) return; // 试听记录不计入命中对照
        if (!sessMap[r.timestamp]){ sessMap[r.timestamp] = { timestamp: r.timestamp, date: r.date || __dateOf(r.timestamp), tones: [] }; order.push(r.timestamp); }
        sessMap[r.timestamp].tones.push(r.toneId);
      });
      order.sort();
      function toneNames(ids){ return ids.map(function(t){ return __toneName(t); }).join('+'); }
      var mrows = [];
      order.forEach(function(ts){
        var s2 = sessMap[ts];
        if (!__inTR(s2.date, TR)) return;
        var nowT = Date.now(), THREE3 = 3 * 24 * 3600 * 1000, hour = new Date(ts).getHours();
        // 时辰
        var scTone = __shichenTone(hour);
        // AI（最近一次分析 ≤3天 且早于该次疗愈）
        var bestAI = null;
        for (var ii = 0; ii < recs.length; ii++){ var rc = recs[ii]; if (rc.timestamp <= ts && (nowT - rc.timestamp) <= THREE3){ bestAI = rc; } }
        var aiTones = bestAI ? [bestAI.primaryTone] : [];
        if (bestAI && bestAI.secondaryTone && bestAI.secondaryTone !== bestAI.primaryTone) aiTones.push(bestAI.secondaryTone);
        // 问卷（最近一次完成 早于或等于该次疗愈；两种情志相差小则推荐两个）
        var bestQ = null;
        for (var j2 = 0; j2 < qhRec.length; j2++){ var qr = qhRec[j2]; var qts = tsOfQ(qr); if (qts <= ts){ if (!bestQ || qts > tsOfQ(bestQ)) bestQ = qr; } }
        var qTones = bestQ ? __qRecTones(bestQ.scores) : [];
        // 实际（试听记录不计入命中对照）
        var T = (s2.tones || []);
        var allNames = {};
        aiTones.forEach(function(t){ allNames[t] = 1; }); qTones.forEach(function(t){ allNames[t] = 1; }); allNames[scTone] = 1;
        var anyIn = T.some(function(t){ return allNames[t]; });
        var allIn = T.length > 0 && T.every(function(t){ return allNames[t]; });
        // 来源
        var srcList = [];
        if (aiTones.some(function(t){ return T.indexOf(t) >= 0; })) srcList.push('AI推荐');
        if (qTones.some(function(t){ return T.indexOf(t) >= 0; })) srcList.push('问卷推荐');
        if (T.indexOf(scTone) >= 0) srcList.push('时辰推荐');
        var status, source;
        if (!anyIn){ status = '未命中'; source = '用户自选'; }
        else if (allIn){ status = '命中'; source = srcList.length ? srcList.join('+') : '用户自选'; }
        else { status = '半命中'; var sl = srcList.slice(); sl.push('用户自选'); source = sl.join('+'); }
        mrows.push({
          date: s2.date, time: __timeOf(ts),
          recQuestionnaire: toneNames(qTones) || '—',
          recAI: toneNames(aiTones) || '—',
          recShichen: __toneName(scTone),
          actual: toneNames(T),
          status: status, source: source, matched: (status === '命中')
        });
      });
      var hits = mrows.filter(function(r){ return r.matched; }).length;
      var half = mrows.filter(function(r){ return r.status === '半命中'; }).length;
      R.blocks.recommend = { summary: { total: mrows.length, hits: hits, half: half, hitRate: mrows.length ? Math.round(hits*100/mrows.length) + '%' : '—' }, detail: mrows };
    }

    return R;
  }

  // ===== 可读文本格式化 =====
  function reportToText(rep, unit){
    var L = [], B = rep.blocks;
    L.push('==========================================');
    L.push('编号：' + rep.userCode + '（昵称：' + (rep.nickname || '—') + '）');
    L.push('导出时间：' + __fmtDT(rep.generatedAt));
    L.push('时间范围：' + __trLabel(rep.timeRange));
    L.push('时长单位：' + (unit === 'sec' ? '秒钟' : '分钟'));
    L.push('==========================================');
    if (B.profile){
      L.push('');
      L.push('【一、用户资料】');
      L.push('  编号：' + rep.userCode);
      L.push('  昵称：' + (rep.nickname || '—'));
      L.push('  创建时间：' + B.profile.createdAtStr);
      L.push('  最后活跃：' + B.profile.lastActiveStr);
    }
    if (B.usage){
      var s = B.usage.summary;
      L.push('');
      L.push('【二、使用时长】');
      L.push('  ── 汇总 ──');
      L.push('  疗愈 ' + __u(s.healingSec, unit) + '；对话 ' + __u(s.chatSec, unit) + '；问卷 ' + __u(s.quizSec, unit));
      L.push('  总时长 ' + __u(s.totalSec, unit) + '；使用 ' + s.days + ' 天');
      L.push('  首次使用：' + __fmtDT(s.firstTs) + '；最后使用：' + __fmtDT(s.lastTs));
      L.push('  ── 每日明细（日期 | 疗愈 | 对话 | 问卷 | 合计）──');
      if (!B.usage.daily.length) L.push('  （无记录）');
      B.usage.daily.forEach(function(d){ L.push('  ' + d.date + ' | ' + __u(d.healing, unit) + ' | ' + __u(d.chat, unit) + ' | ' + __u(d.quiz, unit) + ' | ' + __u(d.total, unit)); });
    }
    if (B.healing){
      var hs = B.healing.summary;
      L.push('');
      L.push('【三、疗愈使用】');
      L.push('  ── 汇总 ──');
      L.push('  疗愈次数：' + hs.sessions + ' 次（双调式按1次计）');
      L.push('  实际累计疗愈时长：' + (hs.actualMin || 0) + ' 分钟');
      var tc = Object.keys(hs.toneCounts).map(function(k){ return k + '×' + hs.toneCounts[k]; });
      L.push('  调式分布：' + (tc.length ? tc.join('、') : '无'));
      L.push('  平均评分：' + (hs.avgRating != null ? hs.avgRating : '—'));
      L.push('  ── 明细（日期 时间 | 调式 | 曲目 | 情境 | 自选时长(分钟) | 实际聆听时长(分钟) | 实际聆听时长(秒钟) | 试听 | 评分 | 反馈选择 | 评语）──');
      if (!B.healing.detail.length) L.push('  （无记录）');
      B.healing.detail.forEach(function(r){
        L.push('  ' + r.date + ' ' + (r.time||'') + ' | ' + r.tone + ' | ' + (r.music||'—') + ' | ' + (r.scene||'—') + ' | ' + (r.selfDurMin != null ? r.selfDurMin : '—') + ' | ' + (r.listenMin != null ? r.listenMin : '—') + ' | ' + (r.listenSec != null ? Math.round(r.listenSec) : '—') + ' | ' + (r.isTrial ? '是' : '—') + ' | ' + (r.rating != null ? r.rating : '—') + ' | ' + r.feedback + ' | ' + (r.comment || ''));
      });
    }
    if (B.chat){
      var chs = B.chat.summary;
      L.push('');
      L.push('【四、AI 对话分析】');
      L.push('  ── 汇总 ──');
      L.push('  对话分析次数：' + chs.sessions + ' 次（每次一轮，每次一份情志分析）；总时长 ' + __u(chs.totalSec, unit) + '；平均每轮 ' + __u(chs.avgSec, unit) + '；消息合计 ' + chs.msgTotal + ' 条（其中用户 ' + chs.userMsgTotal + ' 条）');
      L.push('  ── 明细（轮次 | 日期 时间 | 实际对话时长 | 消息数 | 情志关键词 | 五态 | 推荐调式 | 总结）──');
      if (!B.chat.detail.length) L.push('  （无记录）');
      B.chat.detail.forEach(function(x){
        L.push('  第' + x.idx + '轮 | ' + x.date + ' ' + (x.time||'') + ' | ' + +(x.durationSec/60).toFixed(1) + '分钟 / ' + Math.round(x.durationSec) + '秒 | ' + x.msgCount + ' | ' + (x.primaryEmotion||'—') + (x.secondaryEmotion ? '（次：' + x.secondaryEmotion + '）' : '') + ' | ' + (x.primaryWutai||'—') + ' | ' + (x.recTone||'—') + (x.recDualTone ? '+' + x.recDualTone : '') + ' | ' + (x.summary||''));
      });
    }
    if (B.emotion){
      L.push('');
      L.push('【五、情志分析与变化】');
      var kwArr = Object.keys(B.emotion.summary.keywordFreq).map(function(k){ return k + '×' + B.emotion.summary.keywordFreq[k]; });
      L.push('  ── 情绪关键词频次（词云数据，来自AI对话分析）──');
      L.push('  ' + (kwArr.length ? kwArr.join('、') : '无'));
      var wArr = Object.keys(B.emotion.summary.wutaiDist).map(function(k){ return k + '×' + B.emotion.summary.wutaiDist[k]; });
      L.push('  ── 五态情志分布（AI识别累计）──');
      L.push('  ' + (wArr.length ? wArr.join('、') : '无'));
      var bc = B.emotion.biasCard;
      L.push('  ── 近期情志偏向卡片 ──');
      if (bc){
        L.push('  日期：' + bc.date + '；总结：' + (bc.summary || ''));
        L.push('  主要情志：' + bc.primaryEmotion + '（五态：' + bc.primaryWutai + '）' + (bc.secondaryEmotion ? '；次要：' + bc.secondaryEmotion : ''));
        L.push('  推荐调式：' + bc.primaryTone + (bc.secondaryTone ? '+' + bc.secondaryTone : ''));
        if (bc.evidence && bc.evidence.length){
          bc.evidence.forEach(function(ev, i){ L.push('  依据' + (i+1) + '：' + ev); });
        }
      } else { L.push('  （无）'); }
      L.push('  ── 情志测评（问卷渠道：日期 | 时间 | 角(怒) | 徵(喜) | 宫(思) | 商(忧) | 羽(恐) | 情绪总分 | 情绪阳性数 | 心血管 | 脑神经 | 消化 | 呼吸 | 泌尿 | 四肢肌肉 | 其他 | 躯体化总分 | 躯体化阳性数）──');
      if (!B.emotion.questionnaire.length) L.push('  （无记录）');
      B.emotion.questionnaire.forEach(function(x){
        var sc = x.scores || {}, bd = x.body || {};
        function bv(k){ return (bd[k] != null) ? bd[k] : '—'; }
        function dv(v){ return (v != null) ? v : '—'; }
        L.push('  ' + x.date + ' | ' + (x.time||'') + ' | ' + (sc.jue!=null?sc.jue:'—') + ' | ' + (sc.zhi!=null?sc.zhi:'—') + ' | ' + (sc.gong!=null?sc.gong:'—') + ' | ' + (sc.shang!=null?sc.shang:'—') + ' | ' + (sc.yu!=null?sc.yu:'—')
          + ' | ' + dv(x.emotionTotal) + ' | ' + dv(x.emotionPositive)
          + ' | ' + bv('心血管') + ' | ' + bv('脑神经') + ' | ' + bv('消化') + ' | ' + bv('呼吸') + ' | ' + bv('泌尿') + ' | ' + bv('四肢肌肉') + ' | ' + bv('其他')
          + ' | ' + dv(x.bodyTotal) + ' | ' + dv(x.bodyPositive));
      });
      if (B.emotion.summary && B.emotion.summary.quizRounds && B.emotion.summary.quizRounds.length){
        L.push('  ── 问卷填写时长（最近一次测评，逐轮秒数）──');
        L.push('  各轮：' + B.emotion.summary.quizRounds.map(function(s,i){ return 'R' + (i+1) + '=' + s + '秒'; }).join('、') + '；合计：' + B.emotion.summary.quizFillSec + '秒');
      }
    }
    if (B.rating){
      L.push('');
      L.push('【六、疗愈评分趋势】');
      L.push('  ── 汇总 ──');
      L.push('  评分次数：' + B.rating.summary.count + ' 次；平均评分：' + (B.rating.summary.avgRating != null ? B.rating.summary.avgRating : '—'));
      L.push('  ── 明细（日期 | 时间 | 调式 | 评分）──');
      if (!B.rating.detail.length) L.push('  （无记录）');
      B.rating.detail.forEach(function(r){ L.push('  ' + r.date + ' | ' + (r.time||'') + ' | ' + r.tone + ' | ' + (r.rating != null ? r.rating : '—')); });
    }
    if (B.recommend){
      L.push('');
      L.push('【七、推荐命中情况】');
      L.push('  ── 汇总 ──');
      L.push('  有对照的疗愈：' + B.recommend.summary.total + ' 次；命中：' + B.recommend.summary.hits + ' 次；半命中：' + B.recommend.summary.half + ' 次；命中率：' + B.recommend.summary.hitRate);
      L.push('  ── 明细（日期 时间 | 问卷推荐 | AI推荐 | 时辰推荐 | 实际调式 | 状态 | 来源）──');
      if (!B.recommend.detail.length) L.push('  （无记录）');
      B.recommend.detail.forEach(function(r){ L.push('  ' + r.date + ' ' + (r.time||'') + ' | ' + r.recQuestionnaire + ' | ' + r.recAI + ' | ' + r.recShichen + ' | ' + r.actual + ' | ' + r.status + ' | ' + r.source); });
    }
    L.push('');
    return L.join('\r\n');
  }

  // ===== CSV 格式化 =====
  function csvCell(v){
    if (v == null) return '';
    var s = String(v);
    if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function csvRow(arr){ return arr.map(csvCell).join(','); }
  // 单文件多表格段：按逻辑链归组，一个 CSV 文件内用标题行 + 空行分隔多个表
  function reportToCSV(reps, unit){
    var dstr = new Date().toISOString().slice(0, 10);
    var any = reps[0] && reps[0].blocks;
    var lines = [];
    function sec(title, head, rows){
      lines.push('==== ' + title + ' ====');
      lines.push(csvRow(head));
      rows.forEach(function(r){ lines.push(csvRow(r)); });
      lines.push(''); // 段末空行，分隔两个表格
    }
    // ① 汇总表（累计疗愈=实际聆听时长之和）
    if (any){
      var sumRows = reps.map(function(r){
        var b = r.blocks;
        return [r.userCode,
          b.profile ? b.profile.createdAtStr : '', b.profile ? b.profile.lastActiveStr : '',
          b.healing ? b.healing.summary.sessions : '', b.healing ? b.healing.summary.actualMin : '',
          b.chat ? b.chat.summary.sessions : '', b.emotion ? b.emotion.questionnaire.length : '',
          b.recommend ? b.recommend.summary.hitRate : ''];
      });
      sec('汇总', ['编号','创建时间','最后活跃','疗愈次数','实际累计疗愈时长(分钟)','对话分析次数','情志测评次数','推荐命中率'], sumRows);
    }
    // ② 使用时长每日明细（读秒计时：疗愈/问卷按停留秒数，对话=该日各轮之和）
    if (any && any.usage){
      var rows = [];
      reps.forEach(function(r){ if (r.blocks.usage) r.blocks.usage.daily.forEach(function(d){
        rows.push([r.userCode, d.date, __uv(d.healing, unit), __uv(d.chat, unit), __uv(d.quiz, unit), __uv(d.total, unit)]);
      }); });
      sec('使用时长每日明细(读秒计时)', ['编号','日期','疗愈('+__ul(unit)+')','对话('+__ul(unit)+')','问卷('+__ul(unit)+')','合计('+__ul(unit)+')'], rows);
    }
    // ③ 疗愈记录（含评分趋势并入；试听仅作日记不计入计时）
    if (any && any.healing){
      var rows2 = [];
      reps.forEach(function(r){ if (r.blocks.healing) r.blocks.healing.detail.forEach(function(x){
        rows2.push([r.userCode, x.date, x.time, x.tone, x.music, x.scene,
          x.selfDurMin != null ? x.selfDurMin : '',
          x.listenMin != null ? x.listenMin : '',
          x.listenSec != null ? Math.round(x.listenSec) : '',
          x.isTrial ? '是' : '',
          x.rating != null ? x.rating : '', x.feedback, x.comment]);
      }); });
      sec('疗愈记录(含评分)', ['编号','日期','时间','调式','曲目','情境','自选时长(分钟)','实际聆听时长(分钟)','实际聆听时长(秒钟)','试听','评分','反馈选择','评语'], rows2);
    }
    // ④ AI 对话分析（每轮一行=一次分析；实际时长=本轮首条用户消息→结束并推荐）
    if (any && any.chat){
      var rows3 = [];
      reps.forEach(function(r){
        if (!r.blocks.chat) return;
        r.blocks.chat.detail.forEach(function(x){
          rows3.push([r.userCode, '第' + x.idx + '轮', x.date, x.time,
            +(x.durationSec/60).toFixed(1), Math.round(x.durationSec), x.msgCount,
            x.primaryEmotion, x.primaryWutai, x.recTone + (x.recDualTone ? '+' + x.recDualTone : ''), x.summary]);
        });
      });
      sec('AI 对话分析', ['编号','轮次','日期','时间','实际对话时长(分钟)','实际对话时长(秒钟)','消息数','情志关键词','五态','推荐调式','总结'], rows3);
    }
    // ⑤ 情志测评（问卷渠道，五态得分）
    if (any && any.emotion){
      var rows6 = [];
      reps.forEach(function(r){ if (r.blocks.emotion) r.blocks.emotion.questionnaire.forEach(function(x){
        var sc = x.scores || {};
        rows6.push([r.userCode, x.date, x.time, x.title || '',
          (x.quizFillSec != null ? +(x.quizFillSec/60).toFixed(1) : ''), (x.quizFillSec != null ? x.quizFillSec : ''), (Array.isArray(x.quizRounds) && x.quizRounds.length ? x.quizRounds.map(function(s2,i2){ return 'R' + (i2+1) + '=' + s2; }).join(';') : ''), sc.jue != null ? sc.jue : '', sc.zhi != null ? sc.zhi : '', sc.gong != null ? sc.gong : '', sc.shang != null ? sc.shang : '', sc.yu != null ? sc.yu : '',
          x.emotionTotal != null ? x.emotionTotal : '', x.emotionPositive != null ? x.emotionPositive : '',
          (x.body && x.body['心血管'] != null) ? x.body['心血管'] : '', (x.body && x.body['脑神经'] != null) ? x.body['脑神经'] : '', (x.body && x.body['消化'] != null) ? x.body['消化'] : '', (x.body && x.body['呼吸'] != null) ? x.body['呼吸'] : '', (x.body && x.body['泌尿'] != null) ? x.body['泌尿'] : '', (x.body && x.body['四肢肌肉'] != null) ? x.body['四肢肌肉'] : '', (x.body && x.body['其他'] != null) ? x.body['其他'] : '',
          x.bodyTotal != null ? x.bodyTotal : '', x.bodyPositive != null ? x.bodyPositive : '']);
      }); });
      sec('情志测评(问卷渠道)：情绪总分=喜怒忧思恐五因子和，情绪阳性=50题中选3-4数量；心血管/脑神经/消化/呼吸/泌尿/四肢肌肉/其他=34题按医学因子得分，躯体化总分=7因子和，阳性=34题中选3-4数量', ['编号','日期','时间','类型','问卷填写时长(分钟)','问卷填写时长(秒)','问卷逐轮秒数','角(怒)','徵(喜)','宫(思)','商(忧)','羽(恐)','情绪总分','情绪阳性数','心血管','脑神经','消化','呼吸','泌尿','四肢肌肉','其他','躯体化总分','躯体化阳性数'], rows6);
    }
    // ⑦ 推荐命中（问卷/AI/时辰三来源）
    if (any && any.recommend){
      var rows8 = [];
      reps.forEach(function(r){ if (r.blocks.recommend) r.blocks.recommend.detail.forEach(function(x){
        rows8.push([r.userCode, x.date, x.time, x.recQuestionnaire, x.recAI, x.recShichen, x.actual, x.status, x.source]);
      }); });
      sec('推荐命中', ['编号','日期','时间','问卷推荐调式','AI推荐调式','时辰推荐调式','实际调式','命中状态','来源'], rows8);
    }
    return { name: '五音疗愈数据_' + dstr + '.csv', csv: '\ufeff' + lines.join('\r\n') };
  }

  var OY = {
    users: function(){ return getUsers(); },
    current: function(){ return getUsers().filter(function(x){ return String(x.id) === String(cur); })[0] || null; },
    uid: function(){ return cur; },
    createUser: createUser,
    switchUser: function(id){ var u = getUsers(); if (u.some(function(x){ return String(x.id) === String(id); })){ rawSet('wuyin_current_user', String(id)); cur = String(id); } location.reload(); },
    activateUser: function(id){ var u = getUsers(); if (u.some(function(x){ return String(x.id) === String(id); })){ rawSet('wuyin_current_user', String(id)); cur = String(id); try { migrateLegacy(); } catch(e){} } },
    renameUser: function(id, name){ name = String(name||'').trim(); if(!name) return; var u = getUsers(); u.forEach(function(x){ if (String(x.id)===String(id)){ x.name = name; x.lastActive = Date.now(); } }); saveUsers(u); },
    deleteUser: function(id){
      var u = getUsers();
      if (u.length <= 1){ toast('至少保留一个用户'); return; }
      var next = u.filter(function(x){ return String(x.id) !== String(id); });
      var keys = []; for (var i=0;i<LS.length;i++){ var k = rawKey(i); if (typeof k === 'string') keys.push(k); }
      keys.forEach(function(k){ if (k.indexOf('wuyin' + id + ':') === 0) rawRem(k); });
      saveUsers(next);
      if (String(cur) === String(id)) rawSet('wuyin_current_user', String(next[0].id));
      location.reload();
    },
    download: function(fn, text, mime){ var b = new Blob([text], { type: mime || 'application/json' }); var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = fn; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 800); },
    noteActive: __noteActive,
    noteInactive: __noteInactive,
    // ===== 对话轮次记录（不含原文）=====
    saveChatSession: function(o){
      try {
        var arr = readJSON('wuyin_chat_sessions', []);
        arr.push({
          startTs: o.startTs || null, endTs: o.endTs || Date.now(),
          durationSec: (o.startTs ? Math.round(((o.endTs || Date.now()) - o.startTs)/1000) : null),
          msgCount: o.msgCount || 0, userMsgCount: o.userMsgCount || 0, analysis: null
        });
        if (arr.length > 200) arr = arr.slice(-200);
        localStorage.setItem('wuyin_chat_sessions', JSON.stringify(arr));
      } catch(e){ console.warn('[oy] saveChatSession failed:', e); }
    },
    patchChatAnalysis: function(a){
      try {
        var arr = readJSON('wuyin_chat_sessions', []);
        for (var i = arr.length - 1; i >= 0; i--){
          if (arr[i] && arr[i].analysis === null){ arr[i].analysis = a; break; }
        }
        localStorage.setItem('wuyin_chat_sessions', JSON.stringify(arr));
      } catch(e){ console.warn('[oy] patchChatAnalysis failed:', e); }
    },
    // ===== 导出引擎（范围+时间+内容+格式 四步）=====
    buildReport: function(uid, opts){ return buildReport(uid, opts); },
    exportReport: function(ids, opts){
      return {
        exportSchemaVersion: '2', generatedAt: new Date().toISOString(),
        timeRange: __mkTR(opts && opts.time), content: (opts && opts.content) || null,
        users: ids.map(function(id){ return buildReport(id, opts); })
      };
    },
    exportReportText: function(ids, opts, unit){
      var reps = ids.map(function(id){ return buildReport(id, opts); });
      return reps.map(function(r){ return reportToText(r, unit); }).join('\r\n\r\n') + '\r\n';
    },
    exportReportCSV: function(ids, opts, unit){
      var reps = ids.map(function(id){ return buildReport(id, opts); });
      return reportToCSV(reps, unit);
    },
    recordUsage: function(kind, mins){
      var today = todayStr(), all = readJSON('wuyin_usage_daily', {});
      var d = all[today] || { healingMins:0, chatMins:0, sessions:0 };
      if (kind === 'healing') d.healingMins = (d.healingMins || 0) + mins; else if (kind === 'chat') d.chatMins = (d.chatMins || 0) + mins;
      d.sessions = (d.sessions || 0) + 1; d.lastDate = today; all[today] = d;
      localStorage.setItem('wuyin_usage_daily', JSON.stringify(all));
    },
    todayUsage: function(){ var D = __readUserData(cur); var all = D.usage_daily || {}, d = all[todayStr()] || {}; var tdStr=todayStr(); var healToday=0; (D.healing_records||[]).forEach(function(r){ if(!r) return; if(__dateOf(r.timestamp!=null?r.timestamp:r.date)===tdStr){ var s=(typeof r.actualSec==='number' && r.actualSec>0)?r.actualSec:0; if(s>0) healToday+=s; } }); var h=Math.max(d.healing||0, healToday); var q=Math.max(d.quiz||0, Math.round((d.quizMins||0)*60)); var c=0; try { var cT=(typeof __chatTiming==='function')?__chatTiming(D,{mode:'full'}):{daily:{}}; var td=(cT.daily||{})[tdStr]; if (td) c=td; } catch(e){ c=0; } if (!c) c=Math.max(d.chat||0, Math.round((d.chatMins||0)*60)); d.chat=c; d.healingMins=h/60; d.chatMins=c/60; d.quizMins=q/60; d.total=h+c+q; return d; },
    // 该用户所有轮次的实际对话时长总和（与"AI对话分析"导出一致），而非"切入AI界面即读秒"的停留值
    chatTotalSec: function(uid){
      try {
        var D = __readUserData(uid);
        var cT = (typeof __chatTiming === 'function') ? __chatTiming(D, { mode:'full' }) : { rounds: [] };
        var sum = 0; cT.rounds.forEach(function(r){ sum += (r.durationSec || 0); });
        return sum;
      } catch(e){ return 0; }
    },
    // 暴露当前用户的 usage_daily 原始数据（供后台计算使用天数），走 __readUserData 兜底
    rawUsageDaily: function(){ return (__readUserData(cur) || {}).usage_daily || {}; },
    totalUsage: function(){
      var D = __readUserData(cur);
      var all = D.usage_daily || {}, h=0,cQuiz=0,q=0;
      Object.keys(all).forEach(function(k){ var x=all[k]||{}; h+=(x.healing||0); cQuiz+=Math.max(x.chat||0, Math.round((x.chatMins||0)*60)); q+=Math.max(x.quiz||0, Math.round((x.quizMins||0)*60)); });
      // 疗愈时长兜底：从疗愈记录汇总实际聆听秒数，取较大值确保与疗愈记录一致
      var healRecSec = 0;
      (D.healing_records || []).forEach(function(r){ if(!r) return; var s=(typeof r.actualSec==='number' && r.actualSec>0)?r.actualSec:0; if(s>0) healRecSec+=s; });
      h = Math.max(h, healRecSec);
      // 对话时长以该用户各轮之和为准（有轮次用轮次和，避免切入即计时虚增；无历史轮次则保留读秒值兜底）
      var c = cur ? this.chatTotalSec(cur) : 0;
      if (!c) c = cQuiz;
      return { healingMins:h/60, chatMins:c/60, quizMins:q/60, healing:h, chat:c, quiz:q, total:h+c+q };
    },
    pinOk: function(pin){ var p = localStorage.getItem('wuyin_admin_pin'); if (p === null || p === ''){ localStorage.setItem('wuyin_admin_pin', '9527'); return String(pin) === '9527'; } return String(pin) === String(p); },
    setPin: function(oldP, newP){ if (!OY.pinOk(oldP)) return false; var s = String(newP||'').trim(); if (!s) return false; localStorage.setItem('wuyin_admin_pin', s); return true; }
  };
  window.OY = OY; window.__appToast = toast;
  ensureDefault(); __purgeJunkKeys(); try { if (rawGet('elderMode') !== null) rawRem('elderMode'); } catch(e){} migrateLegacy(); __initHeartbeat();
  // 运行时自检 + 定时迁移兜底（防止缓存旧代码/包装器失效导致数据写入无前缀键）
  __selfCheck();
  setInterval(__periodicMigrate, 8000);
  setInterval(__selfCheck, 30000);
  if (document.addEventListener) document.addEventListener('visibilitychange', function(){ if (document.visibilityState !== 'visible') __noteInactive(); });
})();
