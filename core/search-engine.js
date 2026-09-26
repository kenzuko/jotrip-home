/* Open Phu Quoc Search Engine v1 */
(function(global){
  let documents=[];

  const currencyAliases={
    usd:'USD',dollar:'USD',do:'USD',
    eur:'EUR',euro:'EUR',
    gbp:'GBP',pound:'GBP',
    jpy:'JPY',yen:'JPY',
    aud:'AUD',
    sgd:'SGD',
    thb:'THB',baht:'THB',
    cad:'CAD',
    chf:'CHF',
    hkd:'HKD',
    cny:'CNY',rmb:'CNY',yuan:'CNY',
    inr:'INR',rupee:'INR',
    krw:'KRW',won:'KRW',
    rub:'RUB',ruble:'RUB'
  };

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

  function amountNumber(raw,multiplier){
    let text=String(raw||'').trim();
    if(/^\d{1,3}([.,]\d{3})+$/.test(text)) text=text.replace(/[.,]/g,'');
    else text=text.replace(',','.');
    const value=Number(text);
    if(!Number.isFinite(value)||value<=0) return null;
    return value*(multiplier||1);
  }

  function currencyQuickDoc(rawQuery){
    const original=String(rawQuery||'').trim();
    const q=fold(original);
    let match=q.match(/^(\d[\d.,]*)\s*(trieu|nghin|k|m)?\s*([a-z]+)\b/);
    let code=null,amount=null;

    if(match){
      const unit=match[2];
      const multiplier=unit==='trieu'||unit==='m'?1000000:unit==='nghin'||unit==='k'?1000:1;
      code=currencyAliases[match[3]]||null;
      amount=amountNumber(match[1],multiplier);
    }

    if(!code && /\$/.test(original)){
      const money=original.match(/(\d[\d.,]*)\s*\$/);
      if(money){code='USD';amount=amountNumber(money[1],1);}
    }

    if(!code||!amount) return null;
    const label=new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2}).format(amount);
    return {
      id:'currency_quick_'+code+'_'+String(amount).replace('.','_'),
      type:'currency',
      title:'Đổi '+label+' '+code+' sang VND',
      aliases:[],
      zone_id:null,
      intents:['currency','utility'],
      related_entities:[],
      route:'/currency/?amount='+encodeURIComponent(amount)+'&from='+encodeURIComponent(code),
      search_text:q,
      synthetic:true
    };
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
    const currencyIntent=doc.type==='currency' && (
      q.includes('ty gia') || q.includes('doi tien') || q.includes('exchange rate') ||
      tokens.some(token=>currencyAliases[token])
    );

    if(tokens.length>1 && !currencyIntent){
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

  function rankedDocs(query){
    return documents
      .map(doc=>{
        const match=score(doc,query);
        const area=global.OpenPQArea?.get?.()||"all";
        const zone=global.OpenPQArea?.zone?.(area)||null;
        // Preference, not a hard geographic filter. Exact named matches still win.
        const nearby=match>0&&zone&&doc.zone_id===zone&&["place","activity","venue"].includes(doc.type);
        const town=match>0&&area==="place_sunset_town"&&/sunset town|thị trấn hoàng hôn/i.test([doc.title,...(doc.aliases||[])].join(" "));
        return {doc,score:match+(nearby?10:0)+(town?6:0)};
      })
      .filter(item=>item.score>0)
      .sort((a,b)=>b.score-a.score || String(a.doc.title).localeCompare(String(b.doc.title),'vi'));
  }

  function search(query,limit){
    const max=Number.isFinite(Number(limit))?Number(limit):8;
    const quick=currencyQuickDoc(query);
    const out=[];const seen=new Set();
    for(const doc of [quick,...rankedDocs(query).map(item=>item.doc)]){
      if(!doc||seen.has(doc.id)) continue;
      seen.add(doc.id);out.push(doc);
      if(out.length>=max) break;
    }
    return out;
  }

  function searchGrouped(query,limit){
    const max=Number.isFinite(Number(limit))?Number(limit):10;
    const quick=currencyQuickDoc(query);
    const ranked=rankedDocs(query);
    if(!ranked.length) return quick?[{id:'quick',label:'Tính nhanh',items:[quick]}]:[];

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
      if(!seen.has(doc.id)){seen.add(doc.id);pool.push(doc);}
    }

    const groups=[
      {id:'quick',label:'Tính nhanh',items:quick?[quick]:[]},
      {id:'main',label:'Kết quả chính',items:[]},
      {id:'experience',label:'Điểm đến & trải nghiệm',items:[]},
      {id:'live',label:'Kiểm tra trước khi đi',items:[]},
      {id:'utility',label:'Tiện ích nhanh',items:[]},
      {id:'price',label:'Giá tham khảo',items:[]},
      {id:'guide',label:'Cẩm nang & lịch trình',items:[]},
      {id:'related',label:'Liên quan',items:[]}
    ];
    for(const doc of pool){
      let id='related';
      if(doc.id===primary.id) id='main';
      else if(doc.type==='place'||doc.type==='activity') id='experience';
      else if(doc.type==='live') id='live';
      else if(doc.type==='currency'||doc.type==='utility') id='utility';
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
