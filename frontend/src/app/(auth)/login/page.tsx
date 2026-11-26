'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { apiRequest, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  Sparkles,
  Check,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const demoAccounts = [
    { role: 'Super Admin', email: 'superadmin@resto.com', desc: 'Universal multi-tenant control', color: 'bg-[#B4D58A]/30 text-[#252525] border-[#B4D58A]' },
    { role: 'Restaurant Admin', email: 'admin@grandfeast.com', desc: 'The Grand Feast owner', color: 'bg-[#F3DA8A]/30 text-[#252525] border-[#F3DA8A]' },
    { role: 'Branch Manager', email: 'manager@grandfeast.com', desc: 'Downtown Flagship manager', color: 'bg-[#F2AFC0]/30 text-[#252525] border-[#F2AFC0]' },
    { role: 'Cashier / POS', email: 'cashier@grandfeast.com', desc: 'Billing & Table checkout', color: 'bg-[#B4D58A]/20 text-[#252525] border-[#B4D58A]' },
    { role: 'Waiter', email: 'waiter@grandfeast.com', desc: 'Table orders & status', color: 'bg-[#F3DA8A]/20 text-[#252525] border-[#F3DA8A]' },
    { role: 'Kitchen Chef', email: 'kitchen@grandfeast.com', desc: 'Kitchen KDS preparation', color: 'bg-[#F2AFC0]/20 text-[#252525] border-[#F2AFC0]' },
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
    <div className="relative min-h-screen flex items-center justify-center bg-[#B4D58A] px-4 py-12 sm:px-6 lg:px-8 overflow-hidden font-poppins">
      {/* Decorative floating blur spheres */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/30 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#F3DA8A]/30 blur-3xl pointer-events-none" />
      <div className="absolute top-1/4 right-10 w-64 h-64 rounded-full bg-[#F2AFC0]/25 blur-2xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-lg space-y-6 animate-slide-up">
        {/* Brand header */}
        <div className="text-center space-y-3">
          <Link href="/" className="inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-white text-[#252525] shadow-[0_10px_30px_rgba(60,40,80,0.15)] mb-1 hover:scale-105 transition-transform font-bold">
            <Sparkles className="h-7 w-7 text-[#B4D58A]" />
          </Link>
          <h1 className="font-baloo text-4xl sm:text-5xl font-extrabold tracking-tight text-[#252525] leading-none">
            Restaurant OS
          </h1>
          <p className="text-sm font-bold text-[#252525]/85 uppercase tracking-widest">
            Creative Multi-Tenant Operating Platform
          </p>
        </div>

        {/* Login Card */}
        <Card className="rounded-3xl border-none shadow-[0_20px_60px_rgba(60,40,80,0.18)] bg-white/95 backdrop-blur-xl p-2 sm:p-4">
          <CardHeader className="space-y-1.5 pb-4">
            <CardTitle className="text-2xl font-bold text-[#252525]">Sign in to station</CardTitle>
            <CardDescription className="text-sm text-[#5A5D58]">
              Enter your credentials to access your restaurant station
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                label="Email or Username"
                type="text"
                placeholder="superadmin@resto.com"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
              />

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#5A5D58]">
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-semibold text-[#5A5D58] hover:text-[#252525] transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex h-12 w-full rounded-2xl border border-black/[0.08] bg-white px-4 py-3 text-sm text-[#252525] placeholder:text-[#8E928B] transition-all outline-none focus:border-[#B4D58A] focus:ring-4 focus:ring-[#B4D58A]/20 font-medium"
                  required
                />
              </div>

              <Button
                type="submit"
                variant="mint"
                size="lg"
                className="w-full mt-2 font-bold"
                isLoading={isLoading}
              >
                Sign In
              </Button>
            </form>

            {/* Quick Demo Access Switcher */}
            <div className="pt-4 border-t border-black/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#8E928B]">
                  Quick Demo Access
                </span>
                <span className="text-[10px] text-[#5A5D58] font-medium">Click to test</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {demoAccounts.map((account) => {
                  const isSelected = login === account.email;
                  return (
                    <button
                      key={account.role}
                      type="button"
                      onClick={() => selectDemoAccount(account.email)}
                      className={`text-left p-3 rounded-2xl border transition-all text-xs cursor-pointer ${
                        isSelected
                          ? 'border-[#B4D58A] bg-[#B4D58A]/25 shadow-xs font-bold'
                          : 'border-black/[0.06] bg-black/[0.02] hover:bg-black/[0.04]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#252525]">{account.role}</span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-[#252525]" />}
                      </div>
                      <span className="text-[10px] text-[#5A5D58] line-clamp-1 mt-0.5 font-medium">
                        {account.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="text-center pt-2">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5A5D58] hover:text-[#252525] transition-colors"
              >
                <span>← Back to public website</span>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* System Footnote */}
        <p className="text-center text-xs text-[#252525]/75 font-semibold tracking-wide">
          Restaurant OS · Multi-Tenant RBAC Security
        </p>
      </div>
    </div>
  );
}
