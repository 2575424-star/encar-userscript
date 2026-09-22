import {powerSignature} from './catalogs.js';
import {emptyQuote, quoteResult} from './encar.js';
import {parseListing, matchTpo} from './encar-import.js';
import {utilization} from './encar-util.js';

export const PREFERENCE_KEYS = ['discountPct','koreaKrw','bishkekUsd','deliveryUsd','markupPct','documentsRub','krwPerUsd','eurUsd','usdRub','rateDate','rateSource'];
export const UTIL_KEYS = ['engine','powerHp','powertrain','utilAge','utilYear','utilRegime','eaeuRub','utilRub'];
export function utilSignature(q) { return JSON.stringify(UTIL_KEYS.map(k => String(q[k] ?? ''))); }
export function standaloneQuote(settings = {}) {
  const q = {...emptyQuote(), powertrain: '', utilConfirmed: ''};
  for (const k of PREFERENCE_KEYS) if (Object.hasOwn(settings,k)) q[k] = settings[k];
  return q;
}
export function standaloneResult(q) {
  const r = quoteResult(q);
  // Automatic fee is a suggestion until the user explicitly confirms its inputs.
  if (q.utilRub === '' || q.utilRub == null) {
    if (q.powerOrigin === 'catalog' && q.powerConfirmed !== powerSignature(q)) {
      return {...r,rub:null,usd:null,missing:[...r.missing,'Подтвердите мощность из справочника']};
    }
    if (r.util?.rub != null && q.utilConfirmed !== utilSignature(q)) {
      return {...r, rub:null, usd:null, missing:[...r.missing,'Подтвердите предложенный утильсбор']};
    }
  }
  return r;
}
export function detectPowertrain(spec = {}) {
  const fuel = String(spec.fuelName || spec.fuelType || '').toLowerCase();
  if (/하이브리드|hybrid|전기|electric|수소|hydrogen/.test(fuel)) return 'other';
  if (/디젤|가솔린|diesel|petrol|gasoline|lpg|휘발유/.test(fuel)) return 'ice';
  return '';
}
export function readListing(data, id, url, table) {
  const parsed = parseListing(data, id, url);
  const base = data.cars?.base || data.data?.cars?.base || data.data || data;
  parsed.quote.fuel = String(base.spec?.fuelName || base.spec?.fuelType || '');
  parsed.quote.market = 'Корея';
  parsed.quote.powertrain = detectPowertrain(base.spec);
  // Encar registration/model year is not proof of age on the customs payment date.
  parsed.quote.utilAge = '';
  const row = matchTpo(parsed.quote, parsed.names, table);
  if (row) Object.assign(parsed.quote, {tableId:row.id,eur:row.eur});
  return parsed;
}
export function parseRates(d) {
  const unit = code => {
    const c = d.Valute?.[code], v = c?.Value / c?.Nominal;
    if (!Number.isFinite(v) || v <= 0) throw new Error('Некорректные курсы валют');
    return v;
  };
  if (!d.Date || !Number.isFinite(Date.parse(d.Date))) throw new Error('Нет даты курса');
  const usd=unit('USD');
  return {usdRub:usd,eurUsd:unit('EUR')/usd,krwPerUsd:usd/unit('KRW'),rateDate:d.Date.slice(0,10),rateSource:'ЦБ через cbr-xml-daily.ru'};
}
