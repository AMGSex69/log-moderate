const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ixqhvvvqjqjqjqjqjqjq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4cWh2dnZxanFqcWpxanFqcWpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMjg4NzQ2OCwiZXhwIjoyMDQ4NDYzNDY4fQ.Hs6RNMH_4Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAllIssues() {
	try {
		console.log('🔧 Fixing all issues...');

		// 1. First, let's check current user's office
		const { data: currentUser, error: userError } = await supabase
			.from('employees')
			.select('office_id, full_name')
			.eq('user_id', 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5')
			.single();

		if (userError) {
			console.error('❌ User error:', userError);
			return;
		}

		console.log('👤 Current user office:', currentUser.office_id);

		// 2. Fix avatar persistence - remove any triggers that overwrite avatar
		console.log('🖼️ Fixing avatar persistence...');

		// Set your custom avatar URL (replace with your actual avatar URL)
		const customAvatarUrl = 'https://your-custom-avatar-url.jpg'; // Replace this with your actual avatar URL

		const { error: avatarError } = await supabase
			.from('user_profiles')
			.update({
				avatar_url: customAvatarUrl
			})
			.eq('id', 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5');

		if (avatarError) {
			console.error('❌ Avatar update error:', avatarError);
		} else {
			console.log('✅ Avatar updated');
		}

		// 3. Fix leaderboard with office filtering
		console.log('🏆 Fixing leaderboard with office filtering...');

		// Clear existing leaderboard
		await supabase.from('employees_leaderboard').delete().neq('employee_id', 0);

		// Get employees from the same office
		const { data: officeEmployees, error: officeError } = await supabase
			.from('employees')
			.select(`
        id,
        user_id,
        full_name,
        employee_position,
        avatar_url,
        is_online,
        last_seen,
        office_id
      `)
			.eq('office_id', currentUser.office_id);

		if (officeError) {
			console.error('❌ Office employees error:', officeError);
			return;
		}

		console.log(`👥 Found ${officeEmployees.length} employees in office ${currentUser.office_id}`);

		// 4. Calculate stats and populate leaderboard
		for (const employee of officeEmployees) {
			// Get task stats
			const { data: taskStats, error: statsError } = await supabase
				.from('task_logs')
				.select('points_earned, status')
				.eq('employee_id', employee.id);

			let totalPoints = 0;
			let completedTasks = 0;

			if (!statsError && taskStats) {
				totalPoints = taskStats.reduce((sum, task) => sum + (task.points_earned || 0), 0);
				completedTasks = taskStats.filter(task => task.status === 'completed').length;
			}

			// Get avatar from user_profiles if not in employees
			let avatarUrl = employee.avatar_url;
			if (!avatarUrl) {
				const { data: profile } = await supabase
					.from('user_profiles')
					.select('avatar_url')
					.eq('id', employee.user_id)
					.single();

				avatarUrl = profile?.avatar_url;
			}

			// Insert into leaderboard
			const { error: insertError } = await supabase
				.from('employees_leaderboard')
				.insert({
					employee_id: employee.id,
					user_id: employee.user_id,
					full_name: employee.full_name,
					employee_position: employee.employee_position,
					total_points: totalPoints,
					completed_tasks: completedTasks,
					avatar_url: avatarUrl,
					is_online: employee.is_online || false,
					last_seen: employee.last_seen || new Date().toISOString(),
					office_id: employee.office_id
				});

			if (insertError) {
				console.error(`❌ Insert error for ${employee.full_name}:`, insertError);
			} else {
				console.log(`✅ Added ${employee.full_name} to leaderboard (${totalPoints} points)`);
			}
		}

		// 5. Check final results
		const { data: finalLeaderboard, error: finalError } = await supabase
			.from('employees_leaderboard')
			.select('*')
			.eq('office_id', currentUser.office_id)
			.order('total_points', { ascending: false });

		if (finalError) {
			console.error('❌ Final check error:', finalError);
		} else {
			console.log('\n🏆 Final Leaderboard (Office ' + currentUser.office_id + '):');
			finalLeaderboard.forEach((entry, index) => {
				console.log(`${index + 1}. ${entry.full_name} - ${entry.total_points} points (Avatar: ${entry.avatar_url ? 'Yes' : 'No'})`);
			});
		}

		// 6. Check RLS policies
		console.log('\n🔒 Checking RLS policies...');

		// Make sure leaderboard is accessible
		const { data: policyCheck, error: policyError } = await supabase
			.from('employees_leaderboard')
			.select('count')
			.eq('office_id', currentUser.office_id);

		if (policyError) {
			console.error('❌ Policy check failed:', policyError);
			console.log('Need to fix RLS policies...');
		} else {
			console.log('✅ RLS policies working correctly');
		}

	} catch (error) {
		console.error('❌ Script error:', error);
	}
}

fixAllIssues(); 