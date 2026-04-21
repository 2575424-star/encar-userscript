// ==UserScript==
// @name         Encar Car Data Module FIXED
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Улучшенный сбор данных с Encar
// @match        *://www.encar.com/cars/detail/*
// @match        *://fem.encar.com/cars/detail/*
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    if (!unsafeWindow.EncarHub) {
        console.error('[CarData] CoreHub не найден!');
        return;
    }

    const Hub = unsafeWindow.EncarHub;

    // ========== РАСШИРЕННЫЙ ПЕРЕВОД МАРОК ==========
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

        // Способ 1: из PRELOADED_STATE
        if (window.__PRELOADED_STATE__) {
            try {
                const cat = window.__PRELOADED_STATE__.cars?.base?.category ||
                           window.__PRELOADED_STATE__.cars?.detail?.category;
                if (cat) {
                    brand = cat.manufacturerEnglishName || cat.manufacturerName;
                    model = cat.modelEnglishName || cat.modelName;
                    if (brand && model) {
                        console.log(`[CarData] Способ 1: ${brand} ${model}`);
                        return { brand, model };
                    }
                }
            } catch(e) {}
        }

        // Способ 2: из скриптов с регулярками
        const scripts = document.querySelectorAll('script');
        for (const s of scripts) {
            const txt = s.textContent;

            // Ищем manufacturerEnglishName
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

        // Способ 3: из заголовка страницы
        if (!brand || !model) {
            const title = document.title;
            // Пример: "BMW X6 (G06) - 2023년형 - 엔카"
            const match = title.match(/^([A-Z]+)\s+([^(]+)/);
            if (match) {
                brand = match[1];
                model = match[2].trim();
            }
        }

        if (brand && !/^[A-Z]+$/.test(brand)) brand = translateBrand(brand);
        if (model) model = model.replace(/\s*\([^)]*\)\s*/g, ' ').trim();

        return (brand || model) ? { brand, model } : null;
    }

    // ========== ГОД И МЕСЯЦ (УЛУЧШЕННЫЙ) ==========
    function getCarYearMonth() {
        let year = null, month = null;

        // Способ 1: из PRELOADED_STATE
        if (window.__PRELOADED_STATE__) {
            try {
                const cat = window.__PRELOADED_STATE__.cars?.base?.category;
                if (cat) {
                    if (cat.yearMonth && cat.yearMonth.length === 6) {
                        year = cat.yearMonth.slice(0, 4);
                        month = cat.yearMonth.slice(4, 6);
                        console.log(`[CarData] Год/месяц способ 1: ${year}/${month}`);
                        return { year, month };
                    }
                    if (cat.formYear) {
                        year = cat.formYear;
                        console.log(`[CarData] Год способ 1: ${year}`);
                        return { year, month };
                    }
                }
            } catch(e) {}
        }

        // Способ 2: из скриптов
        const scripts = document.querySelectorAll('script');
        for (const s of scripts) {
            const txt = s.textContent;

            // Ищем yearMonth
            let m = txt.match(/"yearMonth":"(\d{4})(\d{2})"/);
            if (m) {
                year = m[1];
                month = m[2];
                console.log(`[CarData] Год/месяц способ 2: ${year}/${month}`);
                return { year, month };
            }

            // Ищем отдельно year и month
            m = txt.match(/"year":(\d{4})/);
            if (m && !year) year = m[1];

            m = txt.match(/"month":(\d{1,2})/);
            if (m && !month) month = m[1].padStart(2, '0');

            if (year) break;
        }

        // Способ 3: из текста страницы
        if (!year) {
            const body = document.body.innerText;

            // Поиск "2023년" или "2023년형"
            let m = body.match(/(\d{4})년형?/);
            if (m) {
                year = m[1];
                console.log(`[CarData] Год способ 3: ${year}`);
                return { year, month };
            }

            // Поиск в формате "2023.06"
            m = body.match(/(\d{4})\.(\d{2})/);
            if (m) {
                year = m[1];
                month = m[2];
                console.log(`[CarData] Год/месяц способ 3: ${year}/${month}`);
                return { year, month };
            }
        }

        console.log(`[CarData] Год не найден, year=${year}, month=${month}`);
        return year ? { year, month } : null;
    }

    // ========== VIN НОМЕР (РАСШИРЕННЫЙ ПОИСК) ==========
    function getVinNumber() {
        let vin = null;

        // Способ 1: из PRELOADED_STATE
        if (window.__PRELOADED_STATE__) {
            try {
                vin = window.__PRELOADED_STATE__.cars?.base?.vehicleNo ||
                      window.__PRELOADED_STATE__.cars?.base?.vin ||
                      window.__PRELOADED_STATE__.cars?.detail?.vehicleNo ||
                      window.__PRELOADED_STATE__.vehicleNo;
                if (vin && vin.length === 17) {
                    console.log(`[CarData] VIN способ 1: ${vin}`);
                    return vin.toUpperCase();
                }
            } catch(e) {}
        }

        // Способ 2: из URL
        const urlMatch = window.location.href.match(/[?&]vin=([A-HJ-NPR-Z0-9]{17})/i);
        if (urlMatch) {
            console.log(`[CarData] VIN способ 2: ${urlMatch[1]}`);
            return urlMatch[1].toUpperCase();
        }

        // Способ 3: из текста страницы
        const body = document.body.innerText;
        let match = body.match(/[A-HJ-NPR-Z0-9]{17}/i);
        if (match) {
            console.log(`[CarData] VIN способ 3: ${match[0]}`);
            return match[0].toUpperCase();
        }

        // Способ 4: из скриптов с конкретными ключами
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
            const txt = script.textContent;

            let m = txt.match(/"vehicleNo":"([A-Z0-9]{17})"/);
            if (m) {
                vin = m[1];
                break;
            }
            m = txt.match(/"vin":"([A-Z0-9]{17})"/);
            if (m) {
                vin = m[1];
                break;
            }
            m = txt.match(/[A-HJ-NPR-Z0-9]{17}/);
            if (m && m[0].length === 17) {
                vin = m[0];
                break;
            }
        }

        if (vin && vin.length === 17) {
            console.log(`[CarData] VIN способ 4: ${vin}`);
            return vin.toUpperCase();
        }

        console.log('[CarData] VIN не найден');
        return null;
    }

    // ========== ПРОБЕГ ==========
    function getCarMileage() {
        if (window.__PRELOADED_STATE__) {
            try {
                const mileage = window.__PRELOADED_STATE__.cars?.base?.spec?.mileage ||
                               window.__PRELOADED_STATE__.cars?.base?.mileage;
                if (mileage) {
                    console.log(`[CarData] Пробег способ 1: ${mileage}`);
                    return mileage;
                }
            } catch(e) {}
        }

        const body = document.body.innerText;
        const match = body.match(/주행거리\s*:?\s*([\d,]+)\s*km/i);
        if (match) {
            const mileage = parseInt(match[1].replace(/,/g, ''));
            console.log(`[CarData] Пробег способ 2: ${mileage}`);
            return mileage;
        }

        return null;
    }

    // ========== ОБЪЁМ ДВИГАТЕЛЯ (УЛУЧШЕННЫЙ) ==========
    function getEngineVolume() {
        let volume = null;

        // Способ 1: из PRELOADED_STATE
        if (window.__PRELOADED_STATE__) {
            try {
                volume = window.__PRELOADED_STATE__.cars?.base?.spec?.displacement;
                if (volume) {
                    volume = Math.ceil(parseInt(volume) / 100) * 100;
                    console.log(`[CarData] Объём способ 1: ${volume}cc`);
                    return volume;
                }
            } catch(e) {}
        }

        // Способ 2: из скриптов
        const scripts = document.querySelectorAll('script');
        for (const s of scripts) {
            const txt = s.textContent;

            // Ищем displacement
            let m = txt.match(/"displacement"\s*:\s*(\d+)/);
            if (m) {
                volume = Math.ceil(parseInt(m[1]) / 100) * 100;
                console.log(`[CarData] Объём способ 2: ${volume}cc`);
                return volume;
            }

            // Ищем engineCapacity
            m = txt.match(/"engineCapacity"\s*:\s*(\d+)/);
            if (m) {
                volume = Math.ceil(parseInt(m[1]) / 100) * 100;
                console.log(`[CarData] Объём способ 2b: ${volume}cc`);
                return volume;
            }
        }

        // Способ 3: из текста страницы
        const body = document.body.innerText;
        let match = body.match(/(\d{3,4})\s*cc/i);
        if (match) {
            volume = Math.ceil(parseInt(match[1]) / 100) * 100;
            console.log(`[CarData] Объём способ 3: ${volume}cc`);
            return volume;
        }

        // Способ 4: из модели (например, "520d" -> 2000cc, "530i" -> 3000cc)
        const model = Hub.get('carModel');
        if (model) {
            const modelMatch = model.match(/(\d{3})/);
            if (modelMatch) {
                const modelCode = parseInt(modelMatch[1]);
                if (modelCode >= 520 && modelCode < 530) volume = 2000;
                else if (modelCode >= 530 && modelCode < 540) volume = 3000;
                else if (modelCode >= 540 && modelCode < 550) volume = 4000;
                else if (modelCode >= 550) volume = 4400;
                else if (modelCode >= 320 && modelCode < 330) volume = 2000;
                else if (modelCode >= 330 && modelCode < 340) volume = 3000;
                else if (modelCode >= 340) volume = 3000;

                if (volume) {
                    console.log(`[CarData] Объём способ 4 (из модели ${modelCode}): ${volume}cc`);
                    return volume;
                }
            }
        }

        console.log('[CarData] Объём не найден');
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
                    console.log(`[CarData] Мощность способ 1: ${kw}kW / ${kwToHp(kw)}hp`);
                    return { hp: kwToHp(kw), kw: kw };
                }
                if (base?.spec?.enginePower) {
                    const kw = base.spec.enginePower;
                    console.log(`[CarData] Мощность способ 1b: ${kw}kW / ${kwToHp(kw)}hp`);
                    return { hp: kwToHp(kw), kw: kw };
                }
            } catch(e) {}
        }

        const scripts = document.querySelectorAll('script');
        for (const s of scripts) {
            const m = s.textContent.match(/"maxPower"\s*:\s*(\d+)/);
            if (m) {
                const kw = parseInt(m[1]);
                console.log(`[CarData] Мощность способ 2: ${kw}kW / ${kwToHp(kw)}hp`);
                return { hp: kwToHp(kw), kw: kw };
            }
        }

        const body = document.body.innerText;
        const match = body.match(/(\d{2,3})\s*(?:PS|마력)/);
        if (match) {
            const hp = parseInt(match[1]);
            console.log(`[CarData] Мощность способ 3: ${hp}hp`);
            return { hp: hp, kw: Math.round(hp / 1.341) };
        }

        return null;
    }

    // ========== ЦЕНА В KRW ==========
    function getCarPriceKrw() {
        if (window.__PRELOADED_STATE__) {
            try {
                const price = window.__PRELOADED_STATE__.cars?.base?.advertisement?.price;
                if (price) {
                    const priceNum = parseInt(price) * 10000;
                    console.log(`[CarData] Цена способ 1: ${priceNum.toLocaleString()} ₩`);
                    return priceNum;
                }
                const price2 = window.__PRELOADED_STATE__.cars?.base?.price;
                if (price2) {
                    console.log(`[CarData] Цена способ 1b: ${price2.toLocaleString()} ₩`);
                    return price2;
                }
            } catch(e) {}
        }

        const body = document.body.innerText;
        const match = body.match(/(\d{1,3}(?:,\d{3})*)\s*만원/);
        if (match) {
            const price = parseInt(match[1].replace(/,/g, '')) * 10000;
            console.log(`[CarData] Цена способ 2: ${price.toLocaleString()} ₩`);
            return price;
        }

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

        // Сохраняем в хаб
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

    // Небольшая задержка для загрузки страницы
    setTimeout(() => collectAllCarData(), 500);

    console.log('[CarData] Модуль загружен, сбор начнётся через 500ms');
})();
