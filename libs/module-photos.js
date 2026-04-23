// ==UserScript==
// @name         Encar Photos Module
// @namespace    http://tampermonkey.net/
// @version      5.1
// @description  Коммерческое предложение с детальными расходами
// @match        *://www.encar.com/cars/detail/*
// @match        *://fem.encar.com/cars/detail/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      ci.encar.com
// @connect      image.encar.com
// @connect      api.encar.com
// ==/UserScript==

(function() {
    'use strict';
    
    console.log('[Photos] Фирменный стиль загружен');
    
    if (!unsafeWindow.EncarHub) {
        console.error('[Photos] CoreHub не найден!');
        return;
    }
    
    const Hub = unsafeWindow.EncarHub;
    let photosList = [];
    
    // ========== ДЕТАЛЬНЫЕ РАСХОДЫ ==========
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
    
    function formatNumber(num) { return num ? num.toLocaleString() : '—'; }
    function formatMileage(mileage) { if (!mileage) return '—'; return `${mileage.toLocaleString()} km`; }
    function formatVolume(cc) { if (!cc) return '—'; const liters = cc / 1000; return Number.isInteger(liters) ? `${liters}.0L` : `${liters.toFixed(1)}L`; }
    
    // ========== ПОИСК ФОТО ==========
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
        if (photos.length >= 5) { photosList = photos.slice(0, 16); Hub.set('photosList', photosList); return photosList; }
        const carId = findCarId();
        if (carId) { photosList = generatePhotoUrls(carId).slice(0, 16); Hub.set('photosList', photosList); return photosList; }
        photosList = []; Hub.set('photosList', []); return [];
    }
    
    function generatePhotosHTML(photoUrls) {
        if (!photoUrls.length) return '';
        let html = '';
        const photosPerPage = 16;
        const limited = photoUrls.slice(0, 16);
        for (let page = 0; page < limited.length; page += photosPerPage) {
            const pagePhotos = limited.slice(page, page + photosPerPage);
            const pageNumber = Math.floor(page / photosPerPage) + 1;
            const totalPages = Math.ceil(limited.length / photosPerPage);
            html += `<div class="photos-section"><div class="section-title"><span class="section-icon">📸</span>ФОТОГРАФИИ АВТОМОБИЛЯ<span class="page-count">${pageNumber}/${totalPages}</span></div><div class="photos-grid">`;
            for (let i = 0; i < photosPerPage; i++) {
                if (i < pagePhotos.length) html += `<div class="photo-item"><img src="${pagePhotos[i]}" alt="Фото" loading="lazy" onerror="this.style.opacity='0.3'"></div>`;
                else html += `<div class="photo-item empty"></div>`;
            }
            html += `</div></div>`;
        }
        return html;
    }
    
    async function printReport() {
        console.log('[Photos] Генерация КП...');
        loadDetailedSettings();
        
        if (!photosList.length) {
            const loadingDiv = document.createElement('div');
            loadingDiv.innerHTML = '<div class="loading-spinner"></div><div style="margin-top:15px">🔍 Поиск фотографий...</div>';
            loadingDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1e1e2f;color:white;padding:25px 40px;border-radius:20px;z-index:10030;text-align:center;font-family:system-ui;box-shadow:0 20px 40px rgba(0,0,0,0.4);';
            document.body.appendChild(loadingDiv);
            await findAllPhotos();
            loadingDiv.remove();
        }
        
        const photosHTML = generatePhotosHTML(photosList);
        const usdToKrw = Hub.get('usdToKrw') || 1473;
        const carPriceKrw = Hub.get('carPriceKrw') || 0;
        const priceUsd = carPriceKrw ? Math.round(carPriceKrw / usdToKrw) : 0;
        let exportFee = carPriceKrw * koreaExportFeePercent / 100;
        if (exportFee < koreaExportFeeMin) exportFee = koreaExportFeeMin;
        
        const totalKoreaUSD = Math.round((koreaInspection + koreaDealerCommission + koreaDelivery + koreaEvacuator + exportFee + koreaFreight) / usdToKrw);
        const totalBishkekUSD = bishkekUnloading + bishkekBroker + bishkekDelivery;
        const totalRFRUB = rfUnloading + rfPreparation + rfDocuments;
        
        const brand = Hub.get('carBrand') || '—';
        const model = Hub.get('carModel') || '—';
        const year = Hub.get('carYear') || '—';
        const month = Hub.get('carMonth');
        const vin = Hub.get('carVin') || '—';
        const mileage = Hub.get('carMileage');
        const engineVolume = Hub.get('carEngineVolume');
        const power = Hub.get('carPowerHp');
        const views = Hub.get('carViews');
        const euroPrice = Hub.get('selectedEuroPrice') || '—';
        const tpoValue = Hub.get('calculatedTpo') || 0;
        const utilizationFee = Hub.get('utilizationFee') || 0;
        const totalPrice = Hub.get('totalPrice') || 0;
        const usdRate = Hub.get('usdRate') || 0;
        const eurRate = Hub.get('eurRate') || 0;
        const usdtRate = Hub.get('usdtRate') || 0;
        const accidentTotal = Hub.get('accidentTotal') || '—';
        const yearDisplay = month ? `${year}/${month}` : year;
        
        const reportHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Коммерческое предложение | ${brand} ${model}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter','Segoe UI',system-ui;background:#e8edf2;padding:30px}
.toolbar{position:fixed;bottom:30px;right:30px;z-index:1000;display:flex;gap:12px}
.toolbar button{padding:12px 28px;font-size:14px;font-weight:600;border:none;border-radius:50px;cursor:pointer;transition:all 0.2s;box-shadow:0 4px 12px rgba(0,0,0,0.15)}
.btn-print{background:#1e3a5f;color:white}
.btn-pdf{background:#2c5f2d;color:white}
.toolbar button:hover{transform:translateY(-2px)}
.proposal{max-width:1100px;margin:0 auto}
.page{background:white;border-radius:24px;margin-bottom:30px;box-shadow:0 20px 40px -12px rgba(0,0,0,0.2);overflow:hidden;page-break-after:always}
.header{background:linear-gradient(135deg,#0f2a44 0%,#1a4a6f 100%);padding:30px 40px;color:white}
.logo-area{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:20px}
.company-name{font-size:28px;font-weight:800;letter-spacing:-0.5px}
.company-tag{font-size:12px;opacity:0.8;margin-top:5px}
.doc-badge{background:rgba(255,255,255,0.2);padding:8px 16px;border-radius:30px;font-size:12px;font-weight:500}
.title-block{border-top:1px solid rgba(255,255,255,0.2);padding-top:20px;margin-top:10px}
.title-block h1{font-size:32px;font-weight:700}
.title-block .date{font-size:13px;opacity:0.7;margin-top:8px}
.section{padding:24px 40px;border-bottom:1px solid #eef2f6}
.section-title{font-size:16px;font-weight:700;color:#1e3a5f;margin-bottom:20px;display:flex;align-items:center;gap:10px}
.section-icon{font-size:20px}
.info-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px 30px}
.info-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #eef2f6}
.info-label{font-size:13px;font-weight:500;color:#64748b}
.info-value{font-size:14px;font-weight:600;color:#1e293b}
.expense-detail{margin-top:8px;padding-left:20px;border-left:2px solid #fbbf24}
.expense-detail-row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px}
.expense-detail-label{color:#64748b}
.expense-detail-value{color:#1e293b;font-weight:500}
.price-table{width:100%;border-collapse:collapse}
.price-table th{text-align:left;padding:12px 0;font-size:13px;font-weight:600;color:#64748b;border-bottom:1px solid #eef2f6}
.price-table td{padding:12px 0;font-size:14px;border-bottom:1px solid #eef2f6}
.price-table td:last-child{text-align:right;font-weight:600}
.total-row{background:#fef9e6}
.total-row td{font-weight:800;font-size:18px;color:#d97706;border-bottom:none}
.photos-section{padding:24px 40px}
.photos-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
.photo-item{aspect-ratio:4/3;background:#f8fafc;border-radius:16px;overflow:hidden;border:1px solid #eef2f6}
.photo-item img{width:100%;height:100%;object-fit:cover}
.photo-item.empty{background:#f8fafc;border:1px dashed #cbd5e1}
.page-count{margin-left:auto;font-size:12px;font-weight:normal;color:#94a3b8}
.footer{background:#f8fafc;padding:20px 40px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #eef2f6}
.loading-spinner{width:40px;height:40px;border:3px solid rgba(255,255,255,0.2);border-top-color:#fbbf24;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto}
@keyframes spin{to{transform:rotate(360deg)}}
@media print{.toolbar{display:none}body{background:white;padding:0}.page{box-shadow:none;margin:0;border-radius:0}.header{-webkit-print-color-adjust:exact;print-color-adjust:exact}.total-row{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head>
<body>
<div class="toolbar"><button class="btn-print" onclick="window.print()">🖨️ Печать</button><button class="btn-pdf" onclick="window.print()">📄 Сохранить PDF</button></div>
<div class="proposal">
<div class="page">
<div class="header"><div class="logo-area"><div><div class="company-name">AUTO IMPORT</div><div class="company-tag">профессиональный импорт автомобилей</div></div><div class="doc-badge">КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ №${Date.now().toString().slice(-6)}</div></div><div class="title-block"><h1>${brand} ${model}</h1><div class="date">Дата: ${new Date().toLocaleDateString('ru-RU')}</div></div></div>
<div class="section"><div class="section-title"><span class="section-icon">📋</span>ИНФОРМАЦИЯ ОБ АВТОМОБИЛЕ</div>
<div class="info-grid">
<div class="info-row"><span class="info-label">📅 Год выпуска</span><span class="info-value">${yearDisplay}</span></div>
<div class="info-row"><span class="info-label">🔧 Двигатель</span><span class="info-value">${formatVolume(engineVolume)}</span></div>
<div class="info-row"><span class="info-label">⚡ Мощность</span><span class="info-value">${power ? `${power} л.с.` : '—'}</span></div>
<div class="info-row"><span class="info-label">📊 Пробег</span><span class="info-value">${formatMileage(mileage)}</span></div>
<div class="info-row"><span class="info-label">🔢 VIN номер</span><span class="info-value" style="font-family:monospace;">${vin}</span></div>
<div class="info-row"><span class="info-label">👁️ Просмотры</span><span class="info-value">${views?.toLocaleString() || '—'}</span></div>
<div class="info-row"><span class="info-label">💸 Страховые выплаты</span><span class="info-value" style="color:#fbbf24;">${accidentTotal}</span></div>
</div></div>
<div class="section"><div class="section-title"><span class="section-icon">💰</span>РАСЧЁТ СТОИМОСТИ</div>
<div class="info-grid" style="margin-bottom:20px;"><div class="info-row"><span class="info-label">💰 Цена в Корее</span><span class="info-value">${carPriceKrw ? formatNumber(carPriceKrw) + ' ₩' : '—'} / ${priceUsd ? formatNumber(priceUsd) + ' $' : '—'}</span></div></div>
<div style="margin-bottom:16px;"><div style="font-weight:700;margin-bottom:8px;">🇰🇷 Расходы Корея</div>
<div class="expense-detail">
<div class="expense-detail-row"><span class="expense-detail-label">🔍 Осмотр авто:</span><span class="expense-detail-value">${formatNumber(koreaInspection)} ₩ (${Math.round(koreaInspection/usdToKrw)} $)</span></div>
<div class="expense-detail-row"><span class="expense-detail-label">💰 Комиссия дилера:</span><span class="expense-detail-value">${formatNumber(koreaDealerCommission)} ₩ (${Math.round(koreaDealerCommission/usdToKrw)} $)</span></div>
<div class="expense-detail-row"><span class="expense-detail-label">🚚 Доставка по Корее:</span><span class="expense-detail-value">${formatNumber(koreaDelivery)} ₩ (${Math.round(koreaDelivery/usdToKrw)} $)</span></div>
<div class="expense-detail-row"><span class="expense-detail-label">🔄 Эвакуатор в порт:</span><span class="expense-detail-value">${formatNumber(koreaEvacuator)} ₩ (${Math.round(koreaEvacuator/usdToKrw)} $)</span></div>
<div class="expense-detail-row"><span class="expense-detail-label">📄 Экспортные документы:</span><span class="expense-detail-value">${koreaExportFeePercent}% (мин ${formatNumber(koreaExportFeeMin)} ₩) = ${formatNumber(exportFee)} ₩ (${Math.round(exportFee/usdToKrw)} $)</span></div>
<div class="expense-detail-row"><span class="expense-detail-label">🚢 Фрахт до Бишкека:</span><span class="expense-detail-value">${formatNumber(koreaFreight)} ₩ (${Math.round(koreaFreight/usdToKrw)} $)</span></div>
<div class="expense-detail-row" style="margin-top:6px;padding-top:6px;border-top:1px solid #eef2f6;"><span class="expense-detail-label" style="font-weight:bold;">ИТОГО КОРЕЯ:</span><span class="expense-detail-value" style="font-weight:bold;">${formatNumber(totalKoreaUSD)} $</span></div>
</div></div>
<div style="margin-bottom:16px;"><div style="font-weight:700;margin-bottom:8px;">🇰🇬 Расходы Бишкек</div>
<div class="expense-detail">
<div class="expense-detail-row"><span class="expense-detail-label">📦 Разгрузка + эвакуатор:</span><span class="expense-detail-value">${formatNumber(bishkekUnloading)} $</span></div>
<div class="expense-detail-row"><span class="expense-detail-label">📋 СВХ + брокерские услуги:</span><span class="expense-detail-value">${formatNumber(bishkekBroker)} $</span></div>
<div class="expense-detail-row"><span class="expense-detail-label">🚚 Доставка в РФ:</span><span class="expense-detail-value">${formatNumber(bishkekDelivery)} $</span></div>
<div class="expense-detail-row" style="margin-top:6px;padding-top:6px;border-top:1px solid #eef2f6;"><span class="expense-detail-label" style="font-weight:bold;">ИТОГО БИШКЕК:</span><span class="expense-detail-value" style="font-weight:bold;">${formatNumber(totalBishkekUSD)} $</span></div>
</div></div>
<div style="margin-bottom:16px;"><div style="font-weight:700;margin-bottom:8px;">🇷🇺 Расходы РФ</div>
<div class="expense-detail">
<div class="expense-detail-row"><span class="expense-detail-label">🔄 Разгрузка авто:</span><span class="expense-detail-value">${formatNumber(rfUnloading)} ₽</span></div>
<div class="expense-detail-row"><span class="expense-detail-label">🔧 Подготовка к выдаче:</span><span class="expense-detail-value">${formatNumber(rfPreparation)} ₽</span></div>
<div class="expense-detail-row"><span class="expense-detail-label">📄 Оформление документов:</span><span class="expense-detail-value">${formatNumber(rfDocuments)} ₽</span></div>
<div class="expense-detail-row" style="margin-top:6px;padding-top:6px;border-top:1px solid #eef2f6;"><span class="expense-detail-label" style="font-weight:bold;">ИТОГО РФ:</span><span class="expense-detail-value" style="font-weight:bold;">${formatNumber(totalRFRUB)} ₽</span></div>
</div></div>
<table class="price-table"><thead><tr><th>Статья расходов</th><th>Сумма</th></tr></thead><tbody>
<tr><td>💰 Таможенная стоимость (EUR)</td><td>${typeof euroPrice === 'number' ? formatNumber(euroPrice) : euroPrice} €</td></tr>
<tr><td>🏛️ ТПО</td><td>${formatNumber(tpoValue)} $</td></tr>
<tr><td>♻️ Утилизационный сбор</td><td>${formatNumber(utilizationFee)} ₽</td></tr>
<tr class="total-row"><td>💰 ИТОГОВАЯ СТОИМОСТЬ</td><td>${formatNumber(totalPrice)} ₽</td></tr>
</tbody></table></div>
<div class="footer"><p>Курс USD: ${usdRate.toFixed(2)} ₽ | EUR: ${eurRate.toFixed(2)} ₽ | USDT: ${usdtRate.toFixed(2)} ₽</p><p>Данное предложение действительно в течение 3 дней и не является публичной офертой.</p><p>© AUTO IMPORT — профессиональный импорт автомобилей</p></div>
</div>
${photosHTML ? `<div class="page">${photosHTML}<div class="footer"><p>© AUTO IMPORT — профессиональный импорт автомобилей</p></div></div>` : ''}
</div></body></html>`;
        
        const printWindow = window.open('', '_blank', 'width=1200,height=900');
        printWindow.document.write(reportHtml);
        printWindow.document.close();
    }
    
    unsafeWindow.EncarPhotos = { print: printReport, find: findAllPhotos, getPhotos: () => photosList };
    console.log('[Photos] Фирменный стиль КП готов');
})();
