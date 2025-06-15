const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ixqhvvvqjqjqjqjqjqjq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4cWh2dnZxanFqcWpxanFqcWpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMjg4NzQ2OCwiZXhwIjoyMDQ4NDYzNDY4fQ.Hs6RNMH_4Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkResults() {
	try {
		console.log('🔍 Checking current state...');

		// Check user profile
		const { data: profile, error: profileError } = await supabase
			.from('user_profiles')
			.select('full_name, avatar_url')
			.eq('id', 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5')
			.single();

		console.log('👤 User Profile:', profile);
		if (profileError) console.error('Profile error:', profileError);

		// Check employee record
		const { data: employee, error: employeeError } = await supabase
			.from('employees')
			.select('full_name, avatar_url')
			.eq('user_id', 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5')
			.single();

		console.log('👷 Employee Record:', employee);
		if (employeeError) console.error('Employee error:', employeeError);

		// Check leaderboard
		const { data: leaderboard, error: leaderboardError } = await supabase
			.from('employees_leaderboard')
			.select('*')
			.order('total_points', { ascending: false })
			.limit(5);

		console.log('🏆 Leaderboard (Top 5):');
		if (leaderboardError) {
			console.error('Leaderboard error:', leaderboardError);
		} else {
			leaderboard.forEach((entry, index) => {
				console.log(`${index + 1}. ${entry.full_name} - ${entry.total_points} points (Avatar: ${entry.avatar_url ? 'Yes' : 'No'})`);
			});
		}

		// Check specific user in leaderboard
		const { data: userInLeaderboard, error: userLeaderboardError } = await supabase
			.from('employees_leaderboard')
			.select('*')
			.eq('user_id', 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5')
			.single();

		console.log('🎯 User in Leaderboard:', userInLeaderboard);
		if (userLeaderboardError) console.error('User leaderboard error:', userLeaderboardError);

	} catch (error) {
		console.error('❌ Check error:', error);
	}
}

checkResults(); 