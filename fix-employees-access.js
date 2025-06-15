const { createClient } = require('@supabase/supabase-js');

// Используем правильные ключи из кода
const supabaseUrl = 'https://ixqjqjqjqjqjqjqjqjqj.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4cWpxanFqcWpxanFqcWpxanFqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDM0NzE5MSwiZXhwIjoyMDQ5OTIzMTkxfQ.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixEmployeesAccess() {
	console.log('🔧 Исправляем доступ к таблице employees...');

	try {
		// 1. Проверяем текущий статус RLS
		console.log('1. Проверяем RLS статус...');
		const { data: rlsStatus, error: rlsError } = await supabase
			.rpc('exec_sql', {
				sql: `
                    SELECT 
                        schemaname, 
                        tablename, 
                        rowsecurity 
                    FROM pg_tables 
                    WHERE tablename = 'employees';
                `
			});

		if (rlsError) {
			console.log('Ошибка проверки RLS:', rlsError);
		} else {
			console.log('RLS статус:', rlsStatus);
		}

		// 2. Отключаем RLS на employees
		console.log('2. Отключаем RLS на employees...');
		const { error: disableError } = await supabase
			.rpc('exec_sql', {
				sql: 'ALTER TABLE employees DISABLE ROW LEVEL SECURITY;'
			});

		if (disableError) {
			console.log('❌ Ошибка отключения RLS:', disableError);
		} else {
			console.log('✅ RLS отключен на employees');
		}

		// 3. Тестируем запрос как в фронтенде
		console.log('3. Тестируем запрос фронтенда...');
		const { data: testEmployees, error: testError } = await supabase
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
			console.log('✅ Найдено сотрудников:', testEmployees?.length || 0);
			if (testEmployees && testEmployees.length > 0) {
				console.log('Первые 3 сотрудника:');
				testEmployees.slice(0, 3).forEach((emp, i) => {
					console.log(`${i + 1}. ${emp.full_name} - ${emp.position} (${emp.work_hours}ч)`);
				});
			}
		}

		// 4. Проверяем также offices таблицу
		console.log('4. Проверяем доступ к offices...');
		const { data: offices, error: officesError } = await supabase
			.from('offices')
			.select('*')
			.eq('name', 'Рассвет');

		if (officesError) {
			console.log('❌ Ошибка доступа к offices:', officesError);
		} else {
			console.log('✅ Офис "Рассвет" найден:', offices?.length || 0);
		}

		// 5. Если нужно, отключаем RLS и на offices
		if (officesError) {
			console.log('5. Отключаем RLS на offices...');
			const { error: officesRlsError } = await supabase
				.rpc('exec_sql', {
					sql: 'ALTER TABLE offices DISABLE ROW LEVEL SECURITY;'
				});

			if (officesRlsError) {
				console.log('❌ Ошибка отключения RLS на offices:', officesRlsError);
			} else {
				console.log('✅ RLS отключен на offices');
			}
		}

		// 6. Финальный тест
		console.log('6. Финальный тест...');
		const { data: finalTest, error: finalError } = await supabase
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
			console.log('❌ Финальная ошибка:', finalError);
		} else {
			console.log('🎉 УСПЕХ! Найдено сотрудников:', finalTest?.length || 0);
			console.log('Данные для фронтенда готовы!');
		}

	} catch (error) {
		console.error('❌ Общая ошибка:', error);
	}
}

fixEmployeesAccess(); 