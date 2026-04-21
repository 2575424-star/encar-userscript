// ==UserScript==
// @name         Encar UI Module
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Интерфейсная панель
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

    // Форматирование
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

    // Обновление панели
    function updatePanel() {
        if (!mainPanel) return;

        // Основные данные
        const brand = Hub.get('carBrand') || '—';
        const model = Hub.get('carModel') || '—';
        const modelStr = `${brand} ${model}`.trim();

        const year = Hub.get('carYear');
        const month = Hub.get('carMonth');
        const yearStr = month ? `${year}/${month}` : (year || '—');

        const engineVolume = Hub.get('carEngineVolume');
        const power = Hub.get('carPowerHp');
        const mileage = Hub.get('carMileage');
        const views = Hub.get('carViews');
        const vin = Hub.get('carVin');

        const usdRate = Hub.get('usdRate') || 0;
        const eurRate = Hub.get('eurRate') || 0;
        const usdToKrw = Hub.get('usdToKrw') || 0;
        const usdtRate = Hub.get('usdtRate') || 0;

        const carPriceKrw = Hub.get('carPriceKrw');
        const priceUsd = carPriceKrw && usdToKrw ? Math.round(carPriceKrw / usdToKrw) : 0;
        const euroPrice = Hub.get('selectedEuroPrice');

        const tpoValue = Hub.get('calculatedTpo');
        const utilizationFee = Hub.get('utilizationFee');
        const totalPrice = Hub.get('totalPrice') || 0;

        const koreaLogistics = Hub.get('koreaLogistics') || 4000;
        const servicesBishkek = Hub.get('servicesBishkek') || 1200;
        const docsRf = Hub.get('docsRf') || 80000;
        const ourServices = Hub.get('ourServices') || 250000;

        // Обновляем элементы
        const titleSpan = mainPanel.querySelector('#panel-title');
        if (titleSpan) titleSpan.textContent = modelStr;

        const yearSpan = mainPanel.querySelector('#info-year');
        if (yearSpan) yearSpan.textContent = yearStr;

        const engineSpan = mainPanel.querySelector('#info-engine');
        if (engineSpan) engineSpan.textContent = formatVolume(engineVolume);

        const powerSpan = mainPanel.querySelector('#info-power');
        if (powerSpan) powerSpan.textContent = power ? `${power} л.с.` : '—';

        const mileageSpan = mainPanel.querySelector('#info-mileage');
        if (mileageSpan) mileageSpan.textContent = formatMileage(mileage);

        const vinSpan = mainPanel.querySelector('#info-vin');
        if (vinSpan) vinSpan.textContent = formatVin(vin);

        const viewsSpan = mainPanel.querySelector('#info-views');
        if (viewsSpan) viewsSpan.textContent = views?.toLocaleString() || '—';

        const priceKrwSpan = mainPanel.querySelector('#price-krw');
        if (priceKrwSpan) priceKrwSpan.textContent = carPriceKrw ? carPriceKrw.toLocaleString() : '—';

        const priceUsdSpan = mainPanel.querySelector('#price-usd');
        if (priceUsdSpan) priceUsdSpan.textContent = priceUsd.toLocaleString();

        const priceEuroSpan = mainPanel.querySelector('#price-euro');
        if (priceEuroSpan) priceEuroSpan.textContent = euroPrice ? `${euroPrice.toLocaleString()} €` : '—';

        const tpoSpan = mainPanel.querySelector('#tpo-value');
        if (tpoSpan) tpoSpan.innerHTML = tpoValue ? `${tpoValue.toLocaleString()} $` : '<span style="color:#22c55e;">заполните</span>';

        const utilSpan = mainPanel.querySelector('#util-value');
        if (utilSpan) utilSpan.innerHTML = utilizationFee ? `${utilizationFee.toLocaleString()} ₽` : '<span style="color:#22c55e;">заполните</span>';

        const totalSpan = mainPanel.querySelector('#total-price');
        if (totalSpan) totalSpan.textContent = `${totalPrice.toLocaleString()} ₽`;

        const collapsedTotalSpan = mainPanel.querySelector('#collapsed-total-price');
        if (collapsedTotalSpan) collapsedTotalSpan.textContent = `${totalPrice.toLocaleString()} ₽`;

        // Расходы
        const logisticsSpan = mainPanel.querySelector('#logistics-value');
        if (logisticsSpan) logisticsSpan.textContent = `${koreaLogistics.toLocaleString()} $`;

        const servicesSpan = mainPanel.querySelector('#services-value');
        if (servicesSpan) servicesSpan.textContent = `${servicesBishkek.toLocaleString()} $`;

        const docsSpan = mainPanel.querySelector('#docs-value');
        if (docsSpan) docsSpan.textContent = `${docsRf.toLocaleString()} ₽`;

        const ourSpan = mainPanel.querySelector('#our-value');
        if (ourSpan) ourSpan.textContent = `${ourServices.toLocaleString()} ₽`;

        // Курсы в шапке
        const usdHeader = mainPanel.querySelector('#usd-header');
        if (usdHeader) usdHeader.textContent = `🇺🇸 ${usdRate.toFixed(2)}`;

        const eurHeader = mainPanel.querySelector('#eur-header');
        if (eurHeader) eurHeader.textContent = `🇪🇺 ${eurRate.toFixed(2)}`;

        const krwHeader = mainPanel.querySelector('#krw-header');
        if (krwHeader) krwHeader.textContent = `🇰🇷 ${Math.round(usdToKrw)}`;

        const usdtHeader = mainPanel.querySelector('#usdt-header');
        if (usdtHeader) usdtHeader.textContent = `💎 ${usdtRate.toFixed(2)}`;
    }

    // Создание панели
    function createPanel() {
        if (mainPanel) return;

        mainPanel = document.createElement('div');
        mainPanel.id = 'encar-combined-panel';
        mainPanel.style.cssText = `
            position: fixed !important;
            bottom: 20px !important;
            right: 20px !important;
            z-index: 10001 !important;
            background: linear-gradient(135deg, #0a1a2f 0%, #0f2a44 100%) !important;
            color: white !important;
            border-radius: 20px !important;
            padding: 14px 20px !important;
            font-family: system-ui, -apple-system, sans-serif !important;
            box-shadow: 0 8px 25px rgba(0,0,0,0.3) !important;
            border: 1px solid rgba(255,255,255,0.12) !important;
            font-size: 13px !important;
            width: 360px !important;
            cursor: move;
            user-select: none;
        `;

        mainPanel.innerHTML = `
            <div id="drag-handle" style="cursor: move; margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.15); padding-bottom:8px;">
                <div style="display:flex; align-items:center; justify-content:space-between;">
                    <span id="panel-title" style="font-size:15px; font-weight:600;">Загрузка...</span>
                    <span id="collapse-btn" style="cursor:pointer; font-size:16px; color:#94a3b8;">−</span>
                </div>
                <div style="display:flex; gap:8px; font-size:10px; background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 20px; width:fit-content; margin-top:6px;">
                    <span id="usd-header" style="cursor:pointer;">🇺🇸 --</span>
                    <span id="eur-header" style="cursor:pointer;">🇪🇺 --</span>
                    <span id="krw-header" style="cursor:pointer;">🇰🇷 --</span>
                    <span id="usdt-header" style="color:#22c55e; font-weight:bold; cursor:pointer;">💎 --</span>
                </div>
            </div>
            <div id="panel-full-content">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px 12px; margin-bottom:12px;">
                    <div><span style="color:#94a3b8;">📅 Год</span><br><span id="info-year">—</span></div>
                    <div><span style="color:#94a3b8;">🔧 Двигатель</span><br><span id="info-engine">—</span></div>
                    <div><span style="color:#94a3b8;">⚡ Мощность</span><br><span id="info-power" style="cursor:pointer;">—</span></div>
                    <div><span style="color:#94a3b8;">📊 Пробег</span><br><span id="info-mileage">—</span></div>
                    <div><span style="color:#94a3b8;">🔢 VIN</span><br><span id="info-vin" style="font-family:monospace; font-size:11px; cursor:pointer;">—</span></div>
                    <div><span style="color:#94a3b8;">👁️ Просмотры</span><br><span id="info-views">—</span></div>
                </div>
                <div style="background:rgba(255,255,255,0.05); border-radius:12px; padding:8px; margin-bottom:10px;">
                    <div style="font-size:11px; color:#94a3b8; margin-bottom:5px;">💰 Цена авто</div>
                    <div style="display:flex; justify-content:space-between;"><span>🇰🇷 KRW:</span><span id="price-krw" style="color:#fbbf24;">—</span></div>
                    <div style="display:flex; justify-content:space-between;"><span>🇺🇸 USD:</span><span id="price-usd">—</span></div>
                    <div style="display:flex; justify-content:space-between;"><span>🇪🇺 EUR:</span><span id="price-euro" style="color:#fbbf24; cursor:pointer;">—</span></div>
                </div>
                <div style="margin-bottom:8px;"><div style="display:flex; justify-content:space-between;"><span style="color:#94a3b8;">🏛️ ТПО:</span><span id="tpo-value" style="cursor:pointer;">—</span></div></div>
                <div style="margin-bottom:8px;"><div style="display:flex; justify-content:space-between;"><span style="color:#94a3b8;">♻️ Утильсбор:</span><span id="util-value" style="cursor:pointer;">—</span></div></div>
                <div style="background:rgba(255,255,255,0.05); border-radius:12px; padding:8px; margin-top:8px;">
                    <div style="font-size:11px; color:#94a3b8; margin-bottom:5px;">📋 Расходы</div>
                    <div style="display:flex; justify-content:space-between;"><span>📦 Корея:</span><span id="logistics-value" style="cursor:pointer;">—</span></div>
                    <div style="display:flex; justify-content:space-between;"><span>🚚 Бишкек:</span><span id="services-value" style="cursor:pointer;">—</span></div>
                    <div style="display:flex; justify-content:space-between;"><span>📄 Документы:</span><span id="docs-value" style="cursor:pointer;">—</span></div>
                    <div style="display:flex; justify-content:space-between;"><span>🤝 Наши услуги:</span><span id="our-value" style="cursor:pointer;">—</span></div>
                </div>
                <div style="border-top:1px solid #475569; padding-top:10px; margin-top:8px;">
                    <div style="display:flex; justify-content:space-between;"><span style="font-weight:700; color:#fbbf24;">💰 ИТОГО:</span><span id="total-price" style="font-size:18px; font-weight:800; color:#fbbf24;">0 ₽</span></div>
                </div>
                <button id="print-report-btn" style="margin-top:12px; width:100%; background:#fbbf24; border:none; padding:8px 12px; border-radius:10px; font-weight:bold; cursor:pointer; color:#0a1a2f; font-size:13px;">🖨️ Коммерческое предложение</button>
            </div>
            <div id="panel-collapsed-content" style="display:none;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="color:#94a3b8; font-size:12px;">💰 ИТОГО:</span>
                    <span id="collapsed-total-price" style="font-size:16px; font-weight:800; color:#fbbf24;">0 ₽</span>
                </div>
            </div>
        `;

        document.body.appendChild(mainPanel);

        // Drag & Drop
        const dragHandle = document.getElementById('drag-handle');
        if (dragHandle) {
            dragHandle.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                if (e.target.id === 'collapse-btn') return;
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

        // Сворачивание
        const collapseBtn = document.getElementById('collapse-btn');
        const fullContent = document.getElementById('panel-full-content');
        const collapsedContent = document.getElementById('panel-collapsed-content');

        if (collapseBtn && fullContent && collapsedContent) {
            collapseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isCollapsed) {
                    fullContent.style.display = 'block';
                    collapsedContent.style.display = 'none';
                    mainPanel.style.width = '360px';
                    isCollapsed = false;
                } else {
                    fullContent.style.display = 'none';
                    collapsedContent.style.display = 'block';
                    mainPanel.style.width = '280px';
                    isCollapsed = true;
                }
            });
        }

        // Обработчики кликов для редактирования
        const powerSpan = mainPanel.querySelector('#info-power');
        if (powerSpan) {
            powerSpan.onclick = () => {
                const newPower = prompt('Введите мощность в л.с.:', Hub.get('carPowerHp') || '');
                if (newPower && !isNaN(parseInt(newPower))) {
                    Hub.set('carPowerHp', parseInt(newPower));
                    Hub.set('carPowerKw', Math.round(parseInt(newPower) / 1.341));
                }
            };
        }

        const vinSpan = mainPanel.querySelector('#info-vin');
        if (vinSpan) {
            vinSpan.onclick = () => {
                const vin = Hub.get('carVin');
                if (vin) {
                    navigator.clipboard.writeText(vin);
                    const orig = vinSpan.textContent;
                    vinSpan.textContent = '✅ Скопировано!';
                    setTimeout(() => { vinSpan.textContent = orig; }, 1500);
                }
            };
        }

        const priceEuroSpan = mainPanel.querySelector('#price-euro');
        if (priceEuroSpan) {
            priceEuroSpan.onclick = () => {
                const current = Hub.get('selectedEuroPrice') || '';
                const newPrice = prompt('Введите стоимость в евро:', current);
                if (newPrice && !isNaN(parseFloat(newPrice))) {
                    if (unsafeWindow.EncarPrice) {
                        unsafeWindow.EncarPrice.setManual(parseFloat(newPrice));
                    } else {
                        Hub.set('selectedEuroPrice', parseFloat(newPrice));
                        Hub.set('selectedPriceManual', parseFloat(newPrice));
                    }
                }
            };
        }

        // Редактирование расходов
        const logisticsSpan = mainPanel.querySelector('#logistics-value');
        if (logisticsSpan) {
            logisticsSpan.onclick = () => {
                const val = prompt('Расходы Корея + логистика ($):', Hub.get('koreaLogistics') || 4000);
                if (val && !isNaN(parseFloat(val))) Hub.set('koreaLogistics', parseFloat(val));
            };
        }

        const servicesSpan = mainPanel.querySelector('#services-value');
        if (servicesSpan) {
            servicesSpan.onclick = () => {
                const val = prompt('Услуги Бишкек + доставка ($):', Hub.get('servicesBishkek') || 1200);
                if (val && !isNaN(parseFloat(val))) Hub.set('servicesBishkek', parseFloat(val));
            };
        }

        const docsSpan = mainPanel.querySelector('#docs-value');
        if (docsSpan) {
            docsSpan.onclick = () => {
                const val = prompt('Документы РФ (₽):', Hub.get('docsRf') || 80000);
                if (val && !isNaN(parseFloat(val))) Hub.set('docsRf', parseFloat(val));
            };
        }

        const ourSpan = mainPanel.querySelector('#our-value');
        if (ourSpan) {
            ourSpan.onclick = () => {
                const val = prompt('Наши услуги (₽):', Hub.get('ourServices') || 250000);
                if (val && !isNaN(parseFloat(val))) Hub.set('ourServices', parseFloat(val));
            };
        }

        const tpoSpan = mainPanel.querySelector('#tpo-value');
        if (tpoSpan) {
            tpoSpan.onclick = () => {
                const current = Hub.get('manualTpo') || Hub.get('calculatedTpo') || '';
                const val = prompt('ТПО в USD (оставьте пустым для авто):', current);
                if (val === '') Hub.set('manualTpo', null);
                else if (val && !isNaN(parseFloat(val))) Hub.set('manualTpo', parseFloat(val));
            };
        }

        const utilSpan = mainPanel.querySelector('#util-value');
        if (utilSpan) {
            utilSpan.onclick = () => {
                const current = Hub.get('manualUtilizationFee') || Hub.get('utilizationFee') || '';
                const val = prompt('Утильсбор в ₽ (оставьте пустым для авто):', current);
                if (val === '') Hub.set('manualUtilizationFee', null);
                else if (val && !isNaN(parseFloat(val))) Hub.set('manualUtilizationFee', parseFloat(val));
            };
        }

        // Курсы в шапке
        const usdHeader = mainPanel.querySelector('#usd-header');
        if (usdHeader) {
            usdHeader.onclick = () => {
                const val = prompt('Курс USD/RUB:', Hub.get('usdRate') || 96.5);
                if (val && !isNaN(parseFloat(val))) Hub.set('usdRate', parseFloat(val));
            };
        }

        const eurHeader = mainPanel.querySelector('#eur-header');
        if (eurHeader) {
            eurHeader.onclick = () => {
                const val = prompt('Курс EUR/RUB:', Hub.get('eurRate') || 104.2);
                if (val && !isNaN(parseFloat(val))) Hub.set('eurRate', parseFloat(val));
            };
        }

        const krwHeader = mainPanel.querySelector('#krw-header');
        if (krwHeader) {
            krwHeader.onclick = () => {
                const val = prompt('Курс USD/KRW:', Hub.get('usdToKrw') || 1473);
                if (val && !isNaN(parseFloat(val))) Hub.set('usdToKrw', parseFloat(val));
            };
        }

        const usdtHeader = mainPanel.querySelector('#usdt-header');
        if (usdtHeader) {
            usdtHeader.onclick = () => {
                const val = prompt('Курс USDT/RUB:', Hub.get('usdtRate') || 90);
                if (val && !isNaN(parseFloat(val))) Hub.set('usdtRate', parseFloat(val));
            };
        }

        // Кнопка печати
        const printBtn = mainPanel.querySelector('#print-report-btn');
        if (printBtn && unsafeWindow.EncarPhotos) {
            printBtn.onclick = () => unsafeWindow.EncarPhotos.print();
        } else if (printBtn) {
            printBtn.onclick = () => alert('Модуль фото ещё не загружен');
        }

        // Первое обновление
        updatePanel();
    }

    // Подписки на изменения
    Hub.on('any:changed', () => updatePanel());

    // Запуск
    createPanel();

    console.log('[UI] Модуль загружен');
})();
