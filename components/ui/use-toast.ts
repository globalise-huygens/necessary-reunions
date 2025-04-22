"use client"

import type * as React from "react"

import { createContext, useContext, useState, useCallback } from "react"

type ToastType = "default" | "destructive"

type ToastActionType = {
  altText?: string
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
}

export type ToastProps = {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionType
  type?: ToastType
  duration?: number
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export type ToastActionProps = React.HTMLAttributes<HTMLButtonElement>

const ToastContext = createContext<{
  toasts: ToastProps[]
  addToast: (toast: ToastProps) => void
  updateToast: (toast: ToastProps) => void
  removeToast: (id: string) => void
}>({
  toasts: [],
  addToast: () => {},
  updateToast: () => {},
  removeToast: () => {},
})

type ToastProviderProps = {
  children: React.ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastProps[]>([])

  const addToast = useCallback((toast: ToastProps) => {
    setToasts((prev) => [...prev, toast])
  }, [])

  const updateToast = useCallback((toast: ToastProps) => {
    setToasts((prev) => prev.map((t) => (t.id === toast.id ? { ...t, ...toast } : t)))
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, updateToast, removeToast }}>{children}</ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
