const test=require('node:test');const assert=require('node:assert/strict');
test('AI confirmation summary distinguishes measured and estimated values',()=>{
 const {summary,missing}=require('../h5/intake.js');
 assert.match(summary({kind:'meal',payload:{items:[{name:'米饭',kcal:100}],totals:{kcal:100}}}),/估算/);
 assert.match(summary({kind:'body',payload:{weightKg:73.5}}),/73.5/);
 assert.ok(missing({kind:'body',payload:{weightKg:73.5}}).length);
 assert.equal(missing({kind:'meal',payload:{slot:'lunch',items:[{name:'饭'}]}}).length,0);
 assert.ok(missing({kind:'workout',payload:{type:'walk'}}).length);
});

test('browser recognizes multiple drafts, revises, edits details and retries one atomic confirmation', {skip:!process.env.H5_COMPOSER_URL},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const b=await chromium.launch({channel:'chrome',headless:true});try{
 const p=await b.newPage({viewport:{width:390,height:844}});let uploads=0,recognized=0,saves=0,previousBody,saveBody;
 const data={schemaVersion:1,meta:{revision:0},profile:{},bodyMetrics:[],dailyActivity:[],meals:[],workouts:[],supplements:[]};
 await p.addInitScript(()=>sessionStorage.setItem('vitals.h5.private','1'));
 await p.route('**/api/v1/**',async route=>{const path=new URL(route.request().url()).pathname;let status=200,value={};
 if(path.endsWith('/session'))value={authenticated:true,csrfToken:'fixture'};else if(path.endsWith('/data'))value=data;else if(path.endsWith('/version'))value={revision:data.meta.revision};
 else if(path.endsWith('/status'))value={model:{available:true},speech:{available:false}};
 else if(path.endsWith('/attachments')){uploads++;value={id:'fixture.png',photo:'attachments/fixture.png'}}
 else if(path.endsWith('/recognize')){recognized++;previousBody=route.request().postDataJSON();value={ok:true,drafts:[{kind:'meal',payload:{date:'2026-10-29',slot:recognized>1?'dinner':'lunch',items:[{name:'米饭',kcal:100}],totals:{kcal:100},confidence:'estimated',photo:'attachments/fixture.png',note:'米饭半碗'}},{kind:'body',payload:{date:'2026-10-29',weightKg:73.5,photo:'attachments/fixture.png'}}]}}
 else if(path.endsWith('/records/batch')){saves++;const body=route.request().postDataJSON();if(saves===1){saveBody=body;status=503;value={error:'模拟断线'}}else{assert.deepEqual(body,saveBody);data.meta.revision++;data.meals=[body.drafts[0].payload];data.bodyMetrics=[body.drafts[1].payload];value={ok:true,revision:1}}}
 await route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
 });
 await p.goto(process.env.H5_COMPOSER_URL);await p.locator('#demo-banner.real').waitFor();await p.locator('#quick-text').fill('米饭半碗');await p.locator('#photo-entry').click();assert.equal(await p.locator('#capture-kind').count(),0);
 await p.locator('#capture-file').setInputFiles({name:'meal.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64')});
 await p.locator('#capture-next').click();await p.locator('.ai-card').first().waitFor();assert.equal(await p.locator('.ai-card').count(),2);assert.equal(saves,0);assert.equal(uploads,1);assert.match(await p.locator('.ai-card').first().innerText(),/估算/);
 await p.locator('#revise-toggle').click();await p.locator('#revision-text').fill('这是晚餐');await p.locator('#revise-submit').click();await p.locator('.ai-card h3').first().filter({hasText:'晚餐'}).waitFor();assert.equal(previousBody.correction,'这是晚餐');assert.equal(previousBody.previousDrafts.length,2);
 await p.locator('[data-detail="0"]').click();await p.locator('[data-nutrient=name]').fill('半碗米饭');await p.locator('#record-form [type=submit]').click();await p.locator('.ai-card').first().filter({hasText:'半碗米饭'}).waitFor();assert.equal(saves,0);
 await p.locator('[data-answer="1"][data-value=fasting]').click();await p.locator('#capture-next').click();await p.locator('#capture-error').filter({hasText:'模拟断线'}).waitFor();assert.equal(await p.locator('#capture-note').isDisabled(),true);assert.equal(await p.locator('.ai-card').count(),2);await p.locator('#editor .close').click();assert.equal(await p.locator('#quick-text').isDisabled(),true);await p.locator('#photo-entry').click();
 await p.locator('#capture-next').click();await p.locator('#editor').waitFor({state:'hidden'});assert.equal(saves,2);assert.equal(uploads,1);assert.equal(data.meals.length,1);assert.equal(data.bodyMetrics[0].measureMode,'fasting');assert.equal(data.meals[0].photo,'attachments/fixture.png');assert.equal(data.meals[0].items[0].name,'半碗米饭');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }finally{await b.close()}
});

