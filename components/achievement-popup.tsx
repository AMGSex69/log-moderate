"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"

interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  reward: number
}

interface AchievementPopupProps {
  achievement: Achievement | null
  onClose: () => void
}

export default function AchievementPopup({ achievement, onClose }: AchievementPopupProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (achievement) {
      setIsVisible(true)

      // Автозакрытие через 4 секунды
      const autoCloseTimer = setTimeout(() => {
        handleClose()
      }, 4000)

      return () => clearTimeout(autoCloseTimer)
    }
  }, [achievement])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 300) // Ждем завершения анимации
  }

  const handleClick = () => {
    // Закрываем при клике
    handleClose()
  }

  if (!achievement) return null

  return (
    <div
      className={`fixed top-4 right-4 z-50 transition-all duration-300 cursor-pointer ${
        isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
      }`}
      onClick={handleClick}
    >
      <Card className="border-4 border-yellow-400 bg-gradient-to-br from-yellow-100 to-orange-100 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] animate-bounce hover:animate-pulse">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{achievement.icon}</span>
            <div>
              <div className="font-bold text-lg">🎉 Достижение получено!</div>
              <div className="font-semibold">{achievement.name}</div>
              <div className="text-sm text-muted-foreground">{achievement.description}</div>
              {achievement.reward > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <span>🪙</span>
                  <span className="font-bold text-yellow-600">+{achievement.reward}</span>
                </div>
              )}
              <div className="text-xs text-gray-500 mt-2">👆 Нажмите чтобы закрыть</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
