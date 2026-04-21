// ==UserScript==
// @name         Encar Price Module (GitHub CSV)
// @namespace    http://tampermonkey.net/
// @version      2.0
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
    
    // ========== НОВАЯ ССЫЛКА НА CSV В РЕПОЗИТОРИИ ==========
    const CSV_URL = 'https://raw.githubusercontent.com/2575424-star/encar-userscript/refs/heads/main/car-prices.csv';
    
    let allPriceData = [];
    let priceDataLoaded = false;
    
    function parseCSV(csvText) {
        const lines = csvText.split(/\r?\n/);
        if (lines.length < 2) return [];
        
        // Поиск строки с заголовками
        let headerIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('Марка') && line.includes('Модель') && line.includes('Стоимость')) {
                headerIndex = i;
                break;
            }
        }
        
        if (headerIndex === -1) {
            // Если заголовки не найдены, пробуем первую строку
            headerIndex = 0;
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
            
            // Обработка кавычек в CSV
            let values;
            if (line.includes('"')) {
                // Простой парсинг с кавычками
                values = [];
                let current = '';
                let inQuotes = false;
                for (let char of line) {
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        values.push(current.trim());
                        current = '';
                    } else {
                        current += char;
                    }
                }
                values.push(current.trim());
            } else {
                values = line.split(',').map(v => v.trim());
            }
            
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
        
        console.log(`[Price] Загружено ${data.length} записей из репозитория`);
        return data;
    }
    
    function findPriceFromData(brand, model, engine, year) {
        if (!allPriceData.length) return null;
        
        const strYear = parseInt(year);
        const engineStr = String(engine || '').replace(/\s/g, '');
        
        // Поиск с учётом возможных вариантов
        let found = allPriceData.find(item =>
            item.Марка?.toLowerCase() === brand?.toLowerCase() &&
            item.Модель?.toLowerCase() === model?.toLowerCase() &&
            (!engineStr || String(item.Объем || '').replace(/\s/g, '') === engineStr) &&
            (!strYear || item.Год === strYear)
        );
        
        // Если не нашли по году, ищем без года
        if (!found && strYear) {
            found = allPriceData.find(item =>
                item.Марка?.toLowerCase() === brand?.toLowerCase() &&
                item.Модель?.toLowerCase() === model?.toLowerCase() &&
                (!engineStr || String(item.Объем || '').replace(/\s/g, '') === engineStr)
            );
        }
        
        // Если не нашли по объёму, ищем без объёма
        if (!found && engineStr) {
            found = allPriceData.find(item =>
                item.Марка?.toLowerCase() === brand?.toLowerCase() &&
                item.Модель?.toLowerCase() === model?.toLowerCase() &&
                (!strYear || item.Год === strYear)
            );
        }
        
        return found ? found.Цена : null;
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
                console.error('[Price] Ошибка сети при загрузке CSV:', err);
                setDefaultPriceData();
            },
            ontimeout: function() {
                console.error('[Price] Таймаут загрузки CSV');
                setDefaultPriceData();
            }
        });
    }
    
    function setDefaultPriceData() {
        // Заглушка, если CSV не загрузился
        allPriceData = [];
        priceDataLoaded = true;
        Hub.set('priceDataLoaded', true);
        Hub.set('allPriceData', allPriceData);
        console.warn('[Price] Используются пустые данные (CSV не загружен)');
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
                console.log(`[Price] ✅ Авто-выбор: ${price.toLocaleString()} € для ${brand} ${model}`);
            } else {
                console.log(`[Price] ⚠️ Цена не найдена для ${brand} ${model} ${engine}cc ${year}`);
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
            console.log(`[Price] Ручная установка цены: ${price} €`);
        }
    }
    
    // Получение всех данных (для UI)
    function getAllPriceData() {
        return allPriceData;
    }
    
    // Экспорт методов для доступа из консоли и других модулей
    unsafeWindow.EncarPrice = {
        setManual: setManualPrice,
        refresh: loadPriceData,
        findPrice: (brand, model, engine, year) => findPriceFromData(brand, model, engine, year),
        getAllData: getAllPriceData
    };
    
    // Подписка на изменение данных авто
    Hub.on('carData:ready', () => {
        if (allPriceData.length) {
            autoSelectPrice();
        } else {
            Hub.once('priceData:loaded', () => autoSelectPrice());
        }
    });
    
    // Загрузка данных
    loadPriceData();
    
    console.log('[Price] Модуль загружен, CSV из репозитория');
})();
