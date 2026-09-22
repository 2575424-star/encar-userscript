import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tpoCandidates,powerCandidates,powerSignature,vehicleKey,cleanPowerCatalog,catalogBrand,catalogModel} from '../src/catalogs.js';
import {standaloneResult,standaloneQuote,utilSignature} from '../src/standalone.js';
const table=JSON.parse(fs.readFileSync(new URL('../src/encar-table.json',import.meta.url)));
const catalog=JSON.parse(fs.readFileSync(new URL('../src/power-catalog.json',import.meta.url)));
const gle={brand:'Mercedes-Benz',model:'GLE-Class',trim:'GLE450d 4MATIC Coupe',year:'2024',engine:'2989'};
test('actual GLE450d suggests only GLE 450 tariff; generic family cannot select 400D or 53',()=>{
 const result=tpoCandidates(gle,[],table);
 assert.equal(result.automatic,null);assert.equal(result.candidates.length,1);
 assert.equal(result.candidates[0].row.model,'GLE 450');assert.equal(result.candidates[0].row.eur,31000);
});
test('normalizes Korean brand, accents, punctuation, chassis, class and equipment',()=>{
 assert.equal(catalogBrand('벤츠'),'MERCEDESBENZ');assert.equal(catalogModel('GLE 클래스'),'GLE');
 assert.equal(catalogModel('GLE 450 d 4MATIC Coupé (C167)'),catalogModel(gle.trim));
 const q={...gle,brand:'Benz',trim:'GLE 450 4MATIC Coupé'};
 assert.equal(tpoCandidates(q,[],table).automatic?.eur,31000);
});
test('does not silently select a different year, engine or hybrid badge',()=>{
 for(const patch of [{year:'2023'},{engine:'1991'},{trim:'GLE 450 e 4MATIC Coupe'}])assert.equal(tpoCandidates({...gle,...patch},[],table).candidates.length,0);
 const row=tpoCandidates({...gle,trim:'GLE450'},[],table).automatic;
 assert.equal(tpoCandidates({...gle,trim:'GLE450'},[],[row,{...row,id:'duplicate'}]).automatic,null);
});
test('confirmed tariff mapping survives spelling normalization but never different year/engine/price',()=>{
 const row=tpoCandidates(gle,[],table).candidates[0].row;
 const memory={[vehicleKey(gle)]:{id:row.id,eur:row.eur}};
 assert.equal(tpoCandidates(gle,[],table,memory).automatic?.id,row.id);
 assert.equal(tpoCandidates({...gle,trim:'GLE 450 d 4MATIC Coupé'},[],table,memory).automatic?.id,row.id);
 for(const patch of [{year:'2025'},{engine:'2999'},{trim:'GLE400d 4MATIC Coupe'}])assert.notEqual(tpoCandidates({...gle,...patch},[],table,memory).automatic?.id,row.id);
 assert.equal(tpoCandidates(gle,[],[{...row,eur:40000}],memory).automatic,null);
});
test('Korean power reference discloses adjacent year; exact year wins; no guess from displacement alone',()=>{
 const result=powerCandidates(gle,catalog);assert.equal(result.length,1);assert.equal(result[0].row.powerHp,367);assert.equal(result[0].exactYear,false);assert.match(result[0].reason,/2025.*2024/);
 const exact={...catalog[0],year:'2024',powerHp:366};assert.equal(powerCandidates(gle,[...catalog,exact])[0].row.powerHp,366);
 for(const patch of [{trim:''},{engine:'3000'},{trim:'GLE450 4MATIC Coupe'},{year:'2023'},{market:'США'},{trim:'GLE450d 4MATIC'}])assert.equal(powerCandidates({...gle,...patch},catalog).length,0);
 assert.equal(powerCandidates(gle,[{...catalog[0],powerKind:'system'}]).length,0);
});
test('catalog power blocks final total until confirmed even with an old confirmed utilization signature',()=>{
 const q={...standaloneQuote(),...gle,powerHp:367,powerOrigin:'catalog',powertrain:'ice',utilAge:'new',krw:91900000,krwPerUsd:1000,eur:31000,eurUsd:1.1,usdRub:90};
 q.utilConfirmed=utilSignature(q);assert.equal(standaloneResult(q).rub,null);
 q.powerConfirmed=powerSignature(q);assert.ok(standaloneResult(q).rub>0);
 assert.equal(standaloneResult({...q,trim:'GLE400d'}).rub,null);
 assert.ok(standaloneResult({...q,powerConfirmed:'',utilRub:100000}).rub>0);
});
test('user catalog validates source, identity, market and finite power, without executable URLs',()=>{
 assert.equal(cleanPowerCatalog(catalog)[0].powerHp,367);
 for(const patch of [{sourceUrl:'javascript:alert(1)'},{sourceUrl:'https://user:pass@example.com'},{powerHp:-1},{powerHp:'NaN'},{trim:''},{market:'USA'},{powerKind:'unknown'}])assert.throws(()=>cleanPowerCatalog([{...catalog[0],...patch}]));
 assert.throws(()=>cleanPowerCatalog({rows:catalog}));
});
