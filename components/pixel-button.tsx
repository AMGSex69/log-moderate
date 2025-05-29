"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PixelButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: "primary" | "secondary" | "success" | "danger"
  size?: "sm" | "md" | "lg"
  disabled?: boolean
  className?: string
}

export default function PixelButton({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  className,
}: PixelButtonProps) {
  const variants = {
    primary: "bg-blue-500 hover:bg-blue-600 border-blue-700",
    secondary: "bg-gray-500 hover:bg-gray-600 border-gray-700",
    success: "bg-green-500 hover:bg-green-600 border-green-700",
    danger: "bg-red-500 hover:bg-red-600 border-red-700",
  }

  const sizes = {
    sm: "px-3 py-1 text-sm",
    md: "px-4 py-2",
    lg: "px-6 py-3 text-lg",
  }

  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "border-4 border-b-8 text-white font-bold",
        "shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
        "hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]",
        "hover:translate-x-[-2px] hover:translate-y-[-2px]",
        "active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
        "active:translate-x-[2px] active:translate-y-[2px]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "transition-all duration-100",
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </Button>
  )
}
