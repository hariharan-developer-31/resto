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
  Boxes,
  AlertTriangle,
  Truck,
  FileText,
  Plus,
  Search,
  RefreshCw,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  X,
  PackageCheck,
  CheckCircle2,
  DollarSign,
  ClipboardList,
  History,
  Phone,
  Mail,
  Building2,
  SlidersHorizontal,
} from 'lucide-react';

interface Supplier {
  id: number;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_number: string | null;
  payment_terms: string;
  status: string;
  inventory_items_count?: number;
  purchase_orders_count?: number;
}

interface InventoryItem {
  id: number;
  restaurant_id: number;
  branch_id: number;
  supplier_id: number | null;
  name: string;
  sku: string | null;
  category: string;
  unit: string;
  current_stock: string | number;
  minimum_stock: string | number;
  unit_cost: string | number;
  storage_location: string | null;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  supplier: { id: number; name: string; phone?: string; email?: string } | null;
  branch?: { id: number; name: string } | null;
}

interface PurchaseOrderItem {
  id: number;
  inventory_item_id: number;
  quantity_ordered: string | number;
  quantity_received: string | number;
  unit_cost: string | number;
  total_price: string | number;
  inventory_item?: InventoryItem;
}

interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_id: number;
  order_date: string;
  expected_delivery_date: string | null;
  status: 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled';
  subtotal: string | number;
  tax_amount: string | number;
  total_amount: string | number;
  notes: string | null;
  supplier?: Supplier;
  items?: PurchaseOrderItem[];
}

