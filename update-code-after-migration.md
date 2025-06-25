# План обновления кода после миграции к единой таблице

## Что изменилось после миграции

### ✅ **Объединение таблиц**
- `employees` таблица удалена
- Все данные перенесены в `user_profiles`
- `user_profiles` теперь содержит поле `employee_id` (SERIAL)

### 🔄 **Изменения в структуре данных**
- `user_profiles.employee_id` - новый первичный ключ для связей
- Все внешние ключи теперь ссылаются на `user_profiles.employee_id`
- Функция `get_employee_id_by_user_id(UUID)` возвращает `employee_id`

## Файлы, которые нужно обновить

### 1. **lib/database-types.ts**
```typescript
// Удалить интерфейс Employee (объединен с UserProfile)
// Обновить UserProfile:

export interface UserProfile {
    id: string                    // UUID из auth.users
    employee_id: number          // НОВОЕ ПОЛЕ - автоинкремент ID
    full_name: string
    email?: string
    position: string
    employee_number?: string
    is_admin: boolean
    is_active: boolean
    work_schedule: string
    work_hours: number
    office_id?: number
    avatar_url?: string
    is_online: boolean
    last_seen?: string
    created_at: string
    updated_at: string
}

// Обновить связанные интерфейсы
export interface TaskLog {
    // employee_id теперь ссылается на user_profiles.employee_id
    employee_id: number
    // ...остальные поля
    user_profiles?: UserProfile  // Изменить с employees
}
```

### 2. **lib/auth.ts**
```typescript
// Обновить функцию updateProfile
async updateProfile(userId: string, updates: Partial<UserProfile>) {
    // Теперь обновляем только одну таблицу user_profiles
    const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', userId)
    
    if (error) throw error
}

// Добавить функцию получения employee_id
async getEmployeeId(userId: string): Promise<number | null> {
    const { data } = await supabase
        .rpc('get_employee_id_by_user_id', { user_uuid: userId })
    return data
}
```

### 3. **Компоненты - обновить запросы**

#### **components/leaderboard.tsx**
```typescript
// СТАРЫЙ запрос:
.select("employee_id, units_completed, time_spent_minutes, task_type_id, employees(full_name, user_id, offices!office_id(name)), task_types(name)")

// НОВЫЙ запрос:
.select("employee_id, units_completed, time_spent_minutes, task_type_id, user_profiles!employee_id(full_name, id, offices!office_id(name)), task_types(name)")
```

#### **components/admin-dashboard.tsx**
```typescript
// СТАРЫЙ:
.select("employee_id, units_completed, time_spent_minutes, employees(full_name, position)")

// НОВЫЙ:
.select("employee_id, units_completed, time_spent_minutes, user_profiles!employee_id(full_name, position)")
```

#### **components/stats-panel.tsx**
```typescript
// СТАРЫЙ:
.select("employee_id, units_completed, time_spent_minutes, employees(full_name)")

// НОВЫЙ:
.select("employee_id, units_completed, time_spent_minutes, user_profiles!employee_id(full_name)")
```

### 4. **app/page.tsx - основные изменения**
```typescript
// Обновить получение списка сотрудников
const { data: allUsers } = await supabase
    .from('user_profiles')
    .select('employee_id, id, full_name, position, office_id, offices!office_id(name)')
    .eq('is_active', true)

// Обновить фильтрацию задач по офису
.in("employee_id", allUsers.map(user => user.employee_id))

// Обновить получение активных сессий
.in("employee_id", allUsers.map(user => user.employee_id))
```

### 5. **app/admin/employees/page.tsx**
```typescript
// Полностью переписать запросы с employees на user_profiles
const { data: employees } = await supabase
    .from('user_profiles')
    .select(`
        employee_id,
        id,
        full_name,
        position,
        work_schedule,
        work_hours,
        is_admin,
        is_active,
        office_id,
        offices!office_id(name),
        avatar_url
    `)
    .eq('is_active', true)
```

### 6. **components/user-profile-modal.tsx**
```typescript
// Упростить - теперь все данные в одной таблице
const { data: userData } = await supabase
    .from('user_profiles')
    .select(`
        employee_id,
        id,
        full_name,
        position,
        work_schedule,
        work_hours,
        office_id,
        offices!office_id(name),
        avatar_url,
        is_admin
    `)
    .eq('id', userId)
    .single()
```

### 7. **Все admin компоненты**
- `components/admin/employee-analytics.tsx`
- `components/admin/detailed-employee-report.tsx`
- `components/admin/task-analytics.tsx`
- `components/office-team-stats.tsx`

**Общий паттерн замены:**
```typescript
// СТАРЫЙ:
employees(full_name, position, office_id)

// НОВЫЙ:
user_profiles!employee_id(full_name, position, office_id)
```

## Пошаговый план выполнения

### Шаг 1: Выполнить миграцию БД
```bash
# Выполнить в Supabase SQL Editor
# migrate-to-single-table-complete.sql
```

### Шаг 2: Обновить типы данных
```bash
# Обновить lib/database-types.ts
```

### Шаг 3: Обновить lib/auth.ts
```bash
# Упростить функции работы с профилем
```

### Шаг 4: Обновить все запросы в компонентах
```bash
# Заменить все ссылки на employees на user_profiles
```

### Шаг 5: Тестирование
```bash
# Проверить все функции:
# - Регистрация пользователей
# - Редактирование профиля
# - Логирование задач
# - Статистика
# - Админ-панель
```

### Шаг 6: Удалить API синхронизации
```bash
# Удалить app/api/sync-user-data/route.ts
# Удалить lib/profile-sync.ts
# Очистить от вызовов синхронизации
```

## Преимущества после миграции

✅ **Упрощение архитектуры**
- Один источник истины для данных пользователя
- Нет необходимости в синхронизации
- Упрощенные запросы к БД

✅ **Исправление проблем**
- Редактирование профиля работает сразу
- Нет конфликтов данных
- Нет откатов изменений

✅ **Улучшение производительности**
- Меньше JOIN'ов в запросах
- Быстрее загрузка данных
- Меньше сетевых запросов

✅ **Упрощение кода**
- Меньше дублирования логики
- Проще поддержка и разработка
- Меньше багов 