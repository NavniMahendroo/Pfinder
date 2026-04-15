import AuthClient from "./auth-client";

type Role = "ngo" | "volunteer";

export default function AuthPage({
  searchParams,
}: {
  searchParams?: { role?: string };
}) {
  const initialRole: Role = searchParams?.role === "volunteer" ? "volunteer" : "ngo";
  return <AuthClient initialRole={initialRole} />;
}
