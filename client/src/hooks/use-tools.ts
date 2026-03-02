import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

// Utility to handle standard backend errors
async function handleResponse(res: Response) {
  if (!res.ok) {
    let errorMessage = `HTTP Error ${res.status}`;
    try {
      const errData = await res.json();
      if (errData.message) errorMessage = errData.message;
    } catch {
      const text = await res.text();
      if (text) errorMessage = text;
    }
    throw new Error(errorMessage);
  }
  return res.json();
}

export function useSearchUsers() {
  return useMutation({
    mutationFn: async (query: string) => {
      const url = new URL(window.location.origin + api.tools.searchUsers.path);
      if (query) url.searchParams.set("query", query);
      const res = await fetch(url.toString(), { method: api.tools.searchUsers.method });
      const data = await handleResponse(res);
      return api.tools.searchUsers.responses[200].parse(data);
    },
  });
}

export function usePingNetwork() {
  return useMutation({
    mutationFn: async (host: string) => {
      const payload = api.tools.ping.input.parse({ host });
      const res = await fetch(api.tools.ping.path, {
        method: api.tools.ping.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await handleResponse(res);
      return api.tools.ping.responses[200].parse(data);
    },
  });
}

export function useFetchUrl() {
  return useMutation({
    mutationFn: async (url: string) => {
      const payload = api.tools.fetchUrl.input.parse({ url });
      const res = await fetch(api.tools.fetchUrl.path, {
        method: api.tools.fetchUrl.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await handleResponse(res);
      return api.tools.fetchUrl.responses[200].parse(data);
    },
  });
}

export function useReadLog() {
  return useMutation({
    mutationFn: async (filename: string) => {
      const url = new URL(window.location.origin + api.tools.readLog.path);
      if (filename) url.searchParams.set("filename", filename);
      const res = await fetch(url.toString(), { method: api.tools.readLog.method });
      const data = await handleResponse(res);
      return api.tools.readLog.responses[200].parse(data);
    },
  });
}

export function useDeserialize() {
  return useMutation({
    mutationFn: async (data: string) => {
      const payload = api.tools.deserialize.input.parse({ data });
      const res = await fetch(api.tools.deserialize.path, {
        method: api.tools.deserialize.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const resData = await handleResponse(res);
      return api.tools.deserialize.responses[200].parse(resData);
    },
  });
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: async (bio: string) => {
      const payload = api.tools.updateProfile.input.parse({ bio });
      const res = await fetch(api.tools.updateProfile.path, {
        method: api.tools.updateProfile.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await handleResponse(res);
      return api.tools.updateProfile.responses[200].parse(data);
    },
  });
}

export function useGetDebugInfo() {
  return useQuery({
    queryKey: [api.tools.debugInfo.path],
    queryFn: async () => {
      const res = await fetch(api.tools.debugInfo.path);
      const data = await handleResponse(res);
      return api.tools.debugInfo.responses[200].parse(data);
    },
    enabled: false,
  });
}

export function useBypassAuth() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.tools.bypassAuth.path, {
        method: api.tools.bypassAuth.method,
        // Header is intentionally missing or can be added manually for demo
        // headers: { "x-admin-bypass": "true" }
      });
      const data = await handleResponse(res);
      return data;
    },
  });
}
