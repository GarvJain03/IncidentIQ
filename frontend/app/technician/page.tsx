"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { BsSearch } from "react-icons/bs";
import { useAuth } from "@/components/AuthProvider";
import Navbar from "@/components/Navbar";
import { StatusBadge, PriorityBadge } from "@/components/Badges";
import SlaTimer from "@/components/SlaTimer";
import api from "@/lib/api";
import { Incident } from "@/lib/types";

const PRIORITY_ORDER = { P1: 0, P2: 1, P3: 2, P4: 3 };

type IncidentId = Incident["id"];

// Lowercase, strip punctuation, collapse whitespace so
// "Printer  not working!" and "printer not working" match.
const normalizeTitle = (title: string) =>
  (title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export default function TechnicianPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
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
    if (user.role !== "TECHNICIAN") {
      router.push("/dashboard");
      return;
    }
    fetchIncidents();
  }, [user, authLoading, router]);

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/incidents");
      const sorted = [...res.data].sort((a: Incident, b: Incident) => {
        const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        if (pDiff !== 0) return pDiff;
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });
      setIncidents(sorted);
    } catch {
      toast.error("Failed to load tickets");
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

  const isFiltering = search.trim() !== "" || duplicatesOnly;
  const myTickets = filteredIncidents.filter(
    (i) => i.assigned_to_id === user.id,
  );
  const otherTickets = filteredIncidents.filter(
    (i) => i.assigned_to_id !== user.id,
  );

  const TicketCard = ({ incident }: { incident: Incident }) => {
    const dupes = duplicateMap.get(incident.id);
    return (
      <div
        onClick={() => router.push(`/technician/${incident.id}`)}
        className={`rounded-xl border shadow-sm p-5 cursor-pointer hover:shadow-md hover:border-indigo-300 transition-all group ${
          dupes ? "bg-amber-50/60" : "bg-white"
        } ${incident.priority === "P1" ? "border-red-200" : "border-gray-200"}`}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 mb-1">#{incident.id}</p>
            <h3 className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors truncate">
              {incident.title}
            </h3>
          </div>
          {incident.assigned_to_id === user.id && (
            <span className="ml-2 flex-shrink-0 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
              Mine
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-3">
          <PriorityBadge priority={incident.priority} />
          <StatusBadge status={incident.status} />
          {incident.ai_summary && (
            <span title="AI analyzed" className="text-indigo-400 text-xs">
              AI
            </span>
          )}
          {dupes && (
            <span
              title={`Possible duplicate of ${dupes
                .map((id) => `#${id}`)
                .join(", ")}`}
              className="px-1.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded text-xs font-medium whitespace-nowrap"
            >
              Duplicate of{" "}
              {dupes
                .slice(0, 2)
                .map((id) => `#${id}`)
                .join(", ")}
              {dupes.length > 2 ? ` +${dupes.length - 2}` : ""}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <SlaTimer
            deadline={incident.sla_deadline}
            priority={incident.priority}
            violated={incident.sla_violated}
            status={incident.status}
          />
          <span className="text-xs text-gray-400">
            {new Date(incident.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              My Ticket Queue
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {isFiltering
                ? `${filteredIncidents.length} of ${incidents.length} ticket(s)`
                : `${incidents.length} ticket(s) total`}
            </p>
            {duplicateMap.size > 0 && (
              <p className="text-xs text-amber-700 mt-0.5">
                {duplicateMap.size} tickets flagged as possible duplicates
                across {duplicateGroupCount} group
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
            <button
              onClick={fetchIncidents}
              className="px-3 py-2 text-sm text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors font-medium"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          </div>
        ) : incidents.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <p className="text-gray-500 font-medium">
              No tickets assigned to you
            </p>
            <p className="text-gray-400 text-sm mt-1">
              Great work! Check back later for new incidents.
            </p>
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500 font-medium">
              {search.trim()
                ? `No tickets match "${search}"`
                : "No duplicate tickets found"}
            </p>
          </div>
        ) : (
          <>
            {myTickets.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Assigned to Me ({myTickets.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {myTickets.map((incident) => (
                    <TicketCard key={incident.id} incident={incident} />
                  ))}
                </div>
              </div>
            )}
            {otherTickets.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  All Other Tickets ({otherTickets.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {otherTickets.map((incident) => (
                    <TicketCard key={incident.id} incident={incident} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
