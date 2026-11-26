'use client';

import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { apiRequest, registerUnauthorizedHandler } from '@/lib/api-client';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 3, // 3 minutes
            refetchOnWindowFocus: true,
            retry: (failureCount, error: any) => {
              if (error?.statusCode === 401 || error?.statusCode === 403) {
                return false;
              }
              return failureCount < 2;
            },
          },
        },
      })
  );

  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    registerUnauthorizedHandler(() => {
      useAuthStore.getState().logout({ skipApi: true });
      queryClient.clear();
    });

    hydrate();

    const token = typeof window !== 'undefined' ? localStorage.getItem('resto_token') : null;
    if (token) {
      apiRequest<{ user: any }>('auth/me')
        .then((res) => {
          if (res?.data?.user) {
            useAuthStore.getState().updateUser(res.data.user);
          }
        })
        .catch(() => {
          // 401 is handled automatically by registerUnauthorizedHandler
        });
    }

    return () => {
      registerUnauthorizedHandler(null);
    };
  }, [hydrate, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
