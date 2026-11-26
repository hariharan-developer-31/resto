'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { apiRequest, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Sparkles, ArrowLeft, MailCheck } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest<{ dev_reset_token?: string }>('auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      setSubmitted(true);
      if (response.data?.dev_reset_token) {
        setResetToken(response.data.dev_reset_token);
      }
      toast.success('Password reset instructions generated.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit reset request.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4] px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#C76B4A] text-white shadow-sm mb-2">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-[#292B28]">
            Password Recovery
          </h1>
          <p className="text-sm text-[#777872]">
            Reset your access credentials securely
          </p>
        </div>

        <Card className="border-[#EAE7E0] shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Forgot Password</CardTitle>
            <CardDescription>
              Enter your registered email to receive reset instructions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!submitted ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Registered Email"
                  type="email"
                  placeholder="admin@resto.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <Button type="submit" className="w-full" isLoading={isLoading}>
                  Send Reset Link
                </Button>
              </form>
            ) : (
              <div className="space-y-4 text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#EBF5EF] text-[#39845C] mb-2">
                  <MailCheck className="h-6 w-6" />
                </div>
                <p className="text-sm text-[#292B28] font-medium">
                  If an account matches <strong>{email}</strong>, a recovery request has been logged.
                </p>

                {resetToken && (
                  <div className="p-3 bg-[#FAF8F4] border border-[#EAE7E0] rounded-[10px] text-left text-xs space-y-1">
                    <p className="font-semibold text-[#C76B4A]">Development Token Generated:</p>
                    <p className="font-mono text-[11px] text-[#777872] break-all">{resetToken}</p>
                    <Link
                      href={`/reset-password?email=${encodeURIComponent(email)}&token=${resetToken}`}
                      className="inline-block mt-2 font-medium text-[#C76B4A] underline"
                    >
                      Click here to reset password with this token →
                    </Link>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-[#EAE7E0] text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#777872] hover:text-[#292B28]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Sign In
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
