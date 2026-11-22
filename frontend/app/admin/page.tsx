"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { BsSearch } from "react-icons/bs";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useAuth } from "@/components/AuthProvider";
import Navbar from "@/components/Navbar";
import { StatusBadge, PriorityBadge } from "@/components/Badges";
import api from "@/lib/api";
import { AdminStats, Incident } from "@/lib/types";

const PIE_COLORS = ["#3b82f6", "#22c55e", "#64748b"];

type IncidentId = Incident["id"];

// Lowercase, strip punctuation, collapse whitespace so
// "Printer  not working!" and "printer not working" match.
const normalizeTitle = (title: string) =>
  (title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);

  // Duplicate = same category + same normalized title.
  // Computed over ALL incidents so search/filters don't hide matches.
  const { duplicateMap, duplicateGroupCount } = useMemo(() => {
    const groups = new Map<string, Incident[]>();
    incidents.forEach((i) => {
      const normalized = normalizeTitle(i.title);
      if (!normalized) return;
      const key = `${i.category}|${normalized}`;
      const list = groups.get(key);
      if (list) list.push(i);
      else groups.set(key, [i]);
    });

    const map = new Map<IncidentId, IncidentId[]>();
    let groupCount = 0;
    groups.forEach((list) => {
      if (list.length < 2) return;
      groupCount++;
      list.forEach((i) =>
        map.set(
          i.id,
          list.filter((o) => o.id !== i.id).map((o) => o.id),
        ),
      );
    });
    return { duplicateMap: map, duplicateGroupCount: groupCount };
  }, [incidents]);

  const filteredIncidents = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^#/, "");
    return incidents.filter((i) => {
      if (duplicatesOnly && !duplicateMap.has(i.id)) return false;
      if (!q) return true;
      return [
        String(i.id),
        i.title,
        i.category,
        i.priority,
        i.status,
        i.created_by_username,
        i.assigned_to_username,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q));
    });
  }, [incidents, search, duplicatesOnly, duplicateMap]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.role !== "ADMIN") {
      router.push("/dashboard");
      return;
    }
    fetchData();
  }, [user, authLoading, router]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, incRes] = await Promise.all([
        api.get("/api/admin/stats"),
        api.get("/api/incidents"),
      ]);
      setStats(statsRes.data);
      setIncidents(incRes.data);
    } catch {
      toast.error("Failed to load admin data");
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

  const pieData = stats
    ? [
        { name: "Open", value: stats.open_count },
        { name: "Resolved", value: stats.resolved_count },
        { name: "Closed", value: stats.closed_count },
      ]
    : [];

  const barData = stats
    ? Object.entries(stats.by_category).map(([name, value]) => ({
        name,
        value,
      }))
    : [];

  const isFiltering = search.trim() !== "" || duplicatesOnly;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Admin Dashboard
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              System overview and management
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchData}
              className="px-3 py-2 text-sm text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              🔄 Refresh
            </button>
            <Link
              href="/admin/audit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              🔒 View Audit Log
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            {stats && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard
                  label="Open Incidents"
                  value={stats.open_count}
                  color="blue"
                  icon="🔵"
                />
                <StatCard
                  label="Resolved"
                  value={stats.resolved_count}
                  color="green"
                  icon="✅"
                />
                <StatCard
                  label="Closed"
                  value={stats.closed_count}
                  color="slate"
                  icon="📁"
                />
                <StatCard
                  label="SLA Violations"
                  value={stats.sla_violations}
                  color="red"
                  icon="⚠️"
                />
              </div>
            )}

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Pie Chart */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  Incident Status Distribution
                </h2>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {pieData.map((_, index) => (
                        <Cell
                          key={index}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Bar Chart */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  Incidents by Category
                </h2>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Technician Workload */}
            {stats &&
              stats.technician_workload &&
              stats.technician_workload.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">
                    Technician Workload
                  </h2>
                  <div className="space-y-3">
                    {stats.technician_workload.map((tech) => (
                      <div key={tech.id} className="flex items-center gap-4">
                        <div className="w-32 text-sm font-medium text-gray-700 truncate">
                          {tech.username}
                        </div>
                        <div className="flex-1">
                          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 rounded-full transition-all"
                              style={{
                                width: `${Math.min((tech.active_ticket_count / 10) * 100, 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 w-20 text-right">
                          {tech.active_ticket_count} ticket
                          {tech.active_ticket_count !== 1 ? "s" : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Recent Incidents Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    Recent Incidents
                  </h2>
                  {duplicateMap.size > 0 && (
                    <p className="text-xs text-amber-700 mt-0.5">
                      {duplicateMap.size} incidents flagged as possible
                      duplicates across {duplicateGroupCount} group
                      {duplicateGroupCount !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setDuplicatesOnly((v) => !v)}
                    disabled={duplicateMap.size === 0 && !duplicatesOnly}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      duplicatesOnly
                        ? "bg-amber-100 border-amber-300 text-amber-800"
                        : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    Duplicates only ({duplicateMap.size})
                  </button>
                  <div className="relative">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by ID, title, category, user..."
                      className="w-72 pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                      <BsSearch className="text-gray-800" />
                    </span>
                    {search && (
                      <button
                        onClick={() => setSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        aria-label="Clear search"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <span className="text-sm text-gray-500 whitespace-nowrap">
                    {isFiltering
                      ? `${filteredIncidents.length} of ${incidents.length}`
                      : `${incidents.length} total`}
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        Title
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        Category
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        Priority
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        Reporter
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        Assigned
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredIncidents.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-10 text-center text-gray-500"
                        >
                          {search.trim()
                            ? `No incidents match "${search}"`
                            : "No duplicate incidents found"}
                        </td>
                      </tr>
                    ) : (
                      filteredIncidents.slice(0, 20).map((incident) => {
                        const dupes = duplicateMap.get(incident.id);
                        return (
                          <tr
                            key={incident.id}
                            className={`transition-colors ${
                              dupes
                                ? "bg-amber-50/60 hover:bg-amber-50"
                                : "hover:bg-gray-50"
                            }`}
                          >
                            <td className="px-4 py-3 font-mono text-gray-500">
                              #{incident.id}
                            </td>
                            <td className="px-4 py-3">
                              <Link
                                href={`/technician/${incident.id}`}
                                className="font-medium text-gray-900 hover:text-indigo-700 hover:underline"
                              >
                                {incident.title}
                              </Link>
                              {incident.ai_summary && (
                                <span className="ml-1 text-indigo-400"></span>
                              )}
                              {dupes && (
                                <span
                                  title={`Possible duplicate of ${dupes
                                    .map((id) => `#${id}`)
                                    .join(", ")}`}
                                  className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded text-xs font-medium whitespace-nowrap"
                                >
                                  Duplicate of{" "}
                                  {dupes
                                    .slice(0, 2)
                                    .map((id) => `#${id}`)
                                    .join(", ")}
                                  {dupes.length > 2
                                    ? ` +${dupes.length - 2}`
                                    : ""}
                                </span>
                              )}
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
                            <td className="px-4 py-3 text-gray-600">
                              {incident.created_by_username || "—"}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {incident.assigned_to_username || "—"}
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs">
                              {new Date(incident.created_at).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
    slate: "bg-slate-50 border-slate-200 text-slate-700",
    red: "bg-red-50 border-red-200 text-red-700",
  };
  return (
    <div className={`rounded-xl border p-5 ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-1 opacity-80">{label}</div>
    </div>
  );
}