test('browser unconfigured AI keeps input and does not upload or invent a result', {skip:!process.env.H5_COMPOSER_URL},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const b=await chromium.launch({channel:'chrome',headless:true});try{
 const p=await b.newPage();let writes=0;const data={meta:{revision:0},profile:{},bodyMetrics:[],dailyActivity:[],meals:[],workouts:[],supplements:[]};await p.addInitScript(()=>sessionStorage.setItem('vitals.h5.private','1'));
 await p.route('**/api/v1/**',async route=>{const path=new URL(route.request().url()).pathname;if(route.request().method()==='POST')writes++;const value=path.endsWith('/session')?{authenticated:true,csrfToken:'test'}:path.endsWith('/version')?{revision:0}:path.endsWith('/status')?{model:{available:false}}:data;await route.fulfill({json:value})});
 await p.goto(process.env.H5_COMPOSER_URL);await p.locator('#demo-banner.real').waitFor();await p.locator('#quick-text').fill('晚饭吃了米饭');await p.locator('#photo-entry').click();await p.locator('#capture-next').click();await p.locator('#capture-error').filter({hasText:'尚未配置'}).waitFor();assert.equal(await p.locator('#capture-note').inputValue(),'晚饭吃了米饭');assert.equal(await p.locator('.ai-card').count(),0);assert.equal(writes,0);
 }finally{await b.close()}
});
test('conflict followed by AI outage retains cards and requires recognition before another save', {skip:!process.env.H5_COMPOSER_URL},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const b=await chromium.launch({channel:'chrome',headless:true});try{
 const p=await b.newPage();let recognizes=0,saves=0;const data={meta:{revision:0},profile:{},bodyMetrics:[],dailyActivity:[],meals:[],workouts:[],supplements:[]};await p.addInitScript(()=>sessionStorage.setItem('vitals.h5.private','1'));
 await p.route('**/api/v1/**',async route=>{const path=new URL(route.request().url()).pathname;let status=200,value={};if(path.endsWith('/session'))value={authenticated:true,csrfToken:'test'};else if(path.endsWith('/version'))value={revision:0};else if(path.endsWith('/status'))value={model:{available:true}};else if(path.endsWith('/recognize')){recognizes++;if(recognizes===1)value={drafts:[{kind:'workout',payload:{date:'2026-10-29',type:'walk',durationMin:30}}]};else{status=502;value={error:'模型暂不可用'}}}else if(path.endsWith('/records/batch')){saves++;status=409;value={error:'版本冲突'}}else value=data;await route.fulfill({status,json:value})});
 await p.goto(process.env.H5_COMPOSER_URL);await p.locator('#demo-banner.real').waitFor();await p.locator('#quick-text').fill('散步30分钟');await p.locator('#photo-entry').click();await p.locator('#capture-next').click();await p.locator('.ai-card').waitFor();await p.locator('#capture-next').click();await p.locator('#capture-error').filter({hasText:'其他地方更新'}).waitFor();await p.locator('#capture-next').click();await p.locator('#capture-error').filter({hasText:'模型暂不可用'}).waitFor();assert.equal(await p.locator('.ai-card').count(),1);await p.locator('#capture-next').click();await p.waitForTimeout(150);assert.equal(saves,1);assert.equal(recognizes,3);
 }finally{await b.close()}
});
