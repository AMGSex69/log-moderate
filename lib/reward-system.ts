import { GAME_CONFIG } from "./game-config"

export interface TaskCompletion {
  taskName: string
  units: number
  timeMinutes: number
  date: string
}

export interface RewardCalculation {
  basePoints: number
  bonusPoints: number
  totalPoints: number
  bonusReasons: string[]
}

export class RewardSystem {
  /**
   * Рассчитывает очки за выполненную задачу с учетом бонусов
   */
  static calculateReward(
    taskName: string,
    units: number,
    timeMinutes: number,
    dailyTasks: TaskCompletion[] = [],
  ): RewardCalculation {
    const basePointsPerUnit = GAME_CONFIG.TASK_REWARDS[taskName] || 2
    const basePoints = units * basePointsPerUnit

    let bonusPoints = 0
    const bonusReasons: string[] = []

    // Бонус за эффективность (быстрое выполнение)
    const avgTimePerUnit = timeMinutes / units
    if (avgTimePerUnit <= 15 && basePointsPerUnit >= 5) {
      const efficiencyBonus = Math.floor(basePoints * 0.2)
      bonusPoints += efficiencyBonus
      bonusReasons.push(`Быстрое выполнение: +${efficiencyBonus}`)
    }

    // Бонус за объем (много единиц за раз)
    if (units >= 10) {
      const volumeBonus = Math.floor(basePoints * 0.15)
      bonusPoints += volumeBonus
      bonusReasons.push(`Большой объем: +${volumeBonus}`)
    }

    // Бонус за сложность задачи
    if (basePointsPerUnit >= 7) {
      const complexityBonus = Math.floor(basePoints * 0.1)
      bonusPoints += complexityBonus
      bonusReasons.push(`Сложная задача: +${complexityBonus}`)
    }

    // Бонус за разнообразие (разные группы задач за день)
    const uniqueGroups = this.getUniqueTaskGroups([
      ...dailyTasks,
      { taskName, units, timeMinutes, date: new Date().toISOString().split("T")[0] },
    ])
    if (uniqueGroups >= 4) {
      const diversityBonus = Math.floor(basePoints * 0.25)
      bonusPoints += diversityBonus
      bonusReasons.push(`Разнообразие задач: +${diversityBonus}`)
    }

    // Бонус за продуктивность (много задач за день)
    const todayTasksCount = dailyTasks.filter((t) => t.date === new Date().toISOString().split("T")[0]).length
    if (todayTasksCount >= 8) {
      const productivityBonus = Math.floor(basePoints * 0.3)
      bonusPoints += productivityBonus
      bonusReasons.push(`Высокая продуктивность: +${productivityBonus}`)
    }

    return {
      basePoints,
      bonusPoints,
      totalPoints: basePoints + bonusPoints,
      bonusReasons,
    }
  }

  /**
   * Определяет количество уникальных групп задач
   */
  private static getUniqueTaskGroups(tasks: TaskCompletion[]): number {
    const groups = new Set<string>()

    tasks.forEach((task) => {
      for (const [groupName, groupData] of Object.entries(GAME_CONFIG.TASK_GROUPS)) {
        if (groupData.tasks.includes(task.taskName)) {
          groups.add(groupName)
          break
        }
      }
    })

    return groups.size
  }

  /**
   * Проверяет достижения на основе выполненных задач
   */
  static checkAchievements(dailyTasks: TaskCompletion[], totalCoins: number, consecutiveDays = 1): string[] {
    const newAchievements: string[] = []
    const today = new Date().toISOString().split("T")[0]
    const todayTasks = dailyTasks.filter((t) => t.date === today)

    // Трудяга - 5 сложных задач
    const hardTasks = todayTasks.filter((t) => (GAME_CONFIG.TASK_REWARDS[t.taskName] || 0) >= 6)
    if (hardTasks.length >= 5) {
      newAchievements.push("hard_worker")
    }

    // Скоростной демон - 15 задач за день
    if (todayTasks.length >= 15) {
      newAchievements.push("speed_demon")
    }

    // Мастер разнообразия - 5 разных групп
    const uniqueGroups = this.getUniqueTaskGroups(todayTasks)
    if (uniqueGroups >= 5) {
      newAchievements.push("variety_master")
    }

    // Специалист высокой ценности - 3 задачи по 7+ очков
    const highValueTasks = todayTasks.filter((t) => (GAME_CONFIG.TASK_REWARDS[t.taskName] || 0) >= 7)
    if (highValueTasks.length >= 3) {
      newAchievements.push("high_value_specialist")
    }

    // Эксперт эффективности - среднее время < 20 мин
    if (todayTasks.length > 0) {
      const avgTime = todayTasks.reduce((sum, t) => sum + t.timeMinutes / t.units, 0) / todayTasks.length
      if (avgTime < 20) {
        newAchievements.push("efficiency_expert")
      }
    }

    // Король постоянства - 5 дней подряд
    if (consecutiveDays >= 5) {
      newAchievements.push("consistency_king")
    }

    // Клуб сотни - 100 очков
    if (totalCoins >= 100) {
      newAchievements.push("century_club")
    }

    return newAchievements
  }
}
