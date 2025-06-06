"use client"

import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import PixelCard from "./pixel-card"
import PixelButton from "./pixel-button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

interface Office {
	id: number
	name: string
	description: string
	districts: string[]
}

interface OfficeSelectorProps {
	onOfficeSelect: (officeId: number, officeName: string) => void
	loading?: boolean
	currentOfficeId?: number | null
	showTitle?: boolean
}

export default function OfficeSelector({
	onOfficeSelect,
	loading = false,
	currentOfficeId = null,
	showTitle = true
}: OfficeSelectorProps) {
	const [offices, setOffices] = useState<Office[]>([])
	const [selectedOfficeId, setSelectedOfficeId] = useState<number | null>(currentOfficeId)
	const [isLoading, setIsLoading] = useState(true)
	const { toast } = useToast()

	useEffect(() => {
		fetchOffices()
	}, [])

	useEffect(() => {
		setSelectedOfficeId(currentOfficeId)
	}, [currentOfficeId])

	const fetchOffices = async () => {
		try {
			const { data, error } = await supabase
				.from("offices")
				.select("*")
				.order("name")

			if (error) throw error

			setOffices(data || [])
		} catch (error) {
			console.error("Ошибка загрузки офисов:", error)
			toast({
				title: "Ошибка",
				description: "Не удалось загрузить список офисов",
				variant: "destructive",
			})
		} finally {
			setIsLoading(false)
		}
	}

	const handleOfficeChange = (value: string) => {
		const officeId = parseInt(value)
		const office = offices.find(o => o.id === officeId)

		if (office) {
			setSelectedOfficeId(officeId)
			onOfficeSelect(officeId, office.name)
		}
	}

	const currentOffice = offices.find(o => o.id === selectedOfficeId)

	if (isLoading) {
		return (
			<PixelCard>
				<div className="p-6 text-center">
					<div className="text-2xl animate-spin mb-2">🏢</div>
					<div>Загрузка офисов...</div>
				</div>
			</PixelCard>
		)
	}

	return (
		<PixelCard>
			<div className="p-6">
				{showTitle && (
					<div className="text-center mb-6">
						<div className="text-4xl mb-3">🏢</div>
						<h2 className="text-2xl font-bold mb-2">Выберите офис</h2>
						<p className="text-muted-foreground">
							Офис определяет вашу команду и статистику
						</p>
					</div>
				)}

				<div className="space-y-4">
					<div>
						<label className="block text-sm font-medium mb-2">
							Офис
						</label>
						<Select value={selectedOfficeId?.toString() || ""} onValueChange={handleOfficeChange}>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Выберите ваш офис" />
							</SelectTrigger>
							<SelectContent>
								{offices.map((office) => (
									<SelectItem key={office.id} value={office.id.toString()}>
										<div className="flex flex-col gap-1">
											<span className="font-semibold">{office.name}</span>
											<span className="text-sm text-muted-foreground">
												{office.description}
											</span>
											{office.districts && office.districts.length > 0 && (
												<span className="text-xs text-muted-foreground">
													{office.districts.join(", ")}
												</span>
											)}
										</div>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{currentOffice && (
						<div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
							<div className="flex items-center gap-2 mb-1">
								<Badge variant="outline">{currentOffice.name}</Badge>
								<span className="text-sm font-medium">Выбранный офис</span>
							</div>
							<p className="text-sm text-muted-foreground mb-1">
								{currentOffice.description}
							</p>
							{currentOffice.districts && currentOffice.districts.length > 0 && (
								<p className="text-xs text-muted-foreground">
									Округа: {currentOffice.districts.join(", ")}
								</p>
							)}
						</div>
					)}

					{showTitle && (
						<PixelButton
							onClick={() => onOfficeSelect(selectedOfficeId!, currentOffice?.name || "")}
							disabled={loading || !selectedOfficeId}
							className="w-full"
						>
							{loading ? "Сохранение..." : "Продолжить"}
						</PixelButton>
					)}
				</div>
			</div>
		</PixelCard>
	)
} 