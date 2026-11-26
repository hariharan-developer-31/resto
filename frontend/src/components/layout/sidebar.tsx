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
  Receipt,
  CalendarDays,
  ShieldCheck,
  Settings,
  LogOut,
  ChevronRight,
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
          badge: 'Phase 3',
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
          badge: 'Phase 7',
        },
        {
          label: 'Reports & Analytics',
          href: '/reports',
          icon: BarChart3,
          permission: 'dashboard.view',
          badge: 'Phase 8',
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
          badge: 'Phase 2',
        },
        {
          label: 'SaaS Subscription',
          href: '/subscription',
          icon: CreditCard,
          permission: 'settings.view',
          badge: 'Phase 8',
        },
        {
          label: 'Menu Catalog',
          href: '/menu',
          icon: Layers,
          permission: 'menu.view',
          badge: 'Phase 3',
        },
        {
          label: 'Inventory & Stock',
          href: '/inventory',
          icon: Boxes,
          permission: 'inventory.view',
          badge: 'Phase 7',
        },
        {
          label: 'Staff & Roles',
          href: '/users',
          icon: Users,
          permission: 'users.view',
          badge: 'Phase 2',
        },
        {
          label: 'Permissions Matrix',
          href: '/roles',
          icon: ShieldCheck,
          permission: 'roles.view',
          badge: 'Phase 2',
        },
      ],
    },
    {
      title: 'Auditing & System',
      items: [
        {
          label: 'Audit Trail',
          href: '/audit-logs',
          icon: History,
          permission: 'settings.view',
        },
        {
          label: 'System Settings',
          href: '/settings',
          icon: Settings,
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
          className="fixed inset-0 z-40 bg-[#292B28]/20 backdrop-blur-xs md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 flex w-72 flex-col border-r border-[#EAE7E0] bg-[#FFFFFF] transition-transform duration-200 ease-in-out md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand Header */}
        <div className="flex h-18 items-center justify-between border-b border-[#EAE7E0] px-6">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C76B4A] text-white shadow-xs group-hover:bg-[#AE593B] transition-colors">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <span className="font-serif text-lg font-semibold tracking-tight text-[#292B28] block leading-none">
                Restaurant OS
              </span>
              <span className="text-[11px] font-medium tracking-wider text-[#777872] uppercase block mt-1">
                Multi-Tenant SaaS
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {navItems.map((group) => {
            const filteredItems = group.items.filter(
              (item) => isSuperAdmin || !item.permission || hasPermission(item.permission)
            );

            if (filteredItems.length === 0) return null;

            return (
              <div key={group.title} className="space-y-1">
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-[#A2A29A]">
                  {group.title}
                </p>
                <div className="mt-1.5 space-y-0.5">
                  {filteredItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          "group flex items-center justify-between rounded-[10px] px-3 py-2 text-sm font-medium transition-all duration-150",
                          isActive
                            ? "bg-[#F8EAE3] text-[#AE593B]"
                            : "text-[#777872] hover:bg-[#FAF8F4] hover:text-[#292B28]"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={cn(
                            "h-4 w-4 transition-colors",
                            isActive ? "text-[#C76B4A]" : "text-[#777872] group-hover:text-[#292B28]"
                          )} />
                          <span>{item.label}</span>
                        </div>
                        {item.badge ? (
                          <span className="text-[10px] uppercase font-semibold tracking-wider text-[#A2A29A] bg-[#FAF8F4] border border-[#EAE7E0] px-1.5 py-0.5 rounded">
                            {item.badge}
                          </span>
                        ) : isActive ? (
                          <div className="h-1.5 w-1.5 rounded-full bg-[#C76B4A]" />
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
        <div className="border-t border-[#EAE7E0] p-4 bg-[#FAF8F4]/50">
          <div className="flex items-center justify-between gap-3 p-2 rounded-xl bg-white border border-[#EAE7E0]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F8EAE3] text-sm font-semibold text-[#C76B4A]">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-[#292B28]">
                  {user?.name || 'Staff User'}
                </p>
                <p className="truncate text-[11px] text-[#777872]">
                  {user?.roles?.[0] || 'User'}
                </p>
              </div>
            </div>

            <button
              onClick={() => logout()}
              title="Sign Out"
              className="p-1.5 text-[#777872] hover:text-[#C84D4D] hover:bg-[#FDF0F0] rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
