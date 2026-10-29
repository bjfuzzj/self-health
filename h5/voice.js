/* Voice belongs to the current composer; raw audio stays in memory only. */
(function(root){
'use strict';
function appendTranscript(note,text){const value=String(text||'').trim();return value?(note?note+'\n':'')+value:note}
function mount({element,api,mode,onText,onBusy=()=>{}}){
 element.innerHTML='<button type="button" class="secondary wide voice-start">🎙 语音补充</button><div class="voice-actions"><button type="button" class="secondary voice-cancel" hidden>取消录音</button><button type="button" class="secondary voice-retry" hidden>重试转写</button></div><p class="hint voice-status" role="status" aria-live="polite">说完后转成文字，可修改后再保存。</p>';
 const start=element.querySelector('.voice-start'),cancel=element.querySelector('.voice-cancel'),retry=element.querySelector('.voice-retry'),status=element.querySelector('.voice-status');
 let stream,recorder,timer,blob,chunks=[],generation=0,disposed=false,phase='idle';
 const message=text=>{if(!disposed)status.textContent=text};
 const release=()=>{clearTimeout(timer);stream?.getTracks().forEach(t=>t.stop());stream=null};
 function busy(value){onBusy(value);start.disabled=value;cancel.hidden=!value;retry.hidden=true}
 function reset(){generation++;phase='idle';if(recorder?.state==='recording'){recorder.onstop=null;recorder.stop()}release();blob=null;chunks=[];if(!disposed){busy(false);start.textContent='🎙 语音补充';cancel.hidden=true;retry.hidden=true}}
 async function transcribe(){const epoch=generation;phase='transcribing';busy(true);message('正在转成文字，请稍等…');try{const fd=new FormData();fd.append('file',blob,'voice.'+(blob.type.includes('mp4')?'mp4':blob.type.includes('ogg')?'ogg':'webm'));const result=await api('/speech/transcriptions',{method:'POST',body:fd});if(disposed||epoch!==generation)return;if(typeof result.text!=='string'||!result.text.trim())throw new Error('没有听清内容，请重新录音');onText(result.text);blob=null;message('已追加到说明，请核对后保存。');retry.hidden=true}catch(e){if(disposed||epoch!==generation)return;message(e.message+' 图片和文字仍保留。');retry.hidden=!blob}finally{if(!disposed&&epoch===generation){phase='idle';onBusy(false);start.disabled=false;start.textContent='🎙 再说一句';cancel.hidden=!blob}}}
 start.onclick=async()=>{
  if(phase==='recording'){phase='stopping';start.disabled=true;recorder.stop();release();return}
  if(phase!=='idle')return;
  const epoch=++generation;phase='checking';busy(true);
  try{
   if(mode==='demo')throw new Error('语音服务尚未配置，演示空间不上传录音。可使用手机键盘的语音输入');
   const s=await api('/status');if(disposed||epoch!==generation)return;
   if(!s.speech?.available)throw new Error('语音识别 API 尚未配置，请先使用手机键盘的语音输入');
   if(!root.isSecureContext||!root.navigator.mediaDevices?.getUserMedia||!root.MediaRecorder)throw new Error('当前浏览器不支持网页录音，请使用手机键盘的语音输入');
   phase='permission';message('请允许使用麦克风…');
   const acquired=await root.navigator.mediaDevices.getUserMedia({audio:true});
   if(disposed||epoch!==generation){acquired.getTracks().forEach(t=>t.stop());return}stream=acquired;
   const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>root.MediaRecorder.isTypeSupported(t));
   recorder=new root.MediaRecorder(stream,mime?{mimeType:mime}:{});chunks=[];blob=null;let bytes=0;
   recorder.ondataavailable=e=>{if(disposed||epoch!==generation)return;if(e.data.size){bytes+=e.data.size;chunks.push(e.data)}if(bytes>6*1024*1024){reset();message('录音超过 6 MB，请分成几句再说')}};
   recorder.onerror=()=>{reset();message('录音失败，图片和文字仍保留，请重试')};
   recorder.onstop=()=>{release();if(disposed||epoch!==generation)return;blob=new Blob(chunks,{type:recorder.mimeType||mime||'audio/webm'});chunks=[];if(!blob.size){reset();message('没有录到声音，请重试');return}transcribe()};
   recorder.start(1000);phase='recording';start.disabled=false;start.textContent='■ 结束并转文字';message('正在录音，再点一下结束（最长 60 秒）。');timer=setTimeout(()=>start.click(),60000);
  }catch(e){if(!disposed&&epoch===generation){reset();message(e.name==='NotAllowedError'?'麦克风未获授权。图片和文字仍保留，可在浏览器设置中开启权限。':e.message)}}
 };
 cancel.onclick=()=>{reset();message('已取消，本次语音未加入说明。图片和文字仍保留。')};
 retry.onclick=()=>{if(blob&&phase==='idle')transcribe()};
 return ()=>{disposed=true;reset();onBusy(false)};
}
const exports={appendTranscript,mount};if(typeof module!=='undefined'&&module.exports)module.exports=exports;else root.HealthVoice=exports;
})(typeof window==='undefined'?globalThis:window);
