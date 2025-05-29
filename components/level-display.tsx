"use client"

import { calculateLevel, getNextLevel } from "@/lib/game-config"
import { Progress } from "@/components/ui/progress"

interface LevelDisplayProps {
  coins: number
}

export default function LevelDisplay({ coins }: LevelDisplayProps) {
  const currentLevel = calculateLevel(coins)
  const nextLevel = getNextLevel(coins)

  const progress = nextLevel
    ? ((coins - currentLevel.minCoins) / (nextLevel.minCoins - currentLevel.minCoins)) * 100
    : 100

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{currentLevel.icon}</span>
        <div>
          <div className="font-bold text-lg">{currentLevel.name}</div>
          <div className="text-sm text-muted-foreground">Уровень {currentLevel.level}</div>
        </div>
      </div>

      {nextLevel && (
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>До следующего уровня:</span>
            <span>{nextLevel.minCoins - coins} монет</span>
          </div>
          <Progress value={progress} className="h-3 border-2 border-black" />
        </div>
      )}
    </div>
  )
}
