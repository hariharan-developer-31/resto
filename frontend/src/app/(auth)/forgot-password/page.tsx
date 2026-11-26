'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api-client';
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
    <div className="relative min-h-screen flex items-center justify-center bg-[#B4D58A] px-4 py-12 overflow-hidden font-poppins">
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/30 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#F3DA8A]/30 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md space-y-6 animate-slide-up">
        <div className="text-center space-y-3">
          <Link href="/" className="inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-white text-[#252525] shadow-[0_10px_30px_rgba(60,40,80,0.15)] mb-1 font-bold">
            <Sparkles className="h-7 w-7 text-[#B4D58A]" />
          </Link>
          <h1 className="font-baloo text-3xl sm:text-4xl font-extrabold tracking-tight text-[#252525] leading-none">
            Password Recovery
          </h1>
          <p className="text-sm font-bold text-[#252525]/85">
            Reset your access credentials securely
          </p>
        </div>

        <Card className="rounded-3xl border-none shadow-[0_20px_60px_rgba(60,40,80,0.18)] bg-white/95 backdrop-blur-xl p-2 sm:p-4">
          <CardHeader className="space-y-1.5 pb-4">
            <CardTitle className="text-2xl font-bold text-[#252525]">Forgot Password</CardTitle>
            <CardDescription className="text-sm text-[#5A5D58]">
              Enter your registered email to receive reset instructions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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

                <Button type="submit" variant="mint" size="lg" className="w-full font-bold" isLoading={isLoading}>
                  Send Reset Link
                </Button>
              </form>
            ) : (
              <div className="space-y-4 text-center">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#B4D58A] text-[#252525] shadow-sm mb-2">
                  <MailCheck className="h-7 w-7" />
                </div>
                <p className="text-sm text-[#252525] font-medium leading-relaxed">
                  If an account matches <strong>{email}</strong>, a recovery request has been logged.
                </p>

                {resetToken && (
                  <div className="p-4 bg-[#F3DA8A]/25 rounded-2xl text-left text-xs space-y-1.5">
                    <p className="font-bold text-[#252525]">Development Token Generated:</p>
                    <p className="font-mono text-[11px] text-[#5A5D58] break-all">{resetToken}</p>
                    <Link
                      href={`/reset-password?email=${encodeURIComponent(email)}&token=${resetToken}`}
                      className="inline-block mt-2 font-bold text-[#252525] underline"
                    >
                      Click here to reset password with this token →
                    </Link>
                  </div>
                )}
              </div>
            )}

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
      </div>
    </div>
  );
}
