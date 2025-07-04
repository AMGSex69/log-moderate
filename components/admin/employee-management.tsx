"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { Users, Shield, Building, Edit, Search, UserCheck, UserX, Crown, Clock } from "lucide-react"
import { notifyProfileChanged, invalidateProfileCache } from "@/lib/profile-sync"

interface Employee {
	employee_id: number
	user_id: string
	id: string
	full_name: string
	email?: string
	position: string
	office_id: number
	office_name?: string
	offices?: { name: string }
	admin_role: 'user' | 'office_admin' | 'super_admin'
	managed_office_id?: number
	is_admin: boolean
	is_online?: boolean
	last_seen?: string
	created_at: string
	work_schedule: string
	work_hours: number
}

interface Office {
	id: number
	name: string
	description?: string
}

interface AdminAccess {
	can_access: boolean
	admin_role: string
	managed_office_id?: number
	is_super_admin: boolean
	is_office_admin: boolean
}

export default function EmployeeManagement() {
	const { user } = useAuth()
	const { toast } = useToast()

	const [employees, setEmployees] = useState<Employee[]>([])
	const [offices, setOffices] = useState<Office[]>([])
	const [adminAccess, setAdminAccess] = useState<AdminAccess | null>(null)
	const [loading, setLoading] = useState(true)
	const [searchTerm, setSearchTerm] = useState("")
	const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
	const [editDialogOpen, setEditDialogOpen] = useState(false)
	const [saving, setSaving] = useState(false)

	// Форма редактирования
	const [editForm, setEditForm] = useState({
		office_id: "",
		admin_role: "",
		managed_office_id: "",
		work_schedule: ""
	})

	useEffect(() => {
		if (user) {
			checkAdminAccess()
			loadOffices()
		}
	}, [user])

	useEffect(() => {
		if (adminAccess?.can_access) {
			loadEmployees()
		}
	}, [adminAccess])

	const checkAdminAccess = async () => {
		try {
			const { data, error } = await supabase.rpc('check_admin_access_unified', {
				requesting_user_uuid: user!.id
			})

			if (error) throw error

			if (data && data.length > 0) {
				setAdminAccess(data[0])
			} else {
				setAdminAccess({ can_access: false, admin_role: 'user', is_super_admin: false, is_office_admin: false })
			}
		} catch (error) {
			console.error('Ошибка проверки прав доступа:', error)
			toast({
				title: "Ошибка",
				description: "Не удалось проверить права доступа",
				variant: "destructive"
			})
		}
	}

	const loadOffices = async () => {
		try {
			const { data, error } = await supabase
				.from('offices')
				.select('*')
				.order('name')

			if (error) throw error
			setOffices(data || [])
		} catch (error) {
			console.error('Ошибка загрузки офисов:', error)
		}
	}

	const loadEmployees = async () => {
		try {
			setLoading(true)
			const { data, error } = await supabase
				.from('user_profiles')
				.select(`
				*,
				offices!user_profiles_office_id_fkey(name)
			`)
				.not('employee_id', 'is', null) // Получаем всех пользователей с employee_id

			if (error) throw error

			// Обрабатываем данные для корректного отображения
			const processedEmployees = (data || []).map(emp => ({
				...emp,
				user_id: emp.id,
				office_name: emp.offices?.name || 'Не указан',
				email: emp.id.substring(0, 8) + '...' // Показываем короткий ID
			}))

			setEmployees(processedEmployees)
		} catch (error) {
			console.error('Ошибка загрузки сотрудников:', error)
			toast({
				title: "Ошибка",
				description: "Не удалось загрузить список сотрудников",
				variant: "destructive"
			})
		} finally {
			setLoading(false)
		}
	}

	const handleEditEmployee = (employee: Employee) => {
		setSelectedEmployee(employee)
		setEditForm({
			office_id: employee.office_id.toString(),
			admin_role: employee.admin_role,
			managed_office_id: employee.managed_office_id?.toString() || "",
			work_schedule: employee.work_schedule || "5/2"
		})
		setEditDialogOpen(true)
	}

	const handleSaveChanges = async () => {
		if (!selectedEmployee) return

		try {
			setSaving(true)

			// Проверяем, что у сотрудника есть корректный user_id
			if (!selectedEmployee.user_id) {
				throw new Error('У сотрудника отсутствует корректный user_id')
			}

			console.log('🔄 Обновление сотрудника:', {
				target_user_id: selectedEmployee.user_id,
				employee_name: selectedEmployee.full_name,
				changes: editForm
			})

			// Сохраняем старый офис для сравнения
			const oldOfficeId = selectedEmployee.office_id
			const newOfficeId = editForm.office_id ? parseInt(editForm.office_id) : null

			const { data, error } = await supabase.rpc('update_employee_permissions_with_schedule', {
				requesting_user_uuid: user!.id,
				target_user_uuid: selectedEmployee.user_id,
				new_office_id: newOfficeId,
				new_admin_role: editForm.admin_role || null,
				new_managed_office_id: editForm.managed_office_id ? parseInt(editForm.managed_office_id) : null,
				new_work_schedule: adminAccess?.is_super_admin ? (editForm.work_schedule || null) : null
			})

			if (error) {
				console.error('❌ Ошибка обновления сотрудника:', error)
				throw error
			}

			console.log('✅ Сотрудник обновлён успешно:', data)

			// Уведомляем систему об изменении профиля
			const changes: any = {}
			if (newOfficeId !== null) changes.office_id = newOfficeId
			if (editForm.admin_role) changes.admin_role = editForm.admin_role
			if (editForm.work_schedule) changes.work_schedule = editForm.work_schedule
			if (editForm.managed_office_id) changes.managed_office_id = parseInt(editForm.managed_office_id)

			// Вычисляем work_hours на основе графика
			if (editForm.work_schedule) {
				changes.work_hours = editForm.work_schedule === '2/2' ? 12 : 9
			}

			console.log('📡 [АДМИНКА] Уведомляем об изменении профиля:', {
				userId: selectedEmployee.user_id,
				changes
			})

			// Очищаем кеш профиля
			invalidateProfileCache(selectedEmployee.user_id)

			// Уведомляем о изменении профиля
			notifyProfileChanged(selectedEmployee.user_id, changes)

			// Если изменился офис, уведомляем систему о необходимости обновления (legacy)
			if (newOfficeId && newOfficeId !== oldOfficeId) {
				console.log("🏢 [АДМИНКА] Офис изменён с", oldOfficeId, "на", newOfficeId)

				// Создаем кастомное событие для уведомления других компонентов
				const officeChangeEvent = new CustomEvent('officeChanged', {
					detail: {
						userId: selectedEmployee.user_id,
						oldOfficeId: oldOfficeId,
						newOfficeId: newOfficeId,
						timestamp: new Date().toISOString()
					}
				})

				// Отправляем событие в DOM
				window.dispatchEvent(officeChangeEvent)

				console.log("📡 [АДМИНКА] Событие officeChanged отправлено")
			}

			toast({
				title: "Успешно",
				description: "Права сотрудника обновлены"
			})

			setEditDialogOpen(false)
			loadEmployees() // Перезагружаем список
		} catch (error: any) {
			console.error('Ошибка обновления прав:', error)
			toast({
				title: "Ошибка",
				description: error.message || "Не удалось обновить права сотрудника",
				variant: "destructive"
			})
		} finally {
			setSaving(false)
		}
	}

	const getRoleBadge = (role: string) => {
		switch (role) {
			case 'super_admin':
				return <Badge variant="destructive" className="gap-1"><Crown className="h-3 w-3" />Супер-админ</Badge>
			case 'office_admin':
				return <Badge variant="secondary" className="gap-1"><Shield className="h-3 w-3" />Офис-админ</Badge>
			default:
				return <Badge variant="outline" className="gap-1"><Users className="h-3 w-3" />Сотрудник</Badge>
		}
	}

	const getStatusBadge = (isOnline: boolean) => {
		return isOnline ? (
			<Badge variant="default" className="gap-1 bg-green-500">
				<UserCheck className="h-3 w-3" />Онлайн
			</Badge>
		) : (
			<Badge variant="outline" className="gap-1">
				<UserX className="h-3 w-3" />Оффлайн
			</Badge>
		)
	}

	const filteredEmployees = employees.filter(emp =>
		emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
		(emp.email && emp.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
		((emp.office_name || emp.offices?.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
	)

	if (loading) {
		return (
			<Card>
				<CardContent className="p-6">
					<div className="text-center">
						<div className="text-lg">Загрузка...</div>
					</div>
				</CardContent>
			</Card>
		)
	}

	if (!adminAccess?.can_access) {
		return (
			<Card>
				<CardContent className="p-6">
					<div className="text-center">
						<Shield className="h-12 w-12 mx-auto mb-4 text-gray-400" />
						<div className="text-lg font-semibold">Доступ запрещен</div>
						<div className="text-gray-600">У вас нет прав для управления сотрудниками</div>
					</div>
				</CardContent>
			</Card>
		)
	}

	return (
		<div className="space-y-6">
			{/* Заголовок */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Users className="h-5 w-5" />
						Управление сотрудниками
						{adminAccess.is_super_admin && (
							<Badge variant="destructive" className="ml-2">
								<Crown className="h-3 w-3 mr-1" />
								Супер-админ
							</Badge>
						)}
						{adminAccess.is_office_admin && (
							<Badge variant="secondary" className="ml-2">
								<Building className="h-3 w-3 mr-1" />
								Офис-админ
							</Badge>
						)}
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex items-center gap-4 mb-4">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
							<Input
								placeholder="Поиск по имени, email или офису..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="pl-10"
							/>
						</div>
						<div className="text-sm text-gray-600">
							Найдено: {filteredEmployees.length} из {employees.length}
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Таблица сотрудников */}
			<Card>
				<CardContent className="p-0">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Сотрудник</TableHead>
								<TableHead>ID пользователя</TableHead>
								<TableHead>Должность</TableHead>
								<TableHead>Офис</TableHead>
								<TableHead>График</TableHead>
								<TableHead>Роль</TableHead>
								<TableHead>Статус</TableHead>
								<TableHead>Действия</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{filteredEmployees.map((employee, index) => (
								<TableRow key={employee.user_id || `employee-${employee.employee_id}-${index}`}>
									<TableCell className="font-medium">
										{employee.full_name || 'Без имени'}
									</TableCell>
									<TableCell>{employee.email}</TableCell>
									<TableCell>{employee.position}</TableCell>
									<TableCell>
										<Badge variant="outline" className="gap-1">
											<Building className="h-3 w-3" />
											{employee.office_name || employee.offices?.name || 'Не указан'}
										</Badge>
									</TableCell>
									<TableCell>
										<Badge variant={employee.work_schedule === '2/2' ? 'default' : 'secondary'} className="gap-1">
											<Clock className="h-3 w-3" />
											{employee.work_schedule} ({employee.work_hours}ч)
										</Badge>
									</TableCell>
									<TableCell>
										{getRoleBadge(employee.admin_role)}
									</TableCell>
									<TableCell>
										{getStatusBadge(employee.is_online || false)}
									</TableCell>
									<TableCell>
										<Button
											variant="outline"
											size="sm"
											onClick={() => handleEditEmployee(employee)}
											className="gap-1"
										>
											<Edit className="h-3 w-3" />
											Изменить
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>

					{filteredEmployees.length === 0 && (
						<div className="text-center py-8">
							<Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
							<div className="text-lg font-semibold">Сотрудники не найдены</div>
							<div className="text-gray-600">Попробуйте изменить критерии поиска</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Диалог редактирования */}
			<Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
				<DialogContent className="sm:max-w-md" aria-describedby="edit-employee-description">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Edit className="h-5 w-5" />
							Редактирование сотрудника
						</DialogTitle>
					</DialogHeader>
					<div id="edit-employee-description" className="sr-only">
						Форма редактирования данных сотрудника, включая офис, роль администратора и график работы
					</div>

					{selectedEmployee && (
						<div className="space-y-4">
							<div>
								<Label className="text-sm font-medium">Сотрудник</Label>
								<div className="text-lg font-semibold">{selectedEmployee.full_name}</div>
								<div className="text-sm text-gray-600">{selectedEmployee.email}</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="office">Офис</Label>
								<Select value={editForm.office_id} onValueChange={(value) => setEditForm(prev => ({ ...prev, office_id: value }))}>
									<SelectTrigger>
										<SelectValue placeholder="Выберите офис" />
									</SelectTrigger>
									<SelectContent>
										{offices.map((office) => (
											<SelectItem key={`office-${office.id}`} value={office.id.toString()}>
												{office.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<Label htmlFor="role">Роль администратора</Label>
								<Select value={editForm.admin_role} onValueChange={(value) => setEditForm(prev => ({ ...prev, admin_role: value }))}>
									<SelectTrigger>
										<SelectValue placeholder="Выберите роль" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="user">Сотрудник</SelectItem>
										<SelectItem value="office_admin">Офис-админ</SelectItem>
										{adminAccess?.is_super_admin && (
											<SelectItem value="super_admin">Супер-админ</SelectItem>
										)}
									</SelectContent>
								</Select>
							</div>

							{editForm.admin_role === 'office_admin' && (
								<div className="space-y-2">
									<Label htmlFor="managed_office">Управляемый офис</Label>
									<Select value={editForm.managed_office_id} onValueChange={(value) => setEditForm(prev => ({ ...prev, managed_office_id: value }))}>
										<SelectTrigger>
											<SelectValue placeholder="Выберите офис для управления" />
										</SelectTrigger>
										<SelectContent>
											{offices.map((office) => (
												<SelectItem key={`managed-office-${office.id}`} value={office.id.toString()}>
													{office.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							)}

							{adminAccess?.is_super_admin && (
								<div className="space-y-2">
									<Label htmlFor="work_schedule">График работы</Label>
									<Select value={editForm.work_schedule} onValueChange={(value) => setEditForm(prev => ({ ...prev, work_schedule: value }))}>
										<SelectTrigger>
											<SelectValue placeholder="Выберите график работы" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="5/2">5/2 - 9 часов (8 работы + 1 час обед)</SelectItem>
											<SelectItem value="2/2">2/2 - 12 часов (11 работы + 1 час обед)</SelectItem>
										</SelectContent>
									</Select>
									<div className="text-xs text-gray-500">
										Только супер-админ может изменять график работы
									</div>
								</div>
							)}

							<div className="flex justify-end gap-2 pt-4">
								<Button variant="outline" onClick={() => setEditDialogOpen(false)}>
									Отмена
								</Button>
								<Button onClick={handleSaveChanges} disabled={saving}>
									{saving ? "Сохранение..." : "Сохранить"}
								</Button>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</div>
	)
} 