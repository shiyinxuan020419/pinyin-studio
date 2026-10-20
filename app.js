'use strict';
const $=id=>document.getElementById(id);
const STORAGE='xiaoxiang-lesson-editor-v1';
const SYSTEM_TYPOGRAPHY=Object.freeze({baseFontSize:32,baseLineGap:4});
const exampleText='群儿戏于庭，\n一儿登瓮，足跌没水中。\n众皆弃去，光持石击瓮破之，\n水迸，儿得活。\n水迸，儿得活。';
const han=c=>/\p{Script=Han}/u.test(c);
function sample(){const notes={};for(const [c,p] of [['于','yu'],['瓮','wèng'],['跌','diē'],['皆','jiē'],['弃','qì'],['持','chí'],['迸','bèng']]){let n=exampleText.indexOf(c);if(n>=0)notes[n]=p;if(c==='迸')notes[exampleText.lastIndexOf(c)]=p;}return {title:'司马光',body:exampleText,source:'《宋史》节选 · 名人故事',lesson:8,notes:{title:{0:'sī'},body:notes},fontSize:SYSTEM_TYPOGRAPHY.baseFontSize,lineGap:SYSTEM_TYPOGRAPHY.baseLineGap,showPinyin:true,previewProfile:'original',version:2};}
// Preserve lesson content from older drafts while applying the shared typography policy.
let state=sample();try{const s=JSON.parse(localStorage.getItem(STORAGE));if(s&&typeof s.body==='string'&&typeof s.title==='string'&&s.notes?.body&&s.notes?.title){state={...sample(),...s,version:2,previewProfile:LessonViewport.getProfile(s.previewProfile).id,fontSize:SYSTEM_TYPOGRAPHY.baseFontSize,lineGap:SYSTEM_TYPOGRAPHY.baseLineGap};}}catch{}
let selection={field:'body',start:0,end:0},mode='full',saveTimer,toastTimer;
const inputs={title:$('titleInput'),body:$('bodyInput')};
function chars(text){let n=0;return Array.from(text,c=>{const item={c,i:n};n+=c.length;return item;});}
function selectedChars(){return chars(state[selection.field]).filter(({c,i})=>i>=selection.start&&i<selection.end&&han(c));}
function announce(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2400);}
function save(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(STORAGE,JSON.stringify(state));$('saveState').textContent='已自动保存到本机';}catch{$('saveState').textContent='当前浏览器无法保存草稿';}},250);}
function normalizePinyin(value){let s=value.toLowerCase().replace(/u:|v/g,'ü');const m=s.match(/^([a-zü]+)([1-5])$/);if(!m)return s;s=m[1];const tone=+m[2];if(tone===5)return s;let idx=s.indexOf('a');if(idx<0)idx=s.indexOf('e');if(idx<0&&s.includes('ou'))idx=s.indexOf('o');if(idx<0){for(let i=s.length-1;i>=0;i--){if('iouü'.includes(s[i])){idx=i;break;}}}const table={a:'āáǎà',e:'ēéěè',i:'īíǐì',o:'ōóǒò',u:'ūúǔù',ü:'ǖǘǚǜ'};return idx<0?s:s.slice(0,idx)+table[s[idx]][tone-1]+s.slice(idx+1);}
function annotationForm(){const list=selectedChars();$('selectionLabel').replaceChildren();if(list.length){const b=document.createElement('b');b.textContent=list.map(x=>x.c).join('');$('selectionLabel').append('已选择「',b,`」 · ${list.length} 个字`);$('pinyinInput').value=list.map(({i})=>state.notes[selection.field][i]||'').join(' ');}else{$('selectionLabel').textContent='在正文或标题中选字，也可点击预览中的字';$('pinyinInput').value='';}$('applyPinyin').disabled=!list.length;$('removePinyin').disabled=!list.length;$('annotationMessage').textContent='';renderSelection();}
function renderSelection(){document.querySelectorAll('.char[data-index]').forEach(el=>el.classList.toggle('selected',el.dataset.field===selection.field&&+el.dataset.index>=selection.start&&+el.dataset.index<selection.end));}
function captureSelection(field){selection={field,start:inputs[field].selectionStart,end:inputs[field].selectionEnd};annotationForm();}
function remapNotes(oldText,newText,notes){let start=0;while(start<oldText.length&&start<newText.length&&oldText[start]===newText[start])start++;let oldEnd=oldText.length,newEnd=newText.length;while(oldEnd>start&&newEnd>start&&oldText[oldEnd-1]===newText[newEnd-1]){oldEnd--;newEnd--;}const result={};for(const [key,p] of Object.entries(notes)){const i=+key;if(i<start)result[i]=p;else if(i>=oldEnd)result[i+newEnd-oldEnd]=p;}return result;}
function updateText(field,value){state.notes[field]=remapNotes(state[field],value,state.notes[field]);state[field]=value;render();save();}
// Keep rendering and device layout separate from the editor's viewing zoom.
const measureContext = document.createElement('canvas').getContext('2d');
const pinyinWidths = new Map();
let renderRevision = 0;
let lastLayout = null;
let lastBodyRect = '';

