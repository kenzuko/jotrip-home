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
    let s=0;

    if(title===q) s+=200;
    else if(title.startsWith(q)) s+=130;
    else if(title.includes(q)) s+=95;

    if(aliases.some(a=>a===q)) s+=150;
    else if(aliases.some(a=>a.startsWith(q))) s+=100;
    else if(aliases.some(a=>a.includes(q))) s+=65;

    if(hay.includes(q)) s+=60;
    for(const token of tokens){
      if(title.includes(token)) s+=22;
      if(hay.includes(token)) s+=10;
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

  global.OpenPQSearch={load,search,fold,get size(){return documents.length;}};
})(window);
