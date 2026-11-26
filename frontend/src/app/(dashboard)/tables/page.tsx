'use client';

import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import {
  Grid,
  Plus,
  QrCode,
  Users,
  MapPin,
  RefreshCw,
  Printer,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  Edit,
  Trash2,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

export default function TablesManagementPage() {
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);

  const activeRestaurant = useAuthStore((s) => s.activeRestaurant);
  const activeBranch = useAuthStore((s) => s.activeBranch);

  const [selectedLocation, setSelectedLocation] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Modals state
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<any | null>(null);

  // Form state
  const [tableNumber, setTableNumber] = useState('');
  const [seatingCapacity, setSeatingCapacity] = useState('4');
  const [location, setLocation] = useState('Indoor');
  const [waiterId, setWaiterId] = useState<number | ''>('');

  // Fetch Tables
  const { data: tablesPayload, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['dining-tables', activeBranch?.id],
    queryFn: async () => {
      const res = await apiRequest('tables', {
        branchId: activeBranch?.id,
        restaurantId: activeRestaurant?.id,
      });
      return res.data;
    },
    enabled: !!activeBranch?.id,
  });

  // Fetch Branch Staff / Waiters for assignment
  const { data: usersPayload } = useQuery({
    queryKey: ['branch-waiters', activeRestaurant?.id],
    queryFn: async () => {
      try {
        const query = activeRestaurant?.id
          ? `users?role=Waiter&per_page=50&restaurant_id=${activeRestaurant.id}`
          : 'users?role=Waiter&per_page=50';
        const res = await apiRequest(query);
        return res.data?.data || [];
      } catch {
        return [];
      }
    },
    enabled: !!activeRestaurant?.id,
  });

  const tables: any[] = tablesPayload?.tables || [];
  const locations: string[] = tablesPayload?.locations || [];
  const waiters: any[] = usersPayload || [];

  // Filter tables
  const filteredTables = tables.filter((t) => {
    const matchLoc = selectedLocation === 'All' || t.location === selectedLocation;
    const matchStatus = statusFilter === 'All' || t.status === statusFilter;
    return matchLoc && matchStatus;
  });

  // Counts by status
  const statusCounts = {
    available: tables.filter((t) => t.status === 'available').length,
    occupied: tables.filter((t) => t.status === 'occupied').length,
    reserved: tables.filter((t) => t.status === 'reserved').length,
    billing: tables.filter((t) => t.status === 'billing').length,
    cleaning: tables.filter((t) => t.status === 'cleaning').length,
  };

  const openCreateTableModal = () => {
    setSelectedTable(null);
    setTableNumber('T-' + String(tables.length + 1).padStart(2, '0'));
    setSeatingCapacity('4');
    setLocation('AC Dining Hall');
    setWaiterId('');
    setIsTableModalOpen(true);
  };

  const openEditTableModal = (t: any) => {
    setSelectedTable(t);
    setTableNumber(t.table_number);
    setSeatingCapacity(String(t.seating_capacity));
    setLocation(t.location || 'Indoor');
    setWaiterId(t.waiter?.id || '');
    setIsTableModalOpen(true);
  };

  const openQrModal = (t: any) => {
    setSelectedTable(t);
    setIsQrModalOpen(true);
  };

  // Create / Update Mutation
  const saveTableMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        table_number: tableNumber,
        seating_capacity: Number(seatingCapacity),
        location,
        waiter_id: waiterId || null,
      };

      if (selectedTable) {
        return await apiRequest(`tables/${selectedTable.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
          branchId: activeBranch?.id,
        });
      } else {
        return await apiRequest('tables', {
          method: 'POST',
          body: JSON.stringify(payload),
          branchId: activeBranch?.id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dining-tables'] });
      toast.success(selectedTable ? 'Table updated!' : 'Dining table created!');
      setIsTableModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save table.');
    },
  });

  // Update Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return await apiRequest(`tables/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dining-tables'] });
      toast.success('Table status updated.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update status.');
    },
  });

  // Regenerate QR Token Mutation
  const regenerateQrMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`tables/${id}/qr`, { method: 'POST' });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['dining-tables'] });
      toast.success('New secure QR token generated! Old token revoked.');
      if (selectedTable) {
        setSelectedTable({
          ...selectedTable,
          qr_token: res.data.qr_token,
          qr_ordering_url: res.data.qr_ordering_url,
        });
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to regenerate QR.');
    },
  });

  // Delete Table Mutation
  const deleteTableMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`tables/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dining-tables'] });
      toast.success('Table archived.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Cannot delete table.');
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return { badge: 'success', border: 'border-[#D5EAD9]', bg: 'bg-[#B4D58A]/20', text: 'text-[#B4D58A]', dot: 'bg-[#B4D58A]' };
      case 'occupied':
        return { badge: 'default', border: 'border-[#F2DFD6]', bg: 'bg-[#B4D58A]/20', text: 'text-[#B4D58A]', dot: 'bg-[#B4D58A]' };
      case 'reserved':
        return { badge: 'secondary', border: 'border-[#D9E6F2]', bg: 'bg-[#EBF3FB]', text: 'text-[#B4D58A]', dot: 'bg-[#B4D58A]' };
      case 'billing':
        return { badge: 'warning', border: 'border-[#F5E6CC]', bg: 'bg-[#F3DA8A]/25', text: 'text-[#F3DA8A]', dot: 'bg-[#F3DA8A]' };
      case 'cleaning':
        return { badge: 'outline', border: 'border-black/[0.06]', bg: 'bg-[#F3DA8A]/25', text: 'text-[#5A5D58]', dot: 'bg-[#5A5D58]' };
      default:
        return { badge: 'outline', border: 'border-black/[0.06]', bg: 'bg-white', text: 'text-[#5A5D58]', dot: 'bg-[#8E928B]' };
    }
  };

  const handlePrintQr = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-bold text-2xl sm:text-3xl font-semibold text-[#252525]">
            Visual Table Layout & QR Standees
          </h1>
          <p className="text-xs text-[#5A5D58]">
            Real-time table seating map, assigned waiters, and contactless QR token generator for {activeBranch?.name || 'Main Branch'}
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
            Refresh
          </Button>

          <Button onClick={openCreateTableModal} size="sm" className="gap-2 text-xs shadow-xs">
            <Plus className="h-4 w-4" /> Add Table
          </Button>
        </div>
      </div>

      {/* Status Counters Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div
          onClick={() => setStatusFilter(statusFilter === 'available' ? 'All' : 'available')}
          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
            statusFilter === 'available' ? 'border-[#B4D58A] bg-[#B4D58A]/20' : 'border-black/[0.06] bg-white hover:bg-[#FAF9F6]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[#5A5D58] uppercase font-semibold text-[10px]">Available</span>
            <span className="h-2 w-2 rounded-full bg-[#B4D58A]" />
          </div>
          <span className="font-bold text-xl font-bold text-[#B4D58A] block mt-1">{statusCounts.available}</span>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'occupied' ? 'All' : 'occupied')}
          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
            statusFilter === 'occupied' ? 'border-[#B4D58A] bg-[#B4D58A]/20' : 'border-black/[0.06] bg-white hover:bg-[#FAF9F6]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[#5A5D58] uppercase font-semibold text-[10px]">Occupied</span>
            <span className="h-2 w-2 rounded-full bg-[#B4D58A]" />
          </div>
          <span className="font-bold text-xl font-bold text-[#B4D58A] block mt-1">{statusCounts.occupied}</span>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'reserved' ? 'All' : 'reserved')}
          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
            statusFilter === 'reserved' ? 'border-[#B4D58A] bg-[#EBF3FB]' : 'border-black/[0.06] bg-white hover:bg-[#FAF9F6]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[#5A5D58] uppercase font-semibold text-[10px]">Reserved</span>
            <span className="h-2 w-2 rounded-full bg-[#B4D58A]" />
          </div>
          <span className="font-bold text-xl font-bold text-[#B4D58A] block mt-1">{statusCounts.reserved}</span>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'billing' ? 'All' : 'billing')}
          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
            statusFilter === 'billing' ? 'border-[#F3DA8A] bg-[#F3DA8A]/25' : 'border-black/[0.06] bg-white hover:bg-[#FAF9F6]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[#5A5D58] uppercase font-semibold text-[10px]">Billing</span>
            <span className="h-2 w-2 rounded-full bg-[#F3DA8A]" />
          </div>
          <span className="font-bold text-xl font-bold text-[#F3DA8A] block mt-1">{statusCounts.billing}</span>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'cleaning' ? 'All' : 'cleaning')}
          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
            statusFilter === 'cleaning' ? 'border-[#5A5D58] bg-[#F3DA8A]/25' : 'border-black/[0.06] bg-white hover:bg-[#FAF9F6]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[#5A5D58] uppercase font-semibold text-[10px]">Cleaning</span>
            <span className="h-2 w-2 rounded-full bg-[#5A5D58]" />
          </div>
          <span className="font-bold text-xl font-bold text-[#5A5D58] block mt-1">{statusCounts.cleaning}</span>
        </div>
      </div>

      {/* Location Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-black/[0.06]">
        <button
          onClick={() => setSelectedLocation('All')}
          className={`px-3 py-1.5 rounded-[10px] text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            selectedLocation === 'All'
              ? 'bg-[#B4D58A] text-white shadow-xs'
              : 'bg-white border border-black/[0.06] text-[#5A5D58] hover:bg-[#FAF9F6]'
          }`}
        >
          All Locations ({tables.length})
        </button>
        {locations.map((loc) => {
          const isSelected = selectedLocation === loc;
          const count = tables.filter((t) => t.location === loc).length;
          return (
            <button
              key={loc}
              onClick={() => setSelectedLocation(loc)}
              className={`px-3 py-1.5 rounded-[10px] text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#B4D58A] text-white shadow-xs'
                  : 'bg-white border border-black/[0.06] text-[#5A5D58] hover:bg-[#FAF9F6]'
              }`}
            >
              {loc} ({count})
            </button>
          );
        })}
      </div>

      {/* Tables Grid Layout */}
      {isLoading ? (
        <div className="py-16 text-center text-sm text-[#5A5D58]">Loading tables...</div>
      ) : filteredTables.length === 0 ? (
        <Card className="border-black/[0.06] p-12 text-center">
          <Grid className="h-12 w-12 text-[#8E928B] mx-auto mb-3" />
          <h3 className="font-bold text-lg font-semibold text-[#252525]">No Tables Found</h3>
          <p className="text-xs text-[#5A5D58] mt-1">
            Add tables for this branch to generate contactless QR codes and manage dining sessions.
          </p>
          <Button onClick={openCreateTableModal} size="sm" className="mt-4 gap-2">
            <Plus className="h-4 w-4" /> Add Table
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredTables.map((table) => {
            const style = getStatusColor(table.status);

            return (
              <Card
                key={table.id}
                className={`border-2 transition-all hover:shadow-sm ${style.border} bg-white flex flex-col justify-between`}
              >
                <div className="p-4 space-y-3">
                  {/* Top: Table Number & Status Dot */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-2xl font-bold text-[#252525]">
                        {table.table_number}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${style.bg} ${style.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                        {table.status}
                      </span>
                    </div>

                    <button
                      onClick={() => openQrModal(table)}
                      title="View QR Code & Table Standee"
                      className="p-1.5 rounded-lg border border-black/[0.06] bg-[#FAF9F6] text-[#B4D58A] hover:bg-[#B4D58A]/20 transition-colors cursor-pointer"
                    >
                      <QrCode className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Metadata */}
                  <div className="space-y-1 text-xs text-[#5A5D58]">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-[#8E928B]" />
                        Capacity:
                      </span>
                      <span className="font-semibold text-[#252525]">{table.seating_capacity} Seats</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-[#8E928B]" />
                        Location:
                      </span>
                      <span className="font-medium text-[#252525]">{table.location}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-black/[0.04]">
                      <span className="text-[11px] text-[#8E928B]">Assigned Waiter:</span>
                      <span className="font-medium text-[11px] text-[#B4D58A]">
                        {table.waiter?.name || 'Unassigned'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Quick Status Controls */}
                <div className="p-3 border-t border-black/[0.04] bg-[#FAF9F6]/50 flex items-center justify-between rounded-b-2xl">
                  {/* Status Dropdown */}
                  <select
                    value={table.status}
                    onChange={(e) => updateStatusMutation.mutate({ id: table.id, status: e.target.value })}
                    className="text-[11px] font-medium bg-white border border-black/[0.06] rounded-lg px-2 py-1 outline-none text-[#252525] cursor-pointer"
                  >
                    <option value="available">Mark Available</option>
                    <option value="occupied">Mark Occupied</option>
                    <option value="reserved">Mark Reserved</option>
                    <option value="billing">Mark Billing</option>
                    <option value="cleaning">Mark Cleaning</option>
                    <option value="out_of_service">Out of Service</option>
                  </select>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditTableModal(table)}
                      title="Edit Table Details"
                      className="p-1 text-[#5A5D58] hover:text-[#252525] hover:bg-white rounded"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Archive Table ${table.table_number}?`)) {
                          deleteTableMutation.mutate(table.id);
                        }
                      }}
                      title="Archive Table"
                      className="p-1 text-[#F2AFC0] hover:bg-[#F2AFC0]/20 rounded"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: Create / Edit Table */}
      {isTableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#252525]/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white border border-black/[0.06] shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-black/[0.06]">
              <h2 className="font-bold text-lg font-semibold text-[#252525]">
                {selectedTable ? 'Edit Table' : 'Add Dining Table'}
              </h2>
              <button onClick={() => setIsTableModalOpen(false)}>
                <X className="h-5 w-5 text-[#5A5D58]" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveTableMutation.mutate();
              }}
              className="space-y-4"
            >
              <Input
                label="Table Number *"
                type="text"
                placeholder="e.g. T-07, B-01"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                required
              />

              <Input
                label="Seating Capacity (Guests)"
                type="number"
                min="1"
                max="50"
                value={seatingCapacity}
                onChange={(e) => setSeatingCapacity(e.target.value)}
                required
              />

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#5A5D58]">
                  Dining Section / Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. AC Dining Hall, Rooftop, Patio"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full h-10 px-3 rounded-[10px] border border-black/[0.06] bg-white text-sm text-[#252525] outline-none focus:border-[#B4D58A]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#5A5D58]">
                  Assigned Waiter
                </label>
                <select
                  value={waiterId}
                  onChange={(e) => setWaiterId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full h-10 px-3 rounded-[10px] border border-black/[0.06] bg-white text-sm text-[#252525] outline-none focus:border-[#B4D58A]"
                >
                  <option value="">None (Unassigned)</option>
                  {waiters.map((w: any) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06]">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsTableModalOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" isLoading={saveTableMutation.isPending}>
                  {selectedTable ? 'Update Table' : 'Create Table'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: QR Code Standee & Generator */}
      {isQrModalOpen && selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#252525]/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-black/[0.06] shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <div className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-[#B4D58A]" />
                <h2 className="font-bold text-lg font-semibold text-[#252525]">
                  Table {selectedTable.table_number} — QR Standee
                </h2>
              </div>
              <button onClick={() => setIsQrModalOpen(false)}>
                <X className="h-5 w-5 text-[#5A5D58]" />
              </button>
            </div>

            {/* Printable Standee Card */}
            <div
              ref={printRef}
              className="print-area p-6 rounded-2xl border-2 border-dashed border-[#B4D58A]/30 bg-[#FAF9F6] flex flex-col items-center text-center space-y-4"
            >
              <div className="space-y-1">
                <span className="font-bold text-lg text-[#252525] block">
                  {activeRestaurant?.name || 'Restaurant'}
                </span>
                <span className="text-xs text-[#5A5D58] block">
                  {activeBranch?.name} • Section: {selectedTable.location}
                </span>
              </div>

              {/* QR Image Canvas / SVG */}
              <div className="p-4 bg-white rounded-2xl shadow-sm border border-black/[0.06]">
                <QRCodeSVG
                  value={
                    selectedTable.qr_ordering_url ||
                    `${typeof window !== 'undefined' ? window.location.origin : ''}/order/${selectedTable.qr_token}`
                  }
                  size={180}
                  level="H"
                  includeMargin={true}
                />
              </div>

              <div className="space-y-1">
                <span className="font-bold text-3xl font-extrabold text-[#B4D58A] block">
                  TABLE {selectedTable.table_number}
                </span>
                <p className="text-xs font-medium text-[#252525]">
                  Scan with your smartphone camera to browse menu & place orders
                </p>
                <p className="font-mono text-[9px] text-[#8E928B] truncate max-w-xs mx-auto">
                  Token: {selectedTable.qr_token}
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="no-print space-y-3 pt-2">
              <div className="flex items-center justify-between gap-2">
                <Button
                  onClick={handlePrintQr}
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 text-xs"
                >
                  <Printer className="h-4 w-4" /> Print Standee
                </Button>
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedTable.qr_ordering_url || '');
                    toast.success('Ordering URL copied to clipboard!');
                  }}
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 text-xs"
                >
                  Copy Order URL
                </Button>
              </div>

              <div className="pt-2 border-t border-black/[0.04] text-center">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Regenerate QR Code? The existing printed QR code will stop working immediately.')) {
                      regenerateQrMutation.mutate(selectedTable.id);
                    }
                  }}
                  disabled={regenerateQrMutation.isPending}
                  className="text-xs font-medium text-[#F2AFC0] hover:underline cursor-pointer inline-flex items-center gap-1"
                >
                  <RefreshCw className={`h-3 w-3 ${regenerateQrMutation.isPending ? 'animate-spin' : ''}`} />
                  Regenerate Secure Token (Revoke Previous)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
