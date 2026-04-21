// ==UserScript==
// @name         Encar Currency Module
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Курсы валют (USD, EUR, KRW)
// @match        *://www.encar.com/cars/detail/*
// @match        *://fem.encar.com/cars/detail/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    // Ждём, пока ядро загрузится
    if (!unsafeWindow.EncarHub) {
        console.error('[Currency] CoreHub не найден!');
        return;
    }

    const Hub = unsafeWindow.EncarHub;

    // Значения по умолчанию
    const DEFAULT_RATES = {
        usdRate: 96.5,
        eurRate: 104.2,
        usdToKrw: 1473,
        eurUsdRate: 1.08,
        usdtRate: 90,
        lastUpdateTime: null
    };

    // Загрузка курсов с ЦБ РФ
    function fetchCurrencyRates() {
        console.log('[Currency] Загрузка курсов...');

        GM_xmlhttpRequest({
            method: 'GET',
            url: 'https://cbr-xml-daily.ru/daily.xml',
            timeout: 10000,
            onload: function(response) {
                if (response.status === 200 && response.response) {
                    try {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response.response, 'text/xml');

                        const usdNode = doc.querySelector('Valute[ID="R01235"] Value');
                        const eurNode = doc.querySelector('Valute[ID="R01239"] Value');
                        const krwNode = doc.querySelector('Valute[ID="R01815"] Value');

                        const usdRate = usdNode ? parseFloat(usdNode.textContent.replace(',', '.')) : DEFAULT_RATES.usdRate;
                        const eurRate = eurNode ? parseFloat(eurNode.textContent.replace(',', '.')) : DEFAULT_RATES.eurRate;

                        let usdToKrw = DEFAULT_RATES.usdToKrw;
                        if (krwNode && usdRate) {
                            const krwRubRate = parseFloat(krwNode.textContent.replace(',', '.'));
                            usdToKrw = (usdRate / krwRubRate) * 1000;
                        }

                        const eurUsdRate = eurRate / usdRate;
                        const lastUpdateTime = new Date();

                        Hub.set('usdRate', usdRate);
                        Hub.set('eurRate', eurRate);
                        Hub.set('usdToKrw', usdToKrw);
                        Hub.set('eurUsdRate', eurUsdRate);
                        Hub.set('lastCurrencyUpdate', lastUpdateTime);

                        console.log(`[Currency] Курсы: USD=${usdRate.toFixed(2)}, EUR=${eurRate.toFixed(2)}, USD/KRW=${Math.round(usdToKrw)}`);
                    } catch(e) {
                        console.error('[Currency] Ошибка парсинга:', e);
                        setDefaultRates();
                    }
                } else {
                    console.error('[Currency] Ошибка HTTP:', response.status);
                    setDefaultRates();
                }
            },
            onerror: function(err) {
                console.error('[Currency] Ошибка сети:', err);
                setDefaultRates();
            },
            ontimeout: function() {
                console.error('[Currency] Таймаут запроса');
                setDefaultRates();
            }
        });
    }

    function setDefaultRates() {
        Hub.set('usdRate', DEFAULT_RATES.usdRate);
        Hub.set('eurRate', DEFAULT_RATES.eurRate);
        Hub.set('usdToKrw', DEFAULT_RATES.usdToKrw);
        Hub.set('eurUsdRate', DEFAULT_RATES.eurUsdRate);
        Hub.set('lastCurrencyUpdate', new Date());
        console.log('[Currency] Установлены курсы по умолчанию');
    }

    // Обновление USDT курса (можно редактировать вручную)
    function loadUsdtFromStorage() {
        const saved = localStorage.getItem('encar_usdt_rate');
        if (saved) {
            try {
                const rate = parseFloat(saved);
                if (!isNaN(rate) && rate > 0) {
                    Hub.set('usdtRate', rate);
                    return;
                }
            } catch(e) {}
        }
        Hub.set('usdtRate', DEFAULT_RATES.usdtRate);
    }

    function saveUsdtRate(rate) {
        localStorage.setItem('encar_usdt_rate', rate.toString());
    }

    // Подписываемся на изменение USDT курса
    Hub.on('usdtRate:changed', (data) => {
        saveUsdtRate(data.value);
    });

    // Запуск
    loadUsdtFromStorage();
    fetchCurrencyRates();

    // Обновляем курсы каждый час
    setInterval(() => fetchCurrencyRates(), 3600000);

    // Экспортируем методы для ручного обновления
    unsafeWindow.EncarCurrency = {
        refresh: fetchCurrencyRates,
        setUsdtRate: (rate) => Hub.set('usdtRate', rate)
    };

    console.log('[Currency] Модуль загружен');
})();
