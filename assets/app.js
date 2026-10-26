/* ================================================================
   VITALS · 个人健康中枢
   指标引擎 / 视图 / 录入 / 导入
   ================================================================ */
(function () {
  'use strict';

  /* ================= 常量 ================= */
  var K = {
    weight: '#22d3ee', fat: '#f472b6', muscle: '#5b9dff', water: '#38bdf8', visceral: '#f5a524',
    protein: '#5b9dff', fatM: '#f5a524', carb: '#a78bfa', fiber: '#3ddc97',
    intake: '#f5a524', burn: '#5b9dff', net: '#2be0b4', accent: '#2be0b4'
  };

  var WORKOUTS = {
    pushup:     { label: '俯卧撑', met: 6.0, unit: 'reps', defSets: 5, defReps: 20, group: '力量' },
    squat:      { label: '深蹲', met: 5.5, unit: 'reps', defSets: 5, defReps: 25, group: '力量' },
    plank:      { label: '平板支撑', met: 3.6, unit: 'time', defMin: 5, group: '核心' },
    basketball: { label: '打篮球', met: 8.0, unit: 'time', defMin: 60, group: '球类' },
    swimming:   { label: '游泳', met: 8.0, unit: 'distance', defMin: 45, group: '有氧' },
    running:    { label: '跑步', met: 9.8, unit: 'distance', defMin: 30, group: '有氧' },
    cycling:    { label: '骑行', met: 7.5, unit: 'distance', defMin: 45, group: '有氧' },
    strength:   { label: '力量训练', met: 5.0, unit: 'time', defMin: 50, group: '力量' },
    walking:    { label: '快走', met: 4.3, unit: 'time', defMin: 40, group: '有氧' },
    badminton:  { label: '羽毛球', met: 5.5, unit: 'time', defMin: 60, group: '球类' },
    jumprope:   { label: '跳绳', met: 11.0, unit: 'time', defMin: 15, group: '有氧' },
    rowing:     { label: '划船机', met: 7.0, unit: 'time', defMin: 30, group: '有氧' },
    yoga:       { label: '瑜伽 / 拉伸', met: 3.0, unit: 'time', defMin: 40, group: '恢复' },
    hiking:     { label: '爬山 / 徒步', met: 6.0, unit: 'time', defMin: 120, group: '有氧' },
    football:   { label: '足球', met: 7.0, unit: 'time', defMin: 90, group: '球类' },
    other:      { label: '其他', met: 5.0, unit: 'time', defMin: 30, group: '其他' }
  };

  /* 食物库：[名称, 每100g热量, 蛋白, 脂肪, 碳水, 纤维, 默认份量g, 份量描述] */
  var FOODS = [
    ['米饭（熟）', 116, 2.6, 0.3, 25.9, 0.3, 150, '1 碗'],
    ['糙米饭', 112, 2.6, 0.9, 23.0, 1.8, 150, '1 碗'],
    ['馒头', 223, 7.0, 1.1, 47.0, 1.3, 100, '1 个'],
    ['全麦面包', 246, 9.7, 3.4, 41.0, 6.0, 35, '1 片'],
    ['燕麦片（干）', 377, 13.2, 6.7, 66.0, 10.0, 40, '1 份'],
    ['鸡蛋', 143, 12.6, 9.5, 1.1, 0, 50, '1 个'],
    ['鸡胸肉（熟）', 165, 31.0, 3.6, 0, 0, 120, '1 块'],
    ['牛肉（瘦）', 250, 26.0, 15.0, 0, 0, 120, '1 份'],
    ['三文鱼', 208, 20.0, 13.0, 0, 0, 120, '1 份'],
    ['虾', 99, 24.0, 0.3, 0.2, 0, 100, '1 份'],
    ['豆腐（北）', 116, 12.2, 4.8, 2.0, 0.5, 150, '1 块'],
    ['牛奶（全脂）', 61, 3.2, 3.3, 4.8, 0, 250, '1 盒'],
    ['无糖酸奶', 59, 3.5, 3.3, 4.5, 0, 150, '1 杯'],
    ['希腊酸奶', 97, 9.0, 5.0, 4.0, 0, 150, '1 杯'],
    ['乳清蛋白粉', 380, 78.0, 5.0, 8.0, 0, 30, '1 勺'],
    ['西兰花', 34, 2.8, 0.4, 7.0, 2.6, 150, '1 份'],
    ['生菜 / 绿叶菜', 15, 1.4, 0.2, 2.9, 1.3, 100, '1 份'],
    ['番茄', 18, 0.9, 0.2, 3.9, 1.2, 150, '1 个'],
    ['黄瓜', 15, 0.7, 0.1, 3.6, 0.5, 150, '1 根'],
    ['苹果', 52, 0.3, 0.2, 14.0, 2.4, 200, '1 个'],
    ['香蕉', 89, 1.1, 0.3, 23.0, 2.6, 120, '1 根'],
    ['蓝莓', 57, 0.7, 0.3, 14.0, 2.4, 100, '1 份'],
    ['橙子', 47, 0.9, 0.1, 12.0, 2.4, 200, '1 个'],
    ['混合坚果', 607, 20.0, 54.0, 20.0, 7.0, 25, '1 小把'],
    ['花生酱', 588, 25.0, 50.0, 20.0, 6.0, 15, '1 勺'],
    ['橄榄油', 884, 0, 100.0, 0, 0, 10, '1 勺'],
    ['面条（熟）', 138, 4.5, 0.9, 27.0, 1.2, 200, '1 碗'],
    ['红薯', 86, 1.6, 0.1, 20.0, 3.0, 200, '1 个'],
    ['玉米（煮）', 96, 3.4, 1.5, 21.0, 1.7, 150, '1 根'],
    ['土豆', 77, 2.0, 0.1, 17.0, 2.2, 150, '1 个'],
    ['拿铁', 55, 3.0, 3.0, 4.5, 0, 300, '1 杯'],
    ['美式咖啡', 2, 0.1, 0, 0.4, 0, 300, '1 杯'],
    ['可乐', 42, 0, 0, 10.6, 0, 330, '1 罐'],
    ['啤酒', 43, 0.5, 0, 3.6, 0, 330, '1 罐'],
    ['汉堡', 250, 12.0, 11.0, 25.0, 1.5, 200, '1 个'],
    ['炸鸡', 280, 20.0, 18.0, 8.0, 0.5, 150, '1 份'],
    ['披萨', 266, 11.0, 10.0, 33.0, 2.3, 120, '1 块'],
    ['包子（肉）', 227, 8.0, 7.0, 32.0, 1.2, 100, '1 个'],
    ['饺子（猪肉）', 240, 9.0, 10.0, 28.0, 1.4, 200, '10 个'],
    ['白粥', 46, 1.1, 0.3, 9.9, 0.3, 300, '1 碗'],
    ['鸡胸沙拉', 120, 10.0, 6.0, 6.0, 2.0, 250, '1 份'],
    ['三明治', 240, 11.0, 8.0, 30.0, 2.0, 150, '1 个'],
    ['方便面', 470, 9.0, 20.0, 62.0, 2.0, 100, '1 包'],
    ['火锅（清汤涮肉）', 180, 14.0, 12.0, 4.0, 1.0, 300, '1 餐'],
    ['麻辣烫', 130, 7.0, 7.0, 10.0, 1.5, 400, '1 份'],
    ['豆浆（无糖）', 31, 3.0, 1.6, 1.2, 0.5, 300, '1 杯']
  ];

  var SUPPS = [
    ['乳清蛋白', '30 g', '训练后'], ['肌酸', '5 g', '任意时段'], ['复合维生素', '1 片', '早餐后'],
    ['维生素 D3', '2000 IU', '随餐'], ['Omega-3 鱼油', '2 粒', '随餐'], ['镁', '300 mg', '睡前'],
    ['锌', '15 mg', '随餐'], ['益生菌', '1 粒', '空腹'], ['电解质', '1 包', '训练中'],
    ['咖啡因', '200 mg', '训练前'], ['胶原蛋白', '10 g', '睡前'], ['BCAA', '5 g', '训练中']
  ];

  var SLOTS = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
  var SLOT_ABBR = { breakfast: '早', lunch: '午', dinner: '晚', snack: '加' };

  /* ================= 状态 ================= */
  var S = {
    data: null,
    mode: 'ro',
    view: 'overview',
    range: 14,
    day: null,       // 饮食视图当前日期
    trend: { weight: true, fat: true, muscle: false },
    demo: false,
    dirty: false, csrfToken: null, saveBlocked: false, saveError: false
  };

  /* ================= 工具 ================= */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function todayKey() { return ymd(new Date()); }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function parseDate(key) {
    var p = String(key).split('-');
    return new Date(+p[0], (+p[1]) - 1, +p[2]);
  }
  function dayLabel(key) {
    if (!key) return '';
    var t = todayKey();
    if (key === t) return '今天';
    if (key === ymd(addDays(new Date(), -1))) return '昨天';
    return key.slice(5).replace('-', '/');
  }
  function weekday(key) { return '日一二三四五六'[parseDate(key).getDay()]; }
  function n0(v) { return v == null || !isFinite(v) ? '—' : Math.round(v).toLocaleString('zh-CN'); }
  function n1(v) { return v == null || !isFinite(v) ? '—' : (Math.round(v * 10) / 10).toFixed(1); }
  function n2(v) { return v == null || !isFinite(v) ? '—' : (Math.round(v * 100) / 100).toFixed(2); }
  function sum(arr, f) { return arr.reduce(function (a, b) { return a + (f ? (f(b) || 0) : (b || 0)); }, 0); }
  function isoNow() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' +
      pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':00+08:00';
  }
  function tsToDate(ts) {
    if (!ts) return new Date();
    var d = new Date(ts);
    return isNaN(d.getTime()) ? new Date(ts.replace(' ', 'T')) : d;
  }
  function hhmm(ts) { if (!ts) return '—'; var d = tsToDate(ts); if (isNaN(d.getTime())) return '—'; return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function uid(prefix) { return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function uniq(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }
  function deltaHTML(cur, prev, opts) {
    if (cur == null || prev == null || !isFinite(cur) || !isFinite(prev)) return '<span class="delta flat">—</span>';
    var d = cur - prev;
    var good = opts && opts.reverse ? d > 0 : d < 0;
    var cls = Math.abs(d) < (opts && opts.eps || 0.05) ? 'flat' : (good ? 'down' : 'up');
    var arrow = Math.abs(d) < (opts && opts.eps || 0.05) ? '·' : (d > 0 ? '↑' : '↓');
    return '<span class="delta ' + cls + '">' + arrow + ' ' + (opts && opts.fmt ? opts.fmt(Math.abs(d)) : Math.abs(d).toFixed(1)) + '</span>';
  }

  /* ================= 指标引擎 ================= */
  var M = {
    p: function () { return S.data.profile || {}; },
    age: function () {
      var p = this.p();
      if (p.birthDate) {
        var b = parseDate(p.birthDate), t = new Date();
        var a = t.getFullYear() - b.getFullYear();
        var m = t.getMonth() - b.getMonth();
        if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
        return a;
      }
      return p.age || null;
    },
    bodies: function () {
      return (S.data.bodyMetrics || []).slice().sort(function (a, b) {
        return (a.date + (a.ts || '')).localeCompare(b.date + (b.ts || ''));
      });
    },
    latestBody: function () { var l = this.bodies(); return l.length ? l[l.length - 1] : null; },
    /* 测量时段：fasting=晨起空腹 / bedtime=睡前。两组读数含水量不同，不可互相比较。 */
    modeOf: function (b) { return (b && b.measureMode) || 'fasting'; },
    fastingBodies: function () {
      return this.bodies().filter(function (b) { return M.modeOf(b) === 'fasting'; });
    },
    /* 参照值（体重/BMR/目标口径）：优先最近的晨起空腹；没有空腹记录时退回最近一次 */
    refBody: function () {
      var f = this.fastingBodies();
      return f.length ? f[f.length - 1] : this.latestBody();
    },
    /* 只要存在过晨起空腹记录，所有趋势/变化率就一律只认空腹序列；
       一条空腹都没有的老数据（只有睡前）才退回全部记录，避免图表变空。 */
    hasFasting: function () { return this.fastingBodies().length > 0; },
    bodyOn: function (dk) {
      var list = this.bodies().filter(function (b) { return b.date === dk; });
      if (!list.length) return null;
      if (M.hasFasting()) {
        var f = list.filter(function (b) { return M.modeOf(b) === 'fasting'; });
        return f.length ? f[f.length - 1] : null;
      }
      return list[list.length - 1];
    },
    weight: function () {
      var b = this.refBody();
      return b && b.weightKg ? b.weightKg : (this.p().weightKg || null);
    },
    height: function () { return this.p().heightCm || null; },
    bmi: function (w) {
      var b = this.refBody();
      if (b && b.bmi && w == null) return b.bmi;
      var h = this.height();
      w = w == null ? this.weight() : w;
      if (!h || !w) return null;
      return w / Math.pow(h / 100, 2);
    },
    bmr: function () {
      var p = this.p(), w = this.weight(), h = this.height(), a = this.age();
      if (p.bmrMode === 'scale') {
        var b = this.refBody();
        if (b && b.bmrKcal) return b.bmrKcal;
      }
      if (!w || !h || !a || ['male', 'female'].indexOf(p.sex) < 0) return null;
      return Math.round(10 * w + 6.25 * h - 5 * a + (p.sex === 'female' ? -161 : 5));
    },
    tdee: function () {
      var b = this.bmr();
      return b ? Math.round(b * (this.p().activityFactor || 1.375)) : null;
    },
    targets: function () {
      var p = this.p(), w = this.weight(), tdee = this.tdee() || 0;
      var t = p.targets || {}, g = p.goal || {};
      if (!g.type || g.type === 'record_only') return { kcal: t.kcal || null, protein: t.proteinG || null, fat: t.fatG || null, carb: t.carbG || null, fiber: t.fiberG || null, steps: t.steps || null, sleepMin: t.sleepMin || null, waterMl: t.waterMl || null, deficit: 0, tdee: this.tdee() };
      var rate = g.weeklyRateKg == null ? 0.5 : g.weeklyRateKg;
      var deficit = 0;
      if (g.type === 'fat_loss') deficit = rate * 7700 / 7;
      else if (g.type === 'muscle_gain') deficit = -rate * 7700 / 7 * 0.55;
      var kcal = t.kcal || (tdee ? Math.round((tdee - deficit) / 10) * 10 : null);
      var protein = t.proteinG || (w ? Math.round(w * (g.proteinPerKg || 1.6)) : null);
      var fat = t.fatG || (kcal ? Math.round(kcal * 0.27 / 9) : null);
      var carb = t.carbG || (kcal && protein && fat ? Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4)) : null);
      return {
        kcal: kcal, protein: protein, fat: fat, carb: carb, fiber: t.fiberG || 30,
        steps: t.steps || 8000, sleepMin: t.sleepMin || 450, waterMl: t.waterMl || 2000,
        deficit: Math.round(deficit), tdee: tdee
      };
    },
    mealsOn: function (dk) { return (S.data.meals || []).filter(function (m) { return m.date === dk; }); },
    intakeOn: function (dk, withSupp) {
      var acc = { kcal: 0, proteinG: 0, fatG: 0, carbG: 0, fiberG: 0 };
      this.mealsOn(dk).forEach(function (m) {
        var t = m.totals || {};
        acc.kcal += t.kcal || 0; acc.proteinG += t.proteinG || 0;
        acc.fatG += t.fatG || 0; acc.carbG += t.carbG || 0; acc.fiberG += t.fiberG || 0;
      });
      if (withSupp !== false) {
        this.supplementsOn(dk).forEach(function (s) {
          var n = s.nutrients || {};
          acc.kcal += n.kcal || 0; acc.proteinG += n.proteinG || 0;
          acc.fatG += n.fatG || 0; acc.carbG += n.carbG || 0;
        });
      }
      return acc;
    },
    workoutsOn: function (dk) { return (S.data.workouts || []).filter(function (w) { return w.date === dk; }); },
    workoutKcalOn: function (dk) { return sum(this.workoutsOn(dk), function (w) { return w.kcal; }); },
    activityOn: function (dk) {
      var l = (S.data.dailyActivity || []).filter(function (a) { return a.date === dk; });
      return l.length ? l[l.length - 1] : null;
    },
    burnOn: function (dk) {
      var act = this.activityOn(dk);
      if (act && act.totalKcal) return act.totalKcal;
      var t = this.tdee();
      if (!t) return null;
      return Math.round(t + this.workoutKcalOn(dk) * 0.85);
    },
    supplementsOn: function (dk) { return (S.data.supplements || []).filter(function (s) { return s.date === dk; }); },
    range: function (n) {
      var out = [];
      for (var i = n - 1; i >= 0; i--) out.push(ymd(addDays(new Date(), -i)));
      return out;
    },
    /* 线性回归斜率（每天变化量） */
    slope: function (vals) {
      var pts = [];
      vals.forEach(function (v, i) { if (v != null && isFinite(v)) pts.push([i, v]); });
      if (pts.length < 3) return null;
      var n = pts.length, sx = 0, sy = 0, sxy = 0, sxx = 0;
      pts.forEach(function (p) { sx += p[0]; sy += p[1]; sxy += p[0] * p[1]; sxx += p[0] * p[0]; });
      var den = n * sxx - sx * sx;
      if (!den) return 0;
      return (n * sxy - sx * sy) / den;
    },
    seriesWeight: function (keys) {
      var self = this;
      return keys.map(function (k) { var b = self.bodyOn(k); return b && b.weightKg != null ? b.weightKg : null; });
    },
    series: function (keys, field, list) {
      return keys.map(function (k) {
        var arr = (list || S.data.bodyMetrics || []).filter(function (b) { return b.date === k && b[field] != null; });
        if (!arr.length) return null;
        if (M.hasFasting()) {
          var f = arr.filter(function (b) { return M.modeOf(b) === 'fasting'; });
          return f.length ? f[f.length - 1][field] : null;
        }
        return arr[arr.length - 1][field];
      });
    },
    seriesActivity: function (keys, field) {
      return keys.map(function (k) {
        var a = M.activityOn(k);
        return a && a[field] != null ? a[field] : null;
      });
    },
    seriesIntake: function (keys) { return keys.map(function (k) { var v = M.intakeOn(k).kcal; return v > 0 ? v : null; }); },
    seriesBurn: function (keys) { return keys.map(function (k) { return M.burnOn(k); }); },
    seriesBurnReal: function (keys) {
      return keys.map(function (k) {
        var has = M.activityOn(k) || M.workoutsOn(k).length || M.mealsOn(k).length;
        return has ? M.burnOn(k) : null;
      });
    },
    streak: function (pred) {
      var n = 0, d = new Date();
      if (!pred(ymd(d))) d = addDays(d, -1);
      for (var i = 0; i < 400; i++) {
        if (pred(ymd(d))) { n++; d = addDays(d, -1); } else break;
      }
      return n;
    }
  };

  /* ================= 通用片段 ================= */
  function card(title, sub, body, extra, cls) {
    return '<section class="card ' + (cls || '') + '">' +
      '<div class="card-head"><div><h2 class="card-title">' + title + '</h2>' +
      (sub ? '<div class="card-sub">' + sub + '</div>' : '') + '</div>' +
      '<div class="spacer"></div>' + (extra || '') + '</div>' + body + '</section>';
  }
  function emptyHTML(title, desc, action) {
    return '<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">' +
      '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01" stroke-linecap="round"/></svg>' +
      '<b>' + title + '</b><p>' + (desc || '') + '</p>' + (action || '') + '</div>';
  }
  function progRow(label, value, target, color, unit) {
    var has = value != null && isFinite(value) && value > 0;
    var pct = has && target ? clamp(value / target, 0, 1) * 100 : 0;
    var over = has && target && value > target * 1.02;
    var f = unit === '%' ? function (v) { return n1(v) + '%'; } : n0;
    var tail = unit === '%' ? '' : ' ' + (unit || 'g');
    return '<div class="prog-row"><span class="t">' + label + '</span>' +
      '<span class="v">' + (has ? f(value) : '—') + ' / 目标 ' + f(target) + tail + '</span>' +
      '<div class="bar"><i style="width:' + pct + '%;background:' + (over ? 'var(--red)' : color) + '"></i></div></div>';
  }
  function spark(values, color) {
    var pts = [];
    values.forEach(function (v, i) { if (v != null && isFinite(v)) pts.push([i, v]); });
    if (pts.length < 2) return '';
    var min = Math.min.apply(null, pts.map(function (p) { return p[1]; }));
    var max = Math.max.apply(null, pts.map(function (p) { return p[1]; }));
    var span = max - min || 1;
    var W = 74, H = 30;
    var d = pts.map(function (p) {
      var x = (p[0] / Math.max(1, values.length - 1)) * W;
      var y = H - 3 - ((p[1] - min) / span) * (H - 6);
      return (p === pts[0] ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
    }).join('');
    return '<svg class="mini-spark" viewBox="0 0 ' + W + ' ' + H + '"><path d="' + d + '" fill="none" stroke="' +
      color + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  /* ================= 视图：总览 ================= */
  function viewOverview() {
    var p = M.p(), lb = M.latestBody();
    var needSetup = !p.heightCm || !lb;
    var out = [];
    if (S.demo) out.push('<div class="banner"><b>演示数据</b> · 当前为示例面板，所有改动不会写入你的真实数据文件。正常启动即退出演示。</div>');
    if (S.mode === 'ro') out.push('<div class="banner"><b>只读模式</b> · 未检测到本地数据服务，面板仅能查看。请在项目目录运行 <code style="font-family:var(--mono)">python3 server.py</code> 后重新打开。</div>');
    if (needSetup) out.push(setupCard());
    out.push(kpiRow());
    out.push('<div class="grid g-2-1 mt14">' + energyCard() + goalCard() + '</div>');
    out.push('<div class="grid g-2-1 mt14">' + trendCard() + recoveryCard() + '</div>');
    out.push('<div class="grid g-2-1 mt14">' + balanceCard() + trainingCard() + '</div>');
    out.push('<div class="grid g-2-1 mt14">' + timelineCard() + suppTodayCard() + '</div>');
    return out.join('');
  }

  function setupCard() {
    var p = M.p();
    var sex = p.sex || '';
    return '<section class="card" style="border-color:var(--accent);box-shadow:0 0 0 1px var(--accent-soft),var(--shadow-1)">' +
      '<div class="card-head"><div><h2 class="card-title">建立你的健康基线</h2>' +
      '<div class="card-sub">这些信息可以稍后补充。默认仅记录；如需营养目标，请在设置中主动选择目标。</div></div></div>' +
      '<form id="setup-form" class="form-grid" style="gap:14px">' +
      '<div class="field"><label>性别</label><div class="chips" id="setup-sex">' +
      '<button type="button" class="chip' + (sex === 'male' ? ' on' : '') + '" data-sex="male">男</button>' +
      '<button type="button" class="chip' + (sex === 'female' ? ' on' : '') + '" data-sex="female">女</button></div></div>' +
      '<div class="field"><label>出生日期</label><input type="date" id="setup-birth" value="' + (p.birthDate || '') + '"></div>' +
      '<div class="field"><label>身高（cm）</label><input type="number" step="0.1" id="setup-height" placeholder="175" value="' + (p.heightCm || '') + '"></div>' +
      '<div class="field"><label>本次称重时段</label><select id="setup-mode"><option value="">请选择（填写体重时必选）</option><option value="fasting">晨起空腹</option><option value="bedtime">睡前</option></select></div>' +
      '<div class="field"><label>当前体重（kg）</label><input type="number" step="0.1" id="setup-weight" placeholder="72.5" value="' + (M.weight() || '') + '"></div>' +
      '<div class="field"><label>体脂率（%）<span class="hint"> · 体脂秤读数，可留空</span></label><input type="number" step="0.1" id="setup-fat" placeholder="21.5"></div>' +
      '<div class="field"><label>日常活动水平</label><select id="setup-af">' +
      [['1.2', '久坐（几乎不运动）'], ['1.375', '轻度（每周 1-3 次训练）'], ['1.55', '中度（每周 3-5 次）'], ['1.725', '高强度（每周 6-7 次）'], ['1.9', '极高（体力工作 / 一天两练）']]
        .map(function (o) { return '<option value="' + o[0] + '"' + (String(p.activityFactor || 1.375) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="span2" style="display:flex;gap:8px;align-items:center;margin-top:4px">' +
      '<button type="submit" class="btn primary">保存并生成基线</button>' +
      '<span class="tiny muted">记录文件保存在本机；发给 WorkBuddy 的照片与消息按其服务机制处理。</span>' +
      '</div></form></section>';
  }

  function kpiRow() {
    var lb = M.refBody(), keys = M.range(8);
    var wSeries = M.seriesWeight(keys).filter(function (v) { return v != null; });
    var today = todayKey();
    var t = M.targets();
    var intake = M.intakeOn(today).kcal;
    var burn = M.burnOn(today);
    var fatSeries = M.series(M.range(8), 'bodyFatPct').filter(function (v) { return v != null; });
    var wDelta = lb && wSeries.length > 1 ? lb.weightKg - wSeries[0] : null;
    var modeTag = lb ? (M.modeOf(lb) === 'fasting' ? '晨起空腹' : '睡前') : '';

    function kpi(label, value, unit, foot, sparkHTML) {
      return '<div class="card kpi"><div class="kpi-label">' + label + '</div>' +
        '<div class="kpi-value"><b>' + value + '</b><span>' + unit + '</span></div>' +
        '<div class="kpi-foot">' + foot + '</div>' + (sparkHTML || '') + '</div>';
    }
    return '<div class="kpi-row">' +
      kpi('体重', lb ? n1(lb.weightKg) : '—', 'kg',
        wDelta != null ? deltaHTML(lb.weightKg, wSeries[0], { fmt: function (v) { return v.toFixed(1) + ' kg'; } }) + '<span>7 天 · ' + modeTag + '</span>' :
          '<span class="muted">' + (lb ? modeTag + ' · 暂无同口径历史' : '暂无历史') + '</span>', spark(M.seriesWeight(keys), K.weight)) +
      kpi('体脂率', lb && lb.bodyFatPct ? n1(lb.bodyFatPct) : '—', '%',
        fatSeries.length > 1 ? deltaHTML(fatSeries[fatSeries.length - 1], fatSeries[0], { fmt: function (v) { return v.toFixed(1) + '%'; } }) + '<span>7 天 · 晨起</span>' :
          '<span class="muted">BMI ' + n1(M.bmi()) + '</span>', spark(M.series(keys, 'bodyFatPct'), K.fat)) +
      kpi('今日摄入', n0(intake), 'kcal',
        '<span>目标 ' + n0(t.kcal) + '</span>' + (t.kcal ? '<span class="dot-sep"></span><span>' + Math.round(intake / t.kcal * 100) + '%</span>' : '')) +
      kpi('今日消耗', n0(burn), 'kcal',
        '<span>活动 ' + n0(M.activityOn(today) ? M.activityOn(today).activeKcal : M.workoutKcalOn(today)) + '</span>' +
        '<span class="dot-sep"></span><span class="' + (burn != null && intake - burn <= 0 ? 'muted' : '') + '">净 ' + (burn == null ? '—' : (intake - burn > 0 ? '+' : '') + n0(intake - burn)) + '</span>') +
      '</div>';
  }

  function energyCard() {
    var today = todayKey(), t = M.targets();
    var intake = M.intakeOn(today);
    var burn = M.burnOn(today);
    var net = burn == null ? null : intake.kcal - burn;
    var remain = (t.kcal || 0) - intake.kcal;
    var pKcal = intake.proteinG * 4, fKcal = intake.fatG * 9, cKcal = intake.carbG * 4;
    var totalM = pKcal + fKcal + cKcal || 1;

    var body = '<div class="energy">' +
      '<div class="ring-wrap"><div id="ch-ring"></div><div class="ring-center">' +
      '<b style="color:' + (remain < 0 ? 'var(--red)' : 'var(--text)') + '">' + (t.kcal ? n0(Math.abs(remain)) : '—') + '</b>' +
      '<span>' + (t.kcal ? (remain >= 0 ? '还可摄入 kcal' : '已超出 kcal') : '未设置目标') + '</span></div></div>' +
      '<div class="energy-legend">' +
      '<div class="el-row"><i style="background:' + K.intake + '"></i><span class="k">已摄入</span><span class="v">' + n0(intake.kcal) + '</span></div>' +
      '<div class="el-row"><i style="background:' + K.burn + '"></i><span class="k">今日总消耗</span><span class="v">' + n0(burn) + '</span></div>' +
      '<div class="el-row"><i style="background:' + K.net + '"></i><span class="k">能量差额</span><span class="v" style="color:' + (net > 0 ? 'var(--amber)' : 'var(--accent)') + '">' + (net > 0 ? '+' : '') + n0(net) + '</span></div>' +
      '<div class="el-row"><i style="background:var(--text-3)"></i><span class="k">目标缺口</span><span class="v">' + (t.kcal ? (t.deficit > 0 ? '-' : '+') + n0(Math.abs(t.deficit)) : '—') + '</span></div>' +
      '<div class="hr" style="margin:6px 0"></div>' +
      '<div class="macro-stack">' +
      '<i style="width:' + (pKcal / totalM * 100) + '%;background:' + K.protein + '"></i>' +
      '<i style="width:' + (fKcal / totalM * 100) + '%;background:' + K.fatM + '"></i>' +
      '<i style="width:' + (cKcal / totalM * 100) + '%;background:' + K.carb + '"></i></div>' +
      '<div class="macro-legend">' +
      '<span class="ml"><i style="background:' + K.protein + '"></i>蛋白 <b>' + n0(intake.proteinG) + '</b>/' + n0(t.protein) + 'g</span>' +
      '<span class="ml"><i style="background:' + K.fatM + '"></i>脂肪 <b>' + n0(intake.fatG) + '</b>/' + n0(t.fat) + 'g</span>' +
      '<span class="ml"><i style="background:' + K.carb + '"></i>碳水 <b>' + n0(intake.carbG) + '</b>/' + n0(t.carb) + 'g</span>' +
      '</div></div></div>';
    return card('今日能量账户', '摄入与消耗记录；缺失数据不作为零消耗', body,
      '<span class="badge ' + (t.kcal && remain < 0 ? 'warn' : 'ok') + '">' + (intake.kcal === 0 ? '待记录' : (!t.kcal ? '已记录' : (remain < 0 ? '超出目标' : '在预算内'))) + '</span>');
  }

  function goalCard() {
    var p = M.p(), g = p.goal || {}, lb = M.latestBody();
    var bodies = M.fastingBodies().length ? M.fastingBodies() : M.bodies();
    var start = bodies.length ? bodies[0].weightKg : null;
    var cur = M.weight();
    var target = g.targetWeightKg;
    if (!g.type || g.type === 'record_only') return card('健康记录', '当前仅记录，未设置饮食目标', '<div class="stat-line"><b>' + n1(cur) + '</b><span>kg 当前</span></div><p class="tiny muted">按自己的节奏记录饮食、活动和体重。需要时可在设置中主动选择目标。</p>');
    if (!target) {
      return card('目标进度', '先定一个可量化的目标',
        '<div class="stat-line"><b>' + n1(cur) + '</b><span>kg 当前</span></div>' +
        '<div class="hr"></div>' +
        '<div class="tiny muted" style="line-height:1.8">设定目标体重后，系统会用近 3 周实测趋势推算达成日期，并据此反推每日热量缺口与蛋白目标。</div>' +
        '<div class="hr"></div>' +
        '<div class="stack-8">' +
        '<div class="row" style="justify-content:space-between"><span class="tiny muted">基础代谢 BMR</span><span class="tiny num">' + n0(M.bmr()) + ' kcal</span></div>' +
        '<div class="row" style="justify-content:space-between"><span class="tiny muted">每日总消耗 TDEE</span><span class="tiny num">' + n0(M.tdee()) + ' kcal</span></div>' +
        '<div class="row" style="justify-content:space-between"><span class="tiny muted">训练连续天数</span><span class="tiny num">' + M.streak(function (k) { return M.workoutsOn(k).length > 0; }) + ' 天</span></div>' +
        '</div>' +
        '<button class="btn primary sm" data-act="settings" style="margin-top:16px;width:100%">设定目标体重</button>');
    }
    var pct = 0;
    if (start && cur && target && start !== target) pct = clamp((start - cur) / (start - target), 0, 1);
    var slope = M.slope(M.seriesWeight(M.range(21)));
    var eta = '';
    if (slope && target && cur) {
      var rateWk = slope * 7;
      if ((target < cur && rateWk < -0.02) || (target > cur && rateWk > 0.02)) {
        var weeks = (target - cur) / rateWk;
        var d = addDays(new Date(), Math.round(weeks * 7));
        eta = '按近 3 周趋势，预计 <b>' + ymd(d) + '</b> 达成（每周 ' + (rateWk > 0 ? '+' : '') + n2(rateWk) + ' kg）';
      } else {
        eta = '近 3 周体重趋势平缓，尚未朝目标移动。';
      }
    }
    var body = '<div class="stat-line"><b>' + n1(cur) + '</b><span>kg 当前</span>' +
      '<span class="dot-sep"></span><span class="tiny muted">起始 ' + n1(start) + ' → 目标 ' + n1(target) + '</span></div>' +
      '<div class="bar" style="margin-top:12px;height:8px"><i style="width:' + (pct * 100) + '%;background:linear-gradient(90deg,' + K.accent + ',#22d3ee)"></i></div>' +
      '<div class="row" style="justify-content:space-between;margin-top:6px"><span class="tiny muted">已完成 ' + Math.round(pct * 100) + '%</span>' +
      '<span class="tiny muted">还差 ' + (target && cur ? n1(Math.abs(cur - target)) : '—') + ' kg</span></div>' +
      '<div class="hr"></div>' +
      '<div class="stack-8">' +
      '<div class="row" style="justify-content:space-between"><span class="tiny muted">目标类型</span><span class="badge info">' + ({ fat_loss: '减脂', maintain: '维持', muscle_gain: '增肌' }[g.type] || '减脂') + '</span></div>' +
      '<div class="row" style="justify-content:space-between"><span class="tiny muted">基础代谢 BMR</span><span class="tiny num">' + n0(M.bmr()) + ' kcal</span></div>' +
      '<div class="row" style="justify-content:space-between"><span class="tiny muted">每日总消耗 TDEE</span><span class="tiny num">' + n0(M.tdee()) + ' kcal</span></div>' +
      '<div class="row" style="justify-content:space-between"><span class="tiny muted">训练连续天数</span><span class="tiny num">' + M.streak(function (k) { return M.workoutsOn(k).length > 0; }) + ' 天</span></div>' +
      '</div>' +
      (eta ? '<div class="tiny muted" style="margin-top:10px;line-height:1.6">' + eta + '</div>' : '');
    return card('目标进度', '基于晨起空腹体重趋势推算', body);
  }

  function trendCard() {
    var keys = M.range(S.range);
    var labels = keys.map(function (k) { return k.slice(5).replace('-', '/'); });
    var nf = M.fastingBodies().length;
    var sub = '仅取晨起空腹读数 · 左轴 kg · 右轴 %';
    if (M.hasFasting() && nf < 2) sub = '晨起空腹仅 ' + nf + ' 次记录 · 连续几天后趋势才有意义';
    return card('体重 / 体脂趋势', sub, '<div class="chart-host" id="ch-trend" style="height:236px"></div>',
      '<div class="seg" id="trend-seg">' +
      '<button data-trend="weight" class="' + (S.trend.weight ? 'on' : '') + '">体重</button>' +
      '<button data-trend="fat" class="' + (S.trend.fat ? 'on' : '') + '">体脂</button>' +
      '<button data-trend="muscle" class="' + (S.trend.muscle ? 'on' : '') + '">肌肉</button></div>');
  }

  function recoveryCard() {
    var today = todayKey();
    var keys = M.range(7);
    var act = M.activityOn(today) || {};
    var prev7 = M.range(8).slice(0, 7);
    function avg(f) {
      var v = prev7.map(function (k) { var a = M.activityOn(k); return a && a[f] != null ? a[f] : null; }).filter(function (x) { return x != null; });
      return v.length ? sum(v) / v.length : null;
    }
    var rows = [
      ['睡眠', act.sleepMin != null ? (Math.floor(act.sleepMin / 60) + 'h ' + (act.sleepMin % 60) + 'm') : '—', avg('sleepMin'), K.muscle, act.sleepMin != null ? clamp(act.sleepMin / 480, 0, 1) : 0],
      ['步数', act.steps != null ? n0(act.steps) : '—', avg('steps'), K.accent, act.steps ? clamp(act.steps / 10000, 0, 1) : 0],
      ['静息心率', act.restingHr != null ? act.restingHr + ' bpm' : '—', avg('restingHr'), K.fat, act.restingHr ? clamp((90 - act.restingHr) / 30, 0, 1) : 0],
      ['HRV', act.hrvMs != null ? act.hrvMs + ' ms' : '—', avg('hrvMs'), K.violet, act.hrvMs ? clamp(act.hrvMs / 80, 0, 1) : 0]
    ];
    var body = '<div class="stack-8">' + rows.map(function (r) {
      return '<div class="prog-row"><span class="t">' + r[0] + '</span>' +
        '<span class="v"><b style="color:var(--text);font-size:12.5px">' + r[1] + '</b>' +
        (r[2] != null ? ' <span class="muted">· 7日均 ' + (r[0] === '步数' ? n0(r[2]) : n1(r[2])) + '</span>' : '') + '</span>' +
        '<div class="bar"><i style="width:' + (r[4] * 100) + '%;background:' + r[3] + '"></i></div></div>';
    }).join('') + '</div>' +
      '<div class="hr"></div>' +
      '<div class="row" style="justify-content:space-between"><span class="tiny muted">数据来源</span><span class="badge">' + (M.activityOn(today) ? '小米手环' : '未同步') + '</span></div>' +
      '<div class="tiny muted" style="margin-top:8px">手环数据缺失时，消耗按 BMR × 活动系数 + 训练估算补全。</div>';
    return card('睡眠与恢复', '今日 vs 近 7 日均值', body);
  }

  function balanceCard() {
    var keys = M.range(S.range);
    var labels = keys.map(function (k) { return k.slice(5).replace('-', '/'); });
    var intakes = M.seriesIntake(keys), burns = M.seriesBurnReal(keys);
    var valid = keys.filter(function (k) { return M.intakeOn(k).kcal > 0 && M.burnOn(k); });
    var avgNet = valid.length ? sum(valid, function (k) { return M.intakeOn(k).kcal - M.burnOn(k); }) / valid.length : null;
    return card('热量收支', '上为摄入 · 下为消耗 · 近 ' + S.range + ' 天',
      '<div class="chart-host" id="ch-balance" style="height:212px"></div>',
      avgNet != null ? '<span class="badge ' + (avgNet > 0 ? 'warn' : 'ok') + '">' + (valid.length > 1 ? '日均 ' : '今日 ') + (avgNet > 0 ? '+' : '') + n0(avgNet) + ' kcal</span>' : '');
  }

  function trainingCard() {
    var days = [];
    for (var i = 111; i >= 0; i--) {
      var k = ymd(addDays(new Date(), -i));
      days.push({ date: k, value: M.workoutKcalOn(k) });
    }
    var wkKeys = M.range(7);
    var wkCount = sum(wkKeys, function (k) { return M.workoutsOn(k).length; });
    var wkMin = sum(wkKeys, function (k) { return sum(M.workoutsOn(k), function (w) { return w.durationMin; }); });
    var wkKcal = sum(wkKeys, function (k) { return M.workoutKcalOn(k); });
    var body = '<div class="grid g3" style="gap:10px;margin-bottom:14px">' +
      ['训练次数|' + wkCount + '|次', '总时长|' + n0(wkMin) + '|分钟', '消耗|' + n0(wkKcal) + '|kcal'].map(function (s) {
        var p = s.split('|');
        return '<div><div class="tiny muted">' + p[0] + '</div><div class="stat-line"><b style="font-size:18px">' + p[1] + '</b><span>' + p[2] + '</span></div></div>';
      }).join('') + '</div>' +
      '<div id="ch-heat"></div>' +
      '<div class="tiny muted" style="margin-top:8px">近 16 周训练热力（按训练消耗）</div>';
    return card('训练负荷', '本周概况', body);
  }

  function timelineCard() {
    var today = todayKey();
    var items = [];
    M.mealsOn(today).forEach(function (m) {
      items.push({
        ts: m.ts, kind: 'meal', badge: SLOT_ABBR[m.slot] || '食', color: K.intake,
        title: m.title || (SLOTS[m.slot] || '用餐'),
        meta: (m.items || []).map(function (i) { return i.name; }).join(' · ') || '—',
        val: n0((m.totals || {}).kcal) + ' kcal'
      });
    });
    M.workoutsOn(today).forEach(function (w) {
      var wd = WORKOUTS[w.type] || WORKOUTS.other;
      var det = [];
      if (w.volume && w.volume.sets) det.push(w.volume.sets.length + ' 组');
      if (w.volume && w.volume.totalReps) det.push(w.volume.totalReps + ' 次');
      if (w.distanceKm) det.push(n1(w.distanceKm) + ' km');
      if (w.durationMin) det.push(w.durationMin + ' 分钟');
      items.push({
        ts: w.ts, kind: 'workout', badge: '练', color: K.burn,
        title: wd.label, meta: det.join(' · ') || '—', val: '-' + n0(w.kcal) + ' kcal'
      });
    });
    M.supplementsOn(today).forEach(function (s) {
      items.push({
        ts: s.ts, kind: 'supp', badge: '补', color: K.violet,
        title: s.name, meta: [s.dose, s.timing].filter(Boolean).join(' · ') || '—',
        val: s.nutrients && s.nutrients.kcal ? n0(s.nutrients.kcal) + ' kcal' : ''
      });
    });
    items.sort(function (a, b) { return String(b.ts).localeCompare(String(a.ts)); });
    var body;
    if (!items.length) {
      body = emptyHTML('今天还没有记录', '点右上角「快速记录」，或直接在对话里告诉我吃了什么、练了什么。',
        '<button class="btn primary sm" data-act="quick">开始记录</button>');
    } else {
      body = '<div class="timeline">' + items.map(function (it) {
        return '<div class="tl-item"><span class="tl-time">' + hhmm(it.ts) + '</span>' +
          '<span class="tl-icon" style="color:' + it.color + ';border-color:' + it.color + '33;background:' + it.color + '14">' + it.badge + '</span>' +
          '<div class="tl-body"><div class="tl-title">' + esc(it.title) + '</div>' +
          '<div class="tl-meta">' + esc(it.meta) + '</div></div>' +
          '<span class="tl-val">' + it.val + '</span></div>';
      }).join('') + '</div>';
    }
    return card('今日时间线', items.length + ' 条记录', body,
      '<button class="btn sm" data-act="quick">补录</button>');
  }

  function suppTodayCard() {
    var today = todayKey();
    var list = M.supplementsOn(today);
    var body;
    if (!list.length) {
      body = emptyHTML('今日未记录补剂', '补剂的热量与蛋白同样计入全天摄入。',
        '<button class="btn sm" data-act="add-supp">添加补剂</button>');
    } else {
      body = '<div class="stack-8">' + list.map(function (s) {
        return '<div class="row" style="justify-content:space-between;padding:6px 0;border-bottom:1px dashed var(--line)">' +
          '<div><div style="font-size:12.5px;font-weight:560">' + esc(s.name) + '</div>' +
          '<div class="tiny muted">' + esc([s.dose, s.timing, hhmm(s.ts)].filter(Boolean).join(' · ')) + '</div></div>' +
          '<div class="row" style="gap:10px"><span class="tiny num muted">' + (s.nutrients && s.nutrients.proteinG ? n0(s.nutrients.proteinG) + 'g 蛋白' : '') + '</span>' +
          '<span class="badge ok">已服</span></div></div>';
      }).join('') + '</div>';
    }
    var adh = 0, days = 0;
    for (var i = 0; i < 30; i++) {
      var k = ymd(addDays(new Date(), -i));
      if (i === 0 && !M.supplementsOn(k).length) continue;
      days++;
      if (M.supplementsOn(k).length) adh++;
    }
    return card('补剂 · 今日', '依从性 30 天 ' + (days ? Math.round(adh / days * 100) : 0) + '%', body,
      '<button class="btn sm" data-act="add-supp">添加</button>');
  }

  /* ================= 视图：身体成分 ================= */
  function viewBody() {
    var lb = M.refBody(), p = M.p();
    if (!lb) {
      return card('身体成分', '体脂秤与手动记录', emptyHTML('还没有体成分数据',
        '在体脂秤上称一次，把体重 / 体脂率录进来；或从数据源页导入小米健康导出的 CSV。',
        '<button class="btn primary sm" data-act="add-body">录入体成分</button>'));
    }
    var tiles = [
      ['体重', n1(lb.weightKg), 'kg', K.weight],
      ['体脂率', lb.bodyFatPct != null ? n1(lb.bodyFatPct) : '—', '%', K.fat],
      ['肌肉量', lb.muscleKg != null ? n1(lb.muscleKg) : '—', 'kg', K.muscle],
      ['体水分', lb.waterPct != null ? n1(lb.waterPct) : '—', '%', K.water],
      ['内脏脂肪', lb.visceralFat != null ? n0(lb.visceralFat) : '—', '级',
        lb.visceralFat == null ? K.visceral : (lb.visceralFat >= 15 ? 'var(--red)' : lb.visceralFat >= 10 ? 'var(--amber)' : K.visceral)],
      ['基础代谢', lb.bmrKcal != null ? n0(lb.bmrKcal) : n0(M.bmr()), 'kcal', '#94a3b8'],
      ['骨量', lb.boneKg != null ? n1(lb.boneKg) : '—', 'kg', '#a3a3a3'],
      lb.proteinPct != null
        ? ['蛋白质', n1(lb.proteinPct), '%', K.accent]
        : ['身体年龄', lb.bodyAge != null ? n0(lb.bodyAge) : '—', '岁', K.accent]
    ];
    var tileHTML = '<div class="grid g4" style="gap:12px">' + tiles.map(function (t) {
      return '<div class="card" style="padding:14px 16px"><div class="kpi-label">' + t[0] + '</div>' +
        '<div class="kpi-value"><b style="font-size:23px;color:' + t[3] + '">' + t[1] + '</b><span>' + t[2] + '</span></div></div>';
    }).join('') + '</div>';

    var fatPct = lb.bodyFatPct;
    var grades = p.sex === 'female'
      ? [[0, 21, '偏低'], [21, 25, '健康'], [25, 32, '偏高'], [32, 60, '肥胖']]
      : [[0, 10, '偏低'], [10, 18, '健康'], [18, 25, '偏高'], [25, 60, '肥胖']];
    var gradeIdx = 0;
    grades.forEach(function (g, i) { if (fatPct >= g[0] && fatPct < g[1]) gradeIdx = i; });
    var gradeHTML = '<div class="row" style="justify-content:space-between"><span class="tiny muted">体脂分级</span>' +
      '<span class="badge ' + (gradeIdx === 1 ? 'ok' : gradeIdx === 2 ? 'warn' : gradeIdx === 3 ? 'bad' : 'info') + '">' +
      (fatPct != null ? grades[gradeIdx][2] : '—') + '</span></div>' +
      '<div class="grade-bar">' + grades.map(function (g, i) {
        var c = ['#5b9dff', '#2be0b4', '#f5a524', '#f97066'][i];
        var w = Math.min(g[1], g[0] + 26) - g[0];
        return '<i class="' + (i === gradeIdx ? 'on' : '') + '" style="flex:' + w + ' 1 0;background:' + c + '"></i>';
      }).join('') + '</div>' +
      '<div style="display:flex;margin-top:5px">' +
      grades.map(function (g, i) {
        var w = Math.min(g[1], g[0] + 26) - g[0];
        return '<span class="tiny muted" style="flex:' + w + ' 1 0">' + g[0] + '</span>';
      }).join('') + '</div>';

    var keys = M.range(S.range);
    var labels = keys.map(function (k) { return k.slice(5).replace('-', '/'); });
    var trendHTML = '<div class="chart-host" id="ch-body-trend" style="height:260px"></div>';

    var rows = M.bodies().slice().reverse().slice(0, 30);
    var tableHTML = '<div class="scroll-y" style="max-height:340px"><table class="tbl"><thead><tr>' +
      '<th>日期</th><th>时段</th><th class="r">体重</th><th class="r">体脂</th><th class="r">肌肉</th><th class="r">水分</th><th class="r">内脏</th><th class="r">BMR</th><th></th></tr></thead><tbody>' +
      rows.map(function (b) {
        var fm = M.modeOf(b) === 'fasting';
        return '<tr><td>' + b.date + ' <span class="muted tiny">周' + weekday(b.date) + '</span></td>' +
          '<td><span class="badge ' + (fm ? 'ok' : '') + '" style="font-size:10px;padding:1px 6px">' + (fm ? '晨起' : '睡前') + '</span></td>' +
          '<td class="r strong">' + n1(b.weightKg) + '</td>' +
          '<td class="r">' + (b.bodyFatPct != null ? n1(b.bodyFatPct) : '—') + '</td>' +
          '<td class="r">' + (b.muscleKg != null ? n1(b.muscleKg) : '—') + '</td>' +
          '<td class="r">' + (b.waterPct != null ? n1(b.waterPct) : '—') + '</td>' +
          '<td class="r">' + (b.visceralFat != null ? n0(b.visceralFat) : '—') + '</td>' +
          '<td class="r muted">' + (b.bmrKcal != null ? n0(b.bmrKcal) : '—') + '</td>' +
          '<td class="r"><button class="icon-btn" style="width:24px;height:24px" data-act="del-body" data-id="' + b.id + '">' +
          '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg></button></td></tr>';
      }).join('') + '</tbody></table></div>';

    return '<div class="grid g-2-1">' +
      card('身体成分', (M.modeOf(lb) === 'fasting' ? '晨起空腹' : '睡前') + ' · 参照 ' + lb.date + ' ' + (lb.ts ? hhmm(lb.ts) : ''), tileHTML +
        '<div class="hr"></div>' + gradeHTML,
        '<button class="btn sm" data-act="add-body">录入</button>') +
      card('体脂分布与目标', '与目标体脂的差距', '<div class="stack-8">' +
        progRow('体脂率', fatPct, (M.p().goal || {}).targetBodyFatPct || (M.p().sex === 'female' ? 25 : 18), K.fat, '%') +
        progRow('肌肉量', lb.muscleKg, fatPct ? (M.weight() || 0) * (1 - fatPct / 100) : (M.weight() || 0) * 0.45, K.muscle, 'kg') +
        progRow('体水分', lb.waterPct, M.p().sex === 'female' ? 52 : 60, K.water, '%') +
        '</div><div class="hr"></div>' +
        '<div class="tiny muted" style="line-height:1.7">体脂率建议以晨起空腹、同一台秤测量为准；不同时间与含水量会让读数波动 1-2 个百分点。' +
        ((M.p().goal || {}).targetBodyFatPct ? '' : '<br>未设定目标时，按' + (M.p().sex === 'female' ? '女性 25%' : '男性 18%') + '参考值显示。') +
        '<br>肌肉量按体脂秤口径（体重 − 脂肪 − 骨量），目标取去脂体重，不是骨骼肌量。' +
        '</div>') +
      '</div>' +
      '<div class="mt14">' + card('体成分趋势',
        M.fastingBodies().length < 2 ? '晨起空腹仅 ' + M.fastingBodies().length + ' 次记录 · 再称一次就能看出变化' : '近 ' + S.range + ' 天 · 只画晨起空腹 · 点选切换序列',
        trendHTML,
        '<div class="seg" id="body-seg">' +
        [['weight', '体重'], ['bodyFatPct', '体脂'], ['muscleKg', '肌肉'], ['waterPct', '水分'], ['visceralFat', '内脏']].map(function (o, i) {
          return '<button data-field="' + o[0] + '" class="' + (i === 0 ? 'on' : '') + '">' + o[1] + '</button>';
        }).join('') + '</div>') + '</div>' +
      '<div class="mt14">' + card('历史记录', M.bodies().length + ' 条', tableHTML) + '</div>';
  }

  /* ================= 视图：饮食 ================= */
  function viewNutrition() {
    var dk = S.day || todayKey();
    var meals = M.mealsOn(dk).sort(function (a, b) { return String(a.ts).localeCompare(String(b.ts)); });
    var tot = M.intakeOn(dk), t = M.targets();
    var keys = M.range(7);
    var top = '<div class="row wrap" style="gap:12px;margin-bottom:14px">' +
      '<div class="row" style="gap:6px">' +
      '<button class="btn sm" data-act="day-prev">←</button>' +
      '<div style="min-width:132px;text-align:center"><b style="font-size:13.5px">' + dk + '</b> <span class="muted tiny">周' + weekday(dk) + '</span></div>' +
      '<button class="btn sm" data-act="day-next">→</button>' +
      (dk !== todayKey() ? '<button class="btn sm ghost" data-act="day-today">今天</button>' : '') +
      '</div><div style="flex:1"></div>' +
      '<span class="badge ' + (tot.kcal > 0 ? (tot.kcal > (t.kcal || 1e9) ? 'warn' : 'ok') : '') + '">摄入 ' + n0(tot.kcal) + ' / ' + n0(t.kcal) + ' kcal</span>' +
      '<button class="btn primary sm" data-act="add-meal" data-slot="' + guessSlot() + '">+ 记一餐</button>' +
      '</div>';

    var summary = '<div class="grid g4" style="gap:12px;margin-bottom:14px">' +
      [['热量', n0(tot.kcal), 'kcal', K.intake, tot.kcal, t.kcal],
       ['蛋白质', n0(tot.proteinG), 'g', K.protein, tot.proteinG, t.protein],
       ['脂肪', n0(tot.fatG), 'g', K.fatM, tot.fatG, t.fat],
       ['碳水', n0(tot.carbG), 'g', K.carb, tot.carbG, t.carb]].map(function (x) {
        var pct = x[5] ? clamp(x[4] / x[5], 0, 1) * 100 : 0;
        return '<div class="card" style="padding:14px 16px"><div class="kpi-label">' + x[0] + '</div>' +
          '<div class="kpi-value"><b style="font-size:22px">' + x[1] + '</b><span>' + x[2] + '</span></div>' +
          '<div class="bar" style="margin-top:9px"><i style="width:' + pct + '%;background:' + x[3] + '"></i></div>' +
          '<div class="tiny muted" style="margin-top:5px">目标 ' + n0(x[5]) + ' ' + x[2] + ' · ' + Math.round(pct) + '%</div></div>';
      }).join('') + '</div>';

    var suppList = M.supplementsOn(dk);
    var suppCard = card('补剂', suppList.length ? n0(sum(suppList, function (s) { return (s.nutrients || {}).kcal; })) + ' kcal · 已计入上方摄入' : '未记录',
      suppList.length ? '<div class="grid g3" style="gap:10px">' + suppList.map(function (s) {
        return '<div style="padding:8px 10px;border:1px solid var(--line);border-radius:9px;background:var(--panel-2)">' +
          '<div style="font-size:12.5px;font-weight:560">' + esc(s.name) + '</div>' +
          '<div class="tiny muted">' + esc([s.dose, s.timing].filter(Boolean).join(' · ')) + '</div>' +
          '<div class="tiny num" style="margin-top:3px;color:var(--text-3)">' +
          ((s.nutrients || {}).proteinG ? n0(s.nutrients.proteinG) + 'g 蛋白' : '') +
          ((s.nutrients || {}).kcal ? ' · ' + n0(s.nutrients.kcal) + ' kcal' : '') + '</div></div>';
      }).join('') + '</div>' : '<div class="tiny muted" style="padding:2px 0 10px">蛋白粉等补剂的热量与蛋白已计入上方汇总</div>',
      '<button class="btn sm ghost" data-act="add-supp">+</button>', 'span2');

    var mealCards = '<div class="grid g2">' + ['breakfast', 'lunch', 'dinner', 'snack'].map(function (slot) {
      var list = meals.filter(function (m) { return m.slot === slot; });
      var kcal = sum(list, function (m) { return (m.totals || {}).kcal; });
      return card(SLOTS[slot], list.length ? n0(kcal) + ' kcal' : '未记录',
        list.length ? list.map(function (m) {
          return '<div style="padding:8px 0;border-bottom:1px dashed var(--line)">' +
            '<div class="row" style="justify-content:space-between"><div style="font-size:12.5px;font-weight:560">' + esc(m.title || SLOTS[slot]) + '</div>' +
            '<div class="row" style="gap:8px"><span class="tiny num">' + n0((m.totals || {}).kcal) + ' kcal</span>' +
            '<button class="icon-btn" style="width:22px;height:22px" data-act="del-meal" data-id="' + m.id + '">' +
            '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg></button></div></div>' +
            '<div class="tiny muted" style="margin-top:3px">' +
            (m.items || []).map(function (i) { return esc(i.name) + (i.amount ? ' ' + esc(i.amount) : ''); }).join(' · ') + '</div>' +
            '<div class="tiny" style="margin-top:3px;color:var(--text-3)">P ' + n0((m.totals || {}).proteinG) + ' · F ' + n0((m.totals || {}).fatG) + ' · C ' + n0((m.totals || {}).carbG) +
            (m.confidence === 'estimated' ? ' · <span style="color:var(--amber)">估算</span>' : '') + '</div></div>';
        }).join('') : '<div class="tiny muted" style="padding:4px 0 8px">还没有记录</div>',
        '<button class="btn sm ghost" data-act="add-meal" data-slot="' + slot + '">+</button>', '');
    }).join('') + suppCard + '</div>';

    var labels = keys.map(function (k) { return k.slice(5).replace('-', '/'); });
    var chart = card('近 7 天摄入', '热量与蛋白摄入', '<div class="chart-host" id="ch-intake" style="height:200px"></div>');

    return top + summary + mealCards + '<div class="mt14">' + chart + '</div>';
  }
  function guessSlot() {
    var h = new Date().getHours();
    if (h < 10) return 'breakfast';
    if (h < 15) return 'lunch';
    if (h < 21) return 'dinner';
    return 'snack';
  }

  /* ================= 视图：运动 ================= */
  function viewTraining() {
    var list = (S.data.workouts || []).slice();
    var wkKeys = M.range(7);
    var monthKeys = M.range(30);
    var wkCount = sum(wkKeys, function (k) { return M.workoutsOn(k).length; });
    var moCount = sum(monthKeys, function (k) { return M.workoutsOn(k).length; });
    var wkMin = sum(wkKeys, function (k) { return sum(M.workoutsOn(k), function (w) { return w.durationMin; }); });
    var wkKcal = sum(wkKeys, function (k) { return M.workoutKcalOn(k); });
    var wkVolume = sum(wkKeys, function (k) {
      return sum(M.workoutsOn(k), function (w) { return (w.volume && w.volume.totalReps) || 0; });
    });

    var head = '<div class="grid g4" style="gap:12px;margin-bottom:14px">' +
      [['本周训练', n0(wkCount), '次', '近 30 天 ' + moCount + ' 次'],
       ['本周时长', n0(wkMin), '分钟', '日均 ' + n0(wkMin / 7) + ' 分钟'],
       ['本周消耗', n0(wkKcal), 'kcal', '日均 ' + n0(wkKcal / 7) + ' kcal'],
       ['自重总次数', n0(wkVolume), '次', '俯卧撑 / 深蹲 / 卷腹']].map(function (x) {
        return '<div class="card" style="padding:14px 16px"><div class="kpi-label">' + x[0] + '</div>' +
          '<div class="kpi-value"><b style="font-size:22px">' + x[1] + '</b><span>' + x[2] + '</span></div>' +
          '<div class="kpi-foot"><span class="muted">' + x[3] + '</span></div></div>';
      }).join('') + '</div>';

    var byType = {};
    (S.data.workouts || []).forEach(function (w) {
      byType[w.type] = byType[w.type] || { count: 0, min: 0, kcal: 0, reps: 0 };
      byType[w.type].count++;
      byType[w.type].min += w.durationMin || 0;
      byType[w.type].kcal += w.kcal || 0;
      byType[w.type].reps += (w.volume && w.volume.totalReps) || 0;
    });
    var typeRows = Object.keys(byType).sort(function (a, b) { return byType[b].count - byType[a].count; });
    var maxCount = Math.max.apply(null, typeRows.map(function (k) { return byType[k].count; }).concat([1]));
    var typeHTML = typeRows.length ? typeRows.map(function (k) {
      var d = byType[k], meta = WORKOUTS[k] || WORKOUTS.other;
      return '<div class="prog-row"><span class="t">' + meta.label + '</span>' +
        '<span class="v">' + d.count + ' 次 · ' + n0(d.kcal) + ' kcal</span>' +
        '<div class="bar"><i style="width:' + (d.count / maxCount * 100) + '%;background:' + K.burn + '"></i></div></div>';
    }).join('') : emptyHTML('还没有训练记录', '可以口述「今天做了 100 个俯卧撑、5 分钟平板支撑」。');

    var rows = list.sort(function (a, b) { return String(b.ts).localeCompare(String(a.ts)); }).slice(0, 40);
    var table = rows.length ? '<div class="scroll-y" style="max-height:400px"><table class="tbl"><thead><tr>' +
      '<th>日期</th><th>项目</th><th>内容</th><th class="r">时长</th><th class="r">消耗</th><th></th></tr></thead><tbody>' +
      rows.map(function (w) {
        var d = WORKOUTS[w.type] || WORKOUTS.other;
        var content = [];
        if (w.volume && w.volume.sets) content.push(w.volume.sets.length + ' 组');
        if (w.volume && w.volume.totalReps) content.push(w.volume.totalReps + ' 次');
        if (w.distanceKm) content.push(n1(w.distanceKm) + ' km');
        if (!content.length && w.note) content.push(w.note);
        return '<tr><td>' + w.date.slice(5) + ' <span class="muted tiny">' + hhmm(w.ts) + '</span></td>' +
          '<td class="strong">' + d.label + '</td><td class="muted">' + esc(content.join(' · ') || '—') + '</td>' +
          '<td class="r">' + (w.durationMin ? w.durationMin + '′' : '—') + '</td>' +
          '<td class="r strong">' + n0(w.kcal) + '</td>' +
          '<td class="r"><button class="icon-btn" style="width:24px;height:24px" data-act="del-workout" data-id="' + w.id + '">' +
          '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg></button></td></tr>';
      }).join('') + '</tbody></table></div>' : emptyHTML('暂无训练', '记录第一场训练，热力图会开始生长。');

    return head +
      '<div class="grid g-1-2 g-start">' +
      card('项目分布', '按训练次数', '<div class="stack-8">' + typeHTML + '</div>') +
      card('训练明细', rows.length + ' 条', table, '<button class="btn primary sm" data-act="add-workout">+ 记录训练</button>') +
      '</div>' +
      '<div class="mt14">' + card('训练热力图', '近 16 周 · 每日训练消耗', '<div id="ch-heat2"></div>') + '</div>';
  }

  /* ================= 视图：补剂 ================= */
  function viewSupplements() {
    var today = todayKey();
    var list = (S.data.supplements || []).slice().sort(function (a, b) { return String(b.ts).localeCompare(String(a.ts)); });
    var todayList = M.supplementsOn(today);
    var adh = 0, dcount = 0;
    for (var i = 0; i < 30; i++) {
      var k = ymd(addDays(new Date(), -i));
      var has = M.supplementsOn(k).length > 0;
      if (has) dcount++;
      if (has) adh++;
    }
    var days = [];
    for (var j = 29; j >= 0; j--) {
      var kk = ymd(addDays(new Date(), -j));
      days.push({ date: kk, value: M.supplementsOn(kk).length });
    }
    var nameCount = {};
    list.forEach(function (s) { nameCount[s.name] = (nameCount[s.name] || 0) + 1; });
    var names = Object.keys(nameCount).sort(function (a, b) { return nameCount[b] - nameCount[a]; });

    var head = '<div class="grid g4" style="gap:12px;margin-bottom:14px">' +
      [['今日已服', todayList.length, '种'], ['30天记录', dcount, '天'], ['常用补剂', names.length, '种'],
       ['蛋白质补充', n0(sum(todayList, function (s) { return (s.nutrients || {}).proteinG; })), 'g']].map(function (x) {
        return '<div class="card" style="padding:14px 16px"><div class="kpi-label">' + x[0] + '</div>' +
          '<div class="kpi-value"><b style="font-size:22px">' + x[1] + '</b><span>' + x[2] + '</span></div></div>';
      }).join('') + '</div>';

    var todayBody = todayList.length ? '<div class="stack-8">' + todayList.map(function (s) {
      return '<div class="row" style="justify-content:space-between;padding:8px 0;border-bottom:1px dashed var(--line)">' +
        '<div><div style="font-size:13px;font-weight:560">' + esc(s.name) + '</div>' +
        '<div class="tiny muted">' + esc([s.dose, s.timing, hhmm(s.ts)].filter(Boolean).join(' · ')) + '</div></div>' +
        '<div class="row" style="gap:8px"><span class="tiny num muted">' +
        ((s.nutrients || {}).proteinG ? n0(s.nutrients.proteinG) + 'g 蛋白' : '') +
        ((s.nutrients || {}).kcal ? ' · ' + n0(s.nutrients.kcal) + ' kcal' : '') + '</span>' +
        '<button class="icon-btn" style="width:24px;height:24px" data-act="del-supp" data-id="' + s.id + '">' +
        '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg></button></div></div>';
    }).join('') + '</div>' : emptyHTML('今天还没打卡', '把常吃的补剂加进来，系统会累积依从性。',
      '<button class="btn primary sm" data-act="add-supp">添加补剂</button>');

    var quickHTML = '<div class="chips">' + SUPPS.slice(0, 8).map(function (s) {
      return '<button class="chip" data-act="quick-supp" data-name="' + s[0] + '" data-dose="' + s[1] + '">' + s[0] + '</button>';
    }).join('') + '</div>';

    var rows = list.slice(0, 60);
    var table = rows.length ? '<div class="scroll-y" style="max-height:420px"><table class="tbl"><thead><tr><th>日期</th><th>补剂</th><th>剂量</th><th>时机</th><th class="r">蛋白</th><th class="r">热量</th></tr></thead><tbody>' +
      rows.map(function (s) {
        return '<tr><td>' + s.date.slice(5) + ' <span class="muted tiny">' + hhmm(s.ts) + '</span></td>' +
          '<td class="strong">' + esc(s.name) + '</td><td>' + esc(s.dose || '—') + '</td><td class="muted">' + esc(s.timing || '—') + '</td>' +
          '<td class="r">' + ((s.nutrients || {}).proteinG ? n0(s.nutrients.proteinG) + 'g' : '—') + '</td>' +
          '<td class="r">' + ((s.nutrients || {}).kcal ? n0(s.nutrients.kcal) : '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : emptyHTML('暂无记录', '');

    var pills = '';
    for (var p = 29; p >= 0; p--) {
      var pk = ymd(addDays(new Date(), -p));
      var n = M.supplementsOn(pk).length;
      var col = n === 0 ? 'var(--panel-3)' : n >= 3 ? K.violet : 'rgba(167,139,250,.55)';
      pills += '<div title="' + pk + ' · ' + n + ' 项" style="flex:1;height:' + (n ? 100 : 38) + '%;background:' + col +
        ';border-radius:3px;min-width:4px"></div>';
    }
    var strip = '<div style="display:flex;align-items:flex-end;gap:3px;height:92px;padding-top:6px">' + pills + '</div>' +
      '<div class="row" style="justify-content:space-between;margin-top:6px"><span class="tiny muted">30 天前</span>' +
      '<span class="tiny muted">今天</span></div>' +
      '<div class="row wrap" style="gap:12px;margin-top:14px">' +
      '<span class="ml"><i style="background:' + K.violet + '"></i>3 项以上</span>' +
      '<span class="ml"><i style="background:rgba(167,139,250,.55)"></i>已打卡</span>' +
      '<span class="ml"><i style="background:var(--panel-3)"></i>未记录</span></div>';

    return head +
      '<div class="grid g-2-1">' +
      card('今日补剂', today, todayBody, '<button class="btn sm" data-act="add-supp">+ 记录</button>') +
      card('常用补剂', '一点即记', quickHTML +
        '<div class="hr"></div><div class="tiny muted" style="line-height:1.7">训练后在对话里说「喝了一勺蛋白粉 + 5g 肌酸」，我会同时补进摄入热量与蛋白。</div>') +
      '</div>' +
      '<div class="mt14">' + card('打卡节奏', '近 30 天每日补剂项数', strip) + '</div>' +
      '<div class="mt14">' + card('补剂明细', rows.length + ' 条', table) + '</div>';
  }

  /* ================= 视图：数据源 ================= */
  function viewSources() {
    var src = S.data.sources || {};
    function srcCard(key, title, desc, icon, statusLabel, statusCls, extra) {
      var s = src[key] || {};
      return '<div class="card"><div class="row" style="justify-content:space-between;align-items:flex-start">' +
        '<div class="row" style="gap:10px"><span class="tl-icon" style="width:32px;height:32px;color:var(--accent);border-color:var(--accent-soft);background:var(--accent-soft)">' + icon + '</span>' +
        '<div><div style="font-size:13px;font-weight:620">' + title + '</div><div class="tiny muted">' + desc + '</div></div></div>' +
        '<span class="badge ' + statusCls + '">' + statusLabel + '</span></div>' +
        '<div class="hr"></div><div class="row" style="justify-content:space-between"><span class="tiny muted">最近同步</span>' +
        '<span class="tiny num">' + (s.lastSync ? s.lastSync.replace('T', ' ').slice(0, 16) : '从未') + '</span></div>' +
        (extra || '') + '</div>';
    }
    var bodyCount = (S.data.bodyMetrics || []).length;
    var actCount = (S.data.dailyActivity || []).length;
    var mealCount = (S.data.meals || []).length;
    var wkCount = (S.data.workouts || []).length;

    var coverage = (function () {
      var withData = 0;
      for (var i = 0; i < 30; i++) {
        var k = ymd(addDays(new Date(), -i));
        if (M.mealsOn(k).length || M.activityOn(k) || M.workoutsOn(k).length) withData++;
      }
      return Math.round(withData / 30 * 100);
    })();

    var grid = '<div class="grid g3">' +
      srcCard('scale', '体脂秤', '体重 / 体脂 / 肌肉 / 水分', '秤', bodyCount ? '已接入' : '待导入', bodyCount ? 'ok' : 'warn',
        '<div class="tiny muted" style="margin-top:6px">' + bodyCount + ' 条记录</div>' +
        '<button class="btn sm" style="margin-top:10px;width:100%" data-act="import" data-kind="scale">导入 CSV</button>') +
      srcCard('band', '手环与活动', '步数 / 心率 / 睡眠 / 消耗', '环', actCount ? '已接入' : '待导入', actCount ? 'ok' : 'warn',
        '<div class="tiny muted" style="margin-top:6px">' + actCount + ' 天记录</div>' +
        '<button class="btn sm" style="margin-top:10px;width:100%" data-act="import" data-kind="band">导入 CSV</button>') +
      srcCard('conversation', '对话录入', '饮食 / 训练 / 补剂', '话', '运行中', 'ok',
        '<div class="tiny muted" style="margin-top:6px">' + mealCount + ' 餐 · ' + wkCount + ' 次训练</div>' +
        '<button class="btn sm" style="margin-top:10px;width:100%" data-act="quick">立即记录</button>') +
      '</div>';

    var health = '<div class="grid g4" style="gap:12px">' +
      [['30 天数据覆盖', coverage + '%', coverage > 70 ? 'ok' : coverage > 40 ? 'warn' : 'bad'],
       ['体成分记录', bodyCount + ' 条', bodyCount > 0 ? 'ok' : 'warn'],
       ['手环天数', actCount + ' 天', actCount > 0 ? 'ok' : 'warn'],
       ['饮食记录', mealCount + ' 餐', mealCount > 0 ? 'ok' : 'warn']].map(function (x) {
        return '<div class="card" style="padding:14px 16px"><div class="kpi-label">' + x[0] + '</div>' +
          '<div class="kpi-value"><b style="font-size:22px">' + x[1] + '</b></div>' +
          '<div class="kpi-foot"><span class="badge ' + x[2] + '">' + ({ ok: '正常', warn: '待补充', bad: '缺失' }[x[2]]) + '</span></div></div>';
      }).join('') + '</div>';

    var help = card('设备数据怎么进来', '支持截图录入与 CSV 导入，导入前核对单位和时段',
      '<div class="stack-8" style="font-size:12.5px;line-height:1.75;color:var(--text-2)">' +
      '<div><b>1.</b> 优先直接把设备截图发给 WorkBuddy；若设备 App 提供导出功能，也可导出 CSV。不同设备的菜单和格式可能不同。</div>' +
      '<div><b>2.</b> 解压后找到 <code style="font-family:var(--mono);font-size:11.5px">weight</code>、<code style="font-family:var(--mono);font-size:11.5px">activity</code> 或 <code style="font-family:var(--mono);font-size:11.5px">sleep</code> 相关文件。</div>' +
      '<div><b>3.</b> 点上方「导入 CSV」，把文件内容粘进去或拖进来。系统会自动识别日期、体重、体脂、步数、睡眠等列，先预览再落库。</div>' +
      '<div style="color:var(--text-3);font-size:11.5px">提示：也可以在对话里直接把秤上的数字告诉我，我写进同一个数据文件，效果一样。</div>' +
      '</div>');

    var io = card('备份与导出', '数据始终在你自己机器上',
      '<div class="row wrap" style="gap:8px">' +
      '<button class="btn" data-act="export">导出 JSON</button>' +
      '<button class="btn" data-act="copy-json">复制 JSON</button>' +
      (S.demo ? '<button class="btn" data-act="exit-demo">退出演示</button>' : '') +
      '</div>' +
      '<div class="hr"></div>' +
      '<div class="tiny muted" style="line-height:1.7">数据文件：<code style="font-family:var(--mono);font-size:11px">data/health-data.json</code><br>' +
      '每次保存自动生成备份到 <code style="font-family:var(--mono);font-size:11px">data/backups/</code>，保留最近 80 份。</div>');

    return '<div class="mt14">' + grid + '</div>' +
      '<div class="mt14">' + card('数据健康度', '越完整，趋势与推算越准', health) + '</div>' +
      '<div class="mt14 grid g-2-1">' + help + io + '</div>';
  }

  /* ================= 图表绘制 ================= */
  function drawCharts() {
    $('#menu-btn').style.display = window.innerWidth <= 900 ? '' : 'none';
    var keys, labels;
    if ($('#ch-ring')) {
      var t = M.targets(), intake = M.intakeOn(todayKey()).kcal;
      ChartLib.ring($('#ch-ring'), { size: 168, stroke: 13, value: intake, target: t.kcal || 1, color: '#2be0b4', color2: '#1fb9d8' });
    }
    if ($('#ch-trend')) {
      keys = M.range(S.range);
      labels = keys.map(function (k) { return k.slice(5).replace('-', '/'); });
      var series = [];
      if (S.trend.weight) series.push({ key: 'w', name: '体重', color: K.weight, values: M.seriesWeight(keys), area: true, filter: function (v) { return n1(v) + ' kg'; } });
      if (S.trend.fat) series.push({ key: 'f', name: '体脂率', color: K.fat, values: M.series(keys, 'bodyFatPct'), axis: 'right', fmt: function (v) { return n1(v) + '%'; } });
      if (S.trend.muscle) series.push({ key: 'm', name: '肌肉量', color: K.muscle, values: M.series(keys, 'muscleKg'), fmt: function (v) { return n1(v) + ' kg'; } });
      series.forEach(function (s) { s.fmt = s.fmt || function (v) { return n1(v); }; });
      ChartLib.line($('#ch-trend'), {
        height: 236, labels: labels, series: series, axisRight: S.trend.fat, rightUnit: '%',
        empty: '还没有晨起空腹的体成分记录'
      });
    }
    if ($('#ch-balance')) {
      keys = M.range(S.range);
      labels = keys.map(function (k) { return k.slice(5).replace('-', '/'); });
      ChartLib.bars($('#ch-balance'), {
        height: 212, labels: labels,
        series: [
          { name: '摄入', color: K.intake, values: M.seriesIntake(keys) },
          { name: '消耗', color: K.burn, values: M.seriesBurnReal(keys).map(function (v) { return v == null ? null : -v; }) }
        ],
        yFormat: function (v) { return Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'k' : v; },
        empty: '记录饮食与手环数据后显示收支'
      });
    }
    if ($('#ch-heat')) {
      var days = [];
      for (var i = 111; i >= 0; i--) { var k = ymd(addDays(new Date(), -i)); days.push({ date: k, value: M.workoutKcalOn(k) }); }
      ChartLib.heatmap($('#ch-heat'), { days: days, weeks: 16, color: K.burn, maxCell: 26 });
    }
    if ($('#ch-heat2')) {
      var days2 = [];
      for (var j = 363; j >= 0; j--) { var k2 = ymd(addDays(new Date(), -j)); days2.push({ date: k2, value: M.workoutKcalOn(k2) }); }
      ChartLib.heatmap($('#ch-heat2'), { days: days2, weeks: 52, color: K.burn, maxCell: 15 });
    }
    if ($('#ch-intake')) {
      keys = M.range(7);
      labels = keys.map(function (k) { return k.slice(5).replace('-', '/'); });
      var tgt = M.targets().kcal;
      ChartLib.bars($('#ch-intake'), {
        height: 200, labels: labels,
        series: [{ name: '热量', color: K.intake, values: M.seriesIntake(keys) }],
        yFormat: function (v) { return v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v; }
      });
    }
    if ($('#ch-body-trend')) {
      keys = M.range(S.range);
      labels = keys.map(function (k) { return k.slice(5).replace('-', '/'); });
      var fld = S.bodyField || 'weight';
      var map = { weight: ['weightKg', '体重', 'kg', K.weight], bodyFatPct: ['bodyFatPct', '体脂率', '%', K.fat], muscleKg: ['muscleKg', '肌肉量', 'kg', K.muscle], waterPct: ['waterPct', '体水分', '%', K.water], visceralFat: ['visceralFat', '内脏脂肪', '级', K.visceral] };
      var f = map[fld];
      ChartLib.line($('#ch-body-trend'), {
        height: 260, labels: labels,
        series: [{ name: f[1], color: f[3], values: M.series(keys, f[0]), area: true, fmt: function (v) { return n1(v) + f[2]; } }],
        yFormat: function (v) { return v.toFixed(1); },
        empty: '所选周期内无数据，可切换到 30 / 90 天'
      });
    }
  }

  /* ================= 渲染 ================= */
  var TITLES = {
    overview: ['总览', '今天的身体状态与能量账户'],
    body: ['身体成分', '体脂秤数据与身体构成变化'],
    nutrition: ['饮食摄入', '热量与三大营养素的每日账本'],
    training: ['运动训练', '训练量、消耗与习惯追踪'],
    supplements: ['补剂', '摄入明细与依从性'],
    sources: ['数据源', '设备记录、导入与备份']
  };

  function render() {
    if (!S.data) return;
    var t = TITLES[S.view] || TITLES.overview;
    $('#page-title').textContent = t[0];
    $('#page-crumb').textContent = t[1];
    $$('.nav-item').forEach(function (b) { b.classList.toggle('active', b.dataset.view === S.view); });
    $('#range-seg').style.display = (S.view === 'overview' || S.view === 'body') ? '' : 'none';

    var html = '';
    if (S.view === 'overview') html = viewOverview();
    else if (S.view === 'body') html = viewBody();
    else if (S.view === 'nutrition') html = viewNutrition();
    else if (S.view === 'training') html = viewTraining();
    else if (S.view === 'supplements') html = viewSupplements();
    else html = viewSources();

    $('#view-root').innerHTML = html;
    drawCharts();
    bindForms();
  }

  /* ================= 数据持久化 ================= */
  var saveTimer = null, saving = false, editVersion = 0;
  function canEdit() {
    if (S.mode === 'ro' && !S.demo) { toast('只读模式，请启动本地服务后记录', true); return false; }
    if (S.saveBlocked) { toast('记录有冲突。请先导出未保存内容，再刷新核对', true); return false; }
    return true;
  }
  function save(silent) {
    if (S.demo) { toast('演示模式 · 改动未保存'); return; }
    if (!canEdit()) return;
    S.dirty = true; S.saveError = false; editVersion++;
    updateStatus();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { flushSave(silent); }, 260);
  }
  function flushSave(silent) {
    if (saving || !S.dirty || S.saveBlocked) return;
    saving = true;
    var version = editVersion;
    var snapshot = JSON.stringify(S.data);
    fetch('/api/data', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Vitals-Token': S.csrfToken }, body: snapshot
    }).then(function (r) {
      if (r.status === 409) S.saveBlocked = true;
      return r.json();
    }).then(function (j) {
      if (!j.ok) throw new Error(j.error || '保存失败');
      S.data.meta.revision = j.revision;
      S.data.meta.updatedAt = j.savedAt;
      if (version === editVersion) S.dirty = false;
      saving = false;
      updateStatus();
      if (!S.dirty && !silent) toast('已保存');
      if (S.dirty) flushSave(silent);
    }).catch(function (e) {
      saving = false; S.saveError = true;
      toast('尚未保存：' + e.message, true); updateStatus();
    });
  }
  window.addEventListener('beforeunload', function (e) {
    if (S.dirty) { e.preventDefault(); e.returnValue = ''; }
  });
  document.addEventListener('submit', function (e) {
    if (!canEdit()) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  function toast(msg, isErr) {
    var w = $('#toast-wrap');
    var d = document.createElement('div');
    d.className = 'toast' + (isErr ? ' err' : '');
    d.innerHTML = '<span class="k"></span><span>' + esc(msg) + '</span>';
    w.appendChild(d);
    setTimeout(function () { d.style.opacity = '0'; d.style.transform = 'translateY(6px)'; }, 2200);
    setTimeout(function () { d.remove(); }, 2500);
  }

  function updateStatus() {
    var dot = $('#status-dot'), txt = $('#status-text'), file = $('#status-file');
    if (S.demo) { dot.className = 'sync-dot'; dot.style.background = 'var(--amber)'; txt.textContent = '演示数据'; file.textContent = '未写入磁盘'; return; }
    if (S.mode === 'rw') {
      dot.className = 'sync-dot';
      var u = S.data.meta.updatedAt;
      txt.textContent = S.saveBlocked ? '保存冲突 · 请先导出再刷新' : (S.saveError ? '保存失败 · 点击重试' : (S.dirty ? '正在保存…' : '已连接 · 已保存'));
      txt.onclick = function () { if (S.saveError && !S.saveBlocked) { S.saveError = false; flushSave(); } };
      txt.style.cursor = S.saveError && !S.saveBlocked ? 'pointer' : '';
      file.textContent = u ? '更新于 ' + u.replace('T', ' ').slice(5, 16) : '';
    } else {
      dot.className = 'sync-dot off';
      txt.textContent = '只读模式';
      file.textContent = '运行 server.py 以启用写入';
    }
  }

  /* ================= 弹窗 ================= */
  function openModal(title, bodyHTML, footHTML, wide) {
    $('#modal-root').innerHTML = '<div class="overlay" id="overlay"><div class="modal' + (wide ? ' wide' : '') + '">' +
      '<div class="modal-head"><h3>' + title + '</h3><div style="flex:1"></div>' +
      '<button class="icon-btn" data-close="1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="modal-body">' + bodyHTML + '</div>' +
      (footHTML ? '<div class="modal-foot">' + footHTML + '</div>' : '') + '</div></div>';
    var ov = $('#overlay');
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) closeModal(); });
    return ov;
  }
  function closeModal() { $('#modal-root').innerHTML = ''; }

  function val(id) { var e = $('#' + id); return e ? e.value.trim() : ''; }
  function num(id) { var v = parseFloat(val(id)); return isFinite(v) ? v : null; }

  /* ---------- 快速记录 ---------- */
  function quickMenu() {
    var items = [
      ['add-meal', '饮食', '一餐 / 单份食物', '食'],
      ['add-workout', '运动', '俯卧撑 / 深蹲 / 球类 / 游泳', '练'],
      ['add-supp', '补剂', '蛋白粉 / 肌酸 / 维生素', '补'],
      ['add-body', '身体数据', '体重 / 体脂 / 体成分', '秤'],
      ['add-activity', '手环数据', '步数 / 睡眠 / 心率', '环']
    ];
    var body = '<div class="grid g2" style="gap:10px">' + items.map(function (i, idx) {
      return '<button class="card" style="text-align:left;padding:14px;cursor:pointer' + (idx === items.length - 1 && items.length % 2 ? ';grid-column:1/-1' : '') + '" data-act="' + i[0] + '">' +
        '<div class="row" style="gap:9px;align-items:center"><span class="tl-icon" style="color:var(--accent);background:var(--accent-soft);border-color:transparent">' + i[3] + '</span>' +
        '<div><div style="font-size:13px;font-weight:600">' + i[1] + '</div><div class="tiny muted">' + i[2] + '</div></div></div></button>';
    }).join('') + '</div>' +
      '<div class="hr"></div><div class="tiny muted" style="line-height:1.7">也可以直接在对话里说：「午饭一碗米饭 200g 鸡胸 一份西兰花」「做了 5 组×20 俯卧撑、平板支撑 3 分钟」「游泳 40 分钟 1000 米」。我会按同一套口径写进数据文件。</div>';
    openModal('快速记录', body, '<button class="btn" data-close="1">关闭</button>');
  }

  /* ---------- 表单：体成分 ---------- */
  function formBody() {
    var p = M.p();
    var now = new Date();
    var nowTime = pad(now.getHours()) + ':' + pad(now.getMinutes());
    var todayHasFasting = M.fastingBodies().some(function (b) { return b.date === todayKey(); });
    var defMode = (todayHasFasting && now.getHours() >= 12) ? 'bedtime' : 'fasting';
    var body = '<form id="f-body">' +
      '<div class="form-grid">' +
      '<div class="field"><label>日期</label><input type="date" id="b-date" value="' + todayKey() + '"></div>' +
      '<div class="field"><label>时间</label><input type="time" id="b-time" value="' + nowTime + '"></div>' +
      '<div class="field"><label>测量时段</label><select id="b-mode">' +
      '<option value="fasting"' + (defMode === 'fasting' ? ' selected' : '') + '>晨起空腹（趋势口径）</option>' +
      '<option value="bedtime"' + (defMode === 'bedtime' ? ' selected' : '') + '>睡前</option></select>' +
      '<div class="hint">两种时段含水量不同，不可互相比较；趋势只取晨起空腹。</div></div>' +
      '<div class="field"><label>体重（kg）</label><input type="number" step="0.1" id="b-weight" value="' + (M.weight() || '') + '" required></div>' +
      '<div class="field"><label>体脂率（%）</label><input type="number" step="0.1" id="b-fat" placeholder="21.4"></div>' +
      '<div class="field"><label>肌肉量（kg）</label><input type="number" step="0.1" id="b-muscle"></div>' +
      '<div class="field"><label>体水分（%）</label><input type="number" step="0.1" id="b-water"></div>' +
      '<div class="field"><label>内脏脂肪（级）</label><input type="number" step="1" id="b-visceral"></div>' +
      '<div class="field"><label>基础代谢（kcal）</label><input type="number" step="1" id="b-bmr" placeholder="秤上读数，可留空"></div>' +
      '<div class="field"><label>骨量（kg）</label><input type="number" step="0.1" id="b-bone"></div>' +
      '<div class="field"><label>身体年龄</label><input type="number" step="1" id="b-age"></div>' +
      '<div class="field span2"><label>备注</label><input type="text" id="b-note" placeholder="如：晨起空腹、训练前"></div>' +
      '</div></form>';
    openModal('录入身体数据', body, '<button class="btn" data-close="1">取消</button><button class="btn primary" data-submit="f-body">保存</button>');
    $('#f-body').addEventListener('submit', function (e) { e.preventDefault(); submitBody(); });
  }
  function submitBody() {
    var w = num('b-weight');
    if (!w) { toast('请填写体重', true); return; }
    var h = M.height();
    var d = val('b-date') || todayKey();
    var mode = val('b-mode') || 'fasting';
    var previous = (S.data.bodyMetrics || []).filter(function (b) { return b.date === d && b.source === 'manual' && M.modeOf(b) === mode; })[0] || {};
    var entry = {
      id: previous.id || uid('bm'), ts: d + 'T' + (val('b-time') || '07:30') + ':00+08:00', date: d,
      measureMode: mode,
      weightKg: w, bmi: h ? Math.round(w / Math.pow(h / 100, 2) * 10) / 10 : null,
      bodyFatPct: num('b-fat'), muscleKg: num('b-muscle'), waterPct: num('b-water'),
      visceralFat: num('b-visceral'), bmrKcal: num('b-bmr'), boneKg: num('b-bone'), bodyAge: num('b-age'),
      source: 'manual', note: val('b-note') || ''
    };
    ['photo', 'sourceKey', 'createdAt'].forEach(function (key) { if (previous[key] !== undefined) entry[key] = previous[key]; });
    entry.updatedAt = isoNow();
    S.data.bodyMetrics = (S.data.bodyMetrics || []).filter(function (b) {
      return !(b.date === d && b.source === 'manual' && M.modeOf(b) === mode);
    });
    S.data.bodyMetrics.push(entry);
    S.data.bodyMetrics.sort(function (a, b) { return (a.date + (a.ts || '')).localeCompare(b.date + (b.ts || '')); });
    if (mode === 'fasting' || !S.data.profile.weightKg) S.data.profile.weightKg = w;
    closeModal(); save(); render();
  }

  /* ---------- 表单：饮食 ---------- */
  var draftItems = [];
  function formMeal(slot, presetDate) {
    draftItems = [{ name: '', amount: '', kcal: '', proteinG: '', fatG: '', carbG: '', fiberG: '' }];
    var d = presetDate || S.day || todayKey();
    var now = new Date();
    var time = pad(now.getHours()) + ':' + pad(now.getMinutes());
    var body = '<form id="f-meal">' +
      '<div class="form-grid">' +
      '<div class="field"><label>日期</label><input type="date" id="m-date" value="' + d + '"></div>' +
      '<div class="field"><label>时间</label><input type="time" id="m-time" value="' + time + '"></div>' +
      '<div class="field span2"><label>餐次</label><div class="chips" id="m-slot">' +
      Object.keys(SLOTS).map(function (k) {
        return '<button type="button" class="chip' + (k === slot ? ' on' : '') + '" data-slot="' + k + '">' + SLOTS[k] + '</button>';
      }).join('') + '</div></div>' +
      '<div class="field span2"><label>标题</label><input type="text" id="m-title" placeholder="如：鸡胸肉饭 + 沙拉"></div>' +
      '</div>' +
      '<div class="form-sec">食物明细</div>' +
      '<div class="item-head item-row"><span>食物</span><span>份量（g）</span><span>热量</span><span>蛋白</span><span>脂肪</span><span>碳水</span><span></span></div>' +
      '<div class="item-rows" id="m-items"></div>' +
      '<div class="row wrap" style="gap:8px;margin-top:10px">' +
      '<select id="m-food" style="max-width:230px"><option value="">从食物库快速添加…</option>' +
      FOODS.map(function (f, i) { return '<option value="' + i + '">' + f[0] + ' · ' + f[7] + '</option>'; }).join('') +
      '</select>' +
      '<button type="button" class="btn sm" data-act="add-item">+ 空白行</button>' +
      '<div style="flex:1"></div>' +
      '<span class="tiny muted">合计</span><b class="tiny num" id="m-total" style="font-size:13px">0 kcal</b></div>' +
      '<div class="form-grid" style="margin-top:12px">' +
      '<div class="field"><label>记录方式</label><select id="m-conf"><option value="estimated">估算（照片 / 目测）</option><option value="measured">精确（称重 / 包装）</option></select></div>' +
      '<div class="field"><label>备注</label><input type="text" id="m-note" placeholder="如：外食，油较多"></div>' +
      '</div></form>';
    openModal('记录饮食', body, '<button class="btn" data-close="1">取消</button><button class="btn primary" data-submit="f-meal">保存</button>');
    renderItems();
    $('#f-meal').addEventListener('submit', function (e) { e.preventDefault(); submitMeal(); });
    $('#m-food').addEventListener('change', function () {
      var i = this.value; if (i === '') return;
      var f = FOODS[+i];
      addDraft({ name: f[0], amount: f[6], kcal: Math.round(f[1] * f[6] / 100), proteinG: +(f[2] * f[6] / 100).toFixed(1), fatG: +(f[3] * f[6] / 100).toFixed(1), carbG: +(f[4] * f[6] / 100).toFixed(1), fiberG: +(f[5] * f[6] / 100).toFixed(1), ref: f });
      this.value = '';
    });
  }
  function addDraft(item) {
    if (draftItems.length === 1 && !draftItems[0].name && !draftItems[0].kcal) draftItems = [];
    draftItems.push(item);
    renderItems();
  }
  function renderItems() {
    var host = $('#m-items'); if (!host) return;
    host.innerHTML = draftItems.map(function (it, i) {
      return '<div class="item-row" data-i="' + i + '">' +
        '<input type="text" value="' + esc(it.name) + '" placeholder="食物名称" data-f="name">' +
        '<input type="number" value="' + (it.amount || '') + '" placeholder="g" data-f="amount">' +
        '<input type="number" value="' + (it.kcal || '') + '" placeholder="kcal" data-f="kcal">' +
        '<input type="number" value="' + (it.proteinG || '') + '" placeholder="P" data-f="proteinG">' +
        '<input type="number" value="' + (it.fatG || '') + '" placeholder="F" data-f="fatG">' +
        '<input type="number" value="' + (it.carbG || '') + '" placeholder="C" data-f="carbG">' +
        '<button type="button" class="del" data-del="' + i + '">✕</button></div>';
    }).join('');
    updateMealTotal();
  }
  function readItems() {
    var out = [];
    $$('#m-items .item-row').forEach(function (row) {
      var o = { name: '', amount: '', kcal: 0, proteinG: 0, fatG: 0, carbG: 0, fiberG: 0 };
      $$('input', row).forEach(function (inp) {
        var f = inp.dataset.f;
        if (f === 'name' || f === 'amount') o[f] = inp.value.trim();
        else o[f] = parseFloat(inp.value) || 0;
      });
      if (o.name || o.kcal) out.push(o);
    });
    return out;
  }
  function updateMealTotal() {
    var items = readItems();
    var tot = items.reduce(function (a, i) {
      return { kcal: a.kcal + i.kcal, p: a.p + i.proteinG, f: a.f + i.fatG, c: a.c + i.carbG };
    }, { kcal: 0, p: 0, f: 0, c: 0 });
    var el = $('#m-total');
    if (el) el.textContent = Math.round(tot.kcal) + ' kcal · P' + Math.round(tot.p) + ' F' + Math.round(tot.f) + ' C' + Math.round(tot.c);
  }
  function submitMeal() {
    var items = readItems();
    if (!items.length) { toast('至少添加一种食物', true); return; }
    var tot = items.reduce(function (a, i) {
      return { kcal: a.kcal + i.kcal, proteinG: a.proteinG + i.proteinG, fatG: a.fatG + i.fatG, carbG: a.carbG + i.carbG, fiberG: a.fiberG + i.fiberG };
    }, { kcal: 0, proteinG: 0, fatG: 0, carbG: 0, fiberG: 0 });
    Object.keys(tot).forEach(function (k) { tot[k] = Math.round(tot[k] * 10) / 10; });
    var d = val('m-date') || todayKey();
    var slotEl = $('#m-slot .chip.on');
    S.data.meals = S.data.meals || [];
    S.data.meals.push({
      id: uid('ml'), ts: d + 'T' + (val('m-time') || '12:00') + ':00+08:00', date: d,
      slot: slotEl ? slotEl.dataset.slot : 'lunch',
      title: val('m-title') || items.map(function (i) { return i.name; }).join(' + '),
      items: items.map(function (i) { return { name: i.name, amount: i.amount ? i.amount + ' g' : '', kcal: Math.round(i.kcal), proteinG: i.proteinG, fatG: i.fatG, carbG: i.carbG, fiberG: i.fiberG }; }),
      totals: tot, confidence: val('m-conf') || 'estimated', source: 'conversation', note: val('m-note') || ''
    });
    S.day = d;
    closeModal(); save(); render();
  }

  /* ---------- 表单：运动 ---------- */
  function formWorkout() {
    var opts = Object.keys(WORKOUTS).map(function (k) {
      return '<option value="' + k + '">' + WORKOUTS[k].label + '</option>';
    }).join('');
    var now = new Date();
    var body = '<form id="f-work">' +
      '<div class="form-grid">' +
      '<div class="field"><label>项目</label><select id="w-type">' + opts + '</select></div>' +
      '<div class="field"><label>强度</label><select id="w-int"><option value="low">低</option><option value="moderate" selected>中</option><option value="high">高</option></select></div>' +
      '<div class="field"><label>日期</label><input type="date" id="w-date" value="' + todayKey() + '"></div>' +
      '<div class="field"><label>时间</label><input type="time" id="w-time" value="' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + '"></div>' +
      '<div class="field" id="w-sets-wrap"><label>组数</label><input type="number" id="w-sets" value="5"></div>' +
      '<div class="field" id="w-reps-wrap"><label>每组次数</label><input type="number" id="w-reps" value="20"></div>' +
      '<div class="field"><label>时长（分钟）</label><input type="number" id="w-dur" value="10"></div>' +
      '<div class="field"><label>距离（km，可选）</label><input type="number" step="0.1" id="w-dist" placeholder="游泳 / 跑步"></div>' +
      '<div class="field"><label>消耗（kcal）</label><input type="number" id="w-kcal" value=""><div class="hint" id="w-kcal-hint">按 MET × 体重 × 时长自动估算</div></div>' +
      '<div class="field"><label>心率（可选）</label><input type="number" id="w-hr" placeholder="平均 bpm"></div>' +
      '<div class="field span2"><label>备注</label><input type="text" id="w-note" placeholder="如：最后一组力竭 / 自由泳 1000m"></div>' +
      '</div></form>';
    openModal('记录训练', body, '<button class="btn" data-close="1">取消</button><button class="btn primary" data-submit="f-work">保存</button>');
    function refresh() {
      var t = WORKOUTS[val('w-type')] || WORKOUTS.other;
      var isReps = t.unit === 'reps';
      $('#w-sets-wrap').style.display = isReps ? '' : 'none';
      $('#w-reps-wrap').style.display = isReps ? '' : 'none';
      if (isReps && (!val('w-sets') || +val('w-sets') === 5)) $('#w-sets').value = t.defSets || 5;
      if (isReps && (!val('w-reps') || +val('w-reps') === 20)) $('#w-reps').value = t.defReps || 20;
      var est = estimateKcal();
      $('#w-kcal').value = est;
    }
    function estimateKcal() {
      var t = WORKOUTS[val('w-type')] || WORKOUTS.other;
      var w = M.weight() || 70;
      var intMul = { low: 0.8, moderate: 1, high: 1.2 }[val('w-int') || 'moderate'];
      var dur = parseFloat(val('w-dur')) || 0;
      if (t.unit === 'reps') {
        var reps = (parseFloat(val('w-sets')) || 0) * (parseFloat(val('w-reps')) || 0);
        dur = dur || Math.max(1, reps * 2.2 / 60);
      }
      return Math.round(t.met * w * (dur / 60) * intMul);
    }
    $('#w-type').addEventListener('change', refresh);
    $('#w-int').addEventListener('change', function () { $('#w-kcal').value = estimateKcal(); });
    ['w-dur', 'w-sets', 'w-reps'].forEach(function (id) {
      var e = $('#' + id); if (e) e.addEventListener('input', function () { $('#w-kcal').value = estimateKcal(); });
    });
    refresh();
    $('#f-work').addEventListener('submit', function (e) { e.preventDefault(); submitWorkout(); });
  }
  function submitWorkout() {
    var type = val('w-type'), t = WORKOUTS[type] || WORKOUTS.other;
    var d = val('w-date') || todayKey();
    var sets = t.unit === 'reps' ? (parseInt(val('w-sets'), 10) || 0) : 0;
    var reps = t.unit === 'reps' ? (parseInt(val('w-reps'), 10) || 0) : 0;
    var volume = sets && reps ? { sets: new Array(sets).fill(reps), totalReps: sets * reps } : null;
    var dur = num('w-dur') || (volume ? Math.max(1, Math.round(volume.totalReps * 2.2 / 60)) : 0);
    S.data.workouts = S.data.workouts || [];
    S.data.workouts.push({
      id: uid('wk'), ts: d + 'T' + (val('w-time') || '18:00') + ':00+08:00', date: d,
      type: type, typeLabel: t.label, durationMin: dur,
      kcal: num('w-kcal') || 0, intensity: val('w-int') || 'moderate',
      volume: volume, distanceKm: num('w-dist'), avgHr: num('w-hr') || null,
      source: 'conversation', note: val('w-note') || ''
    });
    closeModal(); save(); render();
  }

  /* ---------- 表单：补剂 ---------- */
  function formSupp(name, dose) {
    var body = '<form id="f-supp"><div class="form-grid">' +
      '<div class="field span2"><label>补剂名称</label><input type="text" id="s-name" list="supp-list" value="' + esc(name || '') + '" placeholder="乳清蛋白" required>' +
      '<datalist id="supp-list">' + SUPPS.map(function (s) { return '<option value="' + s[0] + '">'; }).join('') + '</datalist></div>' +
      '<div class="field"><label>剂量</label><input type="text" id="s-dose" value="' + esc(dose || '') + '" placeholder="30 g / 1 粒"></div>' +
      '<div class="field"><label>服用时机</label><input type="text" id="s-timing" placeholder="训练后 / 睡前"></div>' +
      '<div class="field"><label>日期</label><input type="date" id="s-date" value="' + todayKey() + '"></div>' +
      '<div class="field"><label>时间</label><input type="time" id="s-time" value="' + pad(new Date().getHours()) + ':' + pad(new Date().getMinutes()) + '"></div>' +
      '<div class="field"><label>热量（kcal）</label><input type="number" id="s-kcal" placeholder="0"></div>' +
      '<div class="field"><label>蛋白质（g）</label><input type="number" step="0.1" id="s-p" placeholder="0"></div>' +
      '<div class="field"><label>脂肪（g）</label><input type="number" step="0.1" id="s-f" placeholder="0"></div>' +
      '<div class="field"><label>碳水（g）</label><input type="number" step="0.1" id="s-c" placeholder="0"></div>' +
      '</div></form>';
    openModal('记录补剂', body, '<button class="btn" data-close="1">取消</button><button class="btn primary" data-submit="f-supp">保存</button>');
    $('#f-supp').addEventListener('submit', function (e) { e.preventDefault(); submitSupp(); });
  }
  function submitSupp() {
    var name = val('s-name'); if (!name) { toast('请填写名称', true); return; }
    var d = val('s-date') || todayKey();
    S.data.supplements = S.data.supplements || [];
    S.data.supplements.push({
      id: uid('sp'), ts: d + 'T' + (val('s-time') || '12:00') + ':00+08:00', date: d,
      name: name, dose: val('s-dose') || '', timing: val('s-timing') || '',
      nutrients: { kcal: num('s-kcal') || 0, proteinG: num('s-p') || 0, fatG: num('s-f') || 0, carbG: num('s-c') || 0 },
      source: 'conversation', note: ''
    });
    closeModal(); save(); render();
  }

  /* ---------- 表单：手环数据 ---------- */
  function formActivity() {
    var body = '<form id="f-act"><div class="form-grid">' +
      '<div class="field span2"><label>日期</label><input type="date" id="a-date" value="' + todayKey() + '"></div>' +
      '<div class="field"><label>步数</label><input type="number" id="a-steps" placeholder="8000"></div>' +
      '<div class="field"><label>距离（km）</label><input type="number" step="0.1" id="a-dist" placeholder="6.0"></div>' +
      '<div class="field"><label>活动消耗（kcal）</label><input type="number" id="a-active" placeholder="420"></div>' +
      '<div class="field"><label>总消耗（kcal）</label><input type="number" id="a-total" placeholder="2100"></div>' +
      '<div class="field"><label>睡眠（分钟）</label><input type="number" id="a-sleep" placeholder="450"></div>' +
      '<div class="field"><label>睡眠得分</label><input type="number" id="a-score" placeholder="80"></div>' +
      '<div class="field"><label>静息心率</label><input type="number" id="a-rhr" placeholder="58"></div>' +
      '<div class="field"><label>HRV（ms）</label><input type="number" id="a-hrv" placeholder="45"></div>' +
      '<div class="field"><label>平均心率</label><input type="number" id="a-hr" placeholder="72"></div>' +
      '<div class="field"><label>血氧（%）</label><input type="number" id="a-spo2" placeholder="96"></div>' +
      '</div></form>';
    openModal('录入手环数据', body, '<button class="btn" data-close="1">取消</button><button class="btn primary" data-submit="f-act">保存</button>');
    $('#f-act').addEventListener('submit', function (e) {
      e.preventDefault();
      var d = val('a-date') || todayKey();
      var prior = (S.data.dailyActivity || []).filter(function (a) { return a.date === d; })[0] || {};
      var o = {
        id: prior.id || uid('act'), date: d, steps: num('a-steps'), distanceKm: num('a-dist'), activeKcal: num('a-active'),
        totalKcal: num('a-total'), sleepMin: num('a-sleep'), sleepScore: num('a-score'),
        restingHr: num('a-rhr'), hrvMs: num('a-hrv'), hrAvg: num('a-hr'), spo2: num('a-spo2'),
        source: 'manual'
      };
      Object.keys(o).forEach(function (key) { if (o[key] != null) prior[key] = o[key]; });
      S.data.dailyActivity = (S.data.dailyActivity || []).filter(function (a) { return a.date !== d; });
      S.data.dailyActivity.push(prior);
      S.data.dailyActivity.sort(function (a, b) { return a.date.localeCompare(b.date); });
      closeModal(); save(); render();
    });
  }

  /* ---------- 表单：设置 ---------- */
  function formSettings() {
    var p = M.p(), g = p.goal || {}, t = M.targets();
    var body = '<form id="f-set">' +
      '<div class="form-sec">基础信息</div>' +
      '<div class="form-grid">' +
      '<div class="field"><label>称呼</label><input type="text" id="st-name" value="' + esc(p.name || '') + '" placeholder="可选"></div>' +
      '<div class="field"><label>性别</label><select id="st-sex"><option value="">暂不填写</option><option value="male"' + (p.sex === 'male' ? ' selected' : '') + '>男</option><option value="female"' + (p.sex === 'female' ? ' selected' : '') + '>女</option></select></div>' +
      '<div class="field"><label>出生日期</label><input type="date" id="st-birth" value="' + (p.birthDate || '') + '"></div>' +
      '<div class="field"><label>身高（cm）</label><input type="number" step="0.1" id="st-height" value="' + (p.heightCm || '') + '"></div>' +
      '<div class="field"><label>活动系数</label><select id="st-af">' +
      [['1.2', '1.2 · 久坐'], ['1.375', '1.375 · 轻度'], ['1.55', '1.55 · 中度'], ['1.725', '1.725 · 高强度'], ['1.9', '1.9 · 极高']]
        .map(function (o) { return '<option value="' + o[0] + '"' + (String(p.activityFactor) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="field"><label>BMR 计算方式</label><select id="st-bmrmode">' +
      '<option value="mifflin"' + (p.bmrMode !== 'scale' ? ' selected' : '') + '>Mifflin-St Jeor 公式</option>' +
      '<option value="scale"' + (p.bmrMode === 'scale' ? ' selected' : '') + '>采用体脂秤读数</option></select></div>' +
      '</div>' +
      '<div class="form-sec">目标</div>' +
      '<div class="form-grid">' +
      '<div class="field"><label>目标类型</label><select id="st-gtype">' +
      [['record_only', '仅记录（不自动设置饮食目标）'], ['fat_loss', '减脂'], ['maintain', '维持'], ['muscle_gain', '增肌']].map(function (o) {
        return '<option value="' + o[0] + '"' + (g.type === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select></div>' +
      '<div class="field"><label>目标体重（kg）</label><input type="number" step="0.1" id="st-tweight" value="' + (g.targetWeightKg || '') + '"></div>' +
      '<div class="field"><label>目标体脂（%）</label><input type="number" step="0.1" id="st-tfat" value="' + (g.targetBodyFatPct || '') + '"></div>' +
      '<div class="field"><label>每周变化（kg）</label><input type="number" step="0.05" id="st-rate" value="' + (g.weeklyRateKg == null ? 0.5 : g.weeklyRateKg) + '"></div>' +
      '<div class="field"><label>蛋白摄入（g/kg）</label><input type="number" step="0.1" id="st-prokg" value="' + (g.proteinPerKg || 1.6) + '"></div>' +
      '<div class="field"><label>每日热量目标（kcal）</label><input type="number" id="st-kcal" value="' + (p.targets && p.targets.kcal ? p.targets.kcal : '') + '" placeholder="留空自动计算"></div>' +
      '</div>' +
      '<div class="form-sec">当前推算</div>' +
      '<div class="grid g3" style="gap:10px">' +
      [['BMR', n0(M.bmr()) + ' kcal'], ['TDEE', n0(M.tdee()) + ' kcal'], ['蛋白目标', n0(t.protein) + ' g']].map(function (x) {
        return '<div class="card" style="padding:12px 14px"><div class="tiny muted">' + x[0] + '</div><div style="font-size:16px;font-weight:640;margin-top:2px">' + x[1] + '</div></div>';
      }).join('') + '</div>' +
      '</form>';
    openModal('设置', body, '<button class="btn" data-close="1">取消</button><button class="btn primary" data-submit="f-set">保存</button>', true);
    $('#f-set').addEventListener('submit', function (e) {
      e.preventDefault();
      var p2 = S.data.profile;
      p2.name = val('st-name'); p2.sex = val('st-sex'); p2.birthDate = val('st-birth') || null;
      p2.heightCm = num('st-height'); p2.activityFactor = parseFloat(val('st-af')) || 1.375;
      p2.bmrMode = val('st-bmrmode');
      p2.goal = p2.goal || {};
      p2.goal.type = val('st-gtype');
      p2.goal.targetWeightKg = num('st-tweight');
      p2.goal.targetBodyFatPct = num('st-tfat');
      p2.goal.weeklyRateKg = num('st-rate');
      p2.goal.proteinPerKg = num('st-prokg') || 1.6;
      p2.targets = p2.targets || {};
      p2.targets.kcal = num('st-kcal');
      closeModal(); save(); render();
    });
  }

  /* ---------- 导入 CSV ---------- */
  var importState = { kind: 'scale', rows: [] };
  function formImport(kind) {
    importState = { kind: kind || 'scale', rows: [], measureMode: '' };
    var body = '<form id="f-imp">' +
      '<div class="field"><label>数据类型</label><div class="chips" id="i-kind">' +
      '<button type="button" class="chip' + (kind !== 'band' ? ' on' : '') + '" data-kind="scale">体成分（体脂秤）</button>' +
      '<button type="button" class="chip' + (kind === 'band' ? ' on' : '') + '" data-kind="band">日常活动（手环）</button>' +
      '</div></div>' +
      '<div class="field"><label>体成分测量时段（导入体重时必选）</label><select id="i-mode"><option value="">请选择</option><option value="fasting">晨起空腹</option><option value="bedtime">睡前</option></select><div class="hint">一批仅导入同一时段；睡眠列须为分钟数，体重为 kg。</div></div>' +
      '<div class="field" style="margin-top:12px"><label>CSV 内容</label>' +
      '<textarea id="i-text" rows="8" placeholder="日期,体重,体脂率,肌肉量,水分&#10;2026-10-01,73.2,21.4,55.1,58.2&#10;2026-10-02,73.0,21.2,55.3,58.4"></textarea>' +
      '<div class="hint">支持逗号 / 制表符分隔，首行为表头。也可直接把导出文件拖到下方。</div></div>' +
      '<div id="i-preview" class="mt14"></div>' +
      '</form>';
    openModal('导入数据', body, '<button class="btn" data-close="1">取消</button><button class="btn" data-act="parse-csv">解析预览</button><button class="btn primary" data-act="commit-csv" disabled id="i-commit">确认导入</button>', true);
    $$('#i-kind .chip').forEach(function (c) {
      c.addEventListener('click', function () {
        $$('#i-kind .chip').forEach(function (x) { x.classList.remove('on'); });
        c.classList.add('on'); importState.kind = c.dataset.kind;
        if (importState.rows.length) parseCSV();
      });
    });
    $('#i-mode').addEventListener('change', function () { importState.measureMode = this.value; });
    var ta = $('#i-text');
    ta.addEventListener('dragover', function (e) { e.preventDefault(); });
    ta.addEventListener('drop', function (e) {
      e.preventDefault();
      var f = e.dataTransfer.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () { ta.value = r.result; parseCSV(); };
      r.readAsText(f, 'utf-8');
    });
  }

  var COLMAP = {
    date: ['日期', 'date', 'day', '时间', 'time', '记录时间'],
    weightKg: ['体重', 'weight', '体重(kg)', 'weightkg', '体重（kg）'],
    bodyFatPct: ['体脂', '体脂率', 'bodyfat', 'body fat', '脂肪率', '体脂百分比'],
    muscleKg: ['肌肉', '肌肉量', 'muscle', '肌肉(kg)'],
    waterPct: ['水分', '体水分', 'water', '水分率'],
    visceralFat: ['内脏', '内脏脂肪', 'visceral'],
    bmrKcal: ['基础代谢', 'bmr', 'basal'],
    boneKg: ['骨量', 'bone'],
    steps: ['步数', 'steps', 'step'],
    activeKcal: ['活动消耗', 'activecalorie', '活动热量', '运动消耗'],
    totalKcal: ['总消耗', 'totalcalorie', '消耗', 'calorie', '热量'],
    sleepMin: ['睡眠', 'sleep', 'sleepmin', '睡眠分钟', '睡眠时长分钟'],
    restingHr: ['静息心率', 'restinghr', 'resting heart'],
    hrvMs: ['hrv'],
    spo2: ['血氧', 'spo2'],
    distanceKm: ['距离', 'distance', '公里']
  };
  function normHeader(h) {
    return String(h).toLowerCase().replace(/[\s_"'()（）:：%％]/g, '').replace(/kg$/, '').replace(/kcal$/, '');
  }
  var FIELD_LABEL = {
    weightKg: '体重', bodyFatPct: '体脂率', muscleKg: '肌肉量', waterPct: '体水分',
    visceralFat: '内脏脂肪', bmrKcal: '基础代谢', boneKg: '骨量', steps: '步数',
    activeKcal: '活动消耗', totalKcal: '总消耗', sleepMin: '睡眠', restingHr: '静息心率',
    hrvMs: 'HRV', spo2: '血氧', distanceKm: '距离'
  };
  function splitCSV(text) {
    var delim = text.indexOf('\t') > -1 ? '\t' : ',';
    var lines = text.replace(/\r/g, '').split('\n').filter(function (l) { return l.trim(); });
    return lines.map(function (line) {
      var out = [], cur = '', q = false;
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
        else if (ch === delim && !q) { out.push(cur); cur = ''; }
        else cur += ch;
      }
      out.push(cur);
      return out.map(function (s) { return s.trim(); });
    });
  }
  function parseCSV() {
    var text = $('#i-text').value;
    if (!text.trim()) { toast('请粘贴 CSV 内容', true); return; }
    var table = splitCSV(text);
    if (table.length < 2) { toast('至少需要表头 + 1 行数据', true); return; }
    var header = table[0];
    var mapping = {};
    header.forEach(function (h, i) {
      var n = normHeader(h);
      Object.keys(COLMAP).forEach(function (f) {
        if (mapping[f] != null) return;
        if (n === normHeader(f) || COLMAP[f].some(function (alias) { return n === normHeader(alias); })) mapping[f] = i;
      });
    });
    var mapped = Object.keys(mapping).filter(function (k) { return k !== 'date'; });
    var rows = table.slice(1).map(function (cells) {
      var o = { date: null };
      if (mapping.date != null) {
        var raw = cells[mapping.date] || '';
        var m = raw.match(/(\d{4})[-/年.]?(\d{1,2})[-/月.]?(\d{1,2})/);
        o.date = m ? (m[1] + '-' + pad(+m[2]) + '-' + pad(+m[3])) : null;
      }
      Object.keys(mapping).forEach(function (f) {
        if (f === 'date') return;
        var v = cells[mapping[f]];
        if (v == null || v === '') return;
        if (f === 'sleepMin' && !/^\d+(\.\d+)?$/.test(String(v).trim())) return;
        var x = parseFloat(String(v).replace(/[^\d.\-]/g, ''));
        if (isFinite(x)) o[f] = x;
      });
      return o;
    }).filter(function (o) {
      if (!o.date || !mapped.length) return false;
      var date = new Date(o.date + 'T00:00:00Z');
      if (isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== o.date) return false;
      if (importState.kind === 'scale' && !(o.weightKg > 0)) return false;
      return mapped.some(function (f) { return o[f] != null && o[f] >= 0; });
    });

    importState.rows = rows;
    var preview = '<div class="row wrap" style="gap:6px;margin-bottom:8px"><span class="tiny muted">识别到列：</span>' +
      Object.keys(mapping).map(function (k) {
        return '<span class="badge ok">' + esc(header[mapping[k]] || k) + ' → ' + (FIELD_LABEL[k] || k) + '</span>';
      }).join('') + '</div>';
    if (!rows.length) {
      preview += '<div class="banner"><b>未能解析出有效行</b> · 请确认首行是表头，且日期列包含 2026-10-01 这类格式。</div>';
    } else {
      var fields = Object.keys(mapping).filter(function (k) { return k !== 'date'; });
      preview += '<div class="tiny muted" style="margin-bottom:6px">共 ' + rows.length + ' 行 · 预览前 5 行</div>' +
        '<div class="scroll-y" style="max-height:220px"><table class="tbl"><thead><tr><th>日期</th>' +
        fields.map(function (f) { return '<th class="r">' + (FIELD_LABEL[f] || f) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        rows.slice(0, 5).map(function (r) {
          return '<tr><td>' + r.date + '</td>' + fields.map(function (f) { return '<td class="r">' + (r[f] != null ? r[f] : '—') + '</td>'; }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>';
    }
    $('#i-preview').innerHTML = preview;
    var btn = $('#i-commit');
    btn.disabled = !rows.length;
    btn.style.opacity = rows.length ? 1 : .45;
    importState.mapping = mapping;
    if (mapped.length === 0) toast('没有识别到数值列，请检查表头', true);
  }
  function commitCSV() {
    if (typeof canEdit === 'function' && !canEdit()) return;
    var rows = importState.rows;
    if (!rows.length) return;
    if (importState.kind === 'band') {
      S.data.dailyActivity = S.data.dailyActivity || [];
      rows.forEach(function (r) {
        var old = S.data.dailyActivity.filter(function (a) { return a.date === r.date; })[0] || {};
        S.data.dailyActivity = S.data.dailyActivity.filter(function (a) { return a.date !== r.date; });
        var imported = {
          id: old.id || uid('act'), date: r.date, steps: r.steps, distanceKm: r.distanceKm, activeKcal: r.activeKcal,
          totalKcal: r.totalKcal, sleepMin: r.sleepMin, restingHr: r.restingHr,
          hrvMs: r.hrvMs, spo2: r.spo2, source: 'xiaomi_band'
        };
        Object.keys(imported).forEach(function (key) { if (imported[key] !== undefined) old[key] = imported[key]; });
        S.data.dailyActivity.push(old);
      });
      S.data.dailyActivity.sort(function (a, b) { return a.date.localeCompare(b.date); });
      S.data.sources.band.lastSync = isoNow();
      S.data.sources.band.status = 'active';
    } else {
      S.data.bodyMetrics = S.data.bodyMetrics || [];
      var h = M.height();
      var mode = importState.measureMode;
      if (mode !== 'fasting' && mode !== 'bedtime') { toast('请先选择本批称重的测量时段', true); return; }
      rows.forEach(function (r) {
        var prior = S.data.bodyMetrics.filter(function (b) { return b.date === r.date && b.source === 'xiaomi_scale' && (b.measureMode || 'fasting') === mode; })[0] || {};
        S.data.bodyMetrics = S.data.bodyMetrics.filter(function (b) { return !(b.date === r.date && b.source === 'xiaomi_scale' && (b.measureMode || 'fasting') === mode); });
        S.data.bodyMetrics.push({
          id: prior.id || uid('bm'), photo: prior.photo, sourceKey: prior.sourceKey, createdAt: prior.createdAt, updatedAt: isoNow(), date: r.date, measureMode: mode,
          weightKg: r.weightKg, bmi: r.weightKg && h ? Math.round(r.weightKg / Math.pow(h / 100, 2) * 10) / 10 : null,
          bodyFatPct: r.bodyFatPct, muscleKg: r.muscleKg, waterPct: r.waterPct,
          visceralFat: r.visceralFat, bmrKcal: r.bmrKcal, boneKg: r.boneKg,
          source: 'xiaomi_scale', note: ''
        });
      });
      S.data.bodyMetrics.sort(function (a, b) { return (a.date + (a.ts || '')).localeCompare(b.date + (b.ts || '')); });
      S.data.sources.scale.lastSync = isoNow();
      S.data.sources.scale.status = 'active';
    }
    S.data.imports = S.data.imports || [];
    S.data.imports.push({ at: isoNow(), kind: importState.kind, rows: rows.length });
    closeModal(); save(); render();
    toast('已导入 ' + rows.length + ' 行');
  }

  /* ---------- 导出 ---------- */
  function exportJSON() {
    var blob = new Blob([JSON.stringify(S.data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'health-data-' + todayKey() + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast('已导出');
  }

  /* ================= 事件绑定 ================= */
  function bindForms() {
    var sf = $('#setup-form');
    if (sf) {
      var setupSex = S.data.profile.sex || '';
      $$('#setup-sex .chip').forEach(function (c) {
        c.addEventListener('click', function () {
          $$('#setup-sex .chip').forEach(function (x) { x.classList.remove('on'); });
          c.classList.add('on'); setupSex = c.dataset.sex;
        });
      });
      sf.addEventListener('submit', function (e) {
        e.preventDefault();
        var h = num('setup-height'), w = num('setup-weight'), fat = num('setup-fat');
        var mode = val('setup-mode');
        if (w && !mode) { toast('请选择本次称重时段', true); return; }
        if (h != null && h <= 0 || w != null && w <= 0) { toast('身高和体重必须大于零', true); return; }
        S.data.profile.sex = setupSex;
        S.data.profile.birthDate = val('setup-birth') || null;
        S.data.profile.heightCm = h;
        S.data.profile.weightKg = w;
        S.data.profile.activityFactor = parseFloat(val('setup-af')) || 1.375;
        var d = todayKey();
        if (w) {
        var previous = (S.data.bodyMetrics || []).filter(function (b) { return b.date === d && b.source === 'manual' && M.modeOf(b) === mode; })[0] || {};
        S.data.bodyMetrics = (S.data.bodyMetrics || []).filter(function (b) { return !(b.date === d && b.source === 'manual' && M.modeOf(b) === mode); });
        S.data.bodyMetrics.push({
          id: previous.id || uid('bm'), photo: previous.photo, sourceKey: previous.sourceKey, createdAt: previous.createdAt, date: d, measureMode: mode, weightKg: w,
          bmi: h ? Math.round(w / Math.pow(h / 100, 2) * 10) / 10 : null,
          bodyFatPct: fat, source: 'manual', note: '初始基线'
        });
        }
        save(); render(); toast('基线已建立');
      });
    }

    var ts = $('#trend-seg');
    if (ts) $$('#trend-seg button').forEach(function (b) {
      b.addEventListener('click', function () {
        S.trend[b.dataset.trend] = !S.trend[b.dataset.trend];
        if (!S.trend.weight && !S.trend.fat && !S.trend.muscle) S.trend.weight = true;
        render();
      });
    });
    var bs = $('#body-seg');
    if (bs) $$('#body-seg button').forEach(function (b) {
      b.addEventListener('click', function () {
        S.bodyField = b.dataset.field;
        $$('#body-seg button').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        drawCharts();
      });
    });
    var mt = $('#m-items');
    if (mt) {
      mt.addEventListener('input', function () { updateMealTotal(); });
      mt.addEventListener('click', function (e) {
        var d = e.target.closest('[data-del]');
        if (!d) return;
        draftItems = readItems();
        draftItems.splice(+d.dataset.del, 1);
        if (!draftItems.length) draftItems = [{ name: '', amount: '', kcal: '', proteinG: '', fatG: '', carbG: '', fiberG: '' }];
        renderItems();
      });
    }
  }

  document.addEventListener('click', function (e) {
    var close = e.target.closest('[data-close]');
    if (close) { closeModal(); return; }

    var nav = e.target.closest('.nav-item');
    if (nav) {
      S.view = nav.dataset.view;
      S.day = null;
      $('#sidebar').classList.remove('open');
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (e.target.closest('#quick-add')) { quickMenu(); return; }
    if (e.target.closest('#settings-btn')) { formSettings(); return; }
    if (e.target.closest('#theme-btn')) { toggleTheme(); return; }
    if (e.target.closest('#menu-btn')) { $('#sidebar').classList.toggle('open'); return; }

    var rg = e.target.closest('#range-seg button');
    if (rg) {
      S.range = +rg.dataset.range;
      $$('#range-seg button').forEach(function (b) { b.classList.toggle('on', b === rg); });
      localStorage.setItem('vitals.range', S.range);
      render(); return;
    }

    var slot = e.target.closest('#m-slot .chip');
    if (slot) {
      $$('#m-slot .chip').forEach(function (x) { x.classList.remove('on'); });
      slot.classList.add('on'); return;
    }

    var sub = e.target.closest('[data-submit]');
    if (sub) {
      var f = document.getElementById(sub.dataset.submit);
      if (f) {
        if (typeof f.requestSubmit === 'function') f.requestSubmit();
        else f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
      return;
    }

    var act = e.target.closest('[data-act]');
    if (!act) return;
    var a = act.dataset.act;
    if (a === 'quick') { quickMenu(); }
    else if (a === 'add-meal') { formMeal(act.dataset.slot || guessSlot(), S.day); }
    else if (a === 'add-workout') { formWorkout(); }
    else if (a === 'add-supp') { formSupp(); }
    else if (a === 'add-body') { formBody(); }
    else if (a === 'add-activity') { formActivity(); }
    else if (a === 'quick-supp') { formSupp(act.dataset.name, act.dataset.dose); }
    else if (a === 'settings') { formSettings(); }
    else if (a === 'add-item') { addDraft({ name: '', amount: '', kcal: '', proteinG: '', fatG: '', carbG: '', fiberG: '' }); }
    else if (a === 'import') { formImport(act.dataset.kind); }
    else if (a === 'parse-csv') { parseCSV(); }
    else if (a === 'commit-csv') { commitCSV(); }
    else if (a === 'export') { exportJSON(); }
    else if (a === 'copy-json') {
      navigator.clipboard.writeText(JSON.stringify(S.data, null, 2)).then(function () { toast('已复制到剪贴板'); });
    }
    else if (a === 'exit-demo') { location.href = location.pathname; }
    else if (a === 'day-prev') { S.day = ymd(addDays(parseDate(S.day || todayKey()), -1)); render(); }
    else if (a === 'day-next') { S.day = ymd(addDays(parseDate(S.day || todayKey()), 1)); render(); }
    else if (a === 'day-today') { S.day = todayKey(); render(); }
    else if (a === 'del-meal') { del('meals', act.dataset.id); }
    else if (a === 'del-workout') { del('workouts', act.dataset.id); }
    else if (a === 'del-supp') { del('supplements', act.dataset.id); }
    else if (a === 'del-body') { del('bodyMetrics', act.dataset.id); }
  });

  function del(coll, id) {
    if (!canEdit()) return;
    S.data[coll] = (S.data[coll] || []).filter(function (x) { return x.id !== id; });
    save(); render(); toast('已删除');
  }

  var THEMES = ['dark', 'light'];
  function toggleTheme() {
    var cur = document.documentElement.getAttribute('data-theme');
    var next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('vitals.theme', next);
    if (S.view) drawCharts();
  }

  /* ================= 启动 ================= */
  function boot() {
    var savedTheme = localStorage.getItem('vitals.theme');
    document.documentElement.setAttribute('data-theme', savedTheme || 'dark');
    var savedRange = localStorage.getItem('vitals.range');
    if (savedRange) {
      S.range = +savedRange;
      $$('#range-seg button').forEach(function (b) { b.classList.toggle('on', +b.dataset.range === S.range); });
    }
    if (window.innerWidth <= 900) $('#menu-btn').style.display = '';
    S.demo = /[?&]demo=1/.test(location.search);

    if (location.protocol === 'file:') {
      S.demo = false;
      S.mode = 'ro';
      loadData();
      return;
    }

    fetch('/api/ping', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (ping) { S.mode = 'rw'; S.csrfToken = ping.csrfToken; })
      .catch(function () { S.mode = 'ro'; })
      .then(loadData);
  }

  function loadData() {
    if (location.protocol === 'file:') {
      if (!window.__HEALTH_DATA__) {
        $('#view-root').innerHTML = '<div class="card">' + emptyHTML('没有可用的数据快照',
          '直接双击打开时只能读取 data/health-data.js。请运行 <code>python3 server.py</code> 或双击「启动.command」启动本地服务。') + '</div>';
        return;
      }
      S.data = normalize(window.__HEALTH_DATA__);
      updateStatus();
      render();
      window.addEventListener('resize', debounce(function () { drawCharts(); }, 180));
      return;
    }
    var url = S.demo ? '/templates/demo-data.json' : '/api/data';
    return fetch(url, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('读取失败'); return r.json(); })
      .catch(function () {
        if (window.__HEALTH_DATA__) return window.__HEALTH_DATA__;
        throw new Error('无法读取数据文件');
      })
      .then(function (d) {
        S.data = normalize(d);
        updateStatus();
        render();
        window.addEventListener('resize', debounce(function () { drawCharts(); }, 180));
      })
      .catch(function (e) {
        $('#view-root').innerHTML = '<div class="card">' + emptyHTML('数据加载失败',
          '请确认 data/health-data.json 存在，并通过 <code>python3 server.py</code> 打开面板。错误：' + esc(e.message)) + '</div>';
      });
  }

  function normalize(d) {
    d.profile = d.profile || {};
    d.profile.targets = d.profile.targets || {};
    d.profile.goal = d.profile.goal || {};
    ['bodyMetrics', 'dailyActivity', 'meals', 'workouts', 'supplements', 'journal', 'imports'].forEach(function (k) {
      if (!Array.isArray(d[k])) d[k] = [];
    });
    d.sources = d.sources || {};
    ['scale', 'band', 'conversation'].forEach(function (k) {
      d.sources[k] = d.sources[k] || { status: 'pending' };
    });
    d.meta = d.meta || {};
    return d;
  }

  function debounce(fn, ms) {
    var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  document.addEventListener('DOMContentLoaded', boot);

})();
