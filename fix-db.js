const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ixqhvvvqjqjqjqjqjqjq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4cWh2dnZxanFqcWpxanFqcWpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMjg4NzQ2OCwiZXhwIjoyMDQ4NDYzNDY4fQ.Hs6RNMH_4Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixDatabase() {
	try {
		console.log('🔧 Fixing user profile...');

		// Fix user profile
		const { error: profileError } = await supabase
			.from('user_profiles')
			.update({
				full_name: 'Долгих Георгий Александрович',
				avatar_url: 'https://www.gravatar.com/avatar/d4c74594d841139328695756648b6bd6?s=200&d=identicon'
			})
			.eq('id', 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5');

		if (profileError) {
			console.error('❌ Profile update error:', profileError);
		} else {
			console.log('✅ Profile updated successfully');
		}

		// Fix employee record
		const { error: employeeError } = await supabase
			.from('employees')
			.update({
				full_name: 'Долгих Георгий Александрович'
			})
			.eq('user_id', 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5');

		if (employeeError) {
			console.error('❌ Employee update error:', employeeError);
		} else {
			console.log('✅ Employee updated successfully');
		}

		// Check leaderboard
		const { data: leaderboard, error: leaderboardError } = await supabase
			.from('employees_leaderboard')
			.select('*')
			.order('total_points', { ascending: false });

		if (leaderboardError) {
			console.error('❌ Leaderboard error:', leaderboardError);
		} else {
			console.log('✅ Leaderboard entries:', leaderboard.length);
			console.log('Top 3:', leaderboard.slice(0, 3).map(e => `${e.full_name}: ${e.total_points} points`));
		}

		// Check updated profile
		const { data: profile, error: checkError } = await supabase
			.from('user_profiles')
			.select('full_name, avatar_url')
			.eq('id', 'b50c566d-8f9c-4c6c-a2e0-7475db3ae7d5')
			.single();

		if (checkError) {
			console.error('❌ Check error:', checkError);
		} else {
			console.log('✅ Updated profile:', profile);
		}

	} catch (error) {
		console.error('❌ Script error:', error);
	}
}

fixDatabase(); 