"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import { apiGet, apiPost } from "@/lib/api-client";
import { getIdentity } from "@/lib/identity";

type SettingsResponse = {
  volunteer_id: string;
  volunteer_name: string;
  email?: string | null;
  preferred_categories: string[];
  skills: string[];
  is_available: boolean;
};

export default function VolunteerSettingsPage() {
  const [volunteerId, setVolunteerId] = useState("");
  const [volunteerName, setVolunteerName] = useState("Volunteer");
  const [email, setEmail] = useState("");
  const [preferredCategories, setPreferredCategories] = useState("Relief, Medical");
  const [skills, setSkills] = useState("First Aid");
  const [isAvailable, setIsAvailable] = useState(true);
  const [locationText, setLocationText] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const identity = getIdentity("volunteer");
    setVolunteerId(identity.id);
    setVolunteerName(identity.name);
    setEmail(identity.email ?? "");
  }, []);

  useEffect(() => {
    if (!volunteerId) return;
    const query = new URLSearchParams({ volunteer_id: volunteerId, volunteer_name: volunteerName });
    apiGet<SettingsResponse>(`/api/tasks/volunteer/settings?${query.toString()}`)
      .then((response) => {
        setVolunteerName(response.volunteer_name);
        setEmail(response.email ?? "");
        setPreferredCategories(response.preferred_categories.join(", "));
        setSkills(response.skills.join(", "));
        setIsAvailable(response.is_available);
      })
      .catch((requestError) => {
        const messageText = requestError instanceof Error ? requestError.message : "Failed to load settings";
        setError(messageText);
      });
  }, [volunteerId, volunteerName]);

  function detectLocation(): void {
    navigator.geolocation?.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationText(`lat:${position.coords.latitude.toFixed(5)}, lng:${position.coords.longitude.toFixed(5)}`);
      },
      () => {
        setError("Location permission denied.");
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }

  async function onSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!volunteerId) return;

    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const response = await apiPost<SettingsResponse>("/api/tasks/volunteer/settings", {
        volunteer_id: volunteerId,
        volunteer_name: volunteerName,
        email,
        preferred_categories: preferredCategories.split(",").map((item) => item.trim()).filter(Boolean),
        skills: skills.split(",").map((item) => item.trim()).filter(Boolean),
        is_available: isAvailable,
        location_text: locationText || null,
        location_lat: coords?.lat,
        location_lng: coords?.lng,
      });
      setVolunteerName(response.volunteer_name);
      setMessage("Settings updated.");
    } catch (requestError) {
      const messageText = requestError instanceof Error ? requestError.message : "Failed to save settings";
      setError(messageText);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-mesh p-4 md:p-8">
      <section className="mx-auto grid max-w-4xl grid-cols-1 gap-4">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Volunteer Console</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">Settings & Preferences</h1>
              <p className="mt-2 text-sm text-slate-700">Manage your availability, categories, and account preferences.</p>
            </div>
            <div className="flex gap-2">
              <Link href="/volunteer" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Offers
              </Link>
              <Link href="/volunteer/active" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Active Tasks
              </Link>
              <Link href="/volunteer/completed" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Completed Tasks
              </Link>
            </div>
          </div>
          {error && <p className="mt-3 rounded-xl bg-rose-100 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
          {message && <p className="mt-3 rounded-xl bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-700">{message}</p>}
        </Card>

        <Card>
          <form onSubmit={onSave} className="space-y-3">
            <input
              required
              value={volunteerName}
              onChange={(event) => setVolunteerName(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              placeholder="Full name"
            />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              placeholder="Email"
            />
            <input
              value={preferredCategories}
              onChange={(event) => setPreferredCategories(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              placeholder="Preferred categories"
            />
            <input
              value={skills}
              onChange={(event) => setSkills(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              placeholder="Skills"
            />
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
              <p className="text-sm font-medium text-slate-700">Available for matching</p>
              <input type="checkbox" checked={isAvailable} onChange={(event) => setIsAvailable(event.target.checked)} />
            </div>
            <input
              value={locationText}
              onChange={(event) => setLocationText(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              placeholder="Location text"
            />
            <button
              type="button"
              onClick={detectLocation}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Use Current Location
            </button>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-70"
            >
              {busy ? "Saving..." : "Save Settings"}
            </button>
          </form>
        </Card>
      </section>
    </main>
  );
}
