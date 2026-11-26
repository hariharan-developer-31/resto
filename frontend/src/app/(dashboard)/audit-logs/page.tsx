'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { History, ShieldAlert, ArrowLeft, RefreshCw, Filter } from 'lucide-react';
import Link from 'next/link';

export default function AuditLogsPage() {
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['audit-logs', actionFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (actionFilter) params.append('action', actionFilter);
      params.append('page', String(page));

      const res = await apiRequest(`audit-logs?${params.toString()}`);
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
            <Link href="/dashboard" className="text-[#777872] hover:text-[#292B28]">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="font-serif text-2xl font-semibold text-[#292B28]">
              System Audit Trail
            </h1>
          </div>
          <p className="text-xs text-[#777872]">
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
      <Card className="border-[#EAE7E0] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF8F4] border-b border-[#EAE7E0] text-[#777872] uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Tenant Scope</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1EEE8]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#777872]">
                    Loading audit trail records...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#777872]">
                    No audit log events match this filter.
                  </td>
                </tr>
              ) : (
                logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-[#FAF8F4]/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-[#C76B4A]">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#292B28]">
                      {log.user?.name || log.user?.email || 'System'}
                    </td>
                    <td className="py-3 px-4 text-[#777872]">
                      {log.restaurant?.name || 'Global'} {log.branch?.name ? `(${log.branch.name})` : ''}
                    </td>
                    <td className="py-3 px-4 font-mono text-[#777872]">
                      {log.ip_address || '127.0.0.1'}
                    </td>
                    <td className="py-3 px-4 text-[#777872]">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      {log.new_values ? (
                        <span className="font-mono text-[10px] text-[#292B28] bg-[#F3F1EB] px-1.5 py-0.5 rounded">
                          {JSON.stringify(log.new_values).substring(0, 40)}...
                        </span>
                      ) : (
                        <span className="text-[#A2A29A]">—</span>
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
          <div className="flex items-center justify-between p-4 border-t border-[#EAE7E0] bg-[#FAF8F4]/40 text-xs">
            <span className="text-[#777872]">
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
    </div>
  );
}
