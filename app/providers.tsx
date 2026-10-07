"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";

// Toasts sit at the bottom, above the phone nav (--toast-bottom in globals.css follows the nav breakpoint).
const OFFSET = { bottom: "var(--toast-bottom)", left: "14px", right: "14px" };

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster position="bottom-center" offset={OFFSET} mobileOffset={OFFSET} />
    </QueryClientProvider>
  );
}
