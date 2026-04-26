// ==UserScript==
// @name         Encar Photos Module (Pro)
// @namespace    http://tampermonkey.net/
// @version      7.5
// @description  Профессиональное КП (упрощённая версия)
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
    
    console.log('[Photos] Загрузка...');
    
    function waitForHub(callback) {
        if (unsafeWindow.EncarHub) {
            console.log('[Photos] CoreHub найден');
            callback();
            return;
        }
        console.log('[Photos] Ожидание CoreHub...');
        const interval = setInterval(() => {
            if (unsafeWindow.EncarHub) {
                clearInterval(interval);
                console.log('[Photos] CoreHub найден');
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
        
        // Настройки компании (по умолчанию)
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
        
        // Загружаем настройки из localStorage
        try {
            const saved = localStorage.getItem('encar_company_settings');
            if (saved) {
                const parsed = JSON.parse(saved);
                companySettings = { ...companySettings, ...parsed };
            }
        } catch(e) {}
        
        // Детальные расходы
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
                    <div style="background:#1e293b;border-radius:20px;padding:25px;width:450px;max-width:90%;color:#f1f5f9;box-shadow:0 20px 40px rgba(0,0,0,0.5);max-height:90vh;overflow-y:auto;">
                        <h3 style="margin:0 0 20px 0;color:#fbbf24;">⚙️ Настройки</h3>
                        <div style="margin-bottom:12px;"><label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">Название компании</label><input type="text" id="set-companyName" value="${companySettings.companyName.replace(/"/g, '&quot;')}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;"></div>
                        <div style="margin-bottom:12px;"><label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">ИНН</label><input type="text" id="set-inn" value="${companySettings.inn}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;"></div>
                        <div style="margin-bottom:12px;"><label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">ОГРН</label><input type="text" id="set-ogrn" value="${companySettings.ogrn}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;"></div>
                        <div style="margin-bottom:12px;"><label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">Адрес</label><input type="text" id="set-address" value="${companySettings.address.replace(/"/g, '&quot;')}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;"></div>
                        <div style="margin-bottom:12px;"><label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">Телефон</label><input type="text" id="set-phone" value="${companySettings.phone}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;"></div>
                        <div style="margin-bottom:12px;"><label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">Менеджер</label><input type="text" id="set-managerName" value="${companySettings.managerName.replace(/"/g, '&quot;')}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;"></div>
                        <div style="margin-bottom:12px;"><label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">Телефон менеджера</label><input type="text" id="set-managerPhone" value="${companySettings.managerPhone}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;"></div>
                        <div style="margin-bottom:12px;"><label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">Марка (вручную)</label><input type="text" id="set-customBrand" value="${companySettings.customBrand || ''}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;"></div>
                        <div style="margin-bottom:12px;"><label style="display:block;font-size:12px;margin-bottom:4px;color:#94a3b8;">Модель (вручную)</label><input type="text" id="set-customModel" value="${companySettings.customModel || ''}" style="width:100%;padding:8px;border-radius:8px;border:none;background:#0f172a;color:white;"></div>
                        <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:20px;">
                            <button id="settings-cancel" style="background:#475569;border:none;padding:8px 20px;border-radius:8px;color:white;cursor:pointer;">Отмена</button>
                            <button id="settings-save" style="background:#fbbf24;border:none;padding:8px 20px;border-radius:8px;color:#0f172a;font-weight:bold;cursor:pointer;">Сохранить</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            document.getElementById('settings-cancel').onclick = () => document.getElementById('settings-overlay').remove();
            document.getElementById('settings-save').onclick = () => {
                companySettings.companyName = document.getElementById('set-companyName').value;
                companySettings.inn = document.getElementById('set-inn').value;
                companySettings.ogrn = document.getElementById('set-ogrn').value;
                companySettings.address = document.getElementById('set-address').value;
                companySettings.phone = document.getElementById('set-phone').value;
                companySettings.managerName = document.getElementById('set-managerName').value;
                companySettings.managerPhone = document.getElementById('set-managerPhone').value;
                companySettings.customBrand = document.getElementById('set-customBrand').value;
                companySettings.customModel = document.getElementById('set-customModel').value;
                localStorage.setItem('encar_company_settings', JSON.stringify(companySettings));
                document.getElementById('settings-overlay').remove();
                alert('Настройки сохранены. Обновите страницу для применения.');
            };
        }
        
        async function printReport() {
            console.log('[Photos] Генерация КП...');
            loadDetailedSettings();
            
            if (!photosList.length) {
                const loadingDiv = document.createElement('div');
                loadingDiv.innerHTML = '<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1e1e2f;color:white;padding:25px 40px;border-radius:20px;z-index:10030;text-align:center;font-family:system-ui;box-shadow:0 20px 40px rgba(0,0,0,0.4);"><div class="loading-spinner"></div><div style="margin-top:15px">🔍 Поиск фотографий...</div></div>';
                document.body.appendChild(loadingDiv);
                await findAllPhotos();
                loadingDiv.remove();
            }
            
            // Определяем марку и модель
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
            
            const reportHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Коммерческое предложение | ${brand} ${model}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui;background:#e8edf2;padding:20px}
.toolbar{position:fixed;bottom:30px;right:30px;z-index:1000;display:flex;gap:12px}
.toolbar button{padding:12px 28px;font-size:14px;font-weight:600;border:none;border-radius:50px;cursor:pointer;background:#1e3a5f;color:white}
.toolbar button:last-child{background:#2c5f2d}
.toolbar button:first-child{background:#475569}
.proposal{max-width:1100px;margin:0 auto}
.page{background:white;border-radius:24px;margin-bottom:30px;box-shadow:0 20px 40px -12px rgba(0,0,0,0.2);overflow:hidden;page-break-after:always}
@media print{.toolbar{display:none}body{background:white;padding:0}.page{box-shadow:none;margin:0;border-radius:0}}
.header{background:linear-gradient(135deg,#0f2a44,#1a4a6f);padding:18px 30px;color:white}
.logo-area{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap}
.logo-area img{height:40px;max-width:180px;object-fit:contain}
.company-info{text-align:right;font-size:11px;line-height:1.4}
.title-block{display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid rgba(255,255,255,0.2);padding-top:14px;flex-wrap:wrap}
.car-title{font-size:24px;font-weight:800}
.manager-info{text-align:right;font-size:11px}
.manager-name{font-weight:700;font-size:13px}
.validity{font-size:10px;opacity:0.8;margin-top:8px}
.section{padding:20px 30px;border-bottom:1px solid #eef2f6}
.section-title{font-size:18px;font-weight:800;color:#1e3a5f;margin-bottom:16px}
.info-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px 30px}
.info-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eef2f6}
.info-label{font-size:14px;color:#475569}
.info-value{font-size:15px;font-weight:700;color:#0f172a}
.expense-detail{margin-top:10px;padding-left:20px;border-left:2px solid #fbbf24}
.expense-detail-row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px}
.price-table{width:100%;border-collapse:collapse;margin-top:8px}
.price-table th{text-align:left;padding:10px 0;font-size:13px;border-bottom:2px solid #e2e8f0}
.price-table td{padding:10px 0;font-size:14px;border-bottom:1px solid #eef2f6}
.price-table td:last-child{text-align:right;font-weight:700}
.total-row{background:#fef9e6}
.total-row td{font-weight:800;font-size:18px;color:#d97706}
.total-row td:last-child{font-size:22px}
.photos-section{padding:20px 30px}
.photos-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:16px}
.photo-item{aspect-ratio:4/3;background:#f8fafc;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0}
.photo-item img{width:100%;height:100%;object-fit:cover}
.footer{background:#f8fafc;padding:15px 30px;text-align:center;font-size:10px;color:#64748b;border-top:1px solid #eef2f6}
.requisites{display:flex;justify-content:space-between;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:9px}
.loading-spinner{width:40px;height:40px;border:3px solid rgba(255,255,255,0.2);border-top-color:#fbbf24;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto}
@keyframes spin{to{transform:rotate(360deg)}}
@media (max-width:768px){.photos-grid{grid-template-columns:repeat(2,1fr)}.info-grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="toolbar"><button onclick="window.EncarPhotos.showSettings()">⚙️</button><button onclick="window.print()">🖨️</button><button onclick="window.print()">📄</button></div>
<div class="proposal">
<div class="page">
<div class="header">
<div class="logo-area"><img src="${companySettings.logo}" onerror="this.style.display='none'"><div class="company-info"><div><strong>${companySettings.companyName}</strong></div><div>ИНН: ${companySettings.inn} | ОГРН: ${companySettings.ogrn}</div><div>${companySettings.address}</div><div>тел: ${companySettings.phone}</div></div></div>
<div class="title-block"><div class="car-title">${brand} ${model}</div><div class="manager-info"><div class="manager-name">${companySettings.managerName}</div><div>${companySettings.managerPosition || 'Менеджер'}</div><div>тел: ${companySettings.managerPhone}</div></div></div>
<div class="validity">⚡ Предложение действительно до ${formatValidUntil()}</div>
</div>
<div class="section"><div class="section-title">📋 ИНФОРМАЦИЯ ОБ АВТОМОБИЛЕ</div>
<div class="info-grid">
<div class="info-row"><span class="info-label">📅 Год</span><span class="info-value">${yearDisplay}</span></div>
<div class="info-row"><span class="info-label">🔧 Двигатель</span><span class="info-value">${engineVolume ? (engineVolume/1000).toFixed(1) + 'L' : '—'}</span></div>
<div class="info-row"><span class="info-label">⚡ Мощность</span><span class="info-value">${power ? power + ' л.с.' : '—'}</span></div>
<div class="info-row"><span class="info-label">📊 Пробег</span><span class="info-value">${mileage ? mileage.toLocaleString() + ' km' : '—'}</span></div>
<div class="info-row"><span class="info-label">🔢 VIN</span><span class="info-value">${vin === '—' || !vin ? '—' : vin}</span></div>
<div class="info-row"><span class="info-label">👁️ Просмотры</span><span class="info-value">${views?.toLocaleString() || '—'}</span></div>
<div class="info-row"><span class="info-label">💸 Страховые выплаты</span><span class="info-value">${accidentTotal}</span></div>
</div></div>
<div class="section"><div class="section-title">💰 РАСЧЁТ СТОИМОСТИ</div>
<div class="info-grid"><div class="info-row"><span class="info-label">💰 Цена в Корее</span><span class="info-value">${carPriceKrw ? formatNumber(carPriceKrw) + ' ₩' : '—'} / ${priceUsd ? formatNumber(priceUsd) + ' $' : '—'}</span></div></div>
<div><div style="font-weight:800;margin:10px 0 8px">🇰🇷 Расходы Корея</div><div class="expense-detail">
<div class="expense-detail-row"><span>Осмотр:</span><span>${formatNumber(koreaInspection)} ₩ (${Math.round(koreaInspection/usdToKrw)} $)</span></div>
<div class="expense-detail-row"><span>Комиссия дилера:</span><span>${formatNumber(koreaDealerCommission)} ₩ (${Math.round(koreaDealerCommission/usdToKrw)} $)</span></div>
<div class="expense-detail-row"><span>Доставка по Корее:</span><span>${formatNumber(koreaDelivery)} ₩ (${Math.round(koreaDelivery/usdToKrw)} $)</span></div>
<div class="expense-detail-row"><span>Эвакуатор:</span><span>${formatNumber(koreaEvacuator)} ₩ (${Math.round(koreaEvacuator/usdToKrw)} $)</span></div>
<div class="expense-detail-row"><span>Экспортные документы:</span><span>${koreaExportFeePercent}% = ${formatNumber(exportFee)} ₩ (${Math.round(exportFee/usdToKrw)} $)</span></div>
<div class="expense-detail-row"><span>Фрахт до Бишкека:</span><span>${formatNumber(koreaFreight)} ₩ (${Math.round(koreaFreight/usdToKrw)} $)</span></div>
<div class="expense-detail-row" style="margin-top:6px;border-top:2px solid #e2e8f0"><span style="font-weight:800">ИТОГО КОРЕЯ:</span><span style="font-weight:800">${formatNumber(koreaUSD)} $</span></div>
</div></div>
<div><div style="font-weight:800;margin:10px 0 8px">🇰🇬 Расходы Бишкек</div><div class="expense-detail">
<div class="expense-detail-row"><span>Разгрузка + эвакуатор:</span><span>${formatNumber(bishkekUnloading)} $</span></div>
<div class="expense-detail-row"><span>СВХ + брокер:</span><span>${formatNumber(bishkekBroker)} $</span></div>
<div class="expense-detail-row"><span>Доставка в РФ:</span><span>${formatNumber(bishkekDelivery)} $</span></div>
<div class="expense-detail-row" style="margin-top:6px;border-top:2px solid #e2e8f0"><span style="font-weight:800">ИТОГО БИШКЕК:</span><span style="font-weight:800">${formatNumber(bishkekUSD)} $</span></div>
</div></div>
<div><div style="font-weight:800;margin:10px 0 8px">🇷🇺 Расходы РФ</div><div class="expense-detail">
<div class="expense-detail-row"><span>Разгрузка авто:</span><span>${formatNumber(rfUnloading)} ₽</span></div>
<div class="expense-detail-row"><span>Подготовка:</span><span>${formatNumber(rfPreparation)} ₽</span></div>
<div class="expense-detail-row"><span>Оформление документов:</span><span>${formatNumber(rfDocuments)} ₽</span></div>
<div class="expense-detail-row"><span>Наши услуги:</span><span>${formatNumber(ourServices)} ₽</span></div>
<div class="expense-detail-row" style="margin-top:6px;border-top:2px solid #e2e8f0"><span style="font-weight:800">ИТОГО РФ:</span><span style="font-weight:800">${formatNumber(rfRUB + ourServices)} ₽</span></div>
</div></div>
<div><div style="font-weight:800;margin:10px 0 8px">🏛️ Таможенное оформление</div><div class="expense-detail">
<div class="expense-detail-row"><span>Таможенная стоимость:</span><span>${euroPrice ? formatNumber(euroPrice) + ' €' : '—'}</span></div>
<div class="expense-detail-row"><span>ТПО (48%):</span><span>${formatNumber(tpoValue)} $</span></div>
<div class="expense-detail-row"><span>Утильсбор:</span><span>${formatNumber(utilizationFee)} ₽</span></div>
</div></div>
<table class="price-table"><thead><tr><th>Статья расходов</th><th>Сумма</th></tr></thead>
<tbody>
<tr><td>💰 Цена авто + расходы (USD)</td><td>${formatNumber(priceUsd + koreaUSD + bishkekUSD + tpoValue)} $</td></tr>
<tr><td>💎 Конвертация по курсу USDT</td><td>${usdtRate.toFixed(2)} ₽</td></tr>
<tr><td>♻️ Утилизационный сбор</td><td>${formatNumber(utilizationFee)} ₽</td></tr>
<tr><td>📄 Расходы РФ</td><td>${formatNumber(rfRUB)} ₽</td></tr>
<tr><td>🤝 Наши услуги</td><td>${formatNumber(ourServices)} ₽</td></tr>
<tr class="total-row"><td>💰 ИТОГОВАЯ СТОИМОСТЬ</td><td>${formatNumber(totalPrice)} ₽</td></tr>
</tbody></table>
</div>
<div class="footer"><p>Курс USD: ${usdRate.toFixed(2)} ₽ | EUR: ${eurRate.toFixed(2)} ₽ | USDT: ${usdtRate.toFixed(2)} ₽</p>
<div class="requisites"><span>${companySettings.companyName}</span><span>ИНН: ${companySettings.inn}</span><span>ОГРН: ${companySettings.ogrn}</span><span>${companySettings.address}</span><span>тел: ${companySettings.phone}</span></div>
<p style="margin-top:10px;">Дата: ${formatDate()}</p></div>
</div>
${photosList.length ? `<div class="page"><div class="photos-section"><div class="section-title">📸 ФОТОГРАФИИ</div><div class="photos-grid">${photosList.slice(0,6).map(url => `<div class="photo-item"><img src="${url}" onerror="this.style.opacity='0.3'"></div>`).join('')}</div></div><div class="footer"><p>© ${brand} ${model}</p></div></div>` : ''}
</div>
<script>
window.EncarPhotos = window.EncarPhotos || {};
window.EncarPhotos.showSettings = function() {
    let settings = ${JSON.stringify(companySettings)};
    const saved = localStorage.getItem('encar_company_settings');
    if(saved) try{settings={...settings,...JSON.parse(saved)}}catch(e){}
    const html=\\`<div id="sett-overlay" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:20000;display:flex;align-items:center;justify-content:center;"><div style="background:#1e293b;border-radius:20px;padding:25px;width:450px;max-width:90%;color:white;"><h3 style="color:#fbbf24;">⚙️ Настройки</h3>
    <div><label>Название компании</label><input id="s-company" value="${settings.companyName.replace(/"/g, '&quot;')}" style="width:100%;padding:8px;margin:5px 0;background:#0f172a;color:white;border:none;border-radius:8px"></div>
    <div><label>ИНН</label><input id="s-inn" value="${settings.inn}" style="width:100%;padding:8px;margin:5px 0;background:#0f172a;color:white;border:none;border-radius:8px"></div>
    <div><label>ОГРН</label><input id="s-ogrn" value="${settings.ogrn}" style="width:100%;padding:8px;margin:5px 0;background:#0f172a;color:white;border:none;border-radius:8px"></div>
    <div><label>Адрес</label><input id="s-address" value="${settings.address.replace(/"/g, '&quot;')}" style="width:100%;padding:8px;margin:5px 0;background:#0f172a;color:white;border:none;border-radius:8px"></div>
    <div><label>Телефон</label><input id="s-phone" value="${settings.phone}" style="width:100%;padding:8px;margin:5px 0;background:#0f172a;color:white;border:none;border-radius:8px"></div>
    <div><label>Менеджер</label><input id="s-manager" value="${settings.managerName.replace(/"/g, '&quot;')}" style="width:100%;padding:8px;margin:5px 0;background:#0f172a;color:white;border:none;border-radius:8px"></div>
    <div><label>Телефон менеджера</label><input id="s-managerPhone" value="${settings.managerPhone}" style="width:100%;padding:8px;margin:5px 0;background:#0f172a;color:white;border:none;border-radius:8px"></div>
    <div><label>Марка (вручную)</label><input id="s-brand" value="${settings.customBrand || ''}" style="width:100%;padding:8px;margin:5px 0;background:#0f172a;color:white;border:none;border-radius:8px"></div>
    <div><label>Модель (вручную)</label><input id="s-model" value="${settings.customModel || ''}" style="width:100%;padding:8px;margin:5px 0;background:#0f172a;color:white;border:none;border-radius:8px"></div>
    <div style="display:flex;gap:12px;margin-top:15px"><button id="sett-cancel" style="background:#475569;padding:8px 20px;border:none;border-radius:8px;color:white">Отмена</button><button id="sett-save" style="background:#fbbf24;padding:8px 20px;border:none;border-radius:8px;font-weight:bold">Сохранить</button></div>
    </div></div>\\`;
    document.body.insertAdjacentHTML('beforeend',html);
    document.getElementById('sett-cancel').onclick=()=>document.getElementById('sett-overlay').remove();
    document.getElementById('sett-save').onclick=()=>{
        const newSettings={
            companyName:document.getElementById('s-company').value,
            inn:document.getElementById('s-inn').value,
            ogrn:document.getElementById('s-ogrn').value,
            address:document.getElementById('s-address').value,
            phone:document.getElementById('s-phone').value,
            managerName:document.getElementById('s-manager').value,
            managerPhone:document.getElementById('s-managerPhone').value,
            customBrand:document.getElementById('s-brand').value,
            customModel:document.getElementById('s-model').value,
            offerValidDays:3,
            logo:'${companySettings.logo}',
            managerPosition:'Менеджер'
        };
        localStorage.setItem('encar_company_settings',JSON.stringify(newSettings));
        document.getElementById('sett-overlay').remove();
        alert('Настройки сохранены. Обновите страницу.');
    };
};
</script>
</body>
</html>`;
            
            const printWindow = window.open('', '_blank', 'width=1200,height=900');
            printWindow.document.write(reportHtml);
            printWindow.document.close();
        }
        
        // Экспортируем функции
        unsafeWindow.EncarPhotos = { 
            print: printReport, 
            find: findAllPhotos, 
            getPhotos: () => photosList,
            showSettings: showSettingsDialog
        };
        
        console.log('[Photos] Модуль загружен v7.5');
    });
})();
