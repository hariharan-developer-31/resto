'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import {
  Menu,
  Building2,
  GitBranch,
  Bell,
  CheckCheck,
} from 'lucide-react';

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const queryClient = useQueryClient();
  const [notifOpen, setNotifOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const activeRestaurant = useAuthStore((s) => s.activeRestaurant);
  const activeBranch = useAuthStore((s) => s.activeBranch);
  const setActiveRestaurant = useAuthStore((s) => s.setActiveRestaurant);
  const setActiveBranch = useAuthStore((s) => s.setActiveBranch);

  const { data: notifData } = useQuery({
    queryKey: ['staff-notifications', activeRestaurant?.id, activeBranch?.id],
    queryFn: async () => {
      const res = await apiClient.get<{ unread_count: number; notifications: any[] }>('/notifications');
      return res.data;
    },
    enabled: !!user && !!activeRestaurant?.id,
    refetchInterval: 8000,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-notifications'] });
    },
  });

  const unreadCount = notifData?.unread_count || 0;
  const notifications = notifData?.notifications || [];

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
          className="p-2.5 text-[#252525] hover:bg-[#B4D58A]/20 rounded-2xl md:hidden transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Restaurant Switcher */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-[#B4D58A]/20 rounded-2xl text-xs font-semibold text-[#252525]">
            <Building2 className="h-4 w-4 text-[#252525]" />
            {availableRestaurants.length > 1 ? (
              <select
                value={activeRestaurant?.id || ''}
                onChange={(e) => {
                  const selected = availableRestaurants.find(
                    (r) => r.id === Number(e.target.value)
                  );
                  setActiveRestaurant(selected || null);
                  queryClient.invalidateQueries();
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
              <span>{activeRestaurant?.name || 'No Active Restaurant'}</span>
            )}
          </div>

          {/* Branch Switcher */}
          {activeRestaurant && availableBranches.length > 0 && (
            <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-[#F3DA8A]/25 rounded-2xl text-xs font-semibold text-[#252525]">
              <GitBranch className="h-4 w-4 text-[#252525]" />
              {availableBranches.length > 1 ? (
                <select
                  value={activeBranch?.id || ''}
                  onChange={(e) => {
                    const selected = availableBranches.find(
                      (b) => b.id === Number(e.target.value)
                    );
                    setActiveBranch(selected || null);
                    queryClient.invalidateQueries();
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

      {/* Right: Notification Bell, Status Pill & Profile */}
      <div className="flex items-center gap-3 relative">
        {/* Live Staff Notification Bell (Digital Table Bell Alerts) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setNotifOpen((prev) => !prev)}
            title="Table Service Notifications"
            className="relative p-2.5 rounded-2xl bg-[#FAF9F6] hover:bg-[#F3DA8A]/30 border border-black/[0.06] text-[#252525] transition-colors cursor-pointer"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-[#F2AFC0] text-[#252525] text-[10px] font-extrabold flex items-center justify-center shadow-xs">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-black/[0.08] shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-black/[0.06] flex items-center justify-between bg-[#FAF9F6]">
                <span className="text-xs font-bold text-[#252525]">
                  Floor Alerts ({unreadCount} unread)
                </span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllReadMutation.mutate()}
                    className="text-[11px] font-semibold text-[#5A5D58] hover:text-[#252525] flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-black/[0.04]">
                {notifications.length === 0 ? (
                  <p className="p-5 text-center text-xs text-[#5A5D58]">
                    No floor alerts right now.
                  </p>
                ) : (
                  notifications.map((n: any) => (
                    <div
                      key={n.id}
                      onClick={() => !n.read_at && markReadMutation.mutate(n.id)}
                      className={`px-4 py-3 text-xs cursor-pointer transition-colors ${
                        n.read_at ? 'bg-white text-[#5A5D58]' : 'bg-[#B4D58A]/15 text-[#252525] font-medium'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-[#252525]">{n.title}</span>
                        {!n.read_at && (
                          <span className="h-2 w-2 rounded-full bg-[#B4D58A] shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-[11px] text-[#5A5D58] mt-0.5">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* System Health Badge */}
        <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#B4D58A]/25 text-xs font-bold text-[#252525]">
          <span className="h-2 w-2 rounded-full bg-[#B4D58A] animate-pulse" />
          <span className="tracking-wide">API CONNECTED</span>
        </div>

        {/* User Role Badge */}
        {user?.is_super_admin ? (
          <Badge variant="mint" className="text-xs uppercase tracking-wider py-1 px-3 font-bold">
            Super Admin
          </Badge>
        ) : (
          <Badge variant="butter" className="text-xs uppercase tracking-wider py-1 px-3 font-bold">
            {user?.roles?.[0] || 'Staff'}
          </Badge>
        )}
      </div>
    </header>
  );
}
