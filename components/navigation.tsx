"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { User, BarChart3 } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"

export default function Navigation() {
  const pathname = usePathname()
  const { profile } = useAuth()

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">Система учета задач</h2>
            {profile?.is_admin && <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">АДМИН</span>}
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant={pathname === "/" ? "default" : "outline"} size="sm">
              <Link href="/" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Рабочее место
              </Link>
            </Button>

            {profile?.is_admin && (
              <Button asChild variant={pathname === "/admin" ? "default" : "outline"} size="sm">
                <Link href="/admin" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Админ панель
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
