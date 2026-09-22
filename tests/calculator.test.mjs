import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {standaloneQuote,standaloneResult,utilSignature,readListing,parseRates} from '../src/standalone.js';
import {quoteResult} from '../src/encar.js';
import {listingURL,embeddedJSON,matchTpo,tpoEngine,listingPower,listingMatchesId} from '../src/encar-import.js';
import {utilization} from '../src/encar-util.js';
const table=JSON.parse(fs.readFileSync(new URL('../src/encar-table.json',import.meta.url)));
const example=JSON.parse(fs.readFileSync(new URL('./fixtures/42752324.json',import.meta.url)));
const relisted=JSON.parse(fs.readFileSync(new URL('./fixtures/42403782.json',import.meta.url)));
const base=()=>({...standaloneQuote(),brand:'BMW',model:'X5',year:'2024',krw:100000000,krwPerUsd:1000,eur:32000,eurUsd:1.1,usdRub:90,engine:2993,powerHp:298,powertrain:'ice',utilAge:'new',utilYear:2026});

test('matches CRM formula with independently known amounts',()=>{
 const q=base(),r=quoteResult(q);
 assert.equal(r.discountedKrw,96000000);assert.equal(r.landedKrw,102000000);
 assert.equal(r.tpo,16896);assert.equal(r.subtotalUsd,121096);
 assert.equal(r.markupRub,217972.8);assert.equal(r.util.rub,2620800);
 assert.equal(r.rub,13822412.8);
});
test('automatic fee requires explicit confirmation and invalidates after a changed input',()=>{
 const q=base();assert.equal(standaloneResult(q).rub,null);
 q.utilConfirmed=utilSignature(q);assert.equal(standaloneResult(q).rub,13822412.8);
 for(const patch of [{engine:3001},{powerHp:300},{utilAge:'old'},{eaeuRub:100},{utilYear:2027}])assert.equal(standaloneResult({...q,...patch}).rub,null);
});
test('manual fee and manual TPO allow zero and do not need automatic inputs',()=>{
 const q={...base(),utilRub:0,powerHp:'',manualTpo:0,eur:'',eurUsd:''};
 assert.equal(standaloneResult(q).tpo,0);assert.equal(standaloneResult(q).rub,9650560);
 assert.equal(standaloneResult({...q,utilRub:''}).rub,null);
});
test('exact source example: price uses units of 10000 KRW; missing power and 2023 tariff remain unknown',()=>{
 const p=readListing(example,'42752324','https://fem.encar.com/cars/detail/42752324',table);
 assert.equal(p.quote.krw,81900000);assert.equal(p.quote.engine,'2989');
 assert.equal(p.quote.mileage,54574);assert.equal(p.quote.trim,'GLE450d 4MATIC Coupe');
 assert.equal(p.quote.year,'2023');assert.equal(p.quote.powerHp,'');
 assert.equal(p.quote.eur,'');assert.equal(p.quote.tableId,'');assert.equal(p.quote.utilAge,'');
 assert.equal(p.quote.powertrain,'ice');assert.equal(standaloneResult(p.quote).rub,null);
});
test('parser does not execute page scripts and rejects a different listing',()=>{
 const data=embeddedJSON('window.__PRELOADED_STATE__ = '+JSON.stringify({cars:{base:example}})+'; throw new Error("do not run");');
 assert.equal(readListing(data,'42752324','',table).quote.krw,81900000);
 assert.throws(()=>readListing(data,'42752325','',table),/другого/);
});
test('re-registered listing 42403782 maps to internal vehicle 42393681 without changing the public URL',()=>{
 assert.equal(relisted.vehicleId,42393681);assert.equal(relisted.queryCarId,42403782);
 assert.equal(listingMatchesId(relisted,'42403782'),true);
 const p=readListing({cars:{base:relisted}},'42403782','https://fem.encar.com/cars/detail/42403782',table);
 assert.equal(p.quote.encarId,'42403782');assert.match(p.quote.url,/42403782$/);
 assert.equal(p.quote.brand,'Mercedes-Benz');assert.equal(p.quote.trim,'GLE450d 4MATIC Coupe');
 assert.equal(p.quote.krw,91900000);assert.equal(p.quote.engine,'2989');assert.equal(p.quote.year,'2024');assert.equal(p.quote.mileage,25095);
});
test('explicit dummy alias works without queryCarId; unmarked dummy IDs are not trusted',()=>{
 const {queryCarId,...withoutQuery}=relisted;
 assert.equal(listingMatchesId(withoutQuery,'42403782'),true);
 assert.equal(readListing(withoutQuery,'42403782','',table).quote.krw,91900000);
 const unmarked={...withoutQuery,manage:{dummy:false,dummyVehicleId:42403782}};
 assert.equal(listingMatchesId(unmarked,'42403782'),false);
 assert.throws(()=>readListing(unmarked,'42403782','',table),/другого/);
});
test('support for aliases still rejects unrelated/stale cars and missing page identities',()=>{
 assert.equal(listingMatchesId(relisted,'42752324'),false);
 assert.equal(listingMatchesId({},'42403782'),false);
 assert.throws(()=>readListing(relisted,'42752324','',table),/другого/);
 assert.equal(listingMatchesId(relisted,'42393681'),true);
});
test('unknown, hybrid and electric fuels never silently become ICE',()=>{
 for(const fuelName of ['','가솔린+전기','하이브리드','electric']){
  const parsed=readListing({...example,spec:{...example.spec,fuelName}},'42752324','',table);
  assert.equal(utilization({...base(),powertrain:parsed.quote.powertrain}).rub,null);
  assert.equal(quoteResult({...base(),powertrain:parsed.quote.powertrain}).rub,null);
 }
});
test('unknown power units are not guessed; kW explicitly converts to metric hp',()=>{
 assert.equal(listingPower({maxPower:298}).powerHp,'');assert.equal(listingPower({powerPs:298}).powerHp,298);
 assert.ok(Math.abs(listingPower({powerKw:220}).powerHp-299.116)<.01);
});
test('table matching rounds displacement only for TPO; ambiguous or absent rows are not selected',()=>{
 const q=base();const row=matchTpo(q,[],table);assert.equal(row.eur,32000);
 assert.equal(tpoEngine(2989),'3000');assert.equal(q.engine,2993);
 assert.equal(matchTpo(q,[],[row,{...row,id:'duplicate'}]),null);
 assert.equal(matchTpo({...q,year:'2023'},[],table),null);
});
test('invalid inputs and missing costs cannot produce a final total',()=>{
 for(const patch of [{krw:''},{krw:-1},{krwPerUsd:0},{usdRub:0},{discountPct:101},{markupPct:-1},{documentsRub:''},{utilRub:-1},{manualTpo:'bad',eur:''}])assert.equal(standaloneResult({...base(),utilRub:0,...patch}).rub,null);
});
test('rate conversion respects KRW nominal; invalid source data is rejected',()=>{
 const r=parseRates({Date:'2026-09-22T00:00:00+03:00',Valute:{USD:{Value:90,Nominal:1},EUR:{Value:99,Nominal:1},KRW:{Value:90,Nominal:1000}}});
 assert.equal(r.krwPerUsd,1000);assert.equal(r.eurUsd,1.1);assert.equal(r.usdRub,90);
 assert.throws(()=>parseRates({Date:'invalid',Valute:{}}));
});
test('preferences never carry the prior car price, power or tariff into a new listing',()=>{
 const q=standaloneQuote({...base(),utilConfirmed:'bad',tableId:'129'});
 assert.equal(q.krw,'');assert.equal(q.powerHp,'');assert.equal(q.eur,'');assert.equal(q.tableId,'');
 assert.equal(q.krwPerUsd,1000);assert.equal(q.utilConfirmed,'');
});
test('listing URL accepts query strings but rejects foreign hosts',()=>{
 assert.equal(listingURL('https://fem.encar.com/cars/detail/42752324?carid=42752324').id,'42752324');
 for(const url of ['https://evil.test/cars/detail/42752324','https://fem.encar.com.evil.test/cars/detail/42752324','https://u:p@fem.encar.com/cars/detail/42752324'])assert.throws(()=>listingURL(url));
});
