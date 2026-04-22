// ==UserScript==
// @name         Encar Photos Module
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Коммерческое предложение в фирменном стиле
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
    
    // ========== ПОИСК ФОТО ==========
    function findCarId() {
        const urlMatch = window.location.href.match(/carid=(\d+)/);
        if (urlMatch) return urlMatch[1];
        if (window.__PRELOADED_STATE__?.cars?.base?.vehicleId) {
            return window.__PRELOADED_STATE__.cars.base.vehicleId;
        }
        return null;
    }
    
    function findPhotosInDOM() {
        const urls = new Set();
        document.querySelectorAll('img[src*="ci.encar.com"], img[data-src*="ci.encar.com"]').forEach(img => {
            let src = img.src || img.getAttribute('data-src');
            if (src && src.includes('ci.encar.com')) {
                const cleanUrl = src.split('?')[0];
                if (cleanUrl.match(/_\d{3}\.jpg$/)) {
                    urls.add(cleanUrl);
                }
            }
        });
        const urlPattern = /(https?:\/\/ci\.encar\.com[^\s"'<>]+_\d{3}\.jpg)/gi;
        document.querySelectorAll('script').forEach(script => {
            const matches = script.textContent.match(urlPattern);
            if (matches) {
                matches.forEach(url => urls.add(url.split('?')[0]));
            }
        });
        return Array.from(urls);
    }
    
    function generatePhotoUrls(carId) {
        const urls = [];
        const baseUrl = `https://ci.encar.com/carpicture/carpicture${carId.slice(-2)}/pic${carId.slice(0,4)}/${carId}_`;
        for (let i = 1; i <= 20; i++) {
            const num = String(i).padStart(3, '0');
            urls.push(`${baseUrl}${num}.jpg`);
        }
        return urls;
    }
    
    async function findAllPhotos() {
        console.log('[Photos] Поиск фото...');
        let photos = findPhotosInDOM();
        if (photos.length >= 5) {
            photosList = photos.slice(0, 16);
            Hub.set('photosList', photosList);
            return photosList;
        }
        const carId = findCarId();
        if (carId) {
            const generatedUrls = generatePhotoUrls(carId);
            photosList = generatedUrls.slice(0, 16);
            Hub.set('photosList', photosList);
            return photosList;
        }
        photosList = [];
        Hub.set('photosList', []);
        return [];
    }
    
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
    
    function formatNumber(num) {
        return num ? num.toLocaleString() : '—';
    }
    
    // ========== ГЕНЕРАЦИЯ HTML ФОТО ==========
    function generatePhotosHTML(photoUrls) {
        if (!photoUrls.length) {
            return '';
        }
        
        let pagesHTML = '';
        const photosPerPage = 16;
        const limitedPhotos = photoUrls.slice(0, 16);
        
        for (let page = 0; page < limitedPhotos.length; page += photosPerPage) {
            const pagePhotos = limitedPhotos.slice(page, page + photosPerPage);
            const pageNumber = Math.floor(page / photosPerPage) + 1;
            const totalPages = Math.ceil(limitedPhotos.length / photosPerPage);
            
            pagesHTML += `
            <div class="photos-section">
                <div class="section-title">
                    <span class="section-icon">📸</span>
                    ФОТОГРАФИИ АВТОМОБИЛЯ
                    <span class="page-count">${pageNumber}/${totalPages}</span>
                </div>
                <div class="photos-grid">`;
            
            for (let i = 0; i < photosPerPage; i++) {
                if (i < pagePhotos.length) {
                    pagesHTML += `<div class="photo-item"><img src="${pagePhotos[i]}" alt="Фото ${page + i + 1}" loading="lazy" onerror="this.style.opacity='0.3'"></div>`;
                } else {
                    pagesHTML += `<div class="photo-item empty"></div>`;
                }
            }
            
            pagesHTML += `
                </div>
            </div>`;
        }
        return pagesHTML;
    }
    
    // ========== ГЕНЕРАЦИЯ ОТЧЁТА ==========
    async function printReport() {
        console.log('[Photos] Генерация КП в фирменном стиле...');
        
        if (!photosList.length) {
            const loadingDiv = document.createElement('div');
            loadingDiv.innerHTML = '<div class="loading-spinner"></div><div style="margin-top:15px">🔍 Поиск фотографий...</div>';
            loadingDiv.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#1e1e2f; color:white; padding:25px 40px; border-radius:20px; z-index:10030; text-align:center; font-family:system-ui; box-shadow:0 20px 40px rgba(0,0,0,0.4);';
            document.body.appendChild(loadingDiv);
            await findAllPhotos();
            loadingDiv.remove();
        }
        
        const photosHTML = generatePhotosHTML(photosList);
        
        // Данные из Hub
        const brand = Hub.get('carBrand') || '—';
        const model = Hub.get('carModel') || '—';
        const year = Hub.get('carYear') || '—';
        const month = Hub.get('carMonth');
        const vin = Hub.get('carVin') || '—';
        const mileage = Hub.get('carMileage');
        const engineVolume = Hub.get('carEngineVolume');
        const power = Hub.get('carPowerHp');
        const views = Hub.get('carViews');
        const carPriceKrw = Hub.get('carPriceKrw');
        const usdToKrw = Hub.get('usdToKrw') || 1473;
        const priceUsd = carPriceKrw ? Math.round(carPriceKrw / usdToKrw) : 0;
        const euroPrice = Hub.get('selectedEuroPrice') || '—';
        const koreaLogistics = Hub.get('koreaLogistics') || 5000;
        const kirgizLogistics = 2000;
        const docsRf = Hub.get('docsRf') || 80000;
        const ourServices = Hub.get('ourServices') || 250000;
        const utilizationFee = Hub.get('utilizationFee') || 0;
        const tpoValue = Hub.get('calculatedTpo') || 0;
        const totalPrice = Hub.get('totalPrice') || 0;
        const usdRate = Hub.get('usdRate') || 0;
        const eurRate = Hub.get('eurRate') || 0;
        const usdtRate = Hub.get('usdtRate') || 0;
        
        const yearDisplay = month ? `${year}/${month}` : year;
        const mileageDisplay = formatMileage(mileage);
        const volumeDisplay = formatVolume(engineVolume);
        const accidentTotal = Hub.get('accidentTotal') || '—';
        const accidentDetails = Hub.get('accidentDetails') || [];
        
        // Формируем HTML страховых выплат
        let accidentHTML = '';
        if (accidentDetails.length > 0) {
            accidentHTML = `
            <div class="info-row">
                <span class="info-label">💸 Страховые выплаты</span>
                <span class="info-value" style="color:#fbbf24;">${accidentTotal}</span>
            </div>`;
            for (const acc of accidentDetails) {
                accidentHTML += `
                <div style="margin-top:6px; padding-left:15px; font-size:11px; color:#94a3b8; border-left:2px solid #fbbf24;">
                    Случай ${acc.idx || ''}: ${acc.amountUsd?.toLocaleString() || '—'} $
                </div>`;
            }
        } else if (accidentTotal !== '—') {
            accidentHTML = `
            <div class="info-row">
                <span class="info-label">💸 Страховые выплаты</span>
                <span class="info-value" style="color:#22c55e;">${accidentTotal}</span>
            </div>`;
        }
        
        const reportHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
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
            padding: 30px;
        }
        
        /* Тулбар */
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
            font-family: inherit;
        }
        
        .btn-print {
            background: #1e3a5f;
            color: white;
        }
        
        .btn-print:hover {
            background: #0f2a44;
            transform: translateY(-2px);
        }
        
        .btn-pdf {
            background: #2c5f2d;
            color: white;
        }
        
        .btn-pdf:hover {
            background: #1e421f;
            transform: translateY(-2px);
        }
        
        /* Основной контейнер */
        .proposal {
            max-width: 1100px;
            margin: 0 auto;
        }
        
        /* Страница */
        .page {
            background: white;
            border-radius: 24px;
            margin-bottom: 30px;
            box-shadow: 0 20px 40px -12px rgba(0,0,0,0.2);
            overflow: hidden;
            page-break-after: always;
            break-inside: avoid;
        }
        
        /* Шапка с логотипом */
        .header {
            background: linear-gradient(135deg, #0f2a44 0%, #1a4a6f 100%);
            padding: 30px 40px;
            color: white;
        }
        
        .logo-area {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-bottom: 20px;
        }
        
        .company-name {
            font-size: 28px;
            font-weight: 800;
            letter-spacing: -0.5px;
        }
        
        .company-tag {
            font-size: 12px;
            opacity: 0.8;
            margin-top: 5px;
        }
        
        .doc-badge {
            background: rgba(255,255,255,0.2);
            padding: 8px 16px;
            border-radius: 30px;
            font-size: 12px;
            font-weight: 500;
        }
        
        .title-block {
            border-top: 1px solid rgba(255,255,255,0.2);
            padding-top: 20px;
            margin-top: 10px;
        }
        
        .title-block h1 {
            font-size: 32px;
            font-weight: 700;
            letter-spacing: -0.5px;
        }
        
        .title-block .date {
            font-size: 13px;
            opacity: 0.7;
            margin-top: 8px;
        }
        
        /* Секции */
        .section {
            padding: 24px 40px;
            border-bottom: 1px solid #eef2f6;
        }
        
        .section-title {
            font-size: 16px;
            font-weight: 700;
            color: #1e3a5f;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
            letter-spacing: -0.3px;
        }
        
        .section-icon {
            font-size: 20px;
        }
        
        /* Информация об авто */
        .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px 30px;
        }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            padding: 8px 0;
            border-bottom: 1px dashed #eef2f6;
        }
        
        .info-label {
            font-size: 13px;
            font-weight: 500;
            color: #64748b;
        }
        
        .info-value {
            font-size: 14px;
            font-weight: 600;
            color: #1e293b;
        }
        
        /* Таблица расходов */
        .price-table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .price-table th {
            text-align: left;
            padding: 12px 0;
            font-size: 13px;
            font-weight: 600;
            color: #64748b;
            border-bottom: 1px solid #eef2f6;
        }
        
        .price-table td {
            padding: 12px 0;
            font-size: 14px;
            border-bottom: 1px solid #eef2f6;
        }
        
        .price-table td:last-child {
            text-align: right;
            font-weight: 600;
        }
        
        .total-row {
            background: #fef9e6;
        }
        
        .total-row td {
            border-bottom: none;
            font-weight: 800;
            font-size: 18px;
            color: #d97706;
        }
        
        .total-row td:first-child {
            font-size: 16px;
        }
        
        /* Фото */
        .photos-section {
            padding: 24px 40px;
        }
        
        .photos-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
        }
        
        .photo-item {
            aspect-ratio: 4/3;
            background: #f8fafc;
            border-radius: 16px;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid #eef2f6;
        }
        
        .photo-item img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .photo-item.empty {
            background: #f8fafc;
            border: 1px dashed #cbd5e1;
        }
        
        .page-count {
            margin-left: auto;
            font-size: 12px;
            font-weight: normal;
            color: #94a3b8;
        }
        
        /* Футер */
        .footer {
            background: #f8fafc;
            padding: 20px 40px;
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
            border-top: 1px solid #eef2f6;
        }
        
        .footer p {
            margin: 5px 0;
        }
        
        /* Анимация загрузки */
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
        
        @media print {
            body {
                background: white;
                padding: 0;
            }
            .toolbar {
                display: none;
            }
            .page {
                box-shadow: none;
                margin: 0;
                border-radius: 0;
                page-break-after: always;
            }
            .header {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .total-row {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
        }
    </style>
</head>
<body>
<div class="toolbar">
    <button class="btn-print" onclick="window.print()">🖨️ Печать</button>
    <button class="btn-pdf" onclick="window.print()">📄 Сохранить PDF</button>
</div>

<div class="proposal">
    <!-- Страница 1: Основная информация -->
    <div class="page">
        <div class="header">
            <div class="logo-area">
                <div>
                    <div class="company-name">AUTO IMPORT</div>
                    <div class="company-tag">профессиональный импорт автомобилей</div>
                </div>
                <div class="doc-badge">КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ №${Date.now().toString().slice(-6)}</div>
            </div>
            <div class="title-block">
                <h1>${brand} ${model}</h1>
                <div class="date">Дата составления: ${new Date().toLocaleDateString('ru-RU')}</div>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">
                <span class="section-icon">📋</span>
                ИНФОРМАЦИЯ ОБ АВТОМОБИЛЕ
            </div>
            <div class="info-grid">
                <div class="info-row"><span class="info-label">📅 Год выпуска</span><span class="info-value">${yearDisplay}</span></div>
                <div class="info-row"><span class="info-label">🔧 Двигатель</span><span class="info-value">${volumeDisplay}</span></div>
                <div class="info-row"><span class="info-label">⚡ Мощность</span><span class="info-value">${power ? `${power} л.с.` : '—'}</span></div>
                <div class="info-row"><span class="info-label">📊 Пробег</span><span class="info-value">${mileageDisplay}</span></div>
                <div class="info-row"><span class="info-label">🔢 VIN номер</span><span class="info-value" style="font-family:monospace;">${vin}</span></div>
                <div class="info-row"><span class="info-label">👁️ Просмотры</span><span class="info-value">${views?.toLocaleString() || '—'}</span></div>
                ${accidentHTML}
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">
                <span class="section-icon">💰</span>
                РАСЧЁТ СТОИМОСТИ
            </div>
            <table class="price-table">
                <thead>
                    <tr><th>Статья расходов</th><th>Сумма</th></tr>
                </thead>
                <tbody>
                    <tr><td>🚗 Стоимость авто (USD)</td><td>${formatNumber(priceUsd)} $</td></tr>
                    <tr><td>💰 Стоимость (EUR)</td><td>${typeof euroPrice === 'number' ? formatNumber(euroPrice) : euroPrice} €</td></tr>
                    <tr><td>📦 Расходы Корея/Логистика</td><td>${formatNumber(koreaLogistics)} $</td></tr>
                    <tr><td>🏛️ Расходы Киргизия/Логистика</td><td>${formatNumber(kirgizLogistics)} $</td></tr>
                    <tr><td>🏛️ ТПО</td><td>${formatNumber(tpoValue)} $</td></tr>
                    <tr><td>♻️ Утилизационный сбор</td><td>${formatNumber(utilizationFee)} ₽</td></tr>
                    <tr><td>📄 Документы РФ</td><td>${formatNumber(docsRf)} ₽</td></tr>
                    <tr><td>🤝 Наши услуги</td><td>${formatNumber(ourServices)} ₽</td></tr>
                    <tr class="total-row"><td>💰 ИТОГОВАЯ СТОИМОСТЬ</td><td>${formatNumber(totalPrice)} ₽</td></tr>
                </tbody>
            </table>
        </div>
        
        <div class="footer">
            <p>Курс USD: ${usdRate.toFixed(2)} ₽ | EUR: ${eurRate.toFixed(2)} ₽ | USDT: ${usdtRate.toFixed(2)} ₽</p>
            <p>Данное предложение действительно в течение 3 дней и не является публичной офертой.</p>
            <p>© AUTO IMPORT — профессиональный импорт автомобилей</p>
        </div>
    </div>
    
    ${photosHTML ? `
    <!-- Страница 2: Фотографии -->
    <div class="page">
        ${photosHTML}
        <div class="footer">
            <p>© AUTO IMPORT — профессиональный импорт автомобилей</p>
        </div>
    </div>
    ` : ''}
</div>
</body>
</html>`;
        
        const printWindow = window.open('', '_blank', 'width=1200,height=900,toolbar=yes,scrollbars=yes');
        printWindow.document.write(reportHtml);
        printWindow.document.close();
    }
    
    // Экспорт
    unsafeWindow.EncarPhotos = { 
        print: printReport,
        find: findAllPhotos,
        getPhotos: () => photosList
    };
    
    console.log('[Photos] Фирменный стиль КП готов');
})();
