/* Open Phu Quoc Search Engine v1 */
(function(global){
  let documents=[];

  function fold(value){
    return String(value||'')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/đ/g,'d')
      .replace(/Đ/g,'D')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,' ')
      .trim();
  }

  function score(doc, rawQuery){
    const q=fold(rawQuery);
    if(!q) return 0;
    const title=fold(doc.title);
    const aliases=(doc.aliases||[]).map(fold);
    const hay=fold(doc.search_text||'');
    const tokens=q.split(/\s+/).filter(Boolean);
    const allText=fold([doc.title,...(doc.aliases||[]),doc.search_text||''].join(' '));
    const allWords=new Set(allText.split(/\s+/).filter(Boolean));
    const titleWords=new Set(title.split(/\s+/).filter(Boolean));
    const hayWords=new Set(hay.split(/\s+/).filter(Boolean));
    let s=0;
    const asksPrice=/(^|\s)(gia|ve|ticket|combo)(\s|$)/.test(q);

    if(tokens.length>1){
      const hasShortToken=tokens.some(token=>token.length<=2);
      if(hasShortToken && !allText.includes(q)) return 0;
      if(!allText.includes(q) && !tokens.every(token=>allWords.has(token))) return 0;
    }

    if(title===q) s+=200;
    else if(title.startsWith(q)) s+=130;
    else if(title.includes(q)) s+=95;

    if(aliases.some(a=>a===q)) s+=150;
    else if(aliases.some(a=>a.startsWith(q))) s+=100;
    else if(aliases.some(a=>a.includes(q))) s+=65;

    if(hay.includes(q)) s+=60;
    for(const token of tokens){
      if(titleWords.has(token)) s+=22;
      if(hayWords.has(token)) s+=10;
    }
    if(s>0){
      if(asksPrice && doc.type==='price_reference') s+=90;
      if(!asksPrice && doc.type==='price_reference') s-=55;
      if(!asksPrice && (doc.type==='place'||doc.type==='activity')) s+=30;
    }
    return s;
  }

  async function load(url){
    const response=await fetch(url,{cache:'no-store'});
    if(!response.ok) throw new Error('search-index '+response.status);
    const payload=await response.json();
    documents=Array.isArray(payload.documents)?payload.documents:[];
    return documents.length;
  }

  function search(query,limit){
    const max=Number.isFinite(Number(limit))?Number(limit):8;
    return documents
      .map(doc=>({doc,score:score(doc,query)}))
      .filter(item=>item.score>0)
      .sort((a,b)=>b.score-a.score || String(a.doc.title).localeCompare(String(b.doc.title),'vi'))
      .slice(0,max)
      .map(item=>item.doc);
  }

  function searchGrouped(query,limit){
    const max=Number.isFinite(Number(limit))?Number(limit):10;
    const ranked=documents
      .map(doc=>({doc,score:score(doc,query)}))
      .filter(item=>item.score>0)
      .sort((a,b)=>b.score-a.score || String(a.doc.title).localeCompare(String(b.doc.title),'vi'));
    if(!ranked.length) return [];

    const top=ranked[0].doc;
    const linkedPrimary=top.type==='price_reference'
      ? documents.find(doc=>(top.related_entities||[]).includes(doc.id)&&(doc.type==='place'||doc.type==='activity'))
      : null;
    const primary=linkedPrimary||ranked.find(x=>x.doc.type==='place'||x.doc.type==='activity')?.doc||top;
    const clusterIds=new Set([primary.id,...(primary.related_entities||[])]);
    const connected=documents.filter(doc=>
      clusterIds.has(doc.id) ||
      (doc.type==='price_reference'&&(doc.related_entities||[]).some(id=>clusterIds.has(id))) ||
      (primary.zone_id && doc.type==='live' && doc.zone_id===primary.zone_id)
    );
    const pool=[];const seen=new Set();
    for(const doc of [primary,...connected,...ranked.map(x=>x.doc)]){
      if(!seen.has(doc.id)){seen.add(doc.id);pool.push(doc)}
    }

    const groups=[
      {id:'main',label:'Kết quả chính',items:[]},
      {id:'experience',label:'Điểm đến & trải nghiệm',items:[]},
      {id:'live',label:'Kiểm tra trước khi đi',items:[]},
      {id:'price',label:'Giá tham khảo',items:[]},
      {id:'guide',label:'Cẩm nang & lịch trình',items:[]},
      {id:'related',label:'Liên quan',items:[]}
    ];
    for(const doc of pool){
      let id='related';
      if(doc.id===primary.id) id='main';
      else if(doc.type==='place'||doc.type==='activity') id='experience';
      else if(doc.type==='live') id='live';
      else if(doc.type==='price_reference') id='price';
      else if(['itinerary','history','culture','practical','access','island_basic'].includes(doc.type)) id='guide';
      const group=groups.find(x=>x.id===id);
      if(group.items.length<(id==='experience'?3:2)) group.items.push(doc);
    }
    let remaining=max;
    return groups.map(group=>{
      const items=group.items.slice(0,remaining);
      remaining-=items.length;
      return{...group,items};
    }).filter(group=>group.items.length);
  }

  global.OpenPQSearch={load,search,searchGrouped,fold,get size(){return documents.length;}};
})(window);
