'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  Store,
  Plus,
  Search,
  GitBranch,
  Users,
  Settings2,
  Trash2,
  Power,
  ExternalLink,
  Edit,
  Clock,
  MapPin,
  X,
  CheckCircle2,
  Building2,
  FileText,
} from 'lucide-react';

export default function RestaurantsPage() {
  const queryClient = useQueryClient();
  const { user, isSuperAdmin } = useAuthStore((s) => ({
    user: s.user,
    isSuperAdmin: s.user?.is_super_admin ?? false,
  }));

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<any | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [primaryColor, setPrimaryColor] = useState('#C2B0DC');
  const [description, setDescription] = useState('');

  // Fetch restaurants
  const { data, isLoading } = useQuery({
    queryKey: ['restaurants', search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      const res = await apiRequest(`restaurants?${params.toString()}`);
      return res.data;
    },
  });

  const restaurants = data?.data || [];

  const openCreateModal = () => {
    setEditingRestaurant(null);
    setName('');
    setSlug('');
    setPhone('');
    setEmail('');
    setWebsite('');
    setGstNumber('');
    setCurrency('INR');
    setCurrencySymbol('₹');
    setTimezone('Asia/Kolkata');
    setPrimaryColor('#C2B0DC');
    setDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (r: any) => {
    setEditingRestaurant(r);
    setName(r.name || '');
    setSlug(r.slug || '');
    setPhone(r.phone || '');
    setEmail(r.email || '');
    setWebsite(r.website || '');
    setGstNumber(r.gst_number || '');
    setCurrency(r.currency || 'INR');
    setCurrencySymbol(r.currency_symbol || '₹');
    setTimezone(r.timezone || 'Asia/Kolkata');
    setPrimaryColor(r.primary_color || '#C2B0DC');
    setDescription(r.description || '');
    setIsModalOpen(true);
  };

  // Create / Update Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        slug: slug || undefined,
        phone,
        email,
        website,
        gst_number: gstNumber,
        currency,
        currency_symbol: currencySymbol,
        timezone,
        primary_color: primaryColor,
        description,
      };

      if (editingRestaurant) {
        return await apiRequest(`restaurants/${editingRestaurant.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        return await apiRequest('restaurants', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      queryClient.invalidateQueries({ queryKey: ['system-bootstrap'] });
      toast.success(editingRestaurant ? 'Restaurant updated!' : 'Restaurant created successfully!');
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save restaurant.');
    },
  });

  // Toggle Status Mutation
  const toggleMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`restaurants/${id}/toggle-status`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      toast.success('Restaurant status updated.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update status.');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`restaurants/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      toast.success('Restaurant archived successfully.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Cannot delete restaurant.');
    },
  });

  const handleDelete = (id: number, rName: string) => {
    if (confirm(`Are you sure you want to archive "${rName}"? This is protected against active orders.`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-bold text-2xl sm:text-3xl font-semibold text-[#252525]">
            Restaurant Management
          </h1>
          <p className="text-xs text-[#5A5D58]">
            Provision and configure tenant restaurant entities, branding, and billing currencies
          </p>
        </div>

        {(isSuperAdmin || user?.permissions?.includes('restaurants.create')) && (
          <Button onClick={openCreateModal} className="gap-2 shadow-xs">
            <Plus className="h-4 w-4" />
            Add Restaurant
          </Button>
        )}
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8E928B]" />
          <input
            type="text"
            placeholder="Search restaurants by name, slug or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-[10px] border border-black/[0.06] bg-white text-sm text-[#252525] placeholder:text-[#8E928B] outline-none focus:border-[#C2B0DC]"
          />
        </div>
      </div>

      {/* Restaurants List Cards */}
      {isLoading ? (
        <div className="py-16 text-center text-sm text-[#5A5D58]">
          Loading restaurants...
        </div>
      ) : restaurants.length === 0 ? (
        <Card className="border-black/[0.06] p-12 text-center">
          <Store className="h-12 w-12 text-[#8E928B] mx-auto mb-3" />
          <h3 className="font-bold text-lg font-semibold text-[#252525]">No Restaurants Found</h3>
          <p className="text-xs text-[#5A5D58] mt-1 max-w-sm mx-auto">
            {search ? 'No restaurant records match your search criteria.' : 'Create your first restaurant to begin multi-tenant operations.'}
          </p>
          <Button onClick={openCreateModal} variant="outline" size="sm" className="mt-4 gap-2">
            <Plus className="h-4 w-4" /> Create Restaurant
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {restaurants.map((r: any) => (
            <Card key={r.id} className="border-black/[0.06] hover:border-[#D8D4CA] transition-all flex flex-col justify-between">
              <div>
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold font-bold text-lg shadow-2xs"
                        style={{ backgroundColor: r.primary_color || '#C2B0DC' }}
                      >
                        {r.name.charAt(0)}
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold leading-tight">{r.name}</CardTitle>
                        <span className="font-mono text-[11px] text-[#5A5D58] block mt-0.5">
                          slug: {r.slug}
                        </span>
                      </div>
                    </div>

                    <Badge variant={r.is_active ? 'success' : 'danger'} className="text-[10px] shrink-0">
                      {r.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  {r.description && (
                    <p className="text-xs text-[#5A5D58] line-clamp-2 mt-2 leading-relaxed">
                      {r.description}
                    </p>
                  )}
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-2">
                  <div className="grid grid-cols-3 gap-2 py-2.5 px-3 bg-[#FAF9F6] rounded-xl border border-black/[0.04] text-center">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-[#5A5D58] block">Branches</span>
                      <span className="font-semibold text-sm text-[#252525]">{r.branches_count ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-[#5A5D58] block">Staff</span>
                      <span className="font-semibold text-sm text-[#252525]">{r.users_count ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-[#5A5D58] block">Currency</span>
                      <span className="font-semibold text-sm text-[#252525]">{r.currency_symbol} {r.currency}</span>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-[#5A5D58] pt-1">
                    {r.phone && <p>📞 {r.phone}</p>}
                    {r.email && <p>✉️ {r.email}</p>}
                    {r.gst_number && <p className="font-mono text-[11px]">GST: {r.gst_number}</p>}
                  </div>
                </CardContent>
              </div>

              {/* Card Footer Actions */}
              <div className="p-4 border-t border-black/[0.04] bg-[#FAF9F6]/50 flex items-center justify-between rounded-b-2xl">
                <Link href={`/restaurants/${r.id}/branches`}>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                    <GitBranch className="h-3.5 w-3.5 text-[#B4D58A]" />
                    Branches ({r.branches_count ?? 0})
                  </Button>
                </Link>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleMutation.mutate(r.id)}
                    title={r.is_active ? 'Deactivate' : 'Activate'}
                    className={`p-1.5 rounded-lg border transition-colors ${
                      r.is_active 
                        ? 'text-[#B4D58A] border-[#D5EAD9] bg-[#B4D58A]/20 hover:bg-[#D5EAD9]' 
                        : 'text-[#8E928B] border-black/[0.06] bg-white hover:bg-[#F3DA8A]/25'
                    }`}
                  >
                    <Power className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => openEditModal(r)}
                    title="Edit"
                    className="p-1.5 rounded-lg border border-black/[0.06] text-[#5A5D58] hover:text-[#252525] hover:bg-white transition-colors"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(r.id, r.name)}
                    title="Archive"
                    className="p-1.5 rounded-lg border border-black/[0.06] text-[#F2AFC0] hover:bg-[#F2AFC0]/20 hover:border-[#F8DADA] transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Restaurant Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#252525]/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white border border-black/[0.06] shadow-xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <h2 className="font-bold text-xl font-semibold text-[#252525]">
                {editingRestaurant ? 'Edit Restaurant Profile' : 'Create New Restaurant'}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Restaurant Name *"
                  type="text"
                  placeholder="e.g. Copper Chimney"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <Input
                  label="Slug (URL identifier)"
                  type="text"
                  placeholder="copper-chimney"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  helperText="Leave empty to generate automatically"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Contact Phone"
                  type="text"
                  placeholder="+91 98765 00000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <Input
                  label="Contact Email"
                  type="email"
                  placeholder="orders@restaurant.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Website / Domain"
                  type="text"
                  placeholder="https://restaurant.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
                <Input
                  label="GST Number"
                  type="text"
                  placeholder="33AAAAA0000A1Z5"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="Currency Code"
                  type="text"
                  placeholder="INR"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                />
                <Input
                  label="Symbol"
                  type="text"
                  placeholder="₹"
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                />
                <Input
                  label="Brand Color"
                  type="text"
                  placeholder="#C2B0DC"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#5A5D58]">
                  Description / Hospitality Concept
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of culinary concept, cuisine, and service format..."
                  className="w-full rounded-[10px] border border-black/[0.06] p-3 text-sm text-[#252525] placeholder:text-[#8E928B] outline-none focus:border-[#C2B0DC]"
                />
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
                  {editingRestaurant ? 'Update Restaurant' : 'Create Restaurant'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
