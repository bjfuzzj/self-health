/* VITALS · 轻量 SVG 图表引擎（无第三方依赖，离线可用） */
(function () {
  'use strict';

  var uid = 0;
  function nid() { return 'c' + (++uid); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }
  function css(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return (v && v.trim()) || fallback;
  }
  function niceTicks(min, max, count, exactSegs) {
    if (!isFinite(min) || !isFinite(max)) return [0, 1];
    if (min === max) { min -= 0.5; max += 0.5; }
    var span = max - min;
    var step = Math.pow(10, Math.floor(Math.log(span / count) / Math.LN10));
    var err = (span / count) / step;
    if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
    var lo = Math.floor(min / step) * step;
    var hi = Math.ceil(max / step) * step;
    var out = [];
    for (var v = lo; v <= hi + step * 1e-6; v += step) out.push(Math.round(v * 1e6) / 1e6);
    /* 指定段数时强制等分（双轴必须共享网格线，否则刻度会错位） */
    if (exactSegs && out.length !== exactSegs + 1) {
      var st = (hi - lo) / exactSegs;
      out = [];
      for (var j = 0; j <= exactSegs; j++) out.push(Math.round((lo + st * j) * 1e6) / 1e6);
    }
    return out;
  }
  function niceRange(vals, padRatio) {
    var v = vals.filter(function (x) { return x != null && isFinite(x); });
    if (!v.length) return { min: 0, max: 1 };
    var min = Math.min.apply(null, v), max = Math.max.apply(null, v);
    if (min === max) { min = min - 1; max = max + 1; }
    var pad = (max - min) * (padRatio == null ? 0.18 : padRatio);
    return { min: min - pad, max: max + pad };
  }

  /* 刻度文案：按步长决定小数位，并在调用方格式器产生重复时自动降级 */
  function tickLabels(ticks, fmt, unit) {
    var step = ticks.length > 1 ? Math.abs(ticks[1] - ticks[0]) : 1;
    var d = step >= 1 ? 0 : (step >= 0.1 ? 1 : 2);
    var suf = unit || '';
    var out = ticks.map(function (v) { return fmt ? fmt(v) : v.toFixed(d) + suf; });
    var dup = out.some(function (l, i) { return i > 0 && l === out[i - 1]; });
    if (dup) out = ticks.map(function (v) { return v.toFixed(d) + suf; });
    return out;
  }

  /* ---------------- 折线图 ---------------- */
  function line(host, opt) {
    if (!host) return;
    var height = opt.height || 240;
    var labels = opt.labels || [];
    var series = (opt.series || []).filter(function (s) { return s.values && s.values.length; });
    if (!labels.length || !series.length) { host.innerHTML = emptyBox(opt.empty || '暂无数据'); return; }
    var hasAny = series.some(function (s) {
      return s.values.some(function (v) { return v != null && isFinite(v); });
    });
    if (!hasAny) { host.innerHTML = emptyBox(opt.empty || '暂无数据'); return; }

    var W = Math.max(host.clientWidth || 640, 320);
    var H = height;
    var pad = { t: 14, r: opt.axisRight ? 66 : 18, b: 26, l: 44 };
    var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;

    var leftVals = [], rightVals = [];
    series.forEach(function (s) {
      (s.axis === 'right' ? rightVals : leftVals).push.apply(s.axis === 'right' ? rightVals : leftVals,
        s.values.filter(function (v) { return v != null && isFinite(v); }));
    });
    var lr = leftVals.length ? niceRange(leftVals, 0.22) : { min: 0, max: 1 };
    var rr = rightVals.length ? niceRange(rightVals, 0.22) : { min: 0, max: 1 };
    var lt = niceTicks(lr.min, lr.max, 4);
    var rt = rightVals.length ? niceTicks(rr.min, rr.max, 4, lt.length - 1) : [];
    lr = { min: lt[0], max: lt[lt.length - 1] };
    if (rt.length) rr = { min: rt[0], max: rt[rt.length - 1] };

    var n = labels.length;
    function X(i) { return pad.l + (n === 1 ? iw / 2 : (iw * i) / (n - 1)); }
    function Y(v, axis) {
      var r = axis === 'right' ? rr : lr;
      return pad.t + ih - ((v - r.min) / (r.max - r.min || 1)) * ih;
    }

    var parts = [];
    parts.push('<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" role="img">');
    parts.push('<defs>');
    series.forEach(function (s) {
      var c = s.color || '#2bd9b0';
      s.__gid = 'lg' + (++uid);
      parts.push('<linearGradient id="' + s.__gid + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="' + c + '" stop-opacity=".30"/>' +
        '<stop offset="100%" stop-color="' + c + '" stop-opacity="0"/></linearGradient>');
    });
    parts.push('</defs>');

    /* 网格 + 左轴刻度 */
    var ltLabels = tickLabels(lt, opt.yFormat, opt.yUnit);
    var rtLabels = tickLabels(rt, opt.rightFormat, opt.rightUnit);
    lt.forEach(function (v, i) {
      var y = Y(v, 'left');
      parts.push('<line x1="' + pad.l + '" y1="' + y + '" x2="' + (W - pad.r) + '" y2="' + y +
        '" stroke="' + css('--line', 'rgba(255,255,255,.07)') + '" stroke-width="1"/>');
      parts.push('<text x="' + (pad.l - 8) + '" y="' + (y + 4) + '" text-anchor="end" font-size="10.5" fill="' +
        css('--text-3', '#6d7a8d') + '">' + ltLabels[i] + '</text>');
    });
    /* 右轴只标首/中/末：刻度数与左轴严格相同才能共享网格线，
       但全标会在窄区间里出现 25.45 这类碎标签 */
    var rtKeep = rt.length > 3
      ? [0, Math.floor((rt.length - 1) / 2), rt.length - 1]
      : rt.map(function (_, i) { return i; });
    rt.forEach(function (v, i) {
      if (rtKeep.indexOf(i) < 0) return;
      var y = Y(v, 'right');
      parts.push('<text x="' + (W - pad.r + 13) + '" y="' + (y + 4) + '" text-anchor="start" font-size="10.5" fill="' +
        css('--text-3', '#6d7a8d') + '">' + rtLabels[i] + '</text>');
    });

    /* X 轴标签 */
    var step = Math.max(1, Math.ceil(n / (iw < 420 ? 4 : 8)));
    labels.forEach(function (lb, i) {
      if (i % step !== 0 && i !== n - 1) return;
      parts.push('<text x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10.5" fill="' +
        css('--text-3', '#6d7a8d') + '">' + esc(lb) + '</text>');
    });

    /* 数据 */
    series.forEach(function (s) {
      var axis = s.axis === 'right' ? 'right' : 'left';
      var pts = [];
      s.values.forEach(function (v, i) {
        if (v == null || !isFinite(v)) { pts.push(null); return; }
        pts.push([X(i), Y(v, axis)]);
      });
      if (s.area) {
        var segs = [], cur = [];
        pts.forEach(function (p) { if (p) cur.push(p); else if (cur.length) { segs.push(cur); cur = []; } });
        if (cur.length) segs.push(cur);
        segs.forEach(function (seg) {
          if (seg.length < 2) return;
          var base = pad.t + ih;
          var d = 'M' + seg[0][0] + ',' + base;
          seg.forEach(function (p) { d += 'L' + p[0] + ',' + p[1]; });
          d += 'L' + seg[seg.length - 1][0] + ',' + base + 'Z';
          parts.push('<path d="' + d + '" fill="url(#' + s.__gid + ')" opacity=".9"/>');
        });
      }
      var segs2 = [], cur2 = [];
      pts.forEach(function (p) { if (p) cur2.push(p); else if (cur2.length) { segs2.push(cur2); cur2 = []; } });
      if (cur2.length) segs2.push(cur2);
      /* 缺口用虚线桥接，避免稀疏数据看起来像断线 */
      if (segs2.length > 1) {
        var all = [];
        pts.forEach(function (p) { if (p) all.push(p); });
        if (all.length > 1) {
          var db = 'M' + all.map(function (p) { return p[0] + ',' + p[1]; }).join('L');
          parts.push('<path d="' + db + '" fill="none" stroke="' + (s.color || '#2bd9b0') +
            '" stroke-width="1.2" stroke-dasharray="2 4" opacity=".45" stroke-linecap="round"/>');
        }
      }
      segs2.forEach(function (seg) {
        var d = 'M' + seg.map(function (p) { return p[0] + ',' + p[1]; }).join('L');
        parts.push('<path d="' + d + '" fill="none" stroke="' + (s.color || '#2bd9b0') +
          '" stroke-width="' + (s.width || 2) + '" stroke-linejoin="round" stroke-linecap="round"' +
          (s.dash ? ' stroke-dasharray="' + s.dash + '"' : '') + '/>');
      });
      if (!opt.hideDots) {
        pts.forEach(function (p, i) {
          if (!p) return;
          if (n > 20 && i !== n - 1) return;
          parts.push('<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (i === n - 1 ? 3.4 : 2.2) +
            '" fill="' + css('--panel', '#0f141c') + '" stroke="' + (s.color || '#2bd9b0') + '" stroke-width="1.8"/>');
        });
      }
    });

    parts.push('<g class="hover-layer"></g>');
    parts.push('</svg>');
    host.innerHTML = parts.join('');

    /* hover 交互 */
    var svg = host.querySelector('svg');
    var tip = document.createElement('div');
    tip.className = 'chart-tip';
    host.appendChild(tip);
    var cross = svg.querySelector('.hover-layer');
    svg.addEventListener('mousemove', function (e) {
      var rect = svg.getBoundingClientRect();
      var px = ((e.clientX - rect.left) / rect.width) * W;
      var idx = Math.round(((px - pad.l) / (iw || 1)) * (n - 1));
      idx = Math.max(0, Math.min(n - 1, idx));
      var x = X(idx);
      var h = '<line x1="' + x + '" y1="' + pad.t + '" x2="' + x + '" y2="' + (pad.t + ih) +
        '" stroke="' + css('--line-strong', 'rgba(255,255,255,.15)') + '" stroke-dasharray="3 3"/>';
      var rows = '<div class="tip-date">' + esc(labels[idx]) + '</div>';
      series.forEach(function (s) {
        var v = s.values[idx];
        if (v == null) return;
        rows += '<div class="tip-row"><i style="background:' + (s.color || '#2bd9b0') + '"></i>' +
          '<span>' + esc(s.name) + '</span><b>' + (s.fmt ? s.fmt(v) : v) + '</b></div>';
        h += '<circle cx="' + x + '" cy="' + Y(v, s.axis === 'right' ? 'right' : 'left') +
          '" r="3.6" fill="' + (s.color || '#2bd9b0') + '"/>';
      });
      cross.innerHTML = h;
      tip.innerHTML = rows;
      tip.style.opacity = '1';
      var left = (x / W) * rect.width;
      tip.style.left = Math.min(Math.max(left + 12, 8), rect.width - 128) + 'px';
      tip.style.top = '10px';
    });
    svg.addEventListener('mouseleave', function () {
      cross.innerHTML = '';
      tip.style.opacity = '0';
    });
  }

  /* ---------------- 柱状图（支持正负分流堆叠） ---------------- */
  function bars(host, opt) {
    if (!host) return;
    var height = opt.height || 220;
    var labels = opt.labels || [];
    var series = (opt.series || []).filter(function (s) { return s.values && s.values.length; });
    if (!labels.length || !series.length) { host.innerHTML = emptyBox(opt.empty || '暂无数据'); return; }
    var hasAny = series.some(function (s) {
      return s.values.some(function (v) { return v != null && isFinite(v); });
    });
    if (!hasAny) { host.innerHTML = emptyBox(opt.empty || '暂无数据'); return; }

    var W = Math.max(host.clientWidth || 640, 320), H = height;
    var pad = { t: 16, r: 12, b: 26, l: 44 };
    var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;

    var posSum = [], negSum = [];
    for (var i = 0; i < labels.length; i++) { posSum.push(0); negSum.push(0); }
    series.forEach(function (s) {
      s.values.forEach(function (v, i) {
        if (v == null || !isFinite(v)) return;
        if (v >= 0) posSum[i] += v; else negSum[i] += v;
      });
    });
    var ticks = niceTicks(Math.min(0, Math.min.apply(null, negSum)), Math.max(0, Math.max.apply(null, posSum)), 4);
    var lo = ticks[0], hi = ticks[ticks.length - 1];
    function Y(v) { return pad.t + ih - ((v - lo) / (hi - lo || 1)) * ih; }

    var slot = iw / labels.length;
    var groupW = Math.min(slot * 0.68, 34);
    var barW = groupW / series.length;

    var out = ['<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '">'];
    var tLabels = tickLabels(ticks, opt.yFormat);
    ticks.forEach(function (v, ti) {
      var y = Y(v);
      out.push('<line x1="' + pad.l + '" y1="' + y + '" x2="' + (W - pad.r) + '" y2="' + y + '" stroke="' +
        (v === 0 ? css('--line-strong', 'rgba(255,255,255,.16)') : css('--line', 'rgba(255,255,255,.07)')) + '"/>');
      out.push('<text x="' + (pad.l - 8) + '" y="' + (y + 4) + '" text-anchor="end" font-size="10.5" fill="' +
        css('--text-3', '#6d7a8d') + '">' + tLabels[ti] + '</text>');
    });
    labels.forEach(function (lb, i) {
      var cx = pad.l + slot * i + slot / 2;
      var pAcc = 0, nAcc = 0;
      series.forEach(function (s) {
        var v = s.values[i];
        if (v == null || !isFinite(v)) return;
        var x = cx - groupW / 2 + barW * series.indexOf(s);
        var y0, y1;
        if (v >= 0) { y0 = Y(pAcc); pAcc += v; y1 = Y(pAcc); }
        else { y0 = Y(nAcc); nAcc += v; y1 = Y(nAcc); }
        var top = Math.min(y0, y1), hgt = Math.max(1.5, Math.abs(y1 - y0));
        out.push('<rect x="' + x + '" y="' + top + '" width="' + Math.max(2, barW - 1.5) + '" height="' + hgt +
          '" rx="' + Math.min(3, barW / 3) + '" fill="' + (s.color || '#2bd9b0') + '" opacity="' +
          (s.opacity == null ? 0.92 : s.opacity) + '"><title>' + esc(lb + ' · ' + s.name + ' ' + v) + '</title></rect>');
      });
      if (opt.labelEvery !== 0 && (i % Math.max(1, Math.ceil(labels.length / (iw < 420 ? 4 : 9))) === 0 || i === labels.length - 1)) {
        out.push('<text x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10.5" fill="' +
          css('--text-3', '#6d7a8d') + '">' + esc(lb) + '</text>');
      }
    });
    out.push('</svg>');
    host.innerHTML = out.join('');
  }

  /* ---------------- 环形进度 ---------------- */
  function ring(host, opt) {
    if (!host) return;
    var size = opt.size || 200, sw = opt.stroke || 14;
    var r = (size - sw) / 2 - 2, c = 2 * Math.PI * r;
    var pct = Math.max(0, Math.min(1.4, (opt.value || 0) / (opt.target || 1)));
    var color = opt.color || '#2bd9b0';
    var over = pct > 1;
    var dash = Math.min(pct, 1) * c;
    var gid = 'gr' + (++uid);
    var svg = '' +
      '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="' + color + '"/><stop offset="100%" stop-color="' + (opt.color2 || color) + '"/>' +
      '</linearGradient></defs>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' +
      css('--line', 'rgba(255,255,255,.08)') + '" stroke-width="' + sw + '"/>' +
      (over ? '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="#f97066" stroke-width="' +
        (sw + 4) + '" stroke-linecap="round" stroke-dasharray="' + (c * (pct - 1)) + ' ' + c + '" transform="rotate(-90 ' +
        size / 2 + ' ' + size / 2 + ')" opacity=".8"/>' : '') +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="url(#' + gid + ')" stroke-width="' +
      sw + '" stroke-linecap="round" stroke-dasharray="' + dash + ' ' + c + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/>' +
      '</svg>';
    host.innerHTML = svg;
  }

  /* ---------------- 热力图 ---------------- */
  function heatmap(host, opt) {
    if (!host) return;
    var days = opt.days || [];
    if (!days.length) { host.innerHTML = emptyBox('暂无记录'); return; }
    var gap = opt.gap || 3;
    var cols = opt.weeks || 16;
    var maxCell = opt.maxCell || 20;
    var W = Math.max(host.clientWidth || 600, 220);
    var cell = Math.min(maxCell, (W - gap * (cols - 1)) / cols);
    var blockW = cell * cols + gap * (cols - 1);
    var H = 7 * (cell + gap) - gap;
    var map = {};
    days.forEach(function (d) { map[d.date] = d.value; });
    var max = Math.max.apply(null, days.map(function (d) { return d.value || 0; }).concat([1]));
    var out = ['<svg viewBox="0 0 ' + blockW + ' ' + H + '" width="' + Math.round(blockW) + '" height="' + Math.round(H) +
      '" style="display:block;margin:0 auto">'];
    var end = new Date(); end.setHours(0, 0, 0, 0);
    var start = new Date(end); start.setDate(start.getDate() - (cols * 7 - 1));
    start.setDate(start.getDate() - start.getDay());
    for (var d = 0; d < cols * 7; d++) {
      var cur = new Date(start); cur.setDate(start.getDate() + d);
      var key = ymd(cur);
      var col = Math.floor(d / 7), row = cur.getDay();
      var v = map[key];
      var a = v == null || v === 0 ? 0 : 0.16 + 0.84 * Math.min(1, v / max);
      var fill = a === 0 ? css('--line', 'rgba(255,255,255,.06)') : (opt.color || '#2bd9b0');
      out.push('<rect x="' + (col * (cell + gap)).toFixed(1) + '" y="' + (row * (cell + gap)).toFixed(1) +
        '" width="' + cell.toFixed(1) + '" height="' + cell.toFixed(1) +
        '" rx="' + Math.min(3, cell / 4).toFixed(1) + '" fill="' + fill + '" opacity="' + (a === 0 ? 1 : a) +
        '"><title>' + key + (v != null ? ' · ' + v : '') + '</title></rect>');
    }
    out.push('</svg>');
    host.innerHTML = out.join('');
  }

  function ymd(d) {
    var m = ('0' + (d.getMonth() + 1)).slice(-2), day = ('0' + d.getDate()).slice(-2);
    return d.getFullYear() + '-' + m + '-' + day;
  }
  function emptyBox(msg) {
    return '<div class="chart-empty">' + esc(msg) + '</div>';
  }

  window.ChartLib = { line: line, bars: bars, ring: ring, heatmap: heatmap };
})();
