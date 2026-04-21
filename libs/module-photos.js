// ==UserScript==
// @name         Encar Photos Module
// @namespace    http://tampermonkey.net/
// @version      8.0
// @description  Выбор фото для КП
// @match        *://www.encar.com/cars/detail/*
// @match        *://fem.encar.com/cars/detail/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        unsafeWindow
// @connect      ci.encar.com
// @connect      image.encar.com
// @connect      api.encar.com
// ==/UserScript==

(function() {
    'use strict';
    
    console.log('[Photos] Модуль загружен v8.0');
    
    if (!unsafeWindow.EncarHub) {
        console.error('[Photos] CoreHub не найден!');
        return;
    }
    
    const Hub = unsafeWindow.EncarHub;
    let allPhotos = []; // Все найденные фото
    let selectedIndices = []; // Индексы выбранных фото
    let isScanning = false;
    let scanInterval = null;
    let carId = null;
    
    const MAX_PHOTOS = 16;
    
    // Поиск carId
    function findCarId() {
        const urlMatch = window.location.href.match(/carid=(\d+)/);
        if (urlMatch) return urlMatch[1];
        if (window.__PRELOADED_STATE__?.cars?.base?.vehicleId) {
            return window.__PRELOADED_STATE__.cars.base.vehicleId;
        }
        return null;
    }
    
    // Проверка существования фото
    function checkPhotoExists(url) {
        return new Promise((resolve) => {
            const cleanUrl = url.split('?')[0];
            GM_xmlhttpRequest({
                method: 'HEAD',
                url: cleanUrl,
                timeout: 5000,
                onload: (r) => resolve(r.status === 200 || r.status === 0),
                onerror: () => resolve(false),
                ontimeout: () => resolve(false)
            });
        });
    }
    
    // Поиск всех фото (сканирование 1-30)
    async function scanAllPhotos() {
        const carIdValue = findCarId();
        if (!carIdValue) return [];
        
        carId = carIdValue;
        const found = [];
        const baseUrl = `https://ci.encar.com/carpicture/carpicture${carId.slice(-2)}/pic${carId.slice(0,4)}/${carId}_`;
        
        console.log('[Photos] Сканирование фото...');
        
        for (let i = 1; i <= 30; i++) {
            const num = String(i).padStart(3, '0');
            const url = `${baseUrl}${num}.jpg`;
            const exists = await checkPhotoExists(url);
            if (exists) {
                found.push(url);
                console.log(`[Photos] Найдено фото ${found.length}: ${num}.jpg`);
            }
            await new Promise(r => setTimeout(r, 50));
        }
        
        console.log(`[Photos] Всего найдено: ${found.length} фото`);
        return found;
    }
    
    // Показать окно выбора фото
    async function showPhotoSelector() {
        // Показываем загрузку
        const loadingDiv = document.createElement('div');
        loadingDiv.textContent = '🔍 Поиск фотографий...';
        loadingDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #1e293b;
            color: white;
            padding: 20px 30px;
            border-radius: 12px;
            z-index: 100000;
            font-size: 16px;
            text-align: center;
        `;
        document.body.appendChild(loadingDiv);
        
        // Ищем фото
        allPhotos = await scanAllPhotos();
        
        loadingDiv.remove();
        
        if (allPhotos.length === 0) {
            alert('Фото не найдены!');
            return;
        }
        
        // Создаём окно выбора
        selectedIndices = [];
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #0f172a;
            color: white;
            border-radius: 16px;
            padding: 20px;
            width: 90%;
            max-width: 800px;
            max-height: 85vh;
            overflow-y: auto;
            z-index: 100000;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            border: 1px solid #334155;
        `;
        
        // Заголовок
        const title = document.createElement('div');
        title.style.cssText = `
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid #334155;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        title.innerHTML = `
            <span>📸 Выберите фото для КП (макс ${MAX_PHOTOS})</span>
            <button id="close-modal" style="background:#dc2626; border:none; color:white; width:30px; height:30px; border-radius:50%; cursor:pointer;">×</button>
        `;
        
        // Сетка фото
        const grid = document.createElement('div');
        grid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 20px;
        `;
        
        // Добавляем фото в сетку
        allPhotos.forEach((url, index) => {
            const card = document.createElement('div');
            card.style.cssText = `
                position: relative;
                aspect-ratio: 4/3;
                background: #1e293b;
                border-radius: 8px;
                overflow: hidden;
                cursor: pointer;
                border: 2px solid #334155;
                transition: all 0.2s;
            `;
            
            const img = document.createElement('img');
            img.src = url;
            img.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: cover;
            `;
            img.onerror = () => {
                img.style.display = 'none';
                card.style.background = '#334155';
                const err = document.createElement('div');
                err.textContent = '❌';
                err.style.cssText = 'display:flex; align-items:center; justify-content:center; height:100%;';
                card.appendChild(err);
            };
            
            const number = document.createElement('div');
            number.style.cssText = `
                position: absolute;
                top: 5px;
                left: 5px;
                background: rgba(0,0,0,0.7);
                color: white;
                font-size: 11px;
                padding: 2px 6px;
                border-radius: 4px;
            `;
            number.textContent = `${index + 1}`;
            
            card.appendChild(img);
            card.appendChild(number);
            
            card.onclick = () => {
                const idx = selectedIndices.indexOf(index);
                if (idx === -1) {
                    if (selectedIndices.length < MAX_PHOTOS) {
                        selectedIndices.push(index);
                        card.style.border = '2px solid #fbbf24';
                        card.style.boxShadow = '0 0 0 2px #fbbf24';
                    } else {
                        alert(`Максимум можно выбрать ${MAX_PHOTOS} фото`);
                    }
                } else {
                    selectedIndices.splice(idx, 1);
                    card.style.border = '2px solid #334155';
                    card.style.boxShadow = 'none';
                }
                updateButton();
            };
            
            grid.appendChild(card);
        });
        
        // Информация о выборе
        const info = document.createElement('div');
        info.id = 'selection-info';
        info.style.cssText = `
            text-align: center;
            padding: 10px;
            margin-bottom: 15px;
            background: #1e293b;
            border-radius: 8px;
        `;
        info.textContent = `✅ Выбрано: 0 из ${MAX_PHOTOS}`;
        
        // Кнопки
        const buttons = document.createElement('div');
        buttons.style.cssText = `
            display: flex;
            gap: 10px;
            justify-content: center;
        `;
        
        const selectAllBtn = document.createElement('button');
        selectAllBtn.textContent = 'Выбрать все';
        selectAllBtn.style.cssText = `
            padding: 10px 20px;
            background: #3b82f6;
            border: none;
            color: white;
            border-radius: 8px;
            cursor: pointer;
        `;
        selectAllBtn.onclick = () => {
            selectedIndices = [];
            for (let i = 0; i < Math.min(allPhotos.length, MAX_PHOTOS); i++) {
                selectedIndices.push(i);
            }
            updateSelection();
            updateButton();
        };
        
        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Снять все';
        clearBtn.style.cssText = `
            padding: 10px 20px;
            background: #ef4444;
            border: none;
            color: white;
            border-radius: 8px;
            cursor: pointer;
        `;
        clearBtn.onclick = () => {
            selectedIndices = [];
            updateSelection();
            updateButton();
        };
        
        const generateBtn = document.createElement('button');
        generateBtn.id = 'generate-btn';
        generateBtn.textContent = '📄 Сформировать КП';
        generateBtn.style.cssText = `
            padding: 10px 20px;
            background: #fbbf24;
            border: none;
            color: #0f172a;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
        `;
        generateBtn.onclick = () => {
            if (selectedIndices.length === 0) {
                alert('Выберите хотя бы одно фото');
                return;
            }
            modal.remove();
            generateReport();
        };
        
        buttons.appendChild(selectAllBtn);
        buttons.appendChild(clearBtn);
        buttons.appendChild(generateBtn);
        
        modal.appendChild(title);
        modal.appendChild(grid);
        modal.appendChild(info);
        modal.appendChild(buttons);
        document.body.appendChild(modal);
        
        function updateSelection() {
            const cards = grid.children;
            for (let i = 0; i < allPhotos.length; i++) {
                if (selectedIndices.includes(i)) {
                    cards[i].style.border = '2px solid #fbbf24';
                    cards[i].style.boxShadow = '0 0 0 2px #fbbf24';
                } else {
                    cards[i].style.border = '2px solid #334155';
                    cards[i].style.boxShadow = 'none';
                }
            }
            info.textContent = `✅ Выбрано: ${selectedIndices.length} из ${MAX_PHOTOS}`;
        }
        
        function updateButton() {
            const btn = document.getElementById('generate-btn');
            if (btn) {
                btn.textContent = `📄 Сформировать КП (${selectedIndices.length} фото)`;
                btn.style.opacity = selectedIndices.length === 0 ? '0.5' : '1';
            }
        }
        
        document.getElementById('close-modal')?.addEventListener('click', () => modal.remove());
    }
    
    // Генерация отчёта с выбранными фото
    function generateReport() {
        const selectedPhotos = selectedIndices.sort((a,b) => a-b).map(i => allPhotos[i]);
        
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
        
        // Генерация HTML фото
        let photosHTML = '';
        const photosPerPage = 16;
        
        for (let page = 0; page < selectedPhotos.length; page += photosPerPage) {
            const pagePhotos = selectedPhotos.slice(page, page + photosPerPage);
            const pageNumber = Math.floor(page / photosPerPage) + 1;
            const totalPages = Math.ceil(selectedPhotos.length / photosPerPage);
            
            photosHTML += `<div class="page photos-page">`;
            photosHTML += `<div class="photos-header">📸 ФОТОГРАФИИ АВТОМОБИЛЯ (${pageNumber}/${totalPages})</div>`;
            photosHTML += `<div class="photos-grid">`;
            
            for (let i = 0; i < photosPerPage; i++) {
                if (i < pagePhotos.length) {
                    photosHTML += `<div class="photo-cell"><img src="${pagePhotos[i]}" alt="Фото" loading="lazy" onerror="this.style.opacity='0.3'"></div>`;
                } else {
                    photosHTML += `<div class="photo-cell empty"></div>`;
                }
            }
            photosHTML += `</div><div class="page-number">${pageNumber}/${totalPages}</div></div>`;
        }
        
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
<div class="info-row"><span class="info-label">Объём двигателя:</span><span>${engineVolume ? `${engineVolume/1000}.0L` : '—'}</span></div>
<div class="info-row"><span class="info-label">Мощность:</span><span>${power ? `${power} л.с.` : '—'}</span></div>
<div class="info-row"><span class="info-label">Пробег:</span><span>${mileage ? `${mileage.toLocaleString()} km` : '—'}</span></div>
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
    
    // Заменяем функцию печати
    const originalPrint = unsafeWindow.EncarPhotos?.print;
    unsafeWindow.EncarPhotos = { 
        print: showPhotoSelector,
        find: () => scanAllPhotos(),
        getPhotos: () => allPhotos
    };
    
    console.log('[Photos] Готово. Нажмите "Коммерческое предложение" для выбора фото');
})();
