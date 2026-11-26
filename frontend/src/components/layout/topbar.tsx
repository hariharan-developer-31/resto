'use client';

import React from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { Badge } from '@/components/ui/badge';
import {
  Menu,
  Building2,
  GitBranch,
  ShieldCheck,
  Activity,
  CheckCircle2,
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
    <header className="sticky top-0 z-30 flex h-18 w-full items-center justify-between border-b border-[#EAE7E0] bg-[#FFFFFF]/90 backdrop-blur-md px-4 sm:px-6">
      {/* Left: Mobile hamburger + Tenant Selectors */}
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          onClick={onMenuClick}
          className="p-2 text-[#777872] hover:text-[#292B28] hover:bg-[#FAF8F4] rounded-lg md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Restaurant Switcher */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF8F4] border border-[#EAE7E0] rounded-[10px] text-xs font-medium text-[#292B28]">
            <Building2 className="h-3.5 w-3.5 text-[#C76B4A]" />
            {availableRestaurants.length > 1 ? (
              <select
                value={activeRestaurant?.id || ''}
                onChange={(e) => {
                  const selected = availableRestaurants.find(
                    (r) => r.id === Number(e.target.value)
                  );
                  setActiveRestaurant(selected || null);
                }}
                className="bg-transparent font-medium text-[#292B28] outline-none cursor-pointer pr-1"
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
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF8F4] border border-[#EAE7E0] rounded-[10px] text-xs font-medium text-[#292B28]">
              <GitBranch className="h-3.5 w-3.5 text-[#66745B]" />
              {availableBranches.length > 1 ? (
                <select
                  value={activeBranch?.id || ''}
                  onChange={(e) => {
                    const selected = availableBranches.find(
                      (b) => b.id === Number(e.target.value)
                    );
                    setActiveBranch(selected || null);
                  }}
                  className="bg-transparent font-medium text-[#292B28] outline-none cursor-pointer pr-1"
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
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EBF5EF] border border-[#D5EAD9] text-xs font-medium text-[#39845C]">
          <span className="h-2 w-2 rounded-full bg-[#39845C] animate-pulse" />
          <span>API Connected</span>
        </div>

        {/* User Role Badge */}
        {user?.is_super_admin ? (
          <Badge variant="default" className="text-[11px] font-semibold">
            Super Admin
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[11px] font-semibold">
            {user?.roles?.[0] || 'Staff'}
          </Badge>
        )}
      </div>
    </header>
  );
}
