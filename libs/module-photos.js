// ==UserScript==
// @name         Encar Photos Module
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Поиск фото и генерация отчёта
// @match        *://www.encar.com/cars/detail/*
// @match        *://fem.encar.com/cars/detail/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    if (!unsafeWindow.EncarHub) {
        console.error('[Photos] CoreHub не найден!');
        return;
    }

    const Hub = unsafeWindow.EncarHub;
    let photosList = [];

    function checkPhotoExists(url) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'HEAD',
                url: url,
                onload: (res) => resolve(res.status === 200 || res.status === 0),
                onerror: () => resolve(false)
            });
        });
    }

    async function findAllPhotosByScan(carId) {
        const found = [];
        for (let i = 1; i <= 32; i++) {
            const num = String(i).padStart(3, '0');
            const testUrl = `https://ci.encar.com/carpicture/carpicture${carId.slice(-2)}/pic${carId.slice(0,4)}/${carId}_${num}.jpg`;
            const exists = await checkPhotoExists(testUrl);
            if (exists) found.push(testUrl);
            await new Promise(r => setTimeout(r, 50));
        }
        return found;
    }

    function findPhotosInDOM() {
        const urls = new Set();
        document.querySelectorAll('img[src*="ci.encar.com"], img[data-src*="ci.encar.com"]').forEach(img => {
            let src = img.src || img.getAttribute('data-src');
            if (src && src.includes('ci.encar.com')) urls.add(src.split('?')[0]);
        });
        return Array.from(urls);
    }

    async function fetchPhotosFromAPI(carId) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://api.encar.com/v1/readside/vehicle/${carId}`,
                onload: (res) => {
                    if (res.status === 200 && res.response) {
                        try {
                            const data = JSON.parse(res.response);
                            const photos = data.photos?.map(p => p.path).filter(Boolean);
                            if (photos?.length) resolve(photos);
                            else resolve([]);
                        } catch(e) { resolve([]); }
                    } else resolve([]);
                },
                onerror: () => resolve([])
            });
        });
    }

    async function findAllPhotos() {
        console.log('[Photos] Поиск фотографий...');

        let photos = findPhotosInDOM();
        if (photos.length >= 5) {
            photosList = photos.slice(0, 32);
            Hub.set('photosList', photosList);
            return photosList;
        }

        const carId = Hub.get('carId');
        if (carId) {
            const apiPhotos = await fetchPhotosFromAPI(carId);
            if (apiPhotos.length >= 5) {
                photosList = apiPhotos.slice(0, 32);
                Hub.set('photosList', photosList);
                return photosList;
            }

            const scannedPhotos = await findAllPhotosByScan(carId);
            if (scannedPhotos.length >= 3) {
                photosList = scannedPhotos.slice(0, 32);
                Hub.set('photosList', photosList);
                return photosList;
            }
        }

        if (photos.length) {
            photosList = photos.slice(0, 32);
            Hub.set('photosList', photosList);
        }

        return photosList;
    }

    function formatVolume(cc) {
        if (!cc) return null;
        const liters = cc / 1000;
        return Number.isInteger(liters) ? `${liters}.0L (${cc.toLocaleString()}cc)` : `${liters.toFixed(1)}L (${cc.toLocaleString()}cc)`;
    }

    function formatMileage(mileage) {
        if (!mileage) return null;
        if (mileage >= 10000) return `${(mileage / 10000).toFixed(1)}만 km`;
        return `${mileage.toLocaleString()} km`;
    }

    function generatePhotosHTML(photoUrls) {
        let pagesHTML = '';
        const photosPerPage = 16;

        for (let page = 0; page < photoUrls.length; page += photosPerPage) {
            const pagePhotos = photoUrls.slice(page, page + photosPerPage);
            const pageNumber = Math.floor(page / photosPerPage) + 1;
            const totalPages = Math.ceil(photoUrls.length / photosPerPage);

            pagesHTML += `<div class="page photos-page">`;
            pagesHTML += `<div class="photos-header">📸 ФОТОГРАФИИ АВТОМОБИЛЯ (${pageNumber}/${totalPages})</div>`;
            pagesHTML += `<div class="photos-grid photos-grid-16">`;

            for (let i = 0; i < photosPerPage; i++) {
                if (i < pagePhotos.length) {
                    pagesHTML += `<div class="photo-cell"><img src="${pagePhotos[i]}" alt="Фото" loading="lazy" onerror="this.style.opacity='0.3'"></div>`;
                } else {
                    pagesHTML += `<div class="photo-cell empty"></div>`;
                }
            }

            pagesHTML += `</div><div class="page-number">${pageNumber} / ${totalPages}</div></div>`;
        }
        return pagesHTML;
    }

    async function printReport() {
        console.log('[Photos] Генерация отчёта...');

        if (!photosList.length) {
            await findAllPhotos();
        }

        const photoUrls = photosList.map(url => {
            if (!url.startsWith('http')) url = 'https://ci.encar.com' + url;
            if (!url.includes('impolicy')) url += '?impolicy=heightRate&rh=653&cw=1160&ch=653';
            return url;
        });

        const photosPagesHTML = generatePhotosHTML(photoUrls);

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

        const priceUsd = Hub.get('carPriceKrw') && Hub.get('usdToKrw')
            ? Math.round(Hub.get('carPriceKrw') / Hub.get('usdToKrw')) : 0;
        const koreaLogistics = Hub.get('koreaLogistics') || 4000;
        const servicesBishkek = Hub.get('servicesBishkek') || 1200;
        const docsRf = Hub.get('docsRf') || 80000;
        const ourServices = Hub.get('ourServices') || 250000;
        const utilizationFee = Hub.get('utilizationFee') || 0;
        const tpoValue = Hub.get('calculatedTpo') || 0;
        const totalPrice = Hub.get('totalPrice') || 0;
        const euroPrice = Hub.get('selectedEuroPrice') || '—';

        const usdRate = Hub.get('usdRate') || 0;
        const eurRate = Hub.get('eurRate') || 0;
        const usdToKrw = Hub.get('usdToKrw') || 0;
        const usdtRate = Hub.get('usdtRate') || 0;

        const reportHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Коммерческое предложение</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #e0e0e0; padding: 20px; }
        .toolbar { position: fixed; bottom: 20px; right: 20px; z-index: 1000; display: flex; gap: 10px; }
        .toolbar button { padding: 12px 24px; font-size: 14px; font-weight: bold; border: none; border-radius: 8px; cursor: pointer; }
        .btn-print { background: #2c5f2d; color: white; }
        .btn-pdf { background: #1a5276; color: white; }
        .page { background: white; width: 210mm; min-height: 297mm; margin: 0 auto 20px auto; padding: 15mm; page-break-after: always; }
        .header { text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #fbbf24; }
        .header h1 { color: #0f2a44; font-size: 24px; }
        .car-info { background: #f8fafc; border-radius: 12px; padding: 15px; margin-bottom: 20px; }
        .car-info h3 { color: #0f2a44; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
        .info-label { font-weight: 600; color: #475569; }
        .price-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .price-table th, .price-table td { padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
        .price-table th { background: #f1f5f9; }
        .total-row { background: #fef3c7; font-weight: bold; }
        .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
        .photos-page { background: white; width: 210mm; min-height: 297mm; margin: 0 auto 20px auto; padding: 10mm; page-break-after: always; }
        .photos-header { text-align: center; font-size: 18px; font-weight: bold; color: #0f2a44; margin-bottom: 15px; border-bottom: 2px solid #fbbf24; }
        .photos-grid-16 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .photo-cell { background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; min-height: 140px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .photo-cell img { width: 100%; height: 100%; object-fit: contain; }
        .photo-cell.empty { background: #fafafa; border: 1px dashed #ccc; }
        .page-number { text-align: center; margin-top: 8mm; font-size: 10px; color: #999; }
        @media print { .toolbar { display: none; } .page, .photos-page { box-shadow: none; margin: 0; padding: 0; } }
    </style>
</head>
<body>
    <div class="toolbar">
        <button class="btn-print" onclick="window.print()">🖨️ Печать</button>
        <button class="btn-pdf" onclick="window.print()">📄 Сохранить PDF</button>
    </div>
    <div class="page">
        <div class="header">
            <h1>КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ</h1>
            <p>Дата: ${new Date().toLocaleDateString('ru-RU')}</p>
        </div>
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
        <div class="footer">
            <p>Курс USD: ${usdRate.toFixed(2)} ₽ | EUR: ${eurRate.toFixed(2)} ₽ | USD/KRW: ${Math.round(usdToKrw)} | USDT: ${usdtRate.toFixed(2)} ₽</p>
            <p>* Данное предложение носит информационный характер и не является публичной офертой.</p>
        </div>
    </div>
    ${photosPagesHTML}
</body>
</html>`;

        const printWindow = window.open('', '_blank', 'width=1100,height=800,toolbar=yes,scrollbars=yes');
        printWindow.document.write(reportHtml);
        printWindow.document.close();
    }

    // Экспорт
    unsafeWindow.EncarPhotos = {
        print: printReport,
        find: findAllPhotos
    };

    // Запуск поиска фото
    setTimeout(() => findAllPhotos(), 3000);

    console.log('[Photos] Модуль загружен');
})();
