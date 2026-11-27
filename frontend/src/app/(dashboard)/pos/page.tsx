'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TenantGuard } from '@/components/layout/tenant-guard';
import {
  UtensilsCrossed,
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  CreditCard,
  Banknote,
  Smartphone,
  Receipt,
  RotateCcw,
  Clock,
  Sparkles,
  Layers,
  ChevronRight,
  User,
  Phone,
  CheckCircle2,
  AlertCircle,
  X,
  Send,
  Coffee,
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
  is_active: boolean;
}

interface MenuItem {
  id: number;
  name: string;
  category_id: number;
  category?: { id: number; name: string };
  type: 'veg' | 'non_veg' | 'egg' | 'vegan';
  base_price: number;
  tax_rate: number;
  preparation_time: number;
  is_available: boolean;
  kitchen_station: string;
  variants: MenuVariant[];
  addons: Addon[];
}

interface DiningTable {
  id: number;
  table_number: string;
  seating_capacity: number;
  location: string;
  status: 'available' | 'occupied' | 'reserved' | 'billing' | 'cleaning' | 'out_of_service';
  waiter?: { id: number; name: string };
  active_order?: any;
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
  kitchenStation: string;
}

export default function PosPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const activeRestaurant = useAuthStore((s) => s.activeRestaurant);
  const activeBranch = useAuthStore((s) => s.activeBranch);
  const currencySymbol = activeRestaurant?.currency_symbol || '₹';

  // POS State
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');
  const [selectedTable, setSelectedTable] = useState<DiningTable | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'veg' | 'non_veg'>('all');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [packagingCharge, setPackagingCharge] = useState<number>(0);
  const [serviceCharge, setServiceCharge] = useState<number>(0);

  // Reset table and cart when switching branch or restaurant
  useEffect(() => {
    setSelectedTable(null);
    setCart([]);
    setSelectedCategory('all');
  }, [activeRestaurant?.id, activeBranch?.id]);

  // Modals
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<MenuVariant | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<Addon[]>([]);
  const [itemNote, setItemNote] = useState('');

  // Post-Action Modals
  const [kotData, setKotData] = useState<any | null>(null);
  const [settlementOrder, setSettlementOrder] = useState<any | null>(null);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'card' | 'upi' | 'split'>('cash');
  const [tenderAmount, setTenderAmount] = useState<number>(0);
  const [splitPayments, setSplitPayments] = useState<{ payment_method: 'cash' | 'card' | 'upi'; amount: number }[]>([
    { payment_method: 'cash', amount: 0 },
    { payment_method: 'upi', amount: 0 },
    { payment_method: 'card', amount: 0 },
  ]);
  const [invoiceData, setInvoiceData] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch Categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', activeRestaurant?.id],
    queryFn: async () => {
      const res = await apiClient.get<any[]>('/categories');
      return res.data || [];
    },
    enabled: !!activeRestaurant?.id,
  });

  // Fetch Menu Items (up to 100 items)
  const { data: menuItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['menu-items', activeRestaurant?.id],
    queryFn: async () => {
      const res = await apiClient.get<any>('/menu-items?per_page=100');
      return res.data?.data || res.data || [];
    },
    enabled: !!activeRestaurant?.id,
  });

  // Fetch Tables (unwrap { tables, branch, locations })
  const { data: tables = [], refetch: refetchTables } = useQuery({
    queryKey: ['tables', activeRestaurant?.id, activeBranch?.id],
    queryFn: async () => {
      const res = await apiClient.get<any>('/tables');
      return Array.isArray(res.data) ? res.data : res.data?.tables || [];
    },
    enabled: !!activeRestaurant?.id && !!activeBranch?.id,
  });

  // Fetch Active Order for Selected Table
  const { data: activeTableOrder, refetch: refetchActiveOrder } = useQuery({
    queryKey: ['table-active-order', activeBranch?.id, selectedTable?.id],
    queryFn: async () => {
      if (!selectedTable?.id) return null;
      const res = await apiClient.get<any>(`/orders?table_id=${selectedTable.id}&active_only=true`);
      const orders = res.data?.data || [];
      return orders.length > 0 ? orders[0] : null;
    },
    enabled: !!selectedTable?.id && orderType === 'dine_in',
  });

  // Filtered Menu Items
  const filteredItems = useMemo(() => {
    return menuItems.filter((item: MenuItem) => {
      const matchesCategory =
        selectedCategory === 'all' || String(item.category_id) === selectedCategory;
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType =
        typeFilter === 'all'
          ? true
          : typeFilter === 'veg'
          ? item.type === 'veg' || item.type === 'vegan'
          : item.type === 'non_veg' || item.type === 'egg';

      return matchesCategory && matchesSearch && matchesType;
    });
  }, [menuItems, selectedCategory, searchQuery, typeFilter]);

  // Cart Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const addonsSum = item.addons.reduce((a, b) => a + Number(b.price), 0);
      return sum + (Number(item.unitPrice) + addonsSum) * item.quantity;
    }, 0);
  }, [cart]);

  const taxAmount = useMemo(() => {
    // 5% standard GST
    return Math.round(subtotal * 0.05 * 100) / 100;
  }, [subtotal]);

  const grandTotal = useMemo(() => {
    const total = subtotal + taxAmount + serviceCharge + packagingCharge - discountAmount;
    return Math.max(0, Math.round(total * 100) / 100);
  }, [subtotal, taxAmount, serviceCharge, packagingCharge, discountAmount]);

  // Add Item Click
  const handleItemClick = (item: MenuItem) => {
    if (!item.is_available) return;

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
    const cartItemId = `${item.id}-${variant?.id || 'base'}-${addons.map((a) => a.id).sort().join(',')}-${note.trim().toLowerCase()}`;

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
          kitchenStation: item.kitchen_station,
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

  const removeCartItem = (cartItemId: string) => {
    setCart((prev) => prev.filter((i) => i.cartItemId !== cartItemId));
  };

  // Create Order / Fire KOT Mutation
  const fireKotMutation = useMutation({
    mutationFn: async (options?: { suppressKotModal?: boolean }) => {
      setErrorMsg(null);
      if (cart.length === 0) throw new Error('Cart cannot be empty.');
      if (orderType === 'dine_in' && !selectedTable) {
        throw new Error('Please select a dining table for Dine-In order.');
      }

      const payload = {
        order_type: orderType,
        table_id: orderType === 'dine_in' ? selectedTable?.id : null,
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        discount_amount: discountAmount,
        service_charge: serviceCharge,
        packaging_charge: packagingCharge,
        items: cart.map((item) => ({
          menu_item_id: item.menuItemId,
          menu_variant_id: item.variantId || null,
          quantity: item.quantity,
          special_instructions: item.specialInstructions || null,
          addon_ids: item.addons.map((a) => a.id),
        })),
      };

      const res = await apiClient.post<any>('/orders', payload);
      return { ...res.data, suppressKotModal: options?.suppressKotModal };
    },
    onSuccess: (data) => {
      if (!data.suppressKotModal) {
        setKotData(data);
      }
      setCart([]);
      toast.success(`KOT ${data.kot_number} sent to kitchen!`);
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      refetchActiveOrder();
    },
    onError: (err: any) => {
      const msg = err?.message || 'Failed to place order.';
      setErrorMsg(msg);
      toast.error(msg);
    },
  });

  // Settle Bill Mutation
  const settleBillMutation = useMutation({
    mutationFn: async () => {
      if (!settlementOrder) throw new Error('No order selected for settlement.');

      const payload: any = {
        discount_amount: discountAmount > 0 ? discountAmount : Number(settlementOrder.discount_amount || 0),
        service_charge: serviceCharge > 0 ? serviceCharge : Number(settlementOrder.service_charge || 0),
        table_status_after: 'cleaning',
      };

      if (paymentMode === 'split') {
        const activeSplits = splitPayments.filter((p) => p.amount > 0);
        if (activeSplits.length === 0) {
          throw new Error('Enter at least one split payment amount.');
        }
        payload.payment_method = 'split';
        payload.payments = activeSplits;
      } else {
        payload.payment_method = paymentMode;
        payload.paid_amount = tenderAmount || settlementOrder.total_amount;
      }

      const res = await apiClient.post<any>(`/orders/${settlementOrder.id}/settle`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      setInvoiceData(data);
      setSettlementOrder(null);
      setDiscountAmount(0);
      setServiceCharge(0);
      setPackagingCharge(0);
      toast.success(`Invoice ${data.invoice_number} settled!`);
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      refetchActiveOrder();
      refetchTables();
    },
    onError: (err: any) => {
      const msg = err?.message || 'Failed to settle bill.';
      setErrorMsg(msg);
      toast.error(msg);
    },
  });

  return (
    <TenantGuard requireBranch stationName="POS Station">
      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-5.5rem)] -m-4 sm:-m-6 p-4 overflow-hidden bg-[#FAF9F6]">
      {/* LEFT PANE: Tables, Categories & Item Catalog */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-xl border border-black/[0.06] shadow-xs overflow-hidden">
        {/* TOP BAR: Mode Selector & Table Strip */}
        <div className="p-3 border-b border-black/[0.06] bg-[#FAF9F6]/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Order Type Switcher */}
          <div className="flex bg-[#F3DA8A]/25 p-1 rounded-lg">
            <button
              onClick={() => {
                setOrderType('dine_in');
                setPackagingCharge(0);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                orderType === 'dine_in'
                  ? 'bg-white text-[#B4D58A] shadow-xs'
                  : 'text-[#5A5D58] hover:text-[#252525]'
              }`}
            >
              🍽️ Dine-In
            </button>
            <button
              onClick={() => {
                setOrderType('takeaway');
                setSelectedTable(null);
                setPackagingCharge(25);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                orderType === 'takeaway'
                  ? 'bg-white text-[#B4D58A] shadow-xs'
                  : 'text-[#5A5D58] hover:text-[#252525]'
              }`}
            >
              🛍️ Takeaway
            </button>
            <button
              onClick={() => {
                setOrderType('delivery');
                setSelectedTable(null);
                setPackagingCharge(40);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                orderType === 'delivery'
                  ? 'bg-white text-[#B4D58A] shadow-xs'
                  : 'text-[#5A5D58] hover:text-[#252525]'
              }`}
            >
              🛵 Delivery
            </button>
          </div>

          {/* Dine-In: Selected Table Banner or Takeaway inputs */}
          {orderType === 'dine_in' ? (
            <div className="flex items-center gap-2 overflow-x-auto max-w-full py-0.5">
              <span className="text-xs text-[#5A5D58] font-medium shrink-0">Tables:</span>
              {tables.map((t: DiningTable) => {
                const isSelected = selectedTable?.id === t.id;
                const isOccupied = t.status === 'occupied';
                const isBilled = t.status === 'billing';

                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTable(t)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md shrink-0 border transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#B4D58A] text-white border-[#B4D58A] shadow-xs'
                        : isOccupied
                        ? 'bg-[#B4D58A]/20 text-[#B4D58A] border-[#CFE2F7] hover:bg-[#CFE2F7]'
                        : isBilled
                        ? 'bg-[#F5EDF9] text-[#8E44AD] border-[#E8D7F1]'
                        : 'bg-white text-[#252525] border-black/[0.06] hover:bg-[#F3DA8A]/25'
                    }`}
                  >
                    <span>{t.table_number}</span>
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isSelected
                          ? 'bg-white'
                          : isOccupied
                          ? 'bg-[#B4D58A]'
                          : isBilled
                          ? 'bg-[#8E44AD]'
                          : 'bg-[#B4D58A]'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative">
                <User className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[#5A5D58]" />
                <Input
                  placeholder="Customer Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-8 pl-8 text-xs w-36"
                />
              </div>
              <div className="relative">
                <Phone className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[#5A5D58]" />
                <Input
                  placeholder="Phone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="h-8 pl-8 text-xs w-32"
                />
              </div>
            </div>
          )}
        </div>

        {/* ACTIVE TABLE ORDER NOTIFICATION BANNER */}
        {orderType === 'dine_in' && selectedTable && activeTableOrder && (
          <div className="bg-[#B4D58A]/20 border-b border-[#CFE2F7] px-4 py-2 flex items-center justify-between text-xs text-[#B4D58A] shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-bold">Table {selectedTable.table_number} has an Active Order</span>
              <span>· {activeTableOrder.order_number}</span>
              <span>· Round {activeTableOrder.round_count} ({activeTableOrder.items?.length || 0} items)</span>
              <span>· Total: ₹{Number(activeTableOrder.total_amount).toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#B4D58A]">Adding items fires Round {activeTableOrder.round_count + 1}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSettlementOrder(activeTableOrder);
                  setTenderAmount(Number(activeTableOrder.total_amount));
                }}
                className="h-7 px-2.5 text-xs bg-white text-[#B4D58A] border-[#B4D58A] hover:bg-[#B4D58A]/20"
              >
                Settle Table Bill
              </Button>
            </div>
          </div>
        )}

        {/* SEARCH & FILTERS BAR */}
        <div className="p-3 border-b border-black/[0.06] flex flex-wrap items-center justify-between gap-2 shrink-0">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#5A5D58]" />
            <Input
              placeholder="Search food by name, code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-8 text-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-[#5A5D58] hover:text-[#252525]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Veg / Non-Veg Quick Filter */}
          <div className="flex items-center gap-1 bg-[#F3DA8A]/25 p-1 rounded-lg text-xs">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                typeFilter === 'all' ? 'bg-white text-[#252525] shadow-xs' : 'text-[#5A5D58]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setTypeFilter('veg')}
              className={`px-2.5 py-1 rounded font-medium flex items-center gap-1 transition-all ${
                typeFilter === 'veg' ? 'bg-[#B4D58A] text-white shadow-xs' : 'text-[#B4D58A]'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-[#B4D58A] border border-white" /> Veg
            </button>
            <button
              onClick={() => setTypeFilter('non_veg')}
              className={`px-2.5 py-1 rounded font-medium flex items-center gap-1 transition-all ${
                typeFilter === 'non_veg' ? 'bg-[#F2AFC0] text-white shadow-xs' : 'text-[#F2AFC0]'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-[#F2AFC0] border border-white" /> Non-Veg
            </button>
          </div>
        </div>

        {/* CATEGORY TABS STRIP */}
        <div className="px-3 py-2 border-b border-black/[0.06] bg-[#FAF9F6] overflow-x-auto flex gap-1.5 shrink-0">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition-all ${
              selectedCategory === 'all'
                ? 'bg-[#B4D58A] text-white shadow-xs'
                : 'bg-white text-[#5A5D58] border border-black/[0.06] hover:bg-[#F3DA8A]/25'
            }`}
          >
            All Items ({menuItems.length})
          </button>
          {categories.map((cat: any) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(String(cat.id))}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition-all ${
                selectedCategory === String(cat.id)
                  ? 'bg-[#B4D58A] text-white shadow-xs'
                  : 'bg-white text-[#5A5D58] border border-black/[0.06] hover:bg-[#F3DA8A]/25'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* DISHES GRID */}
        <div className="flex-1 p-3 overflow-y-auto">
          {itemsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-28 rounded-xl bg-[#F3DA8A]/25 animate-pulse" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-[#5A5D58]">
              <UtensilsCrossed className="h-8 w-8 mb-2 stroke-1 text-[#8E928B]" />
              <p className="text-sm font-medium">No dishes match your filter criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {filteredItems.map((item: MenuItem) => {
                const isVeg = item.type === 'veg' || item.type === 'vegan';
                const hasVariants = item.variants?.length > 0;
                const hasAddons = item.addons?.length > 0;

                return (
                  <button
                    key={item.id}
                    disabled={!item.is_available}
                    onClick={() => handleItemClick(item)}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all group relative ${
                      item.is_available
                        ? 'bg-white border-black/[0.06] hover:border-[#B4D58A] hover:shadow-xs active:scale-[0.98]'
                        : 'bg-[#F9F9F8] border-black/[0.06] opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div>
                      {/* Top indicator & station */}
                      <div className="flex items-center justify-between mb-1.5">
                        <div
                          className={`h-3 w-3 rounded-sm border flex items-center justify-center p-0.5 ${
                            isVeg ? 'border-[#B4D58A]' : 'border-[#F2AFC0]'
                          }`}
                        >
                          <div
                            className={`h-1.5 w-1.5 rounded-full ${
                              isVeg ? 'bg-[#B4D58A]' : 'bg-[#F2AFC0]'
                            }`}
                          />
                        </div>
                        <span className="text-[10px] text-[#5A5D58] uppercase font-mono tracking-wider bg-[#F3DA8A]/25 px-1.5 py-0.5 rounded">
                          {item.kitchen_station}
                        </span>
                      </div>

                      {/* Name */}
                      <h4 className="text-xs font-semibold text-[#252525] line-clamp-2 leading-tight">
                        {item.name}
                      </h4>
                    </div>

                    {/* Bottom: Price and Variant Tag */}
                    <div className="mt-2 pt-2 border-t border-black/[0.04] flex items-center justify-between">
                      <span className="text-xs font-bold text-[#B4D58A]">
                        ₹{Number(item.base_price).toFixed(2)}
                      </span>

                      {hasVariants || hasAddons ? (
                        <span className="text-[10px] text-[#5A5D58] bg-[#FAF9F6] px-1.5 py-0.5 rounded border border-black/[0.06]">
                          Customize +
                        </span>
                      ) : (
                        <span className="h-5 w-5 rounded-full bg-[#B4D58A]/20 text-[#B4D58A] flex items-center justify-center group-hover:bg-[#B4D58A] group-hover:text-white transition-colors">
                          <Plus className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANE: Order Cart, KOT Dispatch & Bill Settlement */}
      <div className="w-full lg:w-96 flex flex-col bg-white rounded-xl border border-black/[0.06] shadow-xs overflow-hidden shrink-0">
        {/* Cart Header */}
        <div className="p-3.5 border-b border-black/[0.06] bg-[#FAF9F6]/80 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-sm text-[#252525]">Order Cart</h3>
              <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                {orderType.replace('_', ' ')}
              </Badge>
            </div>
            <p className="text-[11px] text-[#5A5D58] mt-0.5">
              {orderType === 'dine_in'
                ? selectedTable
                  ? `Table ${selectedTable.table_number} · ${selectedTable.location}`
                  : 'Select Table to proceed'
                : customerName
                ? `${customerName} (${customerPhone || 'Counter'})`
                : 'Direct Counter Sale'}
            </p>
          </div>

          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="text-xs text-[#F2AFC0] hover:underline font-medium flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" /> Clear
            </button>
          )}
        </div>

        {/* Error message if any */}
        {errorMsg && (
          <div className="bg-[#FDF2F2] border-b border-[#F9D6D6] px-3 py-2 text-xs text-[#F2AFC0] flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Cart Items List */}
        <div className="flex-1 p-3 overflow-y-auto divide-y divide-black/[0.04]">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#5A5D58]">
              <Receipt className="h-10 w-10 mb-2 stroke-1 text-[#8E928B]" />
              <p className="text-xs font-semibold text-[#252525]">Cart is empty</p>
              <p className="text-[11px] mt-0.5">
                Click any dish from the catalog to add items to this order.
              </p>
            </div>
          ) : (
            cart.map((item) => {
              const addonsSum = item.addons.reduce((a, b) => a + Number(b.price), 0);
              const itemTotal = (Number(item.unitPrice) + addonsSum) * item.quantity;

              return (
                <div key={item.cartItemId} className="py-2.5 flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-[#252525] leading-tight">
                        {item.name}
                      </span>
                      {item.variantName && (
                        <span className="text-[10px] bg-[#B4D58A]/20 text-[#B4D58A] px-1.5 py-0.2 rounded font-medium">
                          {item.variantName}
                        </span>
                      )}
                    </div>

                    {/* Addons List */}
                    {item.addons.length > 0 && (
                      <div className="text-[10px] text-[#5A5D58] mt-0.5">
                        + {item.addons.map((a) => `${a.name} (₹${a.price})`).join(', ')}
                      </div>
                    )}

                    {/* Special Note */}
                    {item.specialInstructions && (
                      <div className="text-[10px] italic text-[#B4D58A] mt-0.5">
                        Note: {item.specialInstructions}
                      </div>
                    )}

                    <div className="text-xs font-bold text-[#252525] mt-1">
                      ₹{itemTotal.toFixed(2)}
                    </div>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-1.5 bg-[#FAF9F6] border border-black/[0.06] rounded-lg p-0.5">
                    <button
                      onClick={() => updateCartQuantity(item.cartItemId, -1)}
                      className="h-6 w-6 rounded flex items-center justify-center text-[#5A5D58] hover:bg-white hover:text-[#252525] transition-colors"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateCartQuantity(item.cartItemId, 1)}
                      className="h-6 w-6 rounded flex items-center justify-center text-[#5A5D58] hover:bg-white hover:text-[#252525] transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Cart Calculation & Settle Footer */}
        <div className="p-3.5 border-t border-black/[0.06] bg-[#FAF9F6]/50 shrink-0 space-y-2">
          {/* Subtotal, Tax, Charges Breakdown */}
          {/* Quick Discount & Service Charge Inputs */}
          <div className="grid grid-cols-2 gap-2 pb-1">
            <div>
              <label className="text-[10px] font-semibold text-[#5A5D58] block mb-0.5">
                Discount ({currencySymbol})
              </label>
              <Input
                type="number"
                min={0}
                value={discountAmount || ''}
                onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value)))}
                placeholder="0"
                className="h-7 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[#5A5D58] block mb-0.5">
                Service Charge ({currencySymbol})
              </label>
              <Input
                type="number"
                min={0}
                value={serviceCharge || ''}
                onChange={(e) => setServiceCharge(Math.max(0, Number(e.target.value)))}
                placeholder="0"
                className="h-7 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-[#5A5D58]">
              <span>Subtotal</span>
              <span className="font-semibold text-[#252525]">{currencySymbol}{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[#5A5D58]">
              <span>Taxes (5% GST)</span>
              <span className="font-semibold text-[#252525]">{currencySymbol}{taxAmount.toFixed(2)}</span>
            </div>
            {serviceCharge > 0 && (
              <div className="flex justify-between text-[#5A5D58]">
                <span>Service Charge</span>
                <span className="font-semibold text-[#252525]">{currencySymbol}{serviceCharge.toFixed(2)}</span>
              </div>
            )}
            {packagingCharge > 0 && (
              <div className="flex justify-between text-[#5A5D58]">
                <span>Packaging Charge</span>
                <span className="font-semibold text-[#252525]">{currencySymbol}{packagingCharge.toFixed(2)}</span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="flex justify-between text-[#B4D58A]">
                <span>Discount Applied</span>
                <span className="font-semibold">-{currencySymbol}{discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-black/[0.06] flex justify-between items-baseline">
              <span className="font-bold text-sm text-[#252525]">Grand Total</span>
              <span className="font-bold text-lg text-[#B4D58A]">{currencySymbol}{grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 grid grid-cols-2 gap-2">
            {/* Fire KOT */}
            <Button
              disabled={cart.length === 0 || fireKotMutation.isPending}
              onClick={() => fireKotMutation.mutate(undefined)}
              className="bg-[#B4D58A] hover:bg-[#9EC271] text-white text-xs font-semibold h-10 flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Send className="h-3.5 w-3.5" />
              {fireKotMutation.isPending ? 'Sending...' : 'Fire KOT'}
            </Button>

            {/* Settle Bill (or Active Table Settlement) */}
            <Button
              variant="outline"
              disabled={(!activeTableOrder && cart.length === 0) || fireKotMutation.isPending}
              onClick={async () => {
                if (activeTableOrder && cart.length === 0) {
                  setSettlementOrder(activeTableOrder);
                  setTenderAmount(Number(activeTableOrder.total_amount));
                  setDiscountAmount(Number(activeTableOrder.discount_amount || 0));
                  setServiceCharge(Number(activeTableOrder.service_charge || 0));
                } else if (cart.length > 0) {
                  try {
                    const res = await fireKotMutation.mutateAsync({ suppressKotModal: true });
                    setSettlementOrder(res.order);
                    setTenderAmount(Number(res.order.total_amount));
                    setDiscountAmount(Number(res.order.discount_amount || 0));
                    setServiceCharge(Number(res.order.service_charge || 0));
                  } catch {
                    // Handled by fireKotMutation onError
                  }
                }
              }}
              className="border-[#B4D58A] text-[#B4D58A] hover:bg-[#B4D58A]/25 text-xs font-semibold h-10 flex items-center justify-center gap-1.5"
            >
              <Receipt className="h-3.5 w-3.5" />
              Settle Bill
            </Button>
          </div>
        </div>
      </div>

      {/* MODAL 1: Item Customization (Variants & Addons) */}
      {customizingItem && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-black/[0.06] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-black/[0.06] flex items-center justify-between bg-[#FAF9F6]">
              <div>
                <h3 className="font-bold text-base text-[#252525]">{customizingItem.name}</h3>
                <span className="text-xs text-[#5A5D58]">Configure portion and add-on options</span>
              </div>
              <button
                onClick={() => setCustomizingItem(null)}
                className="text-[#5A5D58] hover:text-[#252525]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Variants */}
              {customizingItem.variants?.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-[#252525] block mb-2 uppercase tracking-wide">
                    Select Portion / Size
                  </label>
                  <div className="space-y-2">
                    {customizingItem.variants.map((variant) => (
                      <label
                        key={variant.id}
                        onClick={() => setSelectedVariant(variant)}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          selectedVariant?.id === variant.id
                            ? 'bg-[#B4D58A]/20 border-[#B4D58A] text-[#252525] font-semibold'
                            : 'bg-white border-black/[0.06] hover:bg-[#FAF9F6]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="variant"
                            checked={selectedVariant?.id === variant.id}
                            onChange={() => setSelectedVariant(variant)}
                            className="text-[#B4D58A] focus:ring-[#B4D58A]"
                          />
                          <span className="text-xs">{variant.name}</span>
                        </div>
                        <span className="text-xs font-bold text-[#B4D58A]">
                          ₹{Number(variant.price).toFixed(2)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Addons */}
              {customizingItem.addons?.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-[#252525] block mb-2 uppercase tracking-wide">
                    Optional Add-ons
                  </label>
                  <div className="space-y-2">
                    {customizingItem.addons.map((addon) => {
                      const isSelected = selectedAddons.some((a) => a.id === addon.id);
                      return (
                        <label
                          key={addon.id}
                          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-[#B4D58A]/25 border-[#B4D58A] text-[#252525] font-semibold'
                              : 'bg-white border-black/[0.06] hover:bg-[#FAF9F6]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAddons([...selectedAddons, addon]);
                                } else {
                                  setSelectedAddons(selectedAddons.filter((a) => a.id !== addon.id));
                                }
                              }}
                              className="rounded text-[#B4D58A] focus:ring-[#B4D58A]"
                            />
                            <span className="text-xs">{addon.name}</span>
                          </div>
                          <span className="text-xs font-semibold text-[#B4D58A]">
                            +₹{Number(addon.price).toFixed(2)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Cooking Instructions */}
              <div>
                <label className="text-xs font-bold text-[#252525] block mb-1.5 uppercase tracking-wide">
                  Kitchen Notes / Instructions
                </label>
                <Input
                  placeholder="e.g. Less spicy, crisp fried, no onion"
                  value={itemNote}
                  onChange={(e) => setItemNote(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="p-4 border-t border-black/[0.06] bg-[#FAF9F6] flex items-center justify-between">
              <span className="text-xs font-bold text-[#252525]">
                Item Price: ₹
                {(
                  (selectedVariant ? Number(selectedVariant.price) : Number(customizingItem.base_price)) +
                  selectedAddons.reduce((s, a) => s + Number(a.price), 0)
                ).toFixed(2)}
              </span>
              <Button
                onClick={() =>
                  addToCartDirect(customizingItem, selectedVariant, selectedAddons, itemNote)
                }
                className="bg-[#B4D58A] hover:bg-[#9EC271] text-white text-xs font-semibold px-4 h-9"
              >
                Add to Cart
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Kitchen Order Ticket (KOT) Generated */}
      {kotData && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="print-area bg-white rounded-2xl max-w-sm w-full border border-black/[0.06] shadow-2xl p-5 space-y-4">
            <div className="text-center pb-3 border-b border-dashed border-black/[0.06]">
              <div className="h-10 w-10 bg-[#B4D58A]/10 text-[#B4D58A] rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-base text-[#252525]">KOT Dispatched to Kitchen</h3>
              <p className="text-xs font-mono font-bold text-[#B4D58A] mt-0.5">
                {kotData.kot_number}
              </p>
              <p className="text-[11px] text-[#5A5D58]">
                Order {kotData.order?.order_number} · Round {kotData.round_number}
              </p>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto text-xs">
              {kotData.new_items?.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-start py-1 border-b border-black/[0.04]">
                  <div>
                    <span className="font-semibold text-[#252525]">
                      {item.quantity}x {item.item_name}
                    </span>
                    {item.variant_name && (
                      <span className="text-[10px] text-[#5A5D58] block">
                        Portion: {item.variant_name}
                      </span>
                    )}
                    {item.special_instructions && (
                      <span className="text-[10px] text-[#B4D58A] italic block">
                        Note: {item.special_instructions}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] bg-[#F3DA8A]/25 px-1.5 py-0.5 rounded uppercase font-mono">
                    {item.kitchen_station}
                  </span>
                </div>
              ))}
            </div>

            <div className="no-print flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => window.print()}
                className="flex-1 text-xs h-9 flex items-center justify-center gap-1.5"
              >
                <Printer className="h-3.5 w-3.5" /> Print Ticket
              </Button>
              <Button
                onClick={() => setKotData(null)}
                className="flex-1 bg-[#B4D58A] hover:bg-[#9EC271] text-white text-xs h-9"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Bill Settlement & Payment Collection */}
      {settlementOrder && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-black/[0.06] shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <div>
                <h3 className="font-bold text-base text-[#252525]">Settle Table Bill</h3>
                <p className="text-xs text-[#5A5D58]">
                  {settlementOrder.order_number} ·{' '}
                  {settlementOrder.table ? `Table ${settlementOrder.table.table_number}` : 'Counter'}
                </p>
              </div>
              <button
                onClick={() => setSettlementOrder(null)}
                className="text-[#5A5D58] hover:text-[#252525]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Total Due Banner */}
            <div className="bg-[#FAF9F6] p-3 rounded-xl border border-black/[0.06] flex items-center justify-between">
              <span className="text-xs font-semibold text-[#5A5D58]">Total Amount Due</span>
              <span className="text-xl font-bold text-[#B4D58A]">
                ₹{Number(settlementOrder.total_amount).toFixed(2)}
              </span>
            </div>

            {/* Payment Mode Tabs */}
            <div>
              <label className="text-xs font-bold text-[#252525] block mb-2 uppercase tracking-wide">
                Payment Mode
              </label>
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMode('cash')}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    paymentMode === 'cash'
                      ? 'bg-[#B4D58A]/20 border-[#B4D58A] text-[#B4D58A] font-bold shadow-xs'
                      : 'bg-white border-black/[0.06] text-[#5A5D58]'
                  }`}
                >
                  <Banknote className="h-4 w-4 mx-auto mb-1" />
                  <span className="text-xs">Cash</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode('upi')}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    paymentMode === 'upi'
                      ? 'bg-[#B4D58A]/20 border-[#B4D58A] text-[#B4D58A] font-bold shadow-xs'
                      : 'bg-white border-black/[0.06] text-[#5A5D58]'
                  }`}
                >
                  <Smartphone className="h-4 w-4 mx-auto mb-1" />
                  <span className="text-xs">UPI</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode('card')}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    paymentMode === 'card'
                      ? 'bg-[#B4D58A]/20 border-[#B4D58A] text-[#B4D58A] font-bold shadow-xs'
                      : 'bg-white border-black/[0.06] text-[#5A5D58]'
                  }`}
                >
                  <CreditCard className="h-4 w-4 mx-auto mb-1" />
                  <span className="text-xs">Card</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode('split')}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    paymentMode === 'split'
                      ? 'bg-[#B4D58A]/20 border-[#B4D58A] text-[#B4D58A] font-bold shadow-xs'
                      : 'bg-white border-black/[0.06] text-[#5A5D58]'
                  }`}
                >
                  <Layers className="h-4 w-4 mx-auto mb-1" />
                  <span className="text-xs">Split</span>
                </button>
              </div>
            </div>

            {/* Cash Tender Calculation */}
            {paymentMode === 'cash' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold text-[#252525]">
                  <span>Cash Received</span>
                  <span>Change: ₹{Math.max(0, tenderAmount - Number(settlementOrder.total_amount)).toFixed(2)}</span>
                </div>
                <Input
                  type="number"
                  value={tenderAmount || ''}
                  onChange={(e) => setTenderAmount(Number(e.target.value))}
                  placeholder="Enter Cash Tender Amount"
                  className="text-base font-bold text-[#252525]"
                />
                <div className="flex gap-1.5 flex-wrap">
                  {Array.from(
                    new Set([Number(settlementOrder.total_amount), 500, 1000, 2000])
                  ).map((val) => (
                    <button
                      key={`tender-${val}`}
                      type="button"
                      onClick={() => setTenderAmount(val)}
                      className="px-2.5 py-1 text-xs bg-[#F3DA8A]/25 rounded hover:bg-black/[0.06] font-semibold text-[#252525]"
                    >
                      {currencySymbol}{val}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Split Payment Entries */}
            {paymentMode === 'split' && (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-[#5A5D58]">Cash</label>
                    <Input
                      type="number"
                      min={0}
                      value={splitPayments[0].amount || ''}
                      onChange={(e) =>
                        setSplitPayments([
                          { payment_method: 'cash', amount: Math.max(0, Number(e.target.value)) },
                          splitPayments[1],
                          splitPayments[2],
                        ])
                      }
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#5A5D58]">UPI</label>
                    <Input
                      type="number"
                      min={0}
                      value={splitPayments[1].amount || ''}
                      onChange={(e) =>
                        setSplitPayments([
                          splitPayments[0],
                          { payment_method: 'upi', amount: Math.max(0, Number(e.target.value)) },
                          splitPayments[2],
                        ])
                      }
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#5A5D58]">Card</label>
                    <Input
                      type="number"
                      min={0}
                      value={splitPayments[2].amount || ''}
                      onChange={(e) =>
                        setSplitPayments([
                          splitPayments[0],
                          splitPayments[1],
                          { payment_method: 'card', amount: Math.max(0, Number(e.target.value)) },
                        ])
                      }
                      className="text-xs"
                    />
                  </div>
                </div>
                <div className="text-[11px] text-[#5A5D58] flex justify-between">
                  <span>Total Split Entered:</span>
                  <span className="font-bold text-[#252525]">
                    {currencySymbol}{(splitPayments[0].amount + splitPayments[1].amount + splitPayments[2].amount).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <Button
              disabled={settleBillMutation.isPending}
              onClick={() => settleBillMutation.mutate()}
              className="w-full bg-[#B4D58A] hover:bg-[#2e6b4a] text-white text-xs font-semibold h-10 shadow-xs"
            >
              {settleBillMutation.isPending ? 'Processing Settlement...' : 'Complete Payment & Close Table'}
            </Button>
          </div>
        </div>
      )}

      {/* MODAL 4: Final Tax Invoice Receipt */}
      {invoiceData && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="print-area bg-white rounded-2xl max-w-sm w-full border border-black/[0.06] shadow-2xl p-6 space-y-4">
            <div className="text-center pb-3 border-b border-dashed border-black/[0.06]">
              <h3 className="font-bold text-lg text-[#252525] uppercase">
                {activeRestaurant?.name || 'Restaurant OS'}
              </h3>
              <p className="text-[11px] text-[#5A5D58]">
                {activeBranch?.name || 'Main Branch'}
              </p>
              <div className="mt-2 py-1 bg-[#FAF9F6] rounded border border-black/[0.06] font-mono text-xs font-bold text-[#B4D58A]">
                INVOICE: {invoiceData.invoice_number}
              </div>
            </div>

            <div className="text-xs space-y-1.5 py-1">
              <div className="flex justify-between text-[#5A5D58]">
                <span>Date & Time</span>
                <span className="text-[#252525]">{new Date().toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[#5A5D58]">
                <span>Billed To</span>
                <span className="text-[#252525]">
                  {invoiceData.order?.table
                    ? `Table ${invoiceData.order.table.table_number}`
                    : invoiceData.order?.customer_name || 'Counter Customer'}
                </span>
              </div>
              <div className="flex justify-between text-[#5A5D58]">
                <span>Settled By</span>
                <span className="text-[#252525]">{user?.name}</span>
              </div>
            </div>

            {invoiceData.order?.items?.length > 0 && (
              <div className="border-t border-dashed border-black/[0.06] pt-2 space-y-1 text-xs max-h-40 overflow-y-auto">
                {invoiceData.order.items
                  .filter((i: any) => i.status !== 'cancelled')
                  .map((item: any) => (
                    <div key={item.id} className="flex justify-between text-[#252525]">
                      <span className="truncate pr-2">
                        {item.quantity}x {item.item_name}
                        {item.variant_name ? ` (${item.variant_name})` : ''}
                      </span>
                      <span className="font-medium shrink-0">
                        {currencySymbol}{Number(item.subtotal || 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            <div className="border-t border-b border-dashed border-black/[0.06] py-2 space-y-1 text-xs">
              <div className="flex justify-between text-[#5A5D58]">
                <span>Subtotal</span>
                <span>{currencySymbol}{Number(invoiceData.order?.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#5A5D58]">
                <span>GST</span>
                <span>{currencySymbol}{Number(invoiceData.order?.tax_amount || 0).toFixed(2)}</span>
              </div>
              {Number(invoiceData.order?.service_charge || 0) > 0 && (
                <div className="flex justify-between text-[#5A5D58]">
                  <span>Service Charge</span>
                  <span>{currencySymbol}{Number(invoiceData.order.service_charge).toFixed(2)}</span>
                </div>
              )}
              {Number(invoiceData.order?.packaging_charge || 0) > 0 && (
                <div className="flex justify-between text-[#5A5D58]">
                  <span>Packaging Charge</span>
                  <span>{currencySymbol}{Number(invoiceData.order.packaging_charge).toFixed(2)}</span>
                </div>
              )}
              {Number(invoiceData.order?.discount_amount || 0) > 0 && (
                <div className="flex justify-between text-[#B4D58A]">
                  <span>Discount</span>
                  <span>-{currencySymbol}{Number(invoiceData.order.discount_amount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm text-[#252525] pt-1">
                <span>Total Paid</span>
                <span className="text-[#B4D58A]">
                  {currencySymbol}{Number(invoiceData.order?.paid_amount || invoiceData.order?.total_amount).toFixed(2)}
                </span>
              </div>
              {invoiceData.change_amount > 0 && (
                <div className="flex justify-between text-xs text-[#5A5D58]">
                  <span>Change Returned</span>
                  <span>{currencySymbol}{Number(invoiceData.change_amount).toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="no-print flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => window.print()}
                className="flex-1 text-xs h-9 flex items-center justify-center gap-1.5"
              >
                <Printer className="h-3.5 w-3.5" /> Print Invoice
              </Button>
              <Button
                onClick={() => setInvoiceData(null)}
                className="flex-1 bg-[#B4D58A] hover:bg-[#9EC271] text-white text-xs h-9"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
    </TenantGuard>
  );
}
