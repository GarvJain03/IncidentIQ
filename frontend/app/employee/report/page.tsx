"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useAuth } from "@/components/AuthProvider";
import Navbar from "@/components/Navbar";
import AiAnalysisPanel from "@/components/AiAnalysisPanel";
import api from "@/lib/api";
import { AiAnalysis } from "@/lib/types";

export default function ReportIncidentPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.role !== "EMPLOYEE") {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  // Debounced AI analysis
  useEffect(() => {
    if (description.length <= 20) {
      setAiAnalysis(null);
      return;
    }
    const timer = setTimeout(async () => {
      setAiLoading(true);
      try {
        const res = await api.post("/api/ai/analyze", {
          title: title.trim() || "Incident",
          description: description.trim(),
        });
        setAiAnalysis(res.data);
      } catch {
        // silent fail - AI is optional
      } finally {
        setAiLoading(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [description]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/api/incidents", { title, description });
      toast.success("Incident reported successfully!");
      router.push("/employee");
      router.refresh();
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Failed to report incident";
      console.error("Submission failed:", err);
      toast.error(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
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
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <button
            onClick={() => router.push("/employee")}
            className="text-sm text-gray-500 hover:text-indigo-600 flex items-center gap-1 mb-4"
          >
            ← Back to My Incidents
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            Report New Incident
          </h1>
          <p className="text-gray-500 text-sm mt-1">Describe your issue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                placeholder="Brief summary of the issue"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={6}
                className="w-full px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-none"
                placeholder="Describe the issue in detail. What happened? When? What is the impact?"
              />
              {description.length > 0 && description.length <= 20 && (
                <p className="text-xs text-gray-400 mt-1">
                  Type at least 20 characters to trigger AI analysis
                </p>
              )}
              {description.length > 20 && (
                <p className="text-xs text-indigo-500 mt-1">
                  AI analysis will trigger shortly...
                </p>
              )}
            </div>
          </div>

          {/* AI Analysis Panel */}
          {(aiLoading || aiAnalysis) && (
            <AiAnalysisPanel analysis={aiAnalysis} loading={aiLoading} />
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push("/employee")}
              className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
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
                  Submitting...
                </>
              ) : (
                "📤 Submit Incident"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
