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
        '현대': 'HYUNDAI', '기아': 'KIA', '기아(아시아)': 'KIA', '대우': 'DAEWOO',
        '쉐보레': 'CHEVROLET', '르노삼성': 'RENAULT', '삼성': 'SAMSUNG',
        '벤츠': 'MERCEDES-BENZ', 'BMW': 'BMW', '아우디': 'AUDI',
        '폭스바겐': 'VOLKSWAGEN', '볼보': 'VOLVO', '포드': 'FORD',
        '도요타': 'TOYOTA', '혼다': 'HONDA', '닛산': 'NISSAN', '미니': 'MINI',
        '푸조': 'PEUGEOT', '지프': 'JEEP', '랜드로버': 'LAND ROVER',
        '재규어': 'JAGUAR', '포르쉐': 'PORSCHE', '렉서스': 'LEXUS',
        '인피니티': 'INFINITI', '마쓰다': 'MAZDA', '미쓰비시': 'MITSUBISHI',
        '스바루': 'SUBARU', '벤틀리': 'BENTLEY', '테슬라': 'TESLA'
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
                const cat = window.__PRELOADED_STATE__.cars?.base?.category || 
                           window.__PRELOADED_STATE__.cars?.detail?.category;
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
            m = txt.match(/"manufacturerName":"([^"]+)"/);
            if (m && !brand) brand = m[1];
            m = txt.match(/"modelEnglishName":"([^"]+)"/);
            if (m && !model) model = m[1];
            m = txt.match(/"modelName":"([^"]+)"/);
            if (m && !model) model = m[1];
            if (brand && model) break;
        }
        
        const title = document.title;
        const titleMatch = title.match(/^([A-Z]+)\s+([^(]+)/);
        if (titleMatch && (!brand || !model)) {
            brand = brand || titleMatch[1];
            model = model || titleMatch[2].trim();
        }
        
        if (brand && !/^[A-Z]+$/.test(brand)) brand = translateBrand(brand);
        if (model) model = model.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
        
        return (brand || model) ? { brand, model } : null;
    }
    
    // ========== ГОД И МЕСЯЦ ==========
    function getCarYearMonth() {
        let year = null, month = null;
        
        if (window.__PRELOADED_STATE__) {
            try {
                const cat = window.__PRELOADED_STATE__.cars?.base?.category;
                if (cat) {
                    if (cat.yearMonth && cat.yearMonth.length === 6) {
                        year = cat.yearMonth.slice(0, 4);
                        month = cat.yearMonth.slice(4, 6);
                        return { year, month };
                    }
                    if (cat.formYear) return { year: cat.formYear, month: null };
                }
            } catch(e) {}
        }
        
        const scripts = document.querySelectorAll('script');
        for (const s of scripts) {
            const txt = s.textContent;
            let m = txt.match(/"yearMonth":"(\d{4})(\d{2})"/);
            if (m) return { year: m[1], month: m[2] };
            m = txt.match(/"year":(\d{4})/);
            if (m && !year) year = m[1];
            m = txt.match(/"month":(\d{1,2})/);
            if (m && !month) month = m[1].padStart(2, '0');
            if (year) break;
        }
        
        const body = document.body.innerText;
        let m = body.match(/(\d{4})년형?/);
        if (m && !year) year = m[1];
        m = body.match(/(\d{4})\.(\d{2})/);
        if (m && !year) { year = m[1]; month = m[2]; }
        
        return year ? { year, month } : null;
    }
    
    // ========== VIN НОМЕР ==========
    function getVinNumber() {
        if (window.__PRELOADED_STATE__) {
            try {
                const vin = window.__PRELOADED_STATE__.cars?.base?.vehicleNo ||
                           window.__PRELOADED_STATE__.cars?.base?.vin ||
                           window.__PRELOADED_STATE__.cars?.detail?.vehicleNo ||
                           window.__PRELOADED_STATE__.vehicleNo;
                if (vin && vin.length === 17) return vin.toUpperCase();
            } catch(e) {}
        }
        
        const urlMatch = window.location.href.match(/[?&]vin=([A-HJ-NPR-Z0-9]{17})/i);
        if (urlMatch) return urlMatch[1].toUpperCase();
        
        const body = document.body.innerText;
        const vinMatch = body.match(/[A-HJ-NPR-Z0-9]{17}/i);
        if (vinMatch) return vinMatch[0].toUpperCase();
        
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
            let match = script.textContent.match(/[A-HJ-NPR-Z0-9]{17}/i);
            if (match && match[0].length === 17) return match[0].toUpperCase();
        }
        
        return null;
    }
    
    // ========== ПРОБЕГ ==========
    function getCarMileage() {
        if (window.__PRELOADED_STATE__) {
            try {
                return window.__PRELOADED_STATE__.cars?.base?.spec?.mileage ||
                       window.__PRELOADED_STATE__.cars?.base?.mileage;
            } catch(e) {}
        }
        const body = document.body.innerText;
        const match = body.match(/주행거리\s*:?\s*([\d,]+)\s*km/i);
        if (match) return parseInt(match[1].replace(/,/g, ''));
        return null;
    }
    
    // ========== ОБЪЁМ ДВИГАТЕЛЯ ==========
    function getEngineVolume() {
        if (window.__PRELOADED_STATE__) {
            try {
                const vol = window.__PRELOADED_STATE__.cars?.base?.spec?.displacement;
                if (vol) return Math.ceil(parseInt(vol) / 100) * 100;
            } catch(e) {}
        }
        const scripts = document.querySelectorAll('script');
        for (const s of scripts) {
            const m = s.textContent.match(/"displacement"\s*:\s*(\d+)/);
            if (m) return Math.ceil(parseInt(m[1]) / 100) * 100;
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
                const base = window.__PRELOADED_STATE__.cars?.base;
                if (base?.spec?.maxPower) {
                    const kw = base.spec.maxPower;
                    return { hp: kwToHp(kw), kw: kw };
                }
            } catch(e) {}
        }
        const scripts = document.querySelectorAll('script');
        for (const s of scripts) {
            const m = s.textContent.match(/"maxPower"\s*:\s*(\d+)/);
            if (m) {
                const kw = parseInt(m[1]);
                return { hp: kwToHp(kw), kw: kw };
            }
        }
        const body = document.body.innerText;
        const match = body.match(/(\d{2,3})\s*(?:PS|마력)/);
        if (match) return { hp: parseInt(match[1]), kw: Math.round(parseInt(match[1]) / 1.341) };
        return null;
    }
    
    // ========== ЦЕНА В KRW ==========
    function getCarPriceKrw() {
        if (window.__PRELOADED_STATE__) {
            try {
                const price = window.__PRELOADED_STATE__.cars?.base?.advertisement?.price;
                if (price) return parseInt(price) * 10000;
                const price2 = window.__PRELOADED_STATE__.cars?.base?.price;
                if (price2) return price2;
            } catch(e) {}
        }
        const body = document.body.innerText;
        const match = body.match(/(\d{1,3}(?:,\d{3})*)\s*만원/);
        if (match) return parseInt(match[1].replace(/,/g, '')) * 10000;
        return null;
    }
    
    // ========== ID АВТО ==========
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
    let accidentDetails = null;
    
    function getVehicleNumber(carId, callback) {
        const body = document.body.innerText;
        let match = body.match(/차량번호\s*:?\s*([가-힣0-9]+)/);
        if (match && match[1]) { callback(match[1]); return; }
        
        if (window.__PRELOADED_STATE__?.cars?.base?.carNumber) {
            callback(window.__PRELOADED_STATE__.cars.base.carNumber);
            return;
        }
        
        GM_xmlhttpRequest({
            method: 'GET',
            url: `https://api.encar.com/v1/readside/inspection/vehicle/${carId}`,
            headers: { 'Accept': 'application/json' },
            onload: (resp) => {
                if (resp.status === 200 && resp.response) {
                    try {
                        const data = JSON.parse(resp.response);
                        const carNo = data.master?.detail?.carNo;
                        if (carNo) { callback(carNo); return; }
                    } catch(e) {}
                }
                callback(null);
            },
            onerror: () => callback(null)
        });
    }
    
    function fetchAccidentData(carId, vehicleNo, callback) {
        const url = `https://api.encar.com/v1/readside/record/vehicle/${carId}/open?vehicleNo=${encodeURIComponent(vehicleNo)}`;
        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            headers: { 'Accept': 'application/json' },
            onload: (resp) => {
                if (resp.status === 200 && resp.response) {
                    try {
                        const data = JSON.parse(resp.response);
                        const accidents = data.accidents || [];
                        let totalPaymentWon = 0;
                        for (const acc of accidents) {
                            totalPaymentWon += (acc.partCost || 0) + (acc.laborCost || 0) + (acc.paintingCost || 0);
                        }
                        const usdToKrw = Hub.get('usdToKrw') || 1473;
                        const totalPaymentUsd = Math.round(totalPaymentWon / usdToKrw);
                        const result = { 
                            count: data.myAccidentCnt || 0, 
                            totalWon: totalPaymentWon, 
                            totalUsd: totalPaymentUsd, 
                            details: accidents 
                        };
                        callback(result);
                    } catch(e) { callback(null); }
                } else { callback(null); }
            },
            onerror: () => callback(null)
        });
    }
    
    function loadAccidentData() {
        const carId = getCarId();
        if (!carId) { 
            Hub.set('accidentTotal', '—');
            Hub.set('accidentDetails', []);
            Hub.emit('accidentData:loaded', { count: 0, totalWon: 0, totalUsd: 0, details: [] });
            return; 
        }
        
        getVehicleNumber(carId, (vehicleNo) => {
            if (!vehicleNo) { 
                Hub.set('accidentTotal', '—');
                Hub.set('accidentDetails', []);
                Hub.emit('accidentData:loaded', { count: 0, totalWon: 0, totalUsd: 0, details: [] });
                return; 
            }
            
            fetchAccidentData(carId, vehicleNo, (info) => {
                accidentDetails = info || { count: 0, totalWon: 0, totalUsd: 0, details: [] };
                if (accidentDetails.totalUsd) {
                    Hub.set('accidentTotal', `${accidentDetails.totalUsd.toLocaleString()} $`);
                } else if (accidentDetails.count === 0) {
                    Hub.set('accidentTotal', 'Без ДТП');
                } else {
                    Hub.set('accidentTotal', '—');
                }
                Hub.set('accidentDetails', accidentDetails.details || []);
                Hub.emit('accidentData:loaded', accidentDetails);
                console.log(`[CarData] Страховые выплаты: ${accidentDetails.totalUsd?.toLocaleString() || 0} $, случаев: ${accidentDetails.count}`);
            });
        });
    }
    
    // ========== ГЛАВНАЯ ФУНКЦИЯ СБОРА ==========
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
            month: Hub.get('carMonth'),
            vin: Hub.get('carVin'),
            mileage: Hub.get('carMileage'),
            engineVolume: Hub.get('carEngineVolume'),
            priceKrw: Hub.get('carPriceKrw'),
            powerHp: Hub.get('carPowerHp')
        });
        
        Hub.emit('carData:ready', Hub.getAll());
        
        // Загружаем страховые выплаты
        loadAccidentData();
    }
    
    // Загрузка сохранённой мощности
    function loadSavedPower() {
        const carId = getCarId();
        if (!carId) return false;
        
        const saved = localStorage.getItem(`encar_power_${carId}`);
        if (saved) {
            try {
                const powerData = JSON.parse(saved);
                if (Date.now() - powerData.timestamp < 30 * 24 * 60 * 60 * 1000) {
                    Hub.set('carPowerHp', powerData.hp);
                    Hub.set('carPowerKw', powerData.kw);
                    return true;
                }
            } catch(e) {}
        }
        return false;
    }
    
    Hub.on('carPowerHp:changed', (data) => {
        const carId = Hub.get('carId');
        if (carId) {
            localStorage.setItem(`encar_power_${carId}`, JSON.stringify({
                hp: data.value,
                kw: Hub.get('carPowerKw'),
                timestamp: Date.now()
            }));
        }
    });
    
    // Запуск
    loadSavedPower();
    setTimeout(() => collectAllCarData(), 500);
    
    console.log('[CarData] Модуль загружен, сбор начнётся через 500ms');
})();
