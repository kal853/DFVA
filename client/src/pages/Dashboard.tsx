import { useState } from "react";
import { Search, Activity, Globe, FileText, Send } from "lucide-react";
import { ToolCard } from "@/components/ToolCard";
import { TerminalOutput } from "@/components/TerminalOutput";
import { 
  useSearchUsers, 
  usePingNetwork, 
  useFetchUrl, 
  useReadLog 
} from "@/hooks/use-tools";

export default function Dashboard() {
  // Local state for forms
  const [searchQuery, setSearchQuery] = useState("");
  const [pingHost, setPingHost] = useState("");
  const [fetchUrl, setFetchUrl] = useState("");
  const [logFile, setLogFile] = useState("");

  // Mutations
  const searchMutation = useSearchUsers();
  const pingMutation = usePingNetwork();
  const fetchMutation = useFetchUrl();
  const logMutation = useReadLog();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <div className="mb-10 text-center md:text-left">
        <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-3 text-glow">
          Admin Toolkit
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Internal diagnostics and resource management interface. Authorized personnel only. All actions are logged.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        {/* User Search Tool */}
        <ToolCard
          title="Directory Search"
          description="Query internal user database records."
          icon={Search}
          delay={0.1}
        >
          <form 
            onSubmit={(e) => { e.preventDefault(); searchMutation.mutate(searchQuery); }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter username or pattern..."
              className="flex-1 bg-input text-foreground border-border rounded-lg px-4 py-2 text-sm font-mono glow-focus placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={searchMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center min-w-[100px]"
            >
              {searchMutation.isPending ? "..." : "Execute"}
            </button>
          </form>
          <TerminalOutput 
            isLoading={searchMutation.isPending}
            error={searchMutation.error?.message}
            content={searchMutation.data}
          />
        </ToolCard>

        {/* Network Ping Tool */}
        <ToolCard
          title="Network Ping"
          description="Send ICMP ECHO_REQUEST to network hosts."
          icon={Activity}
          delay={0.2}
        >
          <form 
            onSubmit={(e) => { e.preventDefault(); pingMutation.mutate(pingHost); }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={pingHost}
              onChange={(e) => setPingHost(e.target.value)}
              placeholder="Hostname or IP address..."
              className="flex-1 bg-input text-foreground border-border rounded-lg px-4 py-2 text-sm font-mono glow-focus placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={pingMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center min-w-[100px]"
            >
              {pingMutation.isPending ? "..." : "Execute"}
            </button>
          </form>
          <TerminalOutput 
            isLoading={pingMutation.isPending}
            error={pingMutation.error?.message}
            content={pingMutation.data?.output}
          />
        </ToolCard>

        {/* URL Fetcher Tool */}
        <ToolCard
          title="Resource Fetcher"
          description="Retrieve remote resources and endpoints."
          icon={Globe}
          delay={0.3}
        >
          <form 
            onSubmit={(e) => { e.preventDefault(); fetchMutation.mutate(fetchUrl); }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={fetchUrl}
              onChange={(e) => setFetchUrl(e.target.value)}
              placeholder="http://..."
              className="flex-1 bg-input text-foreground border-border rounded-lg px-4 py-2 text-sm font-mono glow-focus placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={fetchMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center min-w-[100px]"
            >
              {fetchMutation.isPending ? "..." : "Execute"}
            </button>
          </form>
          <TerminalOutput 
            isLoading={fetchMutation.isPending}
            error={fetchMutation.error?.message}
            content={fetchMutation.data?.data}
          />
        </ToolCard>

        {/* Log Viewer Tool */}
        <ToolCard
          title="System Logs Viewer"
          description="Read local system diagnostic files."
          icon={FileText}
          delay={0.4}
        >
          <form 
            onSubmit={(e) => { e.preventDefault(); logMutation.mutate(logFile); }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={logFile}
              onChange={(e) => setLogFile(e.target.value)}
              placeholder="Path to log file..."
              className="flex-1 bg-input text-foreground border-border rounded-lg px-4 py-2 text-sm font-mono glow-focus placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={logMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center min-w-[100px]"
            >
              {logMutation.isPending ? "..." : "Execute"}
            </button>
          </form>
          <TerminalOutput 
            isLoading={logMutation.isPending}
            error={logMutation.error?.message}
            content={logMutation.data?.content}
          />
        </ToolCard>
      </div>
    </div>
  );
}
