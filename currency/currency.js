const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];

const PRIORITY = ['USD','KRW','CNY','RUB','EUR','AUD','SGD','THB','JPY','GBP'];
const FLAGS = {USD:'🇺🇸',KRW:'🇰🇷',CNY:'🇨🇳',RUB:'🇷🇺',EUR:'🇪🇺',AUD:'🇦🇺',SGD:'🇸🇬',THB:'🇹🇭',JPY:'🇯🇵',GBP:'🇬🇧',CAD:'🇨🇦',CHF:'🇨🇭',HKD:'🇭🇰',INR:'🇮🇳'};
const BOARD = ['USD','KRW','CNY','RUB','EUR'];
const BOARD_COLORS = ['#123d3b','#ff704f','#5b7ca5','#9b6c3f','#7e6aa8'];

const state = {
  rates: [],
  payload: null,
  mode: 'foreign-to-vnd',
  rateType: 'cash_buy',
  currency: 'USD',
  range: '30d',
  history: {},
  boardHistory: {},
  wallet: [{currency:'USD',amount:500},{currency:'CNY',amount:0},{currency:'KRW',amount:0}]
};

function esc(value){
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}
function number(value){
  if(value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/,/g,''));
  return Number.isFinite(n) ? n : null;
}
function formatVnd(value){
  if(!Number.isFinite(value)) return '-';
  return new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(value) + ' ₫';
}
function formatRate(value){
  if(!Number.isFinite(value)) return '-';
  const digits = value < 100 ? 2 : value < 1000 ? 1 : 0;
  return new Intl.NumberFormat('vi-VN',{maximumFractionDigits:digits,minimumFractionDigits:digits}).format(value);
}
function formatAmount(value){
  if(!Number.isFinite(value)) return '-';
  return new Intl.NumberFormat('vi-VN',{maximumFractionDigits:value < 100 ? 2 : 0}).format(value);
}
function parseInput(value){
  const normalized = String(value||'').trim().replace(/s/g,'').replace(/.(?=d{3}(?:\D|$))/g,'').replace(',','.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}
function rate(code){ return state.rates.find(x => x.currency === code); }
function activeRate(){
  const item = rate(state.currency);
  if(!item) return null;
  return state.mode === 'vnd-to-foreign' ? number(item.sell) : number(item[state.rateType]);
}
function freshnessClass(status){
  if(status === 'live') return 'live';
  if(status === 'cached') return 'cached';
  return 'stale';
}
function normalizePayload(payload){
  const rates = (payload.rates || []).map(x => ({
    currency: String(x.currency || x.code || '').toUpperCase(),
    name: x.name || x.currency_name || '',
    cash_buy: number(x.cash_buy ?? x.buy),
    transfer_buy: number(x.transfer_buy ?? x.transfer),
    sell: number(x.sell)
  })).filter(x => x.currency);
  return {...payload, rates};
}
async function getJson(url){
  const response = await fetch(url,{cache:'no-store',headers:{accept:'application/json'}});
  if(!response.ok) throw new Error(url + ' ' + response.status);
  return response.json();
}
async function loadCurrent(){
  const api = $('meta[name="openpq-currency-api"]')?.content || '/api/exchange-rates';
  let payload;
  try{
    payload = normalizePayload(await getJson(api));
  }catch(error){
    console.warn('[Currency] API unavailable, trying snapshot', error);
    payload = normalizePayload(await getJson('../data/currency-snapshot.json'));
  }
  state.payload = payload;
  state.rates = payload.rates || [];
  if(!state.rates.some(x=>x.currency===state.currency) && state.rates.length) state.currency = state.rates[0].currency;
  renderAll();
}
function renderStatus(){
  const badge = $('#sourceBadge');
  const status = state.payload?.data_status || (state.rates.length ? 'cached' : 'unavailable');
  badge.className = 'status-pill ' + freshnessClass(status);
  badge.textContent = status === 'live' ? 'LIVE · VIETCOMBANK' : status === 'cached' ? 'BẢN GẦN NHẤT' : 'CHƯA CÓ DỮ LIỆU';
  const raw = state.payload?.source_updated_at || state.payload?.updated_at;
  $('#updatedAt').textContent = raw ? 'Cập nhật ' + new Date(raw).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'}) : 'Chưa có thời điểm cập nhật';
  $('#sourceDetail').textContent = state.payload?.message || 'Dữ liệu được đọc từ nguồn Vietcombank, cache ngắn và giữ bản gần nhất khi nguồn tạm lỗi.';
}
function renderCurrencyOptions(){
  const options = PRIORITY.filter(code=>rate(code)).map(code => '<option value="'+code+'">'+code+'</option>').join('');
  $('#currencySelect').innerHTML = options || '<option value="USD">USD</option>';
  $('#currencySelect').value = state.currency;
}
function renderQuickAmounts(){
  const sets = {
    USD:[10,50,100,500], EUR:[10,50,100,500], GBP:[10,50,100,500],
    KRW:[100000,500000,1000000,2000000], CNY:[100,500,1000,5000],
    RUB:[1000,5000,10000,50000], JPY:[1000,5000,10000,50000],
    THB:[1000,5000,10000,50000], SGD:[50,100,500,1000], AUD:[50,100,500,1000]
  };
  const values = state.mode === 'vnd-to-foreign' ? [500000,1000000,5000000,10000000] : (sets[state.currency] || [10,50,100,500]);
  $('#quickAmounts').innerHTML = values.map(v => '<button type="button" data-quick="'+v+'">'+formatAmount(v)+'</button>').join('');
}
function renderConverter(){
  const amount = parseInput($('#amountInput').value);
  const item = rate(state.currency);
  const r = activeRate();
  $('#amountLabel').textContent = state.mode === 'foreign-to-vnd' ? 'Số ngoại tệ' : 'Số VND';
  $('#resultLabel').textContent = state.mode === 'foreign-to-vnd' ? 'Bạn nhận khoảng' : 'Bạn mua được khoảng';
  $('#rateTypeRow').hidden = state.mode === 'vnd-to-foreign';
  if(!item || !r){
    $('#convertResult').textContent = '-';
    $('#rateExplanation').textContent = 'Chưa có dữ liệu tỷ giá hợp lệ.';
    return;
  }
  if(state.mode === 'foreign-to-vnd'){
    $('#convertResult').textContent = formatVnd(amount * r);
    $('#rateExplanation').textContent = state.rateType === 'cash_buy' ? 'Theo giá mua tiền mặt Vietcombank.' : 'Theo giá mua chuyển khoản Vietcombank.';
  }else{
    const result = amount / r;
    $('#convertResult').textContent = formatAmount(result) + ' ' + state.currency;
    $('#rateExplanation').textContent = 'Theo giá bán Vietcombank.';
  }
}
function renderRateCards(){
  const items = PRIORITY.map(rate).filter(Boolean);
  $('#rateCards').innerHTML = items.length ? items.map(item => {
    const buy = number(item.cash_buy);
    const sell = number(item.sell);
    const gap = Number.isFinite(buy) && Number.isFinite(sell) ? sell-buy : null;
    return '<article class="rate-card"><button type="button" data-rate-card="'+esc(item.currency)+'">'+
      '<span class="rate-title"><strong>'+esc(item.currency)+'</strong><span class="flag">'+(FLAGS[item.currency]||'')+'</span></span>'+
      '<span class="rate-main">'+formatRate(buy)+' ₫</span>'+
      '<small>Mua tiền mặt</small>'+
      '<small>CK '+formatRate(number(item.transfer_buy))+' · Bán '+formatRate(sell)+'</small>'+
      '<small>'+(Number.isFinite(gap)?'Chênh mua - bán '+formatRate(gap)+' ₫':'Chưa đủ dữ liệu')+'</small>'+
    '</button></article>';
  }).join('') : '<div class="empty-state">Chưa có snapshot tỷ giá. Hệ thống không hiển thị số giả.</div>';
}
function renderCurrencyTabs(){
  const items = PRIORITY.filter(code=>rate(code));
  $('#currencyTabs').innerHTML = items.map(code => '<button type="button" class="'+(code===state.currency?'active':'')+'" data-currency-tab="'+code+'">'+code+'</button>').join('');
}
function rangeDays(range){ return range==='7d'?7:range==='30d'?30:range==='90d'?90:365; }
function historyApiUrl(currencies){
  const base = $('meta[name="openpq-currency-api"]')?.content || '/api/exchange-rates';
  return base.replace(/\/$/,'') + '/history?range=' + encodeURIComponent(state.range) + '&currencies=' + encodeURIComponent(currencies.join(','));
}
async function fetchHistory(currencies){
  const key = state.range + ':' + currencies.join(',');
  if(state.boardHistory[key]) return state.boardHistory[key];
  try{
    const payload = await getJson(historyApiUrl(currencies));
    const rows = payload.points || payload.history || [];
    state.boardHistory[key] = rows;
    return rows;
  }catch(error){
    try{
      const payload = await getJson('../data/currency-history.json');
      const cutoff = Date.now() - rangeDays(state.range)*86400000;
      const wanted = new Set(currencies);
      const rows = (payload.points || []).filter(x => wanted.has(x.currency) && new Date(x.at || x.source_updated_at).getTime() >= cutoff);
      state.boardHistory[key] = rows;
      return rows;
    }catch(fallbackError){
      return [];
    }
  }
}
function valueFromPoint(point){ return number(point.cash_buy ?? point.buy ?? point.transfer_buy); }
function svgLine(points, width, height, pad){
  const clean = points.filter(p=>Number.isFinite(valueFromPoint(p)));
  if(clean.length < 2) return null;
  const values = clean.map(valueFromPoint);
  const min = Math.min(...values), max = Math.max(...values);
  const span = max-min || Math.max(1,max*.01);
  const coords = clean.map((p,i)=>{
    const x = pad + (i/(clean.length-1))*(width-pad*2);
    const y = pad + ((max-valueFromPoint(p))/span)*(height-pad*2);
    return [x,y];
  });
  return {clean,min,max,coords,path:coords.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ')};
}
function renderHistoryChart(points){
  const own = points.filter(p=>p.currency===state.currency).sort((a,b)=>new Date(a.at||a.source_updated_at)-new Date(b.at||b.source_updated_at));
  const geom = svgLine(own,800,260,24);
  const item = rate(state.currency);
  $('#chartPair').textContent = state.currency + ' / VND';
  $('#chartCurrent').textContent = item ? formatRate(number(item.cash_buy))+' ₫' : '-';
  if(!geom){
    $('#historyChart').innerHTML = '<div class="empty-state">Chưa đủ dữ liệu lịch sử cho '+esc(state.currency)+'. Biểu đồ sẽ hình thành khi collector bắt đầu lưu snapshot Vietcombank.</div>';
    $('#chartChange').className='change';
    $('#chartChange').textContent='-';
    return;
  }
  const first=valueFromPoint(geom.clean[0]), last=valueFromPoint(geom.clean[geom.clean.length-1]);
  const pct=first ? (last-first)/first*100 : 0;
  $('#chartChange').className='change '+(pct>0?'up':pct<0?'down':'');
  $('#chartChange').textContent=(pct>0?'+':'')+pct.toFixed(2)+'% · '+state.range.toUpperCase();
  const area = geom.path + ' L '+geom.coords[geom.coords.length-1][0].toFixed(1)+' 236 L '+geom.coords[0][0].toFixed(1)+' 236 Z';
  const firstLabel = new Date(geom.clean[0].at||geom.clean[0].source_updated_at).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'});
  const lastLabel = new Date(geom.clean[geom.clean.length-1].at||geom.clean[geom.clean.length-1].source_updated_at).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'});
  $('#historyChart').innerHTML =
    '<svg viewBox="0 0 800 260" preserveAspectRatio="none" aria-hidden="true">'+
      '<g class="chart-grid"><line x1="24" y1="65" x2="776" y2="65"/><line x1="24" y1="130" x2="776" y2="130"/><line x1="24" y1="195" x2="776" y2="195"/></g>'+
      '<path class="chart-area" d="'+area+'"/><path class="chart-line" d="'+geom.path+'"/>'+
      '<text class="chart-label" x="24" y="252">'+esc(firstLabel)+'</text><text class="chart-label" text-anchor="end" x="776" y="252">'+esc(lastLabel)+'</text>'+
    '</svg>';
}
function renderMetrics(){
  const item=rate(state.currency);
  if(!item){ $('#rateMetrics').innerHTML=''; return; }
  const cash=number(item.cash_buy), transfer=number(item.transfer_buy), sell=number(item.sell);
  const gap=Number.isFinite(cash)&&Number.isFinite(sell)?sell-cash:null;
  $('#rateMetrics').innerHTML=[
    ['Mua tiền mặt',formatRate(cash)+' ₫'],
    ['Mua chuyển khoản',formatRate(transfer)+' ₫'],
    ['Bán',formatRate(sell)+' ₫'],
    ['Chênh mua - bán',Number.isFinite(gap)?formatRate(gap)+' ₫':'-']
  ].map(x=>'<div class="metric"><span>'+x[0]+'</span><strong>'+x[1]+'</strong></div>').join('');
}
function renderBoard(points){
  const grouped={};
  for(const p of points){
    if(!BOARD.includes(p.currency)) continue;
    (grouped[p.currency]||(grouped[p.currency]=[])).push(p);
  }
  const width=800,height=260,pad=24;
  const series=[];
  for(const code of BOARD){
    const rows=(grouped[code]||[]).sort((a,b)=>new Date(a.at||a.source_updated_at)-new Date(b.at||b.source_updated_at));
    const first=rows.find(x=>Number.isFinite(valueFromPoint(x)));
    if(!first) continue;
    const base=valueFromPoint(first);
    const normalized=rows.map(x=>({...x,normalized:base?valueFromPoint(x)/base*100:null})).filter(x=>Number.isFinite(x.normalized));
    if(normalized.length>=2) series.push({code,rows:normalized});
  }
  if(!series.length){
    $('#marketBoard').innerHTML='<div class="empty-state">Chartboard cần lịch sử của ít nhất một đồng tiền. Không tạo dữ liệu minh họa giả.</div>';
    $('#boardLegend').innerHTML='';
    return;
  }
  const all=series.flatMap(s=>s.rows.map(x=>x.normalized));
  const min=Math.min(...all),max=Math.max(...all),span=max-min||1;
  const paths=series.map((s,idx)=>{
    const coords=s.rows.map((row,i)=>[
      pad+(i/(s.rows.length-1))*(width-pad*2),
      pad+((max-row.normalized)/span)*(height-pad*2)
    ]);
    const path=coords.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
    return '<path class="board-line" stroke="'+BOARD_COLORS[idx]+'" d="'+path+'"/>';
  }).join('');
  const baseY=pad+((max-100)/span)*(height-pad*2);
  $('#marketBoard').innerHTML='<svg viewBox="0 0 800 260" preserveAspectRatio="none" aria-hidden="true"><line x1="24" x2="776" y1="'+baseY.toFixed(1)+'" y2="'+baseY.toFixed(1)+'" stroke="#b9cbc7" stroke-dasharray="5 6"/>'+paths+'</svg>';
  $('#boardLegend').innerHTML=series.map((s,idx)=>{
    const last=s.rows[s.rows.length-1].normalized;
    return '<span><i class="board-dot" style="background:'+BOARD_COLORS[idx]+'"></i>'+s.code+' '+(last>=100?'+':'')+(last-100).toFixed(2)+'%</span>';
  }).join('');
}
function walletOptions(selected){
  return PRIORITY.filter(code=>rate(code)).map(code=>'<option value="'+code+'" '+(code===selected?'selected':'')+'>'+code+'</option>').join('');
}
function renderWallet(){
  $('#walletRows').innerHTML=state.wallet.map((row,index)=>{
    const item=rate(row.currency), buy=item?number(item.cash_buy):null;
    const value=Number.isFinite(buy)?row.amount*buy:null;
    return '<div class="wallet-row" data-wallet-index="'+index+'">'+
      '<select data-wallet-currency>'+walletOptions(row.currency)+'</select>'+
      '<input data-wallet-amount inputmode="decimal" value="'+(row.amount||'')+'" placeholder="Số tiền">'+
      '<strong>'+formatVnd(value)+'</strong>'+
      '<button type="button" data-wallet-remove aria-label="Xóa">×</button>'+
    '</div>';
  }).join('');
  let total=0,has=false;
  state.wallet.forEach(row=>{const buy=number(rate(row.currency)?.cash_buy);if(Number.isFinite(buy)&&row.amount){total+=row.amount*buy;has=true;}});
  $('#walletTotal').textContent=has?formatVnd(total):'-';
}
function renderAll(){
  renderStatus();
  renderCurrencyOptions();
  renderQuickAmounts();
  renderConverter();
  renderRateCards();
  renderCurrencyTabs();
  renderMetrics();
  renderWallet();
  refreshCharts();
}
async function refreshCharts(){
  const history=await fetchHistory([state.currency]);
  renderHistoryChart(history);
  const board=await fetchHistory(BOARD);
  renderBoard(board);
}
function setMode(mode){
  state.mode=mode;
  $$('.mode').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  if(mode==='vnd-to-foreign' && parseInput($('#amountInput').value)<10000) $('#amountInput').value='1000000';
  if(mode==='foreign-to-vnd' && parseInput($('#amountInput').value)>100000) $('#amountInput').value='100';
  renderQuickAmounts();renderConverter();
}
function setCurrency(code){
  state.currency=code;
  $('#currencySelect').value=code;
  renderQuickAmounts();renderConverter();renderCurrencyTabs();renderMetrics();refreshCharts();
}
document.addEventListener('click',event=>{
  const mode=event.target.closest('[data-mode]'); if(mode) setMode(mode.dataset.mode);
  const type=event.target.closest('[data-rate-type]'); if(type){state.rateType=type.dataset.rateType;$$('.rate-type').forEach(b=>b.classList.toggle('active',b===type));renderConverter();}
  const quick=event.target.closest('[data-quick]'); if(quick){$('#amountInput').value=quick.dataset.quick;renderConverter();}
  const card=event.target.closest('[data-rate-card]'); if(card) setCurrency(card.dataset.rateCard);
  const tab=event.target.closest('[data-currency-tab]'); if(tab) setCurrency(tab.dataset.currencyTab);
  const range=event.target.closest('[data-range]'); if(range){state.range=range.dataset.range;$$('[data-range]').forEach(b=>b.classList.toggle('active',b===range));refreshCharts();}
  if(event.target.closest('#addWalletRow')){const first=PRIORITY.find(code=>rate(code))||'USD';state.wallet.push({currency:first,amount:0});renderWallet();}
  const remove=event.target.closest('[data-wallet-remove]'); if(remove){const row=remove.closest('[data-wallet-index]');state.wallet.splice(Number(row.dataset.walletIndex),1);renderWallet();}
});
$('#amountInput').addEventListener('input',renderConverter);
$('#currencySelect').addEventListener('change',event=>setCurrency(event.target.value));
$('#walletRows').addEventListener('input',event=>{
  const row=event.target.closest('[data-wallet-index]'); if(!row) return;
  const i=Number(row.dataset.walletIndex);
  if(event.target.matches('[data-wallet-amount]')) state.wallet[i].amount=parseInput(event.target.value);
  if(event.target.matches('[data-wallet-currency]')) state.wallet[i].currency=event.target.value;
  renderWallet();
});
$('#walletRows').addEventListener('change',event=>{
  if(event.target.matches('[data-wallet-currency]')){
    const row=event.target.closest('[data-wallet-index]');state.wallet[Number(row.dataset.walletIndex)].currency=event.target.value;renderWallet();
  }
});

const params=new URLSearchParams(location.search);
const qAmount=Number(params.get('amount'));
const qFrom=(params.get('from')||'').toUpperCase();
if(Number.isFinite(qAmount)&&qAmount>0) $('#amountInput').value=String(qAmount);
if(PRIORITY.includes(qFrom)) state.currency=qFrom;

loadCurrent().catch(error=>{
  console.error(error);
  state.payload={data_status:'unavailable',message:'Không đọc được Vietcombank hoặc snapshot dự phòng lúc này.'};
  state.rates=[];
  renderAll();
});