function createCharacter({c, i}, field) {
  const cell = document.createElement('span');
  cell.className = 'char';
  const reading = document.createElement('span');
  reading.className = 'reading';
  reading.textContent = state.notes[field][i] || '';
  const glyph = document.createElement('span');
  glyph.className = 'glyph';
  glyph.textContent = c;
  cell.append(reading, glyph);
  if (han(c)) {
    cell.dataset.index = i;
    cell.dataset.field = field;
    cell.setAttribute('role', 'button');
    cell.tabIndex = 0;
    cell.setAttribute('aria-label', `${c}${reading.textContent ? '，拼音 ' + reading.textContent : ''}，编辑拼音`);
    const select = () => {
      selection = {field, start: i, end: i + c.length};
      inputs[field].setSelectionRange(i, i + c.length);
      annotationForm();
      $('pinyinInput').focus();
    };
    cell.addEventListener('click', select);
    cell.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        select();
      }
    });
  }
  return cell;
}

function measurePinyin(text, fontSize) {
  const key = `${fontSize}:${text}`;
  if (!pinyinWidths.has(key)) {
    measureContext.font = `400 ${fontSize}px "ToneOZ-Quicksnow-W400", sans-serif`;
    pinyinWidths.set(key, measureContext.measureText(text).width);
  }
  return pinyinWidths.get(key);
}

function paintTitle() {
  const target = $('titlePreview');
  const tokens = chars(state.title).map(token => ({...token, pinyin: state.notes.title[token.i] || ''}));
  const layout = LessonTitleLayout.layoutTokens(tokens, {width: target.clientWidth, measurePinyin});
  const fragment = document.createDocumentFragment();
  for (const row of layout.lines) {
    for (const token of row.tokens) {
      const cell = createCharacter(token, 'title');
      cell.style.left = `${token.x}px`;
      cell.style.top = `${row.y}px`;
      fragment.append(cell);
    }
  }
  target.style.height = `${layout.height}px`;
  target.replaceChildren(fragment);
  target.dataset.advance = layout.advance;
  target.dataset.rowCount = layout.rowCount;
  target.dataset.layoutReady = 'true';
}

function updateScrollCue() {
  const target = $('articlePreview');
  const moreBelow = target.scrollHeight - target.clientHeight - target.scrollTop > 1;
  target.classList.toggle('has-more-below', moreBelow);
  $('articleScrollHint').hidden = !moreBelow;
}

function paintBody(layout) {
  const target = $('articlePreview');
  const oldScroll = target.scrollTop;
  const viewportHeight = LessonScrollCue.viewportHeight(layout, $('articleBodySlot').clientHeight);
  target.style.height = `${viewportHeight}px`;
  $('articleBodySlot').style.setProperty('--body-visible-height', `${viewportHeight}px`);
  target.style.setProperty('--char-size', `${layout.fontSize}px`);
  target.style.setProperty('--pinyin-size', `${layout.pinyinFontSize}px`);
  target.style.setProperty('--pinyin-gap', `${layout.pinyinGap}px`);
  target.style.setProperty('--row-height', `${layout.lineHeight}px`);
  target.style.setProperty('--line-gap', `${layout.lineGap}px`);
  target.style.fontSize = `${layout.fontSize}px`;
  target.classList.toggle('is-scrollable', layout.overflow);
  target.setAttribute('aria-label', layout.overflow ? '课文预览，可上下滚动查看更多内容' : '课文预览');
  const flow = document.createElement('div');
  flow.className = 'article-flow';
  flow.style.height = `${layout.height}px`;
  for (const row of layout.lines) {
    const line = document.createElement('div');
    line.className = 'article-line';
    line.style.top = `${row.y}px`;
    line.style.height = `${layout.lineHeight}px`;
    for (const token of row.tokens) {
      const cell = createCharacter(token, 'body');
      cell.style.left = `${token.x}px`;
      line.append(cell);
    }
    flow.append(line);
  }
  target.replaceChildren(flow);
  target.scrollTop = oldScroll;
  updateScrollCue();
  target.dataset.fontSize = layout.fontSize;
  target.dataset.rowCount = layout.rowCount;
  target.dataset.layoutReady = 'true';
  $('overflowNotice').hidden = !layout.overflow;
  const status = $('layoutStatus');
  status.dataset.overflow = String(layout.overflow);
  status.textContent = `当前字号 ${layout.fontSize} · ${layout.rowCount} 行 · ${layout.overflow ? '可上下滚动' : '一屏完整'}`;
  $('count').textContent = `${chars(state.body).filter(x => !(/\s/.test(x.c))).length} 字 · 手动 ${state.body.split('\n').length} 行 / 渲染 ${layout.rowCount} 行`;
  lastLayout = layout;
  renderSelection();
}

