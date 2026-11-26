'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Utensils,
  Calendar,
  Clock,
  MapPin,
  Phone,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  Users,
  X,
  ArrowRight,
  Shield,
  QrCode,
  Coffee,
  Flame,
} from 'lucide-react';

export default function RestaurantWebsite() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [reservationModalOpen, setReservationModalOpen] = useState(false);
  const [reservationSuccess, setReservationSuccess] = useState<any | null>(null);

  // Reservation Form State
  const [resBranchId, setResBranchId] = useState<number>(1);
  const [resName, setResName] = useState('');
  const [resPhone, setResPhone] = useState('');
  const [resEmail, setResEmail] = useState('');
  const [resGuests, setResGuests] = useState<number>(2);
  const [resDate, setResDate] = useState('');
  const [resTime, setResTime] = useState('19:30');
  const [resNotes, setResNotes] = useState('');
  const [resError, setResError] = useState<string | null>(null);

  React.useEffect(() => {
    setResDate(new Date().toISOString().split('T')[0]);
  }, []);

  // Fetch Public Restaurant Data
  const { data: publicData, isLoading } = useQuery({
    queryKey: ['public-restaurant-profile'],
    queryFn: async () => {
      const res = await apiClient.get<any>('/public/restaurants/the-grand-feast');
      return res.data;
    },
  });

  const restaurant = publicData?.restaurant || {
    name: 'The Grand Feast',
    tagline: 'An Ode to Timeless Culinary Heritage & Royal Flavors',
    phone: '+91 98765 43210',
    email: 'contact@grandfeast.com',
  };

  const branches = publicData?.branches || [
    {
      id: 1,
      name: 'Downtown Flagship',
      code: 'DWT-01',
      address: '42 Anna Salai, Thousand Lights',
      city: 'Chennai',
      opening_time: '11:00',
      closing_time: '23:00',
      phone: '+91 98765 43211',
    },
    {
      id: 2,
      name: 'Seaside Bistro',
      code: 'SSB-02',
      address: '18 Beach Road, Besant Nagar',
      city: 'Chennai',
      opening_time: '12:00',
      closing_time: '23:30',
      phone: '+91 98765 43212',
    },
  ];

  const categories = publicData?.menu_catalog || [];

  // Filtered Menu
  const displayedItems = React.useMemo(() => {
    if (!categories.length) return [];
    if (selectedCategory === 'all') {
      return categories.flatMap((c: any) => c.menu_items || []);
    }
    const cat = categories.find((c: any) => String(c.id) === selectedCategory);
    return cat ? cat.menu_items || [] : [];
  }, [categories, selectedCategory]);

  // Reservation Mutation
  const reservationMutation = useMutation({
    mutationFn: async () => {
      setResError(null);
      const res = await apiClient.post<any>('/public/reservations', {
        restaurant_id: restaurant.id || 1,
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
      setReservationSuccess(data);
      setReservationModalOpen(false);
    },
    onError: (err: any) => {
      setResError(err.response?.data?.message || err.message || 'Failed to book reservation.');
    },
  });

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#292B28] font-sans selection:bg-[#F8EAE3] selection:text-[#C76B4A]">
      {/* 1. TOP ANNOUNCEMENT & NAVIGATION HEADER */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#EAE7E0]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[#C76B4A] text-white flex items-center justify-center font-serif text-lg font-bold shadow-xs">
              G
            </div>
            <div>
              <span className="font-serif text-lg font-bold tracking-tight text-[#292B28] block leading-tight">
                {restaurant.name}
              </span>
              <span className="text-[10px] tracking-widest uppercase font-mono text-[#777872] block">
                Artisanal Dining & Kitchen
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-[#777872]">
            <a href="#story" className="hover:text-[#C76B4A] transition-colors">
              Our Story
            </a>
            <a href="#menu" className="hover:text-[#C76B4A] transition-colors">
              Digital Menu
            </a>
            <a href="#locations" className="hover:text-[#C76B4A] transition-colors">
              Locations & Hours
            </a>
            <Link href="/reserve" className="hover:text-[#C76B4A] transition-colors">
              Reservations
            </Link>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2.5">
            <Button
              onClick={() => setReservationModalOpen(true)}
              className="bg-[#C76B4A] hover:bg-[#AE593B] text-white text-xs font-semibold h-9 px-4 rounded-xl shadow-xs"
            >
              Reserve a Table
            </Button>
            <Link href="/login">
              <Button
                variant="outline"
                className="text-xs h-9 px-3 rounded-xl border-[#EAE7E0] text-[#777872] hover:text-[#292B28]"
              >
                Staff Portal
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* 2. EDITORIAL HERO SECTION */}
      <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-28 overflow-hidden bg-gradient-to-b from-[#FAF8F4] to-[#F3F1EB]/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <div className="inline-flex items-center gap-2 bg-[#F8EAE3] text-[#C76B4A] px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase border border-[#F2DFD6]">
            <Sparkles className="h-3.5 w-3.5" />
            Culinary Craftsmanship Since 2012
          </div>

          <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-[#292B28] leading-[1.15]">
            An Ode to Timeless <br />
            <span className="italic font-serif text-[#C76B4A]">Culinary Heritage</span> & Royal Spices
          </h1>

          <p className="text-sm sm:text-base text-[#777872] max-w-2xl mx-auto leading-relaxed">
            Welcome to {restaurant.name}. Every creation is an immersive symphony of slow-cooked dum
            biryanis, authentic clay-oven tandoor delicacies, and handcrafted regional curries.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <a href="#menu">
              <Button className="bg-[#C76B4A] hover:bg-[#AE593B] text-white font-semibold text-xs h-11 px-6 rounded-xl shadow-xs flex items-center gap-2">
                <Utensils className="h-4 w-4" /> Explore Digital Menu
              </Button>
            </a>
            <Button
              variant="outline"
              onClick={() => setReservationModalOpen(true)}
              className="bg-white hover:bg-[#FAF8F4] border-[#EAE7E0] text-[#292B28] font-semibold text-xs h-11 px-6 rounded-xl flex items-center gap-2"
            >
              <Calendar className="h-4 w-4 text-[#C76B4A]" /> Book Your Experience
            </Button>
          </div>
        </div>
      </section>

      {/* 3. CULINARY HERITAGE STORY */}
      <section id="story" className="py-16 sm:py-20 border-t border-[#EAE7E0] bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 rounded-2xl bg-[#FAF8F4] border border-[#EAE7E0] space-y-3">
            <div className="h-10 w-10 rounded-xl bg-[#F8EAE3] text-[#C76B4A] flex items-center justify-center font-bold">
              <Flame className="h-5 w-5" />
            </div>
            <h3 className="font-serif text-lg font-bold text-[#292B28]">Authentic Dum Cooking</h3>
            <p className="text-xs text-[#777872] leading-relaxed">
              Our signature Hyderabadi Dum Biryani is cooked for hours inside sealed earthen deghs with
              fragrant saffron, whole spices, and hand-aged Basmati rice.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#FAF8F4] border border-[#EAE7E0] space-y-3">
            <div className="h-10 w-10 rounded-xl bg-[#EEF1E9] text-[#66745B] flex items-center justify-center font-bold">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="font-serif text-lg font-bold text-[#292B28]">Clay-Oven Tandoori</h3>
            <p className="text-xs text-[#777872] leading-relaxed">
              Charcoal-fired traditional clay tandoors reach over 480°C, infusing kebabs and artisanal
              naans with signature smokiness and blistered crusts.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#FAF8F4] border border-[#EAE7E0] space-y-3">
            <div className="h-10 w-10 rounded-xl bg-[#EBF3FC] text-[#5185B8] flex items-center justify-center font-bold">
              <QrCode className="h-5 w-5" />
            </div>
            <h3 className="font-serif text-lg font-bold text-[#292B28]">Seamless Table Ordering</h3>
            <p className="text-xs text-[#777872] leading-relaxed">
              Guests enjoy instant contactless QR ordering straight from the table standee. Browse
              customizations, add items, and track live kitchen preparation.
            </p>
          </div>
        </div>
      </section>

      {/* 4. DIGITAL MENU EXPLORER */}
      <section id="menu" className="py-16 sm:py-24 border-t border-[#EAE7E0] bg-[#FAF8F4]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="text-center space-y-2">
            <span className="text-xs font-mono tracking-widest text-[#C76B4A] uppercase font-bold">
              Seasonal Offerings
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-normal text-[#292B28]">
              The Culinary Menu
            </h2>
            <p className="text-xs text-[#777872] max-w-lg mx-auto">
              Prepared to order using locally sourced ingredients, ground spices, and heritage culinary
              techniques.
            </p>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 text-xs font-semibold rounded-xl shrink-0 transition-all ${
                selectedCategory === 'all'
                  ? 'bg-[#C76B4A] text-white shadow-xs'
                  : 'bg-white text-[#777872] border border-[#EAE7E0] hover:bg-[#F3F1EB]'
              }`}
            >
              All Creations
            </button>
            {categories.map((cat: any) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(String(cat.id))}
                className={`px-4 py-2 text-xs font-semibold rounded-xl shrink-0 transition-all ${
                  selectedCategory === String(cat.id)
                    ? 'bg-[#C76B4A] text-white shadow-xs'
                    : 'bg-white text-[#777872] border border-[#EAE7E0] hover:bg-[#F3F1EB]'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Dishes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedItems.map((item: any) => {
              const isVeg = item.type === 'veg' || item.type === 'vegan';

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-[#EAE7E0] p-4 flex flex-col justify-between hover:border-[#C76B4A] transition-all shadow-xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div
                        className={`h-3 w-3 rounded-sm border flex items-center justify-center p-0.5 ${
                          isVeg ? 'border-[#39845C]' : 'border-[#C84D4D]'
                        }`}
                      >
                        <div
                          className={`h-1.5 w-1.5 rounded-full ${
                            isVeg ? 'bg-[#39845C]' : 'bg-[#C84D4D]'
                          }`}
                        />
                      </div>
                      <span className="text-[10px] text-[#777872] uppercase font-mono tracking-wider bg-[#F3F1EB] px-2 py-0.5 rounded">
                        {item.kitchen_station}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-[#292B28] leading-tight">{item.name}</h4>
                    {item.description && (
                      <p className="text-xs text-[#777872] line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#F1EEE8] flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-[#C76B4A]">
                        ₹{Number(item.base_price).toFixed(2)}
                      </span>
                      {item.variants?.length > 0 && (
                        <span className="text-[10px] text-[#777872] block">
                          {item.variants.length} portions available
                        </span>
                      )}
                    </div>

                    <Button
                      size="sm"
                      onClick={() => setReservationModalOpen(true)}
                      className="h-8 px-3 text-xs bg-[#FAF8F4] text-[#C76B4A] hover:bg-[#C76B4A] hover:text-white border border-[#EAE7E0]"
                    >
                      Taste in Dining
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. LOCATIONS & BRANCHES */}
      <section id="locations" className="py-16 sm:py-24 border-t border-[#EAE7E0] bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="text-center space-y-2">
            <span className="text-xs font-mono tracking-widest text-[#C76B4A] uppercase font-bold">
              Physical Dining
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-normal text-[#292B28]">
              Our Branch Locations
            </h2>
            <p className="text-xs text-[#777872]">
              Visit our flagship locations for full table service, private dining, and banqueting.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {branches.map((b: any) => (
              <div
                key={b.id}
                className="bg-[#FAF8F4] rounded-2xl border border-[#EAE7E0] p-6 space-y-4 hover:shadow-xs transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-serif text-xl font-bold text-[#292B28]">{b.name}</h3>
                    <span className="text-[11px] font-mono text-[#C76B4A] font-semibold">{b.code}</span>
                  </div>
                  <Badge variant="success" className="text-[10px]">
                    Open Today
                  </Badge>
                </div>

                <div className="space-y-2 text-xs text-[#777872]">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[#C76B4A] shrink-0" />
                    <span>
                      {b.address}, {b.city}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[#C76B4A] shrink-0" />
                    <span>
                      Daily Service: {b.opening_time || '11:00'} – {b.closing_time || '23:00'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-[#C76B4A] shrink-0" />
                    <span>{b.phone}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={() => {
                      setResBranchId(b.id);
                      setReservationModalOpen(true);
                    }}
                    className="w-full bg-white hover:bg-[#FAF8F4] text-[#C76B4A] border border-[#C76B4A] text-xs font-semibold h-9 rounded-xl"
                  >
                    Reserve Table at {b.name}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. FOOTER */}
      <footer className="border-t border-[#EAE7E0] bg-[#FAF8F4] py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#777872]">
          <div>
            <span className="font-serif font-bold text-sm text-[#292B28] block">
              {restaurant.name}
            </span>
            <p className="mt-0.5">© 2026 Restaurant OS. All rights reserved.</p>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/login" className="text-[#C76B4A] font-semibold hover:underline">
              Management Login
            </Link>
            <span>·</span>
            <Link href="/reserve" className="hover:text-[#292B28]">
              Table Bookings
            </Link>
            <span>·</span>
            <span>Privacy & Terms</span>
          </div>
        </div>
      </footer>

      {/* RESERVATION BOOKING MODAL */}
      {reservationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-[#EAE7E0] shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE7E0]">
              <div>
                <h3 className="font-serif text-xl font-bold text-[#292B28]">Reserve a Table</h3>
                <span className="text-xs text-[#777872]">Instant confirmation · Zero reservation fee</span>
              </div>
              <button
                onClick={() => setReservationModalOpen(false)}
                className="text-[#777872] hover:text-[#292B28]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {resError && (
              <div className="bg-[#FDF0F0] border border-[#F8DADA] p-2.5 rounded-xl text-xs text-[#C84D4D]">
                {resError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              {/* Branch Selector */}
              <div>
                <label className="font-semibold text-[#292B28] block mb-1">Select Branch</label>
                <select
                  value={resBranchId}
                  onChange={(e) => setResBranchId(Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-xl border border-[#EAE7E0] bg-white text-xs text-[#292B28]"
                >
                  {branches.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.city})
                    </option>
                  ))}
                </select>
              </div>

              {/* Guest Name & Phone */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-[#292B28] block mb-1">Your Name *</label>
                  <Input
                    required
                    placeholder="Aditya Verma"
                    value={resName}
                    onChange={(e) => setResName(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#292B28] block mb-1">Phone Number *</label>
                  <Input
                    required
                    placeholder="+91 99887 76655"
                    value={resPhone}
                    onChange={(e) => setResPhone(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="font-semibold text-[#292B28] block mb-1">Email (Optional)</label>
                <Input
                  type="email"
                  placeholder="aditya@example.com"
                  value={resEmail}
                  onChange={(e) => setResEmail(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              {/* Guests Count & Date & Time */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-semibold text-[#292B28] block mb-1">Guests</label>
                  <select
                    value={resGuests}
                    onChange={(e) => setResGuests(Number(e.target.value))}
                    className="w-full h-9 px-2 rounded-xl border border-[#EAE7E0] bg-white text-xs text-[#292B28]"
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
                    className="h-9 text-xs"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#292B28] block mb-1">Time</label>
                  <select
                    value={resTime}
                    onChange={(e) => setResTime(e.target.value)}
                    className="w-full h-9 px-2 rounded-xl border border-[#EAE7E0] bg-white text-xs text-[#292B28]"
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
                  Seating or Dietary Requests
                </label>
                <Input
                  placeholder="e.g. Window table, high chair, birthday celebration"
                  value={resNotes}
                  onChange={(e) => setResNotes(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <Button
              disabled={!resName || !resPhone || reservationMutation.isPending}
              onClick={() => reservationMutation.mutate()}
              className="w-full bg-[#C76B4A] hover:bg-[#AE593B] text-white text-xs font-semibold h-10 rounded-xl shadow-xs"
            >
              {reservationMutation.isPending ? 'Confirming Reservation...' : 'Confirm Table Booking'}
            </Button>
          </div>
        </div>
      )}

      {/* RESERVATION CONFIRMATION CARD MODAL */}
      {reservationSuccess && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-[#EAE7E0] shadow-2xl p-6 text-center space-y-4">
            <div className="h-12 w-12 bg-[#39845C]/10 text-[#39845C] rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-7 w-7" />
            </div>

            <div>
              <h3 className="font-serif text-xl font-bold text-[#292B28]">Reservation Confirmed!</h3>
              <p className="text-xs text-[#777872] mt-1">
                We look forward to welcoming you, <strong className="text-[#292B28]">{reservationSuccess.customer_name}</strong>.
              </p>
            </div>

            <div className="bg-[#FAF8F4] p-3 rounded-xl border border-[#EAE7E0] text-xs space-y-1.5 text-left">
              <div className="flex justify-between">
                <span className="text-[#777872]">Date & Time</span>
                <span className="font-semibold text-[#292B28]">
                  {reservationSuccess.reservation_date} at {reservationSuccess.reservation_time}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#777872]">Party Size</span>
                <span className="font-semibold text-[#292B28]">
                  {reservationSuccess.guest_count} Guests
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#777872]">Booking Status</span>
                <span className="font-bold text-[#39845C] uppercase text-[10px]">
                  {reservationSuccess.status}
                </span>
              </div>
            </div>

            <Button
              onClick={() => setReservationSuccess(null)}
              className="w-full bg-[#C76B4A] hover:bg-[#AE593B] text-white text-xs h-9 rounded-xl"
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
