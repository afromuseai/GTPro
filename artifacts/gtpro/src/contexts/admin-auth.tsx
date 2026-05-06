import React, { createContext, useContext, useState, useEffect } from "react";
import { useUser } from "@clerk/react";
import { DevBypassContext, IS_DEV } from "@/contexts/dev-bypass";

interface AdminAuthState {
  isAdmin: boolean;
  loading: boolean;
}

export const AdminAuthContext = createContext<AdminAuthState>({
  isAdmin: false,
  loading: true,
});

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const { enabled: devBypass } = useContext(DevBypassContext);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Dev bypass mode — grant full admin access for local testing
    if (IS_DEV && devBypass) {
      setIsAdmin(true);
      setLoading(false);
      return;
    }

    if (!isLoaded) return;

    const email = user?.emailAddresses?.[0]?.emailAddress;

    if (!email) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/check?email=${encodeURIComponent(email)}`);
        if (!cancelled) {
          if (res.ok) {
            const data = await res.json() as { isAdmin: boolean };
            setIsAdmin(data.isAdmin === true);
          } else {
            setIsAdmin(false);
          }
        }
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user, isLoaded, devBypass]);

  return (
    <AdminAuthContext.Provider value={{ isAdmin, loading }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}
