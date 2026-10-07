import type { QueryClient } from "@tanstack/react-query";

/**
 * After any diary change (add, edit, delete, undo): drop cached log queries — today that is the
 * date picker's logged-day dots, `["log", "dates", month]` — so they refetch on next use.
 */
export function invalidateLogQueries(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: ["log"] });
}
