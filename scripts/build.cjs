const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const modules = ['core-hub','module-currency','module-calculations','module-price','module-car-data','module-photos','module-ui'];
const header = `// ==UserScript==
// @name VECTOR Encar Calculator (preview)
// @namespace https://github.com/2575424-star/encar-userscript
// @version 1.1.0
// @description Предварительный расчёт стоимости автомобиля на Encar
// @match https://www.encar.com/cars/detail/*
// @match https://fem.encar.com/cars/detail/*
// @grant unsafeWindow
// @grant GM_xmlhttpRequest
// @grant GM_addStyle
// @connect api.encar.com
// @connect cbr-xml-daily.ru
// @connect raw.githubusercontent.com
// @run-at document-idle
// ==/UserScript==
`;
const body = modules.map(name => fs.readFileSync(path.join(root,'libs',name+'.js'),'utf8').replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/, '')).join('\n;\n');
fs.mkdirSync(path.join(root,'dist'), {recursive:true});
fs.writeFileSync(path.join(root,'dist/vector-encar.user.js'),header+body);
