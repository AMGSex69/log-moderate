"use client"

import { useState, useEffect } from "react"
import { Gift, Coins, Check, Trash2 } from "lucide-react"
import PixelCard from "./pixel-card"
import PixelButton from "./pixel-button"
import PrizeWheel, { type Prize } from "./prize-wheel"
import CoinDisplay from "./coin-display"
import { authService } from "@/lib/auth"
import { useAuth } from "@/hooks/use-auth"

interface PrizeShopProps {
  currentCoins: number
  onCoinsSpent: (amount: number) => void
}

interface WonPrize extends Prize {
  wonAt: string
}

const WHEEL_COST = 1000

export default function PrizeShop({ currentCoins, onCoinsSpent }: PrizeShopProps) {
  const { user } = useAuth()
  const [isWheelOpen, setIsWheelOpen] = useState(false)
  const [wonPrizes, setWonPrizes] = useState<WonPrize[]>([])
  const [lastPrize, setLastPrize] = useState<Prize | null>(null)
  const [loading, setLoading] = useState(true)

  const canSpin = currentCoins >= WHEEL_COST
  const possibleSpins = Math.floor(currentCoins / WHEEL_COST)

  // Загружаем призы при монтировании компонента
  useEffect(() => {
    if (user) {
      loadWonPrizes()
    }
  }, [user])

  const loadWonPrizes = async () => {
    if (!user) return

    try {
      const { employeeId, error: empError } = await authService.getEmployeeId(user.id)
      if (empError || !employeeId) return

      // Загружаем только НЕвыданные призы из localStorage
      const savedPrizes = localStorage.getItem(`prizes_${employeeId}`)
      if (savedPrizes) {
        const prizes = JSON.parse(savedPrizes)
        setWonPrizes(prizes)
        if (prizes.length > 0) {
          setLastPrize(prizes[prizes.length - 1])
        }
      }
    } catch (error) {
      console.error("Ошибка загрузки призов:", error)
    } finally {
      setLoading(false)
    }
  }

  const savePrizeToStorage = async (prize: Prize) => {
    if (!user) return

    try {
      const { employeeId, error: empError } = await authService.getEmployeeId(user.id)
      if (empError || !employeeId) return

      const newPrize: WonPrize = {
        ...prize,
        wonAt: new Date().toISOString(),
      }
      const newPrizes = [...wonPrizes, newPrize]
      localStorage.setItem(`prizes_${employeeId}`, JSON.stringify(newPrizes))
      setWonPrizes(newPrizes)
    } catch (error) {
      console.error("Ошибка сохранения приза:", error)
    }
  }

  const markPrizeAsDelivered = async (prizeIndex: number) => {
    if (!user) return

    try {
      const { employeeId, error: empError } = await authService.getEmployeeId(user.id)
      if (empError || !employeeId) return

      // Просто удаляем приз из списка (считаем выданным)
      const updatedPrizes = wonPrizes.filter((_, index) => index !== prizeIndex)

      localStorage.setItem(`prizes_${employeeId}`, JSON.stringify(updatedPrizes))
      setWonPrizes(updatedPrizes)

      // Обновляем последний приз
      if (updatedPrizes.length > 0) {
        setLastPrize(updatedPrizes[updatedPrizes.length - 1])
      } else {
        setLastPrize(null)
      }
    } catch (error) {
      console.error("Ошибка обновления приза:", error)
    }
  }

  const deletePrize = async (prizeIndex: number) => {
    if (!user) return

    try {
      const { employeeId, error: empError } = await authService.getEmployeeId(user.id)
      if (empError || !employeeId) return

      const updatedPrizes = wonPrizes.filter((_, index) => index !== prizeIndex)

      localStorage.setItem(`prizes_${employeeId}`, JSON.stringify(updatedPrizes))
      setWonPrizes(updatedPrizes)

      // Обновляем последний приз
      if (updatedPrizes.length > 0) {
        setLastPrize(updatedPrizes[updatedPrizes.length - 1])
      } else {
        setLastPrize(null)
      }
    } catch (error) {
      console.error("Ошибка удаления приза:", error)
    }
  }

  const handleSpinWheel = () => {
    if (!canSpin) return
    setIsWheelOpen(true)
  }

  const handlePrizeWon = async (prize: Prize) => {
    setLastPrize(prize)
    await savePrizeToStorage(prize)
    onCoinsSpent(WHEEL_COST)
  }

  const handleCloseWheel = () => {
    setIsWheelOpen(false)
  }

  if (loading) {
    return (
      <PixelCard>
        <div className="p-8 text-center">
          <div className="text-4xl animate-bounce mb-4">🎰</div>
          <div className="text-xl font-bold">Загрузка магазина...</div>
        </div>
      </PixelCard>
    )
  }

  return (
    <div className="space-y-6">
      {/* Магазин призов */}
      <PixelCard className="bg-gradient-to-r from-purple-200 to-pink-200">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Gift className="h-8 w-8 text-purple-600" />
              <div>
                <h2 className="text-2xl font-bold text-purple-800">🎰 Магазин призов</h2>
                <p className="text-purple-600">Потрать монетки на крутилку удачи!</p>
              </div>
            </div>
            <CoinDisplay coins={currentCoins} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Колесо фортуны */}
            <PixelCard className="bg-gradient-to-r from-yellow-200 to-orange-200">
              <div className="p-4 text-center">
                <div className="text-4xl mb-2">🎰</div>
                <h3 className="text-xl font-bold text-orange-800 mb-2">Колесо Фортуны</h3>
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Coins className="h-5 w-5 text-yellow-600" />
                  <span className="font-bold text-yellow-800">{WHEEL_COST} монет</span>
                </div>
                <p className="text-sm text-orange-700 mb-4">
                  Крути колесо и выигрывай призы! От кофе до выходного дня!
                </p>

                <PixelButton
                  onClick={handleSpinWheel}
                  disabled={!canSpin}
                  variant={canSpin ? "success" : "secondary"}
                  className="w-full mb-2"
                >
                  {canSpin ? "Крутить колесо! 🎲" : "Недостаточно монет 😢"}
                </PixelButton>

                {possibleSpins > 1 && (
                  <p className="text-xs text-orange-600">Можешь крутить еще {possibleSpins - 1} раз!</p>
                )}
              </div>
            </PixelCard>

            {/* Статистика призов */}
            <PixelCard className="bg-gradient-to-r from-green-200 to-blue-200">
              <div className="p-4">
                <h3 className="text-xl font-bold text-green-800 mb-3">📊 Твои призы</h3>

                {lastPrize && (
                  <div className="mb-4 p-3 bg-gradient-to-r from-yellow-100 to-yellow-200 rounded-lg border-2 border-yellow-300">
                    <div className="text-center">
                      <div className="text-2xl mb-1">{lastPrize.icon}</div>
                      <div className="font-bold text-yellow-800">Последний приз:</div>
                      <div className="text-sm text-yellow-700">{lastPrize.name}</div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-green-700">Ожидают выдачи:</span>
                    <span className="font-bold text-orange-800">{wonPrizes.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Возможных вращений:</span>
                    <span className="font-bold text-green-800">{possibleSpins}</span>
                  </div>
                </div>

                {wonPrizes.length === 0 && (
                  <div className="text-center text-green-600 mt-4">
                    <div className="text-3xl mb-2">🎁</div>
                    <p className="text-sm">Пока нет призов. Крути колесо!</p>
                  </div>
                )}
              </div>
            </PixelCard>
          </div>

          {/* Призы ожидающие выдачи */}
          {wonPrizes.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xl font-bold text-orange-800 mb-3">⏳ Ожидают выдачи</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {wonPrizes.map((prize, index) => (
                  <div key={index} className="bg-orange-100 rounded-lg p-3 border-2 border-orange-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{prize.icon}</div>
                        <div>
                          <div className="font-bold text-orange-800">{prize.name}</div>
                          <div className="text-xs text-orange-600">{prize.description}</div>
                          <div className="text-xs text-gray-500">{new Date(prize.wonAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => markPrizeAsDelivered(index)}
                          className="p-1 rounded bg-green-500 hover:bg-green-600 text-white"
                          title="Отметить как выданный"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deletePrize(index)}
                          className="p-1 rounded bg-red-500 hover:bg-red-600 text-white"
                          title="Удалить приз"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </PixelCard>

      {/* Колесо фортуны */}
      <PrizeWheel isOpen={isWheelOpen} onClose={handleCloseWheel} onPrizeWon={handlePrizeWon} />
    </div>
  )
}
