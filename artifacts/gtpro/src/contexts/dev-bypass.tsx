import React from "react";

export const IS_DEV = import.meta.env.DEV;
const DEV_BYPASS_KEY = "gtpro_dev_bypass";

export const DevBypassContext = React.createContext<{
  enabled: boolean;
  enable: () => void;
  disable: () => void;
}>({ enabled: false, enable: () => {}, disable: () => {} });

export function DevBypassProvider({ children }: { children: React.ReactNode }) {
  const [devBypass, setDevBypass] = React.useState<boolean>(() => {
    if (!IS_DEV) return false;
    return localStorage.getItem(DEV_BYPASS_KEY) === "true";
  });

  const value = React.useMemo(() => ({
    enabled: devBypass,
    enable: () => { localStorage.setItem(DEV_BYPASS_KEY, "true"); setDevBypass(true); },
    disable: () => { localStorage.removeItem(DEV_BYPASS_KEY); setDevBypass(false); },
  }), [devBypass]);

  return (
    <DevBypassContext.Provider value={value}>
      {children}
    </DevBypassContext.Provider>
  );
}

export function useDevBypass() {
  return React.useContext(DevBypassContext);
}
