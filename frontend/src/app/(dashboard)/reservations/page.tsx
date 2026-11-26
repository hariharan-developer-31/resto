'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  CalendarDays,
  Users,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Armchair,
  UtensilsCrossed,
  Phone,
  Mail,
  AlertCircle,
  Sparkles,
  UserCheck,
  RefreshCw,
  X,
  ChevronRight,
} from 'lucide-react';

interface DiningTable {
  id: number;
  table_number: string;
  seating_capacity: number;
  location: string;
  status: string;
}

interface Reservation {
  id: number;
  restaurant_id: number;
  branch_id: number;
  table_id: number | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  guest_count: number;
  reservation_date: string;
  reservation_time: string;
  checked_in_at: string | null;
  seated_at: string | null;
  status: 'pending' | 'confirmed' | 'checked_in' | 'seated' | 'completed' | 'cancelled' | 'no_show';
  special_requests: string | null;
  cancellation_reason: string | null;
  table: DiningTable | null;
  branch: { id: number; name: string } | null;
}

export default function ReservationsPage() {
  const queryClient = useQueryClient();
  const { activeRestaurant, activeBranch } = useAuthStore((s) => ({
    activeRestaurant: s.activeRestaurant,
    activeBranch: s.activeBranch,
  }));

  // Date filter initialized safely for prerendering
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignTableModalOpen, setIsAssignTableModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [activeReservation, setActiveReservation] = useState<Reservation | null>(null);

  // Form state for New Reservation
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [guestCount, setGuestCount] = useState('2');
  const [resDate, setResDate] = useState('');
  const [resTime, setResTime] = useState('19:30');
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [cancelReason, setCancelReason] = useState('Guest requested cancellation');

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
    setResDate(today);
  }, []);

  // Fetch Reservations
  const { data: resData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['reservations', activeRestaurant?.id, activeBranch?.id, selectedDate, statusFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedDate) params.append('date', selectedDate);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);

      const res = await apiRequest(`reservations?${params.toString()}`, {
        restaurantId: activeRestaurant?.id,
        branchId: activeBranch?.id,
      });
      return res.data;
    },
    enabled: !!activeRestaurant?.id,
  });

  // Fetch Tables for Assignment
  const { data: tablesData } = useQuery({
    queryKey: ['dining-tables', activeBranch?.id],
    queryFn: async () => {
      const res = await apiRequest('tables', {
        branchId: activeBranch?.id,
      });
      return res.data;
    },
    enabled: !!activeBranch?.id,
  });

  const reservations: Reservation[] = resData?.data || [];
  const diningTables: DiningTable[] = tablesData || [];

  // Metrics calculation
  const totalBookings = reservations.length;
  const confirmedBookings = reservations.filter((r) => r.status === 'confirmed').length;
  const seatedBookings = reservations.filter((r) => r.status === 'seated').length;
  const totalGuests = reservations.reduce((acc, r) => acc + (r.status !== 'cancelled' ? r.guest_count : 0), 0);

  // Status mutation
  const statusMutation = useMutation({
    mutationFn: async ({ id, status, tableId, cancellationReason }: { id: number; status: string; tableId?: number; cancellationReason?: string }) => {
      return await apiRequest(`reservations/${id}/status`, {
        method: 'PATCH',
        restaurantId: activeRestaurant?.id,
        branchId: activeBranch?.id,
        body: JSON.stringify({
          status,
          table_id: tableId,
          cancellation_reason: cancellationReason,
        }),
      });
    },
    onSuccess: (data, vars) => {
      toast.success(`Reservation marked as ${vars.status}`);
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['dining-tables'] });
      setIsCancelModalOpen(false);
      setActiveReservation(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update reservation status');
    },
  });

  // Assign Table mutation
  const assignTableMutation = useMutation({
    mutationFn: async ({ id, tableId }: { id: number; tableId: number }) => {
      return await apiRequest(`reservations/${id}/assign-table`, {
        method: 'POST',
        restaurantId: activeRestaurant?.id,
        branchId: activeBranch?.id,
        body: JSON.stringify({ table_id: tableId }),
      });
    },
    onSuccess: () => {
      toast.success('Dining table assigned successfully');
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['dining-tables'] });
      setIsAssignTableModalOpen(false);
      setActiveReservation(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to assign table');
    },
  });

  // Create Reservation mutation
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      return await apiRequest('reservations', {
        method: 'POST',
        restaurantId: activeRestaurant?.id,
        branchId: activeBranch?.id,
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast.success('Reservation created successfully');
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      setIsCreateModalOpen(false);
      // Reset form
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setGuestCount('2');
      setSpecialRequests('');
      setSelectedTableId('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create reservation');
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBranch?.id) {
      toast.error('Please select an active branch.');
      return;
    }

    createMutation.mutate({
      branch_id: activeBranch.id,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail || null,
      guest_count: parseInt(guestCount, 10),
      reservation_date: resDate,
      reservation_time: resTime,
      table_id: selectedTableId ? parseInt(selectedTableId, 10) : null,
      special_requests: specialRequests || null,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-[#EBF3FC] text-[#5185B8] border-[#CFE2F7]">Confirmed</Badge>;
      case 'checked_in':
        return <Badge className="bg-[#F3E8FF] text-[#7C3AED] border-[#E9D5FF]">Checked In</Badge>;
      case 'seated':
        return <Badge className="bg-[#EEF1E9] text-[#39845C] border-[#D6DFC9]">Seated</Badge>;
      case 'completed':
        return <Badge variant="outline" className="text-[#777872] border-[#EAE7E0]">Completed</Badge>;
      case 'cancelled':
        return <Badge className="bg-[#FDF2F2] text-[#C84D4D] border-[#F8D7DA]">Cancelled</Badge>;
      case 'no_show':
        return <Badge className="bg-[#FEF7EC] text-[#D69A3A] border-[#FCE3BE]">No Show</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#292B28]">Table Reservations & Seating</h1>
            <Badge variant="outline" className="text-[#C76B4A] border-[#F8EAE3] bg-[#FAF8F4]">
              Phase 7
            </Badge>
          </div>
          <p className="text-sm text-[#777872] mt-1">
            Manage table bookings, assign seating layouts, track guest arrivals, and prevent overlapping reservations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="border-[#EAE7E0] hover:bg-[#F3F1EB] text-[#292B28]"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-[#C76B4A] hover:bg-[#AE593B] text-white shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Reservation
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-[#EAE7E0] bg-white shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#777872]">Today's Bookings</p>
              <h3 className="text-2xl font-bold text-[#292B28] mt-1">{totalBookings}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#FAF8F4] flex items-center justify-center text-[#C76B4A]">
              <CalendarDays className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#EAE7E0] bg-white shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#777872]">Confirmed / Upcoming</p>
              <h3 className="text-2xl font-bold text-[#5185B8] mt-1">{confirmedBookings}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#EBF3FC] flex items-center justify-center text-[#5185B8]">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#EAE7E0] bg-white shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#777872]">Currently Seated</p>
              <h3 className="text-2xl font-bold text-[#39845C] mt-1">{seatedBookings}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#EEF1E9] flex items-center justify-center text-[#39845C]">
              <Armchair className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#EAE7E0] bg-white shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#777872]">Expected Guests</p>
              <h3 className="text-2xl font-bold text-[#292B28] mt-1">{totalGuests}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#FAF8F4] flex items-center justify-center text-[#66745B]">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="border-[#EAE7E0] bg-white shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {['all', 'confirmed', 'checked_in', 'seated', 'completed', 'cancelled'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-[#C76B4A] text-white'
                      : 'bg-[#F3F1EB] text-[#777872] hover:bg-[#EAE7E0] hover:text-[#292B28]'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-48">
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="text-xs h-9 border-[#EAE7E0] bg-[#FAF8F4]"
                />
              </div>

              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#A2A29A]" />
                <Input
                  placeholder="Search guest name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-xs h-9 border-[#EAE7E0] bg-[#FAF8F4]"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reservations List */}
      <Card className="border-[#EAE7E0] bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#292B28]">
            <thead className="bg-[#FAF8F4] text-xs font-semibold text-[#777872] uppercase tracking-wider border-b border-[#EAE7E0]">
              <tr>
                <th className="px-6 py-3.5">Guest & Contact</th>
                <th className="px-6 py-3.5">Schedule & Party</th>
                <th className="px-6 py-3.5">Assigned Table</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Notes</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE7E0]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[#777872]">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#C76B4A] mb-2" />
                    Loading reservations...
                  </td>
                </tr>
              ) : reservations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[#777872]">
                    <CalendarDays className="w-8 h-8 mx-auto text-[#A2A29A] mb-2" />
                    No reservations found for the selected filters.
                  </td>
                </tr>
              ) : (
                reservations.map((res) => (
                  <tr key={res.id} className="hover:bg-[#FAF8F4]/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-[#292B28]">{res.customer_name}</div>
                      <div className="flex items-center gap-3 text-xs text-[#777872] mt-0.5">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-[#A2A29A]" /> {res.customer_phone}
                        </span>
                        {res.customer_email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-[#A2A29A]" /> {res.customer_email}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs font-medium text-[#292B28]">
                        <Clock className="w-3.5 h-3.5 text-[#C76B4A]" />
                        <span>{res.reservation_time}</span>
                        <span className="text-[#A2A29A]">({res.reservation_date})</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-[#777872] mt-1">
                        <Users className="w-3 h-3 text-[#66745B]" />
                        <span>{res.guest_count} Guests</span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {res.table ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#EEF1E9] text-[#66745B] text-xs font-semibold">
                          <Armchair className="w-3.5 h-3.5" />
                          <span>Table {res.table.table_number}</span>
                          <span className="text-[10px] text-[#777872]">({res.table.location || 'Main'})</span>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setActiveReservation(res);
                            setIsAssignTableModalOpen(true);
                          }}
                          className="h-7 text-xs border-dashed border-[#C76B4A] text-[#C76B4A] hover:bg-[#F8EAE3]"
                        >
                          <Plus className="w-3 h-3 mr-1" /> Assign Table
                        </Button>
                      )}
                    </td>

                    <td className="px-6 py-4">{getStatusBadge(res.status)}</td>

                    <td className="px-6 py-4 max-w-xs">
                      {res.special_requests ? (
                        <span className="text-xs text-[#292B28] bg-[#FAF8F4] px-2 py-1 rounded border border-[#EAE7E0] inline-block truncate max-w-[200px]" title={res.special_requests}>
                          {res.special_requests}
                        </span>
                      ) : (
                        <span className="text-xs text-[#A2A29A] italic">—</span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Seating / Check-in Actions */}
                        {res.status === 'confirmed' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => statusMutation.mutate({ id: res.id, status: 'checked_in' })}
                              className="h-8 text-xs border-[#EAE7E0] text-[#7C3AED] hover:bg-[#F3E8FF]"
                            >
                              Check In
                            </Button>

                            <Button
                              size="sm"
                              onClick={() => {
                                if (!res.table_id) {
                                  setActiveReservation(res);
                                  setIsAssignTableModalOpen(true);
                                } else {
                                  statusMutation.mutate({ id: res.id, status: 'seated', tableId: res.table_id });
                                }
                              }}
                              className="h-8 text-xs bg-[#39845C] hover:bg-[#2F6B4A] text-white"
                            >
                              <Armchair className="w-3 h-3 mr-1" /> Seat Guest
                            </Button>
                          </>
                        )}

                        {res.status === 'checked_in' && (
                          <Button
                            size="sm"
                            onClick={() => {
                              if (!res.table_id) {
                                setActiveReservation(res);
                                setIsAssignTableModalOpen(true);
                              } else {
                                statusMutation.mutate({ id: res.id, status: 'seated', tableId: res.table_id });
                              }
                            }}
                            className="h-8 text-xs bg-[#39845C] hover:bg-[#2F6B4A] text-white"
                          >
                            <Armchair className="w-3 h-3 mr-1" /> Seat Guest
                          </Button>
                        )}

                        {res.status === 'seated' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => statusMutation.mutate({ id: res.id, status: 'completed' })}
                            className="h-8 text-xs border-[#EAE7E0] text-[#39845C] hover:bg-[#EEF1E9]"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Complete
                          </Button>
                        )}

                        {/* Re-assign table option */}
                        {['confirmed', 'checked_in'].includes(res.status) && res.table_id && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setActiveReservation(res);
                              setIsAssignTableModalOpen(true);
                            }}
                            className="h-8 text-xs text-[#777872] hover:text-[#292B28]"
                          >
                            Change Table
                          </Button>
                        )}

                        {/* Cancel Option */}
                        {['confirmed', 'checked_in', 'pending'].includes(res.status) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setActiveReservation(res);
                              setIsCancelModalOpen(true);
                            }}
                            className="h-8 text-xs text-[#C84D4D] hover:bg-[#FDF2F2]"
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal 1: New Reservation Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 border border-[#EAE7E0] animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-[#EAE7E0]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#F8EAE3] text-[#C76B4A] flex items-center justify-center">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-[#292B28]">Book Table Reservation</h3>
                  <p className="text-xs text-[#777872]">Record manual guest reservation for {activeBranch?.name}</p>
                </div>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-[#A2A29A] hover:text-[#292B28]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#292B28]">Customer Name *</label>
                  <Input
                    required
                    placeholder="e.g. Vikram Malhotra"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#292B28]">Phone Number *</label>
                  <Input
                    required
                    placeholder="+91 98765 43210"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-semibold text-[#292B28]">Customer Email</label>
                  <Input
                    type="email"
                    placeholder="guest@example.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#292B28]">Party Size *</label>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={guestCount}
                    onChange={(e) => setGuestCount(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#292B28]">Reservation Date *</label>
                  <Input
                    type="date"
                    required
                    value={resDate}
                    onChange={(e) => setResDate(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#292B28]">Time Slot *</label>
                  <select
                    value={resTime}
                    onChange={(e) => setResTime(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-[#EAE7E0] bg-white text-xs text-[#292B28] focus:outline-hidden focus:ring-1 focus:ring-[#C76B4A]"
                  >
                    <option value="12:30">12:30 PM (Lunch)</option>
                    <option value="13:00">01:00 PM (Lunch)</option>
                    <option value="13:30">01:30 PM (Lunch)</option>
                    <option value="14:00">02:00 PM (Lunch)</option>
                    <option value="19:00">07:00 PM (Dinner)</option>
                    <option value="19:30">07:30 PM (Dinner)</option>
                    <option value="20:00">08:00 PM (Dinner)</option>
                    <option value="20:30">08:30 PM (Dinner)</option>
                    <option value="21:00">09:00 PM (Dinner)</option>
                    <option value="21:30">09:30 PM (Dinner)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#292B28]">Assign Table (Optional)</label>
                <select
                  value={selectedTableId}
                  onChange={(e) => setSelectedTableId(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-[#EAE7E0] bg-white text-xs text-[#292B28] focus:outline-hidden focus:ring-1 focus:ring-[#C76B4A]"
                >
                  <option value="">Leave Unassigned (Assign at Door)</option>
                  {diningTables.map((t) => (
                    <option key={t.id} value={t.id}>
                      Table {t.table_number} — Seats {t.seating_capacity} ({t.location || 'Dining Floor'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#292B28]">Special Requests / Notes</label>
                <Input
                  placeholder="e.g. Anniversary celebration, high chair required, window booth"
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#EAE7E0]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="text-xs h-9 bg-[#C76B4A] hover:bg-[#AE593B] text-white"
                >
                  {createMutation.isPending ? 'Confirming...' : 'Confirm Reservation'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Assign Table Modal */}
      {isAssignTableModalOpen && activeReservation && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-[#EAE7E0] animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE7E0]">
              <div>
                <h3 className="font-bold text-[#292B28]">Assign Dining Table</h3>
                <p className="text-xs text-[#777872]">
                  For <span className="font-medium text-[#292B28]">{activeReservation.customer_name}</span> ({activeReservation.guest_count} Guests at {activeReservation.reservation_time})
                </p>
              </div>
              <button onClick={() => setIsAssignTableModalOpen(false)} className="text-[#A2A29A] hover:text-[#292B28]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 py-4 max-h-72 overflow-y-auto">
              {diningTables.length === 0 ? (
                <p className="text-xs text-[#777872] text-center py-4">No dining tables found for this branch.</p>
              ) : (
                diningTables.map((t) => {
                  const isCapacityFit = t.seating_capacity >= activeReservation.guest_count;
                  return (
                    <button
                      key={t.id}
                      onClick={() => assignTableMutation.mutate({ id: activeReservation.id, tableId: t.id })}
                      disabled={assignTableMutation.isPending}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-[#EAE7E0] hover:border-[#C76B4A] hover:bg-[#FAF8F4] transition-all text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-md bg-[#FAF8F4] text-[#C76B4A] font-bold text-xs flex items-center justify-center border border-[#F8EAE3]">
                          {t.table_number}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[#292B28]">{t.location || 'Dining Floor'}</p>
                          <p className="text-[11px] text-[#777872]">Capacity: {t.seating_capacity} seats</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isCapacityFit ? (
                          <Badge className="bg-[#EEF1E9] text-[#39845C] text-[10px] border-none">Fits Party</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[#D69A3A] border-[#D69A3A] text-[10px]">Small</Badge>
                        )}
                        <ChevronRight className="w-4 h-4 text-[#A2A29A]" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-[#EAE7E0] flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAssignTableModalOpen(false)}
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Cancel Reservation Modal */}
      {isCancelModalOpen && activeReservation && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 border border-[#EAE7E0] animate-in fade-in-0 zoom-in-95">
            <h3 className="font-bold text-[#292B28]">Cancel Reservation</h3>
            <p className="text-xs text-[#777872] mt-1">
              Are you sure you want to cancel the booking for <span className="font-medium text-[#292B28]">{activeReservation.customer_name}</span>?
            </p>

            <div className="space-y-1 my-4">
              <label className="text-xs font-semibold text-[#292B28]">Cancellation Reason</label>
              <Input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCancelModalOpen(false)}
                className="text-xs"
              >
                Keep Booking
              </Button>
              <Button
                size="sm"
                onClick={() => statusMutation.mutate({
                  id: activeReservation.id,
                  status: 'cancelled',
                  cancellationReason: cancelReason,
                })}
                disabled={statusMutation.isPending}
                className="text-xs bg-[#C84D4D] hover:bg-[#A83D3D] text-white"
              >
                {statusMutation.isPending ? 'Cancelling...' : 'Confirm Cancellation'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
