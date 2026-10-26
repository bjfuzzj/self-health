const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../assets/app.js'), 'utf8');

function csvContext(text) {
  const nodes = {'#i-text': {value: text}, '#i-preview': {}, '#i-commit': {style: {}}};
  const ctx = {importState: {kind: 'scale', rows: []}, $: s => nodes[s],
    pad: n => String(n).padStart(2, '0'), esc: String, toast() {}, closeModal() {}, save() {}, render() {},
    isoNow: () => '', uid: () => Math.random().toString(),
    M: {height: () => 170}, S: {data: {bodyMetrics: [], dailyActivity: [], sources: {scale: {}, band: {}}}}};
  vm.createContext(ctx);
  vm.runInContext(source.slice(source.indexOf('  var COLMAP ='), source.indexOf('  function exportJSON()')), ctx);
  return ctx;
}

test('活动消耗不被当作总消耗', () => {
  const ctx = csvContext('日期,活动消耗\n2026-10-26,300');
  vm.runInContext('parseCSV()', ctx);
  assert.equal(ctx.importState.mapping.totalKcal, undefined);
  assert.equal(ctx.importState.mapping.activeKcal, 1);
});

test('CSV 接受百分号单位和标准字段名', () => {
  const ctx = csvContext('date,weightKg,体脂率(%),activeKcal,totalKcal\n2026-10-26,70,24,300,2000');
  vm.runInContext('parseCSV()', ctx);
  assert.equal(ctx.importState.rows[0].bodyFatPct, 24);
  assert.equal(ctx.importState.rows[0].activeKcal, 300);
  assert.equal(ctx.importState.rows[0].totalKcal, 2000);
});

test('CSV 导入保留同日睡前称重及不同来源，明确时段', () => {
  const ctx = csvContext('日期,体重\n2026-10-26,70');
  ctx.S.data.bodyMetrics = [
    {date: '2026-10-26', source: 'xiaomi_scale', measureMode: 'bedtime', weightKg: 71},
    {date: '2026-10-26', source: 'manual', measureMode: 'fasting', weightKg: 70.1},
    {id: 'existing-fasting', date: '2026-10-26', source: 'xiaomi_scale', measureMode: 'fasting', weightKg: 70.3, sourceKey: 'message-original'}
  ];
  vm.runInContext("parseCSV(); importState.measureMode='fasting'; commitCSV()", ctx);
  assert.equal(ctx.S.data.bodyMetrics.length, 3);
  assert.equal(ctx.S.data.bodyMetrics.find(r => r.source === 'xiaomi_scale' && r.weightKg === 70).measureMode, 'fasting');
  assert.equal(ctx.S.data.bodyMetrics.find(r => r.source === 'xiaomi_scale' && r.weightKg === 70).id, 'existing-fasting');
  assert.equal(ctx.S.data.bodyMetrics.find(r => r.source === 'xiaomi_scale' && r.weightKg === 70).ts, undefined);
});

test('没有数值列或非法日期时不能导入', () => {
  for (const text of ['日期,未知\n2026-10-26,1', '日期,体重\n2026-02-30,70']) {
    const ctx = csvContext(text);
    vm.runInContext('parseCSV()', ctx);
    assert.equal(ctx.importState.rows.length, 0);
  }
});

test('导入部分手环列时保留同日其他指标', () => {
  const ctx = csvContext('日期,步数\n2026-10-26,3000');
  ctx.importState.kind = 'band';
  ctx.S.data.dailyActivity = [{date: '2026-10-26', sleepMin: 450, steps: 1000}];
  vm.runInContext('parseCSV();commitCSV()', ctx);
  assert.equal(ctx.S.data.dailyActivity[0].sleepMin, 450);
  assert.equal(ctx.S.data.dailyActivity[0].steps, 3000);
  assert.ok(ctx.S.data.dailyActivity[0].id);
});

