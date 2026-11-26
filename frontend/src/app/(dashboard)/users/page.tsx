'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Users,
  Plus,
  Search,
  KeyRound,
  Edit,
  Trash2,
  Power,
  Shield,
  Building,
  GitBranch,
  X,
  CheckCircle2,
  UserCheck,
} from 'lucide-react';

export default function UsersManagementPage() {
  const queryClient = useQueryClient();
  const { currentUser, isSuperAdmin } = useAuthStore((s) => ({
    currentUser: s.user,
    isSuperAdmin: s.user?.is_super_admin ?? false,
  }));

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Waiter');
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState<number[]>([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState<number[]>([]);
  const [adminResetNewPassword, setAdminResetNewPassword] = useState('');

  // Fetch users
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users', search, roleFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (roleFilter) params.append('role', roleFilter);
      params.append('page', String(page));
      const res = await apiRequest(`users?${params.toString()}`);
      return res.data;
    },
  });

  // Fetch Restaurants for assignment
  const { data: restaurantsData } = useQuery({
    queryKey: ['assignment-restaurants'],
    queryFn: async () => {
      const res = await apiRequest('restaurants?per_page=100');
      return res.data?.data || [];
    },
  });

  // Fetch Roles list
  const { data: rolesData } = useQuery({
    queryKey: ['roles-list'],
    queryFn: async () => {
      const res = await apiRequest('roles');
      return res.data?.roles || [];
    },
  });

  const users = usersData?.data || [];
  const availableRestaurants = restaurantsData || [];
  const rolesList = rolesData || [];

  const openCreateModal = () => {
    setSelectedUser(null);
    setName('');
    setEmail('');
    setUsername('');
    setPhone('');
    setPassword('password123');
    setRole('Waiter');
    setSelectedRestaurantIds(availableRestaurants[0] ? [availableRestaurants[0].id] : []);
    setSelectedBranchIds([]);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (u: any) => {
    setSelectedUser(u);
    setName(u.name || '');
    setEmail(u.email || '');
    setUsername(u.username || '');
    setPhone(u.phone || '');
    setPassword('');
    setRole(u.roles?.[0]?.name || 'Waiter');
    setSelectedRestaurantIds(u.restaurants?.map((r: any) => r.id) || []);
    setSelectedBranchIds(u.branches?.map((b: any) => b.id) || []);
    setIsEditModalOpen(true);
  };

  const openResetPasswordModal = (u: any) => {
    setSelectedUser(u);
    setAdminResetNewPassword('');
    setIsResetPasswordModalOpen(true);
  };

  // Create User Mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('users', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          username: username || undefined,
          phone,
          password,
          role,
          restaurant_ids: selectedRestaurantIds,
          branch_ids: selectedBranchIds,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User account created successfully!');
      setIsCreateModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create user.');
    },
  });

  // Update User Mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name,
        email,
        username: username || undefined,
        phone,
        role,
        restaurant_ids: selectedRestaurantIds,
        branch_ids: selectedBranchIds,
      };
      if (password) payload.password = password;

      return await apiRequest(`users/${selectedUser.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User updated successfully!');
      setIsEditModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update user.');
    },
  });

  // Admin Direct Password Reset Mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`users/${selectedUser.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ new_password: adminResetNewPassword }),
      });
    },
    onSuccess: () => {
      toast.success(`Password reset for ${selectedUser?.name}!`);
      setIsResetPasswordModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to reset password.');
    },
  });

  // Toggle Active Status Mutation
  const toggleMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`users/${id}/toggle-status`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User status updated.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update user status.');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`users/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User removed successfully.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete user.');
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-bold text-2xl sm:text-3xl font-semibold text-[#252525]">
            User & Staff Management
          </h1>
          <p className="text-xs text-[#5A5D58]">
            Provision staff, managers, waiters, cashiers, and assign multi-restaurant access
          </p>
        </div>

        <Button onClick={openCreateModal} className="gap-2 shadow-xs">
          <Plus className="h-4 w-4" /> Add User
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8E928B]" />
          <input
            type="text"
            placeholder="Search by name, email, or username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-[10px] border border-black/[0.06] bg-white text-sm text-[#252525] placeholder:text-[#8E928B] outline-none focus:border-[#B4D58A]"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-10 px-3 rounded-[10px] border border-black/[0.06] bg-white text-xs font-medium text-[#252525] outline-none cursor-pointer"
        >
          <option value="">All Roles</option>
          {rolesList.map((r: any) => (
            <option key={r.id} value={r.name}>{r.name}</option>
          ))}
        </select>
      </div>

      {/* Users Table */}
      <Card className="border-black/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF9F6] border-b border-black/[0.06] text-[#5A5D58] uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Assigned Restaurants</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Last Login</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#5A5D58]">
                    Loading user directory...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#5A5D58]">
                    No users match your filters.
                  </td>
                </tr>
              ) : (
                users.map((u: any) => {
                  const roleName = u.roles?.[0]?.name || 'User';
                  const isCurrent = currentUser?.id === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-[#FAF9F6]/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-[#B4D58A]/20 text-[#B4D58A] font-semibold flex items-center justify-center shrink-0">
                            {u.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-semibold text-[#252525] block">{u.name}</span>
                            <span className="text-[11px] text-[#5A5D58] block">{u.email}</span>
                            {u.username && (
                              <span className="font-mono text-[10px] text-[#8E928B]">@{u.username}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            roleName === 'Super Admin'
                              ? 'default'
                              : roleName === 'Restaurant Admin'
                              ? 'secondary'
                              : roleName === 'Waiter'
                              ? 'warning'
                              : 'outline'
                          }
                          className="text-[10px] font-semibold"
                        >
                          {roleName}
                        </Badge>
                      </td>

                      <td className="py-3 px-4">
                        {roleName === 'Super Admin' ? (
                          <span className="text-[11px] font-medium text-[#B4D58A]">
                            Universal (All Restaurants)
                          </span>
                        ) : u.restaurants && u.restaurants.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {u.restaurants.map((rest: any) => (
                              <span
                                key={rest.id}
                                className="inline-block px-2 py-0.5 rounded bg-[#FAF9F6] border border-black/[0.06] text-[10px] font-medium text-[#252525]"
                              >
                                {rest.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[#8E928B]">None assigned</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <Badge variant={u.is_active ? 'success' : 'danger'} className="text-[10px]">
                          {u.is_active ? 'Active' : 'Deactivated'}
                        </Badge>
                      </td>

                      <td className="py-3 px-4 text-[#5A5D58] font-mono text-[11px]">
                        {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openResetPasswordModal(u)}
                            title="Reset Password"
                            className="p-1.5 rounded-lg border border-black/[0.06] text-[#5A5D58] hover:text-[#B4D58A] hover:bg-white transition-colors"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => openEditModal(u)}
                            title="Edit User"
                            className="p-1.5 rounded-lg border border-black/[0.06] text-[#5A5D58] hover:text-[#252525] hover:bg-white transition-colors"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            disabled={isCurrent}
                            onClick={() => toggleMutation.mutate(u.id)}
                            title={isCurrent ? 'Cannot deactivate self' : u.is_active ? 'Deactivate' : 'Activate'}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              isCurrent ? 'opacity-30 cursor-not-allowed' :
                              u.is_active
                                ? 'text-[#B4D58A] border-[#D5EAD9] bg-[#B4D58A]/20 hover:bg-[#D5EAD9]'
                                : 'text-[#8E928B] border-black/[0.06] bg-white hover:bg-[#F3DA8A]/25'
                            }`}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </button>
                          <button
                            disabled={isCurrent}
                            onClick={() => {
                              if (confirm(`Delete user "${u.name}"?`)) {
                                deleteMutation.mutate(u.id);
                              }
                            }}
                            title={isCurrent ? 'Cannot delete self' : 'Delete'}
                            className={`p-1.5 rounded-lg border border-black/[0.06] text-[#F2AFC0] hover:bg-[#F2AFC0]/20 hover:border-[#F8DADA] transition-colors ${
                              isCurrent ? 'opacity-30 cursor-not-allowed' : ''
                            }`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create / Edit Modal */}
      {(isCreateModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#252525]/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white border border-black/[0.06] shadow-xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <h2 className="font-bold text-xl font-semibold text-[#252525]">
                {isEditModalOpen ? 'Edit Staff Profile' : 'Create Staff User'}
              </h2>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                className="p-1.5 text-[#5A5D58] hover:text-[#252525] rounded-lg hover:bg-[#FAF9F6]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (isEditModalOpen) updateMutation.mutate();
                else createMutation.mutate();
              }}
              className="space-y-4"
            >
              <Input
                label="Full Name *"
                type="text"
                placeholder="Arun Kumar"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Email Address *"
                  type="email"
                  placeholder="arun@restaurant.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Input
                  label="Username"
                  type="text"
                  placeholder="arun_waiter"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Phone Number"
                  type="text"
                  placeholder="+91 98765 44444"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#5A5D58]">
                    User Role *
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full h-10 px-3 rounded-[10px] border border-black/[0.06] bg-white text-sm text-[#252525] outline-none focus:border-[#B4D58A]"
                    required
                  >
                    {rolesList.map((r: any) => (
                      <option key={r.id} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {isCreateModalOpen && (
                <Input
                  label="Initial Password *"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              )}

              {/* Multi-Restaurant Assignment */}
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#5A5D58]">
                  Assigned Restaurants
                </label>
                <p className="text-[11px] text-[#8E928B]">Select restaurants this user is authorized to access</p>
                <div className="max-h-32 overflow-y-auto p-2 rounded-xl border border-black/[0.06] bg-[#FAF9F6] space-y-1">
                  {availableRestaurants.map((rest: any) => {
                    const checked = selectedRestaurantIds.includes(rest.id);
                    return (
                      <label key={rest.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-white text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRestaurantIds([...selectedRestaurantIds, rest.id]);
                            } else {
                              setSelectedRestaurantIds(selectedRestaurantIds.filter((id) => id !== rest.id));
                            }
                          }}
                          className="rounded border-black/[0.06] text-[#B4D58A] focus:ring-[#B4D58A]"
                        />
                        <span className="font-medium text-[#252525]">{rest.name}</span>
                        <span className="text-[10px] text-[#5A5D58]">({rest.slug})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-black/[0.06]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setIsEditModalOpen(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={createMutation.isPending || updateMutation.isPending}
                >
                  {isEditModalOpen ? 'Save Changes' : 'Create User'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Direct Password Reset Modal */}
      {isResetPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#252525]/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white border border-black/[0.06] shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-black/[0.06]">
              <h2 className="font-bold text-lg font-semibold text-[#252525]">Reset Password</h2>
              <button onClick={() => setIsResetPasswordModalOpen(false)}>
                <X className="h-5 w-5 text-[#5A5D58]" />
              </button>
            </div>
            <p className="text-xs text-[#5A5D58]">
              Set a new password directly for <strong>{selectedUser?.name}</strong>.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                resetPasswordMutation.mutate();
              }}
              className="space-y-3"
            >
              <Input
                label="New Password"
                type="password"
                placeholder="At least 8 characters"
                value={adminResetNewPassword}
                onChange={(e) => setAdminResetNewPassword(e.target.value)}
                required
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsResetPasswordModalOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" isLoading={resetPasswordMutation.isPending}>
                  Set Password
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
