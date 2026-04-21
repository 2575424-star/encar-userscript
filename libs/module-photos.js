// ==UserScript==
// @name         Encar Photos Module
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Поиск фото и генерация отчёта (алгоритм из скрипта скачивания)
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
    
    if (!unsafeWindow.EncarHub) {
        console.error('[Photos] CoreHub не найден!');
        return;
    }
    
    const Hub = unsafeWindow.EncarHub;
    let photosList = [];
    
    // ========== ФУНКЦИИ ИЗ ВАШЕГО СКРИПТА ==========
    
    // Очистка URL от параметров
    function getCleanImageUrl(url) {
        if (!url) return url;
        // Удаляем все параметры запроса
        let cleanUrl = url.split('?')[0];
        // Удаляем возможные суффиксы
        cleanUrl = cleanUrl.replace(/_[a-z]+\.jpg$/i, '.jpg');
        cleanUrl = cleanUrl.replace(/-\d+x\d+\.jpg$/i, '.jpg');
        return cleanUrl;
    }
    
    // Поиск carId на странице
    function findCarId() {
        const urlMatch = window.location.href.match(/carid=(\d+)/);
        if (urlMatch) return urlMatch[1];
        
        if (window.__PRELOADED_STATE__) {
            const state = window.__PRELOADED_STATE__;
            if (state.cars && state.cars.base && state.cars.base.vehicleId) {
                return state.cars.base.vehicleId;
            }
            if (state.vehicleId) return state.vehicleId;
        }
        
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
            const content = script.textContent;
            const match = content.match(/vehicleId["']?\s*:\s*["']?(\d+)/);
            if (match) return match[1];
        }
        
        return null;
    }
    
    // Проверка существования фото (HEAD запрос)
    async function checkPhotoExists(url) {
        return new Promise((resolve) => {
            const cleanUrl = getCleanImageUrl(url);
            GM_xmlhttpRequest({
                method: 'HEAD',
                url: cleanUrl,
                timeout: 3000,
                onload: function(response) {
                    resolve(response.status === 200 || response.status === 0);
                },
                onerror: function() {
                    resolve(false);
                },
                ontimeout: function() {
                    resolve(false);
                }
            });
        });
    }
    
    // Поиск всех фото через сканирование URL (ОСНОВНОЙ МЕТОД)
    async function findAllPhotosByScan(carId) {
        console.log(`[Photos] Сканирование фото для carId: ${carId}`);
        
        const foundPhotos = [];
        
        // Формируем базовый URL
        const baseUrl = `https://ci.encar.com/carpicture/carpicture${carId.slice(-2)}/pic${carId.slice(0,4)}/${carId}_`;
        
        // Сканируем с 001 до 032 (достаточно для 20-30 фото)
        for (let i = 1; i <= 32; i++) {
            const num = String(i).padStart(3, '0');
            const testUrl = `${baseUrl}${num}.jpg`;
            
            const exists = await checkPhotoExists(testUrl);
            if (exists) {
                foundPhotos.push(testUrl);
                console.log(`[Photos] ✅ Найдено фото ${foundPhotos.length}: ${num}.jpg`);
            }
            
            // Небольшая задержка, чтобы не перегружать сервер
            await new Promise(r => setTimeout(r, 50));
        }
        
        console.log(`[Photos] Всего найдено фото через сканирование: ${foundPhotos.length}`);
        return foundPhotos;
    }
    
    // Поиск фото через API Encar (резервный метод)
    async function fetchPhotosFromAPI(carId) {
        return new Promise((resolve) => {
            const apiUrl = `https://api.encar.com/v1/readside/vehicle/${carId}`;
            
            GM_xmlhttpRequest({
                method: 'GET',
                url: apiUrl,
                timeout: 5000,
                onload: function(response) {
                    if (response.status === 200 && response.response) {
                        try {
                            const data = JSON.parse(response.response);
                            if (data.photos && Array.isArray(data.photos) && data.photos.length > 0) {
                                const photos = data.photos.map(p => p.path).filter(Boolean);
                                console.log(`[Photos] Через API найдено ${photos.length} фото`);
                                resolve(photos);
                                return;
                            }
                        } catch(e) {}
                    }
                    resolve([]);
                },
                onerror: function() {
                    resolve([]);
                }
            });
        });
    }
    
    // Поиск фото в DOM (резервный метод)
    function findPhotosInDOM() {
        const urls = new Set();
        
        const images = document.querySelectorAll('img[src*="ci.encar.com"], img[data-src*="ci.encar.com"]');
        images.forEach(img => {
            let src = img.src || img.getAttribute('data-src');
            if (src && src.includes('ci.encar.com')) {
                const cleanUrl = getCleanImageUrl(src);
                urls.add(cleanUrl);
            }
        });
        
        const scripts = document.querySelectorAll('script');
        const urlPattern = /(https?:\/\/ci\.encar\.com[^\s"'<>]+\.jpg)/gi;
        scripts.forEach(script => {
            const content = script.textContent;
            const matches = content.match(urlPattern);
            if (matches) {
                matches.forEach(url => {
                    const cleanUrl = getCleanImageUrl(url);
                    urls.add(cleanUrl);
                });
            }
        });
        
        const result = Array.from(urls);
        console.log(`[Photos] В DOM найдено ${result.length} фото`);
        return result;
    }
    
    // ГЛАВНАЯ ФУНКЦИЯ ПОИСКА ФОТО (как в вашем скрипте)
    async function findAllPhotos() {
        console.log('[Photos] Начало поиска фотографий...');
        
        // 1. Сначала пробуем найти в DOM (быстро)
        let photos = findPhotosInDOM();
        if (photos.length >= 5) {
            console.log(`[Photos] Найдено фото в DOM: ${photos.length}`);
            photosList = photos.slice(0, 16); // Берём первые 16
            Hub.set('photosList', photosList);
            return photosList;
        }
        
        // 2. Пробуем через API
        const carId = findCarId();
        if (carId) {
            const apiPhotos = await fetchPhotosFromAPI(carId);
            if (apiPhotos.length >= 5) {
                console.log(`[Photos] Найдено фото через API: ${apiPhotos.length}`);
                photosList = apiPhotos.slice(0, 16);
                Hub.set('photosList', photosList);
                return photosList;
            }
            
            // 3. Основной метод - сканирование по шаблону (находит все фото)
            console.log('[Photos] Запуск сканирования по шаблону URL...');
            const scannedPhotos = await findAllPhotosByScan(carId);
            if (scannedPhotos.length >= 3) {
                console.log(`[Photos] Найдено фото через сканирование: ${scannedPhotos.length}`);
                photosList = scannedPhotos.slice(0, 16); // Берём первые 16 для отчёта
                Hub.set('photosList', photosList);
                return photosList;
            }
        }
        
        // 4. Если ничего не нашли, используем то, что есть в DOM
        if (photos.length > 0) {
            console.log(`[Photos] Используем найденные фото из DOM: ${photos.length}`);
            photosList = photos.slice(0, 16);
            Hub.set('photosList', photosList);
            return photosList;
        }
        
        console.warn('[Photos] Фото не найдены!');
        photosList = [];
        Hub.set('photosList', []);
        return [];
    }
    
    // ========== ФОРМАТИРОВАНИЕ ДЛЯ ОТЧЁТА ==========
    
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
        if (!photoUrls.length) {
            return '<div class="page"><div class="photos-header">📸 Фотографии отсутствуют</div></div>';
        }
        
        // Ограничиваем 16 фото для отчёта
        const limitedPhotos = photoUrls.slice(0, 16);
        
        let pagesHTML = '';
        const photosPerPage = 16;
        
        for (let page = 0; page < limitedPhotos.length; page += photosPerPage) {
            const pagePhotos = limitedPhotos.slice(page, page + photosPerPage);
            const pageNumber = Math.floor(page / photosPerPage) + 1;
            const totalPages = Math.ceil(limitedPhotos.length / photosPerPage);
            
            pagesHTML += `<div class="page photos-page">`;
            pagesHTML += `<div class="photos-header">📸 ФОТОГРАФИИ АВТОМОБИЛЯ (${pageNumber}/${totalPages})</div>`;
            pagesHTML += `<div class="photos-grid photos-grid-16">`;
            
            for (let i = 0; i < photosPerPage; i++) {
                if (i < pagePhotos.length) {
                    // Очищаем URL от параметров для чистого фото
                    const cleanUrl = pagePhotos[i].split('?')[0];
                    pagesHTML += `<div class="photo-cell"><img src="${cleanUrl}" alt="Фото ${page + i + 1}" loading="lazy" onerror="this.style.opacity='0.3'"></div>`;
                } else {
                    pagesHTML += `<div class="photo-cell empty"></div>`;
                }
            }
            
            pagesHTML += `</div>`;
            pagesHTML += `<div class="page-number">${pageNumber} / ${totalPages}</div>`;
            pagesHTML += `</div>`;
        }
        return pagesHTML;
    }
    
    // ========== ГЕНЕРАЦИЯ ОТЧЁТА ==========
    
    async function printReport() {
        console.log('[Photos] Генерация коммерческого предложения...');
        
        // Если фото ещё не загружены, загружаем
        if (!photosList.length) {
            const loadingDiv = document.createElement('div');
            loadingDiv.textContent = '🔍 Поиск фотографий...';
            loadingDiv.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#1e293b; color:white; padding:15px 25px; border-radius:12px; z-index:10030; font-size:14px;';
            document.body.appendChild(loadingDiv);
            
            await findAllPhotos();
            
            loadingDiv.remove();
        }
        
        // Подготавливаем URL фото для отчёта
        const photoUrls = photosList.map(url => {
            if (!url.startsWith('http')) url = 'https://ci.encar.com' + url;
            return url;
        });
        
        const photosPagesHTML = generatePhotosHTML(photoUrls);
        
        // Собираем данные из Hub
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
        
        const reportHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Коммерческое предложение</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            background: #e0e0e0; 
            padding: 20px; 
        }
        .toolbar { 
            position: fixed; 
            bottom: 20px; 
            right: 20px; 
            z-index: 1000; 
            display: flex; 
            gap: 10px; 
        }
        .toolbar button { 
            padding: 12px 24px; 
            font-size: 14px; 
            font-weight: bold; 
            border: none; 
            border-radius: 8px; 
            cursor: pointer; 
            transition: all 0.2s;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        .btn-print { background: #2c5f2d; color: white; }
        .btn-print:hover { background: #1e421f; transform: scale(1.02); }
        .btn-pdf { background: #1a5276; color: white; }
        .btn-pdf:hover { background: #0e3a54; transform: scale(1.02); }
        
        .page { 
            background: white; 
            width: 210mm; 
            min-height: 297mm; 
            margin: 0 auto 20px auto; 
            padding: 15mm; 
            position: relative; 
            box-shadow: 0 0 10px rgba(0,0,0,0.1); 
            page-break-after: always; 
            break-inside: avoid; 
        }
        .header { 
            text-align: center; 
            margin-bottom: 20px; 
            padding-bottom: 15px; 
            border-bottom: 2px solid #fbbf24; 
        }
        .header h1 { color: #0f2a44; margin-bottom: 8px; font-size: 24px; }
        .header p { color: #64748b; }
        
        .car-info { 
            background: #f8fafc; 
            border-radius: 12px; 
            padding: 15px; 
            margin-bottom: 20px; 
        }
        .car-info h3 { 
            margin-top: 0; 
            color: #0f2a44; 
            border-bottom: 1px solid #e2e8f0; 
            padding-bottom: 8px; 
            margin-bottom: 12px; 
        }
        .info-row { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 8px; 
            font-size: 13px; 
        }
        .info-label { font-weight: 600; color: #475569; }
        .info-value { color: #1e293b; }
        
        .price-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 20px; 
        }
        .price-table th, .price-table td { 
            padding: 10px; 
            text-align: left; 
            border-bottom: 1px solid #e2e8f0; 
        }
        .price-table th { background: #f1f5f9; font-weight: 600; color: #0f2a44; }
        .total-row { background: #fef3c7; font-weight: bold; }
        .total-row td { border-top: 2px solid #fbbf24; border-bottom: none; }
        
        .footer { 
            margin-top: 20px; 
            text-align: center; 
            font-size: 10px; 
            color: #94a3b8; 
            border-top: 1px solid #e2e8f0; 
            padding-top: 15px; 
        }
        
        .photos-page { 
            background: white; 
            width: 210mm; 
            min-height: 297mm; 
            margin: 0 auto 20px auto; 
            padding: 10mm; 
            page-break-after: always; 
        }
        .photos-header { 
            text-align: center; 
            font-size: 18px; 
            font-weight: bold; 
            color: #0f2a44; 
            margin-bottom: 15px; 
            padding-bottom: 8px; 
            border-bottom: 2px solid #fbbf24; 
        }
        .photos-grid { 
            display: grid; 
            gap: 12px; 
            min-height: 250mm; 
        }
        .photos-grid-16 { 
            grid-template-columns: repeat(2, 1fr); 
            grid-template-rows: repeat(4, 1fr); 
        }
        .photo-cell { 
            background: #f5f5f5; 
            border: 1px solid #ddd; 
            border-radius: 4px; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            overflow: hidden; 
            min-height: 140px; 
        }
        .photo-cell img { 
            width: 100%; 
            height: 100%; 
            object-fit: contain; 
        }
        .photo-cell.empty { 
            background: #fafafa; 
            border: 1px dashed #ccc; 
        }
        .page-number { 
            text-align: center; 
            margin-top: 8mm; 
            font-size: 10px; 
            color: #999; 
        }
        
        @media print {
            body { background: white; padding: 0; margin: 0; }
            .toolbar { display: none; }
            .page { box-shadow: none; margin: 0; padding: 0; page-break-after: always; }
            .photos-page { box-shadow: none; margin: 0; padding: 0; }
            .photos-grid { gap: 8px; }
            .photo-cell { border: 0.5px solid #eee; }
            .page-number { display: none; }
        }
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
            <div class="info-row"><span class="info-label">Марка/Модель:</span><span class="info-value">${brand} ${model}</span></div>
            <div class="info-row"><span class="info-label">Год выпуска:</span><span class="info-value">${yearDisplay}</span></div>
            <div class="info-row"><span class="info-label">Объём двигателя:</span><span class="info-value">${formatVolume(engineVolume) || '—'}</span></div>
            <div class="info-row"><span class="info-label">Мощность:</span><span class="info-value">${power ? `${power} л.с.` : '—'}</span></div>
            <div class="info-row"><span class="info-label">Пробег:</span><span class="info-value">${formatMileage(mileage) || '—'}</span></div>
            <div class="info-row"><span class="info-label">VIN номер:</span><span class="info-value" style="font-family:monospace;">${vin}</span></div>
            <div class="info-row"><span class="info-label">Просмотры:</span><span class="info-value">${views?.toLocaleString() || '—'}</span></div>
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
            <p>Курс USD: ${usdRate.toFixed(2)} ₽ | EUR: ${eurRate.toFixed(2)} ₽ | USDT: ${usdtRate.toFixed(2)} ₽</p>
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
    
    // ========== ЭКСПОРТ ==========
    unsafeWindow.EncarPhotos = {
        print: printReport,
        find: findAllPhotos,
        getPhotos: () => photosList
    };
    
    // Автоматический поиск фото при загрузке
    setTimeout(() => {
        findAllPhotos().then(photos => {
            console.log(`[Photos] Автозагрузка завершена. Найдено ${photos.length} фото`);
        });
    }, 2000);
    
    console.log('[Photos] Модуль загружен (версия 3.0)');
})();
