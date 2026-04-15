import { firebaseAuth } from "@/lib/firebase-client";

export type Role = "ngo" | "volunteer";

type Identity = {
  id: string;
  name: string;
  email?: string;
};

function getStorageKey(role: Role): string {
  return role === "ngo" ? "sra_ngo_identity" : "sra_volunteer_identity";
}

function createFallbackIdentity(role: Role): Identity {
  const key = getStorageKey(role);
  const generatedId = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${role}-${Date.now()}`;
  const identity: Identity = {
    id: generatedId,
    name: role === "ngo" ? "NGO Team" : "Volunteer",
  };
  window.localStorage.setItem(key, JSON.stringify(identity));
  return identity;
}

export function getIdentity(role: Role): Identity {
  const currentUser = firebaseAuth?.currentUser;
  if (currentUser) {
    const identity: Identity = {
      id: currentUser.uid,
      name: currentUser.displayName || (role === "ngo" ? "NGO Team" : "Volunteer"),
      email: currentUser.email || undefined,
    };
    window.localStorage.setItem(getStorageKey(role), JSON.stringify(identity));
    return identity;
  }

  const storedRaw = window.localStorage.getItem(getStorageKey(role));
  if (!storedRaw) {
    return createFallbackIdentity(role);
  }

  try {
    const parsed = JSON.parse(storedRaw) as Identity;
    if (parsed?.id && parsed?.name) {
      return parsed;
    }
    return createFallbackIdentity(role);
  } catch {
    return createFallbackIdentity(role);
  }
}