// ==UserScript==
// @name         Encar Photos Module
// @namespace    http://tampermonkey.net/
// @version      5.2
// @description  Поиск фото через генерацию URL
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
    
    console.log('[Photos] Модуль загружен v5.2');
    
    if (!unsafeWindow.EncarHub) {
        console.error('[Photos] CoreHub не найден!');
        return;
    }
    
    const Hub = unsafeWindow.EncarHub;
    let photosList = [];
    
    function findCarId() {
        const urlMatch = window.location.href.match(/carid=(\d+)/);
        if (urlMatch) return urlMatch[1];
        
        if (window.__PRELOADED_STATE__?.cars?.base?.vehicleId) {
            return window.__PRELOADED_STATE__.cars.base.vehicleId;
        }
        
        return null;
    }
    
    function generateAllPhotoUrls(carId) {
        const urls = [];
        const baseUrl = `https://ci.encar.com/carpicture/carpicture${carId.slice(-2)}/pic${carId.slice(0,4)}/${carId}_`;
        
        for (let i = 1; i <= 30; i++) {
            const num = String(i).padStart(3, '0');
            urls.push(`${baseUrl}${num}.jpg`);
        }
        
        console.log(`[Photos] Сгенерировано ${urls.length} URL`);
        return urls;
    }
    
    async function findAllPhotos() {
        console.log('[Photos] Поиск фото...');
        
        const carId = findCarId();
        if (!carId) {
            console.warn('[Photos] CarId не найден');
            photosList = [];
            Hub.set('photosList', []);
            return [];
        }
        
        console.log(`[Photos] CarId: ${carId}`);
        photosList = generateAllPhotoUrls(carId);
        Hub.set('photosList', photosList);
        
        console.log(`[Photos] Подготовлено ${photosList.length} URL`);
        return photosList;
    }
    
    function generatePhotosHTML(photoUrls) {
        if (!photoUrls.length) {
            return '<div class="page"><div class="photos-header">📸 Фотографии отсутствуют</div></div>';
        }
        
        let pagesHTML = '';
        const photosPerPage = 16;
        const limitedPhotos = photoUrls.slice(0, 16);
        
        for (let page = 0; page < limitedPhotos.length; page += photosPerPage) {
            const pagePhotos = limitedPhotos.slice(page, page + photosPerPage);
            const pageNumber = Math.floor(page / photosPerPage) + 1;
            const totalPages = Math.ceil(limitedPhotos.length / photosPerPage);
            
            pagesHTML += `<div class="page photos-page">`;
            pagesHTML += `<div class="photos-header">📸 ФОТОГРАФИИ АВТОМОБИЛЯ (${pageNumber}/${totalPages})</div>`;
            pagesHTML += `<div class="photos-grid">`;
            
            for (let i = 0; i < photosPerPage; i++) {
                if (i < pagePhotos.length) {
                    pagesHTML += `<div class="photo-cell"><img src="${pagePhotos[i]}" alt="Фото ${page + i + 1}" loading="lazy" onerror="this.style.opacity='0.3'"></div>`;
                } else {
                    pagesHTML += `<div class="photo-cell empty"></div>`;
                }
            }
            
            pagesHTML += `</div><div class="page-number">${pageNumber}/${totalPages}</div></div>`;
        }
        return pagesHTML;
    }
    
    function formatVolume(cc) {
        if (!cc) return null;
        const liters = cc / 1000;
        return Number.isInteger(liters) ? `${liters}.0L` : `${liters.toFixed(1)}L`;
    }
    
    function formatMileage(mileage) {
        if (!mileage) return null;
        if (mileage >= 10000) return `${(mileage / 10000).toFixed(1)}만 km`;
        return `${mileage.toLocaleString()} km`;
    }
    
    async function printReport() {
        console.log('[Photos] Генерация КП...');
        
        if (!photosList.length) {
            const loadingDiv = document.createElement('div');
            loadingDiv.textContent = '🔍 Подготовка фотографий...';
            loadingDiv.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#1e293b; color:white; padding:15px 25px; border-radius:12px; z-index:10030;';
            document.body.appendChild(loadingDiv);
            await findAllPhotos();
            loadingDiv.remove();
        }
        
        const photosHTML = generatePhotosHTML(photosList);
        
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
        const koreaLogistics = Hub.get('koreaLogistics') || 4000;
        const servicesBishkek = Hub.get('servicesBishkek') || 1200;
        const docsRf = Hub.get('docsRf') || 80000;
        const ourServices = Hub.get('ourServices') || 250000;
        const utilizationFee = Hub.get('utilizationFee') || 0;
        const tpoValue = Hub.get('calculatedTpo') || 0;
        const totalPrice = Hub.get('totalPrice') || 0;
        const usdRate = Hub.get('usdRate') || 0;
        const eurRate = Hub.get('eurRate') || 0;
        const usdtRate = Hub.get('usdtRate') || 0;
        
        const yearDisplay = month ? `${year}/${month}` : year;
        
        const reportHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Коммерческое предложение</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Segoe UI',Arial,sans-serif;background:#e0e0e0;padding:20px}
        .toolbar{position:fixed;bottom:20px;right:20px;z-index:1000;display:flex;gap:10px}
        .toolbar button{padding:12px 24px;font-size:14px;font-weight:bold;border:none;border-radius:8px;cursor:pointer}
        .btn-print{background:#2c5f2d;color:white}
        .btn-pdf{background:#1a5276;color:white}
        .page{background:white;width:210mm;min-height:297mm;margin:0 auto 20px auto;padding:15mm;page-break-after:always}
        .header{text-align:center;margin-bottom:20px;padding-bottom:15px;border-bottom:2px solid #fbbf24}
        .header h1{color:#0f2a44;font-size:24px}
        .car-info{background:#f8fafc;border-radius:12px;padding:15px;margin-bottom:20px}
        .car-info h3{color:#0f2a44;border-bottom:1px solid #e2e8f0;padding-bottom:8px;margin-bottom:12px}
        .info-row{display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px}
        .info-label{font-weight:600;color:#475569}
        .price-table{width:100%;border-collapse:collapse;margin-bottom:20px}
        .price-table th,.price-table td{padding:10px;text-align:left;border-bottom:1px solid #e2e8f0}
        .price-table th{background:#f1f5f9}
        .total-row{background:#fef3c7;font-weight:bold}
        .footer{margin-top:20px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:15px}
        .photos-page{background:white;width:210mm;min-height:297mm;margin:0 auto 20px auto;padding:10mm;page-break-after:always}
        .photos-header{text-align:center;font-size:18px;font-weight:bold;color:#0f2a44;margin-bottom:15px;border-bottom:2px solid #fbbf24}
        .photos-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
        .photo-cell{background:#f5f5f5;border:1px solid #ddd;border-radius:4px;min-height:140px;display:flex;align-items:center;justify-content:center;overflow:hidden}
        .photo-cell img{width:100%;height:100%;object-fit:contain}
        .photo-cell.empty{background:#fafafa;border:1px dashed #ccc}
        .page-number{text-align:center;margin-top:8mm;font-size:10px;color:#999}
        @media print{.toolbar{display:none}.page,.photos-page{box-shadow:none;margin:0;padding:0}}
    </style>
</head>
<body>
<div class="toolbar"><button class="btn-print" onclick="window.print()">🖨️ Печать</button><button class="btn-pdf" onclick="window.print()">📄 Сохранить PDF</button></div>
<div class="page">
<div class="header"><h1>КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ</h1><p>Дата: ${new Date().toLocaleDateString('ru-RU')}</p></div>
<div class="car-info">
<h3>📋 Информация об автомобиле</h3>
<div class="info-row"><span class="info-label">Марка/Модель:</span><span>${brand} ${model}</span></div>
<div class="info-row"><span class="info-label">Год выпуска:</span><span>${yearDisplay}</span></div>
<div class="info-row"><span class="info-label">Объём двигателя:</span><span>${formatVolume(engineVolume) || '—'}</span></div>
<div class="info-row"><span class="info-label">Мощность:</span><span>${power ? `${power} л.с.` : '—'}</span></div>
<div class="info-row"><span class="info-label">Пробег:</span><span>${formatMileage(mileage) || '—'}</span></div>
<div class="info-row"><span class="info-label">VIN номер:</span><span style="font-family:monospace;">${vin}</span></div>
<div class="info-row"><span class="info-label">Просмотры:</span><span>${views?.toLocaleString() || '—'}</span></div>
</div>
<table class="price-table">
<thead><tr><th>Статья расходов</th><th>Сумма</th></tr></thead>
<tbody>
<tr><td>🚗 Стоимость авто (USD)</td><td>${priceUsd.toLocaleString()} $</td></tr>
<tr><td>💰 Стоимость (EUR)</td><td>${typeof euroPrice === 'number' ? euroPrice.toLocaleString() : euroPrice} €</td></tr>
<tr><td>📦 Расходы Корея + логистика</td><td>${koreaLogistics.toLocaleString()} $</td></tr>
<tr><td>🏛️ ТПО</td><td>${tpoValue.toLocaleString()} $</td></tr>
<tr><td>🚚 Услуги Бишкек + доставка РФ</td><td>${servicesBishkek.toLocaleString()} $</td></tr>
<tr><td>♻️ Утилизационный сбор</td><td>${utilizationFee.toLocaleString()} ₽</td></tr>
<tr><td>📄 Документы РФ</td><td>${docsRf.toLocaleString()} ₽</td></tr>
<tr><td>🤝 Наши услуги</td><td>${ourServices.toLocaleString()} ₽</td></tr>
<tr class="total-row"><td><strong>💰 ИТОГОВАЯ СТОИМОСТЬ</strong></td><td><strong>${totalPrice.toLocaleString()} ₽</strong></td></tr>
</tbody>
</table>
<div class="footer"><p>Курс USD: ${usdRate.toFixed(2)} ₽ | EUR: ${eurRate.toFixed(2)} ₽ | USDT: ${usdtRate.toFixed(2)} ₽</p><p>* Данное предложение носит информационный характер и не является публичной офертой.</p></div>
</div>
${photosHTML}
</body>
</html>`;
        
        const printWindow = window.open('', '_blank', 'width=1100,height=800');
        printWindow.document.write(reportHtml);
        printWindow.document.close();
    }
    
    unsafeWindow.EncarPhotos = { print: printReport, find: findAllPhotos, getPhotos: () => photosList };
    
    setTimeout(() => {
        findAllPhotos().then(p => console.log(`[Photos] Готово ${p.length} URL`));
    }, 2000);
})();
