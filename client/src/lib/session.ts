import { createContext, useContext } from "react";

export type SessionUser = {
  id: number;
  username: string;
  plan: "free" | "pro" | "enterprise";
  walletBalance: string;
};

export type SessionCtx = {
  user: SessionUser | null;
  isLoggedIn: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

export const SessionContext = createContext<SessionCtx>({
  user: null,
  isLoggedIn: false,
  login: async () => {},
  logout: () => {},
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
