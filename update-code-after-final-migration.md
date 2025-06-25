# 🔄 ОБНОВЛЕНИЕ КОДА ПОСЛЕ ЗАВЕРШЕНИЯ МИГРАЦИИ

## 📋 **Что изменилось в БД:**
- ✅ `user_profiles` теперь единственная таблица пользователей
- ✅ `user_profiles.employee_id` - уникальный ID сотрудника (SERIAL)
- ✅ Все внешние ключи переведены на `user_profiles.employee_id`
- ✅ Таблица `employees` больше не используется

---

## 🎯 **ПЛАН ОБНОВЛЕНИЯ КОДА**

### **1. ОБНОВИТЬ ТИПЫ (lib/database-types.ts)**

```typescript
// Удалить интерфейс Employee (больше не нужен)
// export interface Employee { ... } ❌

// Обновить UserProfile (теперь содержит все поля)
export interface UserProfile {
  id: string; // UUID пользователя
  employee_id: number; // Уникальный ID сотрудника (SERIAL)
  full_name: string;
  position: string;
  is_admin: boolean;
  work_schedule: '5/2' | '2/2';
  work_hours: number;
  office_id: number;
  office_name?: string;
  avatar_url?: string;
  email?: string;
  phone?: string;
  bio?: string;
  website?: string;
  admin_role: 'user' | 'office_admin' | 'super_admin';
  managed_office_id?: number;
  is_active: boolean;
  last_seen?: string;
  created_at: string;
  updated_at: string;
}

// Обновить связанные интерфейсы
export interface TaskLog {
  id: number;
  employee_id: number; // Теперь ссылается на user_profiles.employee_id
  task_type_id: number;
  units_completed: number;
  time_spent_minutes: number;
  work_date: string;
  notes?: string;
  is_active: boolean;
  started_at: string;
  completed_at: string;
  created_at: string;
}

export interface WorkSession {
  id: number;
  employee_id: number; // Теперь ссылается на user_profiles.employee_id
  date: string;
  clock_in_time?: string;
  clock_out_time?: string;
  expected_end_time?: string;
  is_auto_clocked_out: boolean;
  is_paused: boolean;
  pause_start_time?: string;
  total_work_minutes: number;
  total_task_minutes: number;
  total_idle_minutes: number;
  total_break_minutes: number;
  overtime_minutes: number;
  break_duration_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActiveSession {
  id: number;
  employee_id: number; // Теперь ссылается на user_profiles.employee_id
  task_type_id: number;
  started_at: string;
  last_heartbeat: string;
  current_units: number;
  is_active: boolean;
  created_at: string;
}
```

### **2. ОБНОВИТЬ ФУНКЦИИ АВТОРИЗАЦИИ (lib/auth.ts)**

```typescript
// Удалить все функции связанные с employees таблицей
// Оставить только работу с user_profiles

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_profiles')
      .select(`
        *,
        offices(name)
      `)
      .eq('id', user.id)
      .single();

    if (error) throw error;
    
    return {
      ...data,
      office_name: data.offices?.name
    };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

export async function updateProfile(
  userId: string, 
  updates: Partial<UserProfile>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Вычисляем work_hours на основе work_schedule
    if (updates.work_schedule) {
      updates.work_hours = updates.work_schedule === '5/2' ? 9 : 12;
    }

    const { error } = await supabase
      .from('user_profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) throw error;
    
    return { success: true };
  } catch (error: any) {
    console.error('Error updating profile:', error);
    return { 
      success: false, 
      error: error.message || 'Ошибка обновления профиля' 
    };
  }
}

// Новая функция для получения employee_id по user_id
export async function getEmployeeId(userId: string): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('employee_id')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data?.employee_id || null;
  } catch (error) {
    console.error('Error getting employee_id:', error);
    return null;
  }
}
```

### **3. ОБНОВИТЬ ХУКИ (hooks/use-auth.ts)**

```typescript
// Удалить все ссылки на employees таблицу
// Использовать только user_profiles

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      return;
    }

    try {
      const userProfile = await getCurrentUserProfile();
      setProfile(userProfile);
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  }, [user?.id]);

  // Остальная логика остается такой же...
}
```

### **4. УДАЛИТЬ API СИНХРОНИЗАЦИИ (app/api/sync-user-data/route.ts)**

```typescript
// Этот файл больше не нужен - можно удалить
// Синхронизация между таблицами больше не требуется
```

### **5. ОБНОВИТЬ КОМПОНЕНТЫ АДМИНКИ**

#### **app/admin/employees/page.tsx**
```typescript
// Изменить запросы с employees на user_profiles
const { data: employees, error } = await supabase
  .from('user_profiles') // Было: employees
  .select(`
    employee_id,
    full_name,
    position,
    is_admin,
    work_schedule,
    work_hours,
    office_id,
    avatar_url,
    email,
    is_active,
    last_seen,
    admin_role,
    offices(name)
  `)
  .eq('is_active', true)
  .order('full_name');
```

