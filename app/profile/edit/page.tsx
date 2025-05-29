"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { authService } from "@/lib/auth"
import PixelCard from "@/components/pixel-card"
import PixelButton from "@/components/pixel-button"
import Navigation from "@/components/navigation"
import AuthGuard from "@/components/auth/auth-guard"
import { ArrowLeft, Save, User } from "lucide-react"

export default function EditProfilePage() {
  const { user, profile, refreshProfile } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [fullName, setFullName] = useState("")
  const [workSchedule, setWorkSchedule] = useState("")
  const [position, setPosition] = useState("")

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "")
      setWorkSchedule(profile.work_schedule || "")
      setPosition(profile.position || "")
    }
  }, [profile])

  const handleSave = async () => {
    if (!user || !fullName.trim() || !workSchedule) {
      toast({
        title: "Ошибка",
        description: "Заполните все обязательные поля",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const { error } = await authService.updateProfile(user.id, {
        full_name: fullName.trim(),
        work_schedule: workSchedule,
        position: position.trim() || "Сотрудник",
      })

      if (error) throw error

      await refreshProfile()

      toast({
        title: "✅ Профиль обновлен!",
        description: "Изменения успешно сохранены",
      })

      router.push("/profile")
    } catch (error) {
      console.error("Ошибка обновления профиля:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось обновить профиль",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthGuard>
      <main className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 p-4">
        <div className="container mx-auto py-6">
          <Navigation />

          <div className="flex items-center gap-4 mb-6">
            <PixelButton onClick={() => router.push("/profile")} variant="secondary">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад к профилю
            </PixelButton>
            <div className="text-white">
              <h1 className="text-4xl font-bold">✏️ Редактирование профиля</h1>
              <p className="text-xl">Обновите свои данные</p>
            </div>
          </div>

          <div className="max-w-2xl mx-auto">
            <PixelCard>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Личные данные
                </CardTitle>
                <CardDescription>
                  Измените свои данные. График работы влияет на расчет рабочего времени.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Полное имя *</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Иван Иванов"
                    className="border-2 border-black"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workSchedule">График работы *</Label>
                  <Select value={workSchedule} onValueChange={setWorkSchedule} disabled={loading}>
                    <SelectTrigger className="border-2 border-black">
                      <SelectValue placeholder="Выберите график работы" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="8+1">8 часов + 1 час обед (9 часов)</SelectItem>
                      <SelectItem value="12">12 часов</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="text-sm text-muted-foreground">
                    График влияет на расчет переработок и статистику рабочего времени
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="position">Должность</Label>
                  <Input
                    id="position"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="Сотрудник"
                    className="border-2 border-black"
                    disabled={loading}
                  />
                </div>

                <div className="flex gap-4">
                  <PixelButton onClick={handleSave} disabled={loading} className="flex-1">
                    <Save className="h-4 w-4 mr-2" />
                    {loading ? "Сохранение..." : "Сохранить изменения"}
                  </PixelButton>
                </div>
              </CardContent>
            </PixelCard>
          </div>
        </div>
      </main>
    </AuthGuard>
  )
}
