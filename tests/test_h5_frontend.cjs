const test = require('node:test');
const assert = require('node:assert/strict');
const {demoSeed,total,present,esc,KEY}=require('../h5/app.js');
test('missing measurements stay unknown; recorded zero stays zero',()=>{
 assert.equal(total([{}, {steps:null}], 'steps'),null);
 assert.equal(total([{steps:0},{}], 'steps'),0);
 assert.equal(present(''),false);assert.equal(present(0),true);
});
test('demo is fictional and independent, with separate fasting and bedtime readings',()=>{
 const a=demoSeed(),b=demoSeed();a.profile.name='changed';a.bodyMetrics[0].weightKg=1;
 assert.equal(b.profile.name,'体验者');assert.notEqual(b.bodyMetrics[0].weightKg,1);
 assert.ok(b.bodyMetrics.some(r=>r.measureMode==='fasting'));
 assert.ok(b.bodyMetrics.some(r=>r.measureMode==='bedtime'));
 assert.ok(b.bodyMetrics.every(r=>r.source==='demo'));
 assert.equal(KEY,'vitals.h5.demo.v1');
});
test('record and profile text escapes HTML',()=>assert.equal(esc('<img src="x">'), '&lt;img src=&quot;x&quot;&gt;'));
const {mergeMealItem,profilePatch}=require('../h5/app.js');
test('editing known meal fields retains legacy grams brand and unknown metadata',()=>{
 const original={name:'旧餐食',grams:180,brand:'品牌',custom:{verified:true},kcal:220};
 const changed=mergeMealItem(original,{name:'修正餐食',kcal:'230',proteinG:''});
 assert.deepEqual(changed,{...original,name:'修正餐食',kcal:230});
 assert.equal(original.name,'旧餐食');
});
test('profile edit emits editable fields and merges latest hidden goal properties',()=>{
 const latest={name:'服务器',hidden:'retain',goal:{type:'record_only',custom:'concurrent',targetWeightKg:71}};
 const patch=profilePatch({name:'我的编辑',sex:'',heightCm:170,age:null,targetWeightKg:70},latest);
 assert.equal(patch.hidden,undefined);assert.equal(patch.goal.custom,'concurrent');
 assert.equal(patch.goal.type,'record_only');assert.equal(patch.goal.targetWeightKg,70);
});

