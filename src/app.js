import {tpoCandidates, powerCandidates, powerSignature, vehicleKey, catalogBrand, catalogEngine, cleanPowerCatalog} from './catalogs.js';
import {standaloneQuote, standaloneResult, PREFERENCE_KEYS, UTIL_KEYS, utilSignature, readListing, parseRates} from './standalone.js';
import {listingURL, embeddedJSON, matchTpo, tpoEngine, listingMatchesId} from './encar-import.js';
import {utilization} from './encar-util.js';

// TPO_TABLE and APP_CSS are bundled by scripts/build.mjs.
const HOST_ID = 'vector-encar-calculator-v2';
if (!document.getElementById(HOST_ID)) startCalculator();

function startCalculator() {
  const host = document.createElement('div');
  host.id = HOST_ID;
  // Isolated styles prevent Encar's CSS from breaking the calculator.
  const shadow = host.attachShadow({mode:'open'});
  const style = document.createElement('style'); style.textContent = APP_CSS; shadow.append(style);
  const launcher = document.createElement('button'); launcher.className='launcher';
  launcher.innerHTML='Рассчитать стоимость <small>VECTOR</small>'; launcher.hidden=true;
  const dialog=document.createElement('dialog');dialog.setAttribute('aria-labelledby','calc-title');
  dialog.innerHTML=`<div class="frame">
    <header class="top"><div><div class="eyebrow">VECTOR / ENCAR</div><h1 id="calc-title">Стоимость до Воронежа</h1><p>Корея → Бишкек → Воронеж</p></div><button class="close" aria-label="Закрыть калькулятор" title="Закрыть">×</button></header>
    <div class="body"><p class="notice" id="notice" role="status">Загружаю объявление…</p><div class="layout">
    <div class="inputs">
      <section class="section"><h2><span>01</span>Автомобиль</h2><div class="grid" id="car-fields"></div><p class="muted" id="listing-status"></p><div class="tools"><button class="btn" id="reread">Обновить из объявления</button></div></section>
      <section class="section"><h2><span>02</span>Цена и расходы</h2><div class="grid" id="cost-fields"></div></section>
      <section class="section"><h2><span>03</span>Курсы валют</h2><div class="grid" id="rate-fields"></div><p class="muted" id="rate-status"></p><div class="tools"><button class="btn" id="rates">Обновить курсы ЦБ</button></div></section>
      <section class="section"><h2><span>04</span>ТПО / растаможка в Бишкеке</h2><label class="field">Поиск в таблице ТПО<input id="table-search" placeholder="Например: BMW X5 2024" type="search"></label><label class="field" style="margin-top:12px">Стоимость по таблице<select id="table-row"><option value="">Не выбрана</option></select></label><p class="muted" id="table-status"></p><div id="table-suggestions" class="suggestions"></div><div class="grid" id="tpo-fields" style="margin-top:12px"></div><p class="muted">ТПО = стоимость в евро × 48% × курс EUR/USD. Ручная сумма ТПО заменяет расчёт по таблице.</p></section>
      <section class="section"><h2><span>05</span>Утилизационный сбор</h2><div class="grid" id="util-fields"></div><div id="power-suggestions" class="suggestions"></div><details class="catalog-tools"><summary>Справочник мощности</summary><p class="muted">Начальная база: GLE 450 d Coupé, Корея, 2025 год. Можно загрузить дополнительные записи JSON со ссылками на источники. Подтверждённые значения запоминаются в этом браузере.</p><label class="field">Загрузить справочник JSON<input type="file" id="power-file" accept=".json,application/json"></label><button class="btn" id="forget-catalogs">Забыть сохранённые соответствия</button><p class="muted" id="catalog-status"></p></details><p class="hint pending" id="util-suggestion"></p><button class="btn full" id="confirm-util">Подтвердить утильсбор</button><p class="muted">Ставки из калькулятора CRM за 2026 год. Для авто 2023 года проверьте точный возраст на дату уплаты. Для особых условий и гибридов укажите подтверждённую сумму вручную.</p></section>
    </div>
    <aside class="summary"><div class="total"><small>СТОИМОСТЬ В ВОРОНЕЖЕ</small><strong id="total-rub">—</strong><div class="usd" id="total-usd">Заполните недостающие данные</div><div class="sub" id="subtotal">Расчёт с вашими расходами</div></div><section class="section"><h2>Расшифровка расчёта</h2><div class="breakdown" id="breakdown"></div><ul class="missing" id="missing"></ul><button class="btn primary full" id="copy" disabled>Копировать расчёт</button><p class="status" id="copy-status"></p></section><section class="section details-summary"><h2>Ваши настройки</h2><p class="muted">Скидку, расходы и курсы можно сохранить как исходные значения для следующих автомобилей.</p><button class="btn full" id="save-settings">Сохранить настройки</button><p class="muted">Правки текущего расчёта сохраняются автоматически в этом браузере отдельно для каждого объявления.</p></section></aside>
    </div></div><footer class="footer"><strong id="footer-car">Объявление Encar</strong><span class="chip">v2.1.0 · автономно</span></footer>
    </div>`;
  shadow.append(launcher,dialog);document.body.append(host);
  const $=id=>shadow.getElementById(id);
  const fmt=v=>v==null||!Number.isFinite(Number(v))?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(v));
  const inputs=new Map();
  let q=standaloneQuote(), activeId='', currentPath='', revision=0, importRun=0, rateRun=0, manualRevision=0;
  let busyImport=false,busyRates=false,dirty=new Set(),savedTimer,sourceNames=[];

  function field(container,key,label,kind='number',options=null) {
    const wrap=document.createElement('label');wrap.className='field';wrap.append(document.createTextNode(label));
    const el=document.createElement(options?'select':'input');
    if (options) for(const [value,text] of options) {const o=document.createElement('option');o.value=value;o.textContent=text;el.append(o);}
    else {el.type=kind;if(kind==='number'){el.min='0';el.step='any';}el.placeholder=['manualTpo','utilRub'].includes(key)?'Автоматически':'Не указано';}
    el.dataset.key=key;
    el.addEventListener('input',()=>{
      q[key]=el.value;dirty.add(key);manualRevision++;
      if(UTIL_KEYS.includes(key))q.utilConfirmed='';
      if(['brand','model','trim','engine','year'].includes(key)) {
        // Never reuse a tariff or a confirmed fee after changing the vehicle identity.
        q.tableId='';q.eur='';q.manualTpo='';
        for(const field of ['eur','tableId','manualTpo'])dirty.delete(field);
        q.utilConfirmed='';q.utilRub='';if(key==='year')q.utilAge='';
        sourceNames=[];clearCatalogPower();tryMatch();tryPower();
      }
      if(key==='powerHp'){q.powerOrigin='manual';q.powerReference=null;q.powerConfirmed='';q.powerSource='Вручную';}
      if(key==='eur'){q.tableId='';dirty.add('tableId');}
      if(['usdRub','krwPerUsd','eurUsd'].includes(key)){q.rateSource='Вручную';q.rateDate='';}
      syncOtherFields(key);scheduleSave();renderResult();
    });
    wrap.append(el);$(container).append(wrap);inputs.set(key,el);
  }
  for(const [k,l] of [['brand','Марка'],['model','Модель'],['trim','Модификация'],['year','Год выпуска'],['vin','VIN'],['mileage','Пробег, км']])field('car-fields',k,l,['year','mileage'].includes(k)?'number':'text');
  for(const [k,l] of [['krw','Цена Encar, ₩'],['discountPct','Скидка / возврат, %'],['koreaKrw','Расходы Корея → Бишкек, ₩'],['bishkekUsd','Брокер в Бишкеке, $'],['deliveryUsd','Доставка до Воронежа, $'],['markupPct','Надбавка к переводу в ₽, %'],['documentsRub','Документы, ₽']])field('cost-fields',k,l);
  for(const [k,l] of [['krwPerUsd','Вонов за 1 доллар'],['usdRub','Рублей за 1 доллар'],['eurUsd','Долларов за 1 евро']])field('rate-fields',k,l);
  field('tpo-fields','eur','Стоимость по таблице, €');field('tpo-fields','manualTpo','ТПО вручную, $');
  field('util-fields','engine','Фактический объём, см³');field('util-fields','powerHp','Мощность, л.с.');
  field('util-fields','powertrain','Тип двигателя','text',[['','Выберите тип'],['ice','ДВС'],['other','Гибрид / электро / другой']]);
  field('util-fields','utilAge','Возраст на дату уплаты','text',[['','Подтвердите возраст'],['new','Не более 3 лет'],['old','Более 3 лет']]);
  field('util-fields','utilRegime','Режим ввоза','text',[['standard','Стандартная ставка'],['personal','Личный ввоз / особые условия']]);
  field('util-fields','utilYear','Год уплаты');field('util-fields','eaeuRub','Доплата ЕАЭС, ₽');field('util-fields','utilRub','Утильсбор вручную, ₽');
  inputs.get('discountPct').max='100';inputs.get('markupPct').max='100';

  function settings(){try{return GM_getValue('vector-encar:settings:v2',{})||{};}catch{return {};}}
  function notice(text,error=false){$('notice').textContent=text;$('notice').classList.toggle('error',error);}
  function saveDraft(){if(!activeId)return;try{GM_setValue('vector-encar:quote:v2:'+activeId,{q,at:new Date().toISOString()});}catch{notice('Не удалось сохранить черновик в браузере. Текущий расчёт доступен; скопируйте его.',true);}}
  function scheduleSave(){clearTimeout(savedTimer);savedTimer=setTimeout(saveDraft,300);}
  function syncOtherFields(except){for(const [k,el] of inputs)if(k!==except)el.value=q[k]??'';if(!q.tableId)$('table-row').value='';}
  function sync(){syncOtherFields();populateTable();renderResult();}
  function readStore(key,fallback){try{return GM_getValue('vector-encar:'+key,fallback)??fallback;}catch{return fallback;}}
  function writeStore(key,value){try{GM_setValue('vector-encar:'+key,value);return true;}catch{notice('Не удалось сохранить справочник в браузере.',true);return false;}}
  function matches(){return tpoCandidates(q,sourceNames,TPO_TABLE,readStore('tpo-links:v1',{}));}
  function tryMatch(){if(dirty.has('eur')||dirty.has('tableId')||q.tableId)return;const row=matches().automatic;if(row){q.eur=row.eur;q.tableId=row.id;}}
  function rowLabel(row){return `${row.brand} ${row.model} · ${row.year} · ${row.engine} см³ · ${fmt(row.eur)} €`;}
  function chooseTpo(row){
    q.tableId=row?.id||'';q.eur=row?.eur??'';q.manualTpo='';dirty.add('tableId');dirty.add('eur');manualRevision++;
    const links=readStore('tpo-links:v1',{}),key=vehicleKey(q);delete links[key];
    if(row&&catalogBrand(row.brand)===catalogBrand(q.brand)&&String(row.year)===String(q.year)&&catalogEngine(row.engine)===catalogEngine(q.engine))links[key]={id:row.id,eur:row.eur};
    writeStore('tpo-links:v1',links);sync();scheduleSave();
  }
  function clearCatalogPower(){if(q.powerOrigin==='catalog'){q.powerHp='';q.powerOrigin='';q.powerSource='';q.powerReference=null;q.powerConfirmed='';dirty.delete('powerHp');}}
  function powerRows(){return [...Object.values(readStore('power-links:v1',{})),...readStore('power-catalog:v1',[]),...POWER_CATALOG];}
  function proposePower(candidate){
    q.powerHp=candidate.row.powerHp;q.powerOrigin='catalog';q.powerConfirmed='';q.utilConfirmed='';
    q.powerSource=candidate.row.source;q.powerReference={...candidate,identity:vehicleKey(q)};
  }
  function tryPower(){
    if(q.powerOrigin==='catalog'&&q.powerReference?.identity!==vehicleKey(q))clearCatalogPower();
    if(q.powerHp!==''&&q.powerHp!=null||dirty.has('powerHp'))return;
    const candidates=powerCandidates(q,powerRows());if(candidates.length===1)proposePower(candidates[0]);
  }
  function renderSuggestions(){
    const box=$('table-suggestions');box.replaceChildren();
    if(!q.tableId&&!dirty.has('eur')&&q.manualTpo===''){
      const candidates=matches().candidates;
      if(candidates.length){const label=document.createElement('p');label.className='muted';label.textContent='Найдены подходящие строки. Подтвердите применимость:';box.append(label);}
      for(const candidate of candidates){const btn=document.createElement('button');btn.className='btn full';btn.textContent='Подтвердить: '+rowLabel(candidate.row);btn.title=candidate.reason;btn.addEventListener('click',()=>chooseTpo(candidate.row));const reason=document.createElement('p');reason.className='muted';reason.textContent=candidate.reason;box.append(btn,reason);}
    }
    const powerBox=$('power-suggestions');powerBox.replaceChildren();
    const pending=q.powerOrigin==='catalog'&&q.powerConfirmed!==powerSignature(q);
    inputs.get('powerHp').classList.toggle('power-pending',pending);
    inputs.get('powerHp').setAttribute('aria-describedby','power-suggestions');
    if(q.powerOrigin==='catalog'&&q.powerReference){
      const ref=q.powerReference, p=document.createElement('p');p.className='hint'+(pending?' pending':'');
      p.textContent=(pending?'Предлагаемая мощность: ':'Мощность подтверждена: ')+fmt(q.powerHp)+' л.с. Данные о мощности двигателя. '+ref.reason;
      const a=document.createElement('a');a.textContent=ref.row.source;a.href=ref.row.sourceUrl;a.target='_blank';a.rel='noopener noreferrer';
      const btn=document.createElement('button');btn.id='confirm-power';btn.className='btn full';btn.textContent=pending?'Подтвердить мощность для этого автомобиля':'✓ Мощность подтверждена';btn.disabled=!pending;
      btn.addEventListener('click',()=>{
        q.powerConfirmed=powerSignature(q);q.utilConfirmed='';dirty.add('powerHp');manualRevision++;
        const links=readStore('power-links:v1',{});links[vehicleKey(q)]={...ref.row,identity:vehicleKey(q),source:ref.row.source};writeStore('power-links:v1',links);scheduleSave();renderResult();
      });powerBox.append(p,a,btn);
    }else if(!q.powerHp){
      const candidates=powerCandidates(q,powerRows()),p=document.createElement('p');p.className='muted';p.textContent=candidates.length?'Есть несколько значений мощности. Выберите подходящий источник, затем подтвердите.':'Мощность для этой модификации в справочнике пока не найдена. Введите её вручную или загрузите справочник.';powerBox.append(p);
      for(const candidate of candidates){const btn=document.createElement('button');btn.className='btn full';btn.textContent=fmt(candidate.row.powerHp)+' л.с. · '+candidate.row.source+' · '+candidate.reason;btn.addEventListener('click',()=>{proposePower(candidate);sync();scheduleSave();});powerBox.append(btn);}
    }else if(q.powerSource){const p=document.createElement('p');p.className='muted';p.textContent='Мощность: '+q.powerSource;powerBox.append(p);}
  }
  function populateTable(){
    const words=$('table-search').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const rows=TPO_TABLE.filter(r=>r.id===q.tableId||words.every(w=>[r.brand,r.model,r.engine,r.year].join(' ').toLowerCase().includes(w)));
    const select=$('table-row');select.replaceChildren();const blank=document.createElement('option');blank.value='';blank.textContent='Выберите строку или введите стоимость ниже';select.append(blank);
    for(const r of rows){const o=document.createElement('option');o.value=r.id;o.textContent=`${r.brand} ${r.model} · ${r.engine} см³ · ${r.year} · ${fmt(r.eur)} €`;select.append(o);}select.value=q.tableId||'';
  }
  $('table-search').addEventListener('input',populateTable);
  $('table-row').addEventListener('change',()=>chooseTpo(TPO_TABLE.find(r=>r.id===$('table-row').value)));
  $('power-file').addEventListener('change',async()=>{
    const file=$('power-file').files?.[0];if(!file)return;const rev=revision;
    try{if(file.size>2000000)throw new Error('Файл должен быть меньше 2 МБ');const rows=cleanPowerCatalog(JSON.parse(await file.text()));if(rev!==revision)return;
      if(!writeStore('power-catalog:v1',rows))return;clearCatalogPower();tryPower();sync();scheduleSave();$('catalog-status').textContent='Загружено записей: '+rows.length;
    }catch(e){$('catalog-status').textContent='Не удалось загрузить: '+e.message;}finally{$('power-file').value='';}
  });
  $('forget-catalogs').addEventListener('click',()=>{
    if(!window.confirm('Удалить запомненные соответствия ТПО, мощности и загруженный справочник? Текущий расчёт останется.'))return;
    const results=[writeStore('tpo-links:v1',{}),writeStore('power-links:v1',{}),writeStore('power-catalog:v1',[])];
    if(results.every(Boolean)){$('catalog-status').textContent='Сохранённые соответствия удалены.';renderResult();}
  });

  function lines(r){return [
    ['Автомобиль после скидки',r.discountedKrw,'₩'],['До Бишкека с расходами',r.priceUsd,'$'],['ТПО / растаможка',r.tpo,'$'],['Брокер',q.bishkekUsd===''?null:q.bishkekUsd,'$'],['Доставка до Воронежа',q.deliveryUsd===''?null:q.deliveryUsd,'$'],['Итого валютная часть',r.subtotalUsd,'$'],['Надбавка к переводу',r.markupRub,'₽'],['Документы',q.documentsRub===''?null:q.documentsRub,'₽'],['Утильсбор',r.util?.rub,'₽']
  ];}
  function renderResult(){
    renderSuggestions();
    const r=standaloneResult(q),u=utilization(q);
    $('total-rub').textContent=r.rub==null?'Заполните данные':fmt(r.rub)+' ₽';
    $('total-rub').style.fontSize=r.rub==null?'23px':'';
    $('total-usd').textContent=r.usd==null?'Итог появится после проверки всех сумм':'≈ '+fmt(r.usd)+' $';
    $('subtotal').textContent=r.beforeUtilRub==null?'Предварительная стоимость по вашим параметрам':'Без утильсбора: '+fmt(r.beforeUtilRub)+' ₽';
    $('breakdown').replaceChildren();
    for(const [label,value,currency] of lines(r)){const d=document.createElement('div');d.className='line';const l=document.createElement('span');l.textContent=label;const b=document.createElement('b');b.textContent=fmt(value)+' '+currency;d.append(l,b);$('breakdown').append(d);}
    $('missing').replaceChildren();for(const reason of [...new Set(r.missing)]){const li=document.createElement('li');li.textContent=reason;$('missing').append(li);}
    $('copy').disabled=r.rub==null;
    const confirmed=q.utilConfirmed===utilSignature(q), manual=q.utilRub!==''&&q.utilRub!=null;
    $('util-suggestion').textContent=u.rub==null?u.reason:manual?'Указано вручную: '+fmt(u.rub)+' ₽':(confirmed?'Подтверждено: ':'Предлагаемый сбор: ')+fmt(u.rub)+' ₽';
    $('util-suggestion').classList.toggle('pending',!manual&&!confirmed);
    $('confirm-util').disabled=u.rub==null||manual||confirmed||(q.powerOrigin==='catalog'&&q.powerConfirmed!==powerSignature(q));
    $('confirm-util').textContent=manual?'Применена ручная сумма':confirmed?'✓ Утильсбор подтверждён':'Подтвердить утильсбор';
    $('confirm-util').classList.toggle('confirmed',manual||confirmed);
    const rounded=tpoEngine(q.engine),row=TPO_TABLE.find(x=>x.id===q.tableId);
    const yearExists=TPO_TABLE.some(x=>x.year===String(q.year));
    $('table-status').textContent=(row?'Выбрана строка '+row.id+'. ':!yearExists&&q.year?'В таблице CRM нет '+q.year+' года. Введите стоимость в евро или ТПО вручную. ':'Таблица CRM: 690 строк, 2024–2026. Точное совпадение выбирается автоматически. ')+(rounded?'Объём для ТПО: '+fmt(rounded)+' см³.':'');
    const stale=q.rateDate&&Date.now()-Date.parse(q.rateDate)>7*86400000;
    $('rate-status').textContent=q.rateSource?(q.rateSource+(q.rateDate?' · '+q.rateDate:'')+(stale?' · Курс старше 7 дней, обновите или проверьте.':'')+' Курсы покупки можно указать вручную.'):'Укажите курсы или загрузите справочные курсы ЦБ.';
    $('footer-car').textContent=[q.brand,q.trim||q.model,q.year].filter(Boolean).join(' · ')||'Encar № '+activeId;
    $('copy-status').textContent='';
  }
  $('confirm-util').addEventListener('click',()=>{if(utilization(q).rub!=null&&(q.powerOrigin!=='catalog'||q.powerConfirmed===powerSignature(q))){q.utilConfirmed=utilSignature(q);manualRevision++;scheduleSave();renderResult();}});
  $('copy').addEventListener('click',()=>{
    const r=standaloneResult(q);if(r.rub==null)return;
    const text=['VECTOR / ENCAR — стоимость до Воронежа',[q.brand,q.model,q.trim,q.year].filter(Boolean).join(' '),q.url,'',...lines(r).map(([label,value,currency])=>label+': '+fmt(value)+' '+currency),'','ИТОГО: '+fmt(r.rub)+' ₽ (≈ '+fmt(r.usd)+' $)',`Курсы: ${fmt(q.krwPerUsd)} ₩/$; ${fmt(q.usdRub)} ₽/$; ${fmt(q.eurUsd)} $/€`,q.rateSource+(q.rateDate?' · '+q.rateDate:''),'Предварительный расчёт по введённым параметрам.'].join('\n');
    try{GM_setClipboard(text,'text');$('copy-status').textContent='Расчёт скопирован.';}catch{$('copy-status').textContent='Не удалось скопировать. Повторите попытку.';}
  });
  $('save-settings').addEventListener('click',()=>{const r=Object.fromEntries(PREFERENCE_KEYS.map(k=>[k,q[k]]));try{GM_setValue('vector-encar:settings:v2',r);notice('Настройки сохранены для следующих автомобилей.');}catch{notice('Не удалось сохранить настройки.',true);}});

  function requestJSON(url){return new Promise((resolve,reject)=>{
    GM_xmlhttpRequest({method:'GET',url,headers:{Accept:'application/json'},timeout:12000,
      onload:r=>{try{if(r.status!==200||String(r.responseText||'').length>2000000)throw new Error();resolve(JSON.parse(r.responseText));}catch{reject(new Error('Источник не предоставил данные'));}},
      onerror:()=>reject(new Error('Ошибка соединения')),ontimeout:()=>reject(new Error('Истекло время ожидания')),onabort:()=>reject(new Error('Запрос отменён'))});
  });}
  async function rates(force=false){
    if(busyRates)return;busyRates=true;$('rates').disabled=true;
    const thisRun=++rateRun, rev=revision, manualRev=manualRevision;
    try{
      const r=parseRates(await requestJSON('https://www.cbr-xml-daily.ru/daily_json.js'));
      if(rev!==revision||thisRun!==rateRun)return;
      if(manualRevision!==manualRev){notice('Курсы получены, но во время загрузки вы изменили расчёт. Нажмите обновление ещё раз, если хотите применить их.');return;}
      for(const k of ['usdRub','eurUsd','krwPerUsd'])if(force||!q[k])q[k]=r[k];
      q.rateDate=r.rateDate;q.rateSource=r.rateSource;sync();scheduleSave();
    }catch{if(rev===revision)notice('Курсы не загрузились. Укажите их вручную или повторите обновление.',true);}
    finally{if(thisRun===rateRun){busyRates=false;$('rates').disabled=false;}}
  }
  $('rates').addEventListener('click',()=>rates(true));

  function pageListing(id,url){
    for(const script of document.scripts){if(!script.textContent.includes('__PRELOADED_STATE__'))continue;try{
      const data=embeddedJSON(script.textContent);const base=data.cars?.base;
      if(!listingMatchesId(base,id))continue;
      return readListing(data,id,url,TPO_TABLE);
    }catch{}}
    return null;
  }
  async function importListing(){
    if(busyImport||!activeId)return;
    busyImport=true;$('reread').disabled=true;const rev=revision,thisRun=++importRun,id=activeId,url=q.url;
    notice('Читаю данные открытого объявления…');
    try {
      let data=pageListing(id,url);
      if(!data){const raw=await requestJSON('https://api.encar.com/v1/readside/vehicle/'+id);data=readListing(raw,id,url,TPO_TABLE);}
      if(rev!==revision||thisRun!==importRun)return;
      sourceNames=data.names;
      const keys=['brand','model','trim','year','vin','mileage','krw','engine','powerHp','powerSource','powertrain','fuel','market','tableId','eur'];
      for(const k of keys)if(!dirty.has(k))q[k]=data.quote[k];
      tryMatch();tryPower();sync();scheduleSave();
      const missing=[];if(!q.powerHp)missing.push('Мощность не указана в доступных данных — введите л.с.');if(!q.tableId&&q.manualTpo==='')missing.push('Проверьте стоимость для ТПО.');if(!q.utilAge)missing.push('Подтвердите возраст для утильсбора.');
      $('listing-status').textContent='Прочитано из Encar № '+id+' · '+new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})+'.';
      notice('Объявление загружено. '+missing.join(' '));
    }catch{if(rev===revision)notice('Не удалось прочитать объявление. Дождитесь загрузки Encar и нажмите «Обновить из объявления» или заполните поля вручную.',true);}
    finally{if(thisRun===importRun){busyImport=false;$('reread').disabled=false;}}
  }
  $('reread').addEventListener('click',()=>{
    if(dirty.size&&!window.confirm('Обновить данные автомобиля из объявления? Ваши правки характеристик, цены, ТПО и утильсбора будут заменены; курсы и расходы сохранятся.'))return;
    for(const k of ['brand','model','trim','year','vin','mileage','krw','engine','powerHp','powerSource','powertrain','fuel','market','tableId','eur'])dirty.delete(k);
    clearCatalogPower();q.utilConfirmed='';q.utilAge='';q.utilRub='';q.manualTpo='';importListing();
  });
  function open(){if(activeId&&!dialog.open){dialog.showModal();dialog.querySelector('.close').focus();}}
  launcher.addEventListener('click',open);dialog.querySelector('.close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  if(typeof GM_registerMenuCommand==='function')GM_registerMenuCommand('Открыть расчёт VECTOR / Encar',open);
  function navigate(){
    if(location.pathname===currentPath)return;
    currentPath=location.pathname;clearTimeout(savedTimer);saveDraft();revision++;importRun++;rateRun++;
    busyImport=false;busyRates=false;$('reread').disabled=false;$('rates').disabled=false;
    let link;try{link=listingURL(location.href);}catch{activeId='';launcher.hidden=true;if(dialog.open)dialog.close();return;}
    activeId=link.id;launcher.hidden=false;dirty=new Set();sourceNames=[];manualRevision=0;
    q={...standaloneQuote(settings()),url:link.url,encarId:link.id};
    let saved;try{saved=GM_getValue('vector-encar:quote:v2:'+activeId,null);}catch{}
    const restored=saved?.q?.encarId===activeId;
    if(restored){q={...q,...saved.q,url:link.url};dirty=new Set(Object.keys(saved.q).filter(k=>saved.q[k]!==''&&saved.q[k]!=null));notice('Восстановлен ваш расчёт для этого объявления. Для актуальной цены нажмите «Обновить из объявления».');}
    tryMatch();tryPower();
    $('table-search').value='';$('listing-status').textContent='Encar № '+activeId;sync();open();
    // An unsuccessful import used to save an empty quote when rates arrived.
    // Retry that empty draft automatically while preserving any entered values.
    if(!restored||(!q.brand&&!q.model&&!(Number(q.krw)>0)))importListing();
    if(!q.usdRub&&!q.krwPerUsd&&!q.eurUsd)rates();
  }
  navigate();setInterval(navigate,800);
  window.addEventListener('pagehide',()=>{clearTimeout(savedTimer);saveDraft();});
}
