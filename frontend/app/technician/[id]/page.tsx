"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";
import { useAuth } from "@/components/AuthProvider";
import Navbar from "@/components/Navbar";
import { StatusBadge, PriorityBadge } from "@/components/Badges";
import SlaTimer from "@/components/SlaTimer";
import AiAnalysisPanel from "@/components/AiAnalysisPanel";
import api from "@/lib/api";
import { Incident } from "@/lib/types";

export default function TicketDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [aiTips, setAiTips] = useState<string[]>([]);
  const [aiTipsLoading, setAiTipsLoading] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.role !== "TECHNICIAN" && user.role !== "ADMIN") {
      router.push("/dashboard");
      return;
    }
    fetchIncident();
  }, [user, authLoading, id]);

  const fetchIncident = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/incidents/${id}`);
      setIncident(res.data);
      if (res.data.resolution_notes)
        setResolutionNotes(res.data.resolution_notes);
    } catch {
      toast.error("Failed to load incident");
      router.push("/technician");
    } finally {
      setLoading(false);
    }
  };

  const handleStartWorking = async () => {
    setActionLoading(true);
    try {
      await api.patch(`/api/incidents/${id}/status`, {
        new_status: "IN_PROGRESS",
      });
      toast.success("Status updated to In Progress");
      fetchIncident();
    } catch (e) {
      toast.error(
        (e as any)?.response?.data?.detail || "Failed to update status",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!resolutionNotes.trim()) {
      toast.error("Please add resolution notes before marking as resolved");
      return;
    }
    setActionLoading(true);
    try {
      await api.patch(`/api/incidents/${id}/status`, {
        new_status: "RESOLVED",
        resolution_notes: resolutionNotes,
      });
      toast.success("Ticket resolved!");
      router.push("/technician");
    } catch (e) {
      toast.error(
        (e as any)?.response?.data?.detail || "Failed to resolve ticket",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleGetAiTips = async () => {
    setAiTipsLoading(true);
    try {
      const res = await api.post("/api/ai/resolve-suggestions", {
        incident_id: incident?.id,
        title: incident?.title,
        description: incident?.description,
        category: incident?.category,
      });
      setAiTips(res.data.suggestions || res.data.steps || []);
    } catch {
      toast.error("Failed to get AI tips");
    } finally {
      setAiTipsLoading(false);
    }
  };

  if (authLoading || !user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!incident) return null;

  const isMyTicket = incident.assigned_to_id === user.id;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Back button */}
        <button
          onClick={() => router.push("/technician")}
          className="text-sm text-gray-500 hover:text-indigo-600 flex items-center gap-1 mb-5"
        >
          ← Back to Queue
        </button>

        {/* SLA Status Banner */}
        {incident.status === "RESOLVED" || incident.status === "CLOSED" ? (
          <div
            className={`mb-5 p-4 rounded-xl border flex items-center justify-between ${
              incident.sla_violated
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-emerald-50 border-emerald-200 text-emerald-800"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{incident.sla_violated ? "⚠️" : "✅"}</span>
              <div>
                <p className="text-sm font-semibold">
                  {incident.sla_violated
                    ? "SLA Breached — Resolved Past Deadline"
                    : "SLA Fulfilled — Ticket Resolved"}
                </p>
                <p className="text-xs opacity-80 mt-0.5">
                  {incident.sla_violated
                    ? "This incident was resolved after the designated SLA deadline."
                    : `Resolved within the allocated ${incident.priority} SLA window.`}
                </p>
              </div>
            </div>
            <SlaTimer
              deadline={incident.sla_deadline}
              priority={incident.priority}
              violated={incident.sla_violated}
              status={incident.status}
            />
          </div>
        ) : (incident.priority === "P1" || incident.priority === "P2") ? (
          <div className="mb-5 p-4 bg-white rounded-xl border border-orange-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-orange-500 text-2xl">🚨</span>
              <div>
                <p className="text-sm font-semibold text-orange-700">
                  High Priority — SLA Active
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Action required before deadline expires
                </p>
              </div>
            </div>
            <div>
              <SlaTimer
                deadline={incident.sla_deadline}
                priority={incident.priority}
                violated={incident.sla_violated}
                status={incident.status}
              />
            </div>
          </div>
        ) : null}

        {/* Main details card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">
                Incident #{incident.id}
              </p>
              <h1 className="text-2xl font-bold text-gray-900">
                {incident.title}
              </h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <PriorityBadge priority={incident.priority} />
              <StatusBadge status={incident.status} />
            </div>
          </div>

          <div className="flex gap-3 flex-wrap mb-5 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <span className="font-medium">Category:</span>
              <span className="px-2 py-0.5 bg-gray-100 rounded">
                {incident.category}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <span className="font-medium">Reporter:</span>{" "}
              {incident.created_by_username}
            </span>
            {incident.assigned_to_username && (
              <span className="flex items-center gap-1">
                <span className="font-medium">Assigned:</span>{" "}
                {incident.assigned_to_username}
                {isMyTicket && <span className="text-indigo-500">(You)</span>}
              </span>
            )}
          </div>

          <div className="mb-5">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Description
            </h3>
            <p className="text-gray-700 leading-relaxed">
              {incident.description}
            </p>
          </div>

          <div className="text-xs text-gray-400 flex gap-4 flex-wrap">
            <span>
              Created: {new Date(incident.created_at).toLocaleString()}
            </span>
            <span>
              Updated: {new Date(incident.updated_at).toLocaleString()}
            </span>
            {incident.resolved_at && (
              <span>
                Resolved: {new Date(incident.resolved_at).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* AI Analysis (collapsible) */}
        {incident.ai_analysis && (
          <div className="mb-5">
            <button
              onClick={() => setShowAiPanel(!showAiPanel)}
              className="flex items-center gap-2 text-indigo-600 text-sm font-medium mb-3 hover:opacity-80"
            >
              {showAiPanel ? "Hide" : "Show"} AI Analysis
            </button>
            {showAiPanel && (
              <AiAnalysisPanel
                analysis={incident.ai_analysis}
                loading={false}
              />
            )}
          </div>
        )}

        {/* Action Section */}
        {isMyTicket && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-5">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Actions
            </h2>

            {incident.status === "ASSIGNED" && (
              <button
                onClick={handleStartWorking}
                disabled={actionLoading}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
              >
                {actionLoading ? (
                  <svg
                    className="animate-spin h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : (
                  ""
                )}
                Start Working
              </button>
            )}

            {incident.status === "IN_PROGRESS" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Resolution Notes
                  </label>
                  <textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-none"
                    placeholder="Describe what you did to resolve the issue..."
                  />
                </div>

                {/* AI Resolution Tips */}
                <div>
                  <button
                    onClick={handleGetAiTips}
                    disabled={aiTipsLoading}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                  >
                    {aiTipsLoading ? (
                      <svg
                        className="animate-spin h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                    ) : (
                      ""
                    )}
                    Get AI Resolution Tips
                  </button>

                  {aiTips.length > 0 && (
                    <div className="mt-3 bg-teal-50 border border-teal-200 rounded-xl p-4">
                      <p className="text-sm font-semibold text-teal-700 mb-2">
                        🤖 AI Resolution Suggestions
                      </p>
                      <ol className="list-decimal list-inside space-y-1">
                        {aiTips.map((tip, i) => (
                          <li key={i} className="text-sm text-teal-800">
                            {tip}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleResolve}
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                >
                  {actionLoading ? (
                    <svg
                      className="animate-spin h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  ) : (
                    "✅"
                  )}
                  Mark as Resolved
                </button>
              </div>
            )}

            {(incident.status === "RESOLVED" ||
              incident.status === "CLOSED") && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-green-700 mb-1">
                  ✅ Ticket {incident.status.toLowerCase()}
                </p>
                {incident.resolution_notes && (
                  <p className="text-sm text-green-800">
                    {incident.resolution_notes}
                  </p>
                )}
              </div>
            )}

            {incident.status === "NEW" && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-500">
                  This ticket is pending assignment by the system.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Audit Trail */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <button
            onClick={() => setShowAudit(!showAudit)}
            className="flex items-center justify-between w-full"
          >
            <h2 className="text-lg font-semibold text-gray-800">Audit Trail</h2>
            <span className="text-gray-400 text-sm">
              {showAudit ? "▲ Hide" : "▼ Show"}
            </span>
          </button>

          {showAudit && (
            <div className="mt-4 overflow-x-auto">
              {!incident.audit_log || incident.audit_log.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No audit entries yet
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">
                        Time
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">
                        Action
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">
                        Actor
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">
                        Status Change
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {incident.audit_log.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {new Date(entry.timestamp).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {entry.action}
                        </td>
                        <td className="px-3 py-2 text-gray-700 font-medium">
                          {entry.actor_username}
                        </td>
                        <td className="px-3 py-2">
                          {entry.old_status || entry.new_status ? (
                            <span className="text-xs">
                              <span className="text-gray-500">
                                {entry.old_status || "—"}
                              </span>
                              <span className="text-gray-400 mx-1">→</span>
                              <span className="text-indigo-600 font-medium">
                                {entry.new_status || "—"}
                              </span>
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
