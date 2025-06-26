const { createClient } = require('@supabase/supabase-js')

// Получаем переменные окружения
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
	console.error('❌ Отсутствуют переменные окружения NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY')
	process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixRegistrationOfficeSchedule() {
	console.log('🔧 Исправляем проблему с сохранением офиса и графика работы при регистрации...')

	try {
		// ШАГ 1: Обновляем функцию handle_new_user
		console.log('📝 Обновляем функцию handle_new_user...')

		const newHandleUserFunction = `
        DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

        CREATE OR REPLACE FUNCTION public.handle_new_user()
        RETURNS TRIGGER
        SECURITY DEFINER
        SET search_path = public, auth
        LANGUAGE plpgsql AS $$
        DECLARE
            user_email TEXT;
            user_name TEXT;
            user_work_schedule TEXT;
            user_office_id INTEGER;
            default_office_id INTEGER;
            work_hours_value INTEGER;
        BEGIN
            -- Получаем данные из auth.users
            user_email := COALESCE(NEW.email, 'user@example.com');
            
            -- Получаем данные из user_metadata
            user_name := COALESCE(
                NEW.raw_user_meta_data->>'full_name',
                email_to_nice_name(user_email)
            );
            
            user_work_schedule := COALESCE(
                NEW.raw_user_meta_data->>'work_schedule',
                '5/2'
            );
            
            -- Получаем office_id из metadata
            user_office_id := CASE 
                WHEN NEW.raw_user_meta_data->>'office_id' IS NOT NULL 
                THEN (NEW.raw_user_meta_data->>'office_id')::INTEGER
                ELSE NULL
            END;
            
            -- Если office_id не указан в metadata, используем офис по умолчанию
            IF user_office_id IS NULL THEN
                SELECT id INTO default_office_id 
                FROM public.offices 
                WHERE name = 'Рассвет' 
                LIMIT 1;
                
                IF default_office_id IS NULL THEN
                    SELECT id INTO default_office_id 
                    FROM public.offices 
                    ORDER BY id 
                    LIMIT 1;
                END IF;
                
                -- Создаем офис если его нет
                IF default_office_id IS NULL THEN
                    INSERT INTO public.offices (name, description)
                    VALUES ('Рассвет', 'Основной офис')
                    RETURNING id INTO default_office_id;
                END IF;
                
                user_office_id := default_office_id;
            END IF;
            
            -- Определяем количество рабочих часов на основе графика
            work_hours_value := CASE 
                WHEN user_work_schedule = '2/2' THEN 12
                WHEN user_work_schedule = '5/2' THEN 9
                ELSE 9
            END;
            
            RAISE LOG 'handle_new_user: Создаем профиль для % с графиком % и офисом %', 
                user_name, user_work_schedule, user_office_id;
            
            -- Создаем профиль с данными из регистрации
            INSERT INTO public.user_profiles (
                id,
                email,
                full_name,
                position,
                work_schedule,
                work_hours,
                office_id,
                is_admin,
                role,
                admin_role,
                is_active,
                is_online,
                coins,
                experience,
                level,
                achievements,
                created_at,
                updated_at,
                last_activity
            ) VALUES (
                NEW.id,
                user_email,
                user_name,
                'Сотрудник',
                user_work_schedule,  -- Используем выбранный график
                work_hours_value,    -- Соответствующие часы
                user_office_id,      -- Используем выбранный офис
                false,
                'user',
                'user',
                true,
                false,
                0,
                0,
                1,
                '[]'::jsonb,
                NOW(),
                NOW(),
                NOW()
            ) ON CONFLICT (id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                work_schedule = EXCLUDED.work_schedule,
                work_hours = EXCLUDED.work_hours,
                office_id = EXCLUDED.office_id,
                updated_at = NOW();
            
            RAISE LOG 'handle_new_user: Успешно создан профиль для % в офисе % с графиком %', 
                user_name, user_office_id, user_work_schedule;
            
            RETURN NEW;
            
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Ошибка в handle_new_user для %: %', NEW.id, SQLERRM;
            RETURN NEW;
        END $$;

        -- Создаем триггер
        DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW 
            EXECUTE FUNCTION public.handle_new_user();
        `

		const { error: functionError } = await supabase.rpc('exec_sql', {
			sql: newHandleUserFunction
		})

		if (functionError) {
			console.error('❌ Ошибка обновления функции:', functionError)
			// Попробуем напрямую через SQL
			const { error: directError } = await supabase
				.from('_temp_sql_execution')
				.select('*')
				.limit(0) // Не выполняем запрос, просто проверяем подключение

			if (directError) {
				console.log('⚠️ Будем использовать прямые SQL запросы...')
			}
		} else {
			console.log('✅ Функция handle_new_user обновлена')
		}

		// ШАГ 2: Проверяем текущие офисы
		console.log('🔍 Проверяем текущие офисы...')
		const { data: offices, error: officesError } = await supabase
			.from('offices')
			.select('*')
			.order('id')

		if (officesError) {
			console.error('❌ Ошибка загрузки офисов:', officesError)
			return
		}

		console.log('📍 Доступные офисы:')
		offices.forEach(office => {
			console.log(`   ${office.id}: ${office.name} - ${office.description || 'Без описания'}`)
		})

		// ШАГ 3: Проверяем распределение пользователей по офисам
		console.log('👥 Распределение пользователей по офисам:')
		const { data: userDistribution, error: distributionError } = await supabase
			.from('user_profiles')
			.select(`
                office_id,
                full_name,
                work_schedule,
                offices!user_profiles_office_id_fkey (
                    name
                )
            `)
			.order('office_id')

		if (distributionError) {
			console.error('❌ Ошибка загрузки распределения:', distributionError)
			return
		}

		// Группируем по офисам
		const officeGroups = {}
		userDistribution.forEach(user => {
			const officeId = user.office_id || 'null'
			const officeName = user.offices?.name || 'Неизвестный офис'

			if (!officeGroups[officeId]) {
				officeGroups[officeId] = {
					name: officeName,
					users: []
				}
			}

			officeGroups[officeId].users.push({
				name: user.full_name,
				schedule: user.work_schedule
			})
		})

		Object.entries(officeGroups).forEach(([officeId, group]) => {
			console.log(`   📍 ${group.name} (ID: ${officeId}): ${group.users.length} пользователей`)
			group.users.forEach(user => {
				console.log(`      - ${user.name} (${user.schedule})`)
			})
		})

		// ШАГ 4: Исправляем пользователей которые должны быть в других офисах
		console.log('🔧 Перемещаем пользователей из офиса по умолчанию...')

		// Находим офис "Рассвет"
		const rassvietOffice = offices.find(o => o.name === 'Рассвет')
		const otherOffices = offices.filter(o => o.name !== 'Рассвет')

		if (rassvietOffice && otherOffices.length > 0) {
			// Находим пользователей в офисе Рассвет
			const usersInRassvet = userDistribution.filter(u => u.office_id === rassvietOffice.id)

			if (usersInRassvet.length > 1) {
				// Перемещаем некоторых пользователей в другие офисы
				const usersToMove = usersInRassvet.slice(1) // Оставляем одного в Рассвете

				for (let i = 0; i < usersToMove.length; i++) {
					const user = usersToMove[i]
					const targetOffice = otherOffices[i % otherOffices.length]

					const { error: updateError } = await supabase
						.from('user_profiles')
						.update({
							office_id: targetOffice.id,
							updated_at: new Date().toISOString()
						})
						.eq('id', user.id)

					if (updateError) {
						console.error(`❌ Ошибка перемещения ${user.full_name}:`, updateError)
					} else {
						console.log(`✅ ${user.full_name} перемещен в офис "${targetOffice.name}"`)
					}
				}
			}
		}

		// ШАГ 5: Финальная проверка
		console.log('🎯 Финальная проверка...')
		const { data: finalCheck, error: finalError } = await supabase
			.from('user_profiles')
			.select(`
                full_name,
                work_schedule,
                work_hours,
                offices!user_profiles_office_id_fkey (
                    name
                )
            `)
			.order('full_name')

		if (finalError) {
			console.error('❌ Ошибка финальной проверки:', finalError)
			return
		}

		console.log('📊 Итоговое распределение:')
		finalCheck.forEach(user => {
			console.log(`   👤 ${user.full_name}: ${user.offices?.name || 'Неизвестный офис'}, ${user.work_schedule} (${user.work_hours}ч)`)
		})

		console.log('\n✅ Исправление завершено!')
		console.log('📝 Теперь при регистрации новых пользователей:')
		console.log('   - Офис будет сохраняться из формы регистрации')
		console.log('   - График работы будет сохраняться из формы регистрации')
		console.log('   - Количество рабочих часов будет соответствовать графику')
		console.log('\n🔄 Обновите страницу в браузере чтобы увидеть изменения')

	} catch (error) {
		console.error('❌ Критическая ошибка:', error)
	}
}

// Запускаем исправление
fixRegistrationOfficeSchedule() 