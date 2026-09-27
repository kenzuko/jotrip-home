(() => {
  'use strict';
  const names={vi:'Tiếng Việt',en:'English',ko:'한국어',ru:'Русский',lo:'ລາວ',zh:'简体中文','zh-TW':'繁體中文',fr:'Français'};
  const unavailable={en:'Translation is incomplete. Some content may appear in Vietnamese.',ko:'번역이 아직 완성되지 않아 일부 내용은 베트남어로 표시됩니다.',ru:'Перевод пока не завершён. Часть текста может быть на вьетнамском языке.',lo:'ຍັງບໍ່ມີຄໍາແປທີ່ກວດສອບແລ້ວ. ໜ້ານີ້ສະແດງເປັນພາສາຫວຽດ.',zh:'译文尚未完成。部分内容可能显示越南语。','zh-TW':'譯文尚未完成。部分內容可能顯示越南語。',fr:'La traduction est incomplète. Certains contenus restent en vietnamien.'};
  const normalize=value=>{
    const tag=String(value||'').toLowerCase();
    if(tag.startsWith('zh'))return /(?:tw|hk|mo|hant)/.test(tag)?'zh-TW':'zh';
    const base=tag.split('-')[0];return Object.hasOwn(names,base)?base:'vi';
  };
  let stored;
  try{stored=localStorage.getItem('openpq-language')}catch{}
  const requested=new URLSearchParams(location.search).get('lang');
  const locale=normalize(requested||stored||navigator.languages?.[0]||navigator.language);
  if(requested&&Object.hasOwn(names,requested))try{localStorage.setItem('openpq-language',requested)}catch{}
  window.OpenPQLanguage={locale,names,normalize};
  const select=document.createElement('select');
  select.className='openpq-language-select';
  select.setAttribute('aria-label','Ngôn ngữ / Language');
  for(const [code,label] of Object.entries(names)){
    const option=document.createElement('option');option.value=code;option.textContent=label;select.append(option);
  }
  select.value=locale;
  select.addEventListener('change',()=>{
    try{localStorage.setItem('openpq-language',select.value)}catch{}
    const url=new URL(location.href);url.searchParams.set('lang',select.value);location.assign(url);
  });
  const style=document.createElement('style');
  style.textContent='.openpq-language-select{position:fixed;z-index:1000;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));max-width:126px;padding:8px;border:1px solid #bdcdc4;border-radius:9px;background:#fff;color:#204435;font:500 13px/1.2 system-ui;box-shadow:0 2px 12px #0002}.openpq-language-note{position:fixed;z-index:999;right:12px;bottom:calc(53px + env(safe-area-inset-bottom));max-width:260px;padding:9px 12px;border-radius:8px;background:#f7f9f6;color:#274337;font:13px/1.35 system-ui;box-shadow:0 2px 12px #0002}';
  document.head.append(style);document.body.append(select);
  // Static page translations are loaded only from reviewed catalogs.
  if(locale==='vi'||location.pathname.startsWith('/stories/'))return;
  const fallback=()=>{
    const note=document.createElement('div');note.className='openpq-language-note';
    note.textContent=unavailable[locale];document.body.append(note);setTimeout(()=>note.remove(),8000);
  };
  fetch('/data/i18n/'+encodeURIComponent(locale)+'/site-ui.json',{cache:'default'}).then(r=>r.ok?r.json():null).then(catalog=>{
    const path=location.pathname.replace(/\/index\.html$/,'/');
    const entries=catalog?.pages?.[path];
    if(!entries||catalog.status!=='published'){
      fallback();return;
    }
    const normalizeText=value=>value.replace(/\s+/g,' ').trim();
    const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    const nodes=[];while(walk.nextNode())nodes.push(walk.currentNode);
    for(const node of nodes){
      if(node.parentElement?.closest('script,style,textarea,code,.openpq-language-select,.openpq-language-note'))continue;
      const original=normalizeText(node.nodeValue),translated=entries[original];
      if(original&&typeof translated==='string'&&translated.trim())node.nodeValue=node.nodeValue.replace(node.nodeValue.trim(),translated);
    }
    for(const element of document.body.querySelectorAll('[alt],[placeholder],[title],[aria-label]')){
      if(element===select)continue;
      for(const attr of ['alt','placeholder','title','aria-label']){
        const source=element.getAttribute(attr),value=entries[normalizeText(source||'')];
        if(source&&typeof value==='string'&&value.trim())element.setAttribute(attr,value);
      }
    }
    document.documentElement.lang=locale;
  }).catch(fallback);
})();
