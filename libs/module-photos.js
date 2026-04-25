// ==UserScript==
// @name         Encar Photos Module (Pro)
// @namespace    http://tampermonkey.net/
// @version      7.1
// @description  Профессиональное КП с единым окном настроек и печатью на А4
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
        
        // Настройки компании (с ООО "ИнДрайв" по умолчанию)
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
            logo: 'https://cdn.trx.tradedealer.ru/746/media/download/pB9Ltu__logo-indriv-e.svg'
        };
        
        // Детальные расходы (синхронизация с UI)
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
        
        function saveCompanySettings() {
            localStorage.setItem('encar_company_settings', JSON.stringify(companySettings));
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
        
        function showSettingsDialog() {
            const html = `
                <div id="settings-overlay" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:20000;display:flex;align-items:center;justify-content:center;font-family:'Segoe UI',sans-serif;">
                    <div style="background:#1e293b;border-radius:20px;padding:25px;width:450px;max-width:90%;color:#f1f5f9;box-shadow:0 20px 40px rgba(0,0,0,0.5);">
                        <h3 style="margin:0 0 20px 0;color:#fbbf24;">⚙️ Настройки компании</h3>
                        <div style="margin-bottom:12px;">
                            <label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">Название компании</label>
                            <input type="text" id="set-companyName" value="${companySettings.companyName.replace(/"/g, '&quot;')}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;">
                        </div>
                        <div style="margin-bottom:12px;">
                            <label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">ИНН</label>
                            <input type="text" id="set-inn" value="${companySettings.inn}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;">
                        </div>
                        <div style="margin-bottom:12px;">
                            <label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">ОГРН</label>
                            <input type="text" id="set-ogrn" value="${companySettings.ogrn}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;">
                        </div>
                        <div style="margin-bottom:12px;">
                            <label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">Адрес</label>
                            <input type="text" id="set-address" value="${companySettings.address.replace(/"/g, '&quot;')}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;">
                        </div>
                        <div style="margin-bottom:12px;">
                            <label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">Телефон компании</label>
                            <input type="text" id="set-phone" value="${companySettings.phone}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;">
                        </div>
                        <div style="margin-bottom:12px;">
                            <label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">Имя менеджера</label>
                            <input type="text" id="set-managerName" value="${companySettings.managerName.replace(/"/g, '&quot;')}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;">
                        </div>
                        <div style="margin-bottom:12px;">
                            <label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">Должность менеджера</label>
                            <input type="text" id="set-managerPosition" value="${companySettings.managerPosition.replace(/"/g, '&quot;')}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;">
                        </div>
                        <div style="margin-bottom:12px;">
                            <label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">Телефон менеджера</label>
                            <input type="text" id="set-managerPhone" value="${companySettings.managerPhone}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;">
                        </div>
                        <div style="margin-bottom:12px;">
                            <label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">Срок действия предложения (дней)</label>
                            <input type="number" id="set-offerValidDays" value="${companySettings.offerValidDays}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;">
                        </div>
                        <div style="margin-bottom:20px;">
                            <label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">URL логотипа</label>
                            <input type="text" id="set-logo" value="${companySettings.logo}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;">
                        </div>
                        <div style="display:flex;gap:12px;justify-content:flex-end;">
                            <button id="settings-cancel" style="background:#475569;border:none;padding:8px 20px;border-radius:8px;color:white;cursor:pointer;">Отмена</button>
                            <button id="settings-save" style="background:#fbbf24;border:none;padding:8px 20px;border-radius:8px;color:#0f172a;font-weight:bold;cursor:pointer;">Сохранить</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            const overlay = document.getElementById('settings-overlay');
            document.getElementById('settings-cancel').onclick = () => overlay.remove();
            document.getElementById('settings-save').onclick = () => {
                companySettings.companyName = document.getElementById('set-companyName').value;
                companySettings.inn = document.getElementById('set-inn').value;
                companySettings.ogrn = document.getElementById('set-ogrn').value;
                companySettings.address = document.getElementById('set-address').value;
                companySettings.phone = document.getElementById('set-phone').value;
                companySettings.managerName = document.getElementById('set-managerName').value;
                companySettings.managerPosition = document.getElementById('set-managerPosition').value;
                companySettings.managerPhone = document.getElementById('set-managerPhone').value;
                companySettings.offerValidDays = parseInt(document.getElementById('set-offerValidDays').value) || 3;
                companySettings.logo = document.getElementById('set-logo').value;
                saveCompanySettings();
                overlay.remove();
                alert('Настройки сохранены. Обновите страницу для применения изменений.');
            };
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
            
            const brand = Hub.get('carBrand') || '—';
            const model = Hub.get('carModel') || '—';
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
            
            const reportHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Коммерческое предложение | ${brand} ${model}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
            background: #e8edf2;
            padding: 20px;
        }
        
        .toolbar {
            position: fixed;
            bottom: 30px;
            right: 30px;
            z-index: 1000;
            display: flex;
            gap: 12px;
        }
        
        .toolbar button {
            padding: 12px 28px;
            font-size: 14px;
            font-weight: 600;
            border: none;
            border-radius: 50px;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        
        .toolbar button:hover {
            transform: translateY(-2px);
        }
        
        .btn-print { background: #1e3a5f; color: white; }
        .btn-pdf { background: #2c5f2d; color: white; }
        .btn-settings { background: #475569; color: white; }
        
        .proposal {
            max-width: 1100px;
            margin: 0 auto;
        }
        
        .page {
            background: white;
            border-radius: 24px;
            margin-bottom: 30px;
            box-shadow: 0 20px 40px -12px rgba(0,0,0,0.2);
            overflow: hidden;
            page-break-after: always;
        }
        
        /* Стили для печати на А4 */
        @media print {
            .toolbar { display: none; }
            body { background: white; padding: 0; margin: 0; }
            .page { 
                box-shadow: none; 
                margin: 0; 
                border-radius: 0; 
                page-break-after: always;
                width: 100%;
            }
            .header, .total-row { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .photo-item { break-inside: avoid; }
        }
        
        /* Header */
        .header {
            background: linear-gradient(135deg, #0f2a44 0%, #1a4a6f 100%);
            padding: 35px 45px;
            color: white;
        }
        
        .logo-area {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            flex-wrap: wrap;
            gap: 20px;
        }
        
        .logo-area img {
            height: 65px;
            max-width: 240px;
            object-fit: contain;
        }
        
        .company-info {
            text-align: right;
            font-size: 13px;
            line-height: 1.6;
            font-weight: 500;
        }
        
        .title-block {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            border-top: 1px solid rgba(255,255,255,0.2);
            padding-top: 25px;
            flex-wrap: wrap;
            gap: 20px;
        }
        
        .car-title {
            font-size: 32px;
            font-weight: 800;
            letter-spacing: -0.5px;
        }
        
        .manager-info {
            text-align: right;
            font-size: 14px;
        }
        
        .manager-name {
            font-weight: 700;
            margin-bottom: 5px;
            font-size: 16px;
        }
        
        .validity {
            font-size: 12px;
            opacity: 0.8;
            margin-top: 12px;
            font-weight: 500;
        }
        
        /* Sections */
        .section {
            padding: 25px 45px;
            border-bottom: 1px solid #eef2f6;
        }
        
        .section-title {
            font-size: 20px;
            font-weight: 800;
            color: #1e3a5f;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
            letter-spacing: -0.3px;
        }
        
        .section-icon {
            font-size: 24px;
        }
        
        /* Info grid */
        .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px 40px;
        }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #eef2f6;
        }
        
        .info-label {
            font-size: 15px;
            font-weight: 500;
            color: #475569;
        }
        
        .info-value {
            font-size: 16px;
            font-weight: 700;
            color: #0f172a;
        }
        
        /* Expense details */
        .expense-detail {
            margin-top: 12px;
            padding-left: 24px;
            border-left: 3px solid #fbbf24;
        }
        
        .expense-detail-row {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            font-size: 13px;
        }
        
        .expense-detail-label {
            color: #475569;
            font-weight: 500;
        }
        
        .expense-detail-value {
            color: #0f172a;
            font-weight: 600;
        }
        
        /* Price table */
        .price-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        
        .price-table th {
            text-align: left;
            padding: 12px 0;
            font-size: 14px;
            font-weight: 700;
            color: #475569;
            border-bottom: 2px solid #e2e8f0;
        }
        
        .price-table td {
            padding: 12px 0;
            font-size: 15px;
            border-bottom: 1px solid #eef2f6;
        }
        
        .price-table td:last-child {
            text-align: right;
            font-weight: 700;
        }
        
        .total-row {
            background: #fef9e6;
        }
        
        .total-row td {
            font-weight: 800;
            font-size: 20px;
            color: #d97706;
            border-bottom: none;
        }
        
        .total-row td:last-child {
            font-size: 24px;
        }
        
        /* Photos */
        .photos-section {
            padding: 25px 45px;
        }
        
        .photos-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            margin-top: 20px;
        }
        
        .photo-item {
            aspect-ratio: 4/3;
            background: #f8fafc;
            border-radius: 16px;
            overflow: hidden;
            border: 1px solid #e2e8f0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        
        .photo-item img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .photo-item.empty {
            background: #f1f5f9;
            border: 1px dashed #cbd5e1;
        }
        
        /* Footer */
        .footer {
            background: #f8fafc;
            padding: 20px 45px;
            text-align: center;
            font-size: 11px;
            color: #64748b;
            border-top: 1px solid #eef2f6;
        }
        
        .requisites {
            display: flex;
            justify-content: space-between;
            flex-wrap: wrap;
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid #e2e8f0;
            font-size: 10px;
            gap: 12px;
        }
        
        .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(255,255,255,0.2);
            border-top-color: #fbbf24;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin: 0 auto;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        @media (max-width: 768px) {
            body { padding: 10px; }
            .section { padding: 20px 25px; }
            .photos-grid { grid-template-columns: repeat(2, 1fr); }
            .info-grid { grid-template-columns: 1fr; }
            .title-block { flex-direction: column; align-items: flex-start; }
            .manager-info { text-align: left; }
        }
    </style>
</head>
<body>
<div class="toolbar">
    <button class="btn-settings" onclick="window.EncarPhotos.showSettings()">⚙️ Настройки</button>
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
            <div class="section-title">
                <span class="section-icon">📋</span>ИНФОРМАЦИЯ ОБ АВТОМОБИЛЕ
            </div>
            <div class="info-grid">
                <div class="info-row"><span class="info-label">📅 Год выпуска</span><span class="info-value">${yearDisplay}</span></div>
                <div class="info-row"><span class="info-label">🔧 Двигатель</span><span class="info-value">${engineVolume ? (engineVolume/1000).toFixed(1) + 'L' : '—'}</span></div>
                <div class="info-row"><span class="info-label">⚡ Мощность</span><span class="info-value">${power ? `${power} л.с.` : '—'}</span></div>
                <div class="info-row"><span class="info-label">📊 Пробег</span><span class="info-value">${mileage ? `${mileage.toLocaleString()} km` : '—'}</span></div>
                <div class="info-row"><span class="info-label">🔢 VIN номер</span><span class="info-value" style="font-family:monospace;">${vin === '—' || !vin ? '—' : vin}</span></div>
                <div class="info-row"><span class="info-label">👁️ Просмотры</span><span class="info-value">${views?.toLocaleString() || '—'}</span></div>
                <div class="info-row"><span class="info-label">💸 Страховые выплаты</span><span class="info-value" style="color:#fbbf24;">${accidentTotal}</span></div>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">
                <span class="section-icon">💰</span>РАСЧЁТ СТОИМОСТИ
            </div>
            <div class="info-grid" style="margin-bottom:20px;">
                <div class="info-row"><span class="info-label">💰 Цена в Корее</span><span class="info-value">${carPriceKrw ? formatNumber(carPriceKrw) + ' ₩' : '—'} / ${priceUsd ? formatNumber(priceUsd) + ' $' : '—'}</span></div>
            </div>
            
            <div style="margin-bottom:18px;">
                <div style="font-weight:800; margin-bottom:10px; font-size:16px; color:#1e3a5f;">🇰🇷 Расходы Корея</div>
                <div class="expense-detail">
                    <div class="expense-detail-row"><span class="expense-detail-label">Осмотр авто:</span><span class="expense-detail-value">${formatNumber(koreaInspection)} ₩ (${Math.round(koreaInspection/usdToKrw)} $)</span></div>
                    <div class="expense-detail-row"><span class="expense-detail-label">Комиссия дилера:</span><span class="expense-detail-value">${formatNumber(koreaDealerCommission)} ₩ (${Math.round(koreaDealerCommission/usdToKrw)} $)</span></div>
                    <div class="expense-detail-row"><span class="expense-detail-label">Доставка по Корее:</span><span class="expense-detail-value">${formatNumber(koreaDelivery)} ₩ (${Math.round(koreaDelivery/usdToKrw)} $)</span></div>
                    <div class="expense-detail-row"><span class="expense-detail-label">Эвакуатор в порт:</span><span class="expense-detail-value">${formatNumber(koreaEvacuator)} ₩ (${Math.round(koreaEvacuator/usdToKrw)} $)</span></div>
                    <div class="expense-detail-row"><span class="expense-detail-label">Экспортные документы:</span><span class="expense-detail-value">${koreaExportFeePercent}% = ${formatNumber(exportFee)} ₩ (${Math.round(exportFee/usdToKrw)} $)</span></div>
                    <div class="expense-detail-row"><span class="expense-detail-label">Фрахт до Бишкека:</span><span class="expense-detail-value">${formatNumber(koreaFreight)} ₩ (${Math.round(koreaFreight/usdToKrw)} $)</span></div>
                    <div class="expense-detail-row" style="margin-top:8px; padding-top:8px; border-top:2px solid #e2e8f0;"><span class="expense-detail-label" style="font-weight:800;">ИТОГО КОРЕЯ:</span><span class="expense-detail-value" style="font-weight:800;">${formatNumber(koreaUSD)} $</span></div>
                </div>
            </div>
            
            <div style="margin-bottom:18px;">
                <div style="font-weight:800; margin-bottom:10px; font-size:16px; color:#1e3a5f;">🇰🇬 Расходы Бишкек</div>
                <div class="expense-detail">
                    <div class="expense-detail-row"><span class="expense-detail-label">Разгрузка + эвакуатор:</span><span class="expense-detail-value">${formatNumber(bishkekUnloading)} $</span></div>
                    <div class="expense-detail-row"><span class="expense-detail-label">СВХ + брокерские услуги:</span><span class="expense-detail-value">${formatNumber(bishkekBroker)} $</span></div>
                    <div class="expense-detail-row"><span class="expense-detail-label">Доставка в РФ:</span><span class="expense-detail-value">${formatNumber(bishkekDelivery)} $</span></div>
                    <div class="expense-detail-row" style="margin-top:8px; padding-top:8px; border-top:2px solid #e2e8f0;"><span class="expense-detail-label" style="font-weight:800;">ИТОГО БИШКЕК:</span><span class="expense-detail-value" style="font-weight:800;">${formatNumber(bishkekUSD)} $</span></div>
                </div>
            </div>
            
            <div style="margin-bottom:18px;">
                <div style="font-weight:800; margin-bottom:10px; font-size:16px; color:#1e3a5f;">🇷🇺 Расходы РФ</div>
                <div class="expense-detail">
                    <div class="expense-detail-row"><span class="expense-detail-label">Разгрузка авто:</span><span class="expense-detail-value">${formatNumber(rfUnloading)} ₽</span></div>
                    <div class="expense-detail-row"><span class="expense-detail-label">Подготовка к выдаче:</span><span class="expense-detail-value">${formatNumber(rfPreparation)} ₽</span></div>
                    <div class="expense-detail-row"><span class="expense-detail-label">Оформление документов:</span><span class="expense-detail-value">${formatNumber(rfDocuments)} ₽</span></div>
                    <div class="expense-detail-row"><span class="expense-detail-label">Наши услуги:</span><span class="expense-detail-value">${formatNumber(ourServices)} ₽</span></div>
                    <div class="expense-detail-row" style="margin-top:8px; padding-top:8px; border-top:2px solid #e2e8f0;"><span class="expense-detail-label" style="font-weight:800;">ИТОГО РФ:</span><span class="expense-detail-value" style="font-weight:800;">${formatNumber(rfRUB + ourServices)} ₽</span></div>
                </div>
            </div>
            
            <div style="margin-bottom:18px;">
                <div style="font-weight:800; margin-bottom:10px; font-size:16px; color:#1e3a5f;">🏛️ Таможенное оформление</div>
                <div class="expense-detail">
                    <div class="expense-detail-row"><span class="expense-detail-label">Таможенная стоимость:</span><span class="expense-detail-value">${euroPrice ? formatNumber(euroPrice) + ' €' : '—'}</span></div>
                    <div class="expense-detail-row"><span class="expense-detail-label">ТПО (48% от таможенной стоимости):</span><span class="expense-detail-value">${formatNumber(tpoValue)} $</span></div>
                    <div class="expense-detail-row"><span class="expense-detail-label">Утилизационный сбор:</span><span class="expense-detail-value">${formatNumber(utilizationFee)} ₽</span></div>
                </div>
            </div>
            
            <table class="price-table">
                <thead>
                    <tr><th>Статья расходов</th><th>Сумма</th></tr>
                </thead>
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
            <p style="margin-top:12px;">* Данное предложение носит информационный характер и не является публичной офертой.</p>
            <p style="margin-top:6px;">Дата формирования: ${formatDate()}</p>
        </div>
    </div>
    
    ${photosList.length ? `
    <div class="page">
        <div class="photos-section">
            <div class="section-title">
                <span class="section-icon">📸</span>ФОТОГРАФИИ АВТОМОБИЛЯ
            </div>
            <div class="photos-grid">
                ${photosList.slice(0, 6).map(url => `<div class="photo-item"><img src="${url}" alt="Фото" loading="lazy" onerror="this.style.opacity='0.3'"></div>`).join('')}
                ${Array(Math.max(0, 6 - photosList.length)).fill('<div class="photo-item empty"></div>').join('')}
            </div>
        </div>
        <div class="footer">
            <p>© ${brand} ${model} — полная комплектация</p>
        </div>
    </div>
    ` : ''}
</div>

<script>
    window.EncarPhotos = window.EncarPhotos || {};
    window.EncarPhotos.showSettings = function() {
        // Функция будет переопределена из основного скрипта, но заглушка
        alert('Настройки доступны через кнопку в интерфейсе');
    };
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
            showSettings: showSettingsDialog
        };
        
        console.log('[Photos] Модуль загружен v7.1 (солидный дизайн, 6 фото, единое окно настроек)');
    });
})();