export default function InventoryManagementPage() {
  const queryClient = useQueryClient();
  const activeRestaurant = useAuthStore((s) => s.activeRestaurant);
  const activeBranch = useAuthStore((s) => s.activeBranch);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'stock' | 'alerts' | 'suppliers' | 'orders' | 'recipes'>('stock');

  // Filters & Pagination
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [invPage, setInvPage] = useState<number>(1);

  // Modals state
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [isAdjustStockModalOpen, setIsAdjustStockModalOpen] = useState(false);
  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);
  const [isCreatePoModalOpen, setIsCreatePoModalOpen] = useState(false);
  const [isReceivePoModalOpen, setIsReceivePoModalOpen] = useState(false);
  const [selectedItemForAdjust, setSelectedItemForAdjust] = useState<InventoryItem | null>(null);
  const [selectedPoForReceive, setSelectedPoForReceive] = useState<PurchaseOrder | null>(null);
  const [historyItemId, setHistoryItemId] = useState<number | null>(null);

  // Recipe BOM state
  const [selectedRecipeMenuId, setSelectedRecipeMenuId] = useState<number | null>(null);
  const [recipeRows, setRecipeRows] = useState<{ inventory_item_id: number; quantity_required: number; unit: string }[]>([]);

  // Form states: New Inventory Item
  const [itemName, setItemName] = useState('');
  const [itemSku, setItemSku] = useState('');
  const [itemCategory, setItemCategory] = useState('produce');
  const [itemUnit, setItemUnit] = useState('kg');
  const [itemStock, setItemStock] = useState('10');
  const [itemMinStock, setItemMinStock] = useState('5');
  const [itemCost, setItemCost] = useState('150');
  const [itemLocation, setItemLocation] = useState('Dry Pantry');
  const [itemSupplierId, setItemSupplierId] = useState('');

  // Form states: Stock Adjustment
  const [adjustType, setAdjustType] = useState('wastage');
  const [adjustQty, setAdjustQty] = useState('-1');
  const [adjustReason, setAdjustReason] = useState('Kitchen wastage / prep discard');
  const [adjustNotes, setAdjustNotes] = useState('');

  // Form states: New Supplier
  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supTax, setSupTax] = useState('');
  const [supTerms, setSupTerms] = useState('net_30');

  // Form states: Create Purchase Order
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poExpectedDate, setPoExpectedDate] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [poItems, setPoItems] = useState<{ inventory_item_id: number; quantity_ordered: number; unit_cost: number }[]>([]);

  // Form states: Receive PO Shipment
  const [receivedQuantities, setReceivedQuantities] = useState<{ [itemId: number]: number }>({});

  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    setPoExpectedDate(tomorrow.toISOString().split('T')[0]);
  }, []);

  // Fetch Inventory Items
  const { data: inventoryData, isLoading: isInvLoading, refetch: refetchInv, isFetching: isInvFetching } = useQuery({
    queryKey: ['inventory', activeRestaurant?.id, activeBranch?.id, categoryFilter, statusFilter, searchQuery, invPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);
      params.append('page', String(invPage));

      const res = await apiRequest(`inventory?${params.toString()}`, {
        restaurantId: activeRestaurant?.id,
        branchId: activeBranch?.id,
      });
      return res.data;
    },
    enabled: !!activeRestaurant?.id,
  });

  // Unfiltered Inventory Catalog for PO Builder & Recipe BOM dropdowns
  const { data: allInventoryData } = useQuery({
    queryKey: ['inventory-catalog-all', activeRestaurant?.id, activeBranch?.id],
    queryFn: async () => {
      const res = await apiRequest('inventory?per_page=100', {
        restaurantId: activeRestaurant?.id,
        branchId: activeBranch?.id,
      });
      return res.data?.data || [];
    },
    enabled: !!activeRestaurant?.id,
  });

  // Fetch Low Stock Alerts
  const { data: alertsData, refetch: refetchAlerts } = useQuery({
    queryKey: ['inventory-alerts', activeRestaurant?.id, activeBranch?.id],
    queryFn: async () => {
      const res = await apiRequest('inventory/alerts', {
        restaurantId: activeRestaurant?.id,
        branchId: activeBranch?.id,
      });
      return res.data;
    },
    enabled: !!activeRestaurant?.id,
  });

  // Fetch Stock Movement History when modal open
  const { data: historyItemDetail, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['inventory-history', historyItemId],
    queryFn: async () => {
      const res = await apiRequest(`inventory/${historyItemId}`, {
        restaurantId: activeRestaurant?.id,
        branchId: activeBranch?.id,
      });
      return res.data;
    },
    enabled: !!historyItemId,
  });

  // Fetch Menu Items for Recipe BOM Tab
  const { data: recipeMenuItems = [] } = useQuery({
    queryKey: ['menu-items-for-bom', activeRestaurant?.id],
    queryFn: async () => {
      const res = await apiRequest('menu-items?per_page=100', {
        restaurantId: activeRestaurant?.id,
      });
      return res.data?.data || res.data || [];
    },
    enabled: !!activeRestaurant?.id && activeTab === 'recipes',
  });

  // Fetch Recipe BOM for selected dish
  const { data: activeRecipeData, isLoading: isRecipeLoading } = useQuery({
    queryKey: ['dish-recipe', selectedRecipeMenuId],
    queryFn: async () => {
      const res = await apiRequest(`menu-items/${selectedRecipeMenuId}/recipe`, {
        restaurantId: activeRestaurant?.id,
      });
      return res.data;
    },
    enabled: !!selectedRecipeMenuId && activeTab === 'recipes',
  });

  useEffect(() => {
    if (activeRecipeData?.recipe_ingredients) {
      setRecipeRows(
        activeRecipeData.recipe_ingredients.map((r: any) => ({
          inventory_item_id: r.inventory_item_id,
          quantity_required: Number(r.quantity_required),
          unit: r.unit || 'kg',
        }))
      );
    }
  }, [activeRecipeData]);

  const saveRecipeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRecipeMenuId) throw new Error('Select a dish first.');
      return await apiRequest(`menu-items/${selectedRecipeMenuId}/recipe`, {
        method: 'POST',
        restaurantId: activeRestaurant?.id,
        body: JSON.stringify({ ingredients: recipeRows }),
      });
    },
    onSuccess: () => {
      toast.success('Recipe BOM saved! Orders for this dish will auto-deduct ingredients.');
      queryClient.invalidateQueries({ queryKey: ['dish-recipe', selectedRecipeMenuId] });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to save recipe BOM.');
    },
  });

  // Fetch Suppliers
  const { data: suppliersData, refetch: refetchSuppliers } = useQuery({
    queryKey: ['suppliers', activeRestaurant?.id],
    queryFn: async () => {
      const res = await apiRequest('suppliers', {
        restaurantId: activeRestaurant?.id,
      });
      return res.data;
    },
    enabled: !!activeRestaurant?.id,
  });

  // Fetch Purchase Orders
  const { data: purchaseOrdersData, refetch: refetchPo } = useQuery({
    queryKey: ['purchase-orders', activeRestaurant?.id, activeBranch?.id],
    queryFn: async () => {
      const res = await apiRequest('purchase-orders', {
        restaurantId: activeRestaurant?.id,
        branchId: activeBranch?.id,
      });
      return res.data;
    },
    enabled: !!activeRestaurant?.id,
  });

  const inventoryItems: InventoryItem[] = inventoryData?.data || [];
  const invLastPage: number = inventoryData?.last_page || 1;
  const catalogItems: InventoryItem[] = allInventoryData || inventoryItems;
  const lowStockAlerts: InventoryItem[] = alertsData || [];
  const suppliers: Supplier[] = suppliersData || [];
  const purchaseOrders: PurchaseOrder[] = purchaseOrdersData?.data || [];

  // Summary Metrics
  const totalItemCount = inventoryData?.total ?? inventoryItems.length;
  const lowStockCount = lowStockAlerts.length;
  const totalInventoryValue = inventoryItems.reduce(
    (sum, item) => sum + Number(item.current_stock) * Number(item.unit_cost),
    0
  );

  // Mutations
  const addItemMutation = useMutation({
    mutationFn: async (payload: any) => {
      return await apiRequest('inventory', {
        method: 'POST',
        restaurantId: activeRestaurant?.id,
        branchId: activeBranch?.id,
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast.success('Inventory item created');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
      setIsAddItemModalOpen(false);
      setItemName('');
      setItemSku('');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create item'),
  });

  const adjustStockMutation = useMutation({
    mutationFn: async (payload: any) => {
      return await apiRequest('inventory/adjust', {
        method: 'POST',
        restaurantId: activeRestaurant?.id,
        branchId: activeBranch?.id,
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast.success('Stock adjusted & movement recorded');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
      setIsAdjustStockModalOpen(false);
      setSelectedItemForAdjust(null);
    },
    onError: (err: any) => toast.error(err.message || 'Failed to adjust stock'),
  });

  const addSupplierMutation = useMutation({
    mutationFn: async (payload: any) => {
      return await apiRequest('suppliers', {
        method: 'POST',
        restaurantId: activeRestaurant?.id,
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast.success('Supplier registered');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setIsAddSupplierModalOpen(false);
      setSupName('');
      setSupContact('');
      setSupPhone('');
      setSupEmail('');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to register supplier'),
  });

  const createPoMutation = useMutation({
    mutationFn: async (payload: any) => {
      return await apiRequest('purchase-orders', {
        method: 'POST',
        restaurantId: activeRestaurant?.id,
        branchId: activeBranch?.id,
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast.success('Purchase order created');
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      setIsCreatePoModalOpen(false);
      setPoItems([]);
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create PO'),
  });

  const receivePoMutation = useMutation({
    mutationFn: async ({ poId, items }: { poId: number; items: any[] }) => {
      return await apiRequest(`purchase-orders/${poId}/receive`, {
        method: 'POST',
        restaurantId: activeRestaurant?.id,
        branchId: activeBranch?.id,
        body: JSON.stringify({ items }),
      });
    },
    onSuccess: () => {
      toast.success('Shipment received and stock levels updated!');
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
      setIsReceivePoModalOpen(false);
      setSelectedPoForReceive(null);
    },
    onError: (err: any) => toast.error(err.message || 'Failed to receive PO'),
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_stock':
        return <Badge className="bg-[#B4D58A]/25 text-[#B4D58A] border-[#D6DFC9]">In Stock</Badge>;
      case 'low_stock':
        return <Badge className="bg-[#FEF7EC] text-[#F3DA8A] border-[#FCE3BE]">Low Stock</Badge>;
      case 'out_of_stock':
        return <Badge className="bg-[#FDF2F2] text-[#F2AFC0] border-[#F8D7DA]">Depleted</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#252525]">Inventory & Supply Chain</h1>
          </div>
          <p className="text-sm text-[#5A5D58] mt-1">
            Raw materials catalog, low stock replenishment alerts, supplier contacts, purchase orders, and recipe BOMs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchInv();
              refetchAlerts();
              refetchSuppliers();
              refetchPo();
            }}
            disabled={isInvFetching}
            className="border-black/[0.06] hover:bg-[#F3DA8A]/25 text-[#252525]"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isInvFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {activeTab === 'stock' && (
            <Button
              onClick={() => {
                if (!activeBranch?.id) {
                  toast.error('Please select an active branch first.');
                  return;
                }
                setIsAddItemModalOpen(true);
              }}
              className="bg-[#B4D58A] hover:bg-[#9EC271] text-white shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Material
            </Button>
          )}

          {activeTab === 'suppliers' && (
            <Button
              onClick={() => setIsAddSupplierModalOpen(true)}
              className="bg-[#B4D58A] hover:bg-[#9EC271] text-white shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" /> New Supplier
            </Button>
          )}

          {activeTab === 'orders' && (
            <Button
              onClick={() => {
                if (!activeBranch?.id) {
                  toast.error('Please select an active branch first.');
                  return;
                }
                if (catalogItems.length > 0) {
                  setPoItems([
                    {
                      inventory_item_id: catalogItems[0].id,
                      quantity_ordered: 10,
                      unit_cost: Number(catalogItems[0].unit_cost),
                    },
                  ]);
                }
                setIsCreatePoModalOpen(true);
              }}
              className="bg-[#B4D58A] hover:bg-[#9EC271] text-white shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" /> Create PO
            </Button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-black/[0.06] bg-white shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#5A5D58]">Tracked Ingredients</p>
              <h3 className="text-2xl font-bold text-[#252525] mt-1">{totalItemCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#FAF9F6] flex items-center justify-center text-[#B4D58A]">
              <Boxes className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-black/[0.06] bg-white shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#5A5D58]">Low Stock Alerts</p>
              <h3 className={`text-2xl font-bold mt-1 ${lowStockCount > 0 ? 'text-[#F2AFC0]' : 'text-[#B4D58A]'}`}>
                {lowStockCount}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#FEF7EC] flex items-center justify-center text-[#F3DA8A]">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-black/[0.06] bg-white shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#5A5D58]">Active Suppliers</p>
              <h3 className="text-2xl font-bold text-[#B4D58A] mt-1">{suppliers.length}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#B4D58A]/20 flex items-center justify-center text-[#B4D58A]">
              <Truck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-black/[0.06] bg-white shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#5A5D58]">Total Stock Value</p>
              <h3 className="text-2xl font-bold text-[#252525] mt-1">₹{totalInventoryValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#B4D58A]/25 flex items-center justify-center text-[#B4D58A]">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-black/[0.06] flex items-center gap-6">
        <button
          onClick={() => setActiveTab('stock')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'stock'
              ? 'border-[#B4D58A] text-[#B4D58A]'
              : 'border-transparent text-[#5A5D58] hover:text-[#252525]'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Raw Materials Catalog</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#F3DA8A]/25 text-[#252525] font-medium">
            {totalItemCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('alerts')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'alerts'
              ? 'border-[#B4D58A] text-[#B4D58A]'
              : 'border-transparent text-[#5A5D58] hover:text-[#252525]'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-[#F3DA8A]" />
          <span>Low Stock Alerts</span>
          {lowStockCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#FDF2F2] text-[#F2AFC0] font-bold">
              {lowStockCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('suppliers')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'suppliers'
              ? 'border-[#B4D58A] text-[#B4D58A]'
              : 'border-transparent text-[#5A5D58] hover:text-[#252525]'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Suppliers Directory</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#F3DA8A]/25 text-[#252525] font-medium">
            {suppliers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'orders'
              ? 'border-[#B4D58A] text-[#B4D58A]'
              : 'border-transparent text-[#5A5D58] hover:text-[#252525]'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Purchase Orders</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#F3DA8A]/25 text-[#252525] font-medium">
            {purchaseOrders.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('recipes')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'recipes'
              ? 'border-[#B4D58A] text-[#B4D58A]'
              : 'border-transparent text-[#5A5D58] hover:text-[#252525]'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Recipe BOMs</span>
        </button>
      </div>

      {/* Tab 1: Stock Items Catalog */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <Card className="border-black/[0.06] bg-white shadow-xs">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  {['all', 'meat', 'seafood', 'poultry', 'dairy', 'produce', 'spices', 'dry_goods', 'beverages', 'packaging'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        setCategoryFilter(cat);
                        setInvPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        categoryFilter === cat
                          ? 'bg-[#B4D58A] text-white'
                          : 'bg-[#F3DA8A]/25 text-[#5A5D58] hover:bg-black/[0.06] hover:text-[#252525]'
                      }`}
                    >
                      {cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')}
                    </button>
                  ))}
                </div>

                <div className="relative w-full md:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#8E928B]" />
                  <Input
                    placeholder="Search ingredient or SKU..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setInvPage(1);
                    }}
                    className="pl-9 text-xs h-9 border-black/[0.06] bg-[#FAF9F6]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-black/[0.04]">
                <span className="text-[11px] font-semibold text-[#5A5D58] mr-1">Stock Status:</span>
                {[
                  { id: 'all', label: 'All' },
                  { id: 'in_stock', label: 'In Stock' },
                  { id: 'low_stock', label: 'Low Stock' },
                  { id: 'out_of_stock', label: 'Out of Stock' },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => {
                      setStatusFilter(st.id);
                      setInvPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                      statusFilter === st.id
                        ? 'bg-[#252525] text-white'
                        : 'bg-[#FAF9F6] text-[#5A5D58] hover:bg-black/[0.06]'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card className="border-black/[0.06] bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[#252525]">
                <thead className="bg-[#FAF9F6] text-xs font-semibold text-[#5A5D58] uppercase tracking-wider border-b border-black/[0.06]">
                  <tr>
                    <th className="px-6 py-3.5">Ingredient & SKU</th>
                    <th className="px-6 py-3.5">Category</th>
                    <th className="px-6 py-3.5">Current Stock</th>
                    <th className="px-6 py-3.5">Min Safety Level</th>
                    <th className="px-6 py-3.5">Unit Cost</th>
                    <th className="px-6 py-3.5">Supplier & Storage</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.06]">
                  {isInvLoading ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-[#5A5D58]">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#B4D58A] mb-2" />
                        Loading inventory catalog...
                      </td>
                    </tr>
                  ) : inventoryItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-[#5A5D58]">
                        <Boxes className="w-8 h-8 mx-auto text-[#8E928B] mb-2" />
                        No raw materials found matching filters.
                      </td>
                    </tr>
                  ) : (
                    inventoryItems.map((item) => {
                      const stockNum = Number(item.current_stock);
                      const minStockNum = Number(item.minimum_stock);

                      return (
                        <tr key={item.id} className="hover:bg-[#FAF9F6]/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-[#252525]">{item.name}</div>
                            <div className="text-xs text-[#8E928B] font-mono mt-0.5">{item.sku || 'NO-SKU'}</div>
                          </td>

                          <td className="px-6 py-4">
                            <span className="capitalize text-xs font-medium text-[#5A5D58] px-2 py-0.5 bg-[#F3DA8A]/25 rounded">
                              {item.category.replace('_', ' ')}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <div className="font-bold text-sm text-[#252525]">
                              {stockNum.toFixed(2)} <span className="text-xs font-normal text-[#5A5D58]">{item.unit}</span>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="text-xs text-[#5A5D58]">
                              {minStockNum.toFixed(2)} {item.unit}
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="text-xs font-medium text-[#252525]">
                              ₹{Number(item.unit_cost).toFixed(2)} <span className="text-[10px] text-[#8E928B]">/ {item.unit}</span>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="text-xs text-[#252525] font-medium">{item.supplier?.name || 'Local Market'}</div>
                            <div className="text-[11px] text-[#8E928B]">{item.storage_location || 'General Store'}</div>
                          </td>

                          <td className="px-6 py-4">{getStatusBadge(item.status)}</td>

                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setHistoryItemId(item.id)}
                                className="h-8 text-xs text-[#5A5D58] hover:text-[#252525]"
                              >
                                <History className="w-3.5 h-3.5 mr-1" /> Ledger
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedItemForAdjust(item);
                                  setIsAdjustStockModalOpen(true);
                                }}
                                className="h-8 text-xs border-black/[0.06] hover:bg-[#F3DA8A]/25 text-[#252525]"
                              >
                                <SlidersHorizontal className="w-3 h-3 mr-1" /> Adjust Stock
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {invLastPage > 1 && (
              <div className="px-6 py-3 border-t border-black/[0.06] flex items-center justify-between text-xs text-[#5A5D58]">
                <span>Page {invPage} of {invLastPage}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={invPage <= 1} onClick={() => setInvPage((p) => p - 1)} className="h-7 text-xs">
                    Previous
                  </Button>
                  <Button size="sm" variant="outline" disabled={invPage >= invLastPage} onClick={() => setInvPage((p) => p + 1)} className="h-7 text-xs">
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab 2: Low Stock Alerts */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          <Card className="border-black/[0.06] bg-white shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-[#F2AFC0]">
                <AlertTriangle className="w-5 h-5" />
                Critical Replenishment Alerts
              </CardTitle>
              <CardDescription className="text-xs text-[#5A5D58]">
                The following raw materials have dipped below their safety threshold and require replenishment.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lowStockAlerts.length === 0 ? (
                <div className="text-center py-12 text-[#B4D58A]">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
                  <p className="font-semibold text-sm">All inventory levels are currently above safety thresholds!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {lowStockAlerts.map((item) => {
                    const current = Number(item.current_stock);
                    const min = Number(item.minimum_stock);
                    const deficit = min - current;

                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-xl border border-[#F8D7DA] bg-[#FDF2F2]/40 flex flex-col justify-between space-y-3"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-[#252525] text-sm">{item.name}</h4>
                            {getStatusBadge(item.status)}
                          </div>
                          <p className="text-xs text-[#5A5D58] mt-1 font-mono">SKU: {item.sku || 'N/A'}</p>

                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-white p-2 rounded-lg border border-black/[0.06]">
                              <p className="text-[#8E928B]">Current Stock</p>
                              <p className="font-bold text-sm text-[#F2AFC0]">{current.toFixed(2)} {item.unit}</p>
                            </div>
                            <div className="bg-white p-2 rounded-lg border border-black/[0.06]">
                              <p className="text-[#8E928B]">Minimum Reorder</p>
                              <p className="font-bold text-sm text-[#252525]">{min.toFixed(2)} {item.unit}</p>
                            </div>
                          </div>

                          <div className="mt-2 text-xs text-[#5A5D58]">
                            Supplier: <span className="font-semibold text-[#252525]">{item.supplier?.name || 'Local Wholesale'}</span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-[#F8D7DA] flex items-center justify-between">
                          <span className="text-xs text-[#F2AFC0] font-semibold">
                            Deficit: +{Math.max(0, deficit).toFixed(2)} {item.unit}
                          </span>

                          <Button
                            size="sm"
                            onClick={() => {
                              setPoItems([
                                {
                                  inventory_item_id: item.id,
                                  quantity_ordered: Math.ceil(min * 2),
                                  unit_cost: Number(item.unit_cost),
                                },
                              ]);
                              if (item.supplier_id) {
                                setPoSupplierId(String(item.supplier_id));
                              }
                              setIsCreatePoModalOpen(true);
                            }}
                            className="h-7 text-xs bg-[#B4D58A] hover:bg-[#9EC271] text-white"
                          >
                            Order Now
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 3: Suppliers Directory */}
      {activeTab === 'suppliers' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map((sup) => (
              <Card key={sup.id} className="border-black/[0.06] bg-white shadow-xs hover:border-[#B4D58A] transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-[#252525] font-bold">{sup.name}</CardTitle>
                    <Badge className="bg-[#B4D58A]/25 text-[#B4D58A] border-none text-[10px] capitalize">{sup.status}</Badge>
                  </div>
                  <CardDescription className="text-xs text-[#5A5D58]">
                    Contact: {sup.contact_person || 'Representative'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-[#252525]">
                  {sup.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-[#8E928B]" />
                      <span>{sup.phone}</span>
                    </div>
                  )}
                  {sup.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-[#8E928B]" />
                      <span>{sup.email}</span>
                    </div>
                  )}
                  {sup.address && (
                    <div className="flex items-center gap-2 text-[#5A5D58]">
                      <Building2 className="w-3.5 h-3.5 text-[#8E928B]" />
                      <span className="truncate">{sup.address}</span>
                    </div>
                  )}

                  <div className="pt-3 border-t border-black/[0.06] flex items-center justify-between text-xs text-[#5A5D58]">
                    <span>Terms: <strong className="text-[#252525] uppercase">{sup.payment_terms.replace('_', ' ')}</strong></span>
                    <span>GST: {sup.tax_number || 'N/A'}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Purchase Orders */}
      {activeTab === 'orders' && (
        <Card className="border-black/[0.06] bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#252525]">
              <thead className="bg-[#FAF9F6] text-xs font-semibold text-[#5A5D58] uppercase tracking-wider border-b border-black/[0.06]">
                <tr>
                  <th className="px-6 py-3.5">PO Number</th>
                  <th className="px-6 py-3.5">Supplier</th>
                  <th className="px-6 py-3.5">Order Date</th>
                  <th className="px-6 py-3.5">Expected Delivery</th>
                  <th className="px-6 py-3.5">Total Amount</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                {purchaseOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-[#5A5D58]">
                      <ClipboardList className="w-8 h-8 mx-auto text-[#8E928B] mb-2" />
                      No purchase orders recorded yet.
                    </td>
                  </tr>
                ) : (
                  purchaseOrders.map((po) => (
                    <tr key={po.id} className="hover:bg-[#FAF9F6]/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-xs text-[#252525]">{po.po_number}</td>
                      <td className="px-6 py-4 text-xs font-medium text-[#252525]">{po.supplier?.name}</td>
                      <td className="px-6 py-4 text-xs text-[#5A5D58]">{po.order_date}</td>
                      <td className="px-6 py-4 text-xs text-[#5A5D58]">{po.expected_delivery_date || '—'}</td>
                      <td className="px-6 py-4 text-xs font-bold text-[#252525]">₹{Number(po.total_amount).toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <Badge
                          className={`capitalize text-[10px] ${
                            po.status === 'received'
                              ? 'bg-[#B4D58A]/25 text-[#B4D58A] border-none'
                              : 'bg-[#FEF7EC] text-[#F3DA8A] border-none'
                          }`}
                        >
                          {po.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {po.status !== 'received' && po.status !== 'cancelled' && (
                          <Button
                            size="sm"
                            onClick={async () => {
                              let poWithItems = po;
                              if (!po.items || po.items.length === 0) {
                                try {
                                  const detail = await apiRequest(`purchase-orders/${po.id}`, {
                                    restaurantId: activeRestaurant?.id,
                                    branchId: activeBranch?.id,
                                  });
                                  if (detail?.data) poWithItems = detail.data;
                                } catch {
                                  // fallback
                                }
                              }
                              setSelectedPoForReceive(poWithItems);
                              const initialQtyMap: { [id: number]: number } = {};
                              poWithItems.items?.forEach((item) => {
                                const rem = Math.max(0, Number(item.quantity_ordered) - Number(item.quantity_received));
                                initialQtyMap[item.id] = Number(rem.toFixed(3));
                              });
                              setReceivedQuantities(initialQtyMap);
                              setIsReceivePoModalOpen(true);
                            }}
                            className="h-8 text-xs bg-[#B4D58A] hover:bg-[#2F6B4A] text-white"
                          >
                            <PackageCheck className="w-3.5 h-3.5 mr-1" /> Receive Shipment
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 5: Recipe Bill of Materials (BOM) */}
      {activeTab === 'recipes' && (
        <Card className="border-black/[0.06] bg-white shadow-xs">
          <CardHeader className="pb-3 border-b border-black/[0.06]">
            <CardTitle className="text-lg text-[#252525]">Recipe Bill of Materials (BOM)</CardTitle>
            <CardDescription className="text-xs text-[#5A5D58]">
              Map menu dishes to raw material quantities. Placing POS or QR orders automatically deducts these ingredients from branch stock.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-semibold text-[#252525]">Select Menu Dish</label>
                <select
                  value={selectedRecipeMenuId ?? ''}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    setSelectedRecipeMenuId(val);
                    setRecipeRows([]);
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-black/[0.08] bg-[#FAF9F6] text-xs font-medium text-[#252525]"
                >
                  <option value="">Choose a dish to edit its recipe...</option>
                  {recipeMenuItems.map((m: any) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (₹{Number(m.base_price).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>
              {selectedRecipeMenuId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (catalogItems.length === 0) {
                      toast.error('Add raw materials first before building a recipe.');
                      return;
                    }
                    setRecipeRows((prev) => [
                      ...prev,
                      {
                        inventory_item_id: catalogItems[0].id,
                        quantity_required: 0.1,
                        unit: catalogItems[0].unit || 'kg',
                      },
                    ]);
                  }}
                  className="h-10 text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Ingredient
                </Button>
              )}
            </div>

            {selectedRecipeMenuId && (
              isRecipeLoading ? (
                <p className="text-xs text-[#5A5D58] py-4">Loading recipe ingredients...</p>
              ) : (
                <div className="space-y-2">
                  {recipeRows.length === 0 ? (
                    <p className="text-xs text-[#5A5D58] py-6 text-center bg-[#FAF9F6] rounded-xl border border-dashed border-black/[0.08]">
                      No ingredients configured for this dish yet. Click &ldquo;Add Ingredient&rdquo; to map raw materials.
                    </p>
                  ) : (
                    recipeRows.map((row, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center p-2.5 rounded-xl bg-[#FAF9F6] border border-black/[0.06]">
                        <select
                          value={row.inventory_item_id}
                          onChange={(e) => {
                            const id = Number(e.target.value);
                            const found = catalogItems.find((c) => c.id === id);
                            setRecipeRows((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, inventory_item_id: id, unit: found?.unit || r.unit } : r
                              )
                            );
                          }}
                          className="col-span-6 h-8 px-2 rounded border border-black/[0.06] bg-white text-xs text-[#252525]"
                        >
                          {catalogItems.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.unit})
                            </option>
                          ))}
                        </select>
                        <Input
                          type="number"
                          step="0.001"
                          min="0.001"
                          value={row.quantity_required}
                          onChange={(e) =>
                            setRecipeRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, quantity_required: parseFloat(e.target.value) || 0 } : r))
                            )
                          }
                          className="col-span-3 h-8 text-xs bg-white"
                        />
                        <Input
                          value={row.unit}
                          onChange={(e) =>
                            setRecipeRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, unit: e.target.value } : r))
                            )
                          }
                          className="col-span-2 h-8 text-xs bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setRecipeRows((prev) => prev.filter((_, i) => i !== idx))}
                          className="col-span-1 text-red-500 hover:text-red-700 text-xs font-bold"
                        >
                          <X className="w-4 h-4 mx-auto" />
                        </button>
                      </div>
                    ))
                  )}

                  <div className="flex justify-end pt-3">
                    <Button
                      type="button"
                      disabled={saveRecipeMutation.isPending}
                      onClick={() => saveRecipeMutation.mutate()}
                      className="bg-[#B4D58A] hover:bg-[#9EC271] text-white text-xs h-9"
                    >
                      {saveRecipeMutation.isPending ? 'Saving...' : 'Save Recipe BOM'}
                    </Button>
                  </div>
                </div>
              )
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal 1: Add New Material */}
      {isAddItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 border border-black/[0.06] animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-black/[0.06]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#B4D58A]/20 text-[#B4D58A] flex items-center justify-center">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-[#252525]">Register Raw Material</h3>
                  <p className="text-xs text-[#5A5D58]">Add tracked ingredient or kitchen packaging material</p>
                </div>
              </div>
              <button onClick={() => setIsAddItemModalOpen(false)} className="text-[#8E928B] hover:text-[#252525]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                addItemMutation.mutate({
                  branch_id: activeBranch?.id,
                  supplier_id: itemSupplierId ? parseInt(itemSupplierId, 10) : null,
                  name: itemName,
                  sku: itemSku || null,
                  category: itemCategory,
                  unit: itemUnit,
                  current_stock: parseFloat(itemStock),
                  minimum_stock: parseFloat(itemMinStock),
                  unit_cost: parseFloat(itemCost),
                  storage_location: itemLocation,
                });
              }}
              className="space-y-3 pt-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#252525]">Material Name *</label>
                  <Input
                    required
                    placeholder="e.g. Basmati Rice Premium"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#252525]">SKU Code</label>
                  <Input
                    placeholder="e.g. ING-RICE-01"
                    value={itemSku}
                    onChange={(e) => setItemSku(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#252525]">Category *</label>
                  <select
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-black/[0.06] bg-white text-xs text-[#252525]"
                  >
                    <option value="produce">Produce & Vegetables</option>
                    <option value="meat">Red Meat</option>
                    <option value="poultry">Poultry</option>
                    <option value="seafood">Seafood</option>
                    <option value="dairy">Dairy & Paneer</option>
                    <option value="spices">Spices & Seasonings</option>
                    <option value="dry_goods">Dry Goods & Grains</option>
                    <option value="beverages">Beverage Concentrates</option>
                    <option value="packaging">Packaging & Disposables</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#252525]">Measurement Unit *</label>
                  <select
                    value={itemUnit}
                    onChange={(e) => setItemUnit(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-black/[0.06] bg-white text-xs text-[#252525]"
                  >
                    <option value="kg">Kilograms (kg)</option>
                    <option value="g">Grams (g)</option>
                    <option value="l">Liters (L)</option>
                    <option value="ml">Milliliters (ml)</option>
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="pack">Packs</option>
                    <option value="box">Boxes</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#252525]">Initial Stock *</label>
                  <Input
                    type="number"
                    step="0.01"
                    required
                    value={itemStock}
                    onChange={(e) => setItemStock(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#252525]">Min Alert Level *</label>
                  <Input
                    type="number"
                    step="0.01"
                    required
                    value={itemMinStock}
                    onChange={(e) => setItemMinStock(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#252525]">Cost per Unit (₹) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    required
                    value={itemCost}
                    onChange={(e) => setItemCost(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#252525]">Preferred Supplier</label>
                  <select
                    value={itemSupplierId}
                    onChange={(e) => setItemSupplierId(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-black/[0.06] bg-white text-xs text-[#252525]"
                  >
                    <option value="">No Supplier Assigned</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#252525]">Storage Location</label>
                  <Input
                    placeholder="e.g. Walk-in Chiller #2"
                    value={itemLocation}
                    onChange={(e) => setItemLocation(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-black/[0.06]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddItemModalOpen(false)}
                  className="text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={addItemMutation.isPending}
                  className="text-xs h-9 bg-[#B4D58A] hover:bg-[#9EC271] text-white"
                >
                  {addItemMutation.isPending ? 'Registering...' : 'Register Material'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Adjust Stock / Wastage */}
      {isAdjustStockModalOpen && selectedItemForAdjust && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-black/[0.06] animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <div>
                <h3 className="font-bold text-[#252525]">Adjust Stock Level</h3>
                <p className="text-xs text-[#5A5D58]">
                  {selectedItemForAdjust.name} (Current: {Number(selectedItemForAdjust.current_stock).toFixed(2)} {selectedItemForAdjust.unit})
                </p>
              </div>
              <button onClick={() => setIsAdjustStockModalOpen(false)} className="text-[#8E928B] hover:text-[#252525]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                adjustStockMutation.mutate({
                  inventory_item_id: selectedItemForAdjust.id,
                  movement_type: adjustType,
                  quantity: parseFloat(adjustQty),
                  reason: adjustReason,
                  notes: adjustNotes || null,
                });
              }}
              className="space-y-3 pt-4"
            >
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#252525]">Adjustment Type *</label>
                <select
                  value={adjustType}
                  onChange={(e) => {
                    const type = e.target.value;
                    setAdjustType(type);
                    if (type === 'wastage' || type === 'spoilage') {
                      setAdjustQty('-1');
                      setAdjustReason(type === 'wastage' ? 'Kitchen prep wastage' : 'Spoilage past expiry');
                    } else {
                      setAdjustQty('5');
                      setAdjustReason('Physical audit stock correction');
                    }
                  }}
                  className="w-full h-9 px-3 rounded-md border border-black/[0.06] bg-white text-xs text-[#252525]"
                >
                  <option value="wastage">Wastage / Kitchen Prep Loss (Deduction)</option>
                  <option value="spoilage">Spoilage / Expiry (Deduction)</option>
                  <option value="audit_adjustment">Manual Audit Count Correction</option>
                  <option value="purchase_in">Emergency Direct Purchase (Addition)</option>
                  <option value="return">Supplier Return (Deduction)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#252525]">
                  Quantity Delta ({selectedItemForAdjust.unit}) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  placeholder="-1.5 or +5.0"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="h-9 text-xs"
                />
                <p className="text-[11px] text-[#8E928B]">Use negative numbers for wastage/loss, positive for additions.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#252525]">Reason *</label>
                <Input
                  required
                  placeholder="e.g. Spilled sauce pan, damaged delivery bag"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#252525]">Auditor Notes</label>
                <Input
                  placeholder="Logged by Chef or Manager"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-black/[0.06]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAdjustStockModalOpen(false)}
                  className="text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={adjustStockMutation.isPending}
                  className="text-xs h-9 bg-[#B4D58A] hover:bg-[#9EC271] text-white"
                >
                  {adjustStockMutation.isPending ? 'Saving...' : 'Record Adjustment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Add Supplier */}
      {isAddSupplierModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 border border-black/[0.06] animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-black/[0.06]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#B4D58A]/20 text-[#B4D58A] flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-[#252525]">Register New Supplier</h3>
                  <p className="text-xs text-[#5A5D58]">Vendor profile for purchase orders and material supply</p>
                </div>
              </div>
              <button onClick={() => setIsAddSupplierModalOpen(false)} className="text-[#8E928B] hover:text-[#252525]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                addSupplierMutation.mutate({
                  name: supName,
                  contact_person: supContact || null,
                  phone: supPhone || null,
                  email: supEmail || null,
                  address: supAddress || null,
                  tax_number: supTax || null,
                  payment_terms: supTerms,
                });
              }}
              className="space-y-3 pt-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#252525]">Supplier Business Name *</label>
                  <Input
                    required
                    placeholder="e.g. Apex Meat Farms"
                    value={supName}
                    onChange={(e) => setSupName(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#252525]">Contact Representative</label>
                  <Input
                    placeholder="e.g. Rajesh Sharma"
                    value={supContact}
                    onChange={(e) => setSupContact(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#252525]">Phone Number</label>
                  <Input
                    placeholder="+91 98765 43210"
                    value={supPhone}
                    onChange={(e) => setSupPhone(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#252525]">Email Address</label>
                  <Input
                    type="email"
                    placeholder="orders@vendor.example.com"
                    value={supEmail}
                    onChange={(e) => setSupEmail(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#252525]">Warehouse / Office Address</label>
                <Input
                  placeholder="Street, City, Industrial Area"
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#252525]">GST / Tax Number</label>
                  <Input
                    placeholder="27AAAAA0000A1Z5"
                    value={supTax}
                    onChange={(e) => setSupTax(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#252525]">Payment Terms</label>
                  <select
                    value={supTerms}
                    onChange={(e) => setSupTerms(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-black/[0.06] bg-white text-xs text-[#252525]"
                  >
                    <option value="net_15">Net 15 Days</option>
                    <option value="net_30">Net 30 Days</option>
                    <option value="cash_on_delivery">Cash On Delivery (COD)</option>
                    <option value="advance">100% Advance</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-black/[0.06]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddSupplierModalOpen(false)}
                  className="text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={addSupplierMutation.isPending}
                  className="text-xs h-9 bg-[#B4D58A] hover:bg-[#9EC271] text-white"
                >
                  {addSupplierMutation.isPending ? 'Saving...' : 'Register Supplier'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Create Purchase Order */}
      {isCreatePoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 border border-black/[0.06] animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#FAF9F6] text-[#B4D58A] flex items-center justify-center">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-[#252525]">Issue Purchase Order</h3>
                  <p className="text-xs text-[#5A5D58]">Order supplies from registered vendor</p>
                </div>
              </div>
              <button onClick={() => setIsCreatePoModalOpen(false)} className="text-[#8E928B] hover:text-[#252525]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!poSupplierId) {
                  toast.error('Please select a supplier');
                  return;
                }
                createPoMutation.mutate({
                  branch_id: activeBranch?.id,
                  supplier_id: parseInt(poSupplierId, 10),
                  order_date: new Date().toISOString().split('T')[0],
                  expected_delivery_date: poExpectedDate || null,
                  notes: poNotes || null,
                  items: poItems,
                });
              }}
              className="space-y-4 pt-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#252525]">Supplier *</label>
                  <select
                    required
                    value={poSupplierId}
                    onChange={(e) => setPoSupplierId(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-black/[0.06] bg-white text-xs text-[#252525]"
                  >
                    <option value="">Select Vendor...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#252525]">Expected Delivery Date</label>
                  <Input
                    type="date"
                    value={poExpectedDate}
                    onChange={(e) => setPoExpectedDate(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#252525]">Ordered Materials</label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (catalogItems.length > 0) {
                        setPoItems([
                          ...poItems,
                          {
                            inventory_item_id: catalogItems[0].id,
                            quantity_ordered: 5,
                            unit_cost: Number(catalogItems[0].unit_cost),
                          },
                        ]);
                      }
                    }}
                    className="h-7 text-xs text-[#B4D58A]"
                  >
                    + Add Item
                  </Button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {poItems.map((item, idx) => {
                    return (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-[#FAF9F6] border border-black/[0.06]">
                        <select
                          value={item.inventory_item_id}
                          onChange={(e) => {
                            const newId = parseInt(e.target.value, 10);
                            const found = catalogItems.find((i) => i.id === newId);
                            const updated = [...poItems];
                            updated[idx] = {
                              ...updated[idx],
                              inventory_item_id: newId,
                              unit_cost: found ? Number(found.unit_cost) : updated[idx].unit_cost,
                            };
                            setPoItems(updated);
                          }}
                          className="w-1/2 h-8 px-2 rounded border border-black/[0.06] bg-white text-xs text-[#252525]"
                        >
                          {catalogItems.map((invItem) => (
                            <option key={invItem.id} value={invItem.id}>
                              {invItem.name} ({invItem.unit})
                            </option>
                          ))}
                        </select>

                        <div className="w-1/4">
                          <Input
                            type="number"
                            min="0.1"
                            step="0.1"
                            placeholder="Qty"
                            value={item.quantity_ordered}
                            onChange={(e) => {
                              const updated = [...poItems];
                              updated[idx].quantity_ordered = parseFloat(e.target.value) || 0;
                              setPoItems(updated);
                            }}
                            className="h-8 text-xs"
                          />
                        </div>

                        <div className="w-1/4">
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            placeholder="Rate (₹)"
                            value={item.unit_cost}
                            onChange={(e) => {
                              const updated = [...poItems];
                              updated[idx].unit_cost = parseFloat(e.target.value) || 0;
                              setPoItems(updated);
                            }}
                            className="h-8 text-xs"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => setPoItems(poItems.filter((_, i) => i !== idx))}
                          className="text-[#8E928B] hover:text-[#F2AFC0]"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#252525]">Order Notes</label>
                <Input
                  placeholder="Special instructions or delivery dock gate info"
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-black/[0.06]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreatePoModalOpen(false)}
                  className="text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createPoMutation.isPending || poItems.length === 0}
                  className="text-xs h-9 bg-[#B4D58A] hover:bg-[#9EC271] text-white"
                >
                  {createPoMutation.isPending ? 'Issuing...' : 'Issue Purchase Order'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: Receive PO Shipment */}
      {isReceivePoModalOpen && selectedPoForReceive && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 border border-black/[0.06] animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <div>
                <h3 className="font-bold text-[#252525]">Receive Shipment Intake</h3>
                <p className="text-xs text-[#5A5D58]">
                  Intake delivery for <span className="font-mono font-bold text-[#252525]">{selectedPoForReceive.po_number}</span>
                </p>
              </div>
              <button onClick={() => setIsReceivePoModalOpen(false)} className="text-[#8E928B] hover:text-[#252525]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 py-4 max-h-64 overflow-y-auto">
              {selectedPoForReceive.items?.map((item) => (
                <div key={item.id} className="p-3 rounded-lg border border-black/[0.06] bg-[#FAF9F6] flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-xs text-[#252525]">{item.inventory_item?.name || 'Raw Material'}</p>
                    <p className="text-[11px] text-[#5A5D58]">
                      Ordered: {Number(item.quantity_ordered).toFixed(2)} | Already Recv: {Number(item.quantity_received).toFixed(2)}
                    </p>
                  </div>

                  <div className="w-32">
                    <label className="text-[10px] text-[#5A5D58] block">Receive Now ({item.inventory_item?.unit || 'units'}):</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max={Math.max(0, Number(item.quantity_ordered) - Number(item.quantity_received))}
                      value={receivedQuantities[item.id] ?? 0}
                      onChange={(e) => {
                        setReceivedQuantities({
                          ...receivedQuantities,
                          [item.id]: parseFloat(e.target.value) || 0,
                        });
                      }}
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-black/[0.06]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsReceivePoModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const receiptArray = Object.entries(receivedQuantities).map(([itemId, qty]) => ({
                    item_id: parseInt(itemId, 10),
                    quantity_received: qty,
                  }));
                  receivePoMutation.mutate({
                    poId: selectedPoForReceive.id,
                    items: receiptArray,
                  });
                }}
                disabled={receivePoMutation.isPending}
                className="text-xs bg-[#B4D58A] hover:bg-[#2F6B4A] text-white"
              >
                {receivePoMutation.isPending ? 'Updating...' : 'Accept Goods & Increment Stock'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 6: Stock Movement Ledger History */}
      {historyItemId && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 border border-black/[0.06] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <div>
                <h3 className="font-bold text-base text-[#252525]">
                  Stock Ledger — {historyItemDetail?.name || 'Loading...'}
                </h3>
                <p className="text-xs text-[#5A5D58]">Recent 20 audited stock movements</p>
              </div>
              <button onClick={() => setHistoryItemId(null)} className="text-[#8E928B] hover:text-[#252525]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-black/[0.06]">
              {isHistoryLoading ? (
                <p className="text-xs text-center text-[#5A5D58] py-8">Loading ledger...</p>
              ) : !historyItemDetail?.stock_movements?.length ? (
                <p className="text-xs text-center text-[#5A5D58] py-8">No stock movements recorded yet.</p>
              ) : (
                historyItemDetail.stock_movements.map((m: any) => (
                  <div key={m.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold capitalize text-[#252525]">
                        {String(m.movement_type).replace('_', ' ')}
                      </span>
                      <p className="text-[11px] text-[#5A5D58]">{m.reason || m.notes || '—'}</p>
                    </div>
                    <div className="text-right">
                      <span className={`font-bold ${Number(m.quantity) >= 0 ? 'text-[#2F6B4A]' : 'text-red-500'}`}>
                        {Number(m.quantity) >= 0 ? '+' : ''}{Number(m.quantity).toFixed(3)}
                      </span>
                      <p className="text-[10px] text-[#8E928B]">Bal: {Number(m.balance_after).toFixed(3)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-black/[0.06]">
              <Button size="sm" variant="outline" onClick={() => setHistoryItemId(null)} className="text-xs">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
