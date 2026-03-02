import { useMutation } from "@tanstack/react-query";
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
      
      const res = await fetch(url.toString(), {
        method: api.tools.searchUsers.method,
      });
      
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
      
      const res = await fetch(url.toString(), {
        method: api.tools.readLog.method,
      });
      
      const data = await handleResponse(res);
      return api.tools.readLog.responses[200].parse(data);
    },
  });
}
