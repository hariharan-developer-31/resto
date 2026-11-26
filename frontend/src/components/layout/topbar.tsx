'use client';

import React from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { Badge } from '@/components/ui/badge';
import {
  Menu,
  Building2,
  GitBranch,
  Sparkles,
} from 'lucide-react';

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { user, activeRestaurant, activeBranch, setActiveRestaurant, setActiveBranch } = useAuthStore((s) => ({
    user: s.user,
    activeRestaurant: s.activeRestaurant,
    activeBranch: s.activeBranch,
    setActiveRestaurant: s.setActiveRestaurant,
    setActiveBranch: s.setActiveBranch,
  }));

  const availableRestaurants = user?.restaurants || [];
  const availableBranches = (user?.branches || []).filter(
    (b) => !activeRestaurant || b.restaurant_id === activeRestaurant.id
  );

  return (
    <header className="sticky top-0 z-30 flex h-20 w-full items-center justify-between bg-white/80 backdrop-blur-xl px-6 sm:px-8 border-b border-black/[0.04]">
      {/* Left: Mobile hamburger + Tenant Selectors */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="p-2.5 text-[#252525] hover:bg-[#C2B0DC]/20 rounded-2xl md:hidden transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Restaurant Switcher */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-[#C2B0DC]/15 rounded-2xl text-xs font-semibold text-[#252525]">
            <Building2 className="h-4 w-4 text-[#C2B0DC]" />
            {availableRestaurants.length > 1 ? (
              <select
                value={activeRestaurant?.id || ''}
                onChange={(e) => {
                  const selected = availableRestaurants.find(
                    (r) => r.id === Number(e.target.value)
                  );
                  setActiveRestaurant(selected || null);
                }}
                className="bg-transparent font-semibold text-[#252525] outline-none cursor-pointer pr-1"
              >
                {availableRestaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            ) : (
              <span>{activeRestaurant?.name || 'All Restaurants'}</span>
            )}
          </div>

          {/* Branch Switcher */}
          {activeRestaurant && availableBranches.length > 0 && (
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-[#B4D58A]/20 rounded-2xl text-xs font-semibold text-[#252525]">
              <GitBranch className="h-4 w-4 text-[#252525]" />
              {availableBranches.length > 1 ? (
                <select
                  value={activeBranch?.id || ''}
                  onChange={(e) => {
                    const selected = availableBranches.find(
                      (b) => b.id === Number(e.target.value)
                    );
                    setActiveBranch(selected || null);
                  }}
                  className="bg-transparent font-semibold text-[#252525] outline-none cursor-pointer pr-1"
                >
                  {availableBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.is_main_branch ? '(Main)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <span>{activeBranch?.name || 'Main Branch'}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Status Pill & Profile */}
      <div className="flex items-center gap-3">
        {/* System Health Badge */}
        <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#B4D58A]/25 text-xs font-bold text-[#252525]">
          <span className="h-2 w-2 rounded-full bg-[#B4D58A] animate-pulse" />
          <span className="tracking-wide">API CONNECTED</span>
        </div>

        {/* User Role Badge */}
        {user?.is_super_admin ? (
          <Badge variant="lilac" className="text-xs uppercase tracking-wider py-1 px-3">
            Super Admin
          </Badge>
        ) : (
          <Badge variant="butter" className="text-xs uppercase tracking-wider py-1 px-3">
            {user?.roles?.[0] || 'Staff'}
          </Badge>
        )}
      </div>
    </header>
  );
}
