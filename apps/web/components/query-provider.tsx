"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

// One QueryClient per browser tab: created once in state, so it survives
// re-renders and is never shared between requests on the server.
const QueryProvider = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // Data rendered on the server is fresh for a minute, so the client
        // doesn't fetch it again right after loading the page.
        defaultOptions: { queries: { staleTime: 60 * 1000 } },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

export default QueryProvider;
