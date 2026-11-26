'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  CreditCard,
  CheckCircle2,
  Sparkles,
  Zap,
  Building2,
  Grid,
  Users,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  X,
  Lock,
} from 'lucide-react';

interface SubscriptionPlan {
  id: number;
  name: string;
  slug: string;
  description: string;
  monthly_price: string | number;
  annual_price: string | number;
  currency: string;
  max_branches: number;
  max_tables_per_branch: number;
  max_staff_members: number;
  features: string[];
  sort_order: number;
}

export default function SubscriptionManagementPage() {
  const queryClient = useQueryClient();
  const { activeRestaurant } = useAuthStore((s) => ({
    activeRestaurant: s.activeRestaurant,
  }));

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [selectedPlanForUpgrade, setSelectedPlanForUpgrade] = useState<SubscriptionPlan | null>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  // 1. Fetch Current Subscription & Quotas
  const { data: currentData, isLoading: isCurrentLoading, refetch: refetchCurrent } = useQuery({
    queryKey: ['subscription-current', activeRestaurant?.id],
    queryFn: async () => {
      const res = await apiRequest('subscription/current', {
        restaurantId: activeRestaurant?.id,
      });
      return res.data;
    },
    enabled: !!activeRestaurant?.id,
  });

  // 2. Fetch Available Subscription Plans
  const { data: plansData, isLoading: isPlansLoading } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const res = await apiRequest('subscription/plans');
      return res.data;
    },
  });

  const plans: SubscriptionPlan[] = plansData || [];
  const currentPlan = currentData?.plan;
  const quotas = currentData?.quotas;
  const subDetails = currentData?.subscription_details;

  // Upgrade Plan Mutation
  const upgradeMutation = useMutation({
    mutationFn: async (payload: any) => {
      return await apiRequest('subscription/upgrade', {
        method: 'POST',
        restaurantId: activeRestaurant?.id,
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Subscription upgraded successfully!');
      queryClient.invalidateQueries({ queryKey: ['subscription-current'] });
      setIsUpgradeModalOpen(false);
      setSelectedPlanForUpgrade(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to upgrade subscription');
    },
  });

  const handleUpgradeSubmit = () => {
    if (!selectedPlanForUpgrade) return;

    upgradeMutation.mutate({
      restaurant_id: activeRestaurant?.id,
      plan_id: selectedPlanForUpgrade.id,
      billing_cycle: billingCycle,
      payment_gateway: 'razorpay',
      payment_reference: `pay_demo_${Date.now()}`,
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#292B28]">SaaS Subscription & Plan Quotas</h1>
            <Badge variant="outline" className="text-[#C76B4A] border-[#F8EAE3] bg-[#FAF8F4]">
              Phase 8
            </Badge>
          </div>
          <p className="text-sm text-[#777872] mt-1">
            Manage your restaurant tier, monitor capacity limits, and unlock multi-branch operating features.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetchCurrent()}
          className="border-[#EAE7E0] hover:bg-[#F3F1EB] text-[#292B28]"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Quotas
        </Button>
      </div>

      {/* Active Subscription Overview Card */}
      <Card className="border-[#EAE7E0] bg-white shadow-xs overflow-hidden">
        <div className="bg-[#FAF8F4] p-6 border-b border-[#EAE7E0] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#F8EAE3] text-[#C76B4A] flex items-center justify-center font-bold">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-[#292B28]">{currentPlan?.name || 'Growth Pro'}</h3>
                <Badge className="bg-[#EEF1E9] text-[#39845C] border-[#D6DFC9] capitalize text-xs">
                  {currentData?.status || 'Active'}
                </Badge>
              </div>
              <p className="text-xs text-[#777872] mt-0.5">
                Current cycle: <strong className="capitalize">{subDetails?.billing_cycle}</strong> | Renews on{' '}
                <strong>{subDetails?.renews_at}</strong>
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs text-[#777872]">Active Investment</p>
            <h4 className="text-2xl font-bold text-[#292B28]">
              ₹{Number(subDetails?.amount_paid || 4999).toLocaleString()}{' '}
              <span className="text-xs font-normal text-[#777872]">/{subDetails?.billing_cycle === 'annual' ? 'yr' : 'mo'}</span>
            </h4>
          </div>
        </div>

        {/* Quota Meters */}
        <CardContent className="p-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#777872] mb-4">Resource Capacity Meters</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Branch Quota */}
            <div className="p-4 rounded-xl border border-[#EAE7E0] bg-[#FAF8F4]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#292B28] flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-[#C76B4A]" /> Branch Locations
                </span>
                <span className="text-xs font-bold text-[#292B28]">
                  {quotas?.branches?.current || 1} / {quotas?.branches?.max || 3}
                </span>
              </div>
              <div className="w-full bg-[#EAE7E0] rounded-full h-2">
                <div
                  className="bg-[#C76B4A] h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, ((quotas?.branches?.current || 1) / (quotas?.branches?.max || 3)) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-[#777872] mt-2">
                {quotas?.branches?.remaining ?? 2} branch slots remaining
              </p>
            </div>

            {/* Table Quota */}
            <div className="p-4 rounded-xl border border-[#EAE7E0] bg-[#FAF8F4]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#292B28] flex items-center gap-1.5">
                  <Grid className="w-4 h-4 text-[#5185B8]" /> Dining Tables
                </span>
                <span className="text-xs font-bold text-[#292B28]">
                  {quotas?.tables?.current || 6} / {quotas?.tables?.max || 30}
                </span>
              </div>
              <div className="w-full bg-[#EAE7E0] rounded-full h-2">
                <div
                  className="bg-[#5185B8] h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, ((quotas?.tables?.current || 6) / (quotas?.tables?.max || 30)) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-[#777872] mt-2">
                Up to {quotas?.tables?.max_per_branch ?? 30} tables per branch location
              </p>
            </div>

            {/* Staff Accounts Quota */}
            <div className="p-4 rounded-xl border border-[#EAE7E0] bg-[#FAF8F4]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#292B28] flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#39845C]" /> Team Members & Staff
                </span>
                <span className="text-xs font-bold text-[#292B28]">
                  {quotas?.staff?.current || 6} / {quotas?.staff?.max || 20}
                </span>
              </div>
              <div className="w-full bg-[#EAE7E0] rounded-full h-2">
                <div
                  className="bg-[#39845C] h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, ((quotas?.staff?.current || 6) / (quotas?.staff?.max || 20)) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-[#777872] mt-2">
                Cashiers, managers, waiters, and kitchen chefs
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan Switcher & Billing Cycle Selector */}
      <div className="text-center space-y-3 pt-4">
        <h2 className="text-xl font-bold text-[#292B28]">Scale Your Restaurant OS Experience</h2>
        <p className="text-xs text-[#777872] max-w-lg mx-auto">
          Choose a plan that fits your dining floor operations. Switch tiers anytime as your restaurant chain expands.
        </p>

        <div className="inline-flex items-center gap-2 p-1 rounded-xl bg-[#FAF8F4] border border-[#EAE7E0]">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              billingCycle === 'monthly' ? 'bg-[#C76B4A] text-white shadow-xs' : 'text-[#777872] hover:text-[#292B28]'
            }`}
          >
            Monthly Billing
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              billingCycle === 'annual' ? 'bg-[#C76B4A] text-white shadow-xs' : 'text-[#777872] hover:text-[#292B28]'
            }`}
          >
            <span>Annual Billing</span>
            <span className="bg-[#EEF1E9] text-[#39845C] text-[10px] px-1.5 py-0.5 rounded font-bold">2 Months Free</span>
          </button>
        </div>
      </div>

      {/* Plans Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrent = currentPlan?.slug === plan.slug;
          const price = billingCycle === 'annual' ? plan.annual_price : plan.monthly_price;
          const isPro = plan.slug === 'pro';

          return (
            <Card
              key={plan.id}
              className={`border transition-all relative flex flex-col justify-between ${
                isPro
                  ? 'border-[#C76B4A] shadow-md ring-1 ring-[#C76B4A]'
                  : 'border-[#EAE7E0] bg-white shadow-xs hover:border-[#C76B4A]'
              }`}
            >
              {isPro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#C76B4A] text-white text-[11px] font-bold shadow-xs">
                  Most Popular for Busy Restaurants
                </div>
              )}

              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold text-[#292B28]">{plan.name}</CardTitle>
                  {isCurrent && (
                    <Badge className="bg-[#EEF1E9] text-[#39845C] border-none text-[10px]">Current Plan</Badge>
                  )}
                </div>
                <CardDescription className="text-xs text-[#777872] min-h-[36px]">
                  {plan.description}
                </CardDescription>

                <div className="pt-4">
                  <span className="text-3xl font-extrabold text-[#292B28]">₹{Number(price).toLocaleString()}</span>
                  <span className="text-xs text-[#777872]">/{billingCycle === 'annual' ? 'year' : 'month'}</span>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pb-6">
                <div className="pt-2 border-t border-[#EAE7E0] space-y-2 text-xs text-[#292B28]">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#39845C] shrink-0" />
                    <span>Up to <strong>{plan.max_branches}</strong> Branch Location{plan.max_branches > 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#39845C] shrink-0" />
                    <span>Up to <strong>{plan.max_tables_per_branch}</strong> Tables per Branch</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#39845C] shrink-0" />
                    <span>Up to <strong>{plan.max_staff_members}</strong> Staff Member Accounts</span>
                  </div>

                  {plan.features?.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-[#777872]">
                      <CheckCircle2 className="w-4 h-4 text-[#39845C] shrink-0" />
                      <span className="capitalize">{feat.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-4">
                  {isCurrent ? (
                    <Button disabled variant="outline" className="w-full text-xs h-9 border-[#EAE7E0]">
                      Active Tier
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        setSelectedPlanForUpgrade(plan);
                        setIsUpgradeModalOpen(true);
                      }}
                      className={`w-full text-xs h-9 ${
                        isPro
                          ? 'bg-[#C76B4A] hover:bg-[#AE593B] text-white shadow-xs'
                          : 'bg-[#FAF8F4] text-[#292B28] hover:bg-[#F8EAE3] border border-[#EAE7E0]'
                      }`}
                    >
                      <span>Upgrade to {plan.name}</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Upgrade Modal */}
      {isUpgradeModalOpen && selectedPlanForUpgrade && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-[#EAE7E0] animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE7E0]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#F8EAE3] text-[#C76B4A] flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-[#292B28]">Confirm Plan Upgrade</h3>
                  <p className="text-xs text-[#777872]">Switching to {selectedPlanForUpgrade.name}</p>
                </div>
              </div>
              <button onClick={() => setIsUpgradeModalOpen(false)} className="text-[#A2A29A] hover:text-[#292B28]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-[#FAF8F4] border border-[#EAE7E0] space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#777872]">Target Tier:</span>
                  <strong className="text-[#292B28]">{selectedPlanForUpgrade.name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#777872]">Billing Frequency:</span>
                  <span className="capitalize font-semibold text-[#292B28]">{billingCycle}</span>
                </div>
                <div className="flex justify-between text-sm pt-1 border-t border-[#EAE7E0]">
                  <span className="font-bold">Total Investment:</span>
                  <strong className="text-[#C76B4A] font-bold">
                    ₹{Number(billingCycle === 'annual' ? selectedPlanForUpgrade.annual_price : selectedPlanForUpgrade.monthly_price).toLocaleString()}
                  </strong>
                </div>
              </div>

              <p className="text-[11px] text-[#777872]">
                Your quotas will immediately expand to {selectedPlanForUpgrade.max_branches} branch locations and {selectedPlanForUpgrade.max_staff_members} staff accounts.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EAE7E0]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsUpgradeModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleUpgradeSubmit}
                disabled={upgradeMutation.isPending}
                className="text-xs bg-[#C76B4A] hover:bg-[#AE593B] text-white"
              >
                {upgradeMutation.isPending ? 'Processing...' : 'Confirm Upgrade'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
