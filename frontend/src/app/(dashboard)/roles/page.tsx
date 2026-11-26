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
  ShieldCheck,
  Plus,
  Save,
  Check,
  X,
  Lock,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';

export default function RolesPermissionsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.is_super_admin ?? false;

  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [activePermissions, setActivePermissions] = useState<string[]>([]);
  const [isCreateRoleModalOpen, setIsCreateRoleModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');

  // Fetch roles & grouped permissions
  const { data, isLoading } = useQuery({
    queryKey: ['roles-matrix'],
    queryFn: async () => {
      const res = await apiRequest('roles');
      return res.data;
    },
  });

  const roles = data?.roles || [];
  const groupedPermissions: Record<string, any[]> = data?.grouped_permissions || {};

  // When roles load or selected role changes, set active permissions
  const currentRole = roles.find((r: any) => r.id === selectedRoleId) || roles[0];

  React.useEffect(() => {
    if (currentRole) {
      if (!selectedRoleId) {
        setSelectedRoleId(currentRole.id);
      }
      setActivePermissions(currentRole.permissions || []);
    }
  }, [currentRole, selectedRoleId]);

  // Update Role Permissions Mutation
  const updatePermissionsMutation = useMutation({
    mutationFn: async () => {
      if (!currentRole) return;
      return await apiRequest(`roles/${currentRole.id}`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: activePermissions }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles-matrix'] });
      toast.success(`Permissions updated for role: ${currentRole?.name}`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update role permissions.');
    },
  });

  // Create Role Mutation
  const createRoleMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('roles', {
        method: 'POST',
        body: JSON.stringify({ name: newRoleName, permissions: [] }),
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['roles-matrix'] });
      toast.success(`Custom role "${newRoleName}" created!`);
      setNewRoleName('');
      setIsCreateRoleModalOpen(false);
      if (res.data?.id) setSelectedRoleId(res.data.id);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create role.');
    },
  });

  const togglePermission = (permName: string) => {
    if (currentRole?.name === 'Super Admin') {
      toast.info('Super Admin role inherently holds all platform permissions.');
      return;
    }
    if (activePermissions.includes(permName)) {
      setActivePermissions(activePermissions.filter((p) => p !== permName));
    } else {
      setActivePermissions([...activePermissions, permName]);
    }
  };

  const selectAllInGroup = (perms: any[]) => {
    if (currentRole?.name === 'Super Admin') return;
    const permNames = perms.map((p) => p.name);
    const hasAll = permNames.every((p) => activePermissions.includes(p));

    if (hasAll) {
      setActivePermissions(activePermissions.filter((p) => !permNames.includes(p)));
    } else {
      const merged = Array.from(new Set([...activePermissions, ...permNames]));
      setActivePermissions(merged);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-bold text-2xl sm:text-3xl font-semibold text-[#252525]">
            Roles & Permission Matrix
          </h1>
          <p className="text-xs text-[#5A5D58]">
            Granular access control matrix enforcing backend policies across all 14 functional modules
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <Button
              onClick={() => setIsCreateRoleModalOpen(true)}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Plus className="h-4 w-4" /> Create Custom Role
            </Button>
          )}

          <Button
            onClick={() => updatePermissionsMutation.mutate()}
            disabled={currentRole?.name === 'Super Admin' || updatePermissionsMutation.isPending}
            size="sm"
            className="gap-2 shadow-xs"
          >
            <Save className="h-4 w-4" /> Save Changes
          </Button>
        </div>
      </div>

      {/* Role Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-black/[0.06]">
        {roles.map((r: any) => {
          const isSelected = r.id === (currentRole?.id ?? selectedRoleId);
          return (
            <button
              key={r.id}
              onClick={() => {
                setSelectedRoleId(r.id);
                setActivePermissions(r.permissions || []);
              }}
              className={`px-3.5 py-2 rounded-[10px] text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#B4D58A] text-white shadow-xs'
                  : 'bg-white border border-black/[0.06] text-[#5A5D58] hover:bg-[#FAF9F6] hover:text-[#252525]'
              }`}
            >
              {r.name}
              {r.is_system_role && (
                <span className={`ml-1.5 text-[10px] opacity-75 ${isSelected ? 'text-white' : 'text-[#8E928B]'}`}>
                  (System)
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Current Role Details & Permission Matrix */}
      {currentRole?.name === 'Super Admin' && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-[#B4D58A]/20 border border-[#F2DFD6] text-xs text-[#9EC271]">
          <Info className="h-5 w-5 shrink-0" />
          <span>
            The <strong>Super Admin</strong> role has universal system authorization across all restaurants, branches, financial records, and operational functions by architecture design.
          </span>
        </div>
      )}

      {/* Grouped Permission Accordion / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {Object.entries(groupedPermissions).map(([groupTitle, perms]) => {
          const hasAllInGroup = perms.every((p) => activePermissions.includes(p.name));
          const hasSomeInGroup = perms.some((p) => activePermissions.includes(p.name));

          return (
            <Card key={groupTitle} className="border-black/[0.06] hover:border-[#D8D4CA] transition-all">
              <CardHeader className="p-4 pb-2 border-b border-black/[0.04] flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">{groupTitle}</CardTitle>
                  <CardDescription className="text-[11px]">
                    {perms.length} configurable operations
                  </CardDescription>
                </div>

                {currentRole?.name !== 'Super Admin' && (
                  <button
                    type="button"
                    onClick={() => selectAllInGroup(perms)}
                    className="text-[11px] font-medium text-[#B4D58A] hover:text-[#9EC271] cursor-pointer"
                  >
                    {hasAllInGroup ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </CardHeader>

              <CardContent className="p-4 space-y-2">
                {perms.map((perm) => {
                  const isChecked = currentRole?.name === 'Super Admin' || activePermissions.includes(perm.name);

                  return (
                    <label
                      key={perm.id}
                      className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                        isChecked ? 'bg-[#FAF9F6] text-[#252525]' : 'text-[#5A5D58] hover:bg-[#FAF9F6]/50'
                      }`}
                    >
                      <span className="font-medium">{perm.label}</span>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={currentRole?.name === 'Super Admin'}
                        onChange={() => togglePermission(perm.name)}
                        className="rounded border-black/[0.06] text-[#B4D58A] focus:ring-[#B4D58A] cursor-pointer"
                      />
                    </label>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create Custom Role Modal */}
      {isCreateRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#252525]/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white border border-black/[0.06] shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-black/[0.06]">
              <h2 className="font-bold text-lg font-semibold text-[#252525]">Add Custom Role</h2>
              <button onClick={() => setIsCreateRoleModalOpen(false)}>
                <X className="h-5 w-5 text-[#5A5D58]" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createRoleMutation.mutate();
              }}
              className="space-y-4"
            >
              <Input
                label="Role Title *"
                type="text"
                placeholder="e.g. Floor Captain, Inventory Auditor"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                required
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateRoleModalOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" isLoading={createRoleMutation.isPending}>
                  Create Role
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
