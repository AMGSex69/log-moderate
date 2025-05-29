import DailyTimeline from "@/components/admin/daily-timeline"
import EmployeeAnalytics from "@/components/admin/employee-analytics"
import TaskAnalyticsNew from "@/components/admin/task-analytics-new"
import GeneralDashboard from "@/components/admin/general-dashboard"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Navigation from "@/components/navigation"
import AuthGuard from "@/components/auth/auth-guard"

export default function AdminPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 p-4">
        <div className="container mx-auto py-6">
          <Navigation />

          <Tabs defaultValue="timeline" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="timeline">Временной разрез</TabsTrigger>
              <TabsTrigger value="employees">Аналитика сотрудников</TabsTrigger>
              <TabsTrigger value="tasks">Аналитика задач</TabsTrigger>
              <TabsTrigger value="dashboard">Общая статистика</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline">
              <DailyTimeline />
            </TabsContent>

            <TabsContent value="employees">
              <EmployeeAnalytics />
            </TabsContent>

            <TabsContent value="tasks">
              <TaskAnalyticsNew />
            </TabsContent>

            <TabsContent value="dashboard">
              <GeneralDashboard />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </AuthGuard>
  )
}
