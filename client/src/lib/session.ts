import { createContext, useContext } from "react";

export type SessionUser = {
  id: number;
  username: string;
  plan: "free" | "pro" | "enterprise";
  walletBalance: string;
};

// Demo accounts — exposed by username/plan only, never by ID
export const DEMO_ACCOUNTS: SessionUser[] = [
  { id: 2, username: "jdoe",   plan: "pro",        walletBalance: "50.00" },
  { id: 3, username: "asmith", plan: "free",       walletBalance: "0.00"  },
  { id: 1, username: "admin",  plan: "enterprise", walletBalance: "0.00"  },
];

export type SessionCtx = {
  user: SessionUser;
  setUser: (u: SessionUser) => void;
  refreshUser: () => Promise<void>;
};

export const SessionContext = createContext<SessionCtx>({
  user: DEMO_ACCOUNTS[0],
  setUser: () => {},
  refreshUser: async () => {},
});

export const useSession = () => useContext(SessionContext);

export const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, enterprise: 2 };
export const TIER_RANK: Record<string, number> = { FREE: 0, PRO: 1, ENTERPRISE: 2 };

export function canAccessTool(plan: string, toolTier: string): boolean {
  return (PLAN_RANK[plan] ?? 0) >= (TIER_RANK[toolTier] ?? 0);
}

export const PLAN_LABEL: Record<string, string> = {
  free: "Explorer",
  pro: "Member",
  enterprise: "Elite",
};