#### **components/admin/employee-analytics.tsx**
```typescript
// Обновить все запросы
const { data: employeeData } = await supabase
  .from('user_profiles') // Было: employees
  .select('employee_id, full_name, office_id, offices(name)')
  .eq('employee_id', employeeId) // Было: id
  .single();

// Обновить связанные запросы
const { data: taskLogs } = await supabase
  .from('task_logs')
  .select('*')
  .eq('employee_id', employeeId); // employee_id теперь из user_profiles
```

### **6. ОБНОВИТЬ КОМПОНЕНТЫ СТАТИСТИКИ**

#### **components/leaderboard.tsx**
```typescript
// Использовать представление employees_leaderboard или создать новый запрос
const { data: leaderboardData, error } = await supabase
  .from('user_profiles')
  .select(`
    employee_id,
    full_name,
    position,
    avatar_url,
    office_id,
    offices(name)
  `)
  .eq('is_active', true);

// Добавить подсчет статистики через JOIN с task_logs
```

### **7. ОБНОВИТЬ ФУНКЦИИ РАБОТЫ С ЗАДАЧАМИ**

#### **components/task-logger-form.tsx**
```typescript
// Использовать employee_id из профиля пользователя
const profile = useAuth().profile;
const employeeId = profile?.employee_id;

if (!employeeId) {
  throw new Error('Employee ID not found');
}

// Сохранение задачи
const { error } = await supabase
  .from('task_logs')
  .insert({
    employee_id: employeeId, // Используем employee_id из user_profiles
    task_type_id: taskTypeId,
    units_completed: units,
    time_spent_minutes: timeSpent,
    work_date: new Date().toISOString().split('T')[0],
    notes: notes
  });
```

### **8. ОБНОВИТЬ ФУНКЦИИ РАБОЧИХ СЕССИЙ**

#### **components/work-session-enhanced.tsx**
```typescript
// Обновить все функции для работы с employee_id из user_profiles
const startWorkSession = async () => {
  const profile = useAuth().profile;
  if (!profile?.employee_id) return;

  const { error } = await supabase
    .from('work_sessions')
    .insert({
      employee_id: profile.employee_id, // Используем employee_id из user_profiles
      date: new Date().toISOString().split('T')[0],
      clock_in_time: new Date().toISOString(),
      expected_end_time: calculateExpectedEndTime(profile.work_hours),
      is_active: true
    });
};
```

### **9. ОБНОВИТЬ ФУНКЦИИ АКТИВНЫХ СЕССИЙ**

#### **hooks/use-multi-timer.ts**
```typescript
// Обновить для работы с новой структурой
const startTimer = async (taskTypeId: number) => {
  const profile = useAuth().profile;
  if (!profile?.employee_id) return;

  const { error } = await supabase
    .from('active_sessions')
    .insert({
      employee_id: profile.employee_id, // Используем employee_id из user_profiles
      task_type_id: taskTypeId,
      started_at: new Date().toISOString(),
      last_heartbeat: new Date().toISOString(),
      current_units: 0,
      is_active: true
    });
};
```

---

## ✅ **ЧЕКЛИСТ ОБНОВЛЕНИЙ**

### **Файлы для обновления:**
- [ ] `lib/database-types.ts` - обновить интерфейсы
- [ ] `lib/auth.ts` - убрать employees, оставить user_profiles
- [ ] `hooks/use-auth.ts` - обновить логику профиля
- [ ] `app/api/sync-user-data/route.ts` - **УДАЛИТЬ**
- [ ] `app/admin/employees/page.tsx` - изменить запросы
- [ ] `components/admin/employee-analytics.tsx` - обновить запросы
- [ ] `components/admin/detailed-employee-report.tsx` - обновить запросы
- [ ] `components/leaderboard.tsx` - обновить логику
- [ ] `components/task-logger-form.tsx` - использовать employee_id
- [ ] `components/work-session-enhanced.tsx` - обновить сессии
- [ ] `hooks/use-multi-timer.ts` - обновить таймеры
- [ ] `hooks/use-work-session.ts` - обновить логику сессий

### **Файлы для проверки:**
- [ ] Все компоненты в `components/admin/`
- [ ] Все хуки в `hooks/`
- [ ] Все API роуты в `app/api/`

### **После обновления:**
- [ ] Протестировать регистрацию новых пользователей
- [ ] Протестировать редактирование профиля
- [ ] Протестировать логирование задач
- [ ] Протестировать рабочие сессии
- [ ] Протестировать админ панель
- [ ] Протестировать статистику и лидерборд

---

## 🚀 **РЕЗУЛЬТАТ**

После выполнения всех обновлений:
- ✅ Единая таблица `user_profiles` как источник истины
- ✅ Нет конфликтов синхронизации
- ✅ Упрощенная архитектура
- ✅ Лучшая производительность
- ✅ Стабильное редактирование профилей 