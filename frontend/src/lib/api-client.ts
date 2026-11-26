/**
 * Restaurant OS - API Client
 * Configured for REST API v1 (Laravel on Railway/Local/Hostinger)
 */

export const API_BASE_URL = 
  process.env.NEXT_PUBLIC_API_URL || 'https://resto-production-eaf02fa7.up.railway.app/api/v1';

let unauthorizedHandler: (() => void) | null = null;

export function registerUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data: T;
  meta?: any;
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  statusCode: number;
  errors?: Record<string, string[]>;

  constructor(message: string, statusCode: number, errors?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

/**
 * Fetch wrapper with bearer token and tenant headers support
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit & {
    token?: string | null;
    restaurantId?: number | string | null;
    branchId?: number | string | null;
  } = {}
): Promise<ApiResponse<T>> {
  const { token, restaurantId, branchId, headers = {}, ...rest } = options;

  const url = endpoint.startsWith('http') 
    ? endpoint 
    : `${API_BASE_URL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;

  const requestHeaders: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...((headers as Record<string, string>) || {}),
  };

  // Attach token if present
  const activeToken = token ?? (typeof window !== 'undefined' ? localStorage.getItem('resto_token') : null);
  if (activeToken) {
    requestHeaders['Authorization'] = `Bearer ${activeToken}`;
  }

  // Attach Tenant headers if present
  const activeRestId = restaurantId ?? (typeof window !== 'undefined' ? localStorage.getItem('resto_restaurant_id') : null);
  if (activeRestId) {
    requestHeaders['X-Restaurant-ID'] = String(activeRestId);
  }

  const activeBranchId = branchId ?? (typeof window !== 'undefined' ? localStorage.getItem('resto_branch_id') : null);
  if (activeBranchId) {
    requestHeaders['X-Branch-ID'] = String(activeBranchId);
  }

  try {
    const res = await fetch(url, {
      ...rest,
      headers: requestHeaders,
    });

    const data: ApiResponse<T> = await res.json().catch(() => ({
      success: false,
      message: `Failed to parse response (HTTP ${res.status})`,
      data: null as any,
    }));

    if (!res.ok) {
      // Automatic session expiry handling (skip on login attempts)
      const isLoginRequest = endpoint.replace(/^\//, '').startsWith('auth/login');
      if (res.status === 401 && !isLoginRequest && typeof window !== 'undefined') {
        localStorage.removeItem('resto_token');
        localStorage.removeItem('resto_user');
        localStorage.removeItem('resto_restaurant_id');
        localStorage.removeItem('resto_branch_id');
        unauthorizedHandler?.();
      }

      throw new ApiError(
        data.message || `Request failed with status ${res.status}`,
        res.status,
        data.errors
      );
    }

    return data;
  } catch (error: any) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(error.message || 'Network connection failed. Please verify API server is online.', 0);
  }
}

/**
 * Convenience helper methods for standard REST calls
 */
export const apiClient = {
  get: <T = any>(endpoint: string, options?: Parameters<typeof apiRequest>[1]) =>
    apiRequest<T>(endpoint, { method: 'GET', ...options }),
  post: <T = any>(endpoint: string, body?: any, options?: Parameters<typeof apiRequest>[1]) =>
    apiRequest<T>(endpoint, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),
  put: <T = any>(endpoint: string, body?: any, options?: Parameters<typeof apiRequest>[1]) =>
    apiRequest<T>(endpoint, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),
  patch: <T = any>(endpoint: string, body?: any, options?: Parameters<typeof apiRequest>[1]) =>
    apiRequest<T>(endpoint, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),
  delete: <T = any>(endpoint: string, options?: Parameters<typeof apiRequest>[1]) =>
    apiRequest<T>(endpoint, { method: 'DELETE', ...options }),
};

