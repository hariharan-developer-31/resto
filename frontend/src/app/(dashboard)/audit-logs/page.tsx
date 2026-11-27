'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModalPortal } from '@/components/ui/modal-portal';
import { History, ShieldAlert, ArrowLeft, RefreshCw, Filter, Eye, X } from 'lucide-react';
import Link from 'next/link';

export default function AuditLogsPage() {
  const activeRestaurant = useAuthStore((s) => s.activeRestaurant);
  const isSuperAdmin = useAuthStore((s) => s.user?.is_super_admin ?? false);
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['audit-logs', activeRestaurant?.id, isSuperAdmin, actionFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (actionFilter) params.append('action', actionFilter);
      if (!isSuperAdmin && activeRestaurant?.id) {
        params.append('restaurant_id', String(activeRestaurant.id));
      }
      params.append('page', String(page));

      const res = await apiRequest(`audit-logs?${params.toString()}`, {
        restaurantId: activeRestaurant?.id,
      });
      return res.data;
    },
  });

  const logs = data?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="text-[#5A5D58] hover:text-[#252525]">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="font-bold text-2xl font-semibold text-[#252525]">
              System Audit Trail
            </h1>
          </div>
          <p className="text-xs text-[#5A5D58]">
            Cryptographically tracked security, authentication, and administrative actions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Filter action (e.g. auth.login)..."
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="w-56 h-9 text-xs"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Table Card */}
      <Card className="border-black/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-xs">
            <thead className="bg-[#FAF9F6] border-b border-black/[0.06] text-[#5A5D58] uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Tenant Scope</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#5A5D58]">
                    Loading audit trail records...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#C94A6A]">
                    {(error as any)?.message || 'Failed to load audit logs. You may not have permission to view this trail.'}
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#5A5D58]">
                    No audit log events match this filter.
                  </td>
                </tr>
              ) : (
                logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-[#FAF9F6]/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-[#B4D58A]">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#252525]">
                      {log.user?.name || log.user?.email || 'System'}
                    </td>
                    <td className="py-3 px-4 text-[#5A5D58]">
                      {log.restaurant?.name || 'Global'} {log.branch?.name ? `(${log.branch.name})` : ''}
                    </td>
                    <td className="py-3 px-4 font-mono text-[#5A5D58]">
                      {log.ip_address || '127.0.0.1'}
                    </td>
                    <td className="py-3 px-4 text-[#5A5D58]">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      {log.new_values || log.old_values ? (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center gap-1 font-mono text-[10px] text-[#252525] bg-[#F3DA8A]/25 hover:bg-[#F3DA8A]/40 px-2 py-1 rounded transition-colors cursor-pointer"
                        >
                          <Eye className="h-3 w-3" />
                          Inspect JSON
                        </button>
                      ) : (
                        <span className="text-[#8E928B]">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {data && (
          <div className="flex items-center justify-between p-4 border-t border-black/[0.06] bg-[#FAF9F6]/40 text-xs">
            <span className="text-[#5A5D58]">
              Showing {data.from || 0} to {data.to || 0} of {data.total || 0} events
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= (data.last_page || 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Audit Payload Diff Modal */}
      {selectedLog && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#252525]/60 backdrop-blur-sm p-4">
            <div className="flex min-h-full items-center justify-center py-2 sm:py-6" onClick={(e) => { if (e.target === e.currentTarget) setSelectedLog(null); }}>
              <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white border border-black/[0.06] shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <div>
                <h2 className="font-bold text-lg text-[#252525] font-mono">{selectedLog.action}</h2>
                <p className="text-xs text-[#5A5D58]">
                  By {selectedLog.user?.name || selectedLog.user?.email || 'System'} •{' '}
                  {new Date(selectedLog.created_at).toLocaleString()} • IP {selectedLog.ip_address || '127.0.0.1'}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 text-[#5A5D58] hover:text-[#252525] rounded-lg hover:bg-[#FAF9F6]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedLog.old_values && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5A5D58]">
                    Previous Values
                  </span>
                  <pre className="p-3 rounded-xl bg-[#FAF9F6] border border-black/[0.06] text-[11px] font-mono text-[#252525] overflow-x-auto max-h-80">
                    {JSON.stringify(selectedLog.old_values, null, 2)}
                  </pre>
                </div>
              )}
              {selectedLog.new_values && (
                <div className={`space-y-1.5 ${!selectedLog.old_values ? 'md:col-span-2' : ''}`}>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5A5D58]">
                    New Values
                  </span>
                  <pre className="p-3 rounded-xl bg-[#FAF9F6] border border-black/[0.06] text-[11px] font-mono text-[#252525] overflow-x-auto max-h-80">
                    {JSON.stringify(selectedLog.new_values, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-black/[0.06]">
              <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      </div>
      </ModalPortal>
      )}
    </div>
  );
}
