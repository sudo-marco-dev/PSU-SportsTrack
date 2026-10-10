"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-right"
      richColors={true}
      closeButton={true}
      duration={5000}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-5 text-emerald-400 shrink-0" />
        ),
        info: (
          <InfoIcon className="size-5 text-sky-400 shrink-0" />
        ),
        warning: (
          <TriangleAlertIcon className="size-5 text-amber-400 shrink-0" />
        ),
        error: (
          <OctagonXIcon className="size-5 text-rose-400 shrink-0" />
        ),
        loading: (
          <Loader2Icon className="size-5 text-orange-400 animate-spin shrink-0" />
        ),
      }}
      toastOptions={{
        classNames: {
          toast: "group font-sans text-xs sm:text-sm rounded-2xl p-4 shadow-2xl border-2 font-medium backdrop-blur-md transition-all",
          title: "font-black tracking-tight text-white",
          description: "text-xs font-medium leading-relaxed opacity-95",
          actionButton: "bg-white text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl px-3 py-1.5 shadow-md hover:bg-slate-100",
          cancelButton: "bg-slate-800 text-white font-bold text-xs rounded-xl px-3 py-1.5",
          closeButton: "!bg-white/10 hover:!bg-white/20 !text-white !border-0 rounded-full",
          error: "!bg-rose-950 !border-rose-500 !text-white shadow-rose-950/60 shadow-xl",
          success: "!bg-emerald-950 !border-emerald-500 !text-white shadow-emerald-950/60 shadow-xl",
          warning: "!bg-amber-950 !border-amber-500 !text-white shadow-amber-950/60 shadow-xl",
          info: "!bg-slate-900 !border-sky-500 !text-white shadow-slate-950/60 shadow-xl",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
