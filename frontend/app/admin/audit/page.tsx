'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/components/AuthProvider';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';
import { AuditEntry } from '@/lib/types';

interface AuditLogEntry extends AuditEntry {
  incident_id: number;
}

export default function AuditLogPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 20;

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchLogs(0);
  }, [user, authLoading, router]);

  const fetchLogs = async (newSkip: number) => {
    setLoading(true);
    try {
      const res = await api.get<{ logs: AuditLogEntry[] }>(
        `/api/admin/audit-logs?skip=${newSkip}&limit=${limit}`
      );
      const data = res.data.logs;
      if (newSkip === 0) {
        setEntries(data);
      } else {
        setEntries(prev => [...prev, ...data]);
      }
      setHasMore(data.length === limit);
      setSkip(newSkip);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => fetchLogs(skip + limit);
  const loadPrev = () => fetchLogs(Math.max(0, skip - limit));

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button */}
        <button
          onClick={() => router.push('/admin')}
          className="text-sm text-gray-500 hover:text-indigo-600 flex items-center gap-1 mb-5"
        >
          ← Back to Dashboard
        </button>

        {/* Banner */}
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-6 flex items-center gap-3">
          <span className="text-2xl">🔒</span>
          <div>
            <p className="font-semibold text-amber-800">Permanent Read-Only Audit Trail</p>
            <p className="text-sm text-amber-700">This log cannot be modified. All actions are recorded automatically.</p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <span className="text-sm text-gray-500">Showing {skip + 1}–{skip + entries.length} entries</span>
        </div>

        {loading && entries.length === 0 ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Incident ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status Change</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No audit entries found</td>
                    </tr>
                  ) : (
                    entries.map(entry => (
                      <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-indigo-600">
                          #{entry.incident_id}
                        </td>
                        <td className="px-4 py-3 text-gray-700 font-medium">{entry.action}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded font-medium text-xs">{entry.actor_username}</span>
                        </td>
                        <td className="px-4 py-3">
                          {entry.old_status || entry.new_status ? (
                            <span className="text-xs flex items-center gap-1">
                              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{entry.old_status || '—'}</span>
                              <span className="text-gray-400">→</span>
                              <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded font-medium">{entry.new_status || '—'}</span>
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{new Date(entry.timestamp).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-4 border-t border-gray-200 flex items-center justify-between">
              <button
                onClick={loadPrev}
                disabled={skip === 0 || loading}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Previous
              </button>
              <span className="text-sm text-gray-500">Page {Math.floor(skip / limit) + 1}</span>
              <button
                onClick={loadMore}
                disabled={!hasMore || loading}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

