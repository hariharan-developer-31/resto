'use client';

import { create } from 'zustand';

export interface UserRestaurant {
  id: number;
  name: string;
  slug: string;
  currency: string;
  currency_symbol: string;
  primary_color: string;
}

export interface UserBranch {
  id: number;
  restaurant_id: number;
  name: string;
  code: string | null;
  is_main_branch: boolean;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  username: string;
  phone: string | null;
  avatar: string | null;
  is_active: boolean;
  is_super_admin: boolean;
  roles: string[];
  permissions: string[];
  restaurants: UserRestaurant[];
  branches: UserBranch[];
  last_login_at: string | null;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  activeRestaurant: UserRestaurant | null;
  activeBranch: UserBranch | null;
  isAuthenticated: boolean;
  isHydrated: boolean;

  setAuth: (user: AuthUser, token: string) => void;
  updateUser: (user: AuthUser) => void;
  setActiveRestaurant: (restaurant: UserRestaurant | null) => void;
  setActiveBranch: (branch: UserBranch | null) => void;
  logout: (options?: { skipApi?: boolean }) => void;
  hydrate: () => void;
  hasRole: (roleName: string) => boolean;
  hasPermission: (permissionName: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  activeRestaurant: null,
  activeBranch: null,
  isAuthenticated: false,
  isHydrated: false,

  setAuth: (user, token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('resto_token', token);
      localStorage.setItem('resto_user', JSON.stringify(user));
    }

    const defaultRestaurant = user.restaurants?.[0] || null;
    const defaultBranch = defaultRestaurant 
      ? user.branches?.find(b => b.restaurant_id === defaultRestaurant.id) || user.branches?.[0] || null
      : null;

    if (defaultRestaurant && typeof window !== 'undefined') {
      localStorage.setItem('resto_restaurant_id', String(defaultRestaurant.id));
    }
    if (defaultBranch && typeof window !== 'undefined') {
      localStorage.setItem('resto_branch_id', String(defaultBranch.id));
    }

    set({
      user,
      token,
      activeRestaurant: defaultRestaurant,
      activeBranch: defaultBranch,
      isAuthenticated: true,
      isHydrated: true,
    });
  },

  updateUser: (user) => {
    // Normalization in case an API response wrapper was passed
    const normalizedUser = (user as any)?.user ? (user as any).user : user;
    if (typeof window !== 'undefined') {
      localStorage.setItem('resto_user', JSON.stringify(normalizedUser));
    }

    // Auto-reconcile activeRestaurant & activeBranch if not set or invalid
    let activeRestaurant = get().activeRestaurant;
    let activeBranch = get().activeBranch;

    if (!activeRestaurant && normalizedUser?.restaurants?.length > 0) {
      activeRestaurant = normalizedUser.restaurants[0];
    } else if (activeRestaurant && !normalizedUser?.restaurants?.some((r: any) => r.id === activeRestaurant?.id)) {
      activeRestaurant = normalizedUser?.restaurants?.[0] || null;
    }

    if (activeRestaurant) {
      const branchesForRest = normalizedUser?.branches?.filter((b: any) => b.restaurant_id === activeRestaurant?.id) || [];
      if (!activeBranch || activeBranch.restaurant_id !== activeRestaurant.id) {
        activeBranch = branchesForRest.find((b: any) => b.is_main_branch) || branchesForRest[0] || null;
      }
    } else {
      activeBranch = null;
    }

    if (typeof window !== 'undefined') {
      if (activeRestaurant) localStorage.setItem('resto_restaurant_id', String(activeRestaurant.id));
      else localStorage.removeItem('resto_restaurant_id');
      if (activeBranch) localStorage.setItem('resto_branch_id', String(activeBranch.id));
      else localStorage.removeItem('resto_branch_id');
    }

    set({ user: normalizedUser, activeRestaurant, activeBranch });
  },

  setActiveRestaurant: (restaurant) => {
    const currentBranch = get().activeBranch;
    const validBranch = restaurant && currentBranch?.restaurant_id === restaurant.id
      ? currentBranch
      : get().user?.branches?.find(b => b.restaurant_id === restaurant?.id) || null;

    if (typeof window !== 'undefined') {
      if (restaurant) {
        localStorage.setItem('resto_restaurant_id', String(restaurant.id));
      } else {
        localStorage.removeItem('resto_restaurant_id');
      }

      if (validBranch) {
        localStorage.setItem('resto_branch_id', String(validBranch.id));
      } else {
        localStorage.removeItem('resto_branch_id');
      }
    }

    set({ activeRestaurant: restaurant, activeBranch: validBranch });
  },

  setActiveBranch: (branch) => {
    if (typeof window !== 'undefined') {
      if (branch) {
        localStorage.setItem('resto_branch_id', String(branch.id));
      } else {
        localStorage.removeItem('resto_branch_id');
      }
    }
    set({ activeBranch: branch });
  },

  logout: (options) => {
    const existingToken = get().token || (typeof window !== 'undefined' ? localStorage.getItem('resto_token') : null);

    if (!options?.skipApi && existingToken && typeof window !== 'undefined') {
      const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://resto-production-eaf02fa7.up.railway.app/api/v1').replace(/\/$/, '');
      fetch(`${baseUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${existingToken}`,
        },
      }).catch(() => {});
    }

    if (typeof window !== 'undefined') {
      localStorage.removeItem('resto_token');
      localStorage.removeItem('resto_user');
      localStorage.removeItem('resto_restaurant_id');
      localStorage.removeItem('resto_branch_id');
    }
    set({
      user: null,
      token: null,
      activeRestaurant: null,
      activeBranch: null,
      isAuthenticated: false,
      isHydrated: true,
    });
  },

  hydrate: () => {
    if (typeof window === 'undefined') return;

    try {
      const token = localStorage.getItem('resto_token');
      const userStr = localStorage.getItem('resto_user');
      const restaurantId = localStorage.getItem('resto_restaurant_id');
      const branchId = localStorage.getItem('resto_branch_id');

      if (token && userStr) {
        const user: AuthUser = JSON.parse(userStr);
        const activeRestaurant = restaurantId 
          ? user.restaurants?.find(r => r.id === Number(restaurantId)) || null
          : user.restaurants?.[0] || null;

        const matchingBranches = activeRestaurant
          ? (user.branches || []).filter(b => b.restaurant_id === activeRestaurant.id)
          : [];

        const activeBranch = branchId
          ? matchingBranches.find(b => b.id === Number(branchId)) || null
          : matchingBranches[0] || null;

        if (activeRestaurant) {
          localStorage.setItem('resto_restaurant_id', String(activeRestaurant.id));
        } else {
          localStorage.removeItem('resto_restaurant_id');
        }

        if (activeBranch) {
          localStorage.setItem('resto_branch_id', String(activeBranch.id));
        } else {
          localStorage.removeItem('resto_branch_id');
        }

        set({
          token,
          user,
          activeRestaurant,
          activeBranch,
          isAuthenticated: true,
          isHydrated: true,
        });
        return;
      }
    } catch (e) {
      console.error('Failed to hydrate auth store', e);
    }

    set({ isHydrated: true });
  },

  hasRole: (roleName: string) => {
    const user = get().user;
    if (!user) return false;
    if (user.is_super_admin) return true;
    return Boolean(user.roles?.includes(roleName));
  },

  hasPermission: (permissionName: string) => {
    const user = get().user;
    if (!user) return false;
    if (user.is_super_admin) return true;
    return Boolean(user.permissions?.includes(permissionName));
  },
}));
