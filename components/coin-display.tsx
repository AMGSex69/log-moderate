"use client"

import { useState, useEffect } from "react"

interface CoinDisplayProps {
  coins: number
  animated?: boolean
}

export default function CoinDisplay({ coins, animated = false }: CoinDisplayProps) {
  const [displayCoins, setDisplayCoins] = useState(coins)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (animated && coins !== displayCoins) {
      setIsAnimating(true)
      const increment = coins > displayCoins ? 1 : -1
      const timer = setInterval(() => {
        setDisplayCoins((prev) => {
          if (prev === coins) {
            clearInterval(timer)
            setIsAnimating(false)
            return prev
          }
          return prev + increment
        })
      }, 50)
      return () => clearInterval(timer)
    } else {
      setDisplayCoins(coins)
    }
  }, [coins, displayCoins, animated])

  return (
    <div className={`flex items-center gap-2 ${isAnimating ? "animate-bounce" : ""}`}>
      {/* Используем Unicode символ вместо эмодзи для лучшей совместимости */}
      <span className="text-2xl text-yellow-500 font-bold">●</span>
      <span className="font-bold text-xl font-mono text-yellow-600">{displayCoins.toLocaleString()}</span>
    </div>
  )
}
