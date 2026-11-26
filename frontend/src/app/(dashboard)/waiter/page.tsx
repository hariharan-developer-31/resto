'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  UserCheck,
  Grid,
  UtensilsCrossed,
  Search,
  Plus,
  Minus,
  CheckCircle2,
  Clock,
  Flame,
  Check,
  AlertCircle,
  X,
  Send,
  Coffee,
  RotateCcw,
  Sparkles,
  Users,
} from 'lucide-react';

interface DiningTable {
  id: number;
  table_number: string;
  seating_capacity: number;
  location: string;
  status: 'available' | 'occupied' | 'reserved' | 'billed' | 'cleaning' | 'out_of_service';
  waiter_id?: number;
  waiter?: { id: number; name: string };
  active_order?: any;
}

interface MenuItem {
  id: number;
  name: string;
  category_id: number;
  type: string;
  base_price: number;
  is_available: boolean;
  kitchen_station: string;
}

export default function WaiterPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [filterMode, setFilterMode] = useState<'my_tables' | 'all' | 'occupied' | 'ready'>('all');
  const [selectedTable, setSelectedTable] = useState<DiningTable | null>(null);

  // Rapid Order Pad State
  const [orderPadOpen, setOrderPadOpen] = useState(false);
  const [padSearch, setPadSearch] = useState('');
  const [padCategory, setPadCategory] = useState<string>('all');
  const [padCart, setPadCart] = useState<{ menuItemId: number; name: string; price: number; quantity: number }[]>([]);
  const [padNote, setPadNote] = useState('');

  // Status Change Dialog
  const [statusDialogTable, setStatusDialogTable] = useState<DiningTable | null>(null);

  // Queries
  const { data: tables = [], isLoading: tablesLoading } = useQuery({
    queryKey: ['tables'],
    queryFn: async () => {
      const res = await apiClient.get<any[]>('/tables');
      return res.data || [];
    },
    refetchInterval: 5000, // Poll every 5s for real-time kitchen updates
  });

  const { data: activeOrders = [] } = useQuery({
    queryKey: ['active-orders'],
    queryFn: async () => {
      const res = await apiClient.get<any>('/orders?active_only=true');
      return res.data?.data || [];
    },
    refetchInterval: 5000,
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menu-items'],
    queryFn: async () => {
      const res = await apiClient.get<any>('/menu-items');
      return res.data?.data || res.data || [];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await apiClient.get<any[]>('/categories');
      return res.data || [];
    },
  });

  // Map Active Orders to Tables
  const tablesWithOrders = useMemo(() => {
    return tables.map((tbl: DiningTable) => {
      const active = activeOrders.find((o: any) => o.table_id === tbl.id);
      return {
        ...tbl,
        active_order: active || null,
      };
    });
  }, [tables, activeOrders]);

  // Filter Tables
  const filteredTables = useMemo(() => {
    return tablesWithOrders.filter((tbl: any) => {
      if (filterMode === 'my_tables') {
        return tbl.waiter_id === user?.id;
      }
      if (filterMode === 'occupied') {
        return tbl.status === 'occupied';
      }
      if (filterMode === 'ready') {
        // Table has items in kitchen ready to serve
        return tbl.active_order?.items?.some((i: any) => i.status === 'ready');
      }
      return true;
    });
  }, [tablesWithOrders, filterMode, user?.id]);

  // Stats
  const myTablesCount = tables.filter((t: DiningTable) => t.waiter_id === user?.id).length;
  const occupiedCount = tables.filter((t: DiningTable) => t.status === 'occupied').length;
  const readyDishesCount = activeOrders.reduce((sum: number, o: any) => {
    return sum + (o.items?.filter((i: any) => i.status === 'ready').length || 0);
  }, 0);

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: async ({ tableId, status }: { tableId: number; status: string }) => {
      const res = await apiClient.post<any>(`/tables/${tableId}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      setStatusDialogTable(null);
    },
  });

  const updateItemStatusMutation = useMutation({
    mutationFn: async ({ itemId, status }: { itemId: number; status: string }) => {
      const res = await apiClient.patch<any>(`/order-items/${itemId}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-orders'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
  });

  const fireOrderMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTable) return;
      const res = await apiClient.post<any>('/orders', {
        order_type: 'dine_in',
        table_id: selectedTable.id,
        items: padCart.map((item) => ({
          menu_item_id: item.menuItemId,
          quantity: item.quantity,
          special_instructions: padNote || undefined,
        })),
      });
      return res.data;
    },
    onSuccess: () => {
      setOrderPadOpen(false);
      setPadCart([]);
      setPadNote('');
      queryClient.invalidateQueries({ queryKey: ['active-orders'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
  });

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-black/[0.06] p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-[#C2B0DC]/20 text-[#C2B0DC] flex items-center justify-center font-bold text-lg shrink-0">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[#252525]">Waiter Station</h1>
              <Badge variant="success" className="text-[10px]">
                Active Floor Shift
              </Badge>
            </div>
            <p className="text-xs text-[#5A5D58] mt-0.5">
              Logged in as <strong className="text-[#252525]">{user?.name}</strong> · Real-time kitchen & floor sync
            </p>
          </div>
        </div>

        {/* Quick Counters */}
        <div className="flex items-center gap-2 sm:gap-3 bg-[#FAF9F6] p-1.5 rounded-xl border border-black/[0.06]">
          <div className="px-3 py-1 text-center border-r border-black/[0.06]">
            <span className="block text-xs text-[#5A5D58]">My Tables</span>
            <span className="text-sm font-bold text-[#252525]">{myTablesCount}</span>
          </div>
          <div className="px-3 py-1 text-center border-r border-black/[0.06]">
            <span className="block text-xs text-[#5A5D58]">Occupied</span>
            <span className="text-sm font-bold text-[#C2B0DC]">{occupiedCount}</span>
          </div>
          <div className="px-3 py-1 text-center">
            <span className="block text-xs text-[#5A5D58]">Ready to Serve</span>
            <span className="text-sm font-bold text-[#B4D58A]">{readyDishesCount}</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterMode('all')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition-all ${
            filterMode === 'all'
              ? 'bg-[#252525] text-white shadow-xs'
              : 'bg-white text-[#5A5D58] border border-black/[0.06] hover:bg-[#F3DA8A]/25'
          }`}
        >
          All Tables ({tables.length})
        </button>
        <button
          onClick={() => setFilterMode('my_tables')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition-all ${
            filterMode === 'my_tables'
              ? 'bg-[#C2B0DC] text-white shadow-xs'
              : 'bg-white text-[#5A5D58] border border-black/[0.06] hover:bg-[#F3DA8A]/25'
          }`}
        >
          My Assigned Tables ({myTablesCount})
        </button>
        <button
          onClick={() => setFilterMode('occupied')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition-all ${
            filterMode === 'occupied'
              ? 'bg-[#C2B0DC] text-white shadow-xs'
              : 'bg-white text-[#5A5D58] border border-black/[0.06] hover:bg-[#F3DA8A]/25'
          }`}
        >
          Occupied Tables ({occupiedCount})
        </button>
        <button
          onClick={() => setFilterMode('ready')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition-all flex items-center gap-1.5 ${
            filterMode === 'ready'
              ? 'bg-[#B4D58A] text-white shadow-xs'
              : 'bg-white text-[#B4D58A] border border-[#B4D58A]/30 hover:bg-[#B4D58A]/25'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Ready to Serve ({readyDishesCount})
        </button>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredTables.map((tbl: any) => {
          const isOccupied = tbl.status === 'occupied';
          const isMyTable = tbl.waiter_id === user?.id;
          const hasReadyDishes = tbl.active_order?.items?.some((i: any) => i.status === 'ready');

          return (
            <Card
              key={tbl.id}
              className={`rounded-2xl border transition-all overflow-hidden ${
                hasReadyDishes
                  ? 'border-[#B4D58A] ring-2 ring-[#B4D58A]/20 shadow-sm'
                  : isOccupied
                  ? 'border-[#CFE2F7] bg-white'
                  : 'border-black/[0.06] bg-white'
              }`}
            >
              <CardContent className="p-4 space-y-3">
                {/* Top Table Info */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-[#252525]">{tbl.table_number}</h3>
                      {isMyTable && (
                        <span className="text-[10px] bg-[#C2B0DC]/20 text-[#C2B0DC] px-1.5 py-0.5 rounded font-bold">
                          Assigned to You
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[#5A5D58] block mt-0.5">
                      {tbl.location} · {tbl.seating_capacity} Seats
                    </span>
                  </div>

                  {/* Status Dropdown Trigger */}
                  <button
                    onClick={() => setStatusDialogTable(tbl)}
                    className="text-right group focus:outline-hidden"
                  >
                    <Badge
                      variant={
                        tbl.status === 'available'
                          ? 'success'
                          : tbl.status === 'occupied'
                          ? 'info'
                          : tbl.status === 'billed'
                          ? 'secondary'
                          : 'warning'
                      }
                      className="cursor-pointer group-hover:opacity-80 uppercase text-[10px]"
                    >
                      {tbl.status} ▾
                    </Badge>
                  </button>
                </div>

                {/* ACTIVE ORDER SECTION */}
                {isOccupied && tbl.active_order ? (
                  <div className="bg-[#FAF9F6] rounded-xl p-3 border border-black/[0.06] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#252525]">
                        Order {tbl.active_order.order_number}
                      </span>
                      <span className="text-[#C2B0DC] font-bold">
                        Round {tbl.active_order.round_count}
                      </span>
                    </div>

                    {/* Order Items List */}
                    <div className="space-y-1.5 max-h-40 overflow-y-auto divide-y divide-black/[0.04] text-xs">
                      {tbl.active_order.items?.map((item: any) => {
                        const isReady = item.status === 'ready';
                        const isPreparing = item.status === 'preparing';
                        const isServed = item.status === 'served';

                        return (
                          <div
                            key={item.id}
                            className="pt-1.5 flex items-center justify-between gap-1.5"
                          >
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-[#252525] block truncate">
                                {item.quantity}x {item.item_name}
                              </span>
                              {item.special_instructions && (
                                <span className="text-[10px] text-[#C2B0DC] italic block truncate">
                                  {item.special_instructions}
                                </span>
                              )}
                            </div>

                            {/* Kitchen Status / Served Action */}
                            <div className="shrink-0 flex items-center gap-1.5">
                              {isReady ? (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    updateItemStatusMutation.mutate({
                                      itemId: item.id,
                                      status: 'served',
                                    })
                                  }
                                  className="h-6 px-2 text-[10px] bg-[#B4D58A] hover:bg-[#2e6b4a] text-white flex items-center gap-1 font-bold"
                                >
                                  <Check className="h-3 w-3" /> Mark Served
                                </Button>
                              ) : (
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase ${
                                    isServed
                                      ? 'bg-black/[0.06] text-[#5A5D58]'
                                      : isPreparing
                                      ? 'bg-[#C2B0DC]/20 text-[#C2B0DC] flex items-center gap-1'
                                      : 'bg-[#FEF5E7] text-[#F3DA8A]'
                                  }`}
                                >
                                  {isPreparing && <Flame className="h-2.5 w-2.5 text-[#C2B0DC]" />}
                                  {item.status}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#FAF9F6] rounded-xl p-3 text-center text-xs text-[#5A5D58]">
                    Table is currently available for guest seating.
                  </div>
                )}

                {/* Table Bottom Action: Take Order / Add Round */}
                <Button
                  onClick={() => {
                    setSelectedTable(tbl);
                    setOrderPadOpen(true);
                  }}
                  className="w-full bg-[#C2B0DC] hover:bg-[#B19CCF] text-white text-xs font-semibold h-9 flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <UtensilsCrossed className="h-3.5 w-3.5" />
                  {isOccupied ? 'Add Items (New Round)' : 'Seat Guests & Take Order'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* MODAL: Rapid Order Pad Drawer */}
      {orderPadOpen && selectedTable && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-black/[0.06] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-black/[0.06] bg-[#FAF9F6] flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-base text-[#252525]">
                  Order Pad · Table {selectedTable.table_number}
                </h3>
                <span className="text-xs text-[#5A5D58]">
                  {selectedTable.status === 'occupied'
                    ? 'Firing additional round to active kitchen order'
                    : 'Initial order creation'}
                </span>
              </div>
              <button
                onClick={() => setOrderPadOpen(false)}
                className="text-[#5A5D58] hover:text-[#252525]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Menu Search & Category Tabs */}
            <div className="p-3 border-b border-black/[0.06] space-y-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#5A5D58]" />
                <Input
                  placeholder="Quick search dish..."
                  value={padSearch}
                  onChange={(e) => setPadSearch(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>

              <div className="flex gap-1 overflow-x-auto pb-0.5">
                <button
                  onClick={() => setPadCategory('all')}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium shrink-0 ${
                    padCategory === 'all'
                      ? 'bg-[#C2B0DC] text-white'
                      : 'bg-[#F3DA8A]/25 text-[#5A5D58]'
                  }`}
                >
                  All
                </button>
                {categories.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => setPadCategory(String(c.id))}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium shrink-0 ${
                      padCategory === String(c.id)
                        ? 'bg-[#C2B0DC] text-white'
                        : 'bg-[#F3DA8A]/25 text-[#5A5D58]'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu Items Fast Tap List */}
            <div className="flex-1 p-3 overflow-y-auto divide-y divide-black/[0.04]">
              {menuItems
                .filter((item: MenuItem) => {
                  const matchCat = padCategory === 'all' || String(item.category_id) === padCategory;
                  const matchSearch = item.name.toLowerCase().includes(padSearch.toLowerCase());
                  return matchCat && matchSearch && item.is_available;
                })
                .map((item: MenuItem) => {
                  const inPadCart = padCart.find((i) => i.menuItemId === item.id);

                  return (
                    <div
                      key={item.id}
                      className="py-2 flex items-center justify-between gap-2"
                    >
                      <div>
                        <span className="text-xs font-semibold text-[#252525] block">
                          {item.name}
                        </span>
                        <span className="text-[11px] font-bold text-[#C2B0DC]">
                          ₹{Number(item.base_price).toFixed(2)}
                        </span>
                      </div>

                      {inPadCart ? (
                        <div className="flex items-center gap-2 bg-[#FAF9F6] border border-black/[0.06] rounded-lg p-0.5">
                          <button
                            onClick={() => {
                              setPadCart((prev) =>
                                prev
                                  .map((i) =>
                                    i.menuItemId === item.id
                                      ? { ...i, quantity: i.quantity - 1 }
                                      : i
                                  )
                                  .filter((i) => i.quantity > 0)
                              );
                            }}
                            className="h-6 w-6 rounded flex items-center justify-center text-[#5A5D58] hover:bg-white"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-xs font-bold w-4 text-center">
                            {inPadCart.quantity}
                          </span>
                          <button
                            onClick={() => {
                              setPadCart((prev) =>
                                prev.map((i) =>
                                  i.menuItemId === item.id
                                    ? { ...i, quantity: i.quantity + 1 }
                                    : i
                                )
                              );
                            }}
                            className="h-6 w-6 rounded flex items-center justify-center text-[#5A5D58] hover:bg-white"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => {
                            setPadCart([
                              ...padCart,
                              {
                                menuItemId: item.id,
                                name: item.name,
                                price: Number(item.base_price),
                                quantity: 1,
                              },
                            ]);
                          }}
                          className="h-7 px-3 text-xs bg-[#C2B0DC]/20 text-[#C2B0DC] hover:bg-[#C2B0DC] hover:text-white"
                        >
                          + Add
                        </Button>
                      )}
                    </div>
                  );
                })}
            </div>

            {/* Note & Bottom Submit */}
            <div className="p-3 border-t border-black/[0.06] bg-[#FAF9F6] space-y-2 shrink-0">
              <Input
                placeholder="Table instructions (e.g. all food together, less salt)"
                value={padNote}
                onChange={(e) => setPadNote(e.target.value)}
                className="h-8 text-xs"
              />

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-[#252525]">
                  Total Items: {padCart.reduce((s, i) => s + i.quantity, 0)}
                </span>
                <Button
                  disabled={padCart.length === 0 || fireOrderMutation.isPending}
                  onClick={() => fireOrderMutation.mutate()}
                  className="bg-[#C2B0DC] hover:bg-[#B19CCF] text-white text-xs font-semibold h-9 px-4 flex items-center gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  {fireOrderMutation.isPending ? 'Firing...' : 'Fire to Kitchen'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Quick Table Status Change */}
      {statusDialogTable && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xs w-full border border-black/[0.06] shadow-xl p-4 space-y-3">
            <h3 className="font-bold text-sm text-[#252525] text-center">
              Update Status · Table {statusDialogTable.table_number}
            </h3>

            <div className="space-y-1.5">
              {[
                { status: 'available', label: 'Available (Ready for Guests)', color: 'bg-[#B4D58A]' },
                { status: 'occupied', label: 'Occupied (Guests Seated)', color: 'bg-[#C2B0DC]' },
                { status: 'billed', label: 'Billed (Bill Requested)', color: 'bg-[#8E44AD]' },
                { status: 'cleaning', label: 'Cleaning (Table Reset)', color: 'bg-[#F3DA8A]' },
              ].map((opt) => (
                <button
                  key={opt.status}
                  onClick={() =>
                    updateStatusMutation.mutate({
                      tableId: statusDialogTable.id,
                      status: opt.status,
                    })
                  }
                  className={`w-full p-2.5 rounded-xl border text-left flex items-center gap-2 text-xs font-semibold transition-all ${
                    statusDialogTable.status === opt.status
                      ? 'bg-[#C2B0DC]/20 border-[#C2B0DC] text-[#C2B0DC]'
                      : 'bg-white border-black/[0.06] text-[#252525] hover:bg-[#FAF9F6]'
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${opt.color}`} />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              onClick={() => setStatusDialogTable(null)}
              className="w-full text-xs h-8"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
