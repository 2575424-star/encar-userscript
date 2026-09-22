// Deterministic matching: no edit-distance guessing between engine badges.
export function catalogText(value){return String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').normalize('NFC').toUpperCase().replace(/클래스/g,'CLASS').replace(/시리즈/g,'SERIES').replace(/쿠페/g,'COUPE').replace(/[^A-Z0-9가-힣]/g,'');}
export function catalogBrand(value){const n=catalogText(value);return ({MERCEDES:'MERCEDESBENZ',BENZ:'MERCEDESBENZ','벤츠':'MERCEDESBENZ','메르세데스벤츠':'MERCEDESBENZ','비엠더블유':'BMW','아우디':'AUDI','폭스바겐':'VOLKSWAGEN','포르쉐':'PORSCHE','랜드로버':'LANDROVER','제네시스':'GENESIS','렉서스':'LEXUS','볼보':'VOLVO',INFINITI:'INFINITY'})[n]||n;}
export function catalogModel(value){return catalogText(String(value??'').replace(/\([^)]*\)/g,'').replace(/\b(?:4\s*MATIC\+?|XDRIVE|SDRIVE|QUATTRO|AWD|RWD|COUP[EÉ]|SUV|SEDAN|SALOON|AMG\s+LINE|M\s+SPORT(?:\s+PACKAGE)?|XLINE|LUXURY|PREMIUM|EXCLUSIVE)\b/gi,' ').replace(/\b(?:W|C|V|G|F)\d{2,3}\b/g,' ')).replace(/CLASS|COUPE/g,'');}
export function catalogEngine(v){const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)&&n>0?String(Math.ceil((n<=10?n*1000:n)/100)*100):'';}
export function catalogBody(q){return /COUP[EÉ]|쿠페/i.test([q.model,q.trim,q.body].join(' '))?'coupe':String(q.body||'');}
export function vehicleKey(q){return [catalogBrand(q.brand),catalogModel(q.model),catalogModel(q.trim),String(q.year),String(q.engine),q.fuel||'',catalogBody(q),q.market||'Корея'].join('|');}
function nameVariants(q,names=[]){
 const all=[q.trim,q.model,...names].filter(Boolean),set=new Set(all.map(catalogModel));
 for(const name of all){
  const raw=String(name).toUpperCase();
  if(catalogBrand(q.brand)==='MERCEDESBENZ'){
   const m=raw.match(/\b(GLE|GLS|GLC|GLA|GLB|CLA|CLE|CLS|[ABCEGSV])\s*(\d{2,3})\s*(DE|D|E)?\b/);
   if(m)set.add(m[1]+m[2]+(m[3]||''));
  }
  if(catalogBrand(q.brand)==='BMW'){
   const badge=raw.match(/\b([2-8]\d{2})\s*(D|I|E|LI|LD)\b/);if(badge)set.add(badge[1]+badge[2]);
   if(/\b\d{2}\s*D\b/.test(raw)&&/^X[1-7]$/.test(catalogModel(q.model)))set.add(catalogModel(q.model)+'D');
  }
 }
 return [...set].filter(Boolean);
}
export function tpoCandidates(q,names,table,remembered={}){
 const engine=catalogEngine(q.engine),brand=catalogBrand(q.brand),year=String(q.year);
 if(!engine||!brand||!/^\d{4}$/.test(year))return {automatic:null,candidates:[]};
 const pool=table.filter(r=>catalogBrand(r.brand)===brand&&String(r.year)===year&&catalogEngine(r.engine)===engine);
 const saved=remembered[vehicleKey(q)];const known=pool.find(r=>r.id===saved?.id&&Number(r.eur)===Number(saved?.eur));
 if(known)return {automatic:known,candidates:[{row:known,reason:'Соответствие подтверждено вами ранее',kind:'remembered'}]};
 const variants=nameVariants(q,names),ranked=[];
 for(const row of pool){
  const target=catalogModel(row.model);
  if(variants.includes(target))ranked.push({row,reason:'Совпадают название модели, год и объём',kind:'exact',rank:3});
  else if(variants.some(n=>n.replace(/(?:D|I|LI|LD)$/,'')===target&&n!==target))ranked.push({row,reason:'В таблице не указан тип двигателя; подтвердите применимость строки',kind:'suggested',rank:1});
 }
 // Prefer an explicitly matching diesel row to a generic family row.
 const detailed=ranked.filter(x=>x.kind==='exact'&&/[A-Z0-9]D$/.test(catalogModel(x.row.model)));
 const candidates=(detailed.length?detailed:ranked).sort((a,b)=>b.rank-a.rank||String(a.row.id).localeCompare(String(b.row.id)));
 const exact=candidates.filter(x=>x.kind==='exact');
 return {automatic:exact.length===1?exact[0].row:null,candidates};
}
export function powerSignature(q){return vehicleKey(q)+'|'+String(q.powerHp);}
export function powerCandidates(q,rows){
 const key=vehicleKey(q),exact=rows.filter(r=>r.identity===key);
 if(exact.length)return exact.map(row=>({row,exactYear:true,reason:'Подтверждено вами для этой модификации'}));
 const badge=catalogModel(q.trim),brand=catalogBrand(q.brand),cc=Number(q.engine),year=Number(q.year);
 if(!badge||!cc||!year||q.market&&q.market!=='Корея')return [];
 const found=rows.filter(r=>!r.identity&&r.powerKind==='engine'&&r.market==='Корея'&&catalogBrand(r.brand)===brand&&catalogModel(r.trim)===badge&&catalogBody(r)===catalogBody(q)&&Number(r.engine)===cc&&catalogModel(r.model)===catalogModel(q.model)&&Math.abs(Number(r.year)-year)<=1);
 const current=found.filter(r=>Number(r.year)===year);
 return (current.length?current:found).map(row=>({row,exactYear:Number(row.year)===year,reason:Number(row.year)===year?'Совпадают корейский рынок, модель, модификация, год и объём':'В источнике '+row.year+' год; у автомобиля '+q.year+'. Подтвердите применимость.'}));
}
export function cleanPowerCatalog(rows){
 if(!Array.isArray(rows)||rows.length>10000)throw new Error('Ожидается JSON-массив до 10 000 записей');
 return rows.map((r,i)=>{
  const fail=()=>{throw new Error('Проверьте строку справочника '+(i+1));};
  if(!r||typeof r!=='object')fail();
  const out={};for(const k of ['brand','model','trim','year','engine','market','source','sourceUrl','powerKind'])out[k]=String(r[k]??'').trim().slice(0,k==='sourceUrl'?1000:250);
  if(!out.brand||!out.model||!out.trim||!/^20\d{2}$/.test(out.year)||!(Number(out.engine)>0)||out.market!=='Корея'||!out.source||!['engine','system'].includes(out.powerKind))fail();
  const u=new URL(out.sourceUrl);if(u.protocol!=='https:'||u.username||u.password)fail();
  out.powerHp=Number(r.powerHp);if(!Number.isFinite(out.powerHp)||out.powerHp<=0||out.powerHp>3000)fail();
  out.id='import-'+i+'-'+[catalogBrand(out.brand),catalogModel(out.trim),out.year,out.engine,out.powerHp].join('-');return out;
 });
}
