"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { apiGet } from "@/lib/api-client";
import { getIdentity } from "@/lib/identity";

type CompletionProof = {
  volunteer_name: string;
  task_id?: string | null;
  task_summary?: string | null;
  proof_text: string;
  hours_done: number;
  was_on_site: boolean;
  points_awarded: number;
  completed_at: string;
};

type VolunteerHistoryResponse = {
  completed: CompletionProof[];
  points_total: number;
  total_hours: number;
};

export default function VolunteerCompletedPage() {
  const [volunteerId, setVolunteerId] = useState("");
  const [history, setHistory] = useState<VolunteerHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const identity = getIdentity("volunteer");
    setVolunteerId(identity.id);
  }, []);

  useEffect(() => {
    if (!volunteerId) return;

    apiGet<VolunteerHistoryResponse>(`/api/tasks/volunteer/history?volunteer_id=${encodeURIComponent(volunteerId)}`)
      .then((response) => setHistory(response))
      .catch((requestError) => {
        const message = requestError instanceof Error ? requestError.message : "Failed to load completed tasks";
        setError(message);
      });
  }, [volunteerId]);

  const completedCount = useMemo(() => history?.completed.length ?? 0, [history]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-mesh p-4 md:p-8">
      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-12">
        <Card className="col-span-1 md:col-span-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Volunteer Console</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">Completed Tasks</h1>
              <p className="mt-2 text-sm text-slate-700">Each completed task awards 20 points and is logged here.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/volunteer" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                New Offers
              </Link>
              <Link href="/volunteer/active" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Active Tasks
              </Link>
              <Link href="/volunteer/settings" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Settings
              </Link>
            </div>
          </div>
          {error && <p className="mt-3 rounded-xl bg-rose-100 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
        </Card>

        <Card className="col-span-1 md:col-span-4">
          <p className="text-sm text-slate-500">Completed Tasks</p>
          <p className="mt-1 text-4xl font-bold text-slate-900">{completedCount}</p>
        </Card>

        <Card className="col-span-1 md:col-span-4">
          <p className="text-sm text-slate-500">Total Points</p>
          <p className="mt-1 text-4xl font-bold text-slate-900">{history?.points_total ?? 0}</p>
        </Card>

        <Card className="col-span-1 md:col-span-4">
          <p className="text-sm text-slate-500">Total Hours Logged</p>
          <p className="mt-1 text-4xl font-bold text-slate-900">{(history?.total_hours ?? 0).toFixed(1)}</p>
        </Card>

        <Card className="col-span-1 md:col-span-12">
          <h2 className="text-lg font-semibold text-slate-900">Task Log</h2>
          <div className="mt-4 space-y-3">
            {(history?.completed ?? []).map((proof, index) => (
              <div key={`${proof.completed_at}-${index}`} className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-slate-900">{proof.task_summary || "Completed Task"}</p>
                    <p className="mt-1 text-xs text-slate-600">Task ID: {(proof.task_id || "-").slice(0, 8)}</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                    +{proof.points_awarded} pts
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{proof.proof_text}</p>
                <p className="mt-1 text-xs text-slate-600">
                  {proof.hours_done}h logged • {proof.was_on_site ? "On-site verified" : "Off-site completion"}
                </p>
              </div>
            ))}

            {(history?.completed ?? []).length === 0 && (
              <p className="text-sm text-slate-600">No completed tasks yet.</p>
            )}
          </div>
        </Card>
      </section>
    </main>
  );
}