function scheduleBodyLayout() {
  const revision = ++renderRevision;
  $('articlePreview').dataset.layoutReady = 'false';
  $('titlePreview').dataset.layoutReady = 'false';
  $('layoutStatus').textContent = '正在排版…';
  requestAnimationFrame(async () => {
    // Trigger font requests for newly typed title/body characters before measuring.
    const fontLoads = [
      document.fonts.load('400 18px "ToneOZ-Quicksnow-W400"', 'ā'),
      document.fonts.load('400 32px "AR PL KaitiM GB"', state.body || '字'),
      document.fonts.load('700 72px "Source Han Serif SC VF"', state.title || '字'),
      document.fonts.load('500 24px "Source Han Serif SC VF"', state.source || '字')
    ];
    await Promise.allSettled(fontLoads);
    if (revision !== renderRevision) return;
    paintTitle();
    const target = $('articleBodySlot');
    const rect = {width: target.clientWidth, height: target.clientHeight};
    lastBodyRect = `${rect.width}:${rect.height}`;
    target.closest('.article-top').classList.toggle('no-body-space', rect.width <= 0 || rect.height <= 0);
    if (rect.width <= 0 || rect.height <= 0) {
      const preview = $('articlePreview');
      preview.replaceChildren();
      preview.style.height = '0px';
      preview.classList.remove('is-scrollable', 'has-more-below');
      target.style.setProperty('--body-visible-height', '0px');
      $('articleScrollHint').hidden = true;
      $('overflowNotice').hidden = true;
      $('count').textContent = `${chars(state.body).filter(x => !(/\s/.test(x.c))).length} 字 · 手动 ${state.body.split('\n').length} 行`;
      $('layoutStatus').textContent = '正文区域不足，请缩短标题或来源';
      lastLayout = null;
      renderSelection();
      return;
    }
    const tokens = chars(state.body).map(token => ({...token, pinyin: state.notes.body[token.i] || ''}));
    const measurements = LessonTextLayout.fontCandidates(SYSTEM_TYPOGRAPHY.baseFontSize).map(fontSize =>
      LessonTextLayout.layoutTokens(tokens, {
        width: rect.width,
        fontSize,
        lineGap: SYSTEM_TYPOGRAPHY.baseLineGap * fontSize / SYSTEM_TYPOGRAPHY.baseFontSize,
        measurePinyin
      })
    );
    paintBody(LessonTextLayout.chooseFont(measurements, rect));
  });
}

function render() {
  $('sourcePreview').textContent = state.source;
  $('lessonPreview').textContent = `第 ${state.lesson} 课`;
  $('stage').classList.toggle('no-pinyin', !state.showPinyin);
  LessonViewport.applyProfile($('stage'), state.previewProfile);
  scheduleBodyLayout();
  resizePreview();
}

function syncInputs() {
  inputs.title.value = state.title;
  inputs.body.value = state.body;
  $('sourceInput').value = state.source;
  $('lessonInput').value = state.lesson;
  $('showPinyin').checked = state.showPinyin;
  $('deviceProfile').value = state.previewProfile;
  render();
  annotationForm();
}

function resizePreview() {
  const area = $('canvasArea');
  const viewport = $('stageViewport');
  if (!area.clientWidth || !area.clientHeight) return;
  const frame = LessonViewport.frameFor($('stage'), state.previewProfile, mode);
  const scale = Math.min(area.clientWidth / frame.width, area.clientHeight / frame.height);
  viewport.style.width = `${frame.width * scale}px`;
  viewport.style.height = `${frame.height * scale}px`;
  $('stage').style.transform = `translate(${-frame.x * scale}px, ${-frame.y * scale}px) scale(${scale})`;
  const profile = LessonViewport.getProfile(state.previewProfile);
  $('scaleLabel').textContent = `设计尺寸 ${profile.width} × ${profile.height} · 预览 ${Math.round(scale * 100)}%`;
}

