'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Layers,
  Plus,
  Search,
  Clock,
  Sparkles,
  Utensils,
  ChefHat,
  Power,
  Edit,
  Trash2,
  X,
  Check,
  FolderPlus,
  Tag,
  CircleDot,
  Flame,
} from 'lucide-react';

export default function MenuCatalogPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const activeRestaurant = useAuthStore((s) => s.activeRestaurant);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const isSuperAdmin = user?.is_super_admin ?? false;
  const canCreate = isSuperAdmin || hasPermission('menu.create');
  const canEdit = isSuperAdmin || hasPermission('menu.edit');
  const canDelete = isSuperAdmin || hasPermission('menu.delete');

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [dietaryFilter, setDietaryFilter] = useState('');

  React.useEffect(() => {
    setSelectedCategoryId(null);
  }, [activeRestaurant?.id]);

  // Modals state
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isAddonModalOpen, setIsAddonModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Food Item Form State
  const [itemName, setItemName] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState<number | ''>('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemType, setItemType] = useState('non_veg');
  const [itemPrepTime, setItemPrepTime] = useState('15');
  const [itemStation, setItemStation] = useState('main');
  const [itemDescription, setItemDescription] = useState('');
  const [itemFeatured, setItemFeatured] = useState(false);
  const [variantsList, setVariantsList] = useState<{ name: string; price: string; is_default: boolean }[]>([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState<number[]>([]);

  // Category Form State
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');

  // Addon Form State
  const [addonName, setAddonName] = useState('');
  const [addonPrice, setAddonPrice] = useState('');

  // Fetch Categories
  const { data: categories = [], isLoading: isCategoriesLoading } = useQuery({
    queryKey: ['menu-categories', activeRestaurant?.id],
    queryFn: async () => {
      const res = await apiRequest('categories', { restaurantId: activeRestaurant?.id });
      return res.data || [];
    },
    enabled: !!activeRestaurant?.id,
  });

  // Fetch Addons
  const { data: addons = [] } = useQuery({
    queryKey: ['menu-addons', activeRestaurant?.id],
    queryFn: async () => {
      const res = await apiRequest('addons', { restaurantId: activeRestaurant?.id });
      return res.data || [];
    },
    enabled: !!activeRestaurant?.id,
  });

  // Fetch Menu Items
  const { data: itemsData, isLoading: isItemsLoading } = useQuery({
    queryKey: ['menu-items', activeRestaurant?.id, selectedCategoryId, search, dietaryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategoryId) params.append('category_id', String(selectedCategoryId));
      if (search) params.append('search', search);
      if (dietaryFilter) params.append('type', dietaryFilter);
      params.append('per_page', '50');

      const res = await apiRequest(`menu-items?${params.toString()}`, {
        restaurantId: activeRestaurant?.id,
      });
      return res.data;
    },
    enabled: !!activeRestaurant?.id,
  });

  const menuItems = itemsData?.data || [];

  const openCreateItemModal = () => {
    setEditingItem(null);
    setItemName('');
    setItemCategoryId(selectedCategoryId || categories[0]?.id || '');
    setItemPrice('200.00');
    setItemType('non_veg');
    setItemPrepTime('15');
    setItemStation('main');
    setItemDescription('');
    setItemFeatured(false);
    setVariantsList([
      { name: 'Regular', price: '200.00', is_default: true },
    ]);
    setSelectedAddonIds([]);
    setIsItemModalOpen(true);
  };

  const openEditItemModal = (item: any) => {
    setEditingItem(item);
    setItemName(item.name || '');
    setItemCategoryId(item.category_id || '');
    setItemPrice(String(item.base_price || ''));
    setItemType(item.type || 'veg');
    setItemPrepTime(String(item.preparation_time || 15));
    setItemStation(item.kitchen_station || 'main');
    setItemDescription(item.description || '');
    setItemFeatured(Boolean(item.is_featured));
    setVariantsList(
      item.variants?.map((v: any) => ({
        name: v.name,
        price: String(v.price),
        is_default: Boolean(v.is_default),
      })) || []
    );
    setSelectedAddonIds(item.addons?.map((a: any) => a.id) || []);
    setIsItemModalOpen(true);
  };

  // Save Item Mutation
  const saveItemMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: itemName,
        category_id: itemCategoryId,
        base_price: Number(itemPrice),
        type: itemType,
        preparation_time: Number(itemPrepTime),
        kitchen_station: itemStation,
        description: itemDescription,
        is_featured: itemFeatured,
        variants: variantsList
          .filter((v) => v.name.trim() !== '' && v.price !== '')
          .map((v) => ({
            name: v.name.trim(),
            price: Number(v.price),
            is_default: v.is_default,
          })),
        addon_ids: selectedAddonIds,
      };

      if (editingItem) {
        return await apiRequest(`menu-items/${editingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
          restaurantId: activeRestaurant?.id,
        });
      } else {
        return await apiRequest('menu-items', {
          method: 'POST',
          body: JSON.stringify(payload),
          restaurantId: activeRestaurant?.id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      queryClient.invalidateQueries({ queryKey: ['menu-categories'] });
      toast.success(editingItem ? 'Item updated!' : 'Menu item created successfully!');
      setIsItemModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save menu item.');
    },
  });

  // Toggle In-Stock / Out-of-Stock
  const toggleStockMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`menu-items/${id}/toggle-availability`, {
        method: 'POST',
        restaurantId: activeRestaurant?.id,
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      toast.success(res.data?.is_available ? 'Item marked in stock' : 'Item marked out of stock');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update availability.');
    },
  });

  // Delete Item Mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`menu-items/${id}`, {
        method: 'DELETE',
        restaurantId: activeRestaurant?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      toast.success('Menu item deleted.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Cannot delete item.');
    },
  });

  // Create Category Mutation
  const createCategoryMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('categories', {
        method: 'POST',
        body: JSON.stringify({ name: catName, description: catDesc }),
        restaurantId: activeRestaurant?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-categories'] });
      toast.success('Category created!');
      setCatName('');
      setCatDesc('');
      setIsCategoryModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create category.');
    },
  });

  // Create Addon Mutation
  const createAddonMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('addons', {
        method: 'POST',
        body: JSON.stringify({ name: addonName, price: Number(addonPrice) }),
        restaurantId: activeRestaurant?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-addons'] });
      toast.success('Add-on created!');
      setAddonName('');
      setAddonPrice('');
      setIsAddonModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create addon.');
    },
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-bold text-2xl sm:text-3xl font-semibold text-[#252525]">
            Menu Catalog & Kitchen Stations
          </h1>
          <p className="text-xs text-[#5A5D58]">
            Organize food categories, preparation times, variants, and add-ons for {activeRestaurant?.name}
          </p>
        </div>

        {canCreate && (
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setIsAddonModalOpen(true)}
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
            >
              <Tag className="h-3.5 w-3.5" /> Add-on
            </Button>
            <Button
              onClick={() => setIsCategoryModalOpen(true)}
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
            >
              <FolderPlus className="h-3.5 w-3.5" /> Category
            </Button>
            <Button
              onClick={openCreateItemModal}
              size="sm"
              className="gap-2 text-xs shadow-xs"
            >
              <Plus className="h-4 w-4" /> Add Food Item
            </Button>
          </div>
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-black/[0.06]">
        <button
          onClick={() => setSelectedCategoryId(null)}
          className={`px-3.5 py-1.5 rounded-[10px] text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            selectedCategoryId === null
              ? 'bg-[#B4D58A] text-white shadow-xs'
              : 'bg-white border border-black/[0.06] text-[#5A5D58] hover:bg-[#FAF9F6] hover:text-[#252525]'
          }`}
        >
          All Items ({categories.reduce((acc: number, c: any) => acc + (c.menu_items_count || 0), 0)})
        </button>

        {categories.map((c: any) => {
          const isSelected = selectedCategoryId === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setSelectedCategoryId(c.id)}
              className={`px-3.5 py-1.5 rounded-[10px] text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#B4D58A] text-white shadow-xs'
                  : 'bg-white border border-black/[0.06] text-[#5A5D58] hover:bg-[#FAF9F6] hover:text-[#252525]'
              }`}
            >
              {c.name} ({c.menu_items_count || 0})
            </button>
          );
        })}
      </div>

      {/* Search and Dietary Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8E928B]" />
          <input
            type="text"
            placeholder="Search food by title or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-[10px] border border-black/[0.06] bg-white text-sm text-[#252525] placeholder:text-[#8E928B] outline-none focus:border-[#B4D58A]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={dietaryFilter}
            onChange={(e) => setDietaryFilter(e.target.value)}
            className="h-10 px-3 rounded-[10px] border border-black/[0.06] bg-white text-xs font-medium text-[#252525] outline-none cursor-pointer"
          >
            <option value="">All Dietary Types</option>
            <option value="veg">Veg Only 🟢</option>
            <option value="non_veg">Non-Veg Only 🔴</option>
            <option value="egg">Egg 🟡</option>
            <option value="vegan">Vegan 🌱</option>
          </select>
        </div>
      </div>

      {/* Menu Items Grid */}
      {isItemsLoading ? (
        <div className="py-16 text-center text-sm text-[#5A5D58]">Loading menu catalog...</div>
      ) : menuItems.length === 0 ? (
        <Card className="border-black/[0.06] p-12 text-center">
          <Utensils className="h-12 w-12 text-[#8E928B] mx-auto mb-3" />
          <h3 className="font-bold text-lg font-semibold text-[#252525]">No Menu Items</h3>
          <p className="text-xs text-[#5A5D58] mt-1">
            {search ? 'No items match your search.' : 'Add your first culinary item to begin service.'}
          </p>
          {canCreate && (
            <Button onClick={openCreateItemModal} size="sm" className="mt-4 gap-2">
              <Plus className="h-4 w-4" /> Add Food Item
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {menuItems.map((item: any) => {
            const isVeg = item.type === 'veg' || item.type === 'vegan';
            const isNonVeg = item.type === 'non_veg';

            return (
              <Card
                key={item.id}
                className={`border-black/[0.06] hover:border-[#D8D4CA] transition-all flex flex-col justify-between ${
                  !item.is_available ? 'opacity-70 bg-[#FAF9F6]/40' : ''
                }`}
              >
                <div>
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        {/* Veg / Non-Veg Indicator Icon */}
                        <div
                          className={`h-5 w-5 mt-0.5 rounded border flex items-center justify-center shrink-0 ${
                            isVeg
                              ? 'border-[#B4D58A] text-[#B4D58A]'
                              : isNonVeg
                              ? 'border-[#F2AFC0] text-[#F2AFC0]'
                              : 'border-[#F3DA8A] text-[#F3DA8A]'
                          }`}
                          title={item.type.toUpperCase()}
                        >
                          <div
                            className={`h-2.5 w-2.5 rounded-full ${
                              isVeg ? 'bg-[#B4D58A]' : isNonVeg ? 'bg-[#F2AFC0]' : 'bg-[#F3DA8A]'
                            }`}
                          />
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5">
                            <CardTitle className="text-base font-semibold leading-tight">
                              {item.name}
                            </CardTitle>
                            {item.is_featured && (
                              <span title="Featured">
                                <Sparkles className="h-3.5 w-3.5 text-[#F3DA8A] shrink-0" />
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-[#5A5D58] block mt-0.5">
                            {item.category?.name}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-bold text-base text-[#252525] block">
                          ₹{Number(item.base_price).toFixed(2)}
                        </span>
                        <Badge
                          variant={item.is_available ? 'success' : 'danger'}
                          className="text-[10px]"
                        >
                          {item.is_available ? 'In Stock' : 'Out of Stock'}
                        </Badge>
                      </div>
                    </div>

                    {item.description && (
                      <p className="text-xs text-[#5A5D58] line-clamp-2 mt-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </CardHeader>

                  <CardContent className="p-5 pt-0 space-y-3">
                    <div className="flex items-center gap-3 text-xs text-[#5A5D58] pt-1 border-t border-black/[0.04]">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-[#8E928B]" />
                        {item.preparation_time}m prep
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 uppercase font-semibold text-[10px] text-[#B4D58A]">
                        <ChefHat className="h-3.5 w-3.5" />
                        Station: {item.kitchen_station}
                      </span>
                    </div>

                    {/* Variants tags */}
                    {item.variants && item.variants.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-semibold text-[#8E928B]">Variants:</span>
                        <div className="flex flex-wrap gap-1">
                          {item.variants.map((v: any) => (
                            <span
                              key={v.id}
                              className="px-2 py-0.5 rounded bg-[#FAF9F6] border border-black/[0.06] text-[10px] font-medium text-[#252525]"
                            >
                              {v.name}: ₹{Number(v.price).toFixed(0)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Addons tags */}
                    {item.addons && item.addons.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-semibold text-[#8E928B]">Add-ons:</span>
                        <div className="flex flex-wrap gap-1">
                          {item.addons.map((a: any) => (
                            <span
                              key={a.id}
                              className="px-1.5 py-0.5 rounded bg-[#FAF9F6] text-[10px] text-[#5A5D58]"
                            >
                              +{a.name} (₹{Number(a.price).toFixed(0)})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </div>

                {/* Footer Actions */}
                {(canEdit || canDelete) && (
                <div className="p-3 px-5 border-t border-black/[0.04] bg-[#FAF9F6]/50 flex items-center justify-between rounded-b-2xl">
                  {canEdit ? (
                    <button
                      onClick={() => toggleStockMutation.mutate(item.id)}
                      className={`text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                        item.is_available ? 'text-[#B4D58A]' : 'text-[#F2AFC0]'
                      }`}
                    >
                      <Power className="h-3.5 w-3.5" />
                      <span>{item.is_available ? 'In Stock' : 'Out of Stock'}</span>
                    </button>
                  ) : (
                    <span className="text-xs text-[#8E928B]">{item.is_available ? 'In Stock' : 'Out of Stock'}</span>
                  )}

                  <div className="flex items-center gap-1">
                    {canEdit && (
                      <button
                        onClick={() => openEditItemModal(item)}
                        title="Edit Item"
                        className="p-1.5 rounded-lg border border-black/[0.06] text-[#5A5D58] hover:text-[#252525] hover:bg-white transition-colors"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${item.name}"?`)) {
                            deleteItemMutation.mutate(item.id);
                          }
                        }}
                        title="Delete Item"
                        className="p-1.5 rounded-lg border border-black/[0.06] text-[#F2AFC0] hover:bg-[#F2AFC0]/20 hover:border-[#F8DADA] transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: Add / Edit Food Item */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#252525]/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white border border-black/[0.06] shadow-xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <h2 className="font-bold text-xl font-semibold text-[#252525]">
                {editingItem ? 'Edit Food Item' : 'New Culinary Item'}
              </h2>
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="p-1.5 text-[#5A5D58] hover:text-[#252525] rounded-lg hover:bg-[#FAF9F6]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveItemMutation.mutate();
              }}
              className="space-y-4"
            >
              <Input
                label="Food Item Title *"
                type="text"
                placeholder="e.g. Chicken Dum Biryani"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                required
              />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#5A5D58]">
                    Category *
                  </label>
                  <select
                    value={itemCategoryId}
                    onChange={(e) => setItemCategoryId(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-[10px] border border-black/[0.06] bg-white text-sm text-[#252525] outline-none focus:border-[#B4D58A]"
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#5A5D58]">
                    Dietary Classification *
                  </label>
                  <select
                    value={itemType}
                    onChange={(e) => setItemType(e.target.value)}
                    className="w-full h-10 px-3 rounded-[10px] border border-black/[0.06] bg-white text-sm text-[#252525] outline-none focus:border-[#B4D58A]"
                  >
                    <option value="veg">🟢 Veg</option>
                    <option value="non_veg">🔴 Non-Veg</option>
                    <option value="egg">🟡 Egg</option>
                    <option value="vegan">🌱 Vegan</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="Base Price (₹) *"
                  type="number"
                  step="0.01"
                  placeholder="200.00"
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value)}
                  required
                />
                <Input
                  label="Prep Time (mins)"
                  type="number"
                  value={itemPrepTime}
                  onChange={(e) => setItemPrepTime(e.target.value)}
                />
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#5A5D58]">
                    Kitchen Station
                  </label>
                  <select
                    value={itemStation}
                    onChange={(e) => setItemStation(e.target.value)}
                    className="w-full h-10 px-3 rounded-[10px] border border-black/[0.06] bg-white text-sm text-[#252525] outline-none focus:border-[#B4D58A]"
                  >
                    <option value="main">Main Kitchen</option>
                    <option value="grill">Grill / Tandoor</option>
                    <option value="beverage">Beverage Bar</option>
                    <option value="dessert">Dessert Station</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#5A5D58]">
                  Description & Ingredients
                </label>
                <textarea
                  rows={2}
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  placeholder="Appetizing description of ingredients and preparation method..."
                  className="w-full rounded-[10px] border border-black/[0.06] p-3 text-sm text-[#252525] placeholder:text-[#8E928B] outline-none focus:border-[#B4D58A]"
                />
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={itemFeatured}
                  onChange={(e) => setItemFeatured(e.target.checked)}
                  className="rounded border-black/[0.06] text-[#B4D58A] focus:ring-[#B4D58A]"
                />
                <span className="text-xs font-medium text-[#252525] flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[#F3DA8A]" />
                  Mark as Featured / Chef&apos;s Special
                </span>
              </label>

              {/* Variants Builder */}
              <div className="space-y-2 pt-2 border-t border-black/[0.04]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#5A5D58]">
                    Food Variants (Portion Sizes)
                  </span>
                  <button
                    type="button"
                    onClick={() => setVariantsList([...variantsList, { name: '', price: '', is_default: false }])}
                    className="text-xs font-medium text-[#B4D58A] hover:underline"
                  >
                    + Add Variant
                  </button>
                </div>

                {variantsList.map((variant, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      placeholder="Variant Name (e.g. Regular, Large)"
                      value={variant.name}
                      onChange={(e) => {
                        const updated = [...variantsList];
                        updated[index].name = e.target.value;
                        setVariantsList(updated);
                      }}
                    />
                    <Input
                      placeholder="Price (₹)"
                      type="number"
                      step="0.01"
                      value={variant.price}
                      onChange={(e) => {
                        const updated = [...variantsList];
                        updated[index].price = e.target.value;
                        setVariantsList(updated);
                      }}
                      className="w-32"
                    />
                    <button
                      type="button"
                      onClick={() => setVariantsList(variantsList.filter((_, i) => i !== index))}
                      className="p-2 text-[#F2AFC0] hover:bg-[#F2AFC0]/20 rounded-lg"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Addons Selection */}
              {addons.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-black/[0.04]">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#5A5D58]">
                    Available Add-ons
                  </span>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 rounded-xl border border-black/[0.06] bg-[#FAF9F6]">
                    {addons.map((a: any) => {
                      const isChecked = selectedAddonIds.includes(a.id);
                      return (
                        <label key={a.id} className="flex items-center gap-2 p-1 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedAddonIds([...selectedAddonIds, a.id]);
                              else setSelectedAddonIds(selectedAddonIds.filter((id) => id !== a.id));
                            }}
                            className="rounded border-black/[0.06] text-[#B4D58A] focus:ring-[#B4D58A]"
                          />
                          <span>{a.name} (+₹{a.price})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-black/[0.06]">
                <Button type="button" variant="outline" onClick={() => setIsItemModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={saveItemMutation.isPending}>
                  {editingItem ? 'Save Item' : 'Create Food Item'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Category */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#252525]/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white border border-black/[0.06] shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-black/[0.06]">
              <h2 className="font-bold text-lg font-semibold text-[#252525]">Add Menu Category</h2>
              <button onClick={() => setIsCategoryModalOpen(false)}>
                <X className="h-5 w-5 text-[#5A5D58]" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createCategoryMutation.mutate();
              }}
              className="space-y-4"
            >
              <Input
                label="Category Name *"
                type="text"
                placeholder="e.g. Starters, Tandoor"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                required
              />
              <Input
                label="Description"
                type="text"
                placeholder="Short descriptive subtitle..."
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsCategoryModalOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" isLoading={createCategoryMutation.isPending}>
                  Create Category
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Add-on */}
      {isAddonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#252525]/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white border border-black/[0.06] shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-black/[0.06]">
              <h2 className="font-bold text-lg font-semibold text-[#252525]">New Add-on Option</h2>
              <button onClick={() => setIsAddonModalOpen(false)}>
                <X className="h-5 w-5 text-[#5A5D58]" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createAddonMutation.mutate();
              }}
              className="space-y-4"
            >
              <Input
                label="Add-on Name *"
                type="text"
                placeholder="e.g. Extra Cheese, Extra Sauce"
                value={addonName}
                onChange={(e) => setAddonName(e.target.value)}
                required
              />
              <Input
                label="Price (₹) *"
                type="number"
                step="0.01"
                placeholder="30.00"
                value={addonPrice}
                onChange={(e) => setAddonPrice(e.target.value)}
                required
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsAddonModalOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" isLoading={createAddonMutation.isPending}>
                  Create Add-on
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
