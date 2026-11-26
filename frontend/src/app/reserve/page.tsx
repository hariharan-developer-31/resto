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
    <div className="min-h-screen bg-[#FAF8F4] text-[#292B28] flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-[#EAE7E0] bg-white">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xs font-semibold text-[#777872] hover:text-[#292B28]">
            <ChevronLeft className="h-4 w-4" /> Back to Home
          </Link>
          <span className="font-serif text-lg font-bold text-[#292B28]">The Grand Feast</span>
          <div className="w-16" />
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 sm:p-6 my-6">
        {bookingConfirmed ? (
          <div className="bg-white rounded-3xl border border-[#EAE7E0] p-8 text-center space-y-6 shadow-sm">
            <div className="h-16 w-16 bg-[#39845C]/10 text-[#39845C] rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-9 w-9" />
            </div>

            <div>
              <span className="text-xs font-mono font-bold tracking-widest text-[#39845C] uppercase">
                Booking Reference Confirmed
              </span>
              <h2 className="font-serif text-2xl font-bold text-[#292B28] mt-1">
                We Expect Your Arrival, {bookingConfirmed.customer_name}
              </h2>
              <p className="text-xs text-[#777872] mt-1 max-w-sm mx-auto">
                A table has been reserved for your party. An SMS confirmation has been dispatched to{' '}
                <strong>{bookingConfirmed.customer_phone}</strong>.
              </p>
            </div>

            <div className="bg-[#FAF8F4] p-4 rounded-2xl border border-[#EAE7E0] text-xs space-y-2 text-left">
              <div className="flex justify-between">
                <span className="text-[#777872]">Date & Time</span>
                <span className="font-bold text-[#292B28]">
                  {bookingConfirmed.reservation_date} at {bookingConfirmed.reservation_time}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#777872]">Guests</span>
                <span className="font-bold text-[#292B28]">{bookingConfirmed.guest_count} People</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#777872]">Status</span>
                <Badge variant="success" className="text-[10px] uppercase">
                  {bookingConfirmed.status}
                </Badge>
              </div>
            </div>

            <div className="flex gap-3">
              <Link href="/" className="flex-1">
                <Button variant="outline" className="w-full text-xs h-10 rounded-xl">
                  Explore Menu
                </Button>
              </Link>
              <Button
                onClick={() => setBookingConfirmed(null)}
                className="flex-1 bg-[#C76B4A] hover:bg-[#AE593B] text-white text-xs h-10 rounded-xl"
              >
                Book Another
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-[#EAE7E0] p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="text-center space-y-1">
              <span className="text-xs font-mono tracking-widest text-[#C76B4A] uppercase font-bold">
                Table Reservations
              </span>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#292B28]">
                Book Your Dining Experience
              </h1>
              <p className="text-xs text-[#777872]">
                Guaranteed table seating · Zero reservation fee · Instant confirmation
              </p>
            </div>

            {resError && (
              <div className="bg-[#FDF0F0] border border-[#F8DADA] p-3 rounded-xl text-xs text-[#C84D4D]">
                {resError}
              </div>
            )}

            <div className="space-y-4 text-xs">
              {/* Branch Selector */}
              <div>
                <label className="font-semibold text-[#292B28] block mb-1.5">Select Branch</label>
                <select
                  value={resBranchId}
                  onChange={(e) => setResBranchId(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl border border-[#EAE7E0] bg-white text-xs text-[#292B28]"
                >
                  {branches.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name} — {b.address}
                    </option>
                  ))}
                </select>
              </div>

              {/* Guest Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#292B28] block mb-1">Your Full Name *</label>
                  <Input
                    required
                    placeholder="Aditya Verma"
                    value={resName}
                    onChange={(e) => setResName(e.target.value)}
                    className="h-10 text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#292B28] block mb-1">Mobile Phone *</label>
                  <Input
                    required
                    placeholder="+91 99887 76655"
                    value={resPhone}
                    onChange={(e) => setResPhone(e.target.value)}
                    className="h-10 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#292B28] block mb-1">Email Address</label>
                <Input
                  type="email"
                  placeholder="aditya@example.com"
                  value={resEmail}
                  onChange={(e) => setResEmail(e.target.value)}
                  className="h-10 text-xs"
                />
              </div>

              {/* Party Size, Date, Time */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-semibold text-[#292B28] block mb-1">Party Size</label>
                  <select
                    value={resGuests}
                    onChange={(e) => setResGuests(Number(e.target.value))}
                    className="w-full h-10 px-2 rounded-xl border border-[#EAE7E0] bg-white text-xs text-[#292B28]"
                  >
                    {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? 'Guest' : 'Guests'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#292B28] block mb-1">Date</label>
                  <Input
                    type="date"
                    value={resDate}
                    onChange={(e) => setResDate(e.target.value)}
                    className="h-10 text-xs"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#292B28] block mb-1">Time Slot</label>
                  <select
                    value={resTime}
                    onChange={(e) => setResTime(e.target.value)}
                    className="w-full h-10 px-2 rounded-xl border border-[#EAE7E0] bg-white text-xs text-[#292B28]"
                  >
                    {[
                      '12:30',
                      '13:00',
                      '13:30',
                      '14:00',
                      '19:00',
                      '19:30',
                      '20:00',
                      '20:30',
                      '21:00',
                    ].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Special Requests */}
              <div>
                <label className="font-semibold text-[#292B28] block mb-1">
                  Seating or Dietary Preferences
                </label>
                <Input
                  placeholder="e.g. Window table, quiet corner, anniversary"
                  value={resNotes}
                  onChange={(e) => setResNotes(e.target.value)}
                  className="h-10 text-xs"
                />
              </div>
            </div>

            <Button
              disabled={!resName || !resPhone || reservationMutation.isPending}
              onClick={() => reservationMutation.mutate()}
              className="w-full bg-[#C76B4A] hover:bg-[#AE593B] text-white font-semibold text-xs h-11 rounded-xl shadow-xs"
            >
              {reservationMutation.isPending ? 'Confirming Table...' : 'Confirm Table Booking'}
            </Button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#EAE7E0] bg-white py-6 text-center text-xs text-[#777872]">
        The Grand Feast · Powered by Restaurant OS
      </footer>
    </div>
  );
}
