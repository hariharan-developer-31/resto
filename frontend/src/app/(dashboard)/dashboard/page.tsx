'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  Store,
  GitBranch,
  Users,
  UtensilsCrossed,
  DollarSign,
  TrendingUp,
  CreditCard,
  Grid,
  CalendarDays,
  XCircle,
  History,
  ShieldCheck,
  Building,
  RefreshCw,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChefHat,
  Receipt,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';

export default function DashboardPage() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const user = useAuthStore((s) => s.user);
  const activeRestaurant = useAuthStore((s) => s.activeRestaurant);
  const activeBranch = useAuthStore((s) => s.activeBranch);
  const logout = useAuthStore((s) => s.logout);
  const isSuperAdmin = user?.is_super_admin ?? false;

  // Fetch live dashboard stats (global for Super Admin, tenant-scoped for staff)
  const { data: statsData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['dashboard-stats', isSuperAdmin ? 'global' : activeRestaurant?.id, activeBranch?.id],
    queryFn: async () => {
      const endpoint = isSuperAdmin ? 'super-admin/dashboard' : 'dashboard';
      const res = await apiRequest(endpoint);
      return res.data;
    },
    refetchInterval: 15000,
  });

  const overview = statsData?.overview || {
    total_restaurants: 0,
    total_branches: 0,
    total_users: 0,
    total_staff: 0,
    total_waiters: 0,
    total_orders: 0,
    today_revenue: 0,
    monthly_revenue: 0,
    pending_payments: 0,
    active_tables: 0,
    total_reservations: 0,
    cancelled_orders: 0,
  };

  const revenueTrends = statsData?.revenue_trends || [];
  const restaurantPerformance = statsData?.restaurant_performance || [];
  const recentOrders = statsData?.recent_orders || [];
  const recentActivities = statsData?.recent_activities || [];

  const metricsCards = [
    {
      title: "Today's Revenue",
      value: formatCurrency(overview.today_revenue),
      sub: 'Settled orders today',
      icon: DollarSign,
      color: 'text-[#B4D58A] bg-[#B4D58A]/20',
      highlight: true,
    },
    {
      title: 'Monthly Revenue',
      value: formatCurrency(overview.monthly_revenue),
      sub: 'This calendar month',
      icon: TrendingUp,
      color: 'text-[#B4D58A] bg-[#B4D58A]/25',
    },
    {
      title: 'Pending Payments',
      value: formatCurrency(overview.pending_payments),
      sub: 'Active open bills',
      icon: CreditCard,
      color: 'text-[#F3DA8A] bg-[#F3DA8A]/25',
    },
    {
      title: 'Active Tables',
      value: overview.active_tables,
      sub: 'Currently seated',
      icon: Grid,
      color: 'text-[#B4D58A] bg-[#EBF3FB]',
    },
    {
      title: 'Total Orders',
      value: overview.total_orders,
      sub: 'All-time volume',
      icon: UtensilsCrossed,
      color: 'text-[#B4D58A] bg-[#B4D58A]/20',
    },
    {
      title: 'Cancelled Orders',
      value: overview.cancelled_orders,
      sub: 'With logged audit reasons',
      icon: XCircle,
      color: 'text-[#F2AFC0] bg-[#F2AFC0]/20',
    },
    {
      title: 'Total Restaurants',
      value: overview.total_restaurants,
      sub: 'Active SaaS tenants',
      icon: Store,
      color: 'text-[#252525] bg-[#F3DA8A]/25',
    },
    {
      title: 'Total Branches',
      value: overview.total_branches,
      sub: 'Physical locations',
      icon: GitBranch,
      color: 'text-[#B4D58A] bg-[#B4D58A]/25',
    },
    {
      title: 'Total Staff',
      value: overview.total_staff,
      sub: 'Managers, Cashiers & Chefs',
      icon: Users,
      color: 'text-[#252525] bg-[#F3DA8A]/25',
    },
    {
      title: 'Total Waiters',
      value: overview.total_waiters,
      sub: 'Mobile ordering captains',
      icon: Users,
      color: 'text-[#F3DA8A] bg-[#F3DA8A]/25',
    },
    {
      title: 'Total Reservations',
      value: overview.total_reservations,
      sub: 'Confirmed bookings',
      icon: CalendarDays,
      color: 'text-[#B4D58A] bg-[#B4D58A]/20',
    },
    {
      title: 'System Users',
      value: overview.total_users,
      sub: 'All registered accounts',
      icon: ShieldCheck,
      color: 'text-[#B4D58A] bg-[#EBF3FB]',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-white border border-black/[0.06] shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="font-bold text-2xl sm:text-3xl font-semibold tracking-tight text-[#252525]">
              {isSuperAdmin ? 'Super Admin Control Center' : `${activeRestaurant?.name || 'Restaurant'} Dashboard`}
            </h1>
            <Badge variant="default" className="text-xs">
              {user?.roles?.[0] || 'Staff'}
            </Badge>
          </div>
          <p className="text-xs text-[#5A5D58]">
            {isSuperAdmin
              ? 'Multi-restaurant platform performance, financial telemetry and tenant operations'
              : `Managing operations for ${activeRestaurant?.name} • Branch: ${activeBranch?.name || 'Main'}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
          <Link href="/restaurants">
            <Button size="sm" className="gap-1.5 text-xs">
              <Store className="h-3.5 w-3.5" />
              Restaurants
            </Button>
          </Link>
        </div>
      </div>

      {/* 12 Metric Cards (Section 7 Requirements) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {metricsCards.map((m) => {
          const Icon = m.icon;
          return (
            <Card
              key={m.title}
              className={`border-black/[0.06] hover:border-[#D8D4CA] transition-all p-4 ${
                m.highlight ? 'bg-gradient-to-br from-white to-[#B4D58A]/20/30' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5A5D58] truncate">
                  {m.title}
                </span>
                <div className={`p-2 rounded-xl ${m.color} shrink-0`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                <p className="font-bold text-2xl font-bold tracking-tight text-[#252525]">
                  {m.value}
                </p>
                <p className="text-[11px] text-[#8E928B] truncate">{m.sub}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Charts Section: Revenue & Order Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend Area Chart (2 cols) */}
        <Card className="lg:col-span-2 border-black/[0.06]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">7-Day Revenue Trend</CardTitle>
                <CardDescription className="text-xs">
                  Daily settled revenue aggregated across all branches
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-xs font-mono">
                Real Database Aggregates
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-64 w-full">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#B4D58A" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#B4D58A" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="black/[0.04]" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke="#8E928B"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: 'black/[0.06]' }}
                    />
                    <YAxis
                      stroke="#8E928B"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: 'black/[0.06]' }}
                      tickFormatter={(val) => `₹${val}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '10px',
                        border: '1px solid black/[0.06]',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                        fontFamily: 'var(--font-dm-sans)',
                        fontSize: '12px',
                      }}
                      formatter={(value: any) => [`₹${Number(value).toFixed(2)}`, 'Revenue']}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#B4D58A"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Order Volume Bar Chart (1 col) */}
        <Card className="border-black/[0.06]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Daily Order Volume</CardTitle>
            <CardDescription className="text-xs">
              Completed and dine-in transaction count
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-64 w-full">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="black/[0.04]" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke="#8E928B"
                      fontSize={10}
                      tickLine={false}
                      axisLine={{ stroke: 'black/[0.06]' }}
                    />
                    <YAxis
                      stroke="#8E928B"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: 'black/[0.06]' }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '10px',
                        border: '1px solid black/[0.06]',
                        fontSize: '12px',
                      }}
                      formatter={(value: any) => [value, 'Orders']}
                    />
                    <Bar dataKey="orders" fill="#B4D58A" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Multi-Restaurant Performance Table */}
      <Card className="border-black/[0.06] overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-black/[0.04] flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Restaurant Tenant Performance</CardTitle>
            <CardDescription className="text-xs">
              Live operational comparison across active restaurant entities
            </CardDescription>
          </div>
          <Link href="/restaurants">
            <Button variant="outline" size="sm" className="gap-1 text-xs">
              Manage Restaurants <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF9F6] border-b border-black/[0.06] text-[#5A5D58] uppercase font-semibold">
              <tr>
                <th className="py-3 px-5">Restaurant</th>
                <th className="py-3 px-4">Branches</th>
                <th className="py-3 px-4">Active Seated Tables</th>
                <th className="py-3 px-4">Total Orders</th>
                <th className="py-3 px-4">Settled Revenue</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {restaurantPerformance.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[#5A5D58]">
                    No restaurants currently provisioned.
                  </td>
                </tr>
              ) : (
                restaurantPerformance.map((rp: any) => (
                  <tr key={rp.id} className="hover:bg-[#FAF9F6]/60 transition-colors">
                    <td className="py-3.5 px-5 font-semibold text-[#252525]">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-[#B4D58A]/20 text-[#B4D58A] font-bold flex items-center justify-center text-xs">
                          {rp.name.charAt(0)}
                        </div>
                        <div>
                          <span>{rp.name}</span>
                          <span className="text-[10px] text-[#5A5D58] block font-mono">
                            /{rp.slug}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#252525]">
                      {rp.branches_count} location{rp.branches_count !== 1 ? 's' : ''}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-[#B4D58A]">
                      {rp.active_tables} table{rp.active_tables !== 1 ? 's' : ''} occupied
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-[#252525]">
                      {rp.orders_count}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[#B4D58A]">
                      {rp.currency_symbol}{Number(rp.total_revenue).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Badge variant={rp.is_active ? 'success' : 'danger'} className="text-[10px]">
                        {rp.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Two Column Grid: Recent Orders & Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders Feed */}
        <Card className="border-black/[0.06]">
          <CardHeader className="p-5 pb-3 border-b border-black/[0.04] flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Recent Orders</CardTitle>
              <CardDescription className="text-xs">
                Latest transactions across dine-in and takeaway
              </CardDescription>
            </div>
            <Receipt className="h-4 w-4 text-[#5A5D58]" />
          </CardHeader>
          <div className="divide-y divide-black/[0.04]">
            {recentOrders.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#5A5D58]">No recent orders logged.</div>
            ) : (
              recentOrders.map((ord: any) => (
                <div key={ord.id} className="p-4 flex items-center justify-between hover:bg-[#FAF9F6]/50 transition-colors text-xs">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-[#FAF9F6] border border-black/[0.06] flex items-center justify-center font-semibold text-[#B4D58A]">
                      {ord.order_type === 'dine_in' ? 'DIN' : 'TAK'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#252525]">{ord.order_number}</span>
                        <span className="text-[11px] text-[#5A5D58]">• Table {ord.table_number}</span>
                      </div>
                      <span className="text-[11px] text-[#8E928B]">
                        {ord.restaurant_name} ({ord.branch_name}) • {ord.created_at}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-bold text-sm text-[#252525] block">
                      {ord.currency_symbol}{ord.total_amount.toFixed(2)}
                    </span>
                    <Badge
                      variant={
                        ord.payment_status === 'paid'
                          ? 'success'
                          : ord.order_status === 'cancelled'
                          ? 'danger'
                          : 'warning'
                      }
                      className="text-[10px]"
                    >
                      {ord.payment_status === 'paid' ? 'Paid' : ord.order_status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Recent Audit Logs Feed */}
        <Card className="border-black/[0.06]">
          <CardHeader className="p-5 pb-3 border-b border-black/[0.04] flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Audit Activity Trail</CardTitle>
              <CardDescription className="text-xs">
                Real-time security and operational events
              </CardDescription>
            </div>
            <Link href="/audit-logs">
              <Button variant="ghost" size="sm" className="text-xs gap-1 text-[#B4D58A]">
                Full Log <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <div className="divide-y divide-black/[0.04]">
            {recentActivities.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#5A5D58]">No activity logged yet.</div>
            ) : (
              recentActivities.map((act: any) => (
                <div key={act.id} className="p-4 flex items-center justify-between hover:bg-[#FAF9F6]/50 transition-colors text-xs">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-[#EBF3FB] text-[#B4D58A] flex items-center justify-center shrink-0">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-mono font-semibold text-[#252525] block">
                        {act.action}
                      </span>
                      <span className="text-[11px] text-[#5A5D58]">
                        by <strong>{act.user_name}</strong> • {act.restaurant_name}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] text-[#8E928B] font-mono shrink-0">
                    {act.created_at}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
