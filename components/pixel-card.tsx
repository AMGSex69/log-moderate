"use client"

import type React from "react"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface PixelCardProps {
  children: React.ReactNode
  className?: string
  glowing?: boolean
}

export default function PixelCard({ children, className, glowing = false }: PixelCardProps) {
  return (
    <Card
      className={cn(
        "border-4 border-black bg-gradient-to-br from-blue-100 to-purple-100",
        "shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]",
        "transition-all duration-200 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]",
        "hover:translate-x-[-4px] hover:translate-y-[-4px]",
        glowing && "animate-pulse border-yellow-400 bg-gradient-to-br from-yellow-100 to-orange-100",
        className,
      )}
    >
      {children}
    </Card>
  )
}
