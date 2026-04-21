// ==UserScript==
// @name         Encar Calculations Module
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Расчёт ТПО, утильсбора, итоговой стоимости
// @match        *://www.encar.com/cars/detail/*
// @match        *://fem.encar.com/cars/detail/*
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    if (!unsafeWindow.EncarHub) {
        console.error('[Calculations] CoreHub не найден!');
        return;
    }

    const Hub = unsafeWindow.EncarHub;

    // Значения по умолчанию для расходов
    const DEFAULT_EXPENSES = {
        koreaLogistics: 4000,   // $
        servicesBishkek: 1200,  // $
        docsRf: 80000,          // ₽
        ourServices: 250000     // ₽
    };

    // Расчёт ТПО
    function calculateTpo() {
        const manualTpo = Hub.get('manualTpo');
        if (manualTpo !== null && manualTpo !== undefined) return manualTpo;

        const euroPrice = Hub.get('selectedEuroPrice');
        const eurUsdRate = Hub.get('eurUsdRate');

        if (euroPrice && euroPrice > 0 && eurUsdRate > 0) {
            return Math.round(euroPrice * eurUsdRate * 0.48);
        }
        return null;
    }

    // Расчёт утильсбора
    function calculateUtilizationFee(engineCc, hp) {
        const manualFee = Hub.get('manualUtilizationFee');
        if (manualFee !== null && manualFee !== undefined) return manualFee;

        if (!engineCc || !hp) return null;
        if (engineCc === 0) return 26000;

        // Логика расчёта в зависимости от объёма и мощности
        if (engineCc <= 2000) {
            if (hp <= 160) return 3400;
            if (hp < 190) return 900000;
            if (hp < 220) return 952800;
            if (hp < 250) return 1010400;
            if (hp < 280) return 1114200;
            if (hp < 310) return 1291200;
            if (hp < 340) return 1459200;
            if (hp < 370) return 1663200;
            if (hp < 400) return 1896000;
            if (hp < 500) return 2808000;
            return 2808000;
        }

        if (engineCc <= 3000) {
            if (hp <= 160) return 3400;
            if (hp <= 190) return 2306800;
            if (hp <= 250) return 2402400;
            if (hp <= 310) return 2620800;
            if (hp <= 400) return 2949000;
            return 3189600;
        }

        // Для больших объёмов
        return 5200000;
    }

    // Расчёт итоговой стоимости
    function calculateTotalPrice() {
        const carPriceKrw = Hub.get('carPriceKrw') || 0;
        const usdToKrw = Hub.get('usdToKrw') || 1473;
        const usdtRate = Hub.get('usdtRate') || 90;

        const priceUsd = carPriceKrw ? Math.round(carPriceKrw / usdToKrw) : 0;
        const koreaLogistics = Hub.get('koreaLogistics') || DEFAULT_EXPENSES.koreaLogistics;
        const tpoValue = calculateTpo() || 0;
        const servicesBishkek = Hub.get('servicesBishkek') || DEFAULT_EXPENSES.servicesBishkek;
        const utilizationFee = Hub.get('utilizationFee') || 0;
        const docsRf = Hub.get('docsRf') || DEFAULT_EXPENSES.docsRf;
        const ourServices = Hub.get('ourServices') || DEFAULT_EXPENSES.ourServices;

        const totalUsd = priceUsd + koreaLogistics + tpoValue + servicesBishkek;
        const totalRubBeforeFees = totalUsd * usdtRate;

        return Math.round(totalRubBeforeFees + utilizationFee + docsRf + ourServices);
    }

    // Обновление утильсбора при изменении данных
    function updateUtilizationFee() {
        const engineCc = Hub.get('carEngineVolume');
        const hp = Hub.get('carPowerHp');

        if (engineCc && hp) {
            const fee = calculateUtilizationFee(engineCc, hp);
            Hub.set('utilizationFee', fee);
            console.log(`[Calculations] Утильсбор: ${fee?.toLocaleString()} ₽`);
        }
    }

    // Обновление всех расчётов
    function updateAllCalculations() {
        const tpo = calculateTpo();
        Hub.set('calculatedTpo', tpo);

        updateUtilizationFee();

        const total = calculateTotalPrice();
        Hub.set('totalPrice', total);

        Hub.emit('calculations:updated', { tpo, total });
    }

    // Загрузка сохранённых настроек
    function loadSettingsFromStorage() {
        const saved = localStorage.getItem('encar_settings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                if (Date.now() - settings.timestamp < 90 * 24 * 60 * 60 * 1000) {
                    Hub.set('koreaLogistics', settings.koreaLogistics || DEFAULT_EXPENSES.koreaLogistics);
                    Hub.set('servicesBishkek', settings.servicesBishkek || DEFAULT_EXPENSES.servicesBishkek);
                    Hub.set('docsRf', settings.docsRf || DEFAULT_EXPENSES.docsRf);
                    Hub.set('ourServices', settings.ourServices || DEFAULT_EXPENSES.ourServices);
                }
            } catch(e) {}
        } else {
            Hub.set('koreaLogistics', DEFAULT_EXPENSES.koreaLogistics);
            Hub.set('servicesBishkek', DEFAULT_EXPENSES.servicesBishkek);
            Hub.set('docsRf', DEFAULT_EXPENSES.docsRf);
            Hub.set('ourServices', DEFAULT_EXPENSES.ourServices);
        }
    }

    function saveSettingsToStorage() {
        localStorage.setItem('encar_settings', JSON.stringify({
            koreaLogistics: Hub.get('koreaLogistics'),
            servicesBishkek: Hub.get('servicesBishkek'),
            docsRf: Hub.get('docsRf'),
            ourServices: Hub.get('ourServices'),
            timestamp: Date.now()
        }));
    }

    // Подписки на изменения
    Hub.on('carEngineVolume:changed', () => updateAllCalculations());
    Hub.on('carPowerHp:changed', () => updateAllCalculations());
    Hub.on('selectedEuroPrice:changed', () => updateAllCalculations());
    Hub.on('eurUsdRate:changed', () => updateAllCalculations());
    Hub.on('usdtRate:changed', () => updateAllCalculations());
    Hub.on('usdToKrw:changed', () => updateAllCalculations());
    Hub.on('carPriceKrw:changed', () => updateAllCalculations());

    Hub.on('koreaLogistics:changed', () => { saveSettingsToStorage(); updateAllCalculations(); });
    Hub.on('servicesBishkek:changed', () => { saveSettingsToStorage(); updateAllCalculations(); });
    Hub.on('docsRf:changed', () => { saveSettingsToStorage(); updateAllCalculations(); });
    Hub.on('ourServices:changed', () => { saveSettingsToStorage(); updateAllCalculations(); });

    Hub.on('manualTpo:changed', () => updateAllCalculations());
    Hub.on('manualUtilizationFee:changed', () => updateAllCalculations());

    // Загрузка сохранённых значений
    loadSettingsFromStorage();

    // Загрузка сохранённых ручных значений
    const carId = Hub.get('carId');
    if (carId) {
        const savedTpo = localStorage.getItem(`encar_tpo_${carId}`);
        if (savedTpo) {
            try {
                const tpoData = JSON.parse(savedTpo);
                if (Date.now() - tpoData.timestamp < 30 * 24 * 60 * 60 * 1000) {
                    Hub.set('manualTpo', tpoData.tpo);
                }
            } catch(e) {}
        }

        const savedUtil = localStorage.getItem(`encar_util_${carId}`);
        if (savedUtil) {
            try {
                const utilData = JSON.parse(savedUtil);
                if (Date.now() - utilData.timestamp < 30 * 24 * 60 * 60 * 1000) {
                    Hub.set('manualUtilizationFee', utilData.value);
                }
            } catch(e) {}
        }
    }

    // Сохранение ручных значений
    Hub.on('manualTpo:changed', (data) => {
        const id = Hub.get('carId');
        if (id) {
            localStorage.setItem(`encar_tpo_${id}`, JSON.stringify({
                tpo: data.value,
                timestamp: Date.now()
            }));
        }
    });

    Hub.on('manualUtilizationFee:changed', (data) => {
        const id = Hub.get('carId');
        if (id) {
            localStorage.setItem(`encar_util_${id}`, JSON.stringify({
                value: data.value,
                timestamp: Date.now()
            }));
        }
    });

    // Первичный расчёт
    setTimeout(() => updateAllCalculations(), 500);

    console.log('[Calculations] Модуль загружен');
})();
