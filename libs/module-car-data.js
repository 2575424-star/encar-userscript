// ==UserScript==
// @name         Encar Car Data Module
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Сбор данных + страховые выплаты (парсинг HTML)
// @match        *://www.encar.com/cars/detail/*
// @match        *://fem.encar.com/cars/detail/*
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @connect      fem.encar.com
// @connect      api.encar.com
// ==/UserScript==

(function() {
    'use strict';
    
    if (!unsafeWindow.EncarHub) {
        console.error('[CarData] CoreHub не найден!');
        return;
    }
    
    const Hub = unsafeWindow.EncarHub;
    
    // ========== ПОИСК CARID ==========
    function findCarId() {
        const urlMatch = window.location.href.match(/carid=(\d+)/);
        if (urlMatch) return urlMatch[1];
        if (window.__PRELOADED_STATE__?.cars?.base?.vehicleId) {
            return window.__PRELOADED_STATE__.cars.base.vehicleId;
        }
        return null;
    }
    
    // ========== ЗАГРУЗКА СТРАХОВЫХ ДАННЫХ (ПАРСИНГ HTML) ==========
    function loadAccidentData() {
        const carId = findCarId();
        if (!carId) {
            Hub.set('accidentTotal', '—');
            Hub.set('accidentDetails', []);
            Hub.emit('accidentData:loaded', { count: 0, totalWon: 0, totalUsd: 0, details: [] });
            return;
        }
        
        const accidentUrl = `https://fem.encar.com/cars/report/accident/${carId}`;
        console.log('[CarData] Загрузка страницы ДТП:', accidentUrl);
        
        GM_xmlhttpRequest({
            method: 'GET',
            url: accidentUrl,
            onload: function(res) {
                if (res.status === 200 && res.response) {
                    const html = res.response;
                    
                    // Парсим количество ДТП и сумму выплат
                    // Ищем паттерн: "보험사고 이력 (내차 피해)    1회 / 4,825,592원"
                    const accidentPattern = /보험사고\s*이력\s*\(내차\s*피해\)\s*(\d+)회\s*\/\s*([\d,]+)원/;
                    const match = html.match(accidentPattern);
                    
                    if (match) {
                        const count = parseInt(match[1], 10);
                        const amountWon = parseInt(match[2].replace(/,/g, ''), 10);
                        const usdToKrw = Hub.get('usdToKrw') || 1473;
                        const amountUsd = Math.round(amountWon / usdToKrw);
                        
                        console.log(`[CarData] Найдено ДТП: ${count} шт., сумма: ${amountWon.toLocaleString()} 원 (${amountUsd.toLocaleString()} $)`);
                        
                        Hub.set('accidentTotal', `${amountUsd.toLocaleString()} $`);
                        Hub.set('accidentDetails', [{
                            count: count,
                            amountWon: amountWon,
                            amountUsd: amountUsd,
                            date: null
                        }]);
                        Hub.emit('accidentData:loaded', {
                            count: count,
                            totalUsd: amountUsd,
                            details: [{ count: count, amountUsd: amountUsd }]
                        });
                    } else {
                        // Проверяем, есть ли надпись "없음" (нет)
                        if (html.includes('없음') || html.includes('보험사고 이력이 없습니다')) {
                            console.log('[CarData] Страховых случаев нет');
                            Hub.set('accidentTotal', 'Без ДТП');
                            Hub.set('accidentDetails', []);
                            Hub.emit('accidentData:loaded', { count: 0, totalUsd: 0, details: [] });
                        } else {
                            console.log('[CarData] Не удалось найти информацию о ДТП');
                            Hub.set('accidentTotal', '—');
                            Hub.set('accidentDetails', []);
                            Hub.emit('accidentData:loaded', { count: 0, totalUsd: 0, details: [] });
                        }
                    }
                } else {
                    console.error('[CarData] Ошибка загрузки страницы ДТП, статус:', res.status);
                    Hub.set('accidentTotal', '—');
                    Hub.set('accidentDetails', []);
                    Hub.emit('accidentData:loaded', { count: 0, totalUsd: 0, details: [] });
                }
            },
            onerror: function(err) {
                console.error('[CarData] Ошибка запроса:', err);
                Hub.set('accidentTotal', '—');
                Hub.set('accidentDetails', []);
                Hub.emit('accidentData:loaded', { count: 0, totalUsd: 0, details: [] });
            }
        });
    }
    
    // ========== ОСТАЛЬНЫЕ ФУНКЦИИ СБОРА ДАННЫХ ==========
    function getCarBrandAndModel() {
        let brand = null, model = null;
        
        if (window.__PRELOADED_STATE__) {
            try {
                const cat = window.__PRELOADED_STATE__.cars?.base?.category;
                if (cat) {
                    brand = cat.manufacturerEnglishName || cat.manufacturerName;
                    model = cat.modelEnglishName || cat.modelName;
                }
            } catch(e) {}
        }
        
        if (!brand || !model) {
            const title = document.title;
            const match = title.match(/^([A-Z]+)\s+([^(]+)/);
            if (match) {
                brand = brand || match[1];
                model = model || match[2].trim();
            }
        }
        
        return (brand || model) ? { brand, model } : null;
    }
    
    function getCarYearMonth() {
        if (window.__PRELOADED_STATE__) {
            try {
                const cat = window.__PRELOADED_STATE__.cars?.base?.category;
                if (cat && cat.yearMonth && cat.yearMonth.length === 6) {
                    return { year: cat.yearMonth.slice(0, 4), month: cat.yearMonth.slice(4, 6) };
                }
            } catch(e) {}
        }
        
        const body = document.body.innerText;
        const match = body.match(/(\d{4})년/);
        if (match) return { year: match[1], month: null };
        return null;
    }
    
    function getVinNumber() {
        if (window.__PRELOADED_STATE__) {
            try {
                const vin = window.__PRELOADED_STATE__.cars?.base?.vehicleNo;
                if (vin && vin.length === 17) return vin.toUpperCase();
            } catch(e) {}
        }
        const body = document.body.innerText;
        const match = body.match(/[A-HJ-NPR-Z0-9]{17}/i);
        if (match) return match[0].toUpperCase();
        return null;
    }
    
    function getCarMileage() {
        if (window.__PRELOADED_STATE__) {
            try {
                return window.__PRELOADED_STATE__.cars?.base?.spec?.mileage;
            } catch(e) {}
        }
        const body = document.body.innerText;
        const match = body.match(/주행거리\s*:?\s*([\d,]+)\s*km/i);
        if (match) return parseInt(match[1].replace(/,/g, ''));
        return null;
    }
    
    function getEngineVolume() {
        if (window.__PRELOADED_STATE__) {
            try {
                const vol = window.__PRELOADED_STATE__.cars?.base?.spec?.displacement;
                if (vol) return Math.ceil(parseInt(vol) / 100) * 100;
            } catch(e) {}
        }
        const body = document.body.innerText;
        const match = body.match(/(\d{3,4})\s*cc/i);
        if (match) return Math.ceil(parseInt(match[1]) / 100) * 100;
        return null;
    }
    
    function getCarPower() {
        function kwToHp(kw) { return Math.round(kw * 1.341); }
        if (window.__PRELOADED_STATE__) {
            try {
                const kw = window.__PRELOADED_STATE__.cars?.base?.spec?.maxPower;
                if (kw) return { hp: kwToHp(kw), kw: kw };
            } catch(e) {}
        }
        const body = document.body.innerText;
        const match = body.match(/(\d{2,3})\s*(?:PS|마력)/);
        if (match) return { hp: parseInt(match[1]), kw: Math.round(parseInt(match[1]) / 1.341) };
        return null;
    }
    
    function getCarPriceKrw() {
        if (window.__PRELOADED_STATE__) {
            try {
                const price = window.__PRELOADED_STATE__.cars?.base?.advertisement?.price;
                if (price) return parseInt(price) * 10000;
            } catch(e) {}
        }
        const body = document.body.innerText;
        const match = body.match(/(\d{1,3}(?:,\d{3})*)\s*만원/);
        if (match) return parseInt(match[1].replace(/,/g, '')) * 10000;
        return null;
    }
    
    function getCarId() {
        const urlMatch = window.location.href.match(/carid=(\d+)/);
        if (urlMatch) return urlMatch[1];
        if (window.__PRELOADED_STATE__?.cars?.base?.vehicleId) {
            return window.__PRELOADED_STATE__.cars.base.vehicleId;
        }
        return null;
    }
    
    function getCarViews() {
        if (window.__PRELOADED_STATE__) {
            try {
                return window.__PRELOADED_STATE__.cars?.base?.manage?.viewCount;
            } catch(e) {}
        }
        const body = document.body.innerText;
        const match = body.match(/조회수\s*:?\s*([\d,]+)/);
        if (match) return parseInt(match[1].replace(/,/g, ''));
        return null;
    }
    
    // ========== ГЛАВНАЯ ФУНКЦИЯ ==========
    function collectAllCarData() {
        console.log('[CarData] Начало сбора данных...');
        
        const carInfo = getCarBrandAndModel();
        const yearData = getCarYearMonth();
        const vin = getVinNumber();
        const mileage = getCarMileage();
        const engineVolume = getEngineVolume();
        const priceKrw = getCarPriceKrw();
        const carId = getCarId();
        const views = getCarViews();
        const powerData = getCarPower();
        
        if (carInfo) {
            Hub.set('carBrand', carInfo.brand);
            Hub.set('carModel', carInfo.model);
        }
        if (yearData) {
            Hub.set('carYear', yearData.year ? parseInt(yearData.year) : null);
            Hub.set('carMonth', yearData.month || null);
        }
        Hub.set('carVin', vin);
        Hub.set('carMileage', mileage);
        Hub.set('carEngineVolume', engineVolume);
        Hub.set('carPriceKrw', priceKrw);
        Hub.set('carId', carId);
        Hub.set('carViews', views);
        if (powerData) {
            Hub.set('carPowerHp', powerData.hp);
            Hub.set('carPowerKw', powerData.kw);
        }
        
        console.log('[CarData] Итоговые данные:', {
            brand: Hub.get('carBrand'),
            model: Hub.get('carModel'),
            year: Hub.get('carYear'),
            vin: Hub.get('carVin'),
            priceKrw: Hub.get('carPriceKrw')
        });
        
        Hub.emit('carData:ready', Hub.getAll());
        
        // Загружаем страховые выплаты
        loadAccidentData();
    }
    
    // ========== ЗАПУСК ==========
    setTimeout(() => collectAllCarData(), 500);
    
    console.log('[CarData] Модуль загружен v4.0');
})();
