'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  UtensilsCrossed,
  UserCheck,
  Store,
  Users,
  Grid,
  ChefHat,
  CalendarDays,
  ShieldCheck,
  LogOut,
  Sparkles,
  Layers,
  History,
  Boxes,
  BarChart3,
  CreditCard,
} from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout, hasPermission, isSuperAdmin } = useAuthStore((s) => ({
    user: s.user,
    logout: s.logout,
    hasPermission: s.hasPermission,
    isSuperAdmin: s.user?.is_super_admin ?? false,
  }));

  const navItems = [
    {
      title: 'Core Operations',
      items: [
        {
          label: 'Dashboard',
          href: '/dashboard',
          icon: LayoutDashboard,
          permission: 'dashboard.view',
        },
        {
          label: 'POS Terminal',
          href: '/pos',
          icon: UtensilsCrossed,
          permission: 'orders.create',
          badge: 'Live',
        },
        {
          label: 'Waiter Station',
          href: '/waiter',
          icon: UserCheck,
          permission: 'orders.create',
          badge: 'Mobile',
        },
        {
          label: 'Table Sessions',
          href: '/tables',
          icon: Grid,
          permission: 'tables.view',
        },
        {
          label: 'Kitchen KDS',
          href: '/kitchen',
          icon: ChefHat,
          permission: 'kitchen.view',
          badge: 'Live',
        },
        {
          label: 'Reservations',
          href: '/reservations',
          icon: CalendarDays,
          permission: 'reservations.view',
        },
        {
          label: 'Reports & Analytics',
          href: '/reports',
          icon: BarChart3,
          permission: 'dashboard.view',
        },
      ],
    },
    {
      title: 'Management',
      items: [
        {
          label: 'Restaurants & Branches',
          href: '/restaurants',
          icon: Store,
          permission: 'restaurants.view',
        },
        {
          label: 'SaaS Subscription',
          href: '/subscription',
          icon: CreditCard,
          permission: 'settings.view',
        },
        {
          label: 'Menu Catalog',
          href: '/menu',
          icon: Layers,
          permission: 'menu.view',
        },
        {
          label: 'Inventory & Stock',
          href: '/inventory',
          icon: Boxes,
          permission: 'inventory.view',
        },
        {
          label: 'Staff & Roles',
          href: '/users',
          icon: Users,
          permission: 'users.view',
        },
        {
          label: 'Permissions Matrix',
          href: '/roles',
          icon: ShieldCheck,
          permission: 'roles.view',
        },
      ],
    },
    {
      title: 'Auditing',
      items: [
        {
          label: 'Audit Trail',
          href: '/audit-logs',
          icon: History,
          permission: 'settings.view',
        },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-[#252525]/20 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 flex w-72 flex-col bg-white border-r border-black/[0.04] transition-transform duration-300 ease-in-out md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand Header */}
        <div className="flex h-20 items-center justify-between px-7 border-b border-black/[0.04]">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#B4D58A] text-[#252525] shadow-[0_6px_20px_rgba(180,213,138,0.4)] group-hover:scale-105 transition-transform font-bold">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <span className="font-baloo text-xl tracking-tight text-[#252525] block leading-none">
                Restaurant OS
              </span>
              <span className="text-[10px] font-semibold tracking-widest text-[#5A5D58] uppercase block mt-1">
                Multi-Tenant SaaS
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
          {navItems.map((group) => {
            const filteredItems = group.items.filter(
              (item) => isSuperAdmin || !item.permission || hasPermission(item.permission)
            );

            if (filteredItems.length === 0) return null;

            return (
              <div key={group.title} className="space-y-1.5">
                <p className="px-3.5 text-[10px] font-bold uppercase tracking-widest text-[#8E928B]">
                  {group.title}
                </p>
                <div className="space-y-1">
                  {filteredItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          "group flex items-center justify-between rounded-2xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
                          isActive
                            ? "bg-[#B4D58A] text-[#252525] font-bold shadow-[0_6px_20px_rgba(180,213,138,0.35)]"
                            : "text-[#5A5D58] hover:bg-[#F3DA8A]/25 hover:text-[#252525]"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={cn(
                            "h-4 w-4 transition-colors",
                            isActive ? "text-[#252525]" : "text-[#5A5D58] group-hover:text-[#252525]"
                          )} />
                          <span>{item.label}</span>
                        </div>
                        {item.badge ? (
                          <span className={cn(
                            "text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full",
                            isActive ? "bg-white/40 text-[#252525]" : "bg-[#F3DA8A]/40 text-[#252525]"
                          )}>
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer User Info */}
        <div className="p-4 border-t border-black/[0.04]">
          <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#F3DA8A]/20">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#B4D58A] text-sm font-bold text-[#252525] shadow-xs">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-[#252525]">
                  {user?.name || 'Staff User'}
                </p>
                <p className="truncate text-[11px] text-[#5A5D58] font-medium">
                  {user?.roles?.[0] || 'User'}
                </p>
              </div>
            </div>

            <button
              onClick={() => logout()}
              title="Sign Out"
              className="p-2 text-[#5A5D58] hover:text-[#252525] hover:bg-white rounded-xl transition-all cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
