'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  ChevronLeft,
  Users,
  Phone,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export default function ReservePage() {
  const [resBranchId, setResBranchId] = useState<number>(1);
  const [resName, setResName] = useState('');
  const [resPhone, setResPhone] = useState('');
  const [resEmail, setResEmail] = useState('');
  const [resGuests, setResGuests] = useState<number>(2);
  const [resDate, setResDate] = useState('');
  const [resTime, setResTime] = useState('19:30');
  const [resNotes, setResNotes] = useState('');
  const [resError, setResError] = useState<string | null>(null);
  const [bookingConfirmed, setBookingConfirmed] = useState<any | null>(null);

  React.useEffect(() => {
    setResDate(new Date().toISOString().split('T')[0]);
  }, []);

  // Fetch branches
  const { data: publicData } = useQuery({
    queryKey: ['public-restaurant-profile'],
    queryFn: async () => {
      const res = await apiClient.get<any>('/public/restaurants/the-grand-feast');
      return res.data;
    },
  });

  const branches = publicData?.branches || [
    { id: 1, name: 'Downtown Flagship', city: 'Chennai', address: '42 Anna Salai, Thousand Lights' },
    { id: 2, name: 'Seaside Bistro', city: 'Chennai', address: '18 Beach Road, Besant Nagar' },
  ];

  const reservationMutation = useMutation({
    mutationFn: async () => {
      setResError(null);
      const res = await apiClient.post<any>('/public/reservations', {
        restaurant_id: 1,
        branch_id: resBranchId,
        customer_name: resName,
        customer_phone: resPhone,
        customer_email: resEmail || undefined,
        guest_count: resGuests,
        reservation_date: resDate,
        reservation_time: resTime,
        special_requests: resNotes || undefined,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setBookingConfirmed(data);
    },
    onError: (err: any) => {
      setResError(err.response?.data?.message || err.message || 'Failed to book reservation.');
    },
  });

  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-[#B4D58A] font-poppins text-[#252525] overflow-hidden">
      {/* Background blur spheres */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#F3DA8A]/30 blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full px-6 sm:px-12 pt-7">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#252525] bg-white/40 hover:bg-white px-4 py-2 rounded-2xl backdrop-blur-md transition-all shadow-xs"
          >
            <ChevronLeft className="h-4 w-4" /> Back to Home
          </Link>
          <span className="font-baloo text-2xl font-extrabold text-[#252525]">
            The Grand Feast
          </span>
          <div className="w-24 hidden sm:block" />
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 max-w-xl w-full mx-auto px-4 py-8 flex flex-col justify-center animate-slide-up">
        {bookingConfirmed ? (
          <div className="bg-white rounded-3xl p-8 sm:p-10 text-center space-y-6 shadow-[0_20px_60px_rgba(60,40,80,0.22)]">
            <div className="h-16 w-16 bg-[#B4D58A] text-[#252525] rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="h-9 w-9" />
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#252525] bg-[#B4D58A]/30 px-3 py-1 rounded-full">
                Booking Confirmed
              </span>
              <h2 className="text-3xl font-bold text-[#252525] mt-3">
                Your Table is Reserved!
              </h2>
              <p className="text-xs text-[#5A5D58] mt-1 font-medium">
                We have notified our host team. Please present your reference code on arrival.
              </p>
            </div>

            <div className="p-5 bg-[#F3DA8A]/25 rounded-2xl text-left space-y-3 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-black/[0.06]">
                <span className="font-bold uppercase tracking-wider text-[#5A5D58]">
                  Booking Reference
                </span>
                <span className="font-extrabold text-base text-[#252525]">
                  {bookingConfirmed.booking_code || 'RES-10492'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5A5D58]">Guest Name</span>
                <span className="font-bold text-[#252525]">{resName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5A5D58]">Date & Time</span>
                <span className="font-bold text-[#252525]">{resDate} at {resTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5A5D58]">Party Size</span>
                <span className="font-bold text-[#252525]">{resGuests} Guests</span>
              </div>
            </div>

            <div className="space-y-3">
              <Link href="/">
                <Button variant="mint" size="lg" className="w-full text-xs">
                  Return to Home
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-[0_20px_60px_rgba(60,40,80,0.22)] space-y-6">
            <div className="text-center space-y-2">
              <Badge variant="mint" className="uppercase tracking-widest text-[10px] py-1 px-3">
                Instant Table Reservation
              </Badge>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#252525]">
                RESERVE A TABLE
              </h1>
              <p className="text-xs text-[#5A5D58] font-medium">
                Experience royal dining at The Grand Feast. Zero booking charges.
              </p>
            </div>

            {resError && (
              <div className="bg-[#F2AFC0]/20 border border-[#F2AFC0] p-3 rounded-2xl text-xs text-[#252525] font-semibold">
                {resError}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                reservationMutation.mutate();
              }}
              className="space-y-4 text-xs"
            >
              {/* Branch Selection */}
              <div>
                <label className="font-bold uppercase tracking-wider text-[#5A5D58] block mb-1.5">
                  Select Branch
                </label>
                <select
                  value={resBranchId}
                  onChange={(e) => setResBranchId(Number(e.target.value))}
                  className="w-full h-12 px-4 rounded-2xl border border-black/[0.08] bg-white text-sm text-[#252525] outline-none focus:border-[#C2B0DC] focus:ring-4 focus:ring-[#C2B0DC]/20 font-medium"
                >
                  {branches.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.city})
                    </option>
                  ))}
                </select>
              </div>

              {/* Guest Details */}
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Guest Name *"
                  required
                  placeholder="Deepak Kumar"
                  value={resName}
                  onChange={(e) => setResName(e.target.value)}
                />
                <Input
                  label="Contact Phone *"
                  required
                  placeholder="+91 98765 00000"
                  value={resPhone}
                  onChange={(e) => setResPhone(e.target.value)}
                />
              </div>

              {/* Party & Schedule */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold uppercase tracking-wider text-[#5A5D58] block mb-1.5">
                    Guests *
                  </label>
                  <select
                    value={resGuests}
                    onChange={(e) => setResGuests(Number(e.target.value))}
                    className="w-full h-12 px-4 rounded-2xl border border-black/[0.08] bg-white text-sm text-[#252525] outline-none focus:border-[#C2B0DC] focus:ring-4 focus:ring-[#C2B0DC]/20 font-medium"
                  >
                    {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((num) => (
                      <option key={num} value={num}>
                        {num} {num === 1 ? 'Guest' : 'Guests'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold uppercase tracking-wider text-[#5A5D58] block mb-1.5">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={resDate}
                    onChange={(e) => setResDate(e.target.value)}
                    className="w-full h-12 px-4 rounded-2xl border border-black/[0.08] bg-white text-sm text-[#252525] outline-none focus:border-[#C2B0DC] focus:ring-4 focus:ring-[#C2B0DC]/20 font-medium"
                  />
                </div>
              </div>

              {/* Time */}
              <div>
                <label className="font-bold uppercase tracking-wider text-[#5A5D58] block mb-1.5">
                  Dining Slot *
                </label>
                <select
                  value={resTime}
                  onChange={(e) => setResTime(e.target.value)}
                  className="w-full h-12 px-4 rounded-2xl border border-black/[0.08] bg-white text-sm text-[#252525] outline-none focus:border-[#C2B0DC] focus:ring-4 focus:ring-[#C2B0DC]/20 font-medium"
                >
                  {['12:00', '12:30', '13:00', '13:30', '14:00', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'].map(
                    (slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    )
                  )}
                </select>
              </div>

              <Input
                label="Special Requests (Optional)"
                placeholder="Window seat, quiet corner, anniversary cake..."
                value={resNotes}
                onChange={(e) => setResNotes(e.target.value)}
              />

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="mint"
                  size="lg"
                  className="w-full font-bold"
                  isLoading={reservationMutation.isPending}
                >
                  Book My Experience
                </Button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-6 text-xs text-[#252525]/80 font-medium">
        The Grand Feast · Table Reservation System
      </footer>
    </div>
  );
}
