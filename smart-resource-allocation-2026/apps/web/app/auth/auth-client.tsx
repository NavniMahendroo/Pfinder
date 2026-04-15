"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";

import { firebaseAuth, isFirebaseClientConfigured } from "@/lib/firebase-client";

type Role = "ngo" | "volunteer";
type Mode = "signin" | "signup";

export default function AuthClient({ initialRole }: { initialRole: Role }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [role, setRole] = useState<Role>(initialRole);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const roleLabel = useMemo(() => (role === "ngo" ? "NGO Team" : "Volunteer"), [role]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!isFirebaseClientConfigured || !firebaseAuth) {
      setError("Missing NEXT_PUBLIC_FIREBASE_* values in root .env");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        if (fullName.trim()) {
          await updateProfile(cred.user, { displayName: fullName.trim() });
        }
      } else {
        await signInWithEmailAndPassword(firebaseAuth, email, password);
      }

      const activeUser = firebaseAuth.currentUser;
      const identity = {
        id: activeUser?.uid ?? `${role}-${Date.now()}`,
        name: activeUser?.displayName || fullName.trim() || (role === "ngo" ? "NGO Team" : "Volunteer"),
        email: activeUser?.email || email,
      };

      if (typeof window !== "undefined") {
        window.localStorage.setItem("sra_user_role", role);
        window.localStorage.setItem(role === "ngo" ? "sra_ngo_identity" : "sra_volunteer_identity", JSON.stringify(identity));
      }
      router.push(role === "ngo" ? "/dashboard" : "/volunteer");
    } catch (submissionError) {
      const rawMessage = submissionError instanceof Error ? submissionError.message : "Authentication failed";
      const normalized = rawMessage.toLowerCase();
      const message = normalized.includes("auth/configuration-not-found")
        ? "Firebase Auth is not fully configured. Enable Email/Password provider and add localhost to Authorized domains in Firebase Console."
        : rawMessage;
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="landing-wrap min-h-screen px-6 py-10 md:px-10">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      <section className="mx-auto grid w-full max-w-5xl gap-8 md:grid-cols-[1fr_1.1fr] md:items-center">
        <article className="animate-float-up">
          <Link href="/" className="text-sm font-semibold text-slate-700 underline-offset-4 hover:underline">
            Back to Home
          </Link>
          <h1 className="mt-4 text-4xl font-extrabold text-slate-900 md:text-5xl">{roleLabel} Access</h1>
          <p className="mt-3 text-slate-700">
            Sign in to coordinate emergency response, manage assignments, and monitor impact in real time.
          </p>
        </article>

        <div className="auth-card animate-float-up rounded-3xl p-6 shadow-glow" style={{ animationDelay: "120ms" }}>
          <div className="mb-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRole("ngo")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${role === "ngo" ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}
            >
              NGO
            </button>
            <button
              type="button"
              onClick={() => setRole("volunteer")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${role === "volunteer" ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}
            >
              Volunteer
            </button>
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${mode === "signin" ? "bg-sky-700 text-white" : "bg-white text-slate-700"}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${mode === "signup" ? "bg-emerald-700 text-white" : "bg-white text-slate-700"}`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            {!isFirebaseClientConfigured && (
              <p className="rounded-xl border border-amber-300 bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900">
                Configure NEXT_PUBLIC_FIREBASE_* keys in .env to enable sign-in/sign-up.
              </p>
            )}

            {mode === "signup" && (
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="fullName">
                  Full Name
                </label>
                <input
                  id="fullName"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-slate-300 transition focus:ring"
                  placeholder="Name"
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-slate-300 transition focus:ring"
                placeholder="you@example.org"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-slate-300 transition focus:ring"
                placeholder="Minimum 6 characters"
              />
            </div>

            {error && <p className="text-sm font-medium text-rose-700">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {busy ? "Please wait..." : mode === "signin" ? `Sign In as ${roleLabel}` : `Create ${roleLabel} Account`}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
