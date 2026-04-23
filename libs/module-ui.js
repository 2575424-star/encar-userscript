// ==UserScript==
// @name         Encar UI Module (Final)
// @namespace    http://tampermonkey.net/
// @version      16.0
// @description  Финальная версия панели с детальными расходами
// @match        *://www.encar.com/cars/detail/*
// @match        *://fem.encar.com/cars/detail/*
// @grant        unsafeWindow
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';
    
    if (!unsafeWindow.EncarHub) {
        console.error('[UI] CoreHub не найден!');
        return;
    }
    
    const Hub = unsafeWindow.EncarHub;
    let mainPanel = null;
    let isDragging = false;
    let dragOffsetX = 0, dragOffsetY = 0;
    let isCollapsed = false;
    
    // ========== ДЕТАЛЬНЫЕ РАСХОДЫ (СОХРАНЯЕМЫЕ) ==========
    // Расходы Корея (в вонах)
    let koreaInspection = 150000;      // Осмотр авто
    let koreaDealerCommission = 440000; // Комиссия дилера
    let koreaDelivery = 250000;         // Доставка по Корее (150000-400000)
    let koreaEvacuator = 50000;         // Эвакуатор в порт Инчхон
    let koreaExportFeePercent = 0.4;     // Экспортные документы (%)
    let koreaExportFeeMin = 100000;      // Минимальная сумма
    let koreaFreight = 5000000;          // Фрахт до Бишкека
    
    // Расходы Бишкек (в долларах)
    let bishkekUnloading = 200;          // Разгрузка + эвакуатор
    let bishkekBroker = 400;             // СВХ, брокерские услуги
    let bishkekDelivery = 1200;          // Доставка в РФ
    
    // Расходы РФ (в рублях)
    let rfUnloading = 3000;              // Разгрузка авто
    let rfPreparation = 3000;            // Подготовка к выдаче
    let rfDocuments = 85000;             // Оформление документов
    
    // ========== ЗАГРУЗКА/СОХРАНЕНИЕ НАСТРОЕК ==========
    function loadDetailedSettings() {
        const saved = localStorage.getItem('encar_detailed_settings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                koreaInspection = settings.koreaInspection || 150000;
                koreaDealerCommission = settings.koreaDealerCommission || 440000;
                koreaDelivery = settings.koreaDelivery || 250000;
                koreaEvacuator = settings.koreaEvacuator || 50000;
                koreaExportFeePercent = settings.koreaExportFeePercent || 0.4;
                koreaExportFeeMin = settings.koreaExportFeeMin || 100000;
                koreaFreight = settings.koreaFreight || 5000000;
                bishkekUnloading = settings.bishkekUnloading || 200;
                bishkekBroker = settings.bishkekBroker || 400;
                bishkekDelivery = settings.bishkekDelivery || 1200;
                rfUnloading = settings.rfUnloading || 3000;
                rfPreparation = settings.rfPreparation || 3000;
                rfDocuments = settings.rfDocuments || 85000;
            } catch(e) {}
        }
    }
    
    function saveDetailedSettings() {
        localStorage.setItem('encar_detailed_settings', JSON.stringify({
            koreaInspection, koreaDealerCommission, koreaDelivery, koreaEvacuator,
            koreaExportFeePercent, koreaExportFeeMin, koreaFreight,
            bishkekUnloading, bishkekBroker, bishkekDelivery,
            rfUnloading, rfPreparation, rfDocuments,
            timestamp: Date.now()
        }));
    }
    
    // ========== РАСЧЁТ ИТОГОВЫХ СУММ ==========
    function calculateTotalKoreaUSD() {
        const carPriceKrw = Hub.get('carPriceKrw') || 0;
        const usdToKrw = Hub.get('usdToKrw') || 1473;
        
        // Экспортные документы (0.4% от цены авто, но не менее 100000 вон)
        let exportFee = (carPriceKrw * koreaExportFeePercent / 100);
        if (exportFee < koreaExportFeeMin) exportFee = koreaExportFeeMin;
        
        const totalKrw = carPriceKrw + koreaInspection + koreaDealerCommission + 
                         koreaDelivery + koreaEvacuator + exportFee + koreaFreight;
        return Math.round(totalKrw / usdToKrw);
    }
    
    function calculateTotalBishkekUSD() {
        return bishkekUnloading + bishkekBroker + bishkekDelivery;
    }
    
    function calculateTotalRFRUB() {
        return rfUnloading + rfPreparation + rfDocuments;
    }
    
    // Обновление глобальных переменных в Hub
    function updateGlobalExpenses() {
        // Расходы Корея в USD (без цены авто, только логистика)
        const usdToKrw = Hub.get('usdToKrw') || 1473;
        let exportFee = (Hub.get('carPriceKrw') || 0) * koreaExportFeePercent / 100;
        if (exportFee < koreaExportFeeMin) exportFee = koreaExportFeeMin;
        const koreaLogisticsOnly = Math.round((koreaInspection + koreaDealerCommission + 
                                                koreaDelivery + koreaEvacuator + exportFee + koreaFreight) / usdToKrw);
        Hub.set('koreaLogistics', koreaLogisticsOnly);
        
        // Расходы Бишкек в USD
        const bishkekTotal = bishkekUnloading + bishkekBroker + bishkekDelivery;
        Hub.set('servicesBishkek', bishkekTotal);
        
        // Расходы РФ в RUB
        const rfTotal = rfUnloading + rfPreparation + rfDocuments;
        Hub.set('docsRf', rfTotal);
        
        // Триггерим пересчёт
        Hub.emit('any:changed', {});
    }
    
    // ========== СТИЛИ ==========
    GM_addStyle(`
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        .encar-panel {
            animation: slideIn 0.3s ease-out;
        }
        
        .encar-panel button {
            transition: all 0.2s ease;
        }
        
        .encar-panel button:hover {
            transform: scale(1.02);
        }
        
        .encar-panel .clickable {
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .encar-panel .clickable:hover {
            opacity: 0.8;
            text-decoration: underline;
        }
        
        .encar-panel::-webkit-scrollbar {
            width: 4px;
        }
        
        .encar-panel::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 2px;
        }
        
        .encar-panel::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.3);
            border-radius: 2px;
        }
        
        .collapse-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            background: #fbbf24;
            border-radius: 50%;
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 16px;
            font-weight: bold;
            color: #0f172a;
        }
        
        .collapse-btn:hover {
            background: #d97706;
            transform: scale(1.05);
        }
        
        .expense-header {
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .expense-header:hover {
            opacity: 0.8;
        }
        
        .expense-content {
            margin-top: 6px;
            padding: 8px;
            background: rgba(0,0,0,0.3);
            border-radius: 8px;
            font-size: 11px;
        }
        
        .expense-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 6px;
            padding: 2px 0;
        }
        
        .expense-label {
            color: #94a3b8;
        }
        
        .expense-value {
            color: #fbbf24;
            font-weight: 600;
            cursor: pointer;
        }
        
        .expense-value:hover {
            text-decoration: underline;
        }
    `);
    
    // ========== ФОРМАТИРОВАНИЕ ==========
    function formatVolume(cc) {
        if (!cc) return '—';
        const liters = cc / 1000;
        return Number.isInteger(liters) ? `${liters}.0L` : `${liters.toFixed(1)}L`;
    }
    
    function formatMileage(mileage) {
        if (!mileage) return '—';
        if (mileage >= 10000) return `${(mileage / 10000).toFixed(1)}만 km`;
        return `${mileage.toLocaleString()} km`;
    }
    
    function formatVin(vin) {
        return vin ? vin.replace(/\s/g, '').toUpperCase() : '—';
    }
    
    function formatNumber(num) {
        return num ? num.toLocaleString() : '—';
    }
    
    // ========== ОБНОВЛЕНИЕ ПАНЕЛИ ==========
    function updatePanel() {
        if (!mainPanel) return;
        
        const brand = Hub.get('carBrand') || '—';
        const model = Hub.get('carModel') || '—';
        const modelStr = `${brand} ${model}`.trim();
        if (modelStr !== '—') {
            const titleSpan = mainPanel.querySelector('#panel-title');
            if (titleSpan) titleSpan.textContent = modelStr;
        }
        
        const views = Hub.get('carViews');
        const viewsSpan = mainPanel.querySelector('#info-views');
        if (viewsSpan) viewsSpan.textContent = views?.toLocaleString() || '—';
        
        const year = Hub.get('carYear');
        const month = Hub.get('carMonth');
        const yearStr = month ? `${year}/${month}` : (year || '—');
        const yearSpan = mainPanel.querySelector('#info-year');
        if (yearSpan) yearSpan.textContent = yearStr;
        
        const engineVolume = Hub.get('carEngineVolume');
        const engineSpan = mainPanel.querySelector('#info-engine');
        if (engineSpan) engineSpan.textContent = formatVolume(engineVolume);
        
        const power = Hub.get('carPowerHp');
        const powerSpan = mainPanel.querySelector('#info-power');
        if (powerSpan) powerSpan.textContent = power ? `${power} л.с.` : '—';
        
        const mileage = Hub.get('carMileage');
        const mileageSpan = mainPanel.querySelector('#info-mileage');
        if (mileageSpan) mileageSpan.textContent = formatMileage(mileage);
        
        const vin = Hub.get('carVin');
        const vinSpan = mainPanel.querySelector('#info-vin');
        if (vinSpan) vinSpan.textContent = formatVin(vin);
        
        const accidentTotal = Hub.get('accidentTotal');
        const accidentSpan = mainPanel.querySelector('#accident-value');
        if (accidentSpan) {
            if (accidentTotal && accidentTotal !== '—') {
                accidentSpan.innerHTML = accidentTotal;
            } else {
                accidentSpan.innerHTML = '<span style="color:#f97316;">загрузка...</span>';
            }
        }
        
        // Цена в Корее
        const carPriceKrw = Hub.get('carPriceKrw');
        const usdToKrw = Hub.get('usdToKrw') || 1473;
        const priceUsd = carPriceKrw ? Math.round(carPriceKrw / usdToKrw) : 0;
        const priceValueSpan = mainPanel.querySelector('#price-value');
        if (priceValueSpan) {
            const krwText = carPriceKrw ? formatNumber(carPriceKrw) + ' ₩' : '—';
            const usdText = priceUsd ? formatNumber(priceUsd) + ' $' : '—';
            priceValueSpan.innerHTML = `${krwText}<br><span style="font-size:13px;">${usdText}</span>`;
        }
        
        // Итоговые суммы расходов
        const totalKoreaUSD = calculateTotalKoreaUSD();
        const totalKoreaSpan = mainPanel.querySelector('#total-korea');
        if (totalKoreaSpan) totalKoreaSpan.textContent = `${formatNumber(totalKoreaUSD)} $`;
        
        const totalBishkekUSD = calculateTotalBishkekUSD();
        const totalBishkekSpan = mainPanel.querySelector('#total-bishkek');
        if (totalBishkekSpan) totalBishkekSpan.textContent = `${formatNumber(totalBishkekUSD)} $`;
        
        const totalRFRUB = calculateTotalRFRUB();
        const totalRFSpan = mainPanel.querySelector('#total-rf');
        if (totalRFSpan) totalRFSpan.textContent = `${formatNumber(totalRFRUB)} ₽`;
        
        // Стоимость авто в EUR
        const euroPrice = Hub.get('selectedEuroPrice');
        const priceEuroSpan = mainPanel.querySelector('#price-euro');
        if (priceEuroSpan) {
            priceEuroSpan.textContent = euroPrice ? `${formatNumber(euroPrice)} €` : '—';
        }
        
        // ТПО
        const tpoValue = Hub.get('calculatedTpo');
        const tpoSpan = mainPanel.querySelector('#tpo-value');
        if (tpoSpan) {
            tpoSpan.innerHTML = tpoValue ? `${formatNumber(tpoValue)} $` : '<span style="color:#f97316;">заполните</span>';
        }
        
        // Утильсбор
        const utilizationFee = Hub.get('utilizationFee');
        const utilSpan = mainPanel.querySelector('#util-value');
        if (utilSpan) {
            utilSpan.innerHTML = utilizationFee ? `${formatNumber(utilizationFee)} ₽` : '<span style="color:#f97316;">заполните</span>';
        }
        
        // Итоговая стоимость
        const totalPrice = Hub.get('totalPrice') || 0;
        const totalSpan = mainPanel.querySelector('#total-price');
        if (totalSpan) totalSpan.textContent = `${formatNumber(totalPrice)} ₽`;
        
        const collapsedTotalSpan = mainPanel.querySelector('#collapsed-total-price');
        if (collapsedTotalSpan) collapsedTotalSpan.textContent = `${formatNumber(totalPrice)} ₽`;
        
        // Курсы валют
        const usdRate = Hub.get('usdRate') || 0;
        const usdHeader = mainPanel.querySelector('#usd-header');
        if (usdHeader) usdHeader.textContent = `🇺🇸 ${usdRate.toFixed(2)}`;
        
        const eurRate = Hub.get('eurRate') || 0;
        const eurHeader = mainPanel.querySelector('#eur-header');
        if (eurHeader) eurHeader.textContent = `🇪🇺 ${eurRate.toFixed(2)}`;
        
        const usdToKrwRate = Hub.get('usdToKrw') || 0;
        const krwHeader = mainPanel.querySelector('#krw-header');
        if (krwHeader) krwHeader.textContent = `🇰🇷 ${Math.round(usdToKrwRate)}`;
        
        const usdtRate = Hub.get('usdtRate') || 0;
        const usdtHeader = mainPanel.querySelector('#usdt-header');
        if (usdtHeader) usdtHeader.textContent = `💎 ${usdtRate.toFixed(2)}`;
    }
    
    // ========== ОБНОВЛЕНИЕ ДЕТАЛЬНЫХ РАСХОДОВ ==========
    function updateDetailedExpenses() {
        const koreaDetailsDiv = document.getElementById('korea-details-inner');
        const bishkekDetailsDiv = document.getElementById('bishkek-details-inner');
        const rfDetailsDiv = document.getElementById('rf-details-inner');
        
        const usdToKrw = Hub.get('usdToKrw') || 1473;
        const carPriceKrw = Hub.get('carPriceKrw') || 0;
        let exportFee = carPriceKrw * koreaExportFeePercent / 100;
        if (exportFee < koreaExportFeeMin) exportFee = koreaExportFeeMin;
        
        if (koreaDetailsDiv) {
            koreaDetailsDiv.innerHTML = `
                <div class="expense-row"><span class="expense-label">🔍 Осмотр авто:</span><span class="expense-value" data-expense="koreaInspection">${formatNumber(koreaInspection)} ₩ (${Math.round(koreaInspection/usdToKrw)} $)</span></div>
                <div class="expense-row"><span class="expense-label">💰 Комиссия дилера:</span><span class="expense-value" data-expense="koreaDealerCommission">${formatNumber(koreaDealerCommission)} ₩ (${Math.round(koreaDealerCommission/usdToKrw)} $)</span></div>
                <div class="expense-row"><span class="expense-label">🚚 Доставка по Корее:</span><span class="expense-value" data-expense="koreaDelivery">${formatNumber(koreaDelivery)} ₩ (${Math.round(koreaDelivery/usdToKrw)} $)</span></div>
                <div class="expense-row"><span class="expense-label">🔄 Эвакуатор в порт Инчхон:</span><span class="expense-value" data-expense="koreaEvacuator">${formatNumber(koreaEvacuator)} ₩ (${Math.round(koreaEvacuator/usdToKrw)} $)</span></div>
                <div class="expense-row"><span class="expense-label">📄 Экспортные документы:</span><span class="expense-value" data-expense="koreaExportFee">${koreaExportFeePercent}% (мин ${formatNumber(koreaExportFeeMin)} ₩) = ${formatNumber(exportFee)} ₩ (${Math.round(exportFee/usdToKrw)} $)</span></div>
                <div class="expense-row"><span class="expense-label">🚢 Фрахт до Бишкека:</span><span class="expense-value" data-expense="koreaFreight">${formatNumber(koreaFreight)} ₩ (${Math.round(koreaFreight/usdToKrw)} $)</span></div>
                <div class="expense-row" style="margin-top:6px; padding-top:6px; border-top:1px solid #334155;"><span class="expense-label" style="font-weight:bold;">💰 ИТОГО КОРЕЯ:</span><span class="expense-value" style="color:#fbbf24; font-weight:bold;">${formatNumber(calculateTotalKoreaUSD())} $</span></div>
            `;
        }
        
        if (bishkekDetailsDiv) {
            bishkekDetailsDiv.innerHTML = `
                <div class="expense-row"><span class="expense-label">📦 Разгрузка + эвакуатор:</span><span class="expense-value" data-expense="bishkekUnloading">${formatNumber(bishkekUnloading)} $</span></div>
                <div class="expense-row"><span class="expense-label">📋 СВХ + брокерские услуги:</span><span class="expense-value" data-expense="bishkekBroker">${formatNumber(bishkekBroker)} $</span></div>
                <div class="expense-row"><span class="expense-label">🚚 Доставка в РФ:</span><span class="expense-value" data-expense="bishkekDelivery">${formatNumber(bishkekDelivery)} $</span></div>
                <div class="expense-row" style="margin-top:6px; padding-top:6px; border-top:1px solid #334155;"><span class="expense-label" style="font-weight:bold;">💰 ИТОГО БИШКЕК:</span><span class="expense-value" style="color:#fbbf24; font-weight:bold;">${formatNumber(calculateTotalBishkekUSD())} $</span></div>
            `;
        }
        
        if (rfDetailsDiv) {
            rfDetailsDiv.innerHTML = `
                <div class="expense-row"><span class="expense-label">🔄 Разгрузка авто:</span><span class="expense-value" data-expense="rfUnloading">${formatNumber(rfUnloading)} ₽</span></div>
                <div class="expense-row"><span class="expense-label">🔧 Подготовка к выдаче:</span><span class="expense-value" data-expense="rfPreparation">${formatNumber(rfPreparation)} ₽</span></div>
                <div class="expense-row"><span class="expense-label">📄 Оформление документов:</span><span class="expense-value" data-expense="rfDocuments">${formatNumber(rfDocuments)} ₽</span></div>
                <div class="expense-row" style="margin-top:6px; padding-top:6px; border-top:1px solid #334155;"><span class="expense-label" style="font-weight:bold;">💰 ИТОГО РФ:</span><span class="expense-value" style="color:#fbbf24; font-weight:bold;">${formatNumber(calculateTotalRFRUB())} ₽</span></div>
            `;
        }
        
        // Добавляем обработчики для редактирования
        document.querySelectorAll('[data-expense]').forEach(el => {
            const expenseName = el.getAttribute('data-expense');
            el.onclick = () => editExpense(expenseName);
        });
    }
    
    function editExpense(expenseName) {
        let currentValue, promptText, isWon = false;
        
        switch(expenseName) {
            case 'koreaInspection':
                currentValue = koreaInspection;
                promptText = 'Осмотр авто (вон):';
                isWon = true;
                break;
            case 'koreaDealerCommission':
                currentValue = koreaDealerCommission;
                promptText = 'Комиссия дилера (вон):';
                isWon = true;
                break;
            case 'koreaDelivery':
                currentValue = koreaDelivery;
                promptText = 'Доставка по Корее (вон):';
                isWon = true;
                break;
            case 'koreaEvacuator':
                currentValue = koreaEvacuator;
                promptText = 'Эвакуатор в порт (вон):';
                isWon = true;
                break;
            case 'koreaFreight':
                currentValue = koreaFreight;
                promptText = 'Фрахт до Бишкека (вон):';
                isWon = true;
                break;
            case 'bishkekUnloading':
                currentValue = bishkekUnloading;
                promptText = 'Разгрузка + эвакуатор ($):';
                break;
            case 'bishkekBroker':
                currentValue = bishkekBroker;
                promptText = 'СВХ + брокерские услуги ($):';
                break;
            case 'bishkekDelivery':
                currentValue = bishkekDelivery;
                promptText = 'Доставка в РФ ($):';
                break;
            case 'rfUnloading':
                currentValue = rfUnloading;
                promptText = 'Разгрузка авто (₽):';
                break;
            case 'rfPreparation':
                currentValue = rfPreparation;
                promptText = 'Подготовка к выдаче (₽):';
                break;
            case 'rfDocuments':
                currentValue = rfDocuments;
                promptText = 'Оформление документов (₽):';
                break;
            default: return;
        }
        
        const newValue = prompt(promptText, currentValue);
        if (newValue !== null && !isNaN(parseFloat(newValue))) {
            const numValue = parseFloat(newValue);
            switch(expenseName) {
                case 'koreaInspection': koreaInspection = numValue; break;
                case 'koreaDealerCommission': koreaDealerCommission = numValue; break;
                case 'koreaDelivery': koreaDelivery = numValue; break;
                case 'koreaEvacuator': koreaEvacuator = numValue; break;
                case 'koreaFreight': koreaFreight = numValue; break;
                case 'bishkekUnloading': bishkekUnloading = numValue; break;
                case 'bishkekBroker': bishkekBroker = numValue; break;
                case 'bishkekDelivery': bishkekDelivery = numValue; break;
                case 'rfUnloading': rfUnloading = numValue; break;
                case 'rfPreparation': rfPreparation = numValue; break;
                case 'rfDocuments': rfDocuments = numValue; break;
            }
            saveDetailedSettings();
            updateDetailedExpenses();
            updateGlobalExpenses();
            updatePanel();
        }
    }
    
    // ========== СОЗДАНИЕ ПАНЕЛИ ==========
    function createPanel() {
        if (mainPanel) return;
        
        loadDetailedSettings();
        
        mainPanel = document.createElement('div');
        mainPanel.className = 'encar-panel';
        mainPanel.id = 'encar-combined-panel';
        mainPanel.style.cssText = `
            position: fixed !important;
            bottom: 20px !important;
            right: 20px !important;
            z-index: 10001 !important;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%) !important;
            color: #f1f5f9 !important;
            border-radius: 16px !important;
            padding: 12px 16px !important;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif !important;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3) !important;
            border: 1px solid rgba(255,255,255,0.1) !important;
            font-size: 13px !important;
            width: 380px !important;
            backdrop-filter: blur(8px) !important;
            cursor: move;
            user-select: none;
            transition: all 0.2s ease;
        `;
        
        mainPanel.innerHTML = `
            <div id="drag-handle" style="cursor: move; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 22px; font-weight: 700;">🚗 <span id="panel-title">Encar Helper</span></span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 16px; font-weight: 600; color: #ffffff;">👁️ <span id="info-views" style="font-size: 16px; font-weight: 700; color: #ffffff;">—</span></span>
                        <div id="collapse-btn" class="collapse-btn">−</div>
                    </div>
                </div>
                <div style="display: flex; gap: 12px; margin-top: 8px; background: rgba(0,0,0,0.3); padding: 6px 12px; border-radius: 24px; width: fit-content;">
                    <span id="usd-header" class="clickable" style="color: #60a5fa; font-size: 14px; font-weight: 600;">🇺🇸 --</span>
                    <span style="color: #475569; font-size: 14px;">|</span>
                    <span id="eur-header" class="clickable" style="color: #60a5fa; font-size: 14px; font-weight: 600;">🇪🇺 --</span>
                    <span style="color: #475569; font-size: 14px;">|</span>
                    <span id="krw-header" class="clickable" style="color: #60a5fa; font-size: 14px; font-weight: 600;">🇰🇷 --</span>
                    <span style="color: #475569; font-size: 14px;">|</span>
                    <span id="usdt-header" class="clickable" style="color: #fbbf24; font-size: 14px; font-weight: 700;">💎 --</span>
                </div>
            </div>
            
            <div id="panel-full-content">
                <!-- Основная информация -->
                <div style="margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span style="color: #94a3b8; font-size: 15px; font-weight: 500;">📅 Год</span>
                        <span id="info-year" style="font-size: 15px; font-weight: 600; color: #fbbf24;">—</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span style="color: #94a3b8; font-size: 15px; font-weight: 500;">🔧 Двигатель</span>
                        <span id="info-engine" style="font-size: 15px; font-weight: 600; color: #fbbf24;">—</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span style="color: #94a3b8; font-size: 15px; font-weight: 500;">⚡ Мощность</span>
                        <span id="info-power" class="clickable" style="font-size: 15px; font-weight: 600; color: #fbbf24;">—</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span style="color: #94a3b8; font-size: 15px; font-weight: 500;">📊 Пробег</span>
                        <span id="info-mileage" style="font-size: 15px; font-weight: 600; color: #fbbf24;">—</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span style="color: #94a3b8; font-size: 15px; font-weight: 500;">🔢 VIN</span>
                        <span id="info-vin" class="clickable" style="font-family: monospace; font-size: 13px; font-weight: 500; cursor: pointer;">—</span>
                    </div>
                </div>
                
                <!-- Страховые выплаты -->
                <div style="margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); border-radius: 10px; padding: 6px 10px;">
                        <span style="color: #94a3b8; font-size: 14px; font-weight: 500;">💸 Страховые выплаты:</span>
                        <span id="accident-value" style="color: #fbbf24; font-weight: 600; font-size: 14px;">загрузка...</span>
                    </div>
                </div>
                
                <!-- Цена в Корее -->
                <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 8px; margin-bottom: 8px;">
                    <div style="font-size: 12px; color: #94a3b8; margin-bottom: 6px; font-weight: 500;">💰 Цена в Корее</div>
                    <div id="price-value" style="color: #fbbf24; font-weight: 700; font-size: 16px; text-align: center;">—</div>
                </div>
                
                <!-- Расходы Корея (раскрывающийся) -->
                <div style="margin-bottom: 8px;">
                    <div id="korea-header" class="expense-header" style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); border-radius: 10px; padding: 8px 10px;">
                        <span style="font-size: 14px; font-weight: 500;">🇰🇷 Расходы Корея</span>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span id="total-korea" style="color: #fbbf24; font-weight: 700; font-size: 15px;">—</span>
                            <span id="korea-arrow" style="font-size: 12px; color: #94a3b8;">▼</span>
                        </div>
                    </div>
                    <div id="korea-content" style="display: none; margin-top: 6px;">
                        <div id="korea-details-inner" class="expense-content"></div>
                    </div>
                </div>
                
                <!-- Расходы Бишкек (раскрывающийся) -->
                <div style="margin-bottom: 8px;">
                    <div id="bishkek-header" class="expense-header" style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); border-radius: 10px; padding: 8px 10px;">
                        <span style="font-size: 14px; font-weight: 500;">🇰🇬 Расходы Бишкек</span>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span id="total-bishkek" style="color: #fbbf24; font-weight: 700; font-size: 15px;">—</span>
                            <span id="bishkek-arrow" style="font-size: 12px; color: #94a3b8;">▼</span>
                        </div>
                    </div>
                    <div id="bishkek-content" style="display: none; margin-top: 6px;">
                        <div id="bishkek-details-inner" class="expense-content"></div>
                    </div>
                </div>
                
                <!-- Расходы РФ (раскрывающийся) -->
                <div style="margin-bottom: 8px;">
                    <div id="rf-header" class="expense-header" style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); border-radius: 10px; padding: 8px 10px;">
                        <span style="font-size: 14px; font-weight: 500;">🇷🇺 Расходы РФ</span>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span id="total-rf" style="color: #fbbf24; font-weight: 700; font-size: 15px;">—</span>
                            <span id="rf-arrow" style="font-size: 12px; color: #94a3b8;">▼</span>
                        </div>
                    </div>
                    <div id="rf-content" style="display: none; margin-top: 6px;">
                        <div id="rf-details-inner" class="expense-content"></div>
                    </div>
                </div>
                
                <!-- Таможня Киргизия -->
                <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 8px; margin-bottom: 8px;">
                    <div style="font-size: 12px; color: #94a3b8; margin-bottom: 6px; font-weight: 500;">🏛️ Таможня Киргизия</div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="font-size: 14px; font-weight: 500;">💰 Стоимость авто (EUR):</span>
                        <div>
                            <span id="price-euro" class="clickable" style="color: #fbbf24; font-weight: 700; font-size: 15px; text-decoration: underline;">—</span>
                            <span id="price-arrow" style="margin-left: 3px; font-size: 9px; color: #94a3b8;">▼</span>
                        </div>
                    </div>
                    <div id="price-content" style="display: none; margin-top: 8px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.08);">
                        <div id="price-content-inner" style="font-size: 11px;">Загрузка...</div>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="font-size: 14px; font-weight: 500;">🏛️ ТПО:</span>
                        <span id="tpo-value" class="clickable" style="font-weight: 700; font-size: 15px;">—</span>
                    </div>
                </div>
                
                <!-- Расходы в РФ (утильсбор) -->
                <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 8px; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="font-size: 14px; font-weight: 500;">♻️ Утильсбор:</span>
                        <span id="util-value" class="clickable" style="font-weight: 700; font-size: 15px;">—</span>
                    </div>
                </div>
                
                <!-- Итого -->
                <div style="border-top: 2px solid #fbbf24; padding-top: 8px; margin-top: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: baseline;">
                        <span style="font-weight: 700; color: #fbbf24; font-size: 18px;">💰 ИТОГО:</span>
                        <span id="total-price" style="font-size: 20px; font-weight: 800; color: #fbbf24;">0 ₽</span>
                    </div>
                </div>
                
                <!-- Кнопки действий -->
                <div style="display: flex; gap: 8px; margin-top: 12px;">
                    <button id="print-report-btn" style="flex: 1; background: #fbbf24; border: none; padding: 8px 0; border-radius: 10px; font-weight: 700; cursor: pointer; color: #0f172a; font-size: 13px;">
                        🖨️ Коммерческое предложение
                    </button>
                    <button id="refresh-panel-btn" style="background: rgba(255,255,255,0.1); border: none; padding: 8px 12px; border-radius: 10px; font-weight: 600; cursor: pointer; color: #f1f5f9; font-size: 13px;">
                        🔄
                    </button>
                </div>
            </div>
            
            <div id="panel-collapsed-content" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #94a3b8; font-size: 13px;">💰 ИТОГО:</span>
                    <span id="collapsed-total-price" style="font-size: 18px; font-weight: 800; color: #fbbf24;">0 ₽</span>
                </div>
            </div>
        `;
        
        document.body.appendChild(mainPanel);
        
        // ========== DRAG & DROP ==========
        const dragHandle = document.getElementById('drag-handle');
        if (dragHandle) {
            dragHandle.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                if (e.target.classList?.contains('collapse-btn')) return;
                isDragging = true;
                const rect = mainPanel.getBoundingClientRect();
                dragOffsetX = e.clientX - rect.left;
                dragOffsetY = e.clientY - rect.top;
                mainPanel.style.cursor = 'grabbing';
                e.preventDefault();
            });
        }
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            let newLeft = e.clientX - dragOffsetX;
            let newTop = e.clientY - dragOffsetY;
            newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - mainPanel.offsetWidth));
            newTop = Math.max(0, Math.min(newTop, window.innerHeight - mainPanel.offsetHeight));
            mainPanel.style.left = newLeft + 'px';
            mainPanel.style.top = newTop + 'px';
            mainPanel.style.right = 'auto';
            mainPanel.style.bottom = 'auto';
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                mainPanel.style.cursor = 'move';
            }
        });
        
        // ========== РАСКРЫВАЮЩИЕСЯ БЛОКИ ==========
        const koreaHeader = document.getElementById('korea-header');
        const koreaContent = document.getElementById('korea-content');
        const koreaArrow = document.getElementById('korea-arrow');
        if (koreaHeader && koreaContent && koreaArrow) {
            koreaHeader.onclick = () => {
                if (koreaContent.style.display === 'none') {
                    koreaContent.style.display = 'block';
                    koreaArrow.innerHTML = '▲';
                    updateDetailedExpenses();
                } else {
                    koreaContent.style.display = 'none';
                    koreaArrow.innerHTML = '▼';
                }
            };
        }
        
        const bishkekHeader = document.getElementById('bishkek-header');
        const bishkekContent = document.getElementById('bishkek-content');
        const bishkekArrow = document.getElementById('bishkek-arrow');
        if (bishkekHeader && bishkekContent && bishkekArrow) {
            bishkekHeader.onclick = () => {
                if (bishkekContent.style.display === 'none') {
                    bishkekContent.style.display = 'block';
                    bishkekArrow.innerHTML = '▲';
                    updateDetailedExpenses();
                } else {
                    bishkekContent.style.display = 'none';
                    bishkekArrow.innerHTML = '▼';
                }
            };
        }
        
        const rfHeader = document.getElementById('rf-header');
        const rfContent = document.getElementById('rf-content');
        const rfArrow = document.getElementById('rf-arrow');
        if (rfHeader && rfContent && rfArrow) {
            rfHeader.onclick = () => {
                if (rfContent.style.display === 'none') {
                    rfContent.style.display = 'block';
                    rfArrow.innerHTML = '▲';
                    updateDetailedExpenses();
                } else {
                    rfContent.style.display = 'none';
                    rfArrow.innerHTML = '▼';
                }
            };
        }
        
        // ========== СВОРАЧИВАНИЕ ==========
        const collapseBtn = document.getElementById('collapse-btn');
        const fullContent = document.getElementById('panel-full-content');
        const collapsedContent = document.getElementById('panel-collapsed-content');
        
        if (collapseBtn && fullContent && collapsedContent) {
            collapseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isCollapsed) {
                    fullContent.style.display = 'block';
                    collapsedContent.style.display = 'none';
                    mainPanel.style.width = '380px';
                    mainPanel.style.padding = '12px 16px';
                    collapseBtn.innerHTML = '−';
                    isCollapsed = false;
                } else {
                    fullContent.style.display = 'none';
                    collapsedContent.style.display = 'block';
                    mainPanel.style.width = '200px';
                    mainPanel.style.padding = '10px 14px';
                    collapseBtn.innerHTML = '+';
                    isCollapsed = true;
                }
            });
        }
        
        // ========== ОБРАБОТЧИКИ КЛИКОВ ==========
        
        // Курсы валют
        document.getElementById('usd-header').onclick = () => {
            const val = prompt('Курс USD/RUB:', Hub.get('usdRate') || 96.5);
            if (val && !isNaN(parseFloat(val))) Hub.set('usdRate', parseFloat(val));
        };
        document.getElementById('eur-header').onclick = () => {
            const val = prompt('Курс EUR/RUB:', Hub.get('eurRate') || 104.2);
            if (val && !isNaN(parseFloat(val))) Hub.set('eurRate', parseFloat(val));
        };
        document.getElementById('krw-header').onclick = () => {
            const val = prompt('Курс USD/KRW:', Hub.get('usdToKrw') || 1473);
            if (val && !isNaN(parseFloat(val))) Hub.set('usdToKrw', parseFloat(val));
            updateDetailedExpenses();
            updateGlobalExpenses();
            updatePanel();
        };
        document.getElementById('usdt-header').onclick = () => {
            const val = prompt('Курс USDT/RUB:', Hub.get('usdtRate') || 90);
            if (val && !isNaN(parseFloat(val))) Hub.set('usdtRate', parseFloat(val));
        };
        
        // Редактируемые поля
        document.getElementById('info-power').onclick = () => {
            const val = prompt('Мощность (л.с.):', Hub.get('carPowerHp') || '');
            if (val && !isNaN(parseInt(val))) Hub.set('carPowerHp', parseInt(val));
        };
        document.getElementById('info-vin').onclick = () => {
            const vin = Hub.get('carVin');
            if (vin) {
                navigator.clipboard.writeText(vin);
                const span = document.getElementById('info-vin');
                const orig = span.textContent;
                span.textContent = '✅ Скопировано!';
                setTimeout(() => span.textContent = orig, 1500);
            }
        };
        
        // ТПО
        document.getElementById('tpo-value').onclick = () => {
            const current = Hub.get('manualTpo') || Hub.get('calculatedTpo') || '';
            const val = prompt('ТПО в USD (оставьте пустым для авто):', current);
            if (val === '') Hub.set('manualTpo', null);
            else if (val && !isNaN(parseFloat(val))) Hub.set('manualTpo', parseFloat(val));
        };
        
        // Утильсбор
        document.getElementById('util-value').onclick = () => {
            const current = Hub.get('manualUtilizationFee') || Hub.get('utilizationFee') || '';
            const val = prompt('Утильсбор в ₽ (оставьте пустым для авто):', current);
            if (val === '') Hub.set('manualUtilizationFee', null);
            else if (val && !isNaN(parseFloat(val))) Hub.set('manualUtilizationFee', parseFloat(val));
        };
        
        // Меню цены
        const priceSpan = document.getElementById('price-euro');
        const priceContent = document.getElementById('price-content');
        const priceArrow = document.getElementById('price-arrow');
        
        if (priceSpan && priceContent && priceArrow) {
            priceSpan.onclick = (e) => {
                e.stopPropagation();
                if (priceContent.style.display === 'none') {
                    priceContent.style.display = 'block';
                    priceArrow.innerHTML = '▲';
                    if (unsafeWindow.EncarPrice?.updateDisplay) {
                        unsafeWindow.EncarPrice.updateDisplay();
                    } else if (Hub) {
                        Hub.emit('priceContent:update', {});
                    }
                } else {
                    priceContent.style.display = 'none';
                    priceArrow.innerHTML = '▼';
                }
            };
        }
        
        // Кнопка обновления
        document.getElementById('refresh-panel-btn').onclick = () => {
            updateDetailedExpenses();
            updateGlobalExpenses();
            updatePanel();
            if (unsafeWindow.EncarPrice?.refresh) unsafeWindow.EncarPrice.refresh();
            console.log('[UI] Панель обновлена');
        };
        
        // Кнопка печати
        document.getElementById('print-report-btn').onclick = () => {
            if (unsafeWindow.EncarPhotos?.print) {
                unsafeWindow.EncarPhotos.print();
            } else {
                alert('Модуль фото не загружен');
            }
        };
        
        updateDetailedExpenses();
        updateGlobalExpenses();
        updatePanel();
        
        // Периодическое обновление
        setInterval(() => updatePanel(), 5000);
    }
    
    // ========== ПОДПИСКИ НА СОБЫТИЯ ==========
    Hub.on('any:changed', () => updatePanel());
    Hub.on('priceContent:update', () => {
        if (unsafeWindow.EncarPrice?.updateDisplay) {
            unsafeWindow.EncarPrice.updateDisplay();
        }
    });
    Hub.on('accidentData:loaded', () => updatePanel());
    
    // ========== ЗАПУСК ==========
    createPanel();
    
    console.log('[UI] Панель с детальными расходами загружена v16.0');
})();
