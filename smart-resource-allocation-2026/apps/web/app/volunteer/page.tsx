"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Clock3, LocateFixed, Siren, UserCheck } from "lucide-react";

import { Card } from "@/components/ui/card";
import { OffersMap } from "@/components/volunteer/offers-map";
import { apiGet, apiPost } from "@/lib/api-client";
import { getIdentity } from "@/lib/identity";

type VolunteerTask = {
  task_id: string;
  summary: string;
  category: string;
  urgency_score: number;
  location_context: string;
  task_lat?: number | null;
  task_lng?: number | null;
  status: string;
  distance_km?: number | null;
  required_hours: number;
  required_skills: string[];
};

type TaskListResponse = {
  tasks: VolunteerTask[];
  points_total: number;
};

function urgencyBadgeClass(urgencyScore: number): string {
  if (urgencyScore >= 5) return "bg-rose-100 text-rose-800 border-rose-200";
  if (urgencyScore >= 3) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-emerald-100 text-emerald-800 border-emerald-200";
}

export default function VolunteerPage() {
  const [volunteerId, setVolunteerId] = useState("");
  const [volunteerName, setVolunteerName] = useState("Volunteer");
  const [tasks, setTasks] = useState<VolunteerTask[]>([]);
  const [points, setPoints] = useState(0);
  const [acceptedTaskIds, setAcceptedTaskIds] = useState<string[]>([]);
  const [distanceMessage, setDistanceMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const identity = getIdentity("volunteer");
    setVolunteerId(identity.id);
    setVolunteerName(identity.name);

    navigator.geolocation?.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {
        setCoords(null);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, []);

  useEffect(() => {
    if (!volunteerId) return;

    const query = new URLSearchParams({
      volunteer_id: volunteerId,
      volunteer_name: volunteerName,
    });
    if (coords) {
      query.set("current_lat", String(coords.lat));
      query.set("current_lng", String(coords.lng));
    }

    setLoading(true);
    apiGet<TaskListResponse>(`/api/tasks/volunteer/active?${query.toString()}`)
      .then((response) => {
        setTasks(response.tasks);
        setPoints(response.points_total);
      })
      .catch((requestError) => {
        const message = requestError instanceof Error ? requestError.message : "Failed to load volunteer tasks";
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [volunteerId, volunteerName, coords]);

  const activeOffers = tasks.length;
  const closestDistance = useMemo(() => {
    const distances = tasks.map((task) => task.distance_km).filter((value): value is number => typeof value === "number");
    if (!distances.length) return "-";
    return `${Math.min(...distances).toFixed(1)} km`;
  }, [tasks]);

  function acceptTask(taskId: string): void {
    if (!volunteerId) return;

    const target = tasks.find((task) => task.task_id === taskId);
    if (!target) return;

    apiPost<{ ok: boolean }>("/api/tasks/volunteer/accept", {
      volunteer_id: volunteerId,
      volunteer_name: volunteerName,
      task_id: taskId,
    })
      .then(() => {
        setAcceptedTaskIds((prev) => (prev.includes(taskId) ? prev : [...prev, taskId]));
        setTasks((prev) => prev.filter((task) => task.task_id !== taskId));
        setDistanceMessage(`Accepted ${target.summary}. Open Active Tasks to complete and upload proof.`);
      })
      .catch((requestError) => {
        const message = requestError instanceof Error ? requestError.message : "Failed to accept task";
        setError(message);
      });
  }

  function skipTask(taskId: string): void {
    setTasks((prev) => prev.filter((task) => task.task_id !== taskId));
  }

  function showDistance(taskId: string): void {
    const task = tasks.find((item) => item.task_id === taskId);
    if (!task) return;
    if (typeof task.distance_km !== "number") {
      setDistanceMessage("Distance unavailable. Please enable location access.");
      return;
    }
    setDistanceMessage(`Distance to \"${task.summary}\" is ${task.distance_km.toFixed(2)} km from your current location.`);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-mesh p-4 md:p-8">
      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-12">
        <Card className="col-span-1 md:col-span-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Volunteer Console</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900 md:text-4xl">Nearby Tasks Ready To Respond</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-700">
                Accept the most urgent tasks around you. Match quality is based on proximity, skills, and current availability.
              </p>
              <p className="mt-2 text-sm text-emerald-700">Points earned: {points}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/volunteer/active" className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                Active Tasks
              </Link>
              <Link href="/volunteer/settings" className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                Settings
              </Link>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-100/70 px-4 py-3 text-emerald-800">
              <UserCheck className="h-4 w-4" />
              <span className="text-sm font-semibold">Status: Available</span>
            </div>
          </div>
        </Card>

        <Card className="col-span-1 md:col-span-4">
          <p className="text-sm text-slate-500">Active Offers</p>
          <p className="mt-1 text-4xl font-bold text-slate-900">{activeOffers}</p>
        </Card>

        <Card className="col-span-1 md:col-span-4">
          <p className="text-sm text-slate-500">Closest Task ETA</p>
          <p className="mt-1 text-4xl font-bold text-slate-900">{closestDistance}</p>
        </Card>

        <Card className="col-span-1 md:col-span-4">
          <p className="text-sm text-slate-500">Location Status</p>
          <p className="mt-1 text-4xl font-bold text-slate-900">{coords ? "Live" : "Off"}</p>
        </Card>

        <Card className="col-span-1 p-3 md:col-span-12">
          <p className="mb-2 px-2 text-sm font-semibold text-slate-700">New Offers Map (what + where + how far)</p>
          <OffersMap offers={tasks} currentLocation={coords} />
        </Card>

        <div className="col-span-1 space-y-4 md:col-span-8">
          {error && <Card className="rounded-3xl border border-rose-200 bg-rose-100/70 p-4 text-sm font-medium text-rose-900">{error}</Card>}

          {distanceMessage && (
            <Card className="rounded-3xl border border-sky-200 bg-sky-100/70 p-4 text-sm font-medium text-sky-900">
              {distanceMessage}
            </Card>
          )}

          {acceptedTaskIds.length > 0 && (
            <Card className="rounded-3xl border border-emerald-200 bg-emerald-100/70 p-4 text-sm font-medium text-emerald-900">
              Accepted tasks this session: {acceptedTaskIds.join(", ")}
            </Card>
          )}

          {!loading && tasks.length === 0 && (
            <Card className="rounded-3xl border border-sky-200 bg-sky-100/70 p-6 text-slate-800">
              <p className="text-lg font-semibold">No more tasks in current ripple.</p>
              <p className="mt-1 text-sm">You are all caught up for now. New nearby assignments will appear automatically.</p>
            </Card>
          )}

          {loading && <Card className="rounded-3xl p-6 text-slate-700">Loading tasks...</Card>}

          {tasks.map((task) => (
            <Card key={task.task_id} className="rounded-3xl p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold text-slate-900">{task.summary}</p>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase ${urgencyBadgeClass(task.urgency_score)}`}>
                      urgency {task.urgency_score}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{task.category} • {task.required_hours}h • Skills: {task.required_skills.join(", ") || "General"}</p>
                </div>
                <p className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white">{task.task_id.slice(0, 8)}</p>
              </div>

              <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-700">
                <span className="inline-flex items-center gap-1 rounded-xl bg-white/70 px-3 py-2">
                  <LocateFixed className="h-4 w-4" />
                  {task.location_context}
                </span>
                {(typeof task.task_lat === "number" && typeof task.task_lng === "number") && (
                  <span className="inline-flex items-center gap-1 rounded-xl bg-white/70 px-3 py-2">
                    Coords: {task.task_lat.toFixed(5)}, {task.task_lng.toFixed(5)}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-xl bg-white/70 px-3 py-2">
                  <Clock3 className="h-4 w-4" />
                  {typeof task.distance_km === "number" ? `${task.distance_km.toFixed(2)} km away` : "distance unavailable"}
                </span>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => acceptTask(task.task_id)}
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
                >
                  Accept Task
                </button>
                <button
                  type="button"
                  onClick={() => showDistance(task.task_id)}
                  className="rounded-xl border border-sky-300 bg-white px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-50"
                >
                  Check Distance
                </button>
                <button
                  type="button"
                  onClick={() => skipTask(task.task_id)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Skip
                </button>
              </div>
            </Card>
          ))}
        </div>

        <Card className="col-span-1 md:col-span-4">
          <h3 className="text-lg font-semibold text-slate-900">Live Safety Notes</h3>
          <ul className="mt-4 space-y-3 text-sm text-slate-700">
            <li className="flex gap-2">
              <Siren className="mt-0.5 h-4 w-4 text-rose-600" />
              High-priority alerts are shown first. Always call NGO coordinator after accepting.
            </li>
            <li className="flex gap-2">
              <Siren className="mt-0.5 h-4 w-4 text-amber-600" />
              Carry ID, gloves, and basic first-aid before moving to site.
            </li>
            <li className="flex gap-2">
              <Siren className="mt-0.5 h-4 w-4 text-emerald-600" />
              Mark task complete only after handoff confirmation from field lead.
            </li>
          </ul>
        </Card>
      </section>
    </main>
  );
}
