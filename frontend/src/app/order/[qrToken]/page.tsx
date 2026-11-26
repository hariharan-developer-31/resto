'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Utensils,
  Bell,
  Search,
  Plus,
  Minus,
  Trash2,
  Clock,
  CheckCircle2,
  Flame,
  Coffee,
  ShoppingBag,
  Sparkles,
  ChevronRight,
  AlertCircle,
  X,
  Droplets,
  Receipt,
  User,
  Phone,
  Send,
} from 'lucide-react';

interface MenuVariant {
  id: number;
  name: string;
  price: number;
  is_default: boolean;
}

interface Addon {
  id: number;
  name: string;
  price: number;
}

interface MenuItem {
  id: number;
  name: string;
  category_id: number;
  description?: string;
  type: string;
  base_price: number;
  preparation_time: number;
  is_available: boolean;
  kitchen_station: string;
  variants: MenuVariant[];
  addons: Addon[];
}

interface CartItem {
  cartItemId: string;
  menuItemId: number;
  name: string;
  variantId?: number;
  variantName?: string;
  unitPrice: number;
  quantity: number;
  addons: { id: number; name: string; price: number }[];
  specialInstructions: string;
}

function TableQrOrderContent() {
  const params = useParams();
  const qrToken = String(params.qrToken || '');
  const queryClient = useQueryClient();

  // View Mode: 'menu' | 'track'
  const [activeTab, setActiveTab] = useState<'menu' | 'track'>('menu');
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [tableInstructions, setTableInstructions] = useState('');

  // Filtering
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'veg' | 'non_veg'>('all');

  // Customization modal
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<MenuVariant | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<Addon[]>([]);
  const [itemNote, setItemNote] = useState('');

  // Table Bell Service Modal
  const [bellModalOpen, setBellModalOpen] = useState(false);
  const [bellFeedback, setBellFeedback] = useState<string | null>(null);

  // Fetch Table & Digital Menu
  const { data: tableData, isLoading: tableLoading, error: tableError } = useQuery({
    queryKey: ['table-qr', qrToken],
    queryFn: async () => {
      const res = await apiClient.get<any>(`/public/table/${qrToken}`);
      return res.data;
    },
    refetchInterval: 8000,
  });

  const table = tableData?.table;
  const restaurant = tableData?.restaurant;
  const categories = tableData?.categories || [];
  const activeOrder = tableData?.active_order;

  // Active Order Tracking Query
  const { data: trackingData } = useQuery({
    queryKey: ['order-track', activeOrder?.order_number],
    queryFn: async () => {
      if (!activeOrder?.order_number) return null;
      const res = await apiClient.get<any>(`/public/orders/${activeOrder.order_number}/track`);
      return res.data;
    },
    enabled: !!activeOrder?.order_number,
    refetchInterval: 5000,
  });

  // Filtered Items
  const filteredItems = useMemo(() => {
    let items: MenuItem[] = [];
    if (selectedCategory === 'all') {
      items = categories.flatMap((c: any) => c.menu_items || []);
    } else {
      const cat = categories.find((c: any) => String(c.id) === selectedCategory);
      items = cat ? cat.menu_items || [] : [];
    }

    return items.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType =
        typeFilter === 'all'
          ? true
          : typeFilter === 'veg'
          ? item.type === 'veg' || item.type === 'vegan'
          : item.type === 'non_veg' || item.type === 'egg';

      return matchesSearch && matchesType;
    });
  }, [categories, selectedCategory, searchQuery, typeFilter]);

  // Cart Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const addonsSum = item.addons.reduce((a, b) => a + Number(b.price), 0);
      return sum + (Number(item.unitPrice) + addonsSum) * item.quantity;
    }, 0);
  }, [cart]);

  const taxAmount = Math.round(subtotal * 0.05 * 100) / 100;
  const grandTotal = Math.round((subtotal + taxAmount) * 100) / 100;
  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Cart Item Management
  const handleItemClick = (item: MenuItem) => {
    if (item.variants?.length > 0 || item.addons?.length > 0) {
      setCustomizingItem(item);
      setSelectedVariant(item.variants.find((v) => v.is_default) || item.variants[0] || null);
      setSelectedAddons([]);
      setItemNote('');
    } else {
      addToCartDirect(item, null, [], '');
    }
  };

  const addToCartDirect = (
    item: MenuItem,
    variant: MenuVariant | null,
    addons: Addon[],
    note: string
  ) => {
    const cartItemId = `${item.id}-${variant?.id || 'base'}-${addons.map((a) => a.id).sort().join(',')}`;

    setCart((prev) => {
      const existing = prev.find((i) => i.cartItemId === cartItemId);
      if (existing) {
        return prev.map((i) =>
          i.cartItemId === cartItemId ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          cartItemId,
          menuItemId: item.id,
          name: item.name,
          variantId: variant?.id,
          variantName: variant?.name,
          unitPrice: variant ? Number(variant.price) : Number(item.base_price),
          quantity: 1,
          addons: addons.map((a) => ({ id: a.id, name: a.name, price: Number(a.price) })),
          specialInstructions: note,
        },
      ];
    });

    setCustomizingItem(null);
  };

  const updateCartQuantity = (cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.cartItemId === cartItemId) {
            const newQty = i.quantity + delta;
            return newQty > 0 ? { ...i, quantity: newQty } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // Place Order Mutation
  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error('Cart is empty.');
      const res = await apiClient.post<any>(`/public/table/${qrToken}/order`, {
        customer_name: guestName || undefined,
        customer_phone: guestPhone || undefined,
        special_instructions: tableInstructions || undefined,
        items: cart.map((i) => ({
          menu_item_id: i.menuItemId,
          menu_variant_id: i.variantId || null,
          quantity: i.quantity,
          special_instructions: i.specialInstructions || null,
          addon_ids: i.addons.map((a) => a.id),
        })),
      });
      return res.data;
    },
    onSuccess: (data) => {
      setCart([]);
      setCartOpen(false);
      setActiveTab('track');
      queryClient.invalidateQueries({ queryKey: ['table-qr', qrToken] });
    },
  });

  // Table Bell Service Request Mutation
  const serviceRequestMutation = useMutation({
    mutationFn: async (requestType: string) => {
      const res = await apiClient.post<any>(`/public/table/${qrToken}/service-request`, {
        request_type: requestType,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setBellFeedback(data.message);
      setTimeout(() => {
        setBellModalOpen(false);
        setBellFeedback(null);
      }, 3000);
    },
  });

  if (tableLoading) {
    return (
      <div className="min-h-screen bg-[#FAF8F4] flex flex-col items-center justify-center p-4">
        <div className="h-12 w-12 rounded-2xl bg-[#C76B4A] text-white flex items-center justify-center font-bold animate-pulse mb-3">
          <Utensils className="h-6 w-6" />
        </div>
        <p className="text-xs text-[#777872] font-semibold">Opening Your Table Menu...</p>
      </div>
    );
  }

  if (tableError || !table) {
    return (
      <div className="min-h-screen bg-[#FAF8F4] flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="h-12 w-12 text-[#C84D4D] mb-3 stroke-1" />
        <h2 className="font-serif text-2xl font-bold text-[#292B28]">Table Standee Unresolved</h2>
        <p className="text-xs text-[#777872] max-w-sm mt-1">
          This QR code is either outdated or unlinked. Please ask your floor waiter for an updated table standee.
        </p>
        <Link href="/" className="mt-4">
          <Button variant="outline" className="text-xs">
            Visit Restaurant Homepage
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#292B28] flex flex-col pb-24 selection:bg-[#F8EAE3] selection:text-[#C76B4A]">
      {/* 1. TOP TABLE BANNER & DIGITAL BELL BAR */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#EAE7E0] p-3 shadow-xs">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[#C76B4A] text-white flex items-center justify-center font-bold text-sm shadow-xs">
              {table.table_number}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-[#292B28]">Table {table.table_number}</span>
                <span className="text-[10px] text-[#777872]">· {table.location}</span>
              </div>
              <span className="text-[10px] text-[#C76B4A] font-semibold block leading-tight">
                {restaurant?.name || 'The Grand Feast'}
              </span>
            </div>
          </div>

          {/* Digital Bell Button */}
          <button
            onClick={() => setBellModalOpen(true)}
            className="flex items-center gap-1.5 bg-[#FAF8F4] hover:bg-[#F8EAE3] border border-[#EAE7E0] hover:border-[#C76B4A] text-[#C76B4A] text-xs font-semibold px-3 py-1.5 rounded-xl transition-all shadow-xs"
          >
            <Bell className="h-3.5 w-3.5" />
            <span>Table Bell</span>
          </button>
        </div>
      </header>

      {/* 2. TAB SWITCHER (MENU vs LIVE TRACKER) */}
      {activeOrder && (
        <div className="max-w-md mx-auto w-full px-4 pt-3">
          <div className="bg-[#F3F1EB] p-1 rounded-xl flex text-xs font-semibold">
            <button
              onClick={() => setActiveTab('menu')}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                activeTab === 'menu'
                  ? 'bg-white text-[#C76B4A] shadow-xs'
                  : 'text-[#777872] hover:text-[#292B28]'
              }`}
            >
              Food Menu
            </button>
            <button
              onClick={() => setActiveTab('track')}
              className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'track'
                  ? 'bg-white text-[#C76B4A] shadow-xs'
                  : 'text-[#777872] hover:text-[#292B28]'
              }`}
            >
              <Flame className="h-3.5 w-3.5 text-[#C76B4A]" />
              <span>Live Order Tracker</span>
              <span className="h-1.5 w-1.5 rounded-full bg-[#39845C] animate-pulse" />
            </button>
          </div>
        </div>
      )}

      {/* 3. VIEW: LIVE ORDER TRACKER */}
      {activeTab === 'track' && trackingData ? (
        <div className="max-w-md mx-auto w-full p-4 space-y-4">
          {/* Progress Tracker Card */}
          <div className="bg-white rounded-2xl border border-[#EAE7E0] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1EEE8] pb-3">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-[#777872]">
                  Active Order Session
                </span>
                <h3 className="font-bold text-sm text-[#292B28]">{trackingData.order_number}</h3>
              </div>
              <Badge variant="success" className="text-[10px] uppercase">
                {trackingData.stage_label}
              </Badge>
            </div>

            {/* Stepper */}
            <div className="grid grid-cols-4 gap-1 text-center">
              {[
                { stage: 1, label: 'Received' },
                { stage: 2, label: 'Cooking' },
                { stage: 3, label: 'Ready' },
                { stage: 4, label: 'Served' },
              ].map((s) => {
                const isPassed = trackingData.stage >= s.stage;
                const isCurrent = trackingData.stage === s.stage;

                return (
                  <div key={s.stage} className="space-y-1">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        isPassed ? 'bg-[#39845C]' : 'bg-[#EAE7E0]'
                      }`}
                    />
                    <span
                      className={`text-[10px] block font-medium ${
                        isCurrent
                          ? 'font-bold text-[#292B28]'
                          : isPassed
                          ? 'text-[#39845C]'
                          : 'text-[#A2A29A]'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Items Status Breakdown */}
            <div className="pt-2 border-t border-[#F1EEE8] divide-y divide-[#F1EEE8] text-xs">
              {trackingData.items.map((item: any, idx: number) => (
                <div key={idx} className="py-2 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-[#292B28]">
                      {item.quantity}x {item.name}
                    </span>
                    {item.variant_name && (
                      <span className="text-[10px] text-[#777872] block">
                        Portion: {item.variant_name}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                      item.status === 'served'
                        ? 'bg-[#EAE7E0] text-[#777872]'
                        : item.status === 'ready'
                        ? 'bg-[#EBF5EF] text-[#39845C]'
                        : item.status === 'preparing'
                        ? 'bg-[#EBF3FC] text-[#5185B8]'
                        : 'bg-[#FBF5EA] text-[#D69A3A]'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Bill Summary */}
            <div className="bg-[#FAF8F4] p-3 rounded-xl border border-[#EAE7E0] flex justify-between items-center text-xs">
              <span className="text-[#777872]">Current Table Bill:</span>
              <span className="font-bold text-sm text-[#C76B4A]">
                ₹{Number(trackingData.total_amount).toFixed(2)}
              </span>
            </div>

            {/* Add More Items Button */}
            <Button
              onClick={() => setActiveTab('menu')}
              className="w-full bg-[#C76B4A] hover:bg-[#AE593B] text-white text-xs font-semibold h-10 rounded-xl"
            >
              + Order Additional Food (Round {trackingData.round_count + 1})
            </Button>
          </div>
        </div>
      ) : (
        /* 4. VIEW: FOOD MENU & BROWSING */
        <div className="max-w-md mx-auto w-full p-4 space-y-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-3.5 w-3.5 text-[#777872]" />
            <Input
              placeholder="Search dishes, biryani, starters..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 pl-9 text-xs rounded-xl bg-white border-[#EAE7E0]"
            />
          </div>

          {/* Veg / Non-Veg Quick Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                typeFilter === 'all'
                  ? 'bg-[#292B28] text-white shadow-xs'
                  : 'bg-white text-[#777872] border border-[#EAE7E0]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setTypeFilter('veg')}
              className={`px-3 py-1 rounded-lg font-medium flex items-center gap-1 transition-all ${
                typeFilter === 'veg'
                  ? 'bg-[#39845C] text-white shadow-xs'
                  : 'bg-white text-[#39845C] border border-[#39845C]/30'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-[#39845C]" /> Veg
            </button>
            <button
              onClick={() => setTypeFilter('non_veg')}
              className={`px-3 py-1 rounded-lg font-medium flex items-center gap-1 transition-all ${
                typeFilter === 'non_veg'
                  ? 'bg-[#C84D4D] text-white shadow-xs'
                  : 'bg-white text-[#C84D4D] border border-[#C84D4D]/30'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-[#C84D4D]" /> Non-Veg
            </button>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl shrink-0 transition-all ${
                selectedCategory === 'all'
                  ? 'bg-[#C76B4A] text-white shadow-xs'
                  : 'bg-white text-[#777872] border border-[#EAE7E0]'
              }`}
            >
              All Categories
            </button>
            {categories.map((c: any) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(String(c.id))}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl shrink-0 transition-all ${
                  selectedCategory === String(c.id)
                    ? 'bg-[#C76B4A] text-white shadow-xs'
                    : 'bg-white text-[#777872] border border-[#EAE7E0]'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Dishes List */}
          <div className="space-y-2.5 pt-1">
            {filteredItems.map((item) => {
              const isVeg = item.type === 'veg' || item.type === 'vegan';
              const hasVariants = item.variants?.length > 0;
              const hasAddons = item.addons?.length > 0;

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-[#EAE7E0] p-3.5 flex items-start justify-between gap-3 shadow-xs"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-3 w-3 rounded-sm border flex items-center justify-center p-0.5 ${
                          isVeg ? 'border-[#39845C]' : 'border-[#C84D4D]'
                        }`}
                      >
                        <div
                          className={`h-1.5 w-1.5 rounded-full ${
                            isVeg ? 'bg-[#39845C]' : 'bg-[#C84D4D]'
                          }`}
                        />
                      </div>
                      <span className="font-bold text-xs text-[#292B28] leading-tight">
                        {item.name}
                      </span>
                    </div>

                    {item.description && (
                      <p className="text-[11px] text-[#777872] line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}

                    <div className="pt-1 flex items-baseline gap-2">
                      <span className="font-bold text-sm text-[#C76B4A]">
                        ₹{Number(item.base_price).toFixed(2)}
                      </span>
                      {hasVariants && (
                        <span className="text-[10px] text-[#777872]">
                          ({item.variants.length} portions)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Add Button */}
                  <Button
                    size="sm"
                    onClick={() => handleItemClick(item)}
                    className="shrink-0 h-8 px-3 text-xs bg-[#FAF8F4] text-[#C76B4A] hover:bg-[#C76B4A] hover:text-white border border-[#EAE7E0] rounded-xl font-bold"
                  >
                    {hasVariants || hasAddons ? 'Add +' : '+ Add'}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. FLOATING CART BOTTOM BAR */}
      {cart.length > 0 && (
        <div className="fixed bottom-3 inset-x-3 z-40 max-w-md mx-auto">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full bg-[#C76B4A] hover:bg-[#AE593B] text-white p-3.5 rounded-2xl shadow-xl flex items-center justify-between text-xs font-semibold transition-all active:scale-[0.99]"
          >
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-white text-[#C76B4A] flex items-center justify-center font-bold">
                {totalCartCount}
              </span>
              <span>View Table Cart</span>
            </div>
            <div className="flex items-center gap-1.5 font-bold text-sm">
              <span>₹{grandTotal.toFixed(2)}</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </button>
        </div>
      )}

      {/* 6. GUEST CART DRAWER / MODAL */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full border border-[#EAE7E0] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom duration-200">
            {/* Header */}
            <div className="p-4 border-b border-[#EAE7E0] bg-[#FAF8F4] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#292B28]">Table {table.table_number} Cart</h3>
                <span className="text-xs text-[#777872]">
                  {activeOrder
                    ? `Adding new round to Order #${activeOrder.order_number}`
                    : 'Initial order creation'}
                </span>
              </div>
              <button onClick={() => setCartOpen(false)} className="text-[#777872] hover:text-[#292B28]">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 p-4 overflow-y-auto divide-y divide-[#F1EEE8]">
              {cart.map((item) => {
                const addonsSum = item.addons.reduce((a, b) => a + Number(b.price), 0);
                const itemTotal = (Number(item.unitPrice) + addonsSum) * item.quantity;

                return (
                  <div key={item.cartItemId} className="py-2.5 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-[#292B28]">{item.name}</span>
                        {item.variantName && (
                          <span className="text-[10px] bg-[#F8EAE3] text-[#C76B4A] px-1.5 py-0.2 rounded font-medium">
                            {item.variantName}
                          </span>
                        )}
                      </div>

                      {item.addons.length > 0 && (
                        <div className="text-[10px] text-[#777872] mt-0.5">
                          + {item.addons.map((a) => `${a.name} (₹${a.price})`).join(', ')}
                        </div>
                      )}

                      {item.specialInstructions && (
                        <div className="text-[10px] italic text-[#C76B4A] mt-0.5">
                          Note: {item.specialInstructions}
                        </div>
                      )}

                      <span className="text-xs font-bold text-[#C76B4A] block mt-1">
                        ₹{itemTotal.toFixed(2)}
                      </span>
                    </div>

                    {/* Stepper */}
                    <div className="flex items-center gap-2 bg-[#FAF8F4] border border-[#EAE7E0] rounded-xl p-1">
                      <button
                        onClick={() => updateCartQuantity(item.cartItemId, -1)}
                        className="h-6 w-6 rounded flex items-center justify-center text-[#777872]"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateCartQuantity(item.cartItemId, 1)}
                        className="h-6 w-6 rounded flex items-center justify-center text-[#777872]"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Guest Details & Bill Summary */}
            <div className="p-4 border-t border-[#EAE7E0] bg-[#FAF8F4] space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Input
                  placeholder="Your Name (Optional)"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="h-9 text-xs bg-white"
                />
                <Input
                  placeholder="Phone (Optional)"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="h-9 text-xs bg-white"
                />
              </div>

              <div className="space-y-1 text-xs text-[#777872]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="text-[#292B28] font-semibold">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>5% GST</span>
                  <span className="text-[#292B28] font-semibold">₹{taxAmount.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-[#EAE7E0] flex justify-between font-bold text-sm text-[#292B28]">
                  <span>Total Amount</span>
                  <span className="text-[#C76B4A]">₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <Button
                disabled={placeOrderMutation.isPending}
                onClick={() => placeOrderMutation.mutate()}
                className="w-full bg-[#C76B4A] hover:bg-[#AE593B] text-white text-xs font-semibold h-11 rounded-xl shadow-xs"
              >
                {placeOrderMutation.isPending ? 'Sending to Kitchen...' : 'Place Table Order'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 7. CUSTOMIZATION MODAL */}
      {customizingItem && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-[#EAE7E0] shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#EAE7E0]">
              <h3 className="font-bold text-sm text-[#292B28]">{customizingItem.name}</h3>
              <button onClick={() => setCustomizingItem(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Variants */}
            {customizingItem.variants?.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-[#777872] uppercase">Choose Size</span>
                {customizingItem.variants.map((v) => (
                  <label
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between text-xs cursor-pointer ${
                      selectedVariant?.id === v.id
                        ? 'bg-[#F8EAE3] border-[#C76B4A] font-bold text-[#C76B4A]'
                        : 'border-[#EAE7E0]'
                    }`}
                  >
                    <span>{v.name}</span>
                    <span>₹{Number(v.price).toFixed(2)}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Addons */}
            {customizingItem.addons?.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-[#777872] uppercase">Custom Add-ons</span>
                {customizingItem.addons.map((a) => {
                  const isChecked = selectedAddons.some((x) => x.id === a.id);
                  return (
                    <label
                      key={a.id}
                      className="p-2.5 rounded-xl border border-[#EAE7E0] flex items-center justify-between text-xs cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedAddons([...selectedAddons, a]);
                            else setSelectedAddons(selectedAddons.filter((x) => x.id !== a.id));
                          }}
                        />
                        <span>{a.name}</span>
                      </div>
                      <span className="font-semibold text-[#66745B]">+₹{Number(a.price).toFixed(2)}</span>
                    </label>
                  );
                })}
              </div>
            )}

            <Button
              onClick={() =>
                addToCartDirect(customizingItem, selectedVariant, selectedAddons, itemNote)
              }
              className="w-full bg-[#C76B4A] hover:bg-[#AE593B] text-white text-xs h-9 rounded-xl"
            >
              Add to Order
            </Button>
          </div>
        </div>
      )}

      {/* 8. DIGITAL TABLE BELL MODAL */}
      {bellModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xs w-full border border-[#EAE7E0] shadow-2xl p-5 space-y-4 text-center">
            <div className="h-12 w-12 rounded-full bg-[#F8EAE3] text-[#C76B4A] flex items-center justify-center mx-auto">
              <Bell className="h-6 w-6" />
            </div>

            <div>
              <h3 className="font-bold text-base text-[#292B28]">Digital Table Bell</h3>
              <p className="text-xs text-[#777872]">
                Instant floor notification for Table {table.table_number}
              </p>
            </div>

            {bellFeedback ? (
              <div className="bg-[#EBF5EF] border border-[#D5EAD9] p-3 rounded-xl text-xs text-[#39845C] font-semibold">
                {bellFeedback}
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                <Button
                  onClick={() => serviceRequestMutation.mutate('call_waiter')}
                  className="w-full bg-white hover:bg-[#FAF8F4] text-[#292B28] border border-[#EAE7E0] h-10 rounded-xl font-semibold flex items-center gap-2 justify-center"
                >
                  <User className="h-4 w-4 text-[#C76B4A]" /> Call Waiter to Table
                </Button>
                <Button
                  onClick={() => serviceRequestMutation.mutate('request_water')}
                  className="w-full bg-white hover:bg-[#FAF8F4] text-[#292B28] border border-[#EAE7E0] h-10 rounded-xl font-semibold flex items-center gap-2 justify-center"
                >
                  <Droplets className="h-4 w-4 text-[#5185B8]" /> Request Fresh Water
                </Button>
                <Button
                  onClick={() => serviceRequestMutation.mutate('request_bill')}
                  className="w-full bg-white hover:bg-[#FAF8F4] text-[#292B28] border border-[#EAE7E0] h-10 rounded-xl font-semibold flex items-center gap-2 justify-center"
                >
                  <Receipt className="h-4 w-4 text-[#66745B]" /> Request Final Bill
                </Button>
              </div>
            )}

            <Button
              variant="outline"
              onClick={() => setBellModalOpen(false)}
              className="w-full text-xs h-8 rounded-xl"
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TableQrOrderPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF8F4] flex flex-col items-center justify-center p-4">
          <div className="h-12 w-12 rounded-2xl bg-[#C76B4A] text-white flex items-center justify-center font-bold animate-pulse mb-3">
            <Utensils className="h-6 w-6" />
          </div>
          <p className="text-xs text-[#777872] font-semibold">Opening Your Table Menu...</p>
        </div>
      }
    >
      <TableQrOrderContent />
    </React.Suspense>
  );
}
