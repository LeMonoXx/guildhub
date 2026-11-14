import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import { LocaleProvider, useLocale } from "../shared/i18n";
import { router } from "./router";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 30_000,
    },
  },
});

/** Game texts are fetched in the page's language, so a switch refetches them. */
function RefetchOnLocaleChange() {
  const { locale } = useLocale();
  const client = useQueryClient();
  const previous = useRef(locale);
  useEffect(() => {
    if (previous.current === locale) return;
    previous.current = locale;
    void client.invalidateQueries();
  }, [client, locale]);
  return null;
}

export function AppProviders({ children }: { readonly children?: ReactNode }) {
  return (
    <LocaleProvider>
      <QueryClientProvider client={queryClient}>
        <RefetchOnLocaleChange />
        {children ?? <RouterProvider router={router} />}
      </QueryClientProvider>
    </LocaleProvider>
  );
}
