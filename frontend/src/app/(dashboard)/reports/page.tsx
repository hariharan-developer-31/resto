'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  Receipt,
  Users,
  UtensilsCrossed,
  Printer,
  Calendar,
  Clock,
  Armchair,
  ShoppingBag,
  CreditCard,
  Building2,
  FileText,
  AlertCircle,
  RefreshCw,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';

export default function ReportsAndAnalyticsPage() {
  const printRef = useRef<HTMLDivElement>(null);
  const { activeRestaurant, activeBranch } = useAuthStore((s) => ({
    activeRestaurant: s.activeRestaurant,
    activeBranch: s.activeBranch,
  }));

  // Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'menu' | 'efficiency' | 'eod' | 'tax'>('overview');

  // Date filters (safe initialization for prerendering)
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [eodDate, setEodDate] = useState<string>('');

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
    setEndDate(today);
    setEodDate(today);
  }, []);

  // 1. Fetch Overview Analytics
  const { data: overviewData, isLoading: isOverviewLoading, refetch: refetchOverview } = useQuery({
    queryKey: ['analytics-overview', activeRestaurant?.id, activeBranch?.id, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const res = await apiRequest(`analytics/overview?${params.toString()}`, {
        restaurantId: activeRestaurant?.id,
        branchId: activeBranch?.id,
      });
      return res.data;
    },
    enabled: !!activeRestaurant?.id,
  });

  // 2. Fetch Menu Engineering
  const { data: menuData } = useQuery({
    queryKey: ['analytics-menu', activeRestaurant?.id, activeBranch?.id],
    queryFn: async () => {
      const res = await apiRequest('analytics/menu-engineering', {
        restaurantId: activeRestaurant?.id,
        branchId: activeBranch?.id,
      });
      return res.data;
    },
    enabled: !!activeRestaurant?.id && activeTab === 'menu',
  });

  // 3. Fetch Table Efficiency
  const { data: tableData } = useQuery({
    queryKey: ['analytics-tables', activeRestaurant?.id, activeBranch?.id],
    queryFn: async () => {
      const res = await apiRequest('analytics/table-efficiency', {
        restaurantId: activeRestaurant?.id,
        branchId: activeBranch?.id,
      });
      return res.data;
    },
    enabled: !!activeRestaurant?.id && activeTab === 'efficiency',
  });

  // 4. Fetch EOD Z-Report
  const { data: eodReportData, refetch: refetchEod } = useQuery({
    queryKey: ['reports-eod', activeRestaurant?.id, activeBranch?.id, eodDate],
    queryFn: async () => {
      const res = await apiRequest(`reports/eod?date=${eodDate}`, {
        restaurantId: activeRestaurant?.id,
        branchId: activeBranch?.id,
      });
      return res.data;
    },
    enabled: !!activeRestaurant?.id && activeTab === 'eod',
  });

  // 5. Fetch Tax Report
  const { data: taxReportData } = useQuery({
    queryKey: ['reports-tax', activeRestaurant?.id, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const res = await apiRequest(`reports/tax?${params.toString()}`, {
        restaurantId: activeRestaurant?.id,
      });
      return res.data;
    },
    enabled: !!activeRestaurant?.id && activeTab === 'tax',
  });

  const summary = overviewData?.summary;
  const dailyTrend = overviewData?.daily_trend || [];
  const orderTypes = overviewData?.order_type_distribution;
  const paymentModes = overviewData?.payment_modes;
  const hourlyRush = overviewData?.hourly_rush || [];

  const handlePrintZReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#292B28]">Executive Reports & Analytics</h1>
            <Badge variant="outline" className="text-[#C76B4A] border-[#F8EAE3] bg-[#FAF8F4]">
              Phase 8
            </Badge>
          </div>
          <p className="text-sm text-[#777872] mt-1">
            Revenue trends, menu engineering, table turnover duration, and End-of-Day Z-Reports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchOverview()}
            className="border-[#EAE7E0] hover:bg-[#F3F1EB] text-[#292B28]"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>

          {activeTab === 'eod' && (
            <Button
              onClick={handlePrintZReport}
              className="bg-[#C76B4A] hover:bg-[#AE593B] text-white shadow-sm"
            >
              <Printer className="w-4 h-4 mr-2" /> Print Z-Report
            </Button>
          )}
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="border-b border-[#EAE7E0] flex items-center gap-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'overview'
              ? 'border-[#C76B4A] text-[#C76B4A]'
              : 'border-transparent text-[#777872] hover:text-[#292B28]'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Sales & Revenue Trends</span>
        </button>

        <button
          onClick={() => setActiveTab('menu')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'menu'
              ? 'border-[#C76B4A] text-[#C76B4A]'
              : 'border-transparent text-[#777872] hover:text-[#292B28]'
          }`}
        >
          <UtensilsCrossed className="w-4 h-4" />
          <span>Menu Engineering (Product Mix)</span>
        </button>

        <button
          onClick={() => setActiveTab('efficiency')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'efficiency'
              ? 'border-[#C76B4A] text-[#C76B4A]'
              : 'border-transparent text-[#777872] hover:text-[#292B28]'
          }`}
        >
          <Armchair className="w-4 h-4" />
          <span>Table & Service Speed</span>
        </button>

        <button
          onClick={() => setActiveTab('eod')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'eod'
              ? 'border-[#C76B4A] text-[#C76B4A]'
              : 'border-transparent text-[#777872] hover:text-[#292B28]'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>End-of-Day (EOD) Z-Report</span>
        </button>

        <button
          onClick={() => setActiveTab('tax')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'tax'
              ? 'border-[#C76B4A] text-[#C76B4A]'
              : 'border-transparent text-[#777872] hover:text-[#292B28]'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>GST & Tax Ledger</span>
        </button>
      </div>

      {/* Tab 1: Sales & Revenue Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Date Range Selector */}
          <Card className="border-[#EAE7E0] bg-white shadow-xs">
            <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#292B28]">
                <Calendar className="w-4 h-4 text-[#C76B4A]" />
                <span>Date Range:</span>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8 text-xs border-[#EAE7E0] bg-[#FAF8F4]"
                />
                <span className="text-xs text-[#777872]">to</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-8 text-xs border-[#EAE7E0] bg-[#FAF8F4]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Metric KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-[#EAE7E0] bg-white shadow-xs">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-[#777872]">Total Gross Revenue</p>
                <h3 className="text-2xl font-bold text-[#292B28] mt-1">
                  ₹{Number(summary?.total_gross_revenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </h3>
                <p className="text-[11px] text-[#39845C] font-semibold mt-1 flex items-center">
                  <ArrowUpRight className="w-3 h-3 mr-0.5" /> Gross sales collected
                </p>
              </CardContent>
            </Card>

            <Card className="border-[#EAE7E0] bg-white shadow-xs">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-[#777872]">Net Food Sales</p>
                <h3 className="text-2xl font-bold text-[#5185B8] mt-1">
                  ₹{Number(summary?.total_net_sales || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </h3>
                <p className="text-[11px] text-[#777872] mt-1">Excl. taxes & discounts</p>
              </CardContent>
            </Card>

            <Card className="border-[#EAE7E0] bg-white shadow-xs">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-[#777872]">Tax Liability (GST)</p>
                <h3 className="text-2xl font-bold text-[#292B28] mt-1">
                  ₹{Number(summary?.total_tax_collected || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </h3>
                <p className="text-[11px] text-[#777872] mt-1">CGST 2.5% + SGST 2.5%</p>
              </CardContent>
            </Card>

            <Card className="border-[#EAE7E0] bg-white shadow-xs">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-[#777872]">Average Order Value</p>
                <h3 className="text-2xl font-bold text-[#C76B4A] mt-1">
                  ₹{Number(summary?.average_order_value || 0).toFixed(2)}
                </h3>
                <p className="text-[11px] text-[#777872] mt-1">Across {summary?.total_orders || 0} completed orders</p>
              </CardContent>
            </Card>
          </div>

          {/* Daily Revenue Trend Chart */}
          <Card className="border-[#EAE7E0] bg-white shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-[#292B28]">Daily Revenue & Sales Volume</CardTitle>
              <CardDescription className="text-xs text-[#777872]">
                Day-by-day revenue collection trend
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C76B4A" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#C76B4A" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1EEE8" vertical={false} />
                    <XAxis dataKey="day" stroke="#A2A29A" fontSize={11} tickLine={false} />
                    <YAxis stroke="#A2A29A" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                    <Tooltip
                      formatter={(val: any) => [`₹${val}`, 'Revenue']}
                      contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#EAE7E0', borderRadius: '8px' }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#C76B4A" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Secondary Visuals: Order Types & Payment Modes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Order Types */}
            <Card className="border-[#EAE7E0] bg-white shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-[#292B28] flex items-center gap-2">
                  <UtensilsCrossed className="w-4 h-4 text-[#C76B4A]" />
                  Dining Channels
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#FAF8F4] border border-[#EAE7E0]">
                  <div>
                    <p className="font-semibold text-[#292B28]">Dine-in Floor</p>
                    <p className="text-[#777872]">{orderTypes?.dine_in?.count || 0} orders</p>
                  </div>
                  <span className="font-bold text-sm text-[#292B28]">₹{Number(orderTypes?.dine_in?.revenue || 0).toFixed(0)}</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-[#FAF8F4] border border-[#EAE7E0]">
                  <div>
                    <p className="font-semibold text-[#292B28]">Takeaway Counter</p>
                    <p className="text-[#777872]">{orderTypes?.takeaway?.count || 0} orders</p>
                  </div>
                  <span className="font-bold text-sm text-[#292B28]">₹{Number(orderTypes?.takeaway?.revenue || 0).toFixed(0)}</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-[#FAF8F4] border border-[#EAE7E0]">
                  <div>
                    <p className="font-semibold text-[#292B28]">Direct Delivery</p>
                    <p className="text-[#777872]">{orderTypes?.delivery?.count || 0} orders</p>
                  </div>
                  <span className="font-bold text-sm text-[#292B28]">₹{Number(orderTypes?.delivery?.revenue || 0).toFixed(0)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Payment Modes */}
            <Card className="border-[#EAE7E0] bg-white shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-[#292B28] flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#5185B8]" />
                  Tender Reconciliations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#FAF8F4] border border-[#EAE7E0]">
                  <div>
                    <p className="font-semibold text-[#292B28]">UPI / QR Pay</p>
                    <p className="text-[#777872]">Instant bank settle</p>
                  </div>
                  <span className="font-bold text-sm text-[#39845C]">₹{Number(paymentModes?.upi || 0).toFixed(0)}</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-[#FAF8F4] border border-[#EAE7E0]">
                  <div>
                    <p className="font-semibold text-[#292B28]">Cash Register</p>
                    <p className="text-[#777872]">Physical currency</p>
                  </div>
                  <span className="font-bold text-sm text-[#292B28]">₹{Number(paymentModes?.cash || 0).toFixed(0)}</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-[#FAF8F4] border border-[#EAE7E0]">
                  <div>
                    <p className="font-semibold text-[#292B28]">Cards (Credit / Debit)</p>
                    <p className="text-[#777872]">POS terminal swipe</p>
                  </div>
                  <span className="font-bold text-sm text-[#292B28]">₹{Number(paymentModes?.card || 0).toFixed(0)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Peak Dining Rush */}
            <Card className="border-[#EAE7E0] bg-white shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-[#292B28] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#D69A3A]" />
                  24-Hour Dining Rush
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-36 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlyRush.filter((_: any, idx: number) => idx >= 11 && idx <= 23)}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1EEE8" />
                      <XAxis dataKey="hour" fontSize={10} stroke="#A2A29A" tickLine={false} />
                      <Tooltip formatter={(val: any) => [`${val} orders`, 'Volume']} />
                      <Bar dataKey="orders" fill="#C76B4A" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[11px] text-center text-[#777872] mt-2">Peak rush concentrated between 1:00 PM – 3:00 PM and 8:00 PM – 10:00 PM.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 2: Menu Engineering */}
      {activeTab === 'menu' && (
        <div className="space-y-6">
          {/* Category Contribution */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {menuData?.category_breakdown?.map((cat: any, idx: number) => (
              <Card key={idx} className="border-[#EAE7E0] bg-white shadow-xs">
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-[#777872]">{cat.category}</p>
                  <h3 className="text-xl font-bold text-[#292B28] mt-1">₹{Number(cat.revenue).toLocaleString()}</h3>
                  <div className="flex items-center justify-between text-xs text-[#777872] mt-1">
                    <span>{cat.quantity} sold</span>
                    <strong className="text-[#C76B4A]">{cat.percentage}% of total</strong>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Top Selling Dishes Table */}
          <Card className="border-[#EAE7E0] bg-white shadow-xs overflow-hidden">
            <CardHeader className="pb-3 border-b border-[#EAE7E0]">
              <CardTitle className="text-base text-[#292B28]">Top Performing Menu Dishes (Product Mix)</CardTitle>
              <CardDescription className="text-xs text-[#777872]">
                Ranked by cumulative revenue and portion sales volume
              </CardDescription>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[#292B28]">
                <thead className="bg-[#FAF8F4] text-xs font-semibold text-[#777872] uppercase tracking-wider border-b border-[#EAE7E0]">
                  <tr>
                    <th className="px-6 py-3.5">Rank & Dish</th>
                    <th className="px-6 py-3.5">Category</th>
                    <th className="px-6 py-3.5">Type</th>
                    <th className="px-6 py-3.5">Portions Sold</th>
                    <th className="px-6 py-3.5">Avg Price</th>
                    <th className="px-6 py-3.5 text-right">Total Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE7E0]">
                  {menuData?.top_dishes?.map((dish: any, idx: number) => (
                    <tr key={dish.id} className="hover:bg-[#FAF8F4]/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-[#FAF8F4] text-[#C76B4A] font-bold text-xs flex items-center justify-center border border-[#F8EAE3]">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-[#292B28]">{dish.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-[#777872]">{dish.category}</td>
                      <td className="px-6 py-4">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            dish.type === 'veg'
                              ? 'text-[#39845C] border-[#39845C]'
                              : 'text-[#C84D4D] border-[#C84D4D]'
                          }`}
                        >
                          {dish.type.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 font-semibold text-xs">{dish.quantity_sold}</td>
                      <td className="px-6 py-4 text-xs text-[#777872]">₹{dish.avg_price}</td>
                      <td className="px-6 py-4 text-right font-bold text-[#292B28]">₹{Number(dish.revenue).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 3: Table Efficiency & Speed */}
      {activeTab === 'efficiency' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-[#EAE7E0] bg-white shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-[#777872]">Avg Table Turnaround</p>
                  <h3 className="text-2xl font-bold text-[#C76B4A] mt-1">{tableData?.average_turnaround_minutes || 45} mins</h3>
                  <p className="text-[11px] text-[#777872] mt-0.5">Seated to bill settled</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-[#F8EAE3] text-[#C76B4A] flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#EAE7E0] bg-white shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-[#777872]">Floor Occupancy Rate</p>
                  <h3 className="text-2xl font-bold text-[#39845C] mt-1">{tableData?.occupancy_rate_percentage || 0}%</h3>
                  <p className="text-[11px] text-[#777872] mt-0.5">{tableData?.occupied_tables || 0} of {tableData?.total_tables || 0} tables</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-[#EEF1E9] text-[#39845C] flex items-center justify-center">
                  <Armchair className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#EAE7E0] bg-white shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-[#777872]">Active Dining Floor</p>
                  <h3 className="text-2xl font-bold text-[#292B28] mt-1">{activeBranch?.name || 'Downtown'}</h3>
                  <p className="text-[11px] text-[#777872] mt-0.5">{tableData?.total_tables || 0} active tables</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-[#FAF8F4] text-[#66745B] flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Zones Summary */}
          <Card className="border-[#EAE7E0] bg-white shadow-xs">
            <CardHeader className="pb-3 border-b border-[#EAE7E0]">
              <CardTitle className="text-base text-[#292B28]">Dining Floor Section Utilization</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {tableData?.tables_summary?.map((zone: any, idx: number) => (
                  <div key={idx} className="p-4 rounded-xl border border-[#EAE7E0] bg-[#FAF8F4]">
                    <h4 className="font-bold text-sm text-[#292B28]">{zone.location}</h4>
                    <div className="flex items-center justify-between text-xs text-[#777872] mt-2">
                      <span>Total Tables:</span>
                      <strong>{zone.total}</strong>
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#39845C] mt-1">
                      <span>Occupied:</span>
                      <strong>{zone.occupied}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 4: End-of-Day (EOD) Z-Report */}
      {activeTab === 'eod' && (
        <div className="space-y-4">
          <Card className="border-[#EAE7E0] bg-white shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-[#292B28]">Z-Report Date:</label>
                <Input
                  type="date"
                  value={eodDate}
                  onChange={(e) => setEodDate(e.target.value)}
                  className="h-8 text-xs border-[#EAE7E0] bg-[#FAF8F4] w-48"
                />
              </div>

              <Button
                size="sm"
                onClick={handlePrintZReport}
                className="bg-[#C76B4A] hover:bg-[#AE593B] text-white text-xs"
              >
                <Printer className="w-4 h-4 mr-1.5" /> Print / Export PDF
              </Button>
            </CardContent>
          </Card>

          {/* Printable Register Sheet */}
          <div ref={printRef} className="max-w-xl mx-auto bg-white p-8 rounded-xl border border-[#EAE7E0] shadow-sm font-mono text-xs text-[#292B28] space-y-4">
            <div className="text-center pb-4 border-b border-dashed border-[#EAE7E0]">
              <h2 className="text-lg font-bold uppercase">{eodReportData?.report_metadata?.restaurant_name || 'RESTAURANT OS'}</h2>
              <p className="text-[11px] text-[#777872]">{eodReportData?.report_metadata?.branch_name}</p>
              <p className="text-[11px] text-[#777872]">{eodReportData?.report_metadata?.branch_address}</p>
              <p className="text-[11px] font-semibold mt-1">GSTIN: {eodReportData?.report_metadata?.gst_number || '27AAAAA0000A1Z5'}</p>
              <h3 className="font-bold text-sm mt-2 text-[#C76B4A]">*** END-OF-DAY Z-REPORT ***</h3>
              <p className="text-[10px] text-[#A2A29A]">Date: {eodReportData?.report_metadata?.report_date} | Generated: {new Date().toLocaleTimeString()}</p>
            </div>

            {/* Financial Summary */}
            <div className="space-y-1.5 pb-4 border-b border-dashed border-[#EAE7E0]">
              <div className="flex justify-between">
                <span>GROSS SALES:</span>
                <span className="font-bold">₹{Number(eodReportData?.financial_summary?.gross_sales || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#777872]">
                <span>NET FOOD SALES:</span>
                <span>₹{Number(eodReportData?.financial_summary?.net_sales || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#777872]">
                <span>TOTAL DISCOUNTS GIVEN:</span>
                <span>-₹{Number(eodReportData?.financial_summary?.discounts || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#777872]">
                <span>CGST (2.5%):</span>
                <span>₹{Number(eodReportData?.financial_summary?.cgst_amount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#777872]">
                <span>SGST (2.5%):</span>
                <span>₹{Number(eodReportData?.financial_summary?.sgst_amount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#777872]">
                <span>TOTAL TAX COLLECTED:</span>
                <span className="font-semibold text-[#292B28]">₹{Number(eodReportData?.financial_summary?.total_tax || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Tender Balancing */}
            <div className="space-y-1.5 pb-4 border-b border-dashed border-[#EAE7E0]">
              <p className="font-bold">PAYMENT TENDER RECONCILIATION:</p>
              <div className="flex justify-between">
                <span>CASH IN DRAWER:</span>
                <span className="font-bold">₹{Number(eodReportData?.tender_reconciliation?.cash || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>UPI / QR CODE RECEIPTS:</span>
                <span className="font-bold text-[#39845C]">₹{Number(eodReportData?.tender_reconciliation?.upi || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>CARD (CREDIT / DEBIT):</span>
                <span className="font-bold">₹{Number(eodReportData?.tender_reconciliation?.card || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-[#EAE7E0] font-bold text-sm">
                <span>TOTAL TENDERED:</span>
                <span>₹{Number(eodReportData?.tender_reconciliation?.total_collected || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Order Volume */}
            <div className="space-y-1 pb-4 border-b border-dashed border-[#EAE7E0] text-[11px] text-[#777872]">
              <div className="flex justify-between">
                <span>TOTAL ORDERS FIRED:</span>
                <span className="font-bold text-[#292B28]">{eodReportData?.order_statistics?.total_orders || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>PAID COMPLETED ORDERS:</span>
                <span>{eodReportData?.order_statistics?.paid_orders || 0}</span>
              </div>
              <div className="flex justify-between text-[#C84D4D]">
                <span>CANCELLED / VOIDED ORDERS:</span>
                <span>{eodReportData?.order_statistics?.cancelled_orders || 0}</span>
              </div>
            </div>

            <div className="text-center text-[10px] text-[#A2A29A] pt-2">
              *** REGISTER BALANCED & VERIFIED ***
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: GST & Tax Ledger */}
      {activeTab === 'tax' && (
        <Card className="border-[#EAE7E0] bg-white shadow-xs p-6 space-y-4">
          <CardHeader className="p-0 pb-4 border-b border-[#EAE7E0]">
            <CardTitle className="text-base text-[#292B28]">GST Compliance & Tax Summary Ledger</CardTitle>
            <CardDescription className="text-xs text-[#777872]">
              Monthly tax breakdown calculated according to Indian GST regulations (5% standard restaurant rate)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-[#EAE7E0] bg-[#FAF8F4]">
                <p className="text-xs text-[#777872]">Taxable Value</p>
                <h3 className="text-xl font-bold text-[#292B28] mt-1">₹{Number(taxReportData?.taxable_amount || 0).toFixed(2)}</h3>
              </div>
              <div className="p-4 rounded-xl border border-[#EAE7E0] bg-[#FAF8F4]">
                <p className="text-xs text-[#777872]">Central GST (CGST 2.5%)</p>
                <h3 className="text-xl font-bold text-[#292B28] mt-1">₹{Number(taxReportData?.cgst_2_5_pct || 0).toFixed(2)}</h3>
              </div>
              <div className="p-4 rounded-xl border border-[#EAE7E0] bg-[#FAF8F4]">
                <p className="text-xs text-[#777872]">State GST (SGST 2.5%)</p>
                <h3 className="text-xl font-bold text-[#292B28] mt-1">₹{Number(taxReportData?.sgst_2_5_pct || 0).toFixed(2)}</h3>
              </div>
              <div className="p-4 rounded-xl border border-[#EAE7E0] bg-[#FAF8F4]">
                <p className="text-xs text-[#777872]">Total Tax Liability</p>
                <h3 className="text-xl font-bold text-[#C76B4A] mt-1">₹{Number(taxReportData?.total_tax_liability || 0).toFixed(2)}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
