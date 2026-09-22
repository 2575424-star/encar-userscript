import fs from 'node:fs';
const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const header = `// ==UserScript==
// @name         VECTOR · Encar — расчёт стоимости
// @namespace    https://github.com/2575424-star/encar-userscript
// @version      2.1.0
// @description  Отдельный калькулятор Корея → Бишкек → Воронеж на странице Encar. Без входа в CRM.
// @author       VECTOR / Boom Auto
// @match        https://fem.encar.com/*
// @match        https://www.encar.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @connect      api.encar.com
// @connect      www.cbr-xml-daily.ru
// @connect      cbr-xml-daily.ru
// @run-at       document-idle
// @noframes
// @homepageURL  https://github.com/2575424-star/encar-userscript
// @downloadURL  https://raw.githubusercontent.com/2575424-star/encar-userscript/main/encar-calculator.user.js
// @updateURL    https://raw.githubusercontent.com/2575424-star/encar-userscript/main/encar-calculator.user.js
// ==/UserScript==
`;
const files = ['catalogs.js', 'encar-util.js', 'encar-photos.js', 'encar.js', 'encar-import.js', 'standalone.js', 'app.js'];
// Source modules use named exports and one-line imports only. No runtime loader or remote code.
const code = files.map(name => read('src/' + name)
  .replace(/^import .*?;\s*/gm, '')
  .replace(/\bexport (?=(?:async )?function|const|let|class)/g, '')).join('\n\n');
const result = header + '\n(function () {\n\"use strict\";\nconst TPO_TABLE = ' + JSON.stringify(JSON.parse(read('src/encar-table.json'))) + ';\nconst POWER_CATALOG = ' + JSON.stringify(JSON.parse(read('src/power-catalog.json'))) + ';\nconst APP_CSS = ' + JSON.stringify(read('src/app.css')) + ';\n' + code + '\n})();\n';
fs.writeFileSync(new URL('encar-calculator.user.js', root), result);
console.log('Built encar-calculator.user.js (' + Buffer.byteLength(result) + ' bytes)');
