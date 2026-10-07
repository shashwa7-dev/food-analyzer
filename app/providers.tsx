"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider, useTheme } from "@/components/theme/theme-provider";
import type { Theme } from "@/lib/theme";

// Toasts sit at the bottom, above the phone nav (--toast-bottom in globals.css follows the nav breakpoint).
const OFFSET = { bottom: "var(--toast-bottom)", left: "14px", right: "14px" };

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} position="bottom-center" offset={OFFSET} mobileOffset={OFFSET} />;
}

export function Providers({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  return (
    <ThemeProvider initial={theme}>
      <QueryClientProvider client={client}>
        {children}
        <ThemedToaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
