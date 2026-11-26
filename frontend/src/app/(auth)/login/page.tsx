'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { apiRequest, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  Sparkles,
  Lock,
  UserCheck,
  Building,
  KeyRound,
  ShieldCheck,
  Check,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const demoAccounts = [
    { role: 'Super Admin', email: 'superadmin@resto.com', desc: 'Universal multi-tenant control' },
    { role: 'Restaurant Admin', email: 'admin@grandfeast.com', desc: 'The Grand Feast owner' },
    { role: 'Branch Manager', email: 'manager@grandfeast.com', desc: 'Downtown Flagship manager' },
    { role: 'Cashier / POS', email: 'cashier@grandfeast.com', desc: 'Billing & Table checkout' },
    { role: 'Waiter', email: 'waiter@grandfeast.com', desc: 'Table orders & status' },
    { role: 'Kitchen Chef', email: 'kitchen@grandfeast.com', desc: 'Kitchen KDS preparation' },
  ];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login.trim() || !password) {
      toast.error('Please enter your email/username and password');
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest<{
        token: string;
        token_type: string;
        user: any;
      }>('auth/login', {
        method: 'POST',
        body: JSON.stringify({ login, password }),
      });

      if (response.success && response.data) {
        setAuth(response.data.user, response.data.token);
        toast.success(`Welcome back, ${response.data.user.name}!`);
        router.push('/dashboard');
      }
    } catch (err: any) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Could not connect to Restaurant OS backend. Please check server.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const selectDemoAccount = (email: string) => {
    setLogin(email);
    setPassword('password123');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4] px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#C76B4A] text-white shadow-sm mb-2">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-[#292B28]">
            Restaurant OS
          </h1>
          <p className="text-sm text-[#777872]">
            High-performance multi-restaurant operating platform
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-[#EAE7E0] shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Sign in to your station</CardTitle>
            <CardDescription>
              Enter your credentials to access your restaurant station
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                label="Email or Username"
                type="text"
                placeholder="superadmin@resto.com"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
              />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#777872]">
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-[#C76B4A] hover:text-[#AE593B]"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full mt-2"
                isLoading={isLoading}
              >
                Sign In
              </Button>
            </form>

            {/* Quick Demo Credentials Selector */}
            <div className="mt-6 pt-5 border-t border-[#EAE7E0]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#777872]">
                  Quick Demo Access (Phase 1)
                </span>
                <span className="text-[11px] text-[#A2A29A]">Click to test</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {demoAccounts.map((account) => {
                  const isSelected = login === account.email;
                  return (
                    <button
                      key={account.role}
                      type="button"
                      onClick={() => selectDemoAccount(account.email)}
                      className={`text-left p-2.5 rounded-[10px] border transition-all text-xs cursor-pointer ${
                        isSelected
                          ? 'border-[#C76B4A] bg-[#F8EAE3] text-[#292B28]'
                          : 'border-[#EAE7E0] bg-[#FAF8F4] hover:bg-[#F3F1EB] text-[#777872]'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold text-[#292B28]">
                        <span>{account.role}</span>
                        {isSelected && <Check className="h-3 w-3 text-[#C76B4A]" />}
                      </div>
                      <p className="text-[10px] text-[#777872] truncate mt-0.5">
                        {account.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer info */}
        <p className="text-center text-xs text-[#A2A29A]">
          Restaurant OS v1.0 • Multi-Tenant RBAC Security • Phase 1 Deliverable
        </p>
      </div>
    </div>
  );
}
