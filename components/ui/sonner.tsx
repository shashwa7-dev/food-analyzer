"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4 text-brand" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          // Every toast kind is the same ink pill now (mock-c1's single `.toast` style) —
          // the icon, not the surface, carries the success/error/warning meaning.
          "--normal-bg": "var(--action)",
          "--normal-text": "var(--action-ink)",
          "--normal-border": "var(--action)",
          "--success-bg": "var(--action)",
          "--success-text": "var(--action-ink)",
          "--success-border": "var(--action)",
          "--error-bg": "var(--action)",
          "--error-text": "var(--action-ink)",
          "--error-border": "var(--action)",
          "--warning-bg": "var(--action)",
          "--warning-text": "var(--action-ink)",
          "--warning-border": "var(--action)",
          "--border-radius": "18px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast rounded-[18px] bg-action text-action-ink shadow-lg",
          actionButton: "rounded-xl bg-action-ink/15",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
