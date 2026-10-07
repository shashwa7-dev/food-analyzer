"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      icons={{
        success: (
          // Lime on the ink pill; in dark mode the pill itself is lime, so the check takes the text colour.
          <CheckIcon aria-hidden className="size-5 text-brand dark:text-action-ink" />
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
        // mock-c1 .toast: an ink pill with a 20 px icon, a one-line message that ellipsises, and
        // an Undo-style action (44 px tall for the tap-target rule).
        classNames: {
          toast: "cn-toast [--toast-icon-margin-end:0px] [--toast-icon-margin-start:0px] !gap-2.5 rounded-[18px] bg-action !py-1.5 !pr-1.5 !pl-3.5 !min-h-14 text-action-ink",
          icon: "!size-5",
          title: "!truncate !text-[14px] !font-[550]",
          content: "!min-w-0",
          actionButton: "!ml-auto !h-11 !gap-1.5 !rounded-[14px] !bg-action-ink/15 !px-3.5 !text-[14px] !font-semibold !whitespace-nowrap !text-action-ink",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
