// ==UserScript==
// @name         Encar Core Hub
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Центральное хранилище данных и событий
// @match        *://www.encar.com/cars/detail/*
// @match        *://fem.encar.com/cars/detail/*
// @grant        unsafeWindow
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // Создаём глобальный хаб в unsafeWindow
    if (!unsafeWindow.EncarHub) {
        unsafeWindow.EncarHub = {
            // Хранилище данных
            _data: {},
            
            // Подписчики на события
            _listeners: {},
            
            // Подписчики на одно событие (once)
            _onceListeners: {},
            
            // Установить значение
            set: function(key, value, silent = false) {
                const oldValue = this._data[key];
                this._data[key] = value;
                
                if (!silent) {
                    this.emit(`${key}:changed`, { key, value, oldValue });
                    this.emit('any:changed', { key, value, oldValue });
                }
                
                console.log(`[Hub] ${key} =`, value);
                return value;
            },
            
            // Получить значение
            get: function(key) {
                return this._data[key];
            },
            
            // Получить все данные
            getAll: function() {
                return { ...this._data };
            },
            
            // Подписаться на событие
            on: function(event, callback) {
                if (!this._listeners[event]) {
                    this._listeners[event] = [];
                }
                this._listeners[event].push(callback);
            },
            
            // Подписаться на событие один раз
            once: function(event, callback) {
                if (!this._onceListeners[event]) {
                    this._onceListeners[event] = [];
                }
                this._onceListeners[event].push(callback);
            },
            
            // Отписаться
            off: function(event, callback) {
                if (this._listeners[event]) {
                    this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
                }
                if (this._onceListeners[event]) {
                    this._onceListeners[event] = this._onceListeners[event].filter(cb => cb !== callback);
                }
            },
            
            // Вызвать событие
            emit: function(event, data) {
                // Обычные подписчики
                if (this._listeners[event]) {
                    this._listeners[event].forEach(callback => {
                        try {
                            callback(data);
                        } catch(e) {
                            console.error(`[Hub] Ошибка в обработчике ${event}:`, e);
                        }
                    });
                }
                
                // Подписчики once
                if (this._onceListeners[event]) {
                    const callbacks = [...this._onceListeners[event]];
                    delete this._onceListeners[event];
                    callbacks.forEach(callback => {
                        try {
                            callback(data);
                        } catch(e) {
                            console.error(`[Hub] Ошибка в once-обработчике ${event}:`, e);
                        }
                    });
                }
            },
            
            // Ждать событие (Promise)
            waitFor: function(key, timeout = 10000) {
                return new Promise((resolve, reject) => {
                    const existing = this.get(key);
                    if (existing !== undefined && existing !== null) {
                        resolve(existing);
                        return;
                    }
                    
                    const timeoutId = setTimeout(() => {
                        this.off(`${key}:changed`, handler);
                        reject(new Error(`Timeout waiting for ${key}`));
                    }, timeout);
                    
                    const handler = (data) => {
                        clearTimeout(timeoutId);
                        this.off(`${key}:changed`, handler);
                        resolve(data.value);
                    };
                    
                    this.on(`${key}:changed`, handler);
                });
            }
        };
    }
    
    // Добавляем стили для панели (глобально)
    GM_addStyle(`
        #encar-combined-panel,
        #encar-combined-panel * {
            translate: no !important;
            -webkit-translate: no !important;
        }
    `);
    
    // Защита от Google Translate
    document.documentElement.setAttribute('translate', 'no');
    document.body.setAttribute('translate', 'no');
    
    console.log('[CoreHub] Инициализирован (версия 2.0)');
})();
