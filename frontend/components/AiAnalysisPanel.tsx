"use client";
import { AiAnalysis, Priority } from "@/lib/types";

const priorityChipColors: Record<Priority, string> = {
  P1: "bg-red-100 text-red-700",
  P2: "bg-orange-100 text-orange-700",
  P3: "bg-yellow-100 text-yellow-700",
  P4: "bg-gray-100 text-gray-600",
};

interface AiAnalysisPanelProps {
  analysis: AiAnalysis | null;
  loading: boolean;
}

export default function AiAnalysisPanel({
  analysis,
  loading,
}: AiAnalysisPanelProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
        <svg
          className="animate-spin h-5 w-5 text-indigo-600"
          xmlns="http://www.w3.org/2000/svg"
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
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          ></path>
        </svg>
        <span className="text-indigo-700 font-medium">
          Analyzing with Gemini AI...
        </span>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-indigo-700 font-semibold text-lg">AI Analysis</h3>
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">
        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
          {analysis.category}
        </span>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${priorityChipColors[analysis.suggested_priority]}`}
        >
          Priority: {analysis.suggested_priority}
        </span>
      </div>

      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Summary
        </p>
        <p className="text-gray-700 text-sm">{analysis.ai_summary}</p>
      </div>

      {analysis.suggested_resolution_steps &&
        analysis.suggested_resolution_steps.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Suggested Steps
            </p>
            <ol className="list-decimal list-inside space-y-1">
              {analysis.suggested_resolution_steps.map((step, i) => (
                <li key={i} className="text-sm text-gray-700">
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}

      <div className="border-t border-indigo-100 pt-3 mt-3">
        <p className="text-xs text-gray-500 italic">
          {analysis.priority_reasoning}
        </p>
      </div>

      <p className="text-xs text-gray-400 mt-2">
        ⚠️ AI suggestions are advisory only
      </p>
    </div>
  );
}
