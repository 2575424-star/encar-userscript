// ==UserScript==
// @name         Encar Price Module (GitHub CSV with UI)
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Загрузка стоимости из CSV файла в репозитории GitHub + ручной выбор
// @match        *://www.encar.com/cars/detail/*
// @match        *://fem.encar.com/cars/detail/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';
    
    if (!unsafeWindow.EncarHub) {
        console.error('[Price] CoreHub не найден!');
        return;
    }
    
    const Hub = unsafeWindow.EncarHub;
    
    // ========== ССЫЛКА НА CSV В РЕПОЗИТОРИИ ==========
    const CSV_URL = 'https://raw.githubusercontent.com/2575424-star/encar-userscript/refs/heads/main/car-prices.csv';
    
    let allPriceData = [];
    let priceDataLoaded = false;
    
    // Переменные для ручного выбора
    let selectedPriceBrand = null;
    let selectedPriceModel = null;
    let selectedPriceEngine = null;
    let selectedPriceYear = null;
    let selectedPriceManual = null;
    
    // ========== ПАРСИНГ CSV ==========
    function parseCSV(csvText) {
        const lines = csvText.split(/\r?\n/);
        if (lines.length < 2) return [];
        
        let headerIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('Марка') && line.includes('Модель') && line.includes('Стоимость')) {
                headerIndex = i;
                break;
            }
        }
        
        if (headerIndex === -1) {
            headerIndex = 0;
        }
        
        const headers = lines[headerIndex].split(',').map(h => h.trim().replace(/"/g, ''));
        const colBrand = headers.findIndex(h => h.includes('Марка'));
        const colModel = headers.findIndex(h => h.includes('Модель'));
        const colEngine = headers.findIndex(h => h.includes('Объем') || h.includes('Объём'));
        const colYear = headers.findIndex(h => h.includes('Год'));
        const colPrice = headers.findIndex(h => h.includes('Стоимость') || h.includes('Цена'));
        
        if (colBrand === -1 || colModel === -1 || colPrice === -1) {
            console.error('[Price] Не найдены нужные колонки в CSV');
            return [];
        }
        
        const data = [];
        for (let i = headerIndex + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            let values;
            if (line.includes('"')) {
                values = [];
                let current = '';
                let inQuotes = false;
                for (let char of line) {
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        values.push(current.trim());
                        current = '';
                    } else {
                        current += char;
                    }
                }
                values.push(current.trim());
            } else {
                values = line.split(',').map(v => v.trim());
            }
            
            if (values.length <= Math.max(colBrand, colModel, colPrice)) continue;
            
            const price = parseFloat(values[colPrice].replace(/[^\d.-]/g, '').replace(',', '.'));
            if (isNaN(price)) continue;
            
            const year = colYear !== -1 ? parseInt(values[colYear], 10) : null;
            const engine = colEngine !== -1 ? values[colEngine] : null;
            
            data.push({
                Марка: values[colBrand],
                Модель: values[colModel],
                Объем: engine,
                Год: year,
                Цена: price
            });
        }
        
        console.log(`[Price] Загружено ${data.length} записей из репозитория`);
        return data;
    }
    
    // ========== ПОИСК ЦЕНЫ ==========
    function findPriceFromData(brand, model, engine, year) {
        if (!allPriceData.length) return null;
        
        const strYear = parseInt(year);
        const engineStr = String(engine || '').replace(/\s/g, '');
        
        let found = allPriceData.find(item =>
            item.Марка?.toLowerCase() === brand?.toLowerCase() &&
            item.Модель?.toLowerCase() === model?.toLowerCase() &&
            (!engineStr || String(item.Объем || '').replace(/\s/g, '') === engineStr) &&
            (!strYear || item.Год === strYear)
        );
        
        if (!found && strYear) {
            found = allPriceData.find(item =>
                item.Марка?.toLowerCase() === brand?.toLowerCase() &&
                item.Модель?.toLowerCase() === model?.toLowerCase() &&
                (!engineStr || String(item.Объем || '').replace(/\s/g, '') === engineStr)
            );
        }
        
        if (!found && engineStr) {
            found = allPriceData.find(item =>
                item.Марка?.toLowerCase() === brand?.toLowerCase() &&
                item.Модель?.toLowerCase() === model?.toLowerCase() &&
                (!strYear || item.Год === strYear)
            );
        }
        
        return found ? found.Цена : null;
    }
    
    // ========== ПОЛУЧЕНИЕ ТЕКУЩЕЙ ЦЕНЫ ==========
    function getCurrentEuroPrice() {
        if (selectedPriceManual !== null) return selectedPriceManual;
        if (selectedPriceBrand && selectedPriceModel && selectedPriceEngine && selectedPriceYear && allPriceData.length) {
            return findPriceFromData(selectedPriceBrand, selectedPriceModel, selectedPriceEngine, selectedPriceYear);
        }
        // Авто-подстановка из данных автомобиля
        const brand = Hub.get('carBrand');
        const model = Hub.get('carModel');
        const engine = Hub.get('carEngineVolume');
        const year = Hub.get('carYear');
        if (brand && model && engine && year && allPriceData.length) {
            return findPriceFromData(brand, model, engine, year);
        }
        return null;
    }
    
    // ========== ЗАГРУЗКА CSV ==========
    function loadPriceData() {
        console.log('[Price] Загрузка CSV из репозитория:', CSV_URL);
        
        GM_xmlhttpRequest({
            method: 'GET',
            url: CSV_URL,
            timeout: 10000,
            onload: function(res) {
                if (res.status === 200 && res.responseText && res.responseText.length > 100) {
                    const data = parseCSV(res.responseText);
                    if (data.length > 0) {
                        allPriceData = data;
                        priceDataLoaded = true;
                        Hub.set('priceDataLoaded', true);
                        Hub.set('allPriceData', allPriceData);
                        Hub.emit('priceData:loaded', allPriceData);
                        console.log(`[Price] ✅ CSV загружен, ${allPriceData.length} записей`);
                        autoSelectPrice();
                        // Обновляем UI, если он уже загружен
                        if (typeof updatePriceContentDisplay === 'function') {
                            updatePriceContentDisplay();
                        }
                    } else {
                        console.error('[Price] Не удалось распарсить CSV');
                    }
                } else {
                    console.error('[Price] Ошибка загрузки CSV, статус:', res.status);
                }
            },
            onerror: function(err) {
                console.error('[Price] Ошибка сети при загрузке CSV:', err);
            },
            ontimeout: function() {
                console.error('[Price] Таймаут загрузки CSV');
            }
        });
    }
    
    // ========== АВТО-ВЫБОР ЦЕНЫ ==========
    function autoSelectPrice() {
        const brand = Hub.get('carBrand');
        const model = Hub.get('carModel');
        const engine = Hub.get('carEngineVolume');
        const year = Hub.get('carYear');
        
        if (brand && model && engine && year && allPriceData.length) {
            const price = findPriceFromData(brand, model, engine, year);
            if (price !== null) {
                selectedPriceManual = null;
                selectedPriceBrand = brand;
                selectedPriceModel = model;
                selectedPriceEngine = engine;
                selectedPriceYear = year;
                Hub.set('selectedEuroPrice', price);
                console.log(`[Price] ✅ Авто-выбор: ${price.toLocaleString()} € для ${brand} ${model}`);
            } else {
                console.log(`[Price] ⚠️ Цена не найдена для ${brand} ${model} ${engine}cc ${year}`);
            }
        }
    }
    
    // ========== РУЧНАЯ УСТАНОВКА ЦЕНЫ ==========
    function setManualPrice(price) {
        if (price && !isNaN(price) && price > 0) {
            selectedPriceManual = price;
            selectedPriceBrand = null;
            selectedPriceModel = null;
            selectedPriceEngine = null;
            selectedPriceYear = null;
            Hub.set('selectedEuroPrice', price);
            Hub.set('selectedPriceManual', price);
            console.log(`[Price] Ручная установка цены: ${price} €`);
        }
    }
    
    // ========== ОТОБРАЖЕНИЕ ВЫПАДАЮЩИХ МЕНЮ (ДЛЯ UI) ==========
    let priceContentDiv = null;
    
    function updatePriceContentDisplay() {
        const priceContentDiv_local = document.getElementById('price-content-inner');
        if (!priceContentDiv_local) return;
        
        if (!allPriceData.length) {
            priceContentDiv_local.innerHTML = '<div style="text-align:center; padding:8px;">Загрузка данных...</div>';
            return;
        }
        
        const brands = [...new Set(allPriceData.map(i => i.Марка))].sort();
        const selectedBrand = selectedPriceBrand || '';
        const selectedModel = selectedPriceModel || '';
        const selectedEngine = selectedPriceEngine || '';
        const selectedYear = selectedPriceYear || '';
        
        let modelsHtml = '<option value="">— выберите модель —</option>';
        let enginesHtml = '<option value="">— выберите объём —</option>';
        let yearsHtml = '<option value="">— выберите год —</option>';
        
        if (selectedBrand) {
            const models = [...new Set(allPriceData.filter(i => i.Марка === selectedBrand).map(i => i.Модель))].sort();
            modelsHtml = '<option value="">— выберите модель —</option>' + models.map(m => `<option value="${m}" ${m === selectedModel ? 'selected' : ''}>${m}</option>`).join('');
            if (selectedModel) {
                const engines = [...new Set(allPriceData.filter(i => i.Марка === selectedBrand && i.Модель === selectedModel).map(i => i.Объем))].sort((a,b) => parseInt(a)-parseInt(b));
                enginesHtml = '<option value="">— выберите объём —</option>' + engines.map(e => `<option value="${e}" ${String(e) === String(selectedEngine) ? 'selected' : ''}>${e}</option>`).join('');
                if (selectedEngine) {
                    const years = [...new Set(allPriceData.filter(i => i.Марка === selectedBrand && i.Модель === selectedModel && i.Объем === selectedEngine).map(i => i.Год))].sort((a,b) => b-a);
                    yearsHtml = '<option value="">— выберите год —</option>' + years.map(y => `<option value="${y}" ${y === selectedYear ? 'selected' : ''}>${y}</option>`).join('');
                }
            }
        }
        
        priceContentDiv_local.innerHTML = `
            <div style="margin-bottom:8px;"><label style="font-size:11px; color:#94a3b8;">Марка:</label><select id="price-brand-select" style="width:100%; padding:6px; background:#0f172a; color:white; border:1px solid #475569; border-radius:8px;"><option value="">— выберите марку —</option>${brands.map(b => `<option value="${b}" ${b === selectedBrand ? 'selected' : ''}>${b}</option>`).join('')}</select></div>
            <div style="margin-bottom:8px;"><label style="font-size:11px; color:#94a3b8;">Модель:</label><select id="price-model-select" style="width:100%; padding:6px; background:#0f172a; color:white; border:1px solid #475569; border-radius:8px;" ${!selectedBrand ? 'disabled' : ''}>${modelsHtml}</select></div>
            <div style="margin-bottom:8px;"><label style="font-size:11px; color:#94a3b8;">Объём (см³):</label><select id="price-engine-select" style="width:100%; padding:6px; background:#0f172a; color:white; border:1px solid #475569; border-radius:8px;" ${!selectedModel ? 'disabled' : ''}>${enginesHtml}</select></div>
            <div style="margin-bottom:8px;"><label style="font-size:11px; color:#94a3b8;">Год:</label><select id="price-year-select" style="width:100%; padding:6px; background:#0f172a; color:white; border:1px solid #475569; border-radius:8px;" ${!selectedEngine ? 'disabled' : ''}>${yearsHtml}</select></div>
            <div style="display:flex; gap:8px; margin-top:12px;"><button id="price-apply-auto" style="background:#fbbf24; border:none; padding:6px 12px; border-radius:8px; cursor:pointer; font-weight:bold;">Применить</button><button id="price-cancel-auto" style="background:#475569; border:none; padding:6px 12px; border-radius:8px; cursor:pointer; color:white;">Отмена</button></div>
        `;
        
        const brandSelect = document.getElementById('price-brand-select');
        const modelSelect = document.getElementById('price-model-select');
        const engineSelect = document.getElementById('price-engine-select');
        const yearSelect = document.getElementById('price-year-select');
        const applyBtn = document.getElementById('price-apply-auto');
        const cancelBtn = document.getElementById('price-cancel-auto');
        
        if (brandSelect) {
            brandSelect.onchange = () => {
                const brand = brandSelect.value;
                if (!brand) {
                    modelSelect.innerHTML = '<option value="">— выберите модель —</option>';
                    modelSelect.disabled = true;
                    engineSelect.disabled = true;
                    yearSelect.disabled = true;
                    return;
                }
                const models = [...new Set(allPriceData.filter(i => i.Марка === brand).map(i => i.Модель))].sort();
                modelSelect.innerHTML = '<option value="">— выберите модель —</option>' + models.map(m => `<option value="${m}">${m}</option>`).join('');
                modelSelect.disabled = false;
                engineSelect.innerHTML = '<option value="">— выберите объём —</option>';
                engineSelect.disabled = true;
                yearSelect.innerHTML = '<option value="">— выберите год —</option>';
                yearSelect.disabled = true;
            };
        }
        if (modelSelect) {
            modelSelect.onchange = () => {
                const brand = brandSelect.value, model = modelSelect.value;
                if (!brand || !model) { engineSelect.disabled = true; yearSelect.disabled = true; return; }
                const engines = [...new Set(allPriceData.filter(i => i.Марка === brand && i.Модель === model).map(i => i.Объем))].sort((a,b) => parseInt(a)-parseInt(b));
                engineSelect.innerHTML = '<option value="">— выберите объём —</option>' + engines.map(e => `<option value="${e}">${e}</option>`).join('');
                engineSelect.disabled = false;
                yearSelect.innerHTML = '<option value="">— выберите год —</option>';
                yearSelect.disabled = true;
            };
        }
        if (engineSelect) {
            engineSelect.onchange = () => {
                const brand = brandSelect.value, model = modelSelect.value, engine = engineSelect.value;
                if (!brand || !model || !engine) { yearSelect.disabled = true; return; }
                const years = [...new Set(allPriceData.filter(i => i.Марка === brand && i.Модель === model && i.Объем === engine).map(i => i.Год))].sort((a,b) => b-a);
                yearSelect.innerHTML = '<option value="">— выберите год —</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
                yearSelect.disabled = false;
            };
        }
        if (applyBtn) {
            applyBtn.onclick = () => {
                const brand = brandSelect.value, model = modelSelect.value, engine = engineSelect.value, year = parseInt(yearSelect.value);
                if (!brand || !model || !engine || !year) { alert('Выберите марку, модель, объём и год'); return; }
                selectedPriceManual = null;
                selectedPriceBrand = brand;
                selectedPriceModel = model;
                selectedPriceEngine = engine;
                selectedPriceYear = year;
                const price = findPriceFromData(brand, model, engine, year);
                if (price) {
                    Hub.set('selectedEuroPrice', price);
                    console.log(`[Price] Ручной выбор: ${price.toLocaleString()} €`);
                }
                // Закрываем меню
                const priceContent = document.getElementById('price-content');
                const priceArrow = document.getElementById('price-arrow');
                if (priceContent) priceContent.style.display = 'none';
                if (priceArrow) priceArrow.innerHTML = '▼';
                updateFullPanel();
            };
        }
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                const priceContent = document.getElementById('price-content');
                const priceArrow = document.getElementById('price-arrow');
                if (priceContent) priceContent.style.display = 'none';
                if (priceArrow) priceArrow.innerHTML = '▼';
            };
        }
    }
    
    // Обновление панели с ценой
    function updateFullPanel() {
        const euroPrice = getCurrentEuroPrice();
        const priceSpan = document.getElementById('encar-price-value');
        if (priceSpan) {
            priceSpan.textContent = euroPrice !== null ? `${euroPrice.toLocaleString()} €` : '—';
        }
        // Обновляем итоговую стоимость через калькулятор
        if (unsafeWindow.EncarHub) {
            unsafeWindow.EncarHub.emit('calculations:update', {});
        }
    }
    
    // Функция для открытия ручного редактора цены
    function openManualPriceEditor() {
        const currentPrice = getCurrentEuroPrice();
        const newPrice = prompt('Введите стоимость в евро (только число):', currentPrice !== null ? currentPrice : '');
        if (newPrice !== null && newPrice !== '') {
            const priceNum = parseFloat(newPrice.replace(/[^\d.-]/g, ''));
            if (!isNaN(priceNum) && priceNum > 0) {
                setManualPrice(priceNum);
                updateFullPanel();
                // Закрываем меню если открыто
                const priceContent = document.getElementById('price-content');
                const priceArrow = document.getElementById('price-arrow');
                if (priceContent && priceContent.style.display === 'block') {
                    priceContent.style.display = 'none';
                    if (priceArrow) priceArrow.innerHTML = '▼';
                }
            } else {
                alert('Введите корректное число');
            }
        }
    }
    
    // ========== ЭКСПОРТ МЕТОДОВ ==========
    unsafeWindow.EncarPrice = {
        setManual: setManualPrice,
        refresh: loadPriceData,
        findPrice: (brand, model, engine, year) => findPriceFromData(brand, model, engine, year),
        getCurrentPrice: getCurrentEuroPrice,
        openEditor: openManualPriceEditor,
        updateDisplay: updatePriceContentDisplay
    };
    
    // Подписка на события от UI
    Hub.on('priceContent:update', () => {
        updatePriceContentDisplay();
    });
    
    Hub.on('carData:ready', () => {
        if (allPriceData.length) {
            autoSelectPrice();
            updateFullPanel();
        } else {
            Hub.once('priceData:loaded', () => {
                autoSelectPrice();
                updateFullPanel();
            });
        }
    });
    
    // Загрузка данных
    loadPriceData();
    
    console.log('[Price] Модуль загружен (с выпадающими меню)');
})();
