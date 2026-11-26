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
  Flame,
  Award,
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
  const { data: publicData } = useQuery({
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
    <div className="min-h-screen bg-white text-[#252525] font-poppins selection:bg-[#C2B0DC] selection:text-white">
      {/* 1. SIGNATURE HERO SECTION (Soft Lilac: #C2B0DC) */}
      <section className="relative min-h-screen flex flex-col justify-between bg-[#C2B0DC] text-white px-6 sm:px-12 pt-7 pb-16 overflow-hidden">
        {/* Subtle decorative floating spheres */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -left-24 w-80 h-80 rounded-full bg-[#F2AFC0]/20 blur-2xl pointer-events-none" />

        {/* Minimal Header */}
        <header className="relative z-20 flex items-center justify-between w-full max-w-7xl mx-auto">
          {/* Brand Name using Baloo 2 ExtraBold */}
          <Link href="/" className="font-baloo text-2xl sm:text-3xl font-extrabold tracking-tight text-white hover:opacity-90 transition-opacity">
            {restaurant.name}
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-white/90">
            <a href="#story" className="nav-link hover:text-white">
              Heritage
            </a>
            <a href="#menu" className="nav-link hover:text-white">
              Digital Menu
            </a>
            <a href="#locations" className="nav-link hover:text-white">
              Branches
            </a>
            <Link href="/reserve" className="nav-link hover:text-white">
              Reservations
            </Link>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setReservationModalOpen(true)}
              variant="white"
              size="default"
              className="text-xs"
            >
              Reserve Table
            </Button>
            <Link href="/login">
              <Button
                variant="outline"
                size="default"
                className="text-xs"
              >
                Staff Portal
              </Button>
            </Link>
          </div>
        </header>

        {/* Central Visual Composition */}
        <div className="relative z-10 my-auto py-12 max-w-5xl mx-auto text-center space-y-8 animate-slide-up">
          {/* Eyebrow Chip */}
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-semibold uppercase tracking-widest shadow-xs">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Royal Flavors · Handcrafted Dum Heritage</span>
          </div>

          {/* Oversized Signature Typography */}
          <h1 className="font-bold text-4xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tight leading-[0.98] text-white">
            CULINARY ARTISTRY <br />
            <span className="font-extrabold text-white opacity-95">FOR THE SOUL</span>
          </h1>

          <p className="text-base sm:text-lg text-white/90 max-w-2xl mx-auto font-medium leading-relaxed">
            Every creation is an immersive symphony of slow-cooked earthen biryanis, clay-oven tandoor delicacies, and handcrafted heritage curries.
          </p>

          {/* CTAs */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <a href="#menu">
              <Button
                variant="white"
                size="lg"
                className="shadow-[0_14px_40px_rgba(60,40,80,0.22)]"
              >
                Explore Digital Menu
              </Button>
            </a>
            <Button
              variant="outline"
              size="lg"
              onClick={() => setReservationModalOpen(true)}
            >
              Book Your Table
            </Button>
          </div>
        </div>

        {/* Floating Layered Feature Pills */}
        <div className="relative z-10 max-w-5xl mx-auto w-full grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
          <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 shadow-[0_12px_36px_rgba(60,40,80,0.2)] text-[#252525] flex items-center gap-4 animate-float-slow">
            <div className="h-12 w-12 rounded-2xl bg-[#F3DA8A] flex items-center justify-center text-[#252525] shrink-0 font-bold">
              <Flame className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">Clay Oven Tandoor</p>
              <p className="text-xs text-[#5A5D58] mt-0.5">Fired at 480°C with charcoal</p>
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 shadow-[0_12px_36px_rgba(60,40,80,0.2)] text-[#252525] flex items-center gap-4 animate-float-medium">
            <div className="h-12 w-12 rounded-2xl bg-[#B4D58A] flex items-center justify-center text-[#252525] shrink-0 font-bold">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">Slow-Cooked Dum</p>
              <p className="text-xs text-[#5A5D58] mt-0.5">Aged basmati & royal saffron</p>
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 shadow-[0_12px_36px_rgba(60,40,80,0.2)] text-[#252525] flex items-center gap-4 animate-float-gentle">
            <div className="h-12 w-12 rounded-2xl bg-[#F2AFC0] flex items-center justify-center text-white shrink-0 font-bold">
              <QrCode className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">Instant QR Order</p>
              <p className="text-xs text-[#5A5D58] mt-0.5">Contactless table experience</p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. CULINARY HERITAGE STORY (Soft Mint Green: #B4D58A) */}
      <section id="story" className="py-24 sm:py-32 bg-[#B4D58A] px-6 sm:px-12 relative overflow-hidden">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <Badge variant="white" className="uppercase tracking-widest text-[11px] py-1 px-4">
              Our Culinary Philosophy
            </Badge>
            <h2 className="font-bold text-3xl sm:text-5xl lg:text-6xl text-[#252525] tracking-tight">
              TRADITION HONORED IN EVERY DISH
            </h2>
            <p className="text-base text-[#252525]/80 font-medium leading-relaxed">
              We blend heritage royal recipes with modern kitchen precision to deliver an unforgettable fine dining experience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-3xl p-8 shadow-[0_14px_40px_rgba(60,40,80,0.14)] space-y-4 hover:-translate-y-1.5 transition-transform">
              <div className="h-14 w-14 rounded-2xl bg-[#C2B0DC] text-white flex items-center justify-center font-bold shadow-xs">
                <Flame className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-[#252525]">Authentic Dum Cooking</h3>
              <p className="text-sm text-[#5A5D58] leading-relaxed">
                Our signature Hyderabadi Dum Biryani is sealed in earthen deghs and slow-cooked over smouldering charcoal with saffron and whole spices.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-8 shadow-[0_14px_40px_rgba(60,40,80,0.14)] space-y-4 hover:-translate-y-1.5 transition-transform">
              <div className="h-14 w-14 rounded-2xl bg-[#F3DA8A] text-[#252525] flex items-center justify-center font-bold shadow-xs">
                <Sparkles className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-[#252525]">Clay-Oven Tandoori</h3>
              <p className="text-sm text-[#5A5D58] leading-relaxed">
                Traditional clay tandoors reach over 480°C, infusing kebabs and artisanal breads with authentic charred smokiness and tenderness.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-8 shadow-[0_14px_40px_rgba(60,40,80,0.14)] space-y-4 hover:-translate-y-1.5 transition-transform">
              <div className="h-14 w-14 rounded-2xl bg-[#F2AFC0] text-white flex items-center justify-center font-bold shadow-xs">
                <QrCode className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-[#252525]">Seamless Table QR Ordering</h3>
              <p className="text-sm text-[#5A5D58] leading-relaxed">
                Dine-in guests scan the table QR code to browse customizations, order directly, and follow live kitchen status with zero friction.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. DIGITAL MENU CATALOG (Butter Yellow: #F3DA8A) */}
      <section id="menu" className="py-24 sm:py-32 bg-[#F3DA8A] px-6 sm:px-12 relative">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <Badge variant="white" className="uppercase tracking-widest text-[11px] py-1 px-4">
              Seasonal Selections
            </Badge>
            <h2 className="font-bold text-3xl sm:text-5xl lg:text-6xl text-[#252525] tracking-tight">
              THE ARTISANAL MENU
            </h2>
            <p className="text-base text-[#252525]/80 font-medium">
              Prepared to order using locally sourced ingredients, ground spices, and heritage culinary techniques.
            </p>
          </div>

          {/* Category Pills */}
          <div className="flex items-center justify-center gap-3 overflow-x-auto pb-4">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-2xl shrink-0 transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-white text-[#252525] shadow-[0_8px_24px_rgba(60,40,80,0.18)] scale-105'
                  : 'bg-white/50 text-[#252525] hover:bg-white/80'
              }`}
            >
              All Creations
            </button>
            {categories.map((cat: any) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(String(cat.id))}
                className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-2xl shrink-0 transition-all cursor-pointer ${
                  selectedCategory === String(cat.id)
                    ? 'bg-white text-[#252525] shadow-[0_8px_24px_rgba(60,40,80,0.18)] scale-105'
                    : 'bg-white/50 text-[#252525] hover:bg-white/80'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Dishes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedItems.map((item: any) => {
              const isVeg = item.type === 'veg' || item.type === 'vegan';

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-3xl p-6 flex flex-col justify-between shadow-[0_12px_36px_rgba(60,40,80,0.1)] hover:-translate-y-1 transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div
                        className={`h-4 w-4 rounded-md border flex items-center justify-center p-0.5 ${
                          isVeg ? 'border-[#B4D58A]' : 'border-[#F2AFC0]'
                        }`}
                      >
                        <div
                          className={`h-2 w-2 rounded-full ${
                            isVeg ? 'bg-[#B4D58A]' : 'bg-[#F2AFC0]'
                          }`}
                        />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-[#C2B0DC]/20 text-[#252525] px-2.5 py-1 rounded-full">
                        {item.kitchen_station}
                      </span>
                    </div>

                    <h4 className="font-bold text-base text-[#252525] leading-snug">{item.name}</h4>
                    {item.description && (
                      <p className="text-xs text-[#5A5D58] line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-black/[0.04] flex items-center justify-between">
                    <div>
                      <span className="text-base font-extrabold text-[#252525]">
                        ₹{Number(item.base_price).toFixed(2)}
                      </span>
                      {item.variants?.length > 0 && (
                        <span className="text-[10px] text-[#5A5D58] block mt-0.5 font-medium">
                          {item.variants.length} options available
                        </span>
                      )}
                    </div>

                    <Button
                      size="sm"
                      variant="butter"
                      onClick={() => setReservationModalOpen(true)}
                      className="text-xs rounded-xl"
                    >
                      Dine In
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. PHYSICAL BRANCH LOCATIONS (Pastel Pink: #F2AFC0) */}
      <section id="locations" className="py-24 sm:py-32 bg-[#F2AFC0] px-6 sm:px-12 relative">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <Badge variant="white" className="uppercase tracking-widest text-[11px] py-1 px-4">
              Physical Spaces
            </Badge>
            <h2 className="font-bold text-3xl sm:text-5xl lg:text-6xl text-white tracking-tight">
              OUR DINING BRANCHES
            </h2>
            <p className="text-base text-white/90 font-medium">
              Visit our flagship destinations for full table dining, private banquets, and master tastings.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {branches.map((b: any) => (
              <div
                key={b.id}
                className="bg-white rounded-3xl p-8 space-y-6 shadow-[0_14px_40px_rgba(60,40,80,0.16)] hover:-translate-y-1.5 transition-transform"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-[#252525]">{b.name}</h3>
                    <span className="text-xs font-bold text-[#C2B0DC] block mt-0.5">{b.code}</span>
                  </div>
                  <Badge variant="mint" className="text-xs font-bold">
                    Open Today
                  </Badge>
                </div>

                <div className="space-y-3 text-xs text-[#5A5D58]">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-[#C2B0DC] shrink-0" />
                    <span>
                      {b.address}, {b.city}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-[#B4D58A] shrink-0" />
                    <span>
                      Daily Service: {b.opening_time || '11:00'} – {b.closing_time || '23:00'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-[#F3DA8A] shrink-0" />
                    <span>{b.phone}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={() => {
                      setResBranchId(b.id);
                      setReservationModalOpen(true)}
                    }
                    variant="lilac"
                    size="default"
                    className="w-full text-xs"
                  >
                    Reserve Table at {b.name}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. MINIMAL FOOTER */}
      <footer className="bg-white py-14 px-6 sm:px-12 border-t border-black/[0.04]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-[#5A5D58]">
          <div className="flex items-center gap-3">
            <span className="font-baloo text-xl font-extrabold text-[#252525]">
              {restaurant.name}
            </span>
            <span className="text-xs text-[#8E928B]">© 2026 Restaurant OS. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6 font-semibold text-xs uppercase tracking-wider">
            <Link href="/login" className="text-[#252525] hover:text-[#C2B0DC] transition-colors">
              Staff Portal
            </Link>
            <Link href="/reserve" className="text-[#252525] hover:text-[#C2B0DC] transition-colors">
              Table Reservations
            </Link>
            <span className="text-[#8E928B]">Terms & Privacy</span>
          </div>
        </div>
      </footer>

      {/* RESERVATION BOOKING MODAL */}
      {reservationModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#252525]/30 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-[0_20px_60px_rgba(60,40,80,0.25)] p-8 space-y-6 animate-slide-up">
            <div className="flex items-center justify-between pb-4 border-b border-black/[0.06]">
              <div>
                <h3 className="font-bold text-2xl text-[#252525]">Reserve a Table</h3>
                <span className="text-xs text-[#5A5D58]">Instant confirmation · Zero reservation fee</span>
              </div>
              <button
                onClick={() => setReservationModalOpen(false)}
                className="p-2 text-[#5A5D58] hover:text-[#252525] hover:bg-black/5 rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {resError && (
              <div className="bg-[#F2AFC0]/20 border border-[#F2AFC0] p-3 rounded-2xl text-xs text-[#252525] font-semibold">
                {resError}
              </div>
            )}

            <div className="space-y-4 text-xs">
              {/* Branch Selector */}
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

              {/* Guest Name & Phone */}
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Your Name *"
                  required
                  placeholder="Aditya Verma"
                  value={resName}
                  onChange={(e) => setResName(e.target.value)}
                />
                <Input
                  label="Phone Number *"
                  required
                  placeholder="+91 98765 00000"
                  value={resPhone}
                  onChange={(e) => setResPhone(e.target.value)}
                />
              </div>

              {/* Guests Count & Date */}
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
                    {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? 'Guest' : 'Guests'}
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
                  Reservation Time *
                </label>
                <select
                  value={resTime}
                  onChange={(e) => setResTime(e.target.value)}
                  className="w-full h-12 px-4 rounded-2xl border border-black/[0.08] bg-white text-sm text-[#252525] outline-none focus:border-[#C2B0DC] focus:ring-4 focus:ring-[#C2B0DC]/20 font-medium"
                >
                  {['12:00', '12:30', '13:00', '13:30', '19:00', '19:30', '20:00', '20:30', '21:00'].map(
                    (t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* Special Requests */}
              <Input
                label="Special Requests (Optional)"
                placeholder="Window seat, anniversary celebration..."
                value={resNotes}
                onChange={(e) => setResNotes(e.target.value)}
              />
            </div>

            <Button
              onClick={() => reservationMutation.mutate()}
              isLoading={reservationMutation.isPending}
              variant="lilac"
              size="lg"
              className="w-full"
            >
              Confirm Reservation
            </Button>
          </div>
        </div>
      )}

      {/* RESERVATION SUCCESS CONFIRMATION MODAL */}
      {reservationSuccess && (
        <div className="fixed inset-0 z-50 bg-[#252525]/30 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-[0_20px_60px_rgba(60,40,80,0.25)] p-8 text-center space-y-5 animate-slide-up">
            <div className="h-16 w-16 rounded-full bg-[#B4D58A] text-[#252525] flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <h3 className="text-2xl font-bold text-[#252525]">Table Reserved!</h3>
            <p className="text-sm text-[#5A5D58]">
              Your table booking code is{' '}
              <span className="font-extrabold text-[#252525] bg-[#F3DA8A]/40 px-2 py-0.5 rounded-lg">
                {reservationSuccess.booking_code || 'RES-CONFIRMED'}
              </span>
              . We look forward to serving you!
            </p>

            <Button
              variant="mint"
              size="default"
              onClick={() => setReservationSuccess(null)}
              className="w-full text-xs font-bold"
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
