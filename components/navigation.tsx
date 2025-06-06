"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { User, BarChart3, Gamepad2, Crown } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"

export default function Navigation() {
	const pathname = usePathname()
	const { profile } = useAuth()

	// Проверяем админские права как по старому полю is_admin, так и по новому полю role
	const isAdmin = profile?.is_admin || profile?.role === 'admin'

	return (
		<div className="mb-6 relative">
			{/* Пиксельная рамка */}
			<div className="bg-white border-4 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
				<div className="p-4 bg-gradient-to-r from-yellow-100 via-green-100 to-blue-100">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4">
							{/* Игровой логотип */}
							<div className="flex items-center gap-3">
								<div className="relative bg-yellow-300 border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
									<Gamepad2 className="h-6 w-6 text-black" />
								</div>
								<div>
									<h1 className="text-2xl font-bold text-black font-mono">
										СИСТЕМА УЧЕТА ЗАДАЧ
									</h1>
									<p className="text-black/70 text-sm font-mono font-semibold">
										🎮 GAMIFIED TASK MANAGER 🎮
									</p>
								</div>
							</div>

							{/* Админский бейдж в пиксельном стиле */}
							{isAdmin && (
								<div className="flex items-center gap-2 bg-red-300 border-2 border-black px-3 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
									<Crown className="h-4 w-4 text-black" />
									<span className="text-xs font-bold text-black font-mono">АДМИН</span>
								</div>
							)}
						</div>

						{/* Навигационные кнопки в пиксельном стиле */}
						<div className="flex items-center gap-3">
							<Button
								asChild
								className={`
									font-mono font-bold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-none
									transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]
									${pathname === "/"
										? "bg-green-300 text-black hover:bg-green-400"
										: "bg-white text-black hover:bg-gray-100"
									}
								`}
								size="sm"
							>
								<Link href="/" className="flex items-center gap-2">
									<User className="h-4 w-4" />
									РАБОЧЕЕ МЕСТО
								</Link>
							</Button>

							{isAdmin && (
								<Button
									asChild
									className={`
										font-mono font-bold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-none
										transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]
										${pathname === "/admin"
											? "bg-blue-300 text-black hover:bg-blue-400"
											: "bg-white text-black hover:bg-gray-100"
										}
									`}
									size="sm"
								>
									<Link href="/admin" className="flex items-center gap-2">
										<BarChart3 className="h-4 w-4" />
										АДМИН ПАНЕЛЬ
									</Link>
								</Button>
							)}
						</div>
					</div>

					{/* Декоративные пиксельные элементы */}
					<div className="absolute top-1 left-1 w-2 h-2 bg-yellow-400 border border-black"></div>
					<div className="absolute top-1 right-1 w-2 h-2 bg-green-400 border border-black"></div>
					<div className="absolute bottom-1 left-1 w-2 h-2 bg-blue-400 border border-black"></div>
					<div className="absolute bottom-1 right-1 w-2 h-2 bg-red-400 border border-black"></div>
				</div>
			</div>

			{/* Дополнительная тень для глубины */}
			<div className="absolute inset-0 bg-black translate-x-1 translate-y-1 -z-10 rounded-none"></div>
		</div>
	)
}