function appContext() {
  const nodes = new Map();
  const node = () => ({style: {}, classList: {toggle() {}, add() {}, remove() {}}, appendChild() {}});
  const document = {addEventListener() {}, querySelector(s) {if (!nodes.has(s)) nodes.set(s, node()); return nodes.get(s);},
    querySelectorAll: () => [], createElement: node};
  const ctx = {document, window: {addEventListener() {}}, location: {search: '', protocol: 'http:'},
    setTimeout: () => 1, clearTimeout() {}, console};
  vm.createContext(ctx);
  vm.runInContext(source.replace("  document.addEventListener('DOMContentLoaded', boot);",
    '  globalThis.api = {S:S,M:M,save:save,flushSave:flushSave,goalCard:goalCard,energyCard:energyCard,hhmm:hhmm};'), ctx);
  ctx.api.S.data = {meta: {revision: 0}, profile: {goal: {type: 'record_only'}, targets: {}}, bodyMetrics: []};
  return ctx;
}

test('仅记录不自动设置热量目标；未知性别不推算 BMR', () => {
  const ctx = appContext();
  ctx.api.S.data.profile = {weightKg: 70, heightCm: 170, age: 60, goal: {type: 'record_only'}, targets: {}};
  assert.equal(ctx.api.M.bmr(), null);
  assert.equal(ctx.api.M.targets().kcal, null);
});

test('未提供记录时间时不显示当前时间', () => {
  const ctx = appContext();
  assert.equal(ctx.api.hhmm(undefined), '—');
});

test('仅记录时进餐不显示超出目标，未知消耗不补零', () => {
  const ctx = appContext();
  ctx.api.M.intakeOn = () => ({kcal: 500, proteinG: 20, fatG: 10, carbG: 60});
  ctx.api.M.burnOn = () => null;
  const html = ctx.api.energyCard();
  assert.equal(html.includes('超出目标'), false);
  assert.match(html, /今日总消耗<\/span><span class="v">—/);
});

test('减重达成日期必须在未来', () => {
  const ctx = appContext();
  const m = ctx.api.M;
  ctx.api.S.data.profile.goal = {type: 'fat_loss', targetWeightKg: 65};
  m.weight = () => 70;
  m.fastingBodies = () => [{weightKg: 75}];
  m.latestBody = () => ({weightKg: 70});
  m.seriesWeight = () => [71, 70.5, 70];
  m.range = () => [];
  m.slope = () => -0.1;
  m.streak = () => 0;
  const html = ctx.api.goalCard();
  const match = html.match(/预计 <b>(\d{4}-\d{2}-\d{2})/);
  assert.ok(match);
  assert.ok(new Date(match[1]) > new Date());
});

test('保存中再次编辑排队提交，使用服务端最新修订', async () => {
  const ctx = appContext();
  const requests = [], resolves = [];
  ctx.fetch = (url, options) => {requests.push(JSON.parse(options.body)); return new Promise(resolve => resolves.push(resolve));};
  const {S, save, flushSave} = ctx.api;
  S.mode = 'rw';
  S.data.profile.name = 'first'; save(); flushSave();
  S.data.profile.name = 'second'; save(); flushSave();
  assert.equal(requests.length, 1);
  resolves[0]({status: 200, json: async () => ({ok: true, revision: 1, savedAt: '2026-10-26T12:00:00+08:00'})});
  await new Promise(setImmediate);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].meta.revision, 1);
  assert.equal(requests[1].profile.name, 'second');
  resolves[1]({status: 200, json: async () => ({ok: true, revision: 2, savedAt: '2026-10-26T12:01:00+08:00'})});
  await new Promise(setImmediate);
  assert.equal(S.dirty, false);
  assert.equal(S.data.meta.revision, 2);
});

test('保存冲突保留未保存内容并阻止自动覆盖', async () => {
  const ctx = appContext();
  ctx.fetch = async () => ({status: 409, json: async () => ({ok: false, error: 'conflict'})});
  ctx.api.S.mode = 'rw';
  ctx.api.S.data.profile.name = 'unsaved';
  ctx.api.save(); ctx.api.flushSave();
  await new Promise(setImmediate);
  assert.equal(ctx.api.S.saveBlocked, true);
  assert.equal(ctx.api.S.dirty, true);
  assert.equal(ctx.api.S.data.profile.name, 'unsaved');
});
