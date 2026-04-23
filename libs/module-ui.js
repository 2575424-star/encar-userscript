// ========== КНОПКА РАСЧЁТА (вместо обновления) ==========
document.getElementById('refresh-panel-btn').onclick = () => {
    // Получаем текущие значения
    const currentTotal = Hub.get('totalPrice') || 0;
    const carPriceUSD = Hub.get('carPriceKrw') ? Math.round(Hub.get('carPriceKrw') / (Hub.get('usdToKrw') || 1473)) : 0;
    const currentTpo = Hub.get('calculatedTpo') || 0;
    const currentDocsRf = Hub.get('docsRf') || 85000;
    const currentUsdtRate = Hub.get('usdtRate') || 90;
    
    // Значения по умолчанию
    let markupPercent = 4;      // Наценка 4%
    let koreaExpenses = 4000;   // Расходы Корея
    let bishkekExpenses = 2000; // Расходы Бишкек
    
    // Сохраняем предыдущие значения в localStorage для повторного использования
    const savedMarkup = localStorage.getItem('calc_markup_percent');
    const savedKorea = localStorage.getItem('calc_korea_expenses');
    const savedBishkek = localStorage.getItem('calc_bishkek_expenses');
    
    if (savedMarkup) markupPercent = parseFloat(savedMarkup);
    if (savedKorea) koreaExpenses = parseFloat(savedKorea);
    if (savedBishkek) bishkekExpenses = parseFloat(savedBishkek);
    
    // Создаём модальное окно
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        color: #f1f5f9;
        border-radius: 20px;
        padding: 20px;
        width: 420px;
        max-width: 90vw;
        z-index: 100000;
        box-shadow: 0 20px 40px rgba(0,0,0,0.5);
        border: 1px solid rgba(251,191,36,0.3);
        font-family: 'Segoe UI', system-ui, sans-serif;
    `;
    
    modal.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #334155; padding-bottom: 12px;">
            <span style="font-size: 20px; font-weight: 700; color: #fbbf24;">🧮 Калькулятор наценки</span>
            <button id="calc-close" style="background: rgba(255,255,255,0.1); border: none; color: white; font-size: 20px; cursor: pointer; width: 30px; height: 30px; border-radius: 50%;">×</button>
        </div>
        
        <div style="margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span style="color: #94a3b8;">🚗 Стоимость авто в USD:</span>
                <span style="font-weight: 700; color: #fbbf24;">${carPriceUSD.toLocaleString()} $</span>
            </div>
            <div style="font-size: 11px; color: #64748b;">(из цены в Корее / курс USD/KRW)</div>
        </div>
        
        <div style="margin-bottom: 15px;">
            <label style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #94a3b8;">📈 Наценка (%):</span>
                <input type="number" id="calc-markup" value="${markupPercent}" step="0.5" style="width: 100px; padding: 6px; background: #0f172a; color: white; border: 1px solid #475569; border-radius: 8px; text-align: right;">
            </label>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Процент от стоимости авто</div>
        </div>
        
        <div style="margin-bottom: 15px;">
            <label style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #94a3b8;">📦 Расходы Корея ($):</span>
                <input type="number" id="calc-korea" value="${koreaExpenses}" step="100" style="width: 100px; padding: 6px; background: #0f172a; color: white; border: 1px solid #475569; border-radius: 8px; text-align: right;">
            </label>
        </div>
        
        <div style="margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span style="color: #94a3b8;">🏛️ ТПО ($):</span>
                <span style="font-weight: 700; color: #fbbf24;">${currentTpo.toLocaleString()} $</span>
            </div>
        </div>
        
        <div style="margin-bottom: 15px;">
            <label style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #94a3b8;">🇰🇬 Расходы Бишкек ($):</span>
                <input type="number" id="calc-bishkek" value="${bishkekExpenses}" step="100" style="width: 100px; padding: 6px; background: #0f172a; color: white; border: 1px solid #475569; border-radius: 8px; text-align: right;">
            </label>
        </div>
        
        <div style="margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span style="color: #94a3b8;">💎 Курс USDT (₽):</span>
                <span style="font-weight: 700; color: #fbbf24;">${currentUsdtRate.toFixed(2)} ₽</span>
            </div>
            <div style="font-size: 11px; color: #64748b;">(курс для расчёта: USDT - 1 = ${(currentUsdtRate - 1).toFixed(2)})</div>
        </div>
        
        <div style="margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span style="color: #94a3b8;">📄 Документы РФ (₽):</span>
                <span style="font-weight: 700; color: #fbbf24;">${currentDocsRf.toLocaleString()} ₽</span>
            </div>
        </div>
        
        <div style="background: rgba(251,191,36,0.1); border-radius: 12px; padding: 15px; margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #94a3b8;">💰 РАСЧЁТНАЯ ЦЕНА:</span>
                <span id="calc-result" style="font-size: 20px; font-weight: 800; color: #fbbf24;">0 ₽</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #94a3b8;">📊 ИТОГО ПО СКРИПТУ:</span>
                <span style="font-size: 16px; font-weight: 700; color: #22c55e;">${currentTotal.toLocaleString()} ₽</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding-top: 8px; border-top: 1px solid #334155;">
                <span style="color: #94a3b8;">🏷️ НАЦЕНКА:</span>
                <span id="calc-difference" style="font-size: 16px; font-weight: 800; color: #f97316;">0 ₽</span>
            </div>
        </div>
        
        <div style="display: flex; gap: 10px;">
            <button id="calc-apply" style="flex: 1; background: #fbbf24; border: none; padding: 10px; border-radius: 10px; font-weight: 700; cursor: pointer; color: #0f172a;">✅ Применить расходы</button>
            <button id="calc-calc" style="flex: 1; background: #3b82f6; border: none; padding: 10px; border-radius: 10px; font-weight: 700; cursor: pointer; color: white;">🔄 Пересчитать</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Функция пересчёта
    function recalc() {
        const markupPercent = parseFloat(document.getElementById('calc-markup').value) || 0;
        const koreaExp = parseFloat(document.getElementById('calc-korea').value) || 0;
        const bishkekExp = parseFloat(document.getElementById('calc-bishkek').value) || 0;
        
        // Расчёт наценки от стоимости авто
        const markupAmount = carPriceUSD * (markupPercent / 100);
        
        // Сумма в USD
        const totalUSD = carPriceUSD + markupAmount + koreaExp + currentTpo + bishkekExp;
        
        // Курс для расчёта (USDT - 1)
        const calcRate = currentUsdtRate - 1;
        
        // Итог в рублях
        const totalRUB = totalUSD * calcRate + currentDocsRf;
        
        // Разница с текущей итоговой ценой
        const difference = totalRUB - currentTotal;
        
        document.getElementById('calc-result').innerHTML = `${Math.round(totalRUB).toLocaleString()} ₽`;
        document.getElementById('calc-difference').innerHTML = `${Math.round(difference).toLocaleString()} ₽`;
        
        if (difference > 0) {
            document.getElementById('calc-difference').style.color = '#22c55e';
        } else if (difference < 0) {
            document.getElementById('calc-difference').style.color = '#ef4444';
        } else {
            document.getElementById('calc-difference').style.color = '#fbbf24';
        }
    }
    
    // Применить расходы (сохранить в localStorage и в Hub)
    function applyExpenses() {
        const koreaExp = parseFloat(document.getElementById('calc-korea').value) || 0;
        const bishkekExp = parseFloat(document.getElementById('calc-bishkek').value) || 0;
        const markupPercent = parseFloat(document.getElementById('calc-markup').value) || 0;
        
        // Сохраняем в localStorage
        localStorage.setItem('calc_korea_expenses', koreaExp);
        localStorage.setItem('calc_bishkek_expenses', bishkekExp);
        localStorage.setItem('calc_markup_percent', markupPercent);
        
        // Обновляем расходы в Hub
        Hub.set('koreaLogistics', koreaExp);
        Hub.set('servicesBishkek', bishkekExp);
        
        // Пересчитываем итог
        Hub.emit('any:changed', {});
        
        // Показываем уведомление
        const notif = document.createElement('div');
        notif.textContent = '✅ Расходы применены!';
        notif.style.cssText = 'position:fixed; bottom:100px; right:20px; background:#22c55e; color:white; padding:10px 20px; border-radius:10px; z-index:100000; font-size:13px; animation:fadeOutNotif 2s ease-out forwards;';
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 2000);
        
        modal.remove();
    }
    
    // Обработчики
    document.getElementById('calc-close').onclick = () => modal.remove();
    document.getElementById('calc-calc').onclick = () => recalc();
    document.getElementById('calc-apply').onclick = () => applyExpenses();
    
    // Добавляем стиль для анимации
    if (!document.querySelector('#calc-style')) {
        const style = document.createElement('style');
        style.id = 'calc-style';
        style.textContent = `
            @keyframes fadeOutNotif {
                0% { opacity: 1; transform: translateX(0); }
                70% { opacity: 1; transform: translateX(0); }
                100% { opacity: 0; transform: translateX(20px); }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Первоначальный расчёт
    recalc();
    
    console.log('[UI] Калькулятор наценки открыт');
};