for(const field of ['title','body']){const el=inputs[field];el.addEventListener('input',()=>{updateText(field,el.value);captureSelection(field);});for(const event of ['select','keyup','mouseup','focus'])el.addEventListener(event,()=>captureSelection(field));}
$('sourceInput').addEventListener('input',e=>{state.source=e.target.value;render();save();});$('lessonInput').addEventListener('input',e=>{if(e.target.validity.valid&&e.target.value){state.lesson=+e.target.value;render();save();}});
$('annotationForm').addEventListener('submit',e=>{e.preventDefault();const list=selectedChars();if(!list.length)return;const syllables=$('pinyinInput').value.trim().split(/\s+/).filter(Boolean);if(syllables.length!==list.length){$('annotationMessage').textContent=`已选 ${list.length} 个字，请输入 ${list.length} 个拼音，用空格分隔。`;return;}const readings=syllables.map(normalizePinyin);if(readings.some(p=>!(/^[a-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜêńňǹḿ]{1,12}$/u.test(p)))){$('annotationMessage').textContent='请输入有效的拼音字母，可带声调或结尾声调数字 1–5。';return;}list.forEach(({i},n)=>state.notes[selection.field][i]=readings[n]);render();save();annotationForm();$('annotationMessage').textContent='拼音已更新';});
$('removePinyin').addEventListener('click',()=>{selectedChars().forEach(({i})=>delete state.notes[selection.field][i]);render();save();annotationForm();$('annotationMessage').textContent='已移除所选字的拼音';});
for(const tone of ['ā','á','ǎ','à','ü','ǖ','ǘ','ǚ','ǜ']){const btn=document.createElement('button');btn.type='button';btn.textContent=tone;btn.setAttribute('aria-label','输入 '+tone);btn.addEventListener('click',()=>{const input=$('pinyinInput');const start=input.selectionStart??input.value.length,end=input.selectionEnd??start;input.setRangeText(tone,start,end,'end');input.focus();});document.querySelector('.tone-keys').append(btn);}
$('insertBreak').addEventListener('click',()=>{const pos=inputs.body.selectionEnd;const value=state.body.slice(0,pos)+'\n'+state.body.slice(pos);updateText('body',value);inputs.body.value=value;inputs.body.focus();inputs.body.setSelectionRange(pos+1,pos+1);captureSelection('body');});
$('sentenceBreak').addEventListener('click',()=>{let text='',notes={};const source=chars(state.body);source.forEach(({c,i},n)=>{if(state.notes.body[i])notes[text.length]=state.notes.body[i];text+=c;if(/[。！？!?]/.test(c)&&n<source.length-1&&source[n+1].c!=='\n'&&!/[”’」』]/.test(source[n+1].c))text+='\n';if(/[”’」』]/.test(c)&&n>0&&/[。！？!?]/.test(source[n-1].c)&&n<source.length-1&&source[n+1].c!=='\n')text+='\n';});state.body=text;state.notes.body=notes;inputs.body.value=text;selection={field:'body',start:0,end:0};render();annotationForm();save();announce('已按句号、问号和叹号换行');});
$('showPinyin').addEventListener('change',e=>{state.showPinyin=e.target.checked;render();save();});
function setMode(next){mode=next;$('stageViewport').classList.toggle('text-mode',mode==='text');if(mode==='full')$('stageViewport').style.height='';$('viewFull').classList.toggle('active',mode==='full');$('viewText').classList.toggle('active',mode==='text');$('viewFull').setAttribute('aria-pressed',mode==='full');$('viewText').setAttribute('aria-pressed',mode==='text');$('previewCaption').textContent=mode==='full'?'课节目录 · 整体效果':'课文排版 · 文字特写';resizePreview();}
$('viewFull').onclick=()=>setMode('full');$('viewText').onclick=()=>setMode('text');$('guides').onchange=e=>$('stage').classList.toggle('show-guides',e.target.checked);
$('reset').onclick=()=>{if(!confirm('恢复 Figma 设计稿示例？当前编辑内容将被替换，可先导出配置保存。'))return;state=sample();selection={field:'body',start:0,end:0};syncInputs();save();announce('已恢复设计稿示例');};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify({...state,version:2,layoutPolicy:{...SYSTEM_TYPOGRAPHY,scales:[1,0.9375,0.875],overflow:'scroll'}},null,2)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='小象语文-课文排版.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);announce('已导出文字、拼音和排版配置');};
$('deviceProfile').addEventListener('change', event => {
  state.previewProfile = LessonViewport.getProfile(event.target.value).id;
  render();
  save();
});
new ResizeObserver(resizePreview).observe($('canvasArea'));
new ResizeObserver(() => {
  const target = $('articleBodySlot');
  const size = `${target.clientWidth}:${target.clientHeight}`;
  if (size !== lastBodyRect) scheduleBodyLayout();
}).observe($('articleBodySlot'));
$('articlePreview').addEventListener('scroll', updateScrollCue, {passive: true});
window.addEventListener('resize', resizePreview);
document.fonts.addEventListener('loadingdone', () => {
  pinyinWidths.clear();
  scheduleBodyLayout();
});
syncInputs();
resizePreview();

$('expandPreview').onclick=()=>{const expanded=document.querySelector('.workspace').classList.toggle('preview-expanded');$('expandPreview').textContent=expanded?'返回编辑 ↙':'放大预览 ⤢';$('expandPreview').setAttribute('aria-pressed',expanded);resizePreview();};
