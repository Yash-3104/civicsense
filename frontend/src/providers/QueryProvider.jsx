import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function AppQueryProvider({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}

    <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}