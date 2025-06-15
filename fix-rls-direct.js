const { createClient } = require('@supabase/supabase-js');

// Используем anon key вместо service key
const supabaseUrl = 'https://ixqjqjqjqjqjqjqjqjqj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4cWpxanFqcWpxanFqcWpxanFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQzNDcxOTEsImV4cCI6MjA0OTkyMzE5MX0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testEmployeesAccess() {
	console.log('🔧 Тестируем доступ к employees с anon key...');

	try {
		// 1. Тестируем прямой запрос к employees
		console.log('1. Тестируем прямой запрос к employees...');
		const { data: employees, error: employeesError } = await supabase
			.from('employees')
			.select('*')
			.limit(5);

		if (employeesError) {
			console.log('❌ Ошибка доступа к employees:', employeesError);
		} else {
			console.log('✅ Доступ к employees работает, найдено записей:', employees?.length || 0);
		}

		// 2. Тестируем запрос с JOIN как в фронтенде
		console.log('2. Тестируем запрос с JOIN...');
		const { data: joinData, error: joinError } = await supabase
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
			.eq('is_active', true)
			.limit(5);

		if (joinError) {
			console.log('❌ Ошибка JOIN запроса:', joinError);
		} else {
			console.log('✅ JOIN запрос работает, найдено записей:', joinData?.length || 0);
			if (joinData && joinData.length > 0) {
				console.log('Первая запись:', joinData[0]);
			}
		}

		// 3. Тестируем фильтр по офису
		console.log('3. Тестируем фильтр по офису "Рассвет"...');
		const { data: officeData, error: officeError } = await supabase
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

		if (officeError) {
			console.log('❌ Ошибка фильтра по офису:', officeError);
		} else {
			console.log('✅ Фильтр по офису работает, найдено записей:', officeData?.length || 0);
			if (officeData && officeData.length > 0) {
				console.log('Сотрудники офиса "Рассвет":');
				officeData.forEach((emp, i) => {
					console.log(`${i + 1}. ${emp.full_name} - ${emp.position}`);
				});
			}
		}

		// 4. Проверяем offices отдельно
		console.log('4. Проверяем доступ к offices...');
		const { data: offices, error: officesError } = await supabase
			.from('offices')
			.select('*');

		if (officesError) {
			console.log('❌ Ошибка доступа к offices:', officesError);
		} else {
			console.log('✅ Доступ к offices работает, найдено записей:', offices?.length || 0);
			const rassveet = offices?.find(o => o.name === 'Рассвет');
			if (rassveet) {
				console.log('Офис "Рассвет" найден:', rassveet);
			}
		}

	} catch (error) {
		console.error('❌ Общая ошибка:', error);
	}
}

testEmployeesAccess(); 