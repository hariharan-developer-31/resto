'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChefHat,
  Clock,
  Flame,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Volume2,
  VolumeX,
  Filter,
  Layers,
  UtensilsCrossed,
  Sparkles,
  Check,
  CheckCheck,
  Coffee,
} from 'lucide-react';

interface KdsItem {
  id: number;
  name: string;
  variant_name?: string;
  quantity: number;
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
  kitchen_station: string;
  special_instructions?: string;
  addons: { name: string; quantity: number }[];
}

interface KdsTicket {
  kot_number: string;
  order_id: number;
  order_number: string;
  order_type: 'dine_in' | 'takeaway' | 'delivery';
  table_number: string;
  table_location?: string;
  waiter_name: string;
  round_number: number;
  created_at: string;
  elapsed_minutes: number;
  urgency: 'normal' | 'warning' | 'critical';
  total_items: number;
  items: KdsItem[];
  all_preparing: boolean;
  all_ready: boolean;
}

export default function KitchenPage() {
  const queryClient = useQueryClient();

  const [selectedStation, setSelectedStation] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'active' | 'completed'>('active');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const previousTicketsCountRef = useRef<number>(0);

  // Stations definitions
  const stations = [
    { id: 'all', label: 'All Stations' },
    { id: 'main', label: 'Main Curries' },
    { id: 'biryani', label: 'Biryani Station' },
    { id: 'tandoor', label: 'Clay Tandoor' },
    { id: 'grill', label: 'Grill & Kebabs' },
    { id: 'beverage', label: 'Beverages' },
    { id: 'dessert', label: 'Desserts' },
  ];

  // Web Audio chime synthesizer (zero external audio file dependency)
  const playKitchenChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch {
      // Audio autoplay may be muted by browser
    }
  };

  // Fetch KDS Tickets (Fast Polling every 5s)
  const { data: ticketsData, isLoading: ticketsLoading } = useQuery({
    queryKey: ['kds-tickets', selectedStation, viewMode],
    queryFn: async () => {
      const res = await apiClient.get<any>(
        `/kds/tickets?station=${selectedStation}&mode=${viewMode}`
      );
      return res.data;
    },
    refetchInterval: 5000,
  });

  // Fetch KDS Station Summary
  const { data: summaryData } = useQuery({
    queryKey: ['kds-summary'],
    queryFn: async () => {
      const res = await apiClient.get<any>('/kds/summary');
      return res.data;
    },
    refetchInterval: 5000,
  });

  const tickets: KdsTicket[] = useMemo(() => {
    return ticketsData?.tickets || [];
  }, [ticketsData]);

  // Play sound when new tickets arrive
  useEffect(() => {
    if (soundEnabled && viewMode === 'active') {
      const currentCount = tickets.length;
      if (currentCount > previousTicketsCountRef.current && previousTicketsCountRef.current > 0) {
        playKitchenChime();
      }
      previousTicketsCountRef.current = currentCount;
    }
  }, [tickets.length, soundEnabled, viewMode]);

  // Mutations
  const updateItemStatusMutation = useMutation({
    mutationFn: async ({ itemId, status }: { itemId: number; status: string }) => {
      const res = await apiClient.patch<any>(`/kds/items/${itemId}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['kds-summary'] });
    },
  });

  const markTicketReadyMutation = useMutation({
    mutationFn: async (kotNumber: string) => {
      const res = await apiClient.post<any>(`/kds/tickets/${kotNumber}/ready`, {
        station: selectedStation,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['kds-summary'] });
    },
  });

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)] -m-4 sm:-m-6 p-4 overflow-hidden bg-[#FAF8F4] space-y-3">
      {/* TOP CONTROL BAR */}
      <div className="bg-white rounded-2xl border border-[#EAE7E0] p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Left: Brand & Mode Toggle */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#F8EAE3] text-[#C76B4A] flex items-center justify-center shrink-0">
            <ChefHat className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base text-[#292B28]">Kitchen Display System</h1>
              <Badge variant="success" className="text-[10px]">
                Live Station Sync
              </Badge>
            </div>
            <span className="text-xs text-[#777872]">
              Real-time ticket routing and kitchen preparation workflow
            </span>
          </div>
        </div>

        {/* Center: Live Station Metrics */}
        {summaryData && (
          <div className="hidden lg:flex items-center gap-2 bg-[#FAF8F4] p-1.5 rounded-xl border border-[#EAE7E0] text-xs">
            <div className="px-3 py-1 border-r border-[#EAE7E0] text-center">
              <span className="text-[#777872] block">Pending</span>
              <span className="font-bold text-[#D69A3A]">{summaryData.pending_items || 0}</span>
            </div>
            <div className="px-3 py-1 border-r border-[#EAE7E0] text-center">
              <span className="text-[#777872] block">Cooking</span>
              <span className="font-bold text-[#5185B8]">{summaryData.preparing_items || 0}</span>
            </div>
            <div className="px-3 py-1 border-r border-[#EAE7E0] text-center">
              <span className="text-[#777872] block">Ready</span>
              <span className="font-bold text-[#39845C]">{summaryData.ready_items || 0}</span>
            </div>
            {summaryData.overdue_tickets > 0 && (
              <div className="px-3 py-1 text-center bg-[#FDF0F0] rounded-lg">
                <span className="text-[#C84D4D] block font-semibold">Overdue</span>
                <span className="font-bold text-[#C84D4D]">{summaryData.overdue_tickets}</span>
              </div>
            )}
          </div>
        )}

        {/* Right: Controls (Sound, Mode Switcher) */}
        <div className="flex items-center gap-2">
          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Disable Kitchen Chime' : 'Enable Kitchen Chime'}
            className={`p-2 rounded-xl border transition-all ${
              soundEnabled
                ? 'bg-[#F8EAE3] border-[#C76B4A] text-[#C76B4A]'
                : 'bg-white border-[#EAE7E0] text-[#777872] hover:bg-[#FAF8F4]'
            }`}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>

          {/* Mode Switcher */}
          <div className="flex bg-[#F3F1EB] p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setViewMode('active')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'active'
                  ? 'bg-white text-[#C76B4A] shadow-xs'
                  : 'text-[#777872] hover:text-[#292B28]'
              }`}
            >
              Active Queue ({viewMode === 'active' ? tickets.length : summaryData?.pending_items || 0})
            </button>
            <button
              onClick={() => setViewMode('completed')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'completed'
                  ? 'bg-white text-[#C76B4A] shadow-xs'
                  : 'text-[#777872] hover:text-[#292B28]'
              }`}
            >
              Recall Completed
            </button>
          </div>
        </div>
      </div>

      {/* KITCHEN STATIONS TABS */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0">
        {stations.map((st) => {
          const isSelected = selectedStation === st.id;
          const count =
            st.id === 'all'
              ? summaryData?.pending_items + summaryData?.preparing_items || 0
              : summaryData?.station_counts?.[st.id] || 0;

          return (
            <button
              key={st.id}
              onClick={() => setSelectedStation(st.id)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl shrink-0 transition-all flex items-center gap-2 ${
                isSelected
                  ? 'bg-[#C76B4A] text-white shadow-xs'
                  : 'bg-white text-[#777872] border border-[#EAE7E0] hover:bg-[#F3F1EB]'
              }`}
            >
              <span>{st.label}</span>
              {count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-white text-[#C76B4A]' : 'bg-[#F3F1EB] text-[#292B28]'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TICKETS DISPLAY GRID */}
      <div className="flex-1 overflow-y-auto">
        {ticketsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3.5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 rounded-2xl bg-white border border-[#EAE7E0] animate-pulse" />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center bg-white rounded-2xl border border-[#EAE7E0] p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-[#39845C] mb-3 stroke-1" />
            <h3 className="font-bold text-base text-[#292B28]">Kitchen Queue is Clear!</h3>
            <p className="text-xs text-[#777872] max-w-sm mt-1">
              {viewMode === 'active'
                ? 'All incoming food orders have been prepared and served. New tickets will appear here automatically.'
                : 'No recently completed tickets found in the past 4 hours.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3.5">
            {tickets.map((ticket) => {
              const isCritical = ticket.urgency === 'critical';
              const isWarning = ticket.urgency === 'warning';

              return (
                <div
                  key={ticket.kot_number}
                  className={`bg-white rounded-2xl border flex flex-col justify-between overflow-hidden transition-all shadow-xs ${
                    isCritical
                      ? 'border-[#C84D4D] ring-2 ring-[#C84D4D]/20 shadow-md'
                      : isWarning
                      ? 'border-[#D69A3A] ring-1 ring-[#D69A3A]/20'
                      : 'border-[#EAE7E0]'
                  }`}
                >
                  {/* TICKET TOP HEADER */}
                  <div
                    className={`p-3.5 border-b flex items-start justify-between ${
                      isCritical
                        ? 'bg-[#FDF0F0] border-[#F8DADA]'
                        : isWarning
                        ? 'bg-[#FBF5EA] border-[#F5E6CC]'
                        : 'bg-[#FAF8F4] border-[#EAE7E0]'
                    }`}
                  >
                    <div>
                      {/* KOT & Table */}
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#C76B4A]">
                          {ticket.kot_number}
                        </span>
                        {ticket.round_number > 1 && (
                          <span className="text-[10px] bg-[#C76B4A] text-white px-1.5 py-0.5 rounded font-bold tracking-wide uppercase">
                            ROUND {ticket.round_number}
                          </span>
                        )}
                      </div>

                      {/* Location & Server */}
                      <div className="text-xs font-bold text-[#292B28] mt-1">
                        {ticket.order_type === 'dine_in'
                          ? `Table ${ticket.table_number}`
                          : ticket.table_number}
                        {ticket.table_location && (
                          <span className="text-[11px] text-[#777872] font-normal block">
                            {ticket.table_location}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#777872] block mt-0.5">
                        Server: {ticket.waiter_name}
                      </span>
                    </div>

                    {/* Timer Badge */}
                    <div className="text-right">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${
                          isCritical
                            ? 'bg-[#C84D4D] text-white animate-pulse'
                            : isWarning
                            ? 'bg-[#D69A3A] text-white'
                            : 'bg-[#EBF5EF] text-[#39845C]'
                        }`}
                      >
                        <Clock className="h-3 w-3" />
                        {ticket.elapsed_minutes}m
                      </span>
                      <span className="text-[10px] text-[#777872] block mt-1">
                        {new Date(ticket.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* TICKET ITEMS LIST */}
                  <div className="p-3.5 flex-1 divide-y divide-[#F1EEE8] overflow-y-auto max-h-72">
                    {ticket.items.map((item) => {
                      const isItemPreparing = item.status === 'preparing';
                      const isItemReady = item.status === 'ready' || item.status === 'served';

                      return (
                        <div key={item.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              {/* Quantity & Dish Name */}
                              <div className="flex items-baseline gap-1.5">
                                <span className="font-bold text-sm text-[#C76B4A]">
                                  {item.quantity}x
                                </span>
                                <span
                                  className={`font-bold text-xs leading-tight ${
                                    isItemReady ? 'line-through text-[#A2A29A]' : 'text-[#292B28]'
                                  }`}
                                >
                                  {item.name}
                                </span>
                              </div>

                              {/* Portion Variant */}
                              {item.variant_name && (
                                <span className="text-[10px] font-semibold text-[#777872] bg-[#F3F1EB] px-1.5 py-0.2 rounded inline-block mt-0.5">
                                  Size: {item.variant_name}
                                </span>
                              )}

                              {/* Addons */}
                              {item.addons?.length > 0 && (
                                <div className="text-[10px] text-[#777872] mt-0.5 font-medium">
                                  + {item.addons.map((a) => `${a.quantity}x ${a.name}`).join(', ')}
                                </div>
                              )}
                            </div>

                            {/* Item Status Button */}
                            <div className="shrink-0">
                              {item.status === 'pending' && (
                                <button
                                  onClick={() =>
                                    updateItemStatusMutation.mutate({
                                      itemId: item.id,
                                      status: 'preparing',
                                    })
                                  }
                                  className="h-7 px-2.5 text-[11px] font-semibold rounded-lg bg-[#FAF8F4] text-[#D69A3A] border border-[#D69A3A]/40 hover:bg-[#FBF5EA] flex items-center gap-1 transition-colors"
                                >
                                  <Flame className="h-3 w-3" /> Start Prep
                                </button>
                              )}

                              {item.status === 'preparing' && (
                                <button
                                  onClick={() =>
                                    updateItemStatusMutation.mutate({
                                      itemId: item.id,
                                      status: 'ready',
                                    })
                                  }
                                  className="h-7 px-2.5 text-[11px] font-semibold rounded-lg bg-[#EBF3FC] text-[#5185B8] border border-[#5185B8]/40 hover:bg-[#CFE2F7] flex items-center gap-1 transition-colors"
                                >
                                  <Check className="h-3 w-3" /> Cooking...
                                </button>
                              )}

                              {isItemReady && (
                                <span className="h-7 px-2.5 text-[11px] font-semibold rounded-lg bg-[#EBF5EF] text-[#39845C] flex items-center gap-1">
                                  <CheckCheck className="h-3.5 w-3.5" /> Ready
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Cooking Instructions Highlight */}
                          {item.special_instructions && (
                            <div className="bg-[#FEF5E7] border border-[#F5E6CC] rounded-lg p-1.5 text-[11px] text-[#AE593B] font-semibold">
                              ⚠️ Note: {item.special_instructions}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* TICKET BOTTOM ACTION */}
                  <div className="p-3 border-t border-[#EAE7E0] bg-[#FAF8F4]">
                    <Button
                      disabled={ticket.all_ready || markTicketReadyMutation.isPending}
                      onClick={() => markTicketReadyMutation.mutate(ticket.kot_number)}
                      className={`w-full text-xs font-semibold h-9 flex items-center justify-center gap-1.5 transition-all ${
                        ticket.all_ready
                          ? 'bg-[#EAE7E0] text-[#777872] cursor-not-allowed'
                          : 'bg-[#39845C] hover:bg-[#2e6b4a] text-white shadow-xs'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {ticket.all_ready ? 'Ticket Completed' : 'Mark Whole Ticket Ready'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
