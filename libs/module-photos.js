// ==UserScript==
// @name         Encar Photos Module (Clean)
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Только кнопка коммерческого предложения (без поиска фото)
// @match        *://www.encar.com/cars/detail/*
// @match        *://fem.encar.com/cars/detail/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    
    console.log('[Photos] Чистая версия загружена (без поиска фото)');
    
    if (!unsafeWindow.EncarHub) {
        console.error('[Photos] CoreHub не найден!');
        return;
    }
    
    const Hub = unsafeWindow.EncarHub;
    
    // Простая функция печати
    function printReport() {
        console.log('[Photos] Генерация КП...');
        
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
        const mileageDisplay = mileage ? `${mileage.toLocaleString()} km` : '—';
        const volumeDisplay = engineVolume ? `${engineVolume/1000}.0L` : '—';
        
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
        @media print{.toolbar{display:none}.page{box-shadow:none;margin:0;padding:0}}
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
<div class="info-row"><span class="info-label">Объём двигателя:</span><span>${volumeDisplay}</span></div>
<div class="info-row"><span class="info-label">Мощность:</span><span>${power ? `${power} л.с.` : '—'}</span></div>
<div class="info-row"><span class="info-label">Пробег:</span><span>${mileageDisplay}</span></div>
<div class="info-row"><span class="info-label">VIN номер:</span><span style="font-family:monospace;">${vin}</span></div>
<div class="info-row"><span class="info-label">Просмотры:</span><span>${views?.toLocaleString() || '—'}</span></div>
</div>
<table class="price-table">
<thead><tr><th>Статья расходов</th><th>Сумма</th><tr></thead>
<tbody>
<tr><td>🚗 Стоимость авто (USD)</td><td>${priceUsd.toLocaleString()} $</td></tr>
<tr><td>💰 Стоимость (EUR)</td><td>${typeof euroPrice === 'number' ? euroPrice.toLocaleString() : euroPrice} €</td></tr>
<tr><td>📦 Расходы Корея/Логистика</td><td>${koreaLogistics.toLocaleString()} $</td></tr>
<tr><td>🏛️ Расходы Киргизия/Логистика</td><td>${kirgizLogistics.toLocaleString()} $</td></tr>
<tr><td>🏛️ ТПО</td><td>${tpoValue.toLocaleString()} $</td></tr>
<tr><td>♻️ Утилизационный сбор</td><td>${utilizationFee.toLocaleString()} ₽</td></tr>
<tr><td>📄 Документы РФ</td><td>${docsRf.toLocaleString()} ₽</td></tr>
<tr><td>🤝 Наши услуги</td><td>${ourServices.toLocaleString()} ₽</td></tr>
<tr class="total-row"><td><strong>💰 ИТОГОВАЯ СТОИМОСТЬ</strong></td><td><strong>${totalPrice.toLocaleString()} ₽</strong></td></tr>
</tbody>
</table>
<div class="footer"><p>Курс USD: ${usdRate.toFixed(2)} ₽ | EUR: ${eurRate.toFixed(2)} ₽ | USDT: ${usdtRate.toFixed(2)} ₽</p><p>* Данное предложение носит информационный характер и не является публичной офертой.</p></div>
</div>
</body>
</html>`;
        
        const printWindow = window.open('', '_blank', 'width=1100,height=800');
        printWindow.document.write(reportHtml);
        printWindow.document.close();
    }
    
    // Экспорт только функции печати
    unsafeWindow.EncarPhotos = { 
        print: printReport
    };
    
    console.log('[Photos] Чистая версия готова, кнопка КП работает');
})();
