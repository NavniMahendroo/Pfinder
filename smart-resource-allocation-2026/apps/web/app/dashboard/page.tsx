"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Users } from "lucide-react";

import { Card } from "@/components/ui/card";
import { apiGet, apiPost } from "@/lib/api-client";
import { getIdentity } from "@/lib/identity";

type TaskListItem = {
  task_id: string;
  summary: string;
  category: string;
  urgency_score: number;
  location_context: string;
  status: string;
  required_hours: number;
  required_skills: string[];
  volunteer_start_date?: string | null;
  volunteer_end_date?: string | null;
  matched_volunteer_name?: string | null;
};

type VolunteerActiveInfo = {
  volunteer_id: string;
  volunteer_name: string;
  is_available: boolean;
  current_task_id?: string | null;
  current_task_summary?: string | null;
};

type CompletionProof = {
  volunteer_name: string;
  proof_text: string;
  hours_done: number;
  was_on_site: boolean;
  points_awarded: number;
  completed_at: string;
};

type NgoDashboardResponse = {
  active_tasks: TaskListItem[];
  completed_tasks: TaskListItem[];
  active_volunteers: VolunteerActiveInfo[];
  completion_proofs: CompletionProof[];
};

export default function DashboardPage() {
  const [ngoId, setNgoId] = useState("");
  const [ngoName, setNgoName] = useState("NGO Team");
  const [data, setData] = useState<NgoDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    summary: "",
    category: "Relief",
    urgency_score: 4,
    location_context: "",
    required_hours: 2,
    required_skills: "First Aid, Logistics",
    volunteer_start_date: new Date().toISOString().slice(0, 10),
    volunteer_end_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    notes: "",
  });

  useEffect(() => {
    const identity = getIdentity("ngo");
    setNgoId(identity.id);
    setNgoName(identity.name);
  }, []);

  async function loadDashboard(currentNgoId: string): Promise<void> {
    const response = await apiGet<NgoDashboardResponse>(`/api/tasks/ngo-dashboard?ngo_id=${encodeURIComponent(currentNgoId)}`);
    setData(response);
  }

  useEffect(() => {
    if (!ngoId) return;
    setLoading(true);
    loadDashboard(ngoId)
      .catch((requestError) => {
        const message = requestError instanceof Error ? requestError.message : "Failed to load dashboard";
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [ngoId]);

  const proofCount = useMemo(() => data?.completion_proofs.length ?? 0, [data]);
  const impactMetrics = useMemo(() => {
    const proofs = data?.completion_proofs ?? [];
    const active = data?.active_tasks ?? [];
    const onSiteRate = proofs.length ? (proofs.filter((proof) => proof.was_on_site).length / proofs.length) * 100 : 0;
    const avgUrgency = active.length ? active.reduce((sum, task) => sum + task.urgency_score, 0) / active.length : 0;
    const readinessIndex = Math.min(100, Math.round((onSiteRate * 0.55) + (avgUrgency * 9) + Math.min(15, active.length * 2)));
    return { onSiteRate, readinessIndex, avgUrgency };
  }, [data]);

  async function onCreateTask(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!ngoId) return;

    setError(null);
    setSubmitting(true);
    try {
      await apiPost("/api/tasks/create-manual", {
        ngo_id: ngoId,
        ngo_name: ngoName,
        summary: form.summary,
        category: form.category,
        urgency_score: Number(form.urgency_score),
        location_context: form.location_context,
        required_hours: Number(form.required_hours),
        volunteer_start_date: form.volunteer_start_date,
        volunteer_end_date: form.volunteer_end_date,
        required_skills: form.required_skills
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        notes: form.notes,
      });

      setForm((prev) => ({ ...prev, summary: "", location_context: "", notes: "" }));
      await loadDashboard(ngoId);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Task creation failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-mesh p-4 md:p-8">
      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-4 md:grid-cols-12">
        <Card className="col-span-1 md:col-span-12">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">NGO Command Center</p>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">Task Publishing & Field Monitoring</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Create tasks, track active volunteers, and verify completion proof with location authenticity signals.
          </p>
          {error && <p className="mt-3 rounded-xl bg-rose-100 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
        </Card>

        <Card className="col-span-1 md:col-span-4">
          <p className="text-sm text-slate-500">Active Tasks</p>
          <p className="mt-1 text-4xl font-bold text-slate-900">{loading ? "-" : data?.active_tasks.length ?? 0}</p>
        </Card>

        <Card className="col-span-1 md:col-span-4">
          <p className="text-sm text-slate-500">Active Volunteers</p>
          <p className="mt-1 text-4xl font-bold text-slate-900">{loading ? "-" : data?.active_volunteers.length ?? 0}</p>
        </Card>

        <Card className="col-span-1 md:col-span-4">
          <p className="text-sm text-slate-500">Proofs Logged</p>
          <p className="mt-1 text-4xl font-bold text-slate-900">{loading ? "-" : proofCount}</p>
        </Card>

        <Card className="col-span-1 md:col-span-5">
          <h2 className="text-lg font-semibold text-slate-900">Create & Publish Task</h2>
          <form onSubmit={onCreateTask} className="mt-4 space-y-3">
            <input
              required
              value={form.summary}
              onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              placeholder="Task summary"
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                required
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2"
                placeholder="Category"
              />
              <input
                required
                type="number"
                min={1}
                max={5}
                value={form.urgency_score}
                onChange={(event) => setForm((prev) => ({ ...prev, urgency_score: Number(event.target.value) }))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2"
                placeholder="Urgency (1-5)"
              />
            </div>
            <input
              required
              value={form.location_context}
              onChange={(event) => setForm((prev) => ({ ...prev, location_context: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              placeholder="Location context"
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                required
                type="number"
                min={1}
                value={form.required_hours}
                onChange={(event) => setForm((prev) => ({ ...prev, required_hours: Number(event.target.value) }))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2"
                placeholder="Required hours"
              />
              <input
                value={form.required_skills}
                onChange={(event) => setForm((prev) => ({ ...prev, required_skills: event.target.value }))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2"
                placeholder="Skills (comma separated)"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Volunteers needed from</label>
                <input
                  required
                  type="date"
                  value={form.volunteer_start_date}
                  onChange={(event) => setForm((prev) => ({ ...prev, volunteer_start_date: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Volunteers needed until</label>
                <input
                  required
                  type="date"
                  value={form.volunteer_end_date}
                  min={form.volunteer_start_date}
                  onChange={(event) => setForm((prev) => ({ ...prev, volunteer_end_date: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                />
              </div>
            </div>
            <textarea
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              className="h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              placeholder="Notes"
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-70"
            >
              {submitting ? "Publishing..." : "Publish Task"}
            </button>
          </form>
        </Card>

        <Card className="col-span-1 md:col-span-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Volunteer Intelligence Hub</h2>
              <p className="mt-1 text-sm text-slate-600">Open full volunteer profiles, trust scores, and current assignments.</p>
            </div>
            <Link
              href="/dashboard/volunteers"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              View Volunteers Page
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-sky-200 bg-sky-100/70 p-3">
              <p className="text-xs uppercase tracking-wider text-sky-800">Impact Readiness Index</p>
              <p className="mt-1 text-2xl font-bold text-sky-900">{impactMetrics.readinessIndex}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-100/70 p-3">
              <p className="text-xs uppercase tracking-wider text-emerald-800">On-Site Verification Rate</p>
              <p className="mt-1 text-2xl font-bold text-emerald-900">{impactMetrics.onSiteRate.toFixed(1)}%</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-100/70 p-3">
              <p className="text-xs uppercase tracking-wider text-amber-800">Avg Active Task Urgency</p>
              <p className="mt-1 text-2xl font-bold text-amber-900">{impactMetrics.avgUrgency.toFixed(1)}</p>
            </div>
          </div>
        </Card>

        <Card className="col-span-1 md:col-span-7">
          <h2 className="text-lg font-semibold text-slate-900">Active Tasks</h2>
          <div className="mt-4 space-y-3">
            {(data?.active_tasks ?? []).map((task) => (
              <div key={task.task_id} className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{task.summary}</p>
                    <p className="text-sm text-slate-600">{task.location_context}</p>
                  </div>
                  <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">U{task.urgency_score}</span>
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  {task.category} • {task.required_hours}h • Assigned to {task.matched_volunteer_name || "Unassigned"}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Volunteer window: {task.volunteer_start_date || "-"} to {task.volunteer_end_date || "-"}
                </p>
              </div>
            ))}
            {!loading && (data?.active_tasks.length ?? 0) === 0 && <p className="text-sm text-slate-600">No active tasks right now.</p>}
          </div>
        </Card>

        <Card className="col-span-1 md:col-span-6">
          <h3 className="text-lg font-semibold">Active Volunteers</h3>
          <ul className="mt-4 space-y-3 text-sm text-slate-700">
            {(data?.active_volunteers ?? []).map((volunteer) => (
              <li key={volunteer.volunteer_id} className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <Users className="h-4 w-4" />
                  {volunteer.volunteer_name}
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {volunteer.current_task_summary
                    ? `Working on: ${volunteer.current_task_summary}`
                    : volunteer.is_available
                      ? "Available"
                      : "Unavailable"}
                </p>
              </li>
            ))}
            {!loading && (data?.active_volunteers.length ?? 0) === 0 && <p className="text-sm text-slate-600">No active volunteers yet.</p>}
          </ul>
        </Card>

        <Card className="col-span-1 md:col-span-6">
          <h3 className="text-lg font-semibold">Completion Proof & Authenticity</h3>
          <ul className="mt-4 space-y-3 text-sm text-slate-700">
            {(data?.completion_proofs ?? []).slice(0, 8).map((proof, index) => (
              <li key={`${proof.completed_at}-${index}`} className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  {proof.was_on_site ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Activity className="h-4 w-4 text-amber-600" />}
                  {proof.volunteer_name}
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {proof.hours_done}h logged • {proof.points_awarded} pts • {proof.was_on_site ? "On-site verified" : "Location mismatch"}
                </p>
                <p className="mt-1 text-xs text-slate-700">{proof.proof_text}</p>
              </li>
            ))}
            {!loading && proofCount === 0 && <p className="text-sm text-slate-600">No proofs submitted yet.</p>}
          </ul>
        </Card>
      </section>
    </main>
  );
}
