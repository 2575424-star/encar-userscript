// ==UserScript==
// @name         Encar Photos Module
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Поиск фото и генерация отчёта (расширенный поиск)
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
    
    // ========== РАСШИРЕННЫЙ ПОИСК ФОТО ==========
    
    // Проверка существования фото по URL
    function checkPhotoExists(url) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'HEAD',
                url: url,
                timeout: 3000,
                onload: (res) => resolve(res.status === 200 || res.status === 0),
                onerror: () => resolve(false),
                ontimeout: () => resolve(false)
            });
        });
    }
    
    // Способ 1: Сканирование по шаблону URL (самый надёжный)
    async function scanByPattern(carId) {
        const found = [];
        const patterns = [
            // Основной шаблон
            `https://ci.encar.com/carpicture/carpicture${carId.slice(-2)}/pic${carId.slice(0,4)}/${carId}_`,
            // Альтернативный шаблон
            `https://image.encar.com/carpicture/carpicture${carId.slice(-2)}/pic${carId.slice(0,4)}/${carId}_`,
            // Ещё один вариант
            `https://ci.encar.com/carpicture/${carId}/`
        ];
        
        console.log(`[Photos] Сканирование по шаблону для carId: ${carId}`);
        
        for (const baseUrl of patterns) {
            for (let i = 1; i <= 32; i++) {
                const num = String(i).padStart(3, '0');
                const testUrl = `${baseUrl}${num}.jpg`;
                const exists = await checkPhotoExists(testUrl);
                if (exists) {
                    found.push(testUrl);
                    console.log(`[Photos] Найдено фото ${i}: ${testUrl}`);
                }
                // Небольшая задержка, чтобы не перегружать сервер
                await new Promise(r => setTimeout(r, 30));
            }
            if (found.length >= 16) break;
        }
        
        return found;
    }
    
    // Способ 2: Поиск через API Encar
    async function fetchFromAPI(carId) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://api.encar.com/v1/readside/vehicle/${carId}`,
                headers: { 'Accept': 'application/json' },
                timeout: 5000,
                onload: (res) => {
                    if (res.status === 200 && res.response) {
                        try {
                            const data = JSON.parse(res.response);
                            if (data.photos && Array.isArray(data.photos)) {
                                const photos = data.photos
                                    .map(p => p.path)
                                    .filter(Boolean)
                                    .map(p => p.startsWith('http') ? p : `https://ci.encar.com${p}`);
                                console.log(`[Photos] Из API получено ${photos.length} фото`);
                                resolve(photos);
                                return;
                            }
                        } catch(e) {}
                    }
                    resolve([]);
                },
                onerror: () => resolve([]),
                ontimeout: () => resolve([])
            });
        });
    }
    
    // Способ 3: Поиск в DOM страницы
    function findInDOM() {
        const urls = new Set();
        
        // Ищем все img
        document.querySelectorAll('img[src*="ci.encar.com"], img[data-src*="ci.encar.com"], img[src*="image.encar.com"]').forEach(img => {
            let src = img.src || img.getAttribute('data-src');
            if (src && (src.includes('ci.encar.com') || src.includes('image.encar.com'))) {
                // Очищаем URL от параметров
                const cleanUrl = src.split('?')[0];
                urls.add(cleanUrl);
            }
        });
        
        // Ищем в скриптах
        const scripts = document.querySelectorAll('script');
        scripts.forEach(script => {
            const text = script.textContent;
            const matches = text.match(/https?:\/\/(?:ci|image)\.encar\.com[^\s"'<>]+\.jpg/gi);
            if (matches) {
                matches.forEach(url => urls.add(url.split('?')[0]));
            }
        });
        
        // Ищем в JSON-данных
        const jsonScripts = document.querySelectorAll('script[type="application/json"]');
        jsonScripts.forEach(script => {
            try {
                const data = JSON.parse(script.textContent);
                const jsonStr = JSON.stringify(data);
                const matches = jsonStr.match(/https?:\/\/(?:ci|image)\.encar\.com[^\s"'<>]+\.jpg/gi);
                if (matches) {
                    matches.forEach(url => urls.add(url.split('?')[0]));
                }
            } catch(e) {}
        });
        
        const result = Array.from(urls);
        console.log(`[Photos] В DOM найдено ${result.length} фото`);
        return result;
    }
    
    // Способ 4: Поиск в PRELOADED_STATE
    function findInPreloadedState() {
        try {
            if (window.__PRELOADED_STATE__?.cars?.base?.photos) {
                const photos = window.__PRELOADED_STATE__.cars.base.photos
                    .map(p => p.path)
                    .filter(Boolean)
                    .map(p => p.startsWith('http') ? p : `https://ci.encar.com${p}`);
                if (photos.length) {
                    console.log(`[Photos] В PRELOADED_STATE найдено ${photos.length} фото`);
                    return photos;
                }
            }
        } catch(e) {}
        return [];
    }
    
    // Главная функция поиска всех фото
    async function findAllPhotos() {
        console.log('[Photos] Начало расширенного поиска фотографий...');
        
        const allPhotos = new Set();
        
        // 1. Поиск в DOM (быстро)
        const domPhotos = findInDOM();
        domPhotos.forEach(url => allPhotos.add(url));
        
        // 2. Поиск в PRELOADED_STATE
        const statePhotos = findInPreloadedState();
        statePhotos.forEach(url => allPhotos.add(url));
        
        // 3. Поиск через API (если есть carId)
        const carId = Hub.get('carId');
        if (carId) {
            const apiPhotos = await fetchFromAPI(carId);
            apiPhotos.forEach(url => allPhotos.add(url));
            
            // 4. Сканирование по шаблону (самый полный, но медленный)
            if (allPhotos.size < 16) {
                console.log('[Photos] Запускаем сканирование по шаблону...');
                const scannedPhotos = await scanByPattern(carId);
                scannedPhotos.forEach(url => allPhotos.add(url));
            }
        }
        
        // Преобразуем Set в массив и сортируем
        let result = Array.from(allPhotos);
        result.sort((a, b) => {
            const numA = parseInt(a.match(/_(\d+)\.jpg/)?.[1] || '0');
            const numB = parseInt(b.match(/_(\d+)\.jpg/)?.[1] || '0');
            return numA - numB;
        });
        
        // Ограничиваем 32 фото
        photosList = result.slice(0, 32);
        
        console.log(`[Photos] ✅ Всего найдено фото: ${photosList.length}`);
        if (photosList.length) {
            console.log(`[Photos] Первые 5 фото:`, photosList.slice(0, 5));
        } else {
            console.warn('[Photos] Фото не найдены!');
        }
        
        Hub.set('photosList', photosList);
        return photosList;
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
                    pagesHTML += `<div class="photo-cell"><img src="${pagePhotos[i]}" alt="Фото ${page + i + 1}" loading="lazy" onerror="this.style.opacity='0.3'"></div>`;
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
            loadingDiv.textContent = '🔍 Загрузка фотографий...';
            loadingDiv.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#1e293b; color:white; padding:15px 25px; border-radius:12px; z-index:10030; font-size:14px;';
            document.body.appendChild(loadingDiv);
            
            await findAllPhotos();
            
            loadingDiv.remove();
        }
        
        // Подготавливаем URL фото для отчёта (добавляем параметры для качества)
        const photoUrls = photosList.map(url => {
            if (!url.startsWith('http')) url = 'https://ci.encar.com' + url;
            // Добавляем параметры для лучшего качества
            if (!url.includes('impolicy')) {
                url += '?impolicy=heightRate&rh=653&cw=1160&ch=653';
            }
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
    
    console.log('[Photos] Модуль загружен (версия 2.0)');
})();
