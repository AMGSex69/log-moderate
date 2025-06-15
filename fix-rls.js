const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ixqjqjqjqjqjqjqjqjqj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4cWpxanFqcWpxanFqcWpxanFqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDM0NzE5MSwiZXhwIjoyMDQ5OTIzMTkxfQ.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixRLS() {
	console.log('🔧 Исправляем RLS политики для employees...');

	try {
		// 1. Проверяем текущие политики
		console.log('1. Проверяем текущие RLS политики...');
		const { data: policies, error: policiesError } = await supabase
			.rpc('exec_sql', {
				sql: `SELECT policyname, cmd, permissive, roles FROM pg_policies WHERE tablename = 'employees';`
			});

		if (policiesError) {
			console.log('Ошибка при проверке политик:', policiesError);
		} else {
			console.log('Текущие политики:', policies);
		}

		// 2. Отключаем RLS временно
		console.log('2. Отключаем RLS...');
		const { error: disableError } = await supabase
			.rpc('exec_sql', {
				sql: 'ALTER TABLE employees DISABLE ROW LEVEL SECURITY;'
			});

		if (disableError) {
			console.log('Ошибка отключения RLS:', disableError);
		} else {
			console.log('✅ RLS отключен');
		}

		// 3. Тестируем запрос без RLS
		console.log('3. Тестируем запрос без RLS...');
		const { data: testData, error: testError } = await supabase
			.from('employees')
			.select(`
                id,
                full_name,
                user_id,
                is_online,
                position,
                is_active,
                work_hours,
                offices(name)
            `)
			.eq('offices.name', 'Рассвет')
			.eq('is_active', true);

		if (testError) {
			console.log('❌ Ошибка тестового запроса:', testError);
		} else {
			console.log('✅ Найдено сотрудников:', testData?.length || 0);
			if (testData && testData.length > 0) {
				console.log('Первый сотрудник:', testData[0]);
			}
		}

		// 4. Включаем RLS обратно
		console.log('4. Включаем RLS обратно...');
		const { error: enableError } = await supabase
			.rpc('exec_sql', {
				sql: 'ALTER TABLE employees ENABLE ROW LEVEL SECURITY;'
			});

		if (enableError) {
			console.log('Ошибка включения RLS:', enableError);
		} else {
			console.log('✅ RLS включен');
		}

		// 5. Создаем разрешающую политику
		console.log('5. Создаем разрешающую политику...');
		const { error: policyError } = await supabase
			.rpc('exec_sql', {
				sql: `
                    DROP POLICY IF EXISTS "employees_read_all" ON employees;
                    CREATE POLICY "employees_read_all" ON employees
                        FOR SELECT 
                        USING (true);
                `
			});

		if (policyError) {
			console.log('❌ Ошибка создания политики:', policyError);
		} else {
			console.log('✅ Политика создана');
		}

		// 6. Финальный тест
		console.log('6. Финальный тест с новой политикой...');
		const { data: finalData, error: finalError } = await supabase
			.from('employees')
			.select(`
                id,
                full_name,
                user_id,
                is_online,
                position,
                is_active,
                work_hours,
                offices(name)
            `)
			.eq('offices.name', 'Рассвет')
			.eq('is_active', true);

		if (finalError) {
			console.log('❌ Ошибка финального теста:', finalError);
		} else {
			console.log('✅ Финальный результат - найдено сотрудников:', finalData?.length || 0);
			if (finalData && finalData.length > 0) {
				console.log('Данные для фронтенда:');
				finalData.forEach((emp, i) => {
					console.log(`${i + 1}. ${emp.full_name} - ${emp.position} (${emp.work_hours}ч)`);
				});
			}
		}

	} catch (error) {
		console.error('❌ Общая ошибка:', error);
	}
}

fixRLS(); 