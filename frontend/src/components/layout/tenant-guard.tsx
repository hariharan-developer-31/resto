'use client';

import React from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth-store';
import { Store, GitBranch, PlusCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TenantGuardProps {
  requireBranch?: boolean;
  stationName?: string;
  children: React.ReactNode;
}

export function TenantGuard({
  requireBranch = true,
  stationName = 'Station',
  children,
}: TenantGuardProps) {
  const user = useAuthStore((s) => s.user);
  const activeRestaurant = useAuthStore((s) => s.activeRestaurant);
  const activeBranch = useAuthStore((s) => s.activeBranch);
  const isSuperAdmin = user?.is_super_admin ?? false;

  // 1. If no restaurant is active/selected
  if (!activeRestaurant) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-3xl bg-[#B4D58A]/30 flex items-center justify-center text-[#252525] mb-4 shadow-xs">
          <Store className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold text-[#252525] mb-2 font-baloo">
          No Restaurant Selected
        </h2>
        <p className="text-sm text-[#5A5D58] max-w-md mb-6 font-medium">
          {stationName} requires an active restaurant context. Please create your first restaurant or select one from the top bar to continue.
        </p>
        <div className="flex items-center gap-3">
          <Link href="/restaurants">
            <Button variant="mint" className="gap-2 font-bold shadow-xs">
              <PlusCircle className="h-4 w-4" />
              {isSuperAdmin ? 'Provision First Restaurant' : 'View Restaurants'}
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" className="gap-1.5 text-xs font-semibold">
              Return to Dashboard
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // 2. If branch is required but none is active/configured
  if (requireBranch && !activeBranch) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-3xl bg-[#F3DA8A]/35 flex items-center justify-center text-[#252525] mb-4 shadow-xs">
          <GitBranch className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold text-[#252525] mb-2 font-baloo">
          No Branch Active for {activeRestaurant.name}
        </h2>
        <p className="text-sm text-[#5A5D58] max-w-md mb-6 font-medium">
          {stationName} operates on a specific dining branch. Please add or select an active branch for this restaurant.
        </p>
        <div className="flex items-center gap-3">
          <Link href={`/restaurants/${activeRestaurant.id}/branches`}>
            <Button variant="butter" className="gap-2 font-bold shadow-xs">
              <PlusCircle className="h-4 w-4" />
              Configure Branches
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" className="gap-1.5 text-xs font-semibold">
              Return to Dashboard
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
