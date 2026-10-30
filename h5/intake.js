/* One intake draft: image + words -> AI cards -> explicit atomic confirmation. */
(function(root){
'use strict';
const names={meal:'饮食',body:'体测',activity:'活动',workout:'运动',supp:'补剂'};
const slots={breakfast:'早餐',lunch:'午餐',dinner:'晚餐',snack:'加餐'};
function missing(d){const p=d.payload||{},q=[];
 if(d.kind==='meal'){if(!slots[p.slot])q.push('这是早餐、午餐、晚餐还是加餐？');if(!p.items?.length||p.items.some(i=>!i.name?.trim()))q.push('请补充吃了什么')}
 if(d.kind==='body'){if(!(p.weightKg>0))q.push('请补充体重');if(!['fasting','bedtime'].includes(p.measureMode))q.push('这是早晨空腹，还是晚上睡前测量？')}
 if(d.kind==='workout'&&(!p.type||!(p.durationMin>0)))q.push('请补充运动类型和实际时长');
 if(d.kind==='activity'&&!['steps','distanceKm','activeKcal','totalKcal','sleepMin','restingHr','hrvMs','spo2','sleepScore','hrAvg','hrMax','deepSleepMin','remSleepMin','lightSleepMin','awakeMin','standHours'].some(k=>p[k]!==null&&p[k]!==undefined))q.push('请补充至少一项活动数据');
 if(d.kind==='supp'&&!p.name?.trim())q.push('请补充补剂名称');return q;
}
function summary(d){const p=d.payload||{};
 if(d.kind==='meal')return (p.items||[]).map(i=>i.name).join('、')+'\n'+(p.totals?.kcal!=null?'估算约 '+p.totals.kcal+' 千卡':'热量暂不能确定，先记下吃了什么');
 if(d.kind==='body')return [['weightKg','体重','kg'],['bodyFatPct','体脂','%'],['muscleKg','肌肉','kg']].filter(([k])=>p[k]!=null).map(([k,n,u])=>n+' '+p[k]+' '+u).join(' · ')||'等待补充体测数据';
 if(d.kind==='activity')return [['steps','步数','步'],['sleepMin','睡眠','分钟'],['activeKcal','活动消耗','千卡'],['totalKcal','全天消耗','千卡'],['distanceKm','距离','km']].filter(([k])=>p[k]!=null).map(([k,n,u])=>n+' '+p[k]+' '+u).join(' · ')||'已提取活动数据，可展开核对';
 if(d.kind==='workout')return [p.typeLabel||p.type,p.durationMin!=null?p.durationMin+' 分钟':'时长待补充',p.kcal!=null?p.kcal+' 千卡':''].filter(Boolean).join(' · ');
 return [p.name,p.dose,p.timing].filter(Boolean).join(' · ');
}
function open(options){
 const {state,api,modal,head,esc,uid,openEditor,voiceInto,refresh,onDemoSave,onSaved}=options;
 const draft=state.capture;const $=s=>document.querySelector(s);let busy=false;
 function invalidate(){draft.requestId=null;draft.pendingConfirm=null}
 function stale(){return draft.fingerprint!==JSON.stringify([state.quickText,draft.photo||draft.preview||'',draft.date])}
 function controls(value){busy=value;draft.uploading=value;document.querySelectorAll('#intake input,#intake textarea,#intake button,#intake select').forEach(e=>e.disabled=value||!!draft.pendingConfirm);const close=$('#editor .close');if(close)close.disabled=value;if(!value)$('#capture-next').disabled=!(draft.pendingConfirm||!state.voiceBusy)}
 function error(message){$('#capture-error').textContent=message}
 function render(){
  const cards=draft.drafts||[];(options.mount||modal)(`${options.mount?(cards.length?'<h2 class="intake-title">我帮你整理好了</h2>':''):head(cards.length?'我帮你整理好了':'拍下来，说两句')}<div id="intake">${cards.length?'<p class="subtext">核对下面的记录，没问题就记下。</p>':''}${cards.length?'<details id="capture-original"><summary>图片与说明 · 点此补充</summary>':'<section id="capture-original">'}<div id="capture-preview">${draft.preview?`<img class="preview" src="${esc(draft.preview)}" alt="待记录图片">`:''}</div><input id="capture-file" class="intake-file" aria-label="拍照或选择图片" type="file" accept="image/*"><button type="button" class="secondary wide photo-picker" id="photo-entry">▣ ${draft.preview?'更换图片':'拍照 / 选择图片'}</button><label for="capture-note">补充说明（可选）</label><textarea id="capture-note" placeholder="例如：今天午饭，米饭只吃了一半">${esc(state.quickText)}</textarea><div id="capture-voice"></div><details class="record-options"><summary>记录日期 · ${esc(draft.date)}</summary><label for="capture-date">没有明确日期时，记录为</label><input id="capture-date" type="date" value="${esc(draft.date)}"></details>${cards.length?'</details>':'</section>'}<div id="draft-cards">${cards.map((d,i)=>`<section class="ai-card"><div class="row"><h3>${esc(d.kind==='meal'?slots[d.payload.slot]||'饮食':names[d.kind])}</h3><span class="tag">${d.kind==='meal'?'AI 估算':'待核对'}</span></div><p class="ai-summary">${esc(summary(d))}</p><small class="subtext">${esc(d.payload.date)}${d.kind==='body'?' · '+({fasting:'早晨空腹',bedtime:'晚上睡前'}[d.payload.measureMode]||'时段待确认'):''}</small>${missing(d).map(q=>`<p class="ai-question">${esc(q)}</p>`).join('')}${d.kind==='meal'&&!slots[d.payload.slot]?`<div class="actions">${Object.entries(slots).map(([v,n])=>`<button type="button" class="secondary" data-answer="${i}" data-field="slot" data-value="${v}">${n}</button>`).join('')}</div>`:''}${d.kind==='body'&&!d.payload.measureMode?`<div class="actions"><button type="button" class="secondary" data-answer="${i}" data-field="measureMode" data-value="fasting">早晨空腹</button><button type="button" class="secondary" data-answer="${i}" data-field="measureMode" data-value="bedtime">晚上睡前</button></div>`:''}<button type="button" class="link" data-detail="${i}">查看 / 修改详细数据</button></section>`).join('')}</div>${draft.message?`<p class="hint">${esc(draft.message)}</p>`:''}<div id="capture-error" class="error" role="alert"></div>${cards.length?'<button type="button" class="secondary wide" id="revise-toggle">改一下，说说哪里不对</button><div id="revise-panel" hidden><label for="revision-text">怎么改？</label><textarea id="revision-text" placeholder="例如：这是晚餐，鸡肉只吃了一半"></textarea><button type="button" class="secondary wide" id="revise-submit">按我的说明重新整理</button></div>':''}<button type="button" class="primary wide" id="capture-next">${draft.needsRefresh?'读取最新数据并重新整理':draft.pendingConfirm?'重试确认保存':cards.length&&!stale()?'确认记下'+(cards.length>1?'这 '+cards.length+' 条':''):'AI 帮我整理一下'}</button><p class="hint">${cards.length?'AI 结果请核对；餐食营养为估算，不替代专业建议。':'识别结果会先给你核对，确认前不会写入健康记录。'}</p><details id="manual-tools"><summary>手动记录</summary><p class="hint">暂时不能识别时，可以手动填写。</p><div class="quick-grid">${Object.entries(names).map(([k,n])=>`<button type="button" class="secondary" data-manual="${k}">${n}</button>`).join('')}</div></details>${state.mode==='demo'?'<details id="demo-examples"><summary>体验虚构示例</summary><p class="hint">仅示例展示 AI 确认流程，不会识别上传的图片或调用真实模型。</p><div class="actions"><button type="button" class="secondary" id="sample-meal">餐食示例</button><button type="button" class="secondary" id="sample-scale">体测示例</button><button type="button" class="secondary" id="sample-multi">多条记录示例</button></div></details>':''}</div>`);
  voiceInto('#capture-note',$('#capture-voice'));$('#photo-entry').onclick=()=>$('#capture-file').click();
  function inputChanged(){invalidate();$('#capture-next').textContent='重新整理后再确认';error('说明或日期已变化，请重新整理。')}
  $('#capture-note').oninput=e=>{state.quickText=e.target.value;inputChanged()};$('#capture-date').onchange=e=>{draft.date=e.target.value;inputChanged()};
  $('#capture-file').onchange=e=>{const f=e.target.files[0];if(!f)return;if(!f.type.startsWith('image/'))return error('请选择图片');if(f.size>20*1024*1024)return error('图片不能超过20MB');if(draft.preview)URL.revokeObjectURL(draft.preview);draft.file=f;draft.photo=null;draft.preview=URL.createObjectURL(f);invalidate();$('#capture-preview').innerHTML=`<img class="preview" src="${esc(draft.preview)}" alt="待记录图片">`;$('#capture-next').textContent='AI 帮我整理一下';error('')};
  $('#capture-next').onclick=async()=>{if(busy||state.voiceBusy)return;if(draft.pendingConfirm){await confirmDrafts();return}if(draft.needsRefresh){controls(true);try{await refresh(true);draft.needsRefresh=false;draft.fingerprint=null;draft.revision=state.data.meta.revision;controls(false);render();await recognize()}catch(e){controls(false);error(e.message)}return}if(cards.length&&!stale())await confirmDrafts();else await recognize()};
  $('#revise-toggle')?.addEventListener('click',()=>{$('#revise-panel').hidden=!$('#revise-panel').hidden;$('#revision-text').value=draft.revisionText||''});
  $('#revision-text')?.addEventListener('input',e=>draft.revisionText=e.target.value);
  $('#revise-submit')?.addEventListener('click',()=>recognize($('#revision-text').value));
  document.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>{draft.drafts[Number(b.dataset.answer)].payload[b.dataset.field]=b.dataset.value;invalidate();render()});
  document.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.detail),d=draft.drafts[i];openEditor(d.kind,null,{...d.payload,preview:draft.preview,photo:draft.photo,onDraft:p=>{draft.drafts[i]={kind:d.kind,payload:p,questions:[]};invalidate();render()}})});
  document.querySelectorAll('[data-manual]').forEach(b=>b.onclick=()=>openEditor(b.dataset.manual,null,{date:draft.date,preview:draft.preview,note:state.quickText,fromCapture:true,pendingFile:draft.file,photo:draft.photo}));
  for(const [id,kind]of [['sample-meal','meal'],['sample-scale','body'],['sample-multi','multi']])$('#'+id)?.addEventListener('click',()=>sample(kind));
  if(draft.pendingConfirm){controls(false);error('上次确认未得到明确回执，请重试确认；同一次请求不会重复记账。')}
 }
 async function upload(){if(draft.file&&!draft.photo&&state.mode==='real'){const fd=new FormData();fd.append('file',draft.file);const r=await api('/attachments',{method:'POST',body:fd});draft.photo=r.photo||'attachments/'+r.id}}
 async function recognize(correction=''){
  if(busy||state.voiceBusy)return;if(state.mode==='demo'){error('演示空间不调用真实 AI。请展开“体验虚构示例”，或登录私人空间使用已配置的模型。');return}
  if(!draft.file&&!draft.photo&&!state.quickText.trim())return error('请先上传图片或写一句说明');
  controls(true);error('正在整理，请稍等…');
  try{const status=await api('/status');if(!status.model?.available)throw new Error('图片理解模型尚未配置，暂时不能自动整理。图片和说明已保留，可展开“手动记录”。');await upload();const r=await api('/recognize',{method:'POST',body:JSON.stringify({photo:draft.photo,note:state.quickText,date:draft.date,correction,previousDrafts:correction?draft.drafts||[]:[]})});if(!Array.isArray(r.drafts)||r.drafts.length>6)throw new Error('识别结果格式有误，请重试');draft.drafts=r.drafts;draft.message=r.message||'';draft.revision=state.data.meta.revision;draft.revisionText='';draft.fingerprint=JSON.stringify([state.quickText,draft.photo||draft.preview||'',draft.date]);invalidate();controls(false);render();if(!r.drafts.length)error(r.message||'没有识别出健康记录，请补充说明或换一张清晰图片。')}catch(e){controls(false);error(e.message)}
 }
 async function confirmDrafts(){
  if(!draft.pendingConfirm&&draft.drafts.some(d=>missing(d).length))return error('还有需要补充的内容，请点选答案，或点“改一下”告诉我。');
  controls(true);error('正在保存…');
  try{
   if(state.mode==='demo')onDemoSave(draft.drafts);
   else{draft.pendingConfirm ||= {drafts:draft.drafts.map(d=>({kind:d.kind,payload:d.payload})),expectedRevision:draft.revision,requestId:draft.requestId ||= uid()};await api('/records/batch',{method:'POST',body:JSON.stringify(draft.pendingConfirm)});}
   controls(false);onSaved();
  }catch(e){controls(false);if(e.status===409){draft.pendingConfirm=null;draft.needsRefresh=true;render();error('其他地方更新了数据，草稿仍保留。请读取最新数据，重新整理并核对。')}else if(e.status===400){draft.pendingConfirm=null;render();error(e.message)}else{render();error(e.message+' 请重试确认，同一次请求不会重复保存。')}}
 }
 function sample(kind){const meal={kind:'meal',payload:{date:draft.date,slot:'lunch',title:'【演示】鸡胸米饭',confidence:'estimated',items:[{name:'鸡胸肉、半份米饭、蔬菜',kcal:450,proteinG:30}],totals:{kcal:450,proteinG:30},note:'内置虚构示例，非图片识别结果'}};const body={kind:'body',payload:{date:draft.date,weightKg:70.2,bodyFatPct:21.8,measureMode:'fasting',note:'内置虚构示例，非图片识别结果'}};draft.drafts=kind==='multi'?[meal,body]:[kind==='meal'?meal:body];draft.message='虚构示例，仅用于体验确认流程。';draft.fingerprint=JSON.stringify([state.quickText,draft.photo||draft.preview||'',draft.date]);invalidate();render()}
 draft.date ||= options.today;render();
}
const exported={open,summary,missing};if(typeof module!=='undefined'&&module.exports)module.exports=exported;else root.HealthIntake=exported;
})(typeof window==='undefined'?globalThis:window);
