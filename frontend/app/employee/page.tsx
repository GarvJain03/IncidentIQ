"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@/components/AuthProvider";
import Navbar from "@/components/Navbar";
import { StatusBadge, PriorityBadge } from "@/components/Badges";
import api from "@/lib/api";
import { Incident, Notification } from "@/lib/types";

export default function EmployeePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(
    null,
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.role !== "EMPLOYEE") {
      router.push("/dashboard");
      return;
    }
    fetchData();
  }, [user, authLoading, router]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [incRes, notifRes] = await Promise.all([
        api.get("/api/incidents"),
        api.get("/api/notifications"),
      ]);
      setIncidents(incRes.data);
      setNotifications(
        notifRes.data.filter((n: Notification) => !n.is_read).slice(0, 5),
      );
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

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
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Incidents</h1>
            <p className="text-gray-500 text-sm mt-1">
              {incidents.length} incident(s) total
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchData}
              className="px-3 py-2 text-sm text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-gray-200"
            >
              🔄 Refresh
            </button>
            <Link
              href="/employee/report"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2 text-sm"
            >
              + Report New Incident
            </Link>
          </div>
        </div>

        {/* Incidents Table */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          </div>
        ) : incidents.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-gray-500">
              No incidents yet. Report your first incident!
            </p>
            <Link
              href="/employee/report"
              className="mt-4 inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Report Incident
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Title
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Priority
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {incidents.map((incident) => (
                    <tr
                      key={incident.id}
                      className="hover:bg-indigo-50/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedIncident(incident)}
                    >
                      <td className="px-4 py-3 font-mono text-gray-500">
                        #{incident.id}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 hover:text-indigo-700">
                            {incident.title}
                          </span>
                          {incident.ai_summary && (
                            <span
                              title="AI analyzed"
                              className="text-indigo-400 cursor-help"
                            ></span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                          {incident.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={incident.priority} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={incident.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(incident.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Notifications Panel */}
        {notifications.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              Recent Notifications
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
              {notifications.map((n) => (
                <div key={n.id} className="px-4 py-3 flex items-start gap-3">
                  <span className="text-indigo-500 mt-0.5">●</span>
                  <div>
                    <p className="text-sm text-gray-800">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedIncident(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">
                  Incident #{selectedIncident.id}
                </p>
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedIncident.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedIncident(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                ✕
              </button>
            </div>
            <div className="flex gap-2 mb-4 flex-wrap">
              <StatusBadge status={selectedIncident.status} />
              <PriorityBadge priority={selectedIncident.priority} />
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                {selectedIncident.category}
              </span>
            </div>
            <p className="text-gray-700 text-sm mb-4">
              {selectedIncident.description}
            </p>
            {selectedIncident.ai_summary && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4">
                <p className="text-xs font-semibold text-indigo-500 mb-1">
                  {" "}
                  AI Summary
                </p>
                <p className="text-sm text-indigo-800">
                  {selectedIncident.ai_summary}
                </p>
              </div>
            )}
            {selectedIncident.resolution_notes && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                <p className="text-xs font-semibold text-green-600 mb-1">
                  Resolution Notes
                </p>
                <p className="text-sm text-green-800">
                  {selectedIncident.resolution_notes}
                </p>
              </div>
            )}
            <div className="text-xs text-gray-400 space-y-1">
              <p>
                Created:{" "}
                {new Date(selectedIncident.created_at).toLocaleString()}
              </p>
              <p>
                Updated:{" "}
                {new Date(selectedIncident.updated_at).toLocaleString()}
              </p>
              {selectedIncident.assigned_to_username && (
                <p>Assigned to: {selectedIncident.assigned_to_username}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