// Optional browser integration: point ONLY at an isolated legacy-meal fixture.
test('browser legacy preservation, concurrent profile conflict, and private-session reload', {skip:!process.env.H5_REGRESSION_URL}, async()=>{
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const b=await chromium.launch({headless:true,...(process.env.H5_BROWSER_PATH?{executablePath:process.env.H5_BROWSER_PATH}:{})});const p=await b.newPage({viewport:{width:390,height:844}});await p.goto(process.env.H5_REGRESSION_URL);await p.locator('[data-tab=profile]').click();await p.locator('#switch-mode').click();await p.locator('#f-password').fill(process.env.H5_REGRESSION_PASSWORD);await p.locator('#login-form [type=submit]').click();await p.locator('#editor').waitFor({state:'hidden'});await p.locator('[data-tab=today]').click();await p.locator('[data-edit="legacy-meal"]').click();await p.locator('[data-nutrient=name]').fill('修改食物');await p.locator('[data-nutrient=kcal]').fill('250');await p.locator('#record-form [type=submit]').click();await p.locator('#editor').waitFor({state:'hidden'});let data=await p.evaluate(()=>fetch('/api/v1/data').then(r=>r.json()));assert.equal(data.meals[0].items[0].grams,180);assert.equal(data.meals[0].items[0].brand,'原品牌');assert.deepEqual(data.meals[0].items[0].legacyCustom,{proof:'retained'});await p.locator('[data-tab=profile]').click();await p.locator('#edit-profile').click();await p.locator('#f-name').fill('我的新名字');await p.locator('#f-targetWeightKg').fill('68');await p.evaluate(async()=>{const session=await fetch('/api/v1/session').then(r=>r.json());const d=await fetch('/api/v1/data').then(r=>r.json());const r=await fetch('/api/v1/profile',{method:'PATCH',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrfToken},body:JSON.stringify({profile:{name:'其他位置新名字',hiddenTop:'concurrent',goal:{...d.profile.goal,hiddenNested:'concurrent'}},expectedRevision:d.meta.revision,requestId:'concurrent-profile-'+Date.now()})});if(!r.ok)throw new Error(await r.text())});await p.locator('#profile-form [type=submit]').click();await p.locator('#retry-conflict').waitFor();assert.equal(await p.locator('#f-name').inputValue(),'我的新名字');await p.locator('#retry-conflict').click();await p.locator('#confirm-conflict').waitFor();assert.equal(await p.locator('#profile-form [type=submit]').isDisabled(),true);assert.ok((await p.locator('.conflict-table').innerText()).includes('其他位置新名字'));assert.ok((await p.locator('.conflict-table').innerText()).includes('我的新名字'));await p.locator('#confirm-conflict').check();await p.locator('#profile-form [type=submit]').click();await p.locator('#editor').waitFor({state:'hidden'});data=await p.evaluate(()=>fetch('/api/v1/data').then(r=>r.json()));assert.equal(data.profile.hiddenTop,'concurrent');assert.equal(data.profile.goal.hiddenNested,'concurrent');assert.equal(data.profile.goal.targetWeightKg,68);assert.equal(data.profile.name,'我的新名字');await p.reload();await p.locator('#demo-banner.real').waitFor();await p.locator('[data-tab=profile]').click();await p.getByRole('heading',{name:'我的新名字'}).waitFor();assert.equal(await p.evaluate(()=>sessionStorage.getItem('vitals.h5.private')),'1');await p.evaluate(async()=>{const s=await fetch('/api/v1/session').then(r=>r.json());await fetch('/api/v1/auth/logout',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':s.csrfToken},body:'{}'})});await p.reload();await p.getByRole('heading',{name:'请重新登录。'}).waitFor();assert.ok((await p.locator('#demo-banner').innerText()).includes('私人空间'));console.log('PASS actual API: legacy grams/brand/unknown preserved, concurrent hidden top/nested profile preserved, explicit conflict comparison+checkbox, secure-cookie reload restores real, expired session stays private/login-required');await b.close()
});
const {filterRows}=require('../h5/app.js');
test('history date and category filters retain older dates without UTC conversion',()=>{
 const rows=[{id:'old',date:'2025-12-31',kind:'meal'},{id:'new',date:'2026-01-01',kind:'body'},{id:'same',date:'2026-01-01',kind:'meal'}];
 assert.deepEqual(filterRows(rows,{date:'2025-12-31'}).map(r=>r.id),['old']);
 assert.deepEqual(filterRows(rows,{kind:'meal'}).map(r=>r.id),['old','same']);
 assert.deepEqual(filterRows(rows,{date:'2026-01-01',kind:'meal'}).map(r=>r.id),['same']);
 assert.equal(filterRows(rows).length,3);
});

test('browser history date/type filters and honest range summaries', {skip:!process.env.H5_REGRESSION_URL}, async()=>{const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const b=await chromium.launch({headless:true,...(process.env.H5_BROWSER_PATH?{executablePath:process.env.H5_BROWSER_PATH}:{})});const p=await b.newPage({viewport:{width:390,height:844}});await p.goto(process.env.H5_REGRESSION_URL);const d=demoSeed();d.meals.push({id:'old-meal',date:'2024-12-31',slot:'lunch',title:'历史午餐',items:[{name:'旧餐',kcal:100}],totals:{kcal:100},confidence:'estimated'});d.meals.push({id:'old-unknown',date:'2024-12-31',slot:'dinner',title:'热量未记录晚餐',items:[{name:'旧晚餐'}],totals:{}});d.bodyMetrics.push({id:'old-body',date:'2024-12-31',weightKg:75,bodyFatPct:22,measureMode:'fasting'},{id:'old-bed',date:'2024-12-31',weightKg:76,bodyFatPct:23,measureMode:'bedtime'});d.workouts.push({id:'old-workout',date:'2024-12-31',type:'walk',typeLabel:'历史快走',durationMin:25});await p.evaluate(d=>localStorage.setItem('vitals.h5.demo.v1',JSON.stringify(d)),d);await p.reload();await p.locator('[data-tab=today]').click();assert.equal(await p.locator('[data-edit="old-meal"]').count(),0);await p.locator('#history-date').fill('2024-12-31');await p.locator('#history-kind').selectOption('meal');assert.equal(await p.locator('[data-edit="old-meal"]').count(),1);assert.equal(await p.locator('[data-edit="old-body"]').count(),0);assert.ok((await p.locator('.stats').innerText()).includes('75'));assert.ok((await p.locator('.stats').innerText()).includes('100'));await p.locator('[data-history-mode=all]').click();assert.equal(await p.locator('.stats').count(),0);assert.equal(await p.locator('[data-edit="old-meal"]').count(),1);await p.locator('#history-kind').selectOption('body');assert.equal(await p.locator('[data-edit="old-meal"]').count(),0);assert.equal(await p.locator('[data-edit="old-bed"]').count(),1);await p.locator('[data-tab=trends]').click();await p.locator('[data-range=custom]').click();await p.locator('#range-from').fill('2024-12-31');await p.locator('#range-to').fill('2024-12-31');await p.locator('#apply-range').click();const text=await p.locator('#main').innerText();assert.ok(text.includes('体脂率的轨迹'));assert.ok(text.includes('100'));assert.ok(text.includes('25'));assert.ok(text.includes('存在热量缺失'));assert.equal(await p.locator('.card').filter({hasText:'体脂率的轨迹'}).locator('svg polyline').count(),2);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);console.log('PASS: older fixture date/type/all-history filters, correct selected-day metrics, all-history no daily totals, separate bodyfat modes, known meal kcal + missing warning, workout minutes, mobile no overflow');await b.close()
});

test('voice transcript appends to existing typed explanation without replacing it',()=>{
 const {appendTranscript}=require('../h5/voice.js');
 assert.equal(appendTranscript('米饭半碗',' 汤没喝 '),'米饭半碗\n汤没喝');
 assert.equal(appendTranscript('原说明','  '),'原说明');
 assert.equal(appendTranscript('','走路三十分钟'),'走路三十分钟');
});

test('recording releases microphone; failed transcription retries without losing description',async()=>{
 const {mount,appendTranscript}=require('../h5/voice.js');
 const nodes=Object.fromEntries(['.voice-start','.voice-cancel','.voice-retry','.voice-status'].map(k=>[k,{hidden:false,disabled:false,textContent:'',click(){if(!this.disabled)return this.onclick()}}]));
 const element={innerHTML:'',querySelector:k=>nodes[k]};let stopped=0,attempt=0,note='米饭半碗';
 globalThis.isSecureContext=true;Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){stopped++}}]})}}});
 globalThis.MediaRecorder=class{static isTypeSupported(){return true}constructor(){this.state='inactive';this.mimeType='audio/webm'}start(){this.state='recording'}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['audio'])});this.onstop?.()}};
 const dispose=mount({element,mode:'real',api:async path=>{if(path==='/status')return {speech:{available:true}};attempt++;if(attempt===1)throw new Error('网络中断');return {text:'汤没喝'}},onText:text=>note=appendTranscript(note,text)});
 await nodes['.voice-start'].click();assert.ok(nodes['.voice-start'].textContent.includes('结束'));
 await nodes['.voice-start'].click();await new Promise(r=>setImmediate(r));
 assert.ok(stopped>=1);assert.equal(note,'米饭半碗');assert.equal(nodes['.voice-retry'].hidden,false);
 await nodes['.voice-retry'].click();assert.equal(note,'米饭半碗\n汤没喝');assert.equal(attempt,2);
 dispose();delete globalThis.MediaRecorder;delete globalThis.navigator;delete globalThis.isSecureContext;
});
test('cancel while microphone permission is pending releases late stream without recording',async()=>{
 const {mount}=require('../h5/voice.js');
 const nodes=Object.fromEntries(['.voice-start','.voice-cancel','.voice-retry','.voice-status'].map(k=>[k,{click(){return this.onclick()}}]));let resolveStream,stopped=0,started=0;
 globalThis.isSecureContext=true;Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>new Promise(r=>resolveStream=r)}}});
 globalThis.MediaRecorder=class{constructor(){started++}};
 const dispose=mount({element:{querySelector:k=>nodes[k]},mode:'real',api:async()=>({speech:{available:true}}),onText(){assert.fail('cancelled audio must not append')}});
 const pending=nodes['.voice-start'].click();await new Promise(r=>setImmediate(r));nodes['.voice-cancel'].click();resolveStream({getTracks:()=>[{stop(){stopped++}}]});await pending;assert.equal(stopped,1);assert.equal(started,0);dispose();delete globalThis.MediaRecorder;delete globalThis.navigator;delete globalThis.isSecureContext;
});
test('unconfigured speech never requests microphone permission',async()=>{
 const {mount}=require('../h5/voice.js');const nodes=Object.fromEntries(['.voice-start','.voice-cancel','.voice-retry','.voice-status'].map(k=>[k,{}]));let requested=0;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>requested++}}});
 const dispose=mount({element:{querySelector:k=>nodes[k]},mode:'real',api:async()=>({speech:{configured:false,available:false}}),onText(){assert.fail()}});
 await nodes['.voice-start'].onclick();assert.equal(requested,0);assert.match(nodes['.voice-status'].textContent,/尚未配置/);dispose();delete globalThis.navigator;
});
