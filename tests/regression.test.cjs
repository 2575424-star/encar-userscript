const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function env(initial = {}, saved = {}) {
  const data = {...initial}, events = {}, storage = new Map(Object.entries(saved)), requests = [];
  const hub = {get:k=>data[k], set(k,value){data[k]=value; this.emit(k+':changed',{value});}, on(k,f){(events[k]??=[]).push(f);}, once(k,f){this.on(k,f);}, emit(k,v){for(const f of events[k]??[]) f(v);}};
  const ctx = {unsafeWindow:{EncarHub:hub}, console:{log(){},error(){},warn(){}}, localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},setTimeout:f=>{f();},setInterval(){},GM_xmlhttpRequest:r=>requests.push(r),document:{getElementById:()=>null}, Date, Number};
  return {data,hub,ctx,storage,requests,run(file){vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../libs',file),'utf8'),ctx);}};
}
const zeroSettings = JSON.stringify({koreaLogistics:0,servicesBishkek:0,docsRf:0,ourServices:0,timestamp:Date.now()});
const ready = {carPriceKrw:1000000,usdToKrw:1000,usdtRate:90,carEngineVolume:2000,carPowerHp:150};
function calc(){const e=env(ready,{encar_settings:zeroSettings});e.run('module-calculations.js');e.hub.set('manualTpo',0);e.hub.set('manualUtilizationFee',0);return e;}
test('explicit zero expenses and payments stay zero and calculate',()=>assert.equal(calc().data.totalPrice,90000));
test('unknown TPO blocks complete total',()=>{const e=calc();e.hub.set('manualTpo',null);assert.equal(e.data.totalPrice,null);});
test('zero engine requires verified manual electric tariff',()=>{const e=calc();e.hub.set('carEngineVolume',0);e.hub.set('manualUtilizationFee',null);assert.equal(e.data.utilizationFee,null);e.hub.set('manualUtilizationFee',123);assert.equal(e.data.totalPrice,90123);});
test('missing engine clears old automatic fee',()=>{const e=calc();e.hub.set('manualUtilizationFee',null);e.hub.set('carEngineVolume',null);assert.equal(e.data.utilizationFee,null);});
test('late car ID loads overrides; next car does not inherit them',()=>{const e=calc();e.storage.set('encar_tpo_123',JSON.stringify({tpo:20,timestamp:Date.now()}));e.hub.set('carId','123');assert.equal(e.data.manualTpo,20);e.hub.set('carId','456');assert.equal(e.data.manualTpo,null);assert.equal(JSON.parse(e.storage.get('encar_tpo_123')).tpo,20);});
test('invalid and missing rates block total',()=>{const e=calc();for(const v of [0,-1,NaN,null,Infinity]){e.hub.set('usdtRate',v);assert.equal(e.data.totalPrice,null);}});
test('expired settings use defaults',()=>{const e=env(ready,{encar_settings:'{"timestamp":0,"koreaLogistics":12}'});e.run('module-calculations.js');assert.equal(e.data.koreaLogistics,4000);});
test('currency failure preserves good rate and actual date',()=>{const d=new Date('2026-09-01');const e=env({usdToKrw:1400,lastCurrencyUpdate:d});e.run('module-currency.js');e.requests[0].onerror({});assert.equal(e.data.usdToKrw,1400);assert.equal(e.data.lastCurrencyUpdate,d);assert.equal(e.data.usdtRate,null);});
test('currency failure never invents rates or successful date',()=>{const e=env();e.run('module-currency.js');e.requests[0].ontimeout();assert.equal(e.data.usdToKrw,undefined);assert.equal(e.data.lastCurrencyUpdate,undefined);});
test('CSV quoted decimal parsed; different year never substituted',()=>{const e=env();e.run('module-price.js');e.requests[0].onload({status:200,responseText:'Марка,Модель,Объем,Год,Стоимость\nBMW,X6,3000,2025,"33 000,50"\nBMW,X5,3000,2025,32000\nBMW,X7,3000,2025,35000\n'});assert.equal(e.ctx.unsafeWindow.EncarPrice.findPrice('BMW','X6',3000,2025),33000.5);assert.equal(e.ctx.unsafeWindow.EncarPrice.findPrice('BMW','X6',3000,2024),null);});
test('CSV failure does not install sample prices',()=>{const e=env({selectedEuroPrice:123});e.run('module-price.js');e.requests[0].onerror({});assert.equal(e.data.selectedEuroPrice,null);assert.equal(e.data.allPriceData.length,0);});
