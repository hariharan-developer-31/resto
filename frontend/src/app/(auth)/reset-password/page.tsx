'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Sparkles, ArrowLeft } from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const qEmail = searchParams.get('email');
    const qToken = searchParams.get('token');
    if (qEmail) setEmail(qEmail);
    if (qToken) setToken(qToken);
  }, [searchParams]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }
    if (password !== passwordConfirmation) {
      toast.error('Password confirmations do not match');
      return;
    }

    setIsLoading(true);
    try {
      await apiRequest('auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email,
          token,
          password,
          password_confirmation: passwordConfirmation,
        }),
      });

      toast.success('Password successfully reset! Please login with your new password.');
      router.push('/login');
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="rounded-3xl border-none shadow-[0_20px_60px_rgba(60,40,80,0.22)] bg-white/95 backdrop-blur-xl p-2 sm:p-4">
      <CardHeader className="space-y-1.5 pb-4">
        <CardTitle className="text-2xl font-bold text-[#252525]">Set New Password</CardTitle>
        <CardDescription className="text-sm text-[#5A5D58]">
          Enter your reset token and your desired new password
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleReset} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Reset Token"
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
          />

          <Input
            label="New Password"
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Input
            label="Confirm New Password"
            type="password"
            placeholder="Re-type password"
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
            required
          />

          <Button type="submit" variant="lilac" size="lg" className="w-full" isLoading={isLoading}>
            Update Password
          </Button>
        </form>

        <div className="pt-4 border-t border-black/[0.06] text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5A5D58] hover:text-[#252525] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Sign In
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#C2B0DC] px-4 py-12 overflow-hidden font-poppins">
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#B4D58A]/25 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md space-y-6 animate-slide-up">
        <div className="text-center space-y-3">
          <Link href="/" className="inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-white text-[#C2B0DC] shadow-[0_10px_30px_rgba(60,40,80,0.2)] mb-1">
            <Sparkles className="h-7 w-7" />
          </Link>
          <h1 className="font-baloo text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-none">
            Reset Password
          </h1>
          <p className="text-sm font-medium text-white/90">
            Choose a strong password to protect your account
          </p>
        </div>

        <Suspense fallback={<div className="text-center text-xs text-white">Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
