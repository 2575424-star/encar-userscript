// ==UserScript==
// @name         Encar Car Data Module FIXED
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Улучшенный сбор данных с Encar + страховые выплаты
// @match        *://www.encar.com/cars/detail/*
// @match        *://fem.encar.com/cars/detail/*
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @connect      api.encar.com
// ==/UserScript==

(function() {
    'use strict';
    
    if (!unsafeWindow.EncarHub) {
        console.error('[CarData] CoreHub не найден!');
        return;
    }
    
    const Hub = unsafeWindow.EncarHub;
    
    // ========== ПЕРЕВОД МАРОК ==========
    const BRAND_TRANSLATIONS = {
        '현대': 'HYUNDAI', '기아': 'KIA', 'BMW': 'BMW', '벤츠': 'MERCEDES-BENZ',
        '아우디': 'AUDI', '폭스바겐': 'VOLKSWAGEN', '도요타': 'TOYOTA', '혼다': 'HONDA',
        '닛산': 'NISSAN', '포르쉐': 'PORSCHE', '렉서스': 'LEXUS', '볼보': 'VOLVO'
    };
    
    function translateBrand(koreanBrand) {
        if (!koreanBrand) return null;
        for (const [kr, en] of Object.entries(BRAND_TRANSLATIONS)) {
            if (koreanBrand.includes(kr)) return en;
        }
        return koreanBrand.toUpperCase();
    }
    
    // ========== МАРКА И МОДЕЛЬ ==========
    function getCarBrandAndModel() {
        let brand = null, model = null;
        
        if (window.__PRELOADED_STATE__) {
            try {
                const cat = window.__PRELOADED_STATE__.cars?.base?.category;
                if (cat) {
                    brand = cat.manufacturerEnglishName || cat.manufacturerName;
                    model = cat.modelEnglishName || cat.modelName;
                    if (brand && model) return { brand, model };
                }
            } catch(e) {}
        }
        
        const scripts = document.querySelectorAll('script');
        for (const s of scripts) {
            const txt = s.textContent;
            let m = txt.match(/"manufacturerEnglishName":"([^"]+)"/);
            if (m && !brand) brand = m[1];
            m = txt.match(/"modelEnglishName":"([^"]+)"/);
            if (m && !model) model = m[1];
            if (brand && model) break;
        }
        
        if (brand && !/^[A-Z]+$/.test(brand)) brand = translateBrand(brand);
        if (model) model = model.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
        
        return (brand || model) ? { brand, model } : null;
    }
    
    // ========== ГОД ==========
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
    
    // ========== VIN ==========
    function getVinNumber() {
        if (window.__PRELOADED_STATE__) {
            try {
                const vin = window.__PRELOADED_STATE__.cars?.base?.vehicleNo;
                if (vin && vin.length === 17) return vin.toUpperCase();
            } catch(e) {}
        }
        
        const body = document.body.innerText;
        const vinMatch = body.match(/[A-HJ-NPR-Z0-9]{17}/i);
        if (vinMatch) return vinMatch[0].toUpperCase();
        return null;
    }
    
    // ========== ПРОБЕГ ==========
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
    
    // ========== ОБЪЁМ ==========
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
    
    // ========== МОЩНОСТЬ ==========
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
    
    // ========== ЦЕНА ==========
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
    
    // ========== ID ==========
    function getCarId() {
        const urlMatch = window.location.href.match(/carid=(\d+)/);
        if (urlMatch) return urlMatch[1];
        if (window.__PRELOADED_STATE__?.cars?.base?.vehicleId) {
            return window.__PRELOADED_STATE__.cars.base.vehicleId;
        }
        return null;
    }
    
    // ========== ПРОСМОТРЫ ==========
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
    
    // ========== СТРАХОВЫЕ ВЫПЛАТЫ ==========
    function loadAccidentData() {
        const carId = getCarId();
        if (!carId) { 
            Hub.set('accidentTotal', '—');
            Hub.set('accidentDetails', []);
            Hub.emit('accidentData:loaded', { count: 0, totalUsd: 0, details: [] });
            return; 
        }
        
        // Сначала получаем номер автомобиля
        GM_xmlhttpRequest({
            method: 'GET',
            url: `https://api.encar.com/v1/readside/inspection/vehicle/${carId}`,
            headers: { 'Accept': 'application/json' },
            onload: (resp) => {
                if (resp.status === 200 && resp.response) {
                    try {
                        const data = JSON.parse(resp.response);
                        const vehicleNo = data.master?.detail?.carNo;
                        
                        if (vehicleNo) {
                            // Получаем страховые данные
                            GM_xmlhttpRequest({
                                method: 'GET',
                                url: `https://api.encar.com/v1/readside/record/vehicle/${carId}/open?vehicleNo=${encodeURIComponent(vehicleNo)}`,
                                headers: { 'Accept': 'application/json' },
                                onload: (resp2) => {
                                    if (resp2.status === 200 && resp2.response) {
                                        try {
                                            const accidentData = JSON.parse(resp2.response);
                                            const accidents = accidentData.accidents || [];
                                            let totalWon = 0;
                                            for (const acc of accidents) {
                                                totalWon += (acc.partCost || 0) + (acc.laborCost || 0) + (acc.paintingCost || 0);
                                            }
                                            const usdToKrw = Hub.get('usdToKrw') || 1473;
                                            const totalUsd = Math.round(totalWon / usdToKrw);
                                            
                                            if (accidentData.myAccidentCnt > 0) {
                                                Hub.set('accidentTotal', `${totalUsd.toLocaleString()} $`);
                                            } else {
                                                Hub.set('accidentTotal', 'Без ДТП');
                                            }
                                            Hub.set('accidentDetails', accidents);
                                            Hub.emit('accidentData:loaded', { 
                                                count: accidentData.myAccidentCnt || 0, 
                                                totalUsd: totalUsd, 
                                                details: accidents 
                                            });
                                            console.log(`[CarData] Страховые выплаты: ${totalUsd.toLocaleString()} $, случаев: ${accidentData.myAccidentCnt || 0}`);
                                        } catch(e) { console.error('[CarData] Ошибка парсинга страховых данных:', e); }
                                    }
                                },
                                onerror: () => console.error('[CarData] Ошибка запроса страховых данных')
                            });
                        }
                    } catch(e) { console.error('[CarData] Ошибка парсинга vehicleNo:', e); }
                }
            },
            onerror: () => console.error('[CarData] Ошибка запроса vehicleNo')
        });
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
    
    // Запуск
    setTimeout(() => collectAllCarData(), 500);
    
    console.log('[CarData] Модуль загружен v3.0');
})();
