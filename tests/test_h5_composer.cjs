const test=require('node:test');
const assert=require('node:assert/strict');
test('combined image and editable explanation preserve one draft', {skip:!process.env.H5_COMPOSER_URL},async()=>{const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const b=await chromium.launch({channel:'chrome',headless:true});try{const p=await b.newPage({viewport:{width:390,height:844}});await p.goto(process.env.H5_COMPOSER_URL);await p.locator('#quick-text').fill('米饭只吃一半');await p.locator('#photo-entry').click();assert.equal(await p.locator('#capture-note').inputValue(),'米饭只吃一半');await p.locator('#capture-file').setInputFiles({name:'meal.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64')});await p.locator('#capture-preview img').waitFor();await p.locator('#capture-note').fill('米饭只吃一半，汤没喝');await p.locator('.voice-start').click();assert.ok((await p.locator('.voice-status').innerText()).includes('未配置'));await p.locator('#editor .close').click();await p.locator('#photo-entry').click();assert.equal(await p.locator('#capture-note').inputValue(),'米饭只吃一半，汤没喝');assert.equal(await p.locator('#capture-preview img').count(),1);await p.locator('#capture-next').click();assert.equal(await p.locator('#f-note').inputValue(),'米饭只吃一半，汤没喝');assert.equal(await p.locator('#editor img.preview').count(),1);await p.locator('[data-nutrient=name]').fill('午饭');await p.locator('#record-form [type=submit]').click();await p.locator('#editor').waitFor({state:'hidden'});const data=await p.evaluate(()=>JSON.parse(localStorage.getItem('vitals.h5.demo.v1')));assert.equal(data.meals.at(-1).note,'米饭只吃一半，汤没喝');assert.equal(await p.locator('#quick-text').inputValue(),'');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);console.log('PASS combined photo+note, close/reopen retains draft, unavailable voice honest, save note, no overflow');}finally{await b.close()}});

test('private image upload and save failures retain photo and explanation without duplicate upload', {skip:!process.env.H5_COMPOSER_URL},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const b=await chromium.launch({channel:'chrome',headless:true});try{
 const p=await b.newPage({viewport:{width:390,height:844}});let uploads=0,saves=0,saved;
 const data={schemaVersion:1,meta:{revision:0},profile:{},bodyMetrics:[],dailyActivity:[],meals:[],workouts:[],supplements:[]};
 await p.addInitScript(()=>sessionStorage.setItem('vitals.h5.private','1'));
 await p.route('**/api/v1/**',async route=>{const path=new URL(route.request().url()).pathname;let status=200,value={};
 if(path.endsWith('/session'))value={authenticated:true,csrfToken:'fixture'};
 else if(path.endsWith('/data'))value=data;
 else if(path.endsWith('/version'))value={revision:data.meta.revision};
 else if(path.endsWith('/status'))value={speech:{configured:false,available:false}};
 else if(path.endsWith('/attachments')){uploads++;if(uploads===1){status=503;value={error:'模拟上传断线'}}else value={id:'fixture.png',photo:'attachments/fixture.png'}}
 else if(path.endsWith('/records')){saves++;if(saves===1){status=503;value={error:'模拟保存断线'}}else{saved=route.request().postDataJSON().payload;data.meta.revision++;data.meals.push({...saved,id:'fixture-meal'});value={ok:true}}}
 await route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
 });
 await p.goto(process.env.H5_COMPOSER_URL);await p.locator('#demo-banner.real').waitFor();await p.locator('#quick-text').fill('米饭半碗');await p.locator('#photo-entry').click();await p.locator('#capture-file').setInputFiles({name:'meal.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64')});
 await p.locator('#capture-next').click();await p.locator('#capture-error').filter({hasText:'模拟上传断线'}).waitFor();assert.equal(await p.locator('#capture-note').inputValue(),'米饭半碗');assert.equal(await p.locator('#capture-preview img').count(),1);
 await p.locator('#capture-next').click();await p.locator('#f-note').fill('米饭半碗，汤没喝');await p.locator('[data-nutrient=name]').fill('午饭');await p.locator('#record-form [type=submit]').click();await p.locator('#form-error').filter({hasText:'模拟保存断线'}).waitFor();assert.equal(await p.locator('#f-note').inputValue(),'米饭半碗，汤没喝');assert.equal(await p.locator('#editor img.preview').count(),1);
 await p.locator('#record-form [type=submit]').click();await p.locator('#editor').waitFor({state:'hidden'});assert.equal(saved.photo,'attachments/fixture.png');assert.equal(saved.note,'米饭半碗，汤没喝');assert.equal(uploads,2);assert.equal(data.meals.length,1);
 }finally{await b.close()}
});
