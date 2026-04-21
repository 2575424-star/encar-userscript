// ========== СОЗДАЁМ МЕНЮ ВРУЧНУЮ ==========
const priceSpan = document.getElementById('price-euro');
if (priceSpan) {
    // Создаём стрелку
    let priceArrow = document.getElementById('price-arrow');
    if (!priceArrow && priceSpan.parentNode) {
        priceArrow = document.createElement('span');
        priceArrow.id = 'price-arrow';
        priceArrow.style.marginLeft = '6px';
        priceArrow.style.fontSize = '10px';
        priceArrow.style.color = '#94a3b8';
        priceArrow.textContent = '▼';
        priceSpan.parentNode.appendChild(priceArrow);
        console.log('✅ Стрелка создана');
    }
    
    // Создаём контейнер для меню
    let priceContent = document.getElementById('price-content');
    if (!priceContent) {
        priceContent = document.createElement('div');
        priceContent.id = 'price-content';
        priceContent.style.display = 'none';
        priceContent.style.marginTop = '8px';
        priceContent.style.paddingTop = '6px';
        priceContent.style.borderTop = '1px solid rgba(255,255,255,0.08)';
        
        const innerDiv = document.createElement('div');
        innerDiv.id = 'price-content-inner';
        priceContent.appendChild(innerDiv);
        
        // Вставляем после блока с ценой
        const parent = priceSpan.closest('div');
        if (parent && parent.parentNode) {
            parent.parentNode.insertBefore(priceContent, parent.nextSibling);
        }
        console.log('✅ Контейнер меню создан');
    }
    
    // Обновляем обработчик
    priceSpan.onclick = function(e) {
        e.stopPropagation();
        const pc = document.getElementById('price-content');
        const pa = document.getElementById('price-arrow');
        
        if (pc.style.display === 'none') {
            pc.style.display = 'block';
            if (pa) pa.innerHTML = '▲';
            
            // Заполняем меню данными
            const innerDiv = document.getElementById('price-content-inner');
            const allPriceData = window.EncarHub?.get('allPriceData');
            
            if (allPriceData && allPriceData.length) {
                const brands = [...new Set(allPriceData.map(i => i.Марка))].sort();
                innerDiv.innerHTML = `
                    <div style="margin-bottom:8px;"><label style="font-size:11px; color:#94a3b8;">Марка:</label>
                    <select id="price-brand-select" style="width:100%; padding:6px; background:#0f172a; color:white; border:1px solid #475569; border-radius:8px;">
                        <option value="">— выберите марку —</option>
                        ${brands.map(b => `<option value="${b}">${b}</option>`).join('')}
                    </select></div>
                    <div style="margin-bottom:8px;"><label style="font-size:11px; color:#94a3b8;">Модель:</label>
                    <select id="price-model-select" style="width:100%; padding:6px; background:#0f172a; color:white; border:1px solid #475569; border-radius:8px;" disabled>
                        <option value="">— выберите модель —</option>
                    </select></div>
                    <div style="margin-bottom:8px;"><label style="font-size:11px; color:#94a3b8;">Объём:</label>
                    <select id="price-engine-select" style="width:100%; padding:6px; background:#0f172a; color:white; border:1px solid #475569; border-radius:8px;" disabled>
                        <option value="">— выберите объём —</option>
                    </select></div>
                    <div style="margin-bottom:8px;"><label style="font-size:11px; color:#94a3b8;">Год:</label>
                    <select id="price-year-select" style="width:100%; padding:6px; background:#0f172a; color:white; border:1px solid #475569; border-radius:8px;" disabled>
                        <option value="">— выберите год —</option>
                    </select></div>
                    <div style="display:flex; gap:8px; margin-top:12px;">
                        <button id="price-apply-auto" style="background:#fbbf24; border:none; padding:6px 12px; border-radius:8px; cursor:pointer; font-weight:bold;">Применить</button>
                        <button id="price-cancel-auto" style="background:#475569; border:none; padding:6px 12px; border-radius:8px; cursor:pointer; color:white;">Отмена</button>
                    </div>
                `;
                
                // Обработчики
                const brandSelect = document.getElementById('price-brand-select');
                const modelSelect = document.getElementById('price-model-select');
                const engineSelect = document.getElementById('price-engine-select');
                const yearSelect = document.getElementById('price-year-select');
                const applyBtn = document.getElementById('price-apply-auto');
                const cancelBtn = document.getElementById('price-cancel-auto');
                
                if (brandSelect) {
                    brandSelect.onchange = () => {
                        const brand = brandSelect.value;
                        if (!brand) return;
                        const models = [...new Set(allPriceData.filter(i => i.Марка === brand).map(i => i.Модель))].sort();
                        modelSelect.innerHTML = '<option value="">— выберите модель —</option>' + models.map(m => `<option value="${m}">${m}</option>`).join('');
                        modelSelect.disabled = false;
                        engineSelect.disabled = true;
                        yearSelect.disabled = true;
                    };
                }
                
                if (modelSelect) {
                    modelSelect.onchange = () => {
                        const brand = brandSelect.value, model = modelSelect.value;
                        if (!brand || !model) return;
                        const engines = [...new Set(allPriceData.filter(i => i.Марка === brand && i.Модель === model).map(i => i.Объем))].sort((a,b) => parseInt(a)-parseInt(b));
                        engineSelect.innerHTML = '<option value="">— выберите объём —</option>' + engines.map(e => `<option value="${e}">${e}</option>`).join('');
                        engineSelect.disabled = false;
                        yearSelect.disabled = true;
                    };
                }
                
                if (engineSelect) {
                    engineSelect.onchange = () => {
                        const brand = brandSelect.value, model = modelSelect.value, engine = engineSelect.value;
                        if (!brand || !model || !engine) return;
                        const years = [...new Set(allPriceData.filter(i => i.Марка === brand && i.Модель === model && i.Объем === engine).map(i => i.Год))].sort((a,b) => b-a);
                        yearSelect.innerHTML = '<option value="">— выберите год —</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
                        yearSelect.disabled = false;
                    };
                }
                
                if (applyBtn) {
                    applyBtn.onclick = () => {
                        const brand = brandSelect.value, model = modelSelect.value, engine = engineSelect.value, year = parseInt(yearSelect.value);
                        if (!brand || !model || !engine || !year) { alert('Выберите все параметры'); return; }
                        const price = allPriceData.find(i => i.Марка === brand && i.Модель === model && i.Объем === engine && i.Год === year)?.Цена;
                        if (price) {
                            window.EncarHub.set('selectedEuroPrice', price);
                            priceSpan.textContent = `${price.toLocaleString()} €`;
                        }
                        pc.style.display = 'none';
                        if (pa) pa.innerHTML = '▼';
                    };
                }
                
                if (cancelBtn) {
                    cancelBtn.onclick = () => {
                        pc.style.display = 'none';
                        if (pa) pa.innerHTML = '▼';
                    };
                }
            } else {
                innerDiv.innerHTML = '<div style="text-align:center;">Загрузка данных...</div>';
            }
        } else {
            pc.style.display = 'none';
            if (pa) pa.innerHTML = '▼';
        }
    };
    
    console.log('✅ Меню полностью настроено! Кликните по цене');
    
    // Тестовый клик
    setTimeout(() => {
        priceSpan.click();
        console.log('Тестовый клик выполнен');
    }, 500);
} else {
    console.log('Цена не найдена');
}
