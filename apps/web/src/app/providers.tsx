import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LocaleProvider } from "../shared/i18n";
import { router } from "./router";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 30_000,
    },
  },
});

export function AppProviders({ children }: { readonly children?: ReactNode }) {
  return (
    <LocaleProvider>
      <QueryClientProvider client={queryClient}>
        {children ?? <RouterProvider router={router} />}
      </QueryClientProvider>
    </LocaleProvider>
  );
}
