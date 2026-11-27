'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  GitBranch,
  Plus,
  ArrowLeft,
  Store,
  MapPin,
  Clock,
  Percent,
  Power,
  Edit,
  Trash2,
  X,
  Users,
  Grid,
} from 'lucide-react';

export default function RestaurantBranchesPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const restaurantId = Number(params.id);
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const isSuperAdmin = user?.is_super_admin ?? false;
  const canCreate = isSuperAdmin || hasPermission('branches.create');
  const canEdit = isSuperAdmin || hasPermission('branches.edit');
  const canDelete = isSuperAdmin || hasPermission('branches.delete');

  const refreshAuthContext = async () => {
    try {
      const me = await apiRequest('auth/me');
      if (me?.data) {
        useAuthStore.getState().updateUser((me.data as any).user || me.data);
      }
    } catch {
      // non-fatal
    }
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [openingTime, setOpeningTime] = useState('11:00');
  const [closingTime, setClosingTime] = useState('23:00');
  const [taxRate, setTaxRate] = useState('5.00');
  const [isMainBranch, setIsMainBranch] = useState(false);

  // Fetch Restaurant details
  const { data: restaurant } = useQuery({
    queryKey: ['restaurant', restaurantId],
    queryFn: async () => {
      const res = await apiRequest(`restaurants/${restaurantId}`);
      return res.data;
    },
    enabled: !!restaurantId,
  });

  // Fetch Branches
  const { data: branches = [], isLoading, isError, error } = useQuery({
    queryKey: ['branches', restaurantId],
    queryFn: async () => {
      const res = await apiRequest(`restaurants/${restaurantId}/branches`);
      return res.data;
    },
    enabled: !!restaurantId,
  });

  const openCreateModal = () => {
    setEditingBranch(null);
    setName('');
    setCode('BR-' + String(branches.length + 1).padStart(2, '0'));
    setPhone('');
    setEmail('');
    setAddress('');
    setCity('Chennai');
    setState('Tamil Nadu');
    setPostalCode('');
    setOpeningTime('11:00');
    setClosingTime('23:00');
    setTaxRate('5.00');
    setIsMainBranch(branches.length === 0);
    setIsModalOpen(true);
  };

  const openEditModal = (b: any) => {
    setEditingBranch(b);
    setName(b.name || '');
    setCode(b.code || '');
    setPhone(b.phone || '');
    setEmail(b.email || '');
    setAddress(b.address || '');
    setCity(b.city || '');
    setState(b.state || '');
    setPostalCode(b.postal_code || '');
    setOpeningTime(b.opening_time || '11:00');
    setClosingTime(b.closing_time || '23:00');
    setTaxRate(String(b.tax_rate || '5.00'));
    setIsMainBranch(Boolean(b.is_main_branch));
    setIsModalOpen(true);
  };

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        code,
        phone,
        email,
        address,
        city,
        state,
        postal_code: postalCode,
        opening_time: openingTime,
        closing_time: closingTime,
        tax_rate: Number(taxRate),
        is_main_branch: isMainBranch,
      };

      if (editingBranch) {
        return await apiRequest(`restaurants/${restaurantId}/branches/${editingBranch.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        return await apiRequest(`restaurants/${restaurantId}/branches`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['branches', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      refreshAuthContext();
      if (!editingBranch && res?.data) {
        useAuthStore.getState().setActiveBranch(res.data);
      }
      toast.success(editingBranch ? 'Branch updated!' : 'Branch created successfully!');
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save branch.');
    },
  });

  // Toggle Status Mutation
  const toggleMutation = useMutation({
    mutationFn: async (branchId: number) => {
      return await apiRequest(`restaurants/${restaurantId}/branches/${branchId}/toggle-status`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches', restaurantId] });
      toast.success('Branch status updated.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update branch status.');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (branchId: number) => {
      return await apiRequest(`restaurants/${restaurantId}/branches/${branchId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      refreshAuthContext();
      toast.success('Branch archived successfully.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Cannot delete branch.');
    },
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumb Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-[#5A5D58]">
            <Link href="/restaurants" className="hover:text-[#252525] flex items-center gap-1">
              <Store className="h-3.5 w-3.5" />
              Restaurants
            </Link>
            <span>/</span>
            <span className="font-semibold text-[#252525]">{restaurant?.name || 'Loading...'}</span>
            <span>/</span>
            <span>Branches</span>
          </div>

          <h1 className="font-bold text-2xl sm:text-3xl font-semibold text-[#252525]">
            {restaurant?.name} — Branches
          </h1>
          <p className="text-xs text-[#5A5D58]">
            Manage physical dining locations, operating hours, local tax rates, and seating
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/restaurants">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Back to Restaurants
            </Button>
          </Link>
          {canCreate && (
            <Button onClick={openCreateModal} size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Add Branch
            </Button>
          )}
        </div>
      </div>

      {/* Branches List */}
      {isLoading ? (
        <div className="py-16 text-center text-sm text-[#5A5D58]">
          Loading branches...
        </div>
      ) : isError ? (
        <Card className="border-black/[0.06] p-12 text-center">
          <h3 className="font-bold text-lg text-[#C94A6A]">Unable to Load Branches</h3>
          <p className="text-xs text-[#5A5D58] mt-1">
            {(error as any)?.message || 'You may not have access to this restaurant or it does not exist.'}
          </p>
        </Card>
      ) : branches.length === 0 ? (
        <Card className="border-black/[0.06] p-12 text-center">
          <GitBranch className="h-12 w-12 text-[#8E928B] mx-auto mb-3" />
          <h3 className="font-bold text-lg font-semibold text-[#252525]">No Branches Provisioned</h3>
          <p className="text-xs text-[#5A5D58] mt-1">
            Every restaurant requires at least one operating branch for tables, orders, and staff.
          </p>
          {canCreate && (
            <Button onClick={openCreateModal} size="sm" className="mt-4 gap-2">
              <Plus className="h-4 w-4" /> Add First Branch
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {branches.map((b: any) => (
            <Card key={b.id} className="border-black/[0.06] hover:border-[#D8D4CA] transition-all flex flex-col justify-between">
              <div>
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-semibold">{b.name}</CardTitle>
                        {b.is_main_branch && (
                          <Badge variant="secondary" className="text-[10px]">Main</Badge>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-[#5A5D58] block mt-0.5">
                        Code: {b.code}
                      </span>
                    </div>

                    <Badge variant={b.is_active ? 'success' : 'danger'} className="text-[10px]">
                      {b.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-3">
                  <div className="space-y-1.5 text-xs text-[#5A5D58] pt-1">
                    {b.address && (
                      <p className="flex items-start gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-[#8E928B] shrink-0 mt-0.5" />
                        <span>{b.address}, {b.city} {b.postal_code}</span>
                      </p>
                    )}
                    <p className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-[#8E928B] shrink-0" />
                      <span>Hours: {b.opening_time || '10:00'} – {b.closing_time || '23:00'}</span>
                    </p>
                    <p className="flex items-center gap-1.5 font-medium text-[#252525]">
                      <Percent className="h-3.5 w-3.5 text-[#B4D58A] shrink-0" />
                      <span>Branch GST/Tax: {b.tax_rate}%</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 py-2 px-3 bg-[#FAF9F6] rounded-xl border border-black/[0.04] text-center text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-[#5A5D58] block">Tables</span>
                      <span className="font-semibold text-sm text-[#252525]">{b.dining_tables_count ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-[#5A5D58] block">Branch Staff</span>
                      <span className="font-semibold text-sm text-[#252525]">{b.users_count ?? 0}</span>
                    </div>
                  </div>
                </CardContent>
              </div>

              {/* Footer */}
              {(canEdit || canDelete) && (
              <div className="p-4 border-t border-black/[0.04] bg-[#FAF9F6]/50 flex items-center justify-end gap-1.5 rounded-b-2xl">
                {canEdit && (
                  <>
                    <button
                      onClick={() => toggleMutation.mutate(b.id)}
                      title={b.is_active ? 'Deactivate Branch' : 'Activate Branch'}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        b.is_active 
                          ? 'text-[#B4D58A] border-[#D5EAD9] bg-[#B4D58A]/20 hover:bg-[#D5EAD9]' 
                          : 'text-[#8E928B] border-black/[0.06] bg-white hover:bg-[#F3DA8A]/25'
                      }`}
                    >
                      <Power className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => openEditModal(b)}
                      title="Edit Branch"
                      className="p-1.5 rounded-lg border border-black/[0.06] text-[#5A5D58] hover:text-[#252525] hover:bg-white transition-colors"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                {canDelete && (
                  <button
                    onClick={() => {
                      if (confirm(`Archive branch "${b.name}"?`)) {
                        deleteMutation.mutate(b.id);
                      }
                    }}
                    title="Archive Branch"
                    className="p-1.5 rounded-lg border border-black/[0.06] text-[#F2AFC0] hover:bg-[#F2AFC0]/20 hover:border-[#F8DADA] transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#252525]/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white border border-black/[0.06] shadow-xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <h2 className="font-bold text-xl font-semibold text-[#252525]">
                {editingBranch ? 'Edit Branch' : 'Create Branch'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-[#5A5D58] hover:text-[#252525] rounded-lg hover:bg-[#FAF9F6]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Branch Name *"
                  type="text"
                  placeholder="Downtown Flagship"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <Input
                  label="Branch Code"
                  type="text"
                  placeholder="DWT-01"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Phone"
                  type="text"
                  placeholder="+91 98765 11111"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <Input
                  label="Email"
                  type="email"
                  placeholder="branch@restaurant.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <Input
                label="Physical Address"
                type="text"
                placeholder="42 Anna Salai, Thousand Lights"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />

              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="City"
                  type="text"
                  placeholder="Chennai"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
                <Input
                  label="State"
                  type="text"
                  placeholder="Tamil Nadu"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                />
                <Input
                  label="PIN / Zip"
                  type="text"
                  placeholder="600006"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="Opening Time"
                  type="time"
                  value={openingTime}
                  onChange={(e) => setOpeningTime(e.target.value)}
                />
                <Input
                  label="Closing Time"
                  type="time"
                  value={closingTime}
                  onChange={(e) => setClosingTime(e.target.value)}
                />
                <Input
                  label="Tax Rate (%)"
                  type="number"
                  step="0.01"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="mainBranchCheck"
                  checked={isMainBranch}
                  onChange={(e) => setIsMainBranch(e.target.checked)}
                  className="rounded border-black/[0.06] text-[#B4D58A] focus:ring-[#B4D58A]"
                />
                <label htmlFor="mainBranchCheck" className="text-xs font-medium text-[#252525] cursor-pointer">
                  Set as Main / Flagship Branch
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-black/[0.06]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={saveMutation.isPending}
                >
                  {editingBranch ? 'Update Branch' : 'Create Branch'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
