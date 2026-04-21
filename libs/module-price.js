// ==UserScript==
// @name         Encar Price Module
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Загрузка стоимости из Google Sheets
// @match        *://www.encar.com/cars/detail/*
// @match        *://fem.encar.com/cars/detail/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    if (!unsafeWindow.EncarHub) {
        console.error('[Price] CoreHub не найден!');
        return;
    }

    const Hub = unsafeWindow.EncarHub;

    const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRyFwkx1JRyOn7uidzCD9uNX6vbeih0rwHq6xF7-2pgd03ZVYIF0596M6B_ZYxVLOyizx3BYD2SfIj1/pub?output=csv';

    let allPriceData = [];
    let priceDataLoaded = false;

    function parseCSV(csvText) {
        const lines = csvText.split(/\r?\n/);
        if (lines.length < 2) return [];

        // Поиск строки с заголовками
        let headerIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('Марка') && lines[i].includes('Модель') && lines[i].includes('Стоимость')) {
                headerIndex = i;
                break;
            }
        }
        if (headerIndex === -1) return [];

        const headers = lines[headerIndex].split(',').map(h => h.trim().replace(/"/g, ''));
        const colBrand = headers.findIndex(h => h.includes('Марка'));
        const colModel = headers.findIndex(h => h.includes('Модель'));
        const colEngine = headers.findIndex(h => h.includes('Объем'));
        const colYear = headers.findIndex(h => h.includes('Год'));
        const colPrice = headers.findIndex(h => h.includes('Стоимость'));

        if (colBrand === -1 || colModel === -1 || colPrice === -1) return [];

        const data = [];
        for (let i = headerIndex + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            if (values.length <= Math.max(colBrand, colModel, colPrice)) continue;

            const price = parseFloat(values[colPrice].replace(/[^\d.-]/g, '').replace(',', '.'));
            if (isNaN(price)) continue;

            const year = colYear !== -1 ? parseInt(values[colYear], 10) : null;

            data.push({
                Марка: values[colBrand],
                Модель: values[colModel],
                Объем: colEngine !== -1 ? values[colEngine] : null,
                Год: year,
                Цена: price
            });
        }

        console.log(`[Price] Загружено ${data.length} записей`);
        return data;
    }

    function findPriceFromData(brand, model, engine, year) {
        if (!allPriceData.length) return null;

        const strYear = parseInt(year);
        const engineStr = String(engine || '').replace(/\s/g, '');

        const found = allPriceData.find(item =>
            item.Марка?.toLowerCase() === brand?.toLowerCase() &&
            item.Модель?.toLowerCase() === model?.toLowerCase() &&
            (!engineStr || String(item.Объем || '').replace(/\s/g, '') === engineStr) &&
            (!strYear || item.Год === strYear)
        );

        return found ? found.Цена : null;
    }

    function loadPriceData() {
        const proxies = [
            { url: 'https://api.allorigins.win/raw?url=', name: 'allorigins' },
            { url: 'https://cors-anywhere.herokuapp.com/', name: 'cors-anywhere' },
            { url: 'https://corsproxy.io/?', name: 'corsproxy' }
        ];

        let completed = false;
        let activeRequests = 0;
        const workingProxy = localStorage.getItem('encar_working_proxy');

        function onSuccess(data, proxyName) {
            if (completed) return;
            completed = true;
            allPriceData = data;
            priceDataLoaded = true;
            localStorage.setItem('encar_working_proxy', proxyName);
            Hub.set('priceDataLoaded', true);
            Hub.set('allPriceData', allPriceData);
            Hub.emit('priceData:loaded', allPriceData);
            console.log(`[Price] Загружено через ${proxyName}`);
            autoSelectPrice();
        }

        function onError() {
            activeRequests--;
            if (activeRequests === 0 && !completed) {
                console.error('[Price] Все прокси не сработали');
                priceDataLoaded = true;
                Hub.emit('priceData:error');
            }
        }

        // Пробуем сохранённый прокси
        if (workingProxy) {
            const savedProxy = proxies.find(p => p.name === workingProxy);
            if (savedProxy) {
                activeRequests++;
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: savedProxy.url + encodeURIComponent(CSV_URL),
                    timeout: 8000,
                    onload: (res) => {
                        if (completed) return;
                        if (res.status === 200 && res.responseText?.length > 500) {
                            const data = parseCSV(res.responseText);
                            if (data.length) onSuccess(data, savedProxy.name);
                            else onError();
                        } else onError();
                    },
                    onerror: onError,
                    ontimeout: onError
                });
            }
        }

        // Параллельная загрузка через все прокси
        for (const proxy of proxies) {
            if (workingProxy === proxy.name) continue;
            activeRequests++;
            GM_xmlhttpRequest({
                method: 'GET',
                url: proxy.url + encodeURIComponent(CSV_URL),
                timeout: 8000,
                onload: (res) => {
                    if (completed) return;
                    if (res.status === 200 && res.responseText?.length > 500) {
                        const data = parseCSV(res.responseText);
                        if (data.length) onSuccess(data, proxy.name);
                        else onError();
                    } else onError();
                },
                onerror: onError,
                ontimeout: onError
            });
        }

        if (activeRequests === 0) {
            for (const proxy of proxies) {
                activeRequests++;
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: proxy.url + encodeURIComponent(CSV_URL),
                    timeout: 8000,
                    onload: (res) => {
                        if (completed) return;
                        if (res.status === 200 && res.responseText?.length > 500) {
                            const data = parseCSV(res.responseText);
                            if (data.length) onSuccess(data, proxy.name);
                            else onError();
                        } else onError();
                    },
                    onerror: onError,
                    ontimeout: onError
                });
            }
        }
    }

    function autoSelectPrice() {
        const brand = Hub.get('carBrand');
        const model = Hub.get('carModel');
        const engine = Hub.get('carEngineVolume');
        const year = Hub.get('carYear');

        if (brand && model && engine && year && allPriceData.length) {
            const price = findPriceFromData(brand, model, engine, year);
            if (price !== null) {
                Hub.set('selectedEuroPrice', price);
                Hub.set('selectedPriceManual', null);
                Hub.set('selectedPriceBrand', brand);
                Hub.set('selectedPriceModel', model);
                Hub.set('selectedPriceEngine', engine);
                Hub.set('selectedPriceYear', year);
                console.log(`[Price] Авто-выбор: ${price.toLocaleString()} €`);
            }
        }
    }

    // Ручная установка цены
    function setManualPrice(price) {
        if (price && !isNaN(price) && price > 0) {
            Hub.set('selectedEuroPrice', price);
            Hub.set('selectedPriceManual', price);
            Hub.set('selectedPriceBrand', null);
            Hub.set('selectedPriceModel', null);
            Hub.set('selectedPriceEngine', null);
            Hub.set('selectedPriceYear', null);
        }
    }

    // Экспорт методов
    unsafeWindow.EncarPrice = {
        setManual: setManualPrice,
        refresh: loadPriceData,
        findPrice: (brand, model, engine, year) => findPriceFromData(brand, model, engine, year)
    };

    // Подписка на изменение данных авто
    Hub.on('carData:ready', () => {
        if (allPriceData.length) autoSelectPrice();
        else {
            Hub.once('priceData:loaded', () => autoSelectPrice());
        }
    });

    // Загрузка
    loadPriceData();

    console.log('[Price] Модуль загружен');
})();
