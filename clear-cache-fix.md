# 🔧 Полное исправление Session Timeout

## 🚨 Проблема
После обновления кода все еще появляется ошибка "Session timeout" из-за кэшированного JavaScript кода.

## ✅ Полное решение

### Шаг 1: Очистка кэша браузера
В браузере нажмите **F12** → **Application** → **Storage** → **Clear site data**

ИЛИ откройте консоль браузера (F12) и выполните:
```javascript
localStorage.clear();
sessionStorage.clear();
if ('caches' in window) {
  caches.keys().then(names => names.forEach(name => caches.delete(name)));
}
window.location.reload(true);
```

### Шаг 2: Жесткая перезагрузка
- **Windows**: `Ctrl + Shift + R`
- **Mac**: `Cmd + Shift + R`

### Шаг 3: Перезапуск dev сервера
```bash
# Остановите сервер (Ctrl+C)
# Затем перезапустите:
npm run dev
```

### Шаг 4: Проверка в режиме инкогнито
Откройте приложение в режиме инкогнито/приватном режиме - там точно не будет старого кэша.

## 🔍 Что исправлено

1. ✅ **Добавлены функции `calculateLevel` и `getNextLevel`** в `lib/game-config.ts`
2. ✅ **Убраны все агрессивные таймауты** из `hooks/use-auth.ts`
3. ✅ **Улучшена обработка ошибок** в `components/auth/auth-guard.tsx`

## 🎯 Ожидаемый результат

После выполнения всех шагов:
- ✅ Нет ошибок импорта функций
- ✅ Нет "Session timeout" при обновлении страницы
- ✅ Плавная загрузка и работа приложения
- ✅ Корректная аутентификация

## 🐛 Если проблема остается

1. **Удалите папку `.next`** и пересоберите:
   ```bash
   rm -rf .next
   npm run build
   npm run dev
   ```

2. **Проверьте переменные окружения** в `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. **Попробуйте другой браузер** для исключения локальных проблем кэша

---
**Статус**: ✅ Все исправления применены  
**Следующий шаг**: Очистка кэша браузера и жесткая перезагрузка 