// ==UserScript==
// @name         Encar Price Module (GitHub CSV)
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Загрузка стоимости из CSV файла в репозитории GitHub
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
    
    const CSV_URL = 'https://raw.githubusercontent.com/2575424-star/encar-userscript/refs/heads/main/car-prices.csv';
    
    let allPriceData = [];
    let priceDataLoaded = false;
    
    let selectedPriceBrand = null;
    let selectedPriceModel = null;
    let selectedPriceEngine = null;
    let selectedPriceYear = null;
    let selectedPriceManual = null;
    
    function parseCSV(csvText) {
        const lines = csvText.split(/\r?\n/);
        if (lines.length < 2) return [];
        
        let headerIndex = 0;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('Марка') && lines[i].includes('Модель')) {
                headerIndex = i;
                break;
            }
        }
        
        const headers = lines[headerIndex].split(',').map(h => h.trim().replace(/"/g, ''));
        const colBrand = headers.findIndex(h => h.includes('Марка'));
        const colModel = headers.findIndex(h => h.includes('Модель'));
        const colEngine = headers.findIndex(h => h.includes('Объем') || h.includes('Объём'));
        const colYear = headers.findIndex(h => h.includes('Год'));
        const colPrice = headers.findIndex(h => h.includes('Стоимость') || h.includes('Цена'));
        
        if (colBrand === -1 || colModel === -1 || colPrice === -1) {
            console.error('[Price] Не найдены нужные колонки в CSV');
            return [];
        }
        
        const data = [];
        for (let i = headerIndex + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            if (values.length <= Math.max(colBrand, colModel, colPrice)) continue;
            
            const price = parseFloat(values[colPrice].replace(/[^\d.-]/g, '').replace(',', '.'));
            if (isNaN(price)) continue;
            
            const year = colYear !== -1 ? parseInt(values[colYear], 10) : null;
            const engine = colEngine !== -1 ? values[colEngine] : null;
            
            data.push({
                Марка: values[colBrand],
                Модель: values[colModel],
                Объем: engine,
                Год: year,
                Цена: price
            });
        }
        
        console.log(`[Price] Загружено ${data.length} записей из CSV`);
        return data;
    }
    
    function findPriceFromData(brand, model, engine, year) {
        if (!allPriceData.length) return null;
        
        const strYear = parseInt(year);
        const engineStr = String(engine || '').replace(/\s/g, '');
        
        let found = allPriceData.find(item =>
            item.Марка?.toLowerCase() === brand?.toLowerCase() &&
            item.Модель?.toLowerCase() === model?.toLowerCase() &&
            (!engineStr || String(item.Объем || '').replace(/\s/g, '') === engineStr) &&
            (!strYear || item.Год === strYear)
        );
        
        if (!found && strYear) {
            found = allPriceData.find(item =>
                item.Марка?.toLowerCase() === brand?.toLowerCase() &&
                item.Модель?.toLowerCase() === model?.toLowerCase() &&
                (!engineStr || String(item.Объем || '').replace(/\s/g, '') === engineStr)
            );
        }
        
        return found ? found.Цена : null;
    }
    
    function getCurrentEuroPrice() {
        if (selectedPriceManual !== null) return selectedPriceManual;
        if (selectedPriceBrand && selectedPriceModel && selectedPriceEngine && selectedPriceYear && allPriceData.length) {
            return findPriceFromData(selectedPriceBrand, selectedPriceModel, selectedPriceEngine, selectedPriceYear);
        }
        const brand = Hub.get('carBrand');
        const model = Hub.get('carModel');
        const engine = Hub.get('carEngineVolume');
        const year = Hub.get('carYear');
        if (brand && model && engine && year && allPriceData.length) {
            return findPriceFromData(brand, model, engine, year);
        }
        return null;
    }
    
    function loadPriceData() {
        console.log('[Price] Загрузка CSV из репозитория:', CSV_URL);
        
        GM_xmlhttpRequest({
            method: 'GET',
            url: CSV_URL,
            timeout: 10000,
            onload: function(res) {
                if (res.status === 200 && res.responseText && res.responseText.length > 100) {
                    const data = parseCSV(res.responseText);
                    if (data.length > 0) {
                        allPriceData = data;
                        priceDataLoaded = true;
                        Hub.set('priceDataLoaded', true);
                        Hub.set('allPriceData', allPriceData);
                        Hub.emit('priceData:loaded', allPriceData);
                        console.log(`[Price] ✅ CSV загружен, ${allPriceData.length} записей`);
                        autoSelectPrice();
                    } else {
                        console.error('[Price] Не удалось распарсить CSV');
                        setDefaultPriceData();
                    }
                } else {
                    console.error('[Price] Ошибка загрузки CSV, статус:', res.status);
                    setDefaultPriceData();
                }
            },
            onerror: function(err) {
                console.error('[Price] Ошибка сети:', err);
                setDefaultPriceData();
            },
            ontimeout: function() {
                console.error('[Price] Таймаут загрузки CSV');
                setDefaultPriceData();
            }
        });
    }
    
    function setDefaultPriceData() {
        allPriceData = [
            { Марка: 'BMW', Модель: 'X6', Объем: '3000', Год: 2025, Цена: 33000 },
            { Марка: 'BMW', Модель: 'X5', Объем: '3000', Год: 2025, Цена: 32000 },
            { Марка: 'HYUNDAI', Модель: 'SANTA FE', Объем: '2000', Год: 2025, Цена: 25000 },
            { Марка: 'KIA', Модель: 'SORENTO', Объем: '2000', Год: 2025, Цена: 24000 }
        ];
        priceDataLoaded = true;
        Hub.set('priceDataLoaded', true);
        Hub.set('allPriceData', allPriceData);
        console.warn('[Price] Используются тестовые данные (CSV не загружен)');
    }
    
    function autoSelectPrice() {
        const brand = Hub.get('carBrand');
        const model = Hub.get('carModel');
        const engine = Hub.get('carEngineVolume');
        const year = Hub.get('carYear');
        
        if (brand && model && engine && year && allPriceData.length) {
            const price = findPriceFromData(brand, model, engine, year);
            if (price !== null) {
                selectedPriceManual = null;
                selectedPriceBrand = brand;
                selectedPriceModel = model;
                selectedPriceEngine = engine;
                selectedPriceYear = year;
                Hub.set('selectedEuroPrice', price);
                console.log(`[Price] ✅ Авто-выбор: ${price.toLocaleString()} €`);
            }
        }
    }
    
    function setManualPrice(price) {
        if (price && !isNaN(price) && price > 0) {
            selectedPriceManual = price;
            selectedPriceBrand = null;
            selectedPriceModel = null;
            selectedPriceEngine = null;
            selectedPriceYear = null;
            Hub.set('selectedEuroPrice', price);
            console.log(`[Price] Ручная установка: ${price.toLocaleString()} €`);
        }
    }
    
    unsafeWindow.EncarPrice = {
        setManual: setManualPrice,
        refresh: loadPriceData,
        findPrice: (brand, model, engine, year) => findPriceFromData(brand, model, engine, year),
        getCurrentPrice: getCurrentEuroPrice
    };
    
    Hub.on('carData:ready', () => {
        if (allPriceData.length) {
            autoSelectPrice();
        } else {
            Hub.once('priceData:loaded', () => autoSelectPrice());
        }
    });
    
    loadPriceData();
    
    console.log('[Price] Модуль загружен (версия 3.0)');
})();
