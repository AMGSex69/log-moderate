# 🚨 Требуется настройка Supabase

## Проблема
Приложение зависает при загрузке, потому что отсутствует файл `.env.local` с настройками Supabase.

## 🛠️ Решение

### Шаг 1: Создайте проект Supabase
1. Перейдите на https://supabase.com/dashboard
2. Создайте новый проект или выберите существующий  
3. Дождитесь завершения создания проекта (2-3 минуты)

### Шаг 2: Получите ключи API
1. В панели Supabase перейдите в **Settings** → **API**
2. Скопируйте:
   - **Project URL** (начинается с https://...supabase.co)
   - **anon public** ключ (длинная строка начинающаяся с eyJ...)

### Шаг 3: Создайте файл .env.local
Создайте файл `.env.local` в корне проекта со следующим содержимым:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Замените значения на свои из панели Supabase!**

### Шаг 4: Настройте базу данных
После создания `.env.local`:
1. Перезапустите dev сервер: `npm run dev`
2. Выполните SQL скрипт `database-complete-setup.sql` в Supabase SQL Editor
3. Создайте пользователя через форму регистрации

## 📋 Быстрая проверка

После настройки в консоли браузера должны появиться логи:
- ✅ `Supabase config OK`
- 📋 `Session result: { session: false, error: null }`

## 🆘 Если проблема остается

1. **Проверьте файл .env.local** - он должен быть в корне проекта
2. **Перезапустите сервер** - `Ctrl+C` и снова `npm run dev`
3. **Очистите кэш браузера** - F12 → Application → Storage → Clear site data

---
**Следующий шаг**: Создать проект Supabase и файл .env.local 