"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Award, CheckCircle2, MapPin, ShieldCheck, User, Wrench } from "lucide-react";

import { Card } from "@/components/ui/card";
import { apiGet } from "@/lib/api-client";
import { getIdentity } from "@/lib/identity";

type VolunteerDetails = {
  volunteer_id: string;
  volunteer_name: string;
  email?: string | null;
  location_text?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  skills: string[];
  preferred_categories: string[];
  is_available: boolean;
  reliability_score: number;
  points_total: number;
  completed_tasks: number;
  total_hours: number;
  on_site_rate: number;
  current_task_id?: string | null;
  current_task_summary?: string | null;
};

type NgoVolunteersResponse = {
  volunteers: VolunteerDetails[];
};

function reliabilityTone(score: number): string {
  if (score >= 85) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (score >= 65) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-rose-100 text-rose-800 border-rose-200";
}

export default function NgoVolunteersPage() {
  const [ngoId, setNgoId] = useState("");
  const [volunteers, setVolunteers] = useState<VolunteerDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const identity = getIdentity("ngo");
    setNgoId(identity.id);
  }, []);

  useEffect(() => {
    if (!ngoId) return;

    setLoading(true);
    apiGet<NgoVolunteersResponse>(`/api/tasks/ngo-volunteers?ngo_id=${encodeURIComponent(ngoId)}`)
      .then((response) => setVolunteers(response.volunteers))
      .catch((requestError) => {
        const message = requestError instanceof Error ? requestError.message : "Failed to load volunteers";
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [ngoId]);

  const topTalent = useMemo(() => volunteers.slice(0, 3), [volunteers]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-mesh p-4 md:p-8">
      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-4 md:grid-cols-12">
        <Card className="col-span-1 md:col-span-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">NGO Command Center</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900 md:text-4xl">Volunteer Intelligence Hub</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-700">
                Full volunteer details, trust/reliability insights, and assignment readiness for high-stakes response planning.
              </p>
            </div>
            <Link href="/dashboard" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Back To Dashboard
            </Link>
          </div>
          {error && <p className="mt-3 rounded-xl bg-rose-100 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
        </Card>

        <Card className="col-span-1 md:col-span-4">
          <p className="text-sm text-slate-500">Total Volunteers</p>
          <p className="mt-1 text-4xl font-bold text-slate-900">{loading ? "-" : volunteers.length}</p>
        </Card>

        <Card className="col-span-1 md:col-span-4">
          <p className="text-sm text-slate-500">Currently Assigned</p>
          <p className="mt-1 text-4xl font-bold text-slate-900">
            {loading ? "-" : volunteers.filter((volunteer) => Boolean(volunteer.current_task_id)).length}
          </p>
        </Card>

        <Card className="col-span-1 md:col-span-4">
          <p className="text-sm text-slate-500">Avg Reliability</p>
          <p className="mt-1 text-4xl font-bold text-slate-900">
            {loading || volunteers.length === 0
              ? "-"
              : (volunteers.reduce((sum, volunteer) => sum + volunteer.reliability_score, 0) / volunteers.length).toFixed(1)}
          </p>
        </Card>

        <Card className="col-span-1 md:col-span-12">
          <h2 className="text-lg font-semibold text-slate-900">Top Field-Ready Volunteers</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            {topTalent.map((volunteer) => (
              <div key={volunteer.volunteer_id} className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <p className="text-sm font-semibold text-slate-900">{volunteer.volunteer_name}</p>
                <p className="mt-1 text-xs text-slate-600">Reliability {volunteer.reliability_score} • {volunteer.points_total} pts</p>
                <p className="mt-1 text-xs text-slate-600">On-site rate {volunteer.on_site_rate.toFixed(1)}%</p>
              </div>
            ))}
            {!loading && topTalent.length === 0 && <p className="text-sm text-slate-600">No volunteer records yet.</p>}
          </div>
        </Card>

        <Card className="col-span-1 md:col-span-12">
          <h2 className="text-lg font-semibold text-slate-900">All Volunteers</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {volunteers.map((volunteer) => (
              <div key={volunteer.volunteer_id} className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{volunteer.volunteer_name}</p>
                    <p className="text-xs text-slate-600">ID {volunteer.volunteer_id.slice(0, 8)}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${reliabilityTone(volunteer.reliability_score)}`}>
                    Trust {volunteer.reliability_score}
                  </span>
                </div>

                <div className="mt-3 space-y-1 text-sm text-slate-700">
                  <p className="inline-flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-500" />
                    {volunteer.email || "No email saved"}
                  </p>
                  <p className="inline-flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-500" />
                    {volunteer.location_text || "Location not set"}
                  </p>
                  <p className="inline-flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-slate-500" />
                    Skills: {volunteer.skills.join(", ") || "General"}
                  </p>
                  <p className="inline-flex items-center gap-2">
                    <Award className="h-4 w-4 text-slate-500" />
                    {volunteer.points_total} points • {volunteer.completed_tasks} completed • {volunteer.total_hours.toFixed(1)}h
                  </p>
                  <p className="inline-flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-slate-500" />
                    On-site verification: {volunteer.on_site_rate.toFixed(1)}%
                  </p>
                  <p className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-slate-500" />
                    {volunteer.current_task_summary
                      ? `Assigned: ${volunteer.current_task_summary}`
                      : volunteer.is_available
                        ? "Available"
                        : "Unavailable"}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {!loading && volunteers.length === 0 && <p className="mt-4 text-sm text-slate-600">No volunteers available yet.</p>}
          {loading && <p className="mt-4 text-sm text-slate-600">Loading volunteers...</p>}
        </Card>
      </section>
    </main>
  );
}
