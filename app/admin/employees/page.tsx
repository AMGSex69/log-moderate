"use client"

import { Suspense } from "react"
import Navigation from "@/components/navigation"
import AuthGuard from "@/components/auth/auth-guard"
import EmployeeManagement from "@/components/admin/employee-management"

export default function AdminEmployeesPage() {
	return (
		<AuthGuard>
			<main className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 p-4">
				<div className="container mx-auto py-6">
					<Navigation />

					<div className="mt-6">
						<Suspense fallback={
							<div className="text-center py-8">
								<div className="text-white text-lg">Загрузка...</div>
							</div>
						}>
							<EmployeeManagement />
						</Suspense>
					</div>
				</div>
			</main>
		</AuthGuard>
	)
} 