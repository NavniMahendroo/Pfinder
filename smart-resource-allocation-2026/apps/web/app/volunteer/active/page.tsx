"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { apiGet, apiPost } from "@/lib/api-client";
import { getIdentity } from "@/lib/identity";

type TaskListItem = {
  task_id: string;
  summary: string;
  category: string;
  status: string;
  location_context: string;
  task_lat?: number | null;
  task_lng?: number | null;
  required_hours: number;
  distance_km?: number | null;
  matched_volunteer_id?: string | null;
};

type VolunteerTaskListResponse = {
  tasks: TaskListItem[];
  points_total: number;
};

type CompletionProof = {
  volunteer_name: string;
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

export default function VolunteerActivePage() {
  const [volunteerId, setVolunteerId] = useState("");
  const [volunteerName, setVolunteerName] = useState("Volunteer");
  const [activeTasks, setActiveTasks] = useState<TaskListItem[]>([]);
  const [history, setHistory] = useState<VolunteerHistoryResponse | null>(null);
  const [hoursByTask, setHoursByTask] = useState<Record<string, string>>({});
  const [proofByTask, setProofByTask] = useState<Record<string, string>>({});
  const [proofUrlByTask, setProofUrlByTask] = useState<Record<string, string>>({});
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const identity = getIdentity("volunteer");
    setVolunteerId(identity.id);
    setVolunteerName(identity.name);

    navigator.geolocation?.getCurrentPosition(
      (position) => setCoords({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => setCoords(null),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, []);

  async function loadData(currentVolunteerId: string, currentVolunteerName: string): Promise<void> {
    const params = new URLSearchParams({ volunteer_id: currentVolunteerId, volunteer_name: currentVolunteerName });
    if (coords) {
      params.set("current_lat", String(coords.lat));
      params.set("current_lng", String(coords.lng));
    }

    const [taskResponse, historyResponse] = await Promise.all([
      apiGet<VolunteerTaskListResponse>(`/api/tasks/volunteer/active?${params.toString()}`),
      apiGet<VolunteerHistoryResponse>(`/api/tasks/volunteer/history?volunteer_id=${encodeURIComponent(currentVolunteerId)}`),
    ]);

    setActiveTasks(
      taskResponse.tasks.filter(
        (task) =>
          task.matched_volunteer_id === currentVolunteerId &&
          (task.status === "accepted" || task.status === "in_progress")
      )
    );
    setHistory(historyResponse);
  }

  useEffect(() => {
    if (!volunteerId) return;
    loadData(volunteerId, volunteerName).catch((requestError) => {
      const messageText = requestError instanceof Error ? requestError.message : "Failed to load active tasks";
      setError(messageText);
    });
  }, [volunteerId, volunteerName, coords]);

  const todaysHours = useMemo(() => {
    return (history?.completed ?? [])
      .filter((proof) => new Date(proof.completed_at).toDateString() === new Date().toDateString())
      .reduce((sum, proof) => sum + proof.hours_done, 0);
  }, [history]);

  async function onComplete(event: FormEvent<HTMLFormElement>, taskId: string): Promise<void> {
    event.preventDefault();
    if (!volunteerId) return;

    setError(null);
    setBusyTaskId(taskId);

    try {
      const payload = {
        volunteer_id: volunteerId,
        volunteer_name: volunteerName,
        task_id: taskId,
        hours_done: Number(hoursByTask[taskId] || "1"),
        proof_text: proofByTask[taskId] || "Task completed.",
        proof_url: proofUrlByTask[taskId] || null,
        completion_lat: coords?.lat,
        completion_lng: coords?.lng,
      };
      await apiPost("/api/tasks/volunteer/complete", payload);
      setMessage("Task marked complete. Points and proof have been logged.");
      await loadData(volunteerId, volunteerName);
    } catch (requestError) {
      const messageText = requestError instanceof Error ? requestError.message : "Failed to complete task";
      setError(messageText);
    } finally {
      setBusyTaskId(null);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-mesh p-4 md:p-8">
      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-12">
        <Card className="col-span-1 md:col-span-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Volunteer Console</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">Active Tasks & Completion</h1>
              <p className="mt-2 text-sm text-slate-700">Submit completion proof, hours done, and location-aware verification.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/volunteer" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                New Offers
              </Link>
              <Link href="/volunteer/settings" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Settings
              </Link>
            </div>
          </div>
          {error && <p className="mt-3 rounded-xl bg-rose-100 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
          {message && <p className="mt-3 rounded-xl bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-700">{message}</p>}
        </Card>

        <Card className="col-span-1 md:col-span-4">
          <p className="text-sm text-slate-500">Active Assigned Tasks</p>
          <p className="mt-1 text-4xl font-bold text-slate-900">{activeTasks.length}</p>
        </Card>

        <Card className="col-span-1 md:col-span-4">
          <p className="text-sm text-slate-500">Points Total</p>
          <p className="mt-1 text-4xl font-bold text-slate-900">{history?.points_total ?? 0}</p>
        </Card>

        <Card className="col-span-1 md:col-span-4">
          <p className="text-sm text-slate-500">Hours Logged Today</p>
          <p className="mt-1 text-4xl font-bold text-slate-900">{todaysHours.toFixed(1)}</p>
        </Card>

        <div className="col-span-1 space-y-4 md:col-span-7">
          {activeTasks.map((task) => (
            <Card key={task.task_id} className="rounded-3xl p-5">
              <p className="text-lg font-semibold text-slate-900">{task.summary}</p>
              <p className="mt-1 text-sm text-slate-700">{task.category} • {task.location_context}</p>
              <p className="mt-1 text-xs text-slate-600">Distance: {typeof task.distance_km === "number" ? `${task.distance_km.toFixed(2)} km` : "Unknown"}</p>

              <form onSubmit={(event) => onComplete(event, task.task_id)} className="mt-4 space-y-2">
                <input
                  required
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={hoursByTask[task.task_id] ?? ""}
                  onChange={(event) => setHoursByTask((prev) => ({ ...prev, [task.task_id]: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                  placeholder="Hours completed"
                />
                <textarea
                  required
                  value={proofByTask[task.task_id] ?? ""}
                  onChange={(event) => setProofByTask((prev) => ({ ...prev, [task.task_id]: event.target.value }))}
                  className="h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                  placeholder="Proof notes"
                />
                <input
                  value={proofUrlByTask[task.task_id] ?? ""}
                  onChange={(event) => setProofUrlByTask((prev) => ({ ...prev, [task.task_id]: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                  placeholder="Optional proof URL"
                />
                <button
                  type="submit"
                  disabled={busyTaskId === task.task_id}
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-70"
                >
                  {busyTaskId === task.task_id ? "Submitting..." : "Complete Task"}
                </button>
              </form>
            </Card>
          ))}
          {activeTasks.length === 0 && <Card className="rounded-3xl p-5 text-sm text-slate-700">No active assigned tasks right now.</Card>}
        </div>

        <Card className="col-span-1 md:col-span-5">
          <h3 className="text-lg font-semibold text-slate-900">Completion History</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            {(history?.completed ?? []).slice(0, 8).map((proof, index) => (
              <div key={`${proof.completed_at}-${index}`} className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                <p className="font-semibold text-slate-900">{proof.hours_done}h • {proof.points_awarded} pts</p>
                <p className="mt-1 text-xs text-slate-600">{proof.was_on_site ? "On-site verified" : "Location mismatch"}</p>
                <p className="mt-1 text-xs text-slate-700">{proof.proof_text}</p>
              </div>
            ))}
            {(history?.completed ?? []).length === 0 && <p className="text-sm text-slate-600">No completion history yet.</p>}
          </div>
        </Card>
      </section>
    </main>
  );
}
