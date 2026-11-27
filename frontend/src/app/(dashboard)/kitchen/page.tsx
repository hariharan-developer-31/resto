'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TenantGuard } from '@/components/layout/tenant-guard';
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
  const activeRestaurant = useAuthStore((s) => s.activeRestaurant);
  const activeBranch = useAuthStore((s) => s.activeBranch);

  const [selectedStation, setSelectedStation] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'active' | 'completed'>('active');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const seenKotsRef = useRef<Set<string>>(new Set());
  const initializedKotsRef = useRef<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

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

  // Reusable Web Audio chime synthesizer (prevents AudioContext leaks)
  const playKitchenChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioCtx();
      }
      const audioCtx = audioCtxRef.current;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

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
    queryKey: ['kds-tickets', activeBranch?.id, selectedStation, viewMode],
    queryFn: async () => {
      const res = await apiClient.get<any>(
        `/kds/tickets?station=${selectedStation}&mode=${viewMode}`
      );
      return res.data;
    },
    enabled: !!activeRestaurant?.id && !!activeBranch?.id,
    refetchInterval: 5000,
  });

  // Fetch KDS Station Summary
  const { data: summaryData } = useQuery({
    queryKey: ['kds-summary', activeBranch?.id],
    queryFn: async () => {
      const res = await apiClient.get<any>('/kds/summary');
      return res.data;
    },
    enabled: !!activeRestaurant?.id && !!activeBranch?.id,
    refetchInterval: 5000,
  });

  const tickets: KdsTicket[] = useMemo(() => {
    return ticketsData?.tickets || [];
  }, [ticketsData]);

  // Play chime whenever any unseen KOT arrives in active mode (including 0 -> 1)
  useEffect(() => {
    if (viewMode !== 'active') return;
    const currentKots = tickets.map((t) => t.kot_number);
    if (!initializedKotsRef.current) {
      seenKotsRef.current = new Set(currentKots);
      initializedKotsRef.current = true;
      return;
    }

    const hasNewKot = currentKots.some((kot) => !seenKotsRef.current.has(kot));
    if (hasNewKot && soundEnabled) {
      playKitchenChime();
    }
    seenKotsRef.current = new Set(currentKots);
  }, [tickets, soundEnabled, viewMode]);

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
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update dish status.');
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
      toast.success('Ticket marked ready for pickup');
      queryClient.invalidateQueries({ queryKey: ['kds-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['kds-summary'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to mark ticket ready.');
    },
  });

  return (
    <TenantGuard requireBranch stationName="Kitchen KDS">
      <div className="flex flex-col h-[calc(100vh-5.5rem)] -m-4 sm:-m-6 p-4 overflow-hidden bg-[#FAF9F6] space-y-3">
      {/* TOP CONTROL BAR */}
      <div className="bg-white rounded-2xl border border-black/[0.06] p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Left: Brand & Mode Toggle */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#B4D58A]/20 text-[#B4D58A] flex items-center justify-center shrink-0">
            <ChefHat className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base text-[#252525]">Kitchen Display System</h1>
              <Badge variant="success" className="text-[10px]">
                Live Station Sync
              </Badge>
            </div>
            <span className="text-xs text-[#5A5D58]">
              Real-time ticket routing and kitchen preparation workflow
            </span>
          </div>
        </div>

        {/* Center: Live Station Metrics */}
        {summaryData && (
          <div className="hidden lg:flex items-center gap-2 bg-[#FAF9F6] p-1.5 rounded-xl border border-black/[0.06] text-xs">
            <div className="px-3 py-1 border-r border-black/[0.06] text-center">
              <span className="text-[#5A5D58] block">Pending</span>
              <span className="font-bold text-[#F3DA8A]">{summaryData.pending_items || 0}</span>
            </div>
            <div className="px-3 py-1 border-r border-black/[0.06] text-center">
              <span className="text-[#5A5D58] block">Cooking</span>
              <span className="font-bold text-[#B4D58A]">{summaryData.preparing_items || 0}</span>
            </div>
            <div className="px-3 py-1 border-r border-black/[0.06] text-center">
              <span className="text-[#5A5D58] block">Ready</span>
              <span className="font-bold text-[#B4D58A]">{summaryData.ready_items || 0}</span>
            </div>
            {summaryData.overdue_tickets > 0 && (
              <div className="px-3 py-1 text-center bg-[#F2AFC0]/20 rounded-lg">
                <span className="text-[#F2AFC0] block font-semibold">Overdue</span>
                <span className="font-bold text-[#F2AFC0]">{summaryData.overdue_tickets}</span>
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
                ? 'bg-[#B4D58A]/20 border-[#B4D58A] text-[#B4D58A]'
                : 'bg-white border-black/[0.06] text-[#5A5D58] hover:bg-[#FAF9F6]'
            }`}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>

          {/* Mode Switcher */}
          <div className="flex bg-[#F3DA8A]/25 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setViewMode('active')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'active'
                  ? 'bg-white text-[#B4D58A] shadow-xs'
                  : 'text-[#5A5D58] hover:text-[#252525]'
              }`}
            >
              Active Queue ({viewMode === 'active' ? tickets.length : summaryData?.pending_items || 0})
            </button>
            <button
              onClick={() => setViewMode('completed')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'completed'
                  ? 'bg-white text-[#B4D58A] shadow-xs'
                  : 'text-[#5A5D58] hover:text-[#252525]'
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
                  ? 'bg-[#B4D58A] text-white shadow-xs'
                  : 'bg-white text-[#5A5D58] border border-black/[0.06] hover:bg-[#F3DA8A]/25'
              }`}
            >
              <span>{st.label}</span>
              {count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-white text-[#B4D58A]' : 'bg-[#F3DA8A]/25 text-[#252525]'
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
              <div key={i} className="h-64 rounded-2xl bg-white border border-black/[0.06] animate-pulse" />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center bg-white rounded-2xl border border-black/[0.06] p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-[#B4D58A] mb-3 stroke-1" />
            <h3 className="font-bold text-base text-[#252525]">Kitchen Queue is Clear!</h3>
            <p className="text-xs text-[#5A5D58] max-w-sm mt-1">
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
                      ? 'border-[#F2AFC0] ring-2 ring-[#F2AFC0]/20 shadow-md'
                      : isWarning
                      ? 'border-[#F3DA8A] ring-1 ring-[#F3DA8A]/20'
                      : 'border-black/[0.06]'
                  }`}
                >
                  {/* TICKET TOP HEADER */}
                  <div
                    className={`p-3.5 border-b flex items-start justify-between ${
                      isCritical
                        ? 'bg-[#F2AFC0]/20 border-[#F8DADA]'
                        : isWarning
                        ? 'bg-[#F3DA8A]/25 border-[#F5E6CC]'
                        : 'bg-[#FAF9F6] border-black/[0.06]'
                    }`}
                  >
                    <div>
                      {/* KOT & Table */}
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#B4D58A]">
                          {ticket.kot_number}
                        </span>
                        {ticket.round_number > 1 && (
                          <span className="text-[10px] bg-[#B4D58A] text-white px-1.5 py-0.5 rounded font-bold tracking-wide uppercase">
                            ROUND {ticket.round_number}
                          </span>
                        )}
                      </div>

                      {/* Location & Server */}
                      <div className="text-xs font-bold text-[#252525] mt-1">
                        {ticket.order_type === 'dine_in'
                          ? `Table ${ticket.table_number}`
                          : ticket.table_number}
                        {ticket.table_location && (
                          <span className="text-[11px] text-[#5A5D58] font-normal block">
                            {ticket.table_location}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#5A5D58] block mt-0.5">
                        Server: {ticket.waiter_name}
                      </span>
                    </div>

                    {/* Timer Badge */}
                    <div className="text-right">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${
                          isCritical
                            ? 'bg-[#F2AFC0] text-white animate-pulse'
                            : isWarning
                            ? 'bg-[#F3DA8A] text-white'
                            : 'bg-[#B4D58A]/20 text-[#B4D58A]'
                        }`}
                      >
                        <Clock className="h-3 w-3" />
                        {ticket.elapsed_minutes}m
                      </span>
                      <span className="text-[10px] text-[#5A5D58] block mt-1">
                        {new Date(ticket.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* TICKET ITEMS LIST */}
                  <div className="p-3.5 flex-1 divide-y divide-black/[0.04] overflow-y-auto max-h-72">
                    {ticket.items.map((item) => {
                      const isItemPreparing = item.status === 'preparing';
                      const isItemReady = item.status === 'ready' || item.status === 'served';

                      return (
                        <div key={item.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              {/* Quantity & Dish Name */}
                              <div className="flex items-baseline gap-1.5">
                                <span className="font-bold text-sm text-[#B4D58A]">
                                  {item.quantity}x
                                </span>
                                <span
                                  className={`font-bold text-xs leading-tight ${
                                    isItemReady ? 'line-through text-[#8E928B]' : 'text-[#252525]'
                                  }`}
                                >
                                  {item.name}
                                </span>
                              </div>

                              {/* Portion Variant */}
                              {item.variant_name && (
                                <span className="text-[10px] font-semibold text-[#5A5D58] bg-[#F3DA8A]/25 px-1.5 py-0.2 rounded inline-block mt-0.5">
                                  Size: {item.variant_name}
                                </span>
                              )}

                              {/* Addons */}
                              {item.addons?.length > 0 && (
                                <div className="text-[10px] text-[#5A5D58] mt-0.5 font-medium">
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
                                  className="h-7 px-2.5 text-[11px] font-semibold rounded-lg bg-[#FAF9F6] text-[#F3DA8A] border border-[#F3DA8A]/40 hover:bg-[#F3DA8A]/25 flex items-center gap-1 transition-colors"
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
                                  className="h-7 px-2.5 text-[11px] font-semibold rounded-lg bg-[#B4D58A]/20 text-[#B4D58A] border border-[#B4D58A]/40 hover:bg-[#CFE2F7] flex items-center gap-1 transition-colors"
                                >
                                  <Check className="h-3 w-3" /> Cooking...
                                </button>
                              )}

                              {isItemReady && (
                                <span className="h-7 px-2.5 text-[11px] font-semibold rounded-lg bg-[#B4D58A]/20 text-[#B4D58A] flex items-center gap-1">
                                  <CheckCheck className="h-3.5 w-3.5" /> Ready
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Cooking Instructions Highlight */}
                          {item.special_instructions && (
                            <div className="bg-[#FEF5E7] border border-[#F5E6CC] rounded-lg p-1.5 text-[11px] text-[#9EC271] font-semibold">
                              ⚠️ Note: {item.special_instructions}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* TICKET BOTTOM ACTION */}
                  <div className="p-3 border-t border-black/[0.06] bg-[#FAF9F6]">
                    <Button
                      disabled={ticket.all_ready || markTicketReadyMutation.isPending}
                      onClick={() => markTicketReadyMutation.mutate(ticket.kot_number)}
                      className={`w-full text-xs font-semibold h-9 flex items-center justify-center gap-1.5 transition-all ${
                        ticket.all_ready
                          ? 'bg-black/[0.06] text-[#5A5D58] cursor-not-allowed'
                          : 'bg-[#B4D58A] hover:bg-[#2e6b4a] text-white shadow-xs'
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
    </TenantGuard>
  );
}
