// ==UserScript==
// @name         Encar Photos Module (Pro)
// @namespace    http://tampermonkey.net/
// @version      7.4
// @description  Профессиональное КП с настройками (исправлено)
// @match        *://www.encar.com/cars/detail/*
// @match        *://fem.encar.com/cars/detail/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @grant        GM_addStyle
// @connect      ci.encar.com
// @connect      image.encar.com
// @connect      api.encar.com
// @connect      cdn.trx.tradedealer.ru
// ==/UserScript==

(function() {
    'use strict';
    
    function waitForHub(callback) {
        if (unsafeWindow.EncarHub) {
            callback();
            return;
        }
        const interval = setInterval(() => {
            if (unsafeWindow.EncarHub) {
                clearInterval(interval);
                callback();
            }
        }, 100);
        setTimeout(() => {
            clearInterval(interval);
            if (!unsafeWindow.EncarHub) {
                console.error('[Photos] CoreHub не загружен');
            }
        }, 10000);
    }
    
    waitForHub(() => {
        const Hub = unsafeWindow.EncarHub;
        
        let photosList = [];
        
        let companySettings = {
            companyName: 'ООО "ИнДрайв"',
            inn: '3662313297',
            ogrn: '1253600001973',
            address: 'г. Воронеж, пр. Патриотов 47и',
            phone: '+7(473)233-44-55',
            managerName: 'Александр',
            managerPosition: 'Менеджер отдела продаж',
            managerPhone: '+7(922)333-66-88',
            offerValidDays: 3,
            logo: 'https://cdn.trx.tradedealer.ru/746/media/download/pB9Ltu__logo-indriv-e.svg',
            customBrand: '',
            customModel: ''
        };
        
        let koreaInspection = 150000;
        let koreaDealerCommission = 440000;
        let koreaDelivery = 250000;
        let koreaEvacuator = 50000;
        let koreaExportFeePercent = 0.4;
        let koreaExportFeeMin = 100000;
        let koreaFreight = 5000000;
        
        let bishkekUnloading = 200;
        let bishkekBroker = 400;
        let bishkekDelivery = 1200;
        
        let rfUnloading = 3000;
        let rfPreparation = 3000;
        let rfDocuments = 85000;
        
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
        
        function loadCompanySettings() {
            const saved = localStorage.getItem('encar_company_settings');
            if (saved) {
                try {
                    const settings = JSON.parse(saved);
                    companySettings = { ...companySettings, ...settings };
                } catch(e) {}
            }
        }
        
        function calculateExportFee() {
            const carPriceKrw = Hub.get('carPriceKrw') || 0;
            let exportFee = carPriceKrw * koreaExportFeePercent / 100;
            if (exportFee < koreaExportFeeMin) exportFee = koreaExportFeeMin;
            return exportFee;
        }
        
        function calculateTotalKoreaUSD() {
            const usdToKrw = Hub.get('usdToKrw') || 1473;
            const exportFee = calculateExportFee();
            const totalKrw = koreaInspection + koreaDealerCommission + koreaDelivery + 
                             koreaEvacuator + exportFee + koreaFreight;
            return Math.round(totalKrw / usdToKrw);
        }
        
        function calculateTotalBishkekUSD() {
            return bishkekUnloading + bishkekBroker + bishkekDelivery;
        }
        
        function calculateTotalRFRUB() {
            return rfUnloading + rfPreparation + rfDocuments;
        }
        
        function findCarId() {
            const urlMatch = window.location.href.match(/carid=(\d+)/);
            if (urlMatch) return urlMatch[1];
            if (window.__PRELOADED_STATE__?.cars?.base?.vehicleId) return window.__PRELOADED_STATE__.cars.base.vehicleId;
            return null;
        }
        
        function findPhotosInDOM() {
            const urls = new Set();
            document.querySelectorAll('img[src*="ci.encar.com"], img[data-src*="ci.encar.com"]').forEach(img => {
                let src = img.src || img.getAttribute('data-src');
                if (src && src.includes('ci.encar.com')) {
                    const cleanUrl = src.split('?')[0];
                    if (cleanUrl.match(/_\d{3}\.jpg$/)) urls.add(cleanUrl);
                }
            });
            const urlPattern = /(https?:\/\/ci\.encar\.com[^\s"'<>]+_\d{3}\.jpg)/gi;
            document.querySelectorAll('script').forEach(script => {
                const matches = script.textContent.match(urlPattern);
                if (matches) matches.forEach(url => urls.add(url.split('?')[0]));
            });
            return Array.from(urls);
        }
        
        function generatePhotoUrls(carId) {
            const urls = [];
            const baseUrl = `https://ci.encar.com/carpicture/carpicture${carId.slice(-2)}/pic${carId.slice(0,4)}/${carId}_`;
            for (let i = 1; i <= 20; i++) { urls.push(`${baseUrl}${String(i).padStart(3,'0')}.jpg`); }
            return urls;
        }
        
        async function findAllPhotos() {
            console.log('[Photos] Поиск фото...');
            let photos = findPhotosInDOM();
            if (photos.length >= 3) { 
                photosList = photos.slice(0, 6); 
                Hub.set('photosList', photosList); 
                return photosList; 
            }
            const carId = findCarId();
            if (carId) { 
                photosList = generatePhotoUrls(carId).slice(0, 6); 
                Hub.set('photosList', photosList); 
                return photosList; 
            }
            photosList = []; 
            Hub.set('photosList', []); 
            return [];
        }
        
        function formatNumber(num) { 
            return num ? num.toLocaleString() : '—'; 
        }
        
        function formatDate() {
            const now = new Date();
            return now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
        }
        
        function formatValidUntil() {
            const now = new Date();
            now.setDate(now.getDate() + companySettings.offerValidDays);
            return now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
        }
        
        async function printReport() {
            console.log('[Photos] Генерация КП...');
            loadDetailedSettings();
            loadCompanySettings();
            
            if (!photosList.length) {
                const loadingDiv = document.createElement('div');
                loadingDiv.innerHTML = '<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1e1e2f;color:white;padding:25px 40px;border-radius:20px;z-index:10030;text-align:center;font-family:system-ui;box-shadow:0 20px 40px rgba(0,0,0,0.4);"><div class="loading-spinner"></div><div style="margin-top:15px">🔍 Поиск фотографий...</div></div>';
                document.body.appendChild(loadingDiv);
                await findAllPhotos();
                loadingDiv.remove();
            }
            
            let brand = companySettings.customBrand && companySettings.customBrand.trim() !== '' 
                ? companySettings.customBrand 
                : (Hub.get('carBrand') || '—');
            let model = companySettings.customModel && companySettings.customModel.trim() !== '' 
                ? companySettings.customModel 
                : (Hub.get('carModel') || '—');
            
            const year = Hub.get('carYear') || '—';
            const month = Hub.get('carMonth');
            const yearDisplay = month ? `${year}/${month}` : year;
            const vin = Hub.get('carVin') || '—';
            const mileage = Hub.get('carMileage');
            const engineVolume = Hub.get('carEngineVolume');
            const power = Hub.get('carPowerHp');
            const views = Hub.get('carViews');
            const accidentTotal = Hub.get('accidentTotal') || '—';
            
            const carPriceKrw = Hub.get('carPriceKrw') || 0;
            const usdToKrw = Hub.get('usdToKrw') || 1473;
            const priceUsd = carPriceKrw ? Math.round(carPriceKrw / usdToKrw) : 0;
            
            const koreaUSD = calculateTotalKoreaUSD();
            const bishkekUSD = calculateTotalBishkekUSD();
            const rfRUB = calculateTotalRFRUB();
            const ourServices = Hub.get('ourServices') || 300000;
            
            const euroPrice = Hub.get('selectedEuroPrice');
            const tpoValue = Hub.get('calculatedTpo') || 0;
            const utilizationFee = Hub.get('utilizationFee') || 0;
            const totalPrice = Hub.get('totalPrice') || 0;
            
            const usdRate = Hub.get('usdRate') || 0;
            const eurRate = Hub.get('eurRate') || 0;
            const usdtRate = Hub.get('usdtRate') || 0;
            
            const exportFee = calculateExportFee();
            
            // Подготовим настройки как JSON строку для вставки в скрипт
            const settingsJson = JSON.stringify(companySettings);
            
            const reportHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Коммерческое предложение | ${brand} ${model}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', 'Segoe UI', sans-serif; background: #e8edf2; padding: 20px; }
        .toolbar { position: fixed; bottom: 30px; right: 30px; z-index: 1000; display: flex; gap: 12px; }
        .toolbar button { padding: 12px 28px; font-size: 14px; font-weight: 600; border: none; border-radius: 50px; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        .toolbar button:hover { transform: translateY(-2px); }
        .btn-print { background: #1e3a5f; color: white; }
        .btn-pdf { background: #2c5f2d; color: white; }
        .btn-settings { background: #475569; color: white; }
        .proposal { max-width: 1100px; margin: 0 auto; }
        .page { background: white; border-radius: 24px; margin-bottom: 30px; box-shadow: 0 20px 40px -12px rgba(0,0,0,0.2); overflow: hidden; page-break-after: always; }
        @media print { .toolbar { display: none; } body { background: white; padding: 0; } .page { box-shadow: none; margin: 0; border-radius: 0; } .header, .total-row { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        .header { background: linear-gradient(135deg, #0f2a44 0%, #1a4a6f 100%); padding: 18px 30px; color: white; }
        .logo-area { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
        .logo-area img { height: 40px; max-width: 180px; object-fit: contain; }
        .company-info { text-align: right; font-size: 11px; line-height: 1.4; font-weight: 500; }
        .title-block { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 14px; flex-wrap: wrap; gap: 12px; }
        .car-title { font-size: 24px; font-weight: 800; }
        .manager-info { text-align: right; font-size: 11px; }
        .manager-name { font-weight: 700; margin-bottom: 3px; font-size: 13px; }
        .validity { font-size: 10px; opacity: 0.8; margin-top: 8px; }
        .section { padding: 20px 30px; border-bottom: 1px solid #eef2f6; }
        .section-title { font-size: 18px; font-weight: 800; color: #1e3a5f; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
        .section-icon { font-size: 22px; }
        .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px 30px; }
        .info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eef2f6; }
        .info-label { font-size: 14px; font-weight: 500; color: #475569; }
        .info-value { font-size: 15px; font-weight: 700; color: #0f172a; }
        .expense-detail { margin-top: 10px; padding-left: 20px; border-left: 2px solid #fbbf24; }
        .expense-detail-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
        .expense-detail-label { color: #475569; font-weight: 500; }
        .expense-detail-value { color: #0f172a; font-weight: 600; }
        .price-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        .price-table th { text-align: left; padding: 10px 0; font-size: 13px; font-weight: 700; color: #475569; border-bottom: 2px solid #e2e8f0; }
        .price-table td { padding: 10px 0; font-size: 14px; border-bottom: 1px solid #eef2f6; }
        .price-table td:last-child { text-align: right; font-weight: 700; }
        .total-row { background: #fef9e6; }
        .total-row td { font-weight: 800; font-size: 18px; color: #d97706; border-bottom: none; }
        .total-row td:last-child { font-size: 22px; }
        .photos-section { padding: 20px 30px; }
        .photos-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 16px; }
        .photo-item { aspect-ratio: 4/3; background: #f8fafc; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; }
        .photo-item img { width: 100%; height: 100%; object-fit: cover; }
        .photo-item.empty { background: #f1f5f9; border: 1px dashed #cbd5e1; }
        .footer { background: #f8fafc; padding: 15px 30px; text-align: center; font-size: 10px; color: #64748b; border-top: 1px solid #eef2f6; }
        .requisites { display: flex; justify-content: space-between; flex-wrap: wrap; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 9px; gap: 10px; }
        .loading-spinner { width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.2); border-top-color: #fbbf24; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) { .section { padding: 15px 20px; } .photos-grid { grid-template-columns: repeat(2, 1fr); } .info-grid { grid-template-columns: 1fr; } .title-block { flex-direction: column; align-items: flex-start; } .manager-info { text-align: left; } }
    </style>
</head>
<body>
<div class="toolbar">
    <button class="btn-settings" onclick="showSettingsDialog()">⚙️ Настройки</button>
    <button class="btn-print" onclick="window.print()">🖨️ Печать</button>
    <button class="btn-pdf" onclick="window.print()">📄 Сохранить PDF</button>
</div>

<div class="proposal">
    <div class="page">
        <div class="header">
            <div class="logo-area">
                <img src="${companySettings.logo}" alt="Логотип" onerror="this.style.display='none'">
                <div class="company-info">
                    <div><strong>${companySettings.companyName}</strong></div>
                    <div>ИНН: ${companySettings.inn} | ОГРН: ${companySettings.ogrn}</div>
                    <div>${companySettings.address}</div>
                    <div>тел: ${companySettings.phone}</div>
                </div>
            </div>
            <div class="title-block">
                <div class="car-title">${brand} ${model}</div>
                <div class="manager-info">
                    <div class="manager-name">${companySettings.managerName}</div>
                    <div>${companySettings.managerPosition}</div>
                    <div>тел: ${companySettings.managerPhone}</div>
                </div>
            </div>
            <div class="validity">⚡ Предложение действительно до ${formatValidUntil()}</div>
        </div>
        
        <div class="section">
            <div class="section-title"><span class="section-icon">📋</span>ИНФОРМАЦИЯ ОБ АВТОМОБИЛЕ</div>
            <div class="info-grid">
                <div class="info-row"><span class="info-label">📅 Год выпуска</span><span class="info-value">${yearDisplay}</span></div>
                <div class="info-row"><span class="info-label">🔧 Двигатель</span><span class="info-value">${engineVolume ? (engineVolume/1000).toFixed(1) + 'L' : '—'}</span></div>
                <div class="info-row"><span class="info-label">⚡ Мощность</span><span class="info-value">${power ? `${power} л.с.` : '—'}</span></div>
                <div class="info-row"><span class="info-label">📊 Пробег</span><span class="info-value">${mileage ? `${mileage.toLocaleString()} km` : '—'}</span></div>
                <div class="info-row"><span class="info-label">🔢 VIN номер</span><span class="info-value">${vin === '—' || !vin ? '—' : vin}</span></div>
                <div class="info-row"><span class="info-label">👁️ Просмотры</span><span class="info-value">${views?.toLocaleString() || '—'}</span></div>
                <div class="info-row"><span class="info-label">💸 Страховые выплаты</span><span class="info-value" style="color:#fbbf24;">${accidentTotal}</span></div>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title"><span class="section-icon">💰</span>РАСЧЁТ СТОИМОСТИ</div>
            <div class="info-grid" style="margin-bottom:16px;"><div class="info-row"><span class="info-label">💰 Цена в Корее</span><span class="info-value">${carPriceKrw ? formatNumber(carPriceKrw) + ' ₩' : '—'} / ${priceUsd ? formatNumber(priceUsd) + ' $' : '—'}</span></div></div>
            
            <div style="margin-bottom:16px;"><div style="font-weight:800; margin-bottom:8px; font-size:15px; color:#1e3a5f;">🇰🇷 Расходы Корея</div>
                <div class="expense-detail">
                    <div class="expense-detail-row"><span class="expense-detail-label">Осмотр авто:</span><span class="expense-detail-value">${formatNumber(koreaInspection)} ₩ (${Math.round(koreaInspection/usdToKrw)} $)</span></div>
                    <div class="expense-detail-row"><span class="expense-detail-label">Комиссия дилера:</span><span class="expense-detail-value">${formatNumber(koreaDealerCommission)} ₩ (${Math.round(koreaDealerCommission/usdToKrw)} $)</span></div>
                    <div class="expense-detail-row"><span class="expense-detail-label">Доставка по Корее:</span><span class="expense-detail-value">${formatNumber(koreaDelivery)} ₩ (${Math.round(koreaDelivery/usdToKrw)} $)</span></div>
                    <div class="expense-detail-row"><span class="expense-detail-label">Эвакуатор в порт:</span><span class="expense-detail-value">${formatNumber(koreaEvacuator)} ₩ (${Math.round(koreaEvacuator/usdToKrw)} $)</span></div>
                    <div class="expense-detail-row"><span class="expense-detail-label">Экспортные документы:</span><span class="expense-detail-value">${koreaExportFeePercent}% = ${formatNumber(exportFee)} ₩ (${Math.round(exportFee/usdToKrw)} $)</span></div>
                    <div class="expense-detail-row"><span class="expense-detail-label">Фрахт до Бишкека:</span><span class="expense-detail-value">${formatNumber(koreaFreight)} ₩ (${Math.round(koreaFreight/usdToKrw)} $)</span></div>
                    <div class="expense-detail-row" style="margin-top:6px; padding-top:6px; border-top:2px solid #e2e8f0;"><span class="expense-detail-label" style="font-weight:800;">ИТОГО КОРЕЯ:</span><span class="expense-detail-value" style="font-weight:800;">${formatNumber(koreaUSD)} $</span></div>
                </div>
            </div>
            
            <div style="margin-bottom:16px;"><div style="font-weight:800; margin-bottom:8px; font-size:15px; color:#1e3a5f;">🇰🇬 Расходы Бишкек</div>
                <div class="expense-detail">
                    <div class="expense-detail-row"><span class="expense-detail-label">Разгрузка + эвакуатор:</span><span class="expense-detail-value">${formatNumber(bishkekUnloading)} $</span></div>
                    <div class="expense-detail-row"><span class="expense-detail-label">СВХ + брокер:</span><span class="expense-detail-value">${formatNumber(bishkekBroker)} $</span></div>
                    <div class="expense-detail-row"><span class="expense-detail-label">Доставка в РФ:</span><span class="expense-detail-value">${formatNumber(bishkekDelivery)} $</span></div>
                    <div class="expense-detail-row" style="margin-top:6px; padding-top:6px; border-top:2px solid #e2e8f0;"><span class="expense-detail-label" style="font-weight:800;">ИТОГО БИШКЕК:</span><span class="expense-detail-value" style="font-weight:800;">${formatNumber(bishkekUSD)} $</span></div>
                </div>
            </div>
            
            <div style="margin-bottom:16px;"><div style="font-weight:800; margin-bottom:8px; font-size:15px; color:#1e3a5f;">🇷🇺 Расходы РФ</div>
                <div class="expense-detail">
                    <div class="expense-detail-row"><span class="expense-detail-label">Разгрузка авто:</span><span class="expense-detail-value">${formatNumber(rfUnloading)} ₽</span></div>
                    <div class="expense-detail-row"><span class="expense-detail-label">Подготовка к выдаче:</span><span class="expense-detail-value">${formatNumber(rfPreparation)} ₽</span></div>
                    <div class="expense-detail-row"><span class="expense-detail-label">Оформление документов:</span><span class="expense-detail-value">${formatNumber(rfDocuments)} ₽</span></div>
                    <div class="expense-detail-row"><span class="expense-detail-label">Наши услуги:</span><span class="expense-detail-value">${formatNumber(ourServices)} ₽</span></div>
                    <div class="expense-detail-row" style="margin-top:6px; padding-top:6px; border-top:2px solid #e2e8f0;"><span class="expense-detail-label" style="font-weight:800;">ИТОГО РФ:</span><span class="expense-detail-value" style="font-weight:800;">${formatNumber(rfRUB + ourServices)} ₽</span></div>
                </div>
            </div>
            
            <div style="margin-bottom:16px;"><div style="font-weight:800; margin-bottom:8px; font-size:15px; color:#1e3a5f;">🏛️ Таможенное оформление</div>
                <div class="expense-detail">
                    <div class="expense-detail-row"><span class="expense-detail-label">Таможенная стоимость:</span><span class="expense-detail-value">${euroPrice ? formatNumber(euroPrice) + ' €' : '—'}</span></div>
                    <div class="expense-detail-row"><span class="expense-detail-label">ТПО (48%):</span><span class="expense-detail-value">${formatNumber(tpoValue)} $</span></div>
                    <div class="expense-detail-row"><span class="expense-detail-label">Утилизационный сбор:</span><span class="expense-detail-value">${formatNumber(utilizationFee)} ₽</span></div>
                </div>
            </div>
            
            <table class="price-table">
                <thead><tr><th>Статья расходов</th><th>Сумма</th></tr></thead>
                <tbody>
                    <tr><td>💰 Цена авто + расходы (USD)</td><td>${formatNumber(priceUsd + koreaUSD + bishkekUSD + tpoValue)} $</td></tr>
                    <tr><td>💎 Конвертация по курсу USDT</td><td>${usdtRate.toFixed(2)} ₽</td></tr>
                    <tr><td>♻️ Утилизационный сбор</td><td>${formatNumber(utilizationFee)} ₽</td></tr>
                    <tr><td>📄 Расходы РФ</td><td>${formatNumber(rfRUB)} ₽</td></tr>
                    <tr><td>🤝 Наши услуги</td><td>${formatNumber(ourServices)} ₽</td></tr>
                    <tr class="total-row"><td>💰 ИТОГОВАЯ СТОИМОСТЬ</td><td>${formatNumber(totalPrice)} ₽</td></tr>
                </tbody>
            </table>
        </div>
        
        <div class="footer">
            <p>Курс USD: ${usdRate.toFixed(2)} ₽ | EUR: ${eurRate.toFixed(2)} ₽ | USDT: ${usdtRate.toFixed(2)} ₽</p>
            <div class="requisites">
                <span>${companySettings.companyName}</span>
                <span>ИНН: ${companySettings.inn}</span>
                <span>ОГРН: ${companySettings.ogrn}</span>
                <span>${companySettings.address}</span>
                <span>тел: ${companySettings.phone}</span>
            </div>
            <p style="margin-top:10px;">* Данное предложение носит информационный характер и не является публичной офертой.</p>
            <p style="margin-top:5px;">Дата формирования: ${formatDate()}</p>
        </div>
    </div>
    
    ${photosList.length ? `
    <div class="page">
        <div class="photos-section">
            <div class="section-title"><span class="section-icon">📸</span>ФОТОГРАФИИ АВТОМОБИЛЯ</div>
            <div class="photos-grid">
                ${photosList.slice(0, 6).map(url => `<div class="photo-item"><img src="${url}" alt="Фото" loading="lazy" onerror="this.style.opacity='0.3'"></div>`).join('')}
                ${Array(Math.max(0, 6 - photosList.length)).fill('<div class="photo-item empty"></div>').join('')}
            </div>
        </div>
        <div class="footer"><p>© ${brand} ${model} — полная комплектация</p></div>
    </div>
    ` : ''}
</div>

<script>
    const defaultSettings = ${settingsJson};
    
    function showSettingsDialog() {
        let currentSettings = defaultSettings;
        const saved = localStorage.getItem('encar_company_settings');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                currentSettings = { ...defaultSettings, ...parsed };
            } catch(e) {}
        }
        
        const html = \`
            <div id="settings-overlay" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:20000;display:flex;align-items:center;justify-content:center;font-family:'Segoe UI',sans-serif;">
                <div style="background:#1e293b;border-radius:20px;padding:25px;width:500px;max-width:90%;color:#f1f5f9;box-shadow:0 20px 40px rgba(0,0,0,0.5);max-height:90vh;overflow-y:auto;">
                    <h3 style="margin:0 0 20px 0;color:#fbbf24;">⚙️ Настройки компании и авто</h3>
                    <div style="margin-bottom:12px;"><label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">Название компании</label><input type="text" id="set-companyName" value="${currentSettings.companyName.replace(/"/g, '&quot;')}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;"></div>
                    <div style="margin-bottom:12px;"><label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">ИНН</label><input type="text" id="set-inn" value="${currentSettings.inn}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;"></div>
                    <div style="margin-bottom:12px;"><label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">ОГРН</label><input type="text" id="set-ogrn" value="${currentSettings.ogrn}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;"></div>
                    <div style="margin-bottom:12px;"><label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">Адрес</label><input type="text" id="set-address" value="${currentSettings.address.replace(/"/g, '&quot;')}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;"></div>
                    <div style="margin-bottom:12px;"><label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">Телефон компании</label><input type="text" id="set-phone" value="${currentSettings.phone}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;"></div>
                    <div style="margin-bottom:12px;"><label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">Имя менеджера</label><input type="text" id="set-managerName" value="${currentSettings.managerName.replace(/"/g, '&quot;')}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;"></div>
                    <div style="margin-bottom:12px;"><label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">Должность менеджера</label><input type="text" id="set-managerPosition" value="${currentSettings.managerPosition.replace(/"/g, '&quot;')}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;"></div>
                    <div style="margin-bottom:12px;"><label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">Телефон менеджера</label><input type="text" id="set-managerPhone" value="${currentSettings.managerPhone}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;"></div>
                    <div style="margin-bottom:12px;"><label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">Срок действия (дней)</label><input type="number" id="set-offerValidDays" value="${currentSettings.offerValidDays}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;"></div>
                    <div style="margin-bottom:12px;"><label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">URL логотипа</label><input type="text" id="set-logo" value="${currentSettings.logo}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;"></div>
                    <div style="margin-bottom:12px;"><label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">Марка (оставьте пустым для авто-определения)</label><input type="text" id="set-customBrand" value="${currentSettings.customBrand || ''}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;"></div>
                    <div style="margin-bottom:12px;"><label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">Модель (оставьте пустым для авто-определения)</label><input type="text" id="set-customModel" value="${currentSettings.customModel || ''}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;"></div>
                    <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:20px;"><button id="settings-cancel" style="background:#475569;border:none;padding:8px 20px;border-radius:8px;color:white;cursor:pointer;">Отмена</button><button id="settings-save" style="background:#fbbf24;border:none;padding:8px 20px;border-radius:8px;color:#0f172a;font-weight:bold;cursor:pointer;">Сохранить</button></div>
                </div>
            </div>
        \`;
        document.body.insertAdjacentHTML('beforeend', html);
        document.getElementById('settings-cancel').onclick = () => document.getElementById('settings-overlay').remove();
        document.getElementById('settings-save').onclick = () => {
            const newSettings = {
                companyName: document.getElementById('set-companyName').value,
                inn: document.getElementById('set-inn').value,
                ogrn: document.getElementById('set-ogrn').value,
                address: document.getElementById('set-address').value,
                phone: document.getElementById('set-phone').value,
                managerName: document.getElementById('set-managerName').value,
                managerPosition: document.getElementById('set-managerPosition').value,
                managerPhone: document.getElementById('set-managerPhone').value,
                offerValidDays: parseInt(document.getElementById('set-offerValidDays').value) || 3,
                logo: document.getElementById('set-logo').value,
                customBrand: document.getElementById('set-customBrand').value,
                customModel: document.getElementById('set-customModel').value
            };
            localStorage.setItem('encar_company_settings', JSON.stringify(newSettings));
            alert('Настройки сохранены. Страница будет перезагружена.');
            location.reload();
        };
    }
</script>
</body>
</html>`;
            
            const printWindow = window.open('', '_blank', 'width=1200,height=900');
            printWindow.document.write(reportHtml);
            printWindow.document.close();
        }
        
        unsafeWindow.EncarPhotos = { 
            print: printReport, 
            find: findAllPhotos, 
            getPhotos: () => photosList,
            showSettings: () => {}
        };
        
        console.log('[Photos] Модуль загружен v7.4');
    });
})();
