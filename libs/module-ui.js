// ==UserScript==
// @name         Encar UI Module (Final)
// @namespace    http://tampermonkey.net/
// @version      7.0
// @description  Финальная версия панели (увеличенные курсы, просмотры, зелёная кнопка)
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
            width: 28px;
            height: 28px;
            background: #22c55e;
            border-radius: 50%;
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 18px;
            font-weight: bold;
            color: white;
        }
        
        .collapse-btn:hover {
            background: #16a34a;
            transform: scale(1.05);
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
        
        // Марка и модель
        const brand = Hub.get('carBrand') || '—';
        const model = Hub.get('carModel') || '—';
        const modelStr = `${brand} ${model}`.trim();
        if (modelStr !== '—') {
            const titleSpan = mainPanel.querySelector('#panel-title');
            if (titleSpan) titleSpan.textContent = modelStr;
        }
        
        // Просмотры (увеличенный шрифт)
        const views = Hub.get('carViews');
        const viewsSpan = mainPanel.querySelector('#info-views');
        if (viewsSpan) viewsSpan.textContent = views?.toLocaleString() || '—';
        
        // Год
        const year = Hub.get('carYear');
        const month = Hub.get('carMonth');
        const yearStr = month ? `${year}/${month}` : (year || '—');
        const yearSpan = mainPanel.querySelector('#info-year');
        if (yearSpan) yearSpan.textContent = yearStr;
        
        // Двигатель
        const engineVolume = Hub.get('carEngineVolume');
        const engineSpan = mainPanel.querySelector('#info-engine');
        if (engineSpan) engineSpan.textContent = formatVolume(engineVolume);
        
        // Мощность
        const power = Hub.get('carPowerHp');
        const powerSpan = mainPanel.querySelector('#info-power');
        if (powerSpan) powerSpan.textContent = power ? `${power} л.с.` : '—';
        
        // Пробег
        const mileage = Hub.get('carMileage');
        const mileageSpan = mainPanel.querySelector('#info-mileage');
        if (mileageSpan) mileageSpan.textContent = formatMileage(mileage);
        
        // VIN
        const vin = Hub.get('carVin');
        const vinSpan = mainPanel.querySelector('#info-vin');
        if (vinSpan) vinSpan.textContent = formatVin(vin);
        
        // Цены
        const carPriceKrw = Hub.get('carPriceKrw');
        const priceKrwSpan = mainPanel.querySelector('#price-krw');
        if (priceKrwSpan) priceKrwSpan.textContent = carPriceKrw ? formatNumber(carPriceKrw) + ' ₩' : '—';
        
        const usdToKrw = Hub.get('usdToKrw') || 1473;
        const priceUsd = carPriceKrw ? Math.round(carPriceKrw / usdToKrw) : 0;
        const priceUsdSpan = mainPanel.querySelector('#price-usd');
        if (priceUsdSpan) priceUsdSpan.textContent = priceUsd ? formatNumber(priceUsd) + ' $' : '—';
        
        const euroPrice = Hub.get('selectedEuroPrice');
        const priceEuroSpan = mainPanel.querySelector('#price-euro');
        if (priceEuroSpan) {
            priceEuroSpan.textContent = euroPrice ? `${formatNumber(euroPrice)} €` : '—';
        }
        
        // Расходы
        const tpoValue = Hub.get('calculatedTpo');
        const tpoSpan = mainPanel.querySelector('#tpo-value');
        if (tpoSpan) {
            tpoSpan.innerHTML = tpoValue ? `${formatNumber(tpoValue)} $` : '<span style="color:#f97316;">заполните</span>';
        }
        
        const utilizationFee = Hub.get('utilizationFee');
        const utilSpan = mainPanel.querySelector('#util-value');
        if (utilSpan) {
            utilSpan.innerHTML = utilizationFee ? `${formatNumber(utilizationFee)} ₽` : '<span style="color:#f97316;">заполните</span>';
        }
        
        const totalPrice = Hub.get('totalPrice') || 0;
        const totalSpan = mainPanel.querySelector('#total-price');
        if (totalSpan) totalSpan.textContent = `${formatNumber(totalPrice)} ₽`;
        
        const collapsedTotalSpan = mainPanel.querySelector('#collapsed-total-price');
        if (collapsedTotalSpan) collapsedTotalSpan.textContent = `${formatNumber(totalPrice)} ₽`;
        
        // Редактируемые расходы
        const koreaLogistics = Hub.get('koreaLogistics') || 4000;
        const logisticsSpan = mainPanel.querySelector('#logistics-value');
        if (logisticsSpan) logisticsSpan.textContent = `${formatNumber(koreaLogistics)} $`;
        
        const servicesBishkek = Hub.get('servicesBishkek') || 1200;
        const servicesSpan = mainPanel.querySelector('#services-value');
        if (servicesSpan) servicesSpan.textContent = `${formatNumber(servicesBishkek)} $`;
        
        const docsRf = Hub.get('docsRf') || 80000;
        const docsSpan = mainPanel.querySelector('#docs-value');
        if (docsSpan) docsSpan.textContent = `${formatNumber(docsRf)} ₽`;
        
        const ourServices = Hub.get('ourServices') || 250000;
        const ourSpan = mainPanel.querySelector('#our-value');
        if (ourSpan) ourSpan.textContent = `${formatNumber(ourServices)} ₽`;
        
        // Курсы валют (увеличенный шрифт)
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
    
    // ========== СОЗДАНИЕ ПАНЕЛИ ==========
    function createPanel() {
        if (mainPanel) return;
        
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
            width: 340px !important;
            backdrop-filter: blur(8px) !important;
            cursor: move;
            user-select: none;
            transition: all 0.2s ease;
        `;
        
        mainPanel.innerHTML = `
            <div id="drag-handle" style="cursor: move; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 15px; font-weight: 700;">🚗 <span id="panel-title">Encar Helper</span></span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 16px; font-weight: 600; color: #94a3b8;">👁️ <span id="info-views" style="font-size: 16px; font-weight: 700; color: #fbbf24;">—</span></span>
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
                        <span id="info-vin" class="clickable" style="font-family: monospace; font-size: 12px; cursor: pointer;">—</span>
                    </div>
                </div>
                
                <!-- Цена авто -->
                <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 8px; margin-bottom: 8px;">
                    <div style="font-size: 12px; color: #94a3b8; margin-bottom: 6px; font-weight: 500;">💰 Цена авто</div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="font-size: 13px;">🇰🇷 KRW:</span>
                        <span id="price-krw" style="color: #fbbf24; font-weight: 600; font-size: 13px;">—</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="font-size: 13px;">🇺🇸 USD:</span>
                        <span id="price-usd" style="color: #fbbf24; font-weight: 600; font-size: 13px;">—</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 13px;">🇪🇺 EUR:</span>
                        <div>
                            <span id="price-euro" class="clickable" style="color: #fbbf24; font-weight: 700; font-size: 14px; text-decoration: underline;">—</span>
                            <span id="price-arrow" style="margin-left: 3px; font-size: 9px; color: #94a3b8;">▼</span>
                        </div>
                    </div>
                    <div id="price-content" style="display: none; margin-top: 8px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.08);">
                        <div id="price-content-inner" style="font-size: 11px;">Загрузка...</div>
                    </div>
                </div>
                
                <!-- ТПО и Утильсбор -->
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span style="color: #94a3b8; font-size: 14px; font-weight: 500;">🏛️ ТПО</span>
                    <span id="tpo-value" class="clickable" style="font-weight: 600; font-size: 14px;">—</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="color: #94a3b8; font-size: 14px; font-weight: 500;">♻️ Утильсбор</span>
                    <span id="util-value" class="clickable" style="font-weight: 600; font-size: 14px;">—</span>
                </div>
                
                <!-- Расходы -->
                <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 10px; margin-bottom: 8px;">
                    <div style="font-size: 13px; color: #94a3b8; margin-bottom: 8px; font-weight: 500;">📋 Расходы</div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="font-size: 16px; font-weight: 600;">📦 Корея + логистика</span>
                        <span id="logistics-value" class="clickable" style="font-weight: 700; font-size: 18px; color: #fbbf24;">—</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="font-size: 16px; font-weight: 600;">🚚 Услуги Бишкек + доставка</span>
                        <span id="services-value" class="clickable" style="font-weight: 700; font-size: 18px; color: #fbbf24;">—</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="font-size: 16px; font-weight: 600;">📄 Документы РФ</span>
                        <span id="docs-value" class="clickable" style="font-weight: 700; font-size: 18px; color: #fbbf24;">—</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="font-size: 16px; font-weight: 600;">🤝 Наши услуги</span>
                        <span id="our-value" class="clickable" style="font-weight: 700; font-size: 18px; color: #fbbf24;">—</span>
                    </div>
                </div>
                
                <!-- Итого -->
                <div style="border-top: 2px solid #fbbf24; padding-top: 8px; margin-top: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: baseline;">
                        <span style="font-weight: 700; color: #fbbf24; font-size: 18px;">💰 ИТОГО</span>
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
                    mainPanel.style.width = '340px';
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
        document.getElementById('logistics-value').onclick = () => {
            const val = prompt('Расходы Корея + логистика ($):', Hub.get('koreaLogistics') || 4000);
            if (val && !isNaN(parseFloat(val))) Hub.set('koreaLogistics', parseFloat(val));
        };
        document.getElementById('services-value').onclick = () => {
            const val = prompt('Услуги Бишкек + доставка ($):', Hub.get('servicesBishkek') || 1200);
            if (val && !isNaN(parseFloat(val))) Hub.set('servicesBishkek', parseFloat(val));
        };
        document.getElementById('docs-value').onclick = () => {
            const val = prompt('Документы РФ (₽):', Hub.get('docsRf') || 80000);
            if (val && !isNaN(parseFloat(val))) Hub.set('docsRf', parseFloat(val));
        };
        document.getElementById('our-value').onclick = () => {
            const val = prompt('Наши услуги (₽):', Hub.get('ourServices') || 250000);
            if (val && !isNaN(parseFloat(val))) Hub.set('ourServices', parseFloat(val));
        };
        document.getElementById('tpo-value').onclick = () => {
            const current = Hub.get('manualTpo') || Hub.get('calculatedTpo') || '';
            const val = prompt('ТПО в USD (оставьте пустым для авто):', current);
            if (val === '') Hub.set('manualTpo', null);
            else if (val && !isNaN(parseFloat(val))) Hub.set('manualTpo', parseFloat(val));
        };
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
        
        updatePanel();
        
        // Периодическое обновление панели
        setInterval(() => updatePanel(), 5000);
    }
    
    // ========== ПОДПИСКИ НА СОБЫТИЯ ==========
    Hub.on('any:changed', () => updatePanel());
    Hub.on('priceContent:update', () => {
        if (unsafeWindow.EncarPrice?.updateDisplay) {
            unsafeWindow.EncarPrice.updateDisplay();
        }
    });
    
    // ========== ЗАПУСК ==========
    createPanel();
    
    console.log('[UI] Финальная панель загружена v7.0');
})();
