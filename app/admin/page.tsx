"use client"

import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Shield, Home } from "lucide-react"
import EnhancedDashboardV2 from "@/components/admin/enhanced-dashboard-v2"
import { supabase } from "@/lib/supabase"

export default function AdminPage() {
	// Simple redirect approach - if user doesn't have access, they'll be redirected by the component
	return (
		<div className="container mx-auto px-4 py-8">
			<Card className="mb-6">
				<CardHeader>
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<Shield className="h-5 w-5" />
							<div>
								<CardTitle>
									Панель администратора
								</CardTitle>
								<CardDescription>
									Расширенная аналитика работы сотрудников с временной шкалой
								</CardDescription>
							</div>
						</div>
						<Button
							variant="outline"
							onClick={() => window.location.href = '/'}
							className="flex items-center gap-2"
						>
							<Home className="h-4 w-4" />
							Главная
						</Button>
					</div>
				</CardHeader>
			</Card>

			<EnhancedDashboardV2 />
		</div>
	)
}
