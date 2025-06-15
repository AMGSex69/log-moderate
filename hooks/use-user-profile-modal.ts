"use client"

import { useState } from "react"

interface UseUserProfileModalReturn {
	userId: string | null
	isOpen: boolean
	showFullStats: boolean
	openProfile: (userId: string, showFullStats?: boolean) => void
	closeProfile: () => void
}

export function useUserProfileModal(): UseUserProfileModalReturn {
	const [userId, setUserId] = useState<string | null>(null)
	const [isOpen, setIsOpen] = useState(false)
	const [showFullStats, setShowFullStats] = useState(false)

	const openProfile = (userId: string, showFullStats: boolean = false) => {
		setUserId(userId)
		setShowFullStats(showFullStats)
		setIsOpen(true)
	}

	const closeProfile = () => {
		setIsOpen(false)
		// Небольшая задержка перед очисткой userId для плавного закрытия
		setTimeout(() => {
			setUserId(null)
			setShowFullStats(false)
		}, 300)
	}

	return {
		userId,
		isOpen,
		showFullStats,
		openProfile,
		closeProfile
	}
} 