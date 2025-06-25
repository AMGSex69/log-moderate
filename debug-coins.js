// Диагностика монет и уровней в Task Logger
// Запустить в консоли браузера на странице приложения

console.log("🔍 Начинаем диагностику монет и уровней...");

// Функция для получения данных из Supabase
async function debugCoinsCalculation() {
	try {
		// 1. Проверяем текущего пользователя
		console.log("👤 Проверяем текущего пользователя...");
		const { data: { user }, error: userError } = await supabase.auth.getUser();

		if (userError || !user) {
			console.error("❌ Пользователь не найден:", userError);
			return;
		}

		console.log("✅ Пользователь найден:", { id: user.id, email: user.email });

		// 2. Получаем профиль пользователя
		console.log("📋 Получаем профиль пользователя...");
		const { data: profile, error: profileError } = await supabase
			.from("user_profiles")
			.select("*")
			.eq("id", user.id)
			.single();

		if (profileError) {
			console.error("❌ Ошибка получения профиля:", profileError);
			return;
		}

		console.log("✅ Профиль пользователя:", profile);

		if (!profile.employee_id) {
			console.warn("⚠️ У пользователя нет employee_id!");
			return;
		}

		// 3. Проверяем task_logs для этого employee_id
		console.log(`🔍 Ищем задачи для employee_id: ${profile.employee_id}...`);
		const { data: taskLogs, error: logsError } = await supabase
			.from("task_logs")
			.select(`
                id,
                employee_id,
                task_type_id,
                units_completed,
                time_spent_minutes,
                work_date,
                task_types!inner(name)
            `)
			.eq("employee_id", profile.employee_id);

		if (logsError) {
			console.error("❌ Ошибка получения задач:", logsError);
			return;
		}

		console.log(`✅ Найдено задач: ${taskLogs?.length || 0}`);

		if (!taskLogs || taskLogs.length === 0) {
			console.warn("⚠️ Задачи не найдены для данного пользователя");
			console.log("🔍 Проверим, есть ли задачи с другими employee_id...");

			// Проверяем все задачи
			const { data: allLogs, error: allLogsError } = await supabase
				.from("task_logs")
				.select("employee_id, COUNT(*)")
				.group("employee_id");

			if (!allLogsError && allLogs) {
				console.log("📊 Все employee_id в task_logs:", allLogs);
			}

			return;
		}

		// 4. Рассчитываем монеты
		console.log("💰 Рассчитываем монеты...");
		let totalCoins = 0;
		const taskBreakdown = [];

		// Получаем конфигурацию наград (если доступна)
		const TASK_REWARDS = {
			'Актуализация ОСС': 15,
			'Обзвоны по рисовке': 10,
			'Отчеты физикам (+почта)': 12,
			'Протоколы ОСС': 25,
			'Внесение решений МЖИ (кол-во бланков)': 5,
			'Обходы': 25,
			// Добавляем другие задачи...
		};

		taskLogs.forEach(log => {
			const taskName = log.task_types.name;
			const coinsPerUnit = TASK_REWARDS[taskName] || 5; // базовая ставка
			const taskCoins = log.units_completed * coinsPerUnit;
			totalCoins += taskCoins;

			taskBreakdown.push({
				taskName,
				units: log.units_completed,
				coinsPerUnit,
				totalCoins: taskCoins,
				date: log.work_date
			});
		});

		console.log("💰 Итоговые монеты:", totalCoins);
		console.log("📊 Разбивка по задачам:", taskBreakdown);

		// 5. Проверяем, что показывает приложение
		console.log("🖥️ Проверяем отображение в приложении...");

		// Ищем элементы с монетами на странице
		const coinElements = document.querySelectorAll('[class*="coin"], [class*="Coin"]');
		console.log("🪙 Найденные элементы с монетами:", coinElements);

		coinElements.forEach((el, index) => {
			console.log(`Элемент ${index + 1}:`, el.textContent, el);
		});

		// 6. Результат диагностики
		console.log("📋 РЕЗУЛЬТАТ ДИАГНОСТИКИ:");
		console.log(`👤 Пользователь: ${profile.full_name} (employee_id: ${profile.employee_id})`);
		console.log(`📊 Задач в базе: ${taskLogs.length}`);
		console.log(`💰 Рассчитанные монеты: ${totalCoins}`);
		console.log(`🎯 Уникальных типов задач: ${new Set(taskLogs.map(log => log.task_types.name)).size}`);

		return {
			user,
			profile,
			taskLogs,
			totalCoins,
			taskBreakdown
		};

	} catch (error) {
		console.error("❌ Критическая ошибка диагностики:", error);
	}
}

// Автоматически запускаем диагностику
debugCoinsCalculation().then(result => {
	if (result) {
		console.log("✅ Диагностика завершена успешно");
		window.debugResult = result; // Сохраняем результат для дальнейшего анализа
	}
}); 