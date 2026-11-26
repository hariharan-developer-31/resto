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
  logout: () => void;
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
    if (typeof window !== 'undefined') {
      localStorage.setItem('resto_user', JSON.stringify(user));
    }
    set({ user });
  },

  setActiveRestaurant: (restaurant) => {
    if (typeof window !== 'undefined') {
      if (restaurant) {
        localStorage.setItem('resto_restaurant_id', String(restaurant.id));
      } else {
        localStorage.removeItem('resto_restaurant_id');
      }
    }

    const currentBranch = get().activeBranch;
    const validBranch = restaurant && currentBranch?.restaurant_id === restaurant.id
      ? currentBranch
      : get().user?.branches?.find(b => b.restaurant_id === restaurant?.id) || null;

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

  logout: () => {
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
          ? user.restaurants?.find(r => r.id === Number(restaurantId)) || user.restaurants?.[0] || null
          : user.restaurants?.[0] || null;

        const activeBranch = branchId 
          ? user.branches?.find(b => b.id === Number(branchId)) || user.branches?.[0] || null
          : user.branches?.[0] || null;

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
    return user.roles.includes(roleName);
  },

  hasPermission: (permissionName: string) => {
    const user = get().user;
    if (!user) return false;
    if (user.is_super_admin) return true;
    return user.permissions.includes(permissionName);
  },
}));
