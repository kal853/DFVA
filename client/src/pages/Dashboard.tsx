import { useState } from "react";
import { Search, Activity, Globe, FileText, Code, ShieldAlert, UserCircle, Info, FileJson, Lock, Share2, Zap } from "lucide-react";
import { ToolCard } from "@/components/ToolCard";
import { TerminalOutput } from "@/components/TerminalOutput";
import { 
  useSearchUsers, 
  usePingNetwork, 
  useFetchUrl, 
  useReadLog,
  useDeserialize,
  useUpdateProfile,
  useGetDebugInfo,
  useBypassAuth,
  useViewInvoice,
  useDeactivateUser,
  useRedirect,
  useCalculateDiscount,
  useGenerateToken,
  useProcessFile
} from "@/hooks/use-tools";

export default function Dashboard() {
  // Local state for original tools
  const [searchQuery, setSearchQuery] = useState("");
  const [pingHost, setPingHost] = useState("");
  const [fetchUrl, setFetchUrl] = useState("");
  const [logFile, setLogFile] = useState("");
  const [configData, setConfigData] = useState("{ name: 'Internal' }");
  const [userBio, setUserBio] = useState("<img src=x onerror=alert('XSS')>");

  // Local state for new vulnerabilities
  const [invoiceId, setInvoiceId] = useState("1");
  const [deactivateUserId, setDeactivateUserId] = useState("2");
  const [redirectUrl, setRedirectUrl] = useState("https://evil.com");
  const [baseAmount, setBaseAmount] = useState("1000");
  const [coupons, setCoupons] = useState("PERCENT50,PERCENT50");
  const [protoPayload, setProtoPayload] = useState('{ "__proto__": { "admin": true } }');

  // Original mutations
  const searchMutation = useSearchUsers();
  const pingMutation = usePingNetwork();
  const fetchMutation = useFetchUrl();
  const logMutation = useReadLog();
  const deserializeMutation = useDeserialize();
  const profileMutation = useUpdateProfile();
  const debugInfo = useGetDebugInfo();
  const authMutation = useBypassAuth();

  // New mutations
  const invoiceMutation = useViewInvoice();
  const deactivateMutation = useDeactivateUser();
  const redirectMutation = useRedirect();
  const discountMutation = useCalculateDiscount();
  const tokenMutation = useGenerateToken();
  const fileMutation = useProcessFile();

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
        {/* Original Tools */}
        <ToolCard
          title="Directory Search"
          description="Query internal user database records (SQLi)."
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

        <ToolCard
          title="Network Ping"
          description="Send ICMP ECHO_REQUEST to network hosts (Cmd Injection)."
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
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50"
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

        <ToolCard
          title="Resource Fetcher"
          description="Retrieve remote resources and endpoints (SSRF)."
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
              className="flex-1 bg-input text-foreground border-border rounded-lg px-4 py-2 text-sm font-mono glow-focus"
            />
            <button
              type="submit"
              disabled={fetchMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg font-medium"
            >
              Execute
            </button>
          </form>
          <TerminalOutput 
            isLoading={fetchMutation.isPending}
            error={fetchMutation.error?.message}
            content={fetchMutation.data?.data}
          />
        </ToolCard>

        <ToolCard
          title="System Logs Viewer"
          description="Read local system diagnostic files (Path Traversal)."
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
              className="flex-1 bg-input text-foreground border-border rounded-lg px-4 py-2 text-sm font-mono glow-focus"
            />
            <button
              type="submit"
              disabled={logMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg font-medium"
            >
              Execute
            </button>
          </form>
          <TerminalOutput 
            isLoading={logMutation.isPending}
            error={logMutation.error?.message}
            content={logMutation.data?.content}
          />
        </ToolCard>

        <ToolCard
          title="Config Parser"
          description="Update configuration via JS object string (Insecure Deserialization)."
          icon={Code}
          delay={0.5}
        >
          <form 
            onSubmit={(e) => { e.preventDefault(); deserializeMutation.mutate(configData); }}
            className="flex flex-col gap-2"
          >
            <textarea
              value={configData}
              onChange={(e) => setConfigData(e.target.value)}
              rows={2}
              className="w-full bg-input text-foreground border-border rounded-lg px-4 py-2 text-sm font-mono glow-focus"
            />
            <button
              type="submit"
              disabled={deserializeMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg font-medium"
            >
              Parse Config
            </button>
          </form>
          <TerminalOutput 
            isLoading={deserializeMutation.isPending}
            error={deserializeMutation.error?.message}
            content={deserializeMutation.data}
          />
        </ToolCard>

        <ToolCard
          title="Admin Panel Stats"
          description="View privileged system statistics (Broken Auth)."
          icon={ShieldAlert}
          delay={0.6}
        >
          <button
            onClick={() => authMutation.mutate()}
            disabled={authMutation.isPending}
            className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 px-4 py-2 rounded-lg font-medium transition-all"
          >
            Fetch Sensitive Stats
          </button>
          <TerminalOutput 
            isLoading={authMutation.isPending}
            error={authMutation.error?.message}
            content={authMutation.data}
          />
        </ToolCard>

        <ToolCard
          title="Profile Update"
          description="Update your user profile bio (Reflected XSS)."
          icon={UserCircle}
          delay={0.7}
        >
          <form 
            onSubmit={(e) => { e.preventDefault(); profileMutation.mutate(userBio); }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={userBio}
              onChange={(e) => setUserBio(e.target.value)}
              className="flex-1 bg-input text-foreground border-border rounded-lg px-4 py-2 text-sm font-mono glow-focus"
            />
            <button type="submit" disabled={profileMutation.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg font-medium">Update</button>
          </form>
          <TerminalOutput 
            isLoading={profileMutation.isPending}
            error={profileMutation.error?.message}
            content={profileMutation.data?.message}
            rawHTML={true}
          />
        </ToolCard>

        <ToolCard
          title="Debug Info"
          description="Dump system environment information (Info Exposure)."
          icon={Info}
          delay={0.8}
        >
          <button
            onClick={() => debugInfo.refetch()}
            disabled={debugInfo.isFetching}
            className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 px-4 py-2 rounded-lg font-medium transition-all"
          >
            Load Debug Context
          </button>
          <TerminalOutput 
            isLoading={debugInfo.isFetching}
            error={debugInfo.error?.message}
            content={debugInfo.data}
          />
        </ToolCard>

        {/* NEW VULNERABILITIES */}
        <ToolCard
          title="View Invoice"
          description="Retrieve invoice by ID (IDOR - no ownership checks)."
          icon={FileJson}
          delay={0.9}
        >
          <form 
            onSubmit={(e) => { e.preventDefault(); invoiceMutation.mutate(parseInt(invoiceId)); }}
            className="flex gap-2"
          >
            <input
              type="number"
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
              placeholder="Invoice ID..."
              className="flex-1 bg-input text-foreground border-border rounded-lg px-4 py-2 text-sm font-mono glow-focus"
            />
            <button type="submit" disabled={invoiceMutation.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg font-medium">View</button>
          </form>
          <TerminalOutput 
            isLoading={invoiceMutation.isPending}
            error={invoiceMutation.error?.message}
            content={invoiceMutation.data}
          />
        </ToolCard>

        <ToolCard
          title="Deactivate User"
          description="Admin action to deactivate users (Broken Authorization)."
          icon={Lock}
          delay={1.0}
        >
          <form 
            onSubmit={(e) => { e.preventDefault(); deactivateMutation.mutate(parseInt(deactivateUserId)); }}
            className="flex gap-2"
          >
            <input
              type="number"
              value={deactivateUserId}
              onChange={(e) => setDeactivateUserId(e.target.value)}
              placeholder="User ID..."
              className="flex-1 bg-input text-foreground border-border rounded-lg px-4 py-2 text-sm font-mono glow-focus"
            />
            <button type="submit" disabled={deactivateMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 px-4 py-2 rounded-lg font-medium">Deactivate</button>
          </form>
          <TerminalOutput 
            isLoading={deactivateMutation.isPending}
            error={deactivateMutation.error?.message}
            content={deactivateMutation.data?.message}
          />
        </ToolCard>

        <ToolCard
          title="Open Redirect"
          description="Redirect to external URL (Open Redirect)."
          icon={Share2}
          delay={1.1}
        >
          <form 
            onSubmit={(e) => { e.preventDefault(); redirectMutation.mutate(redirectUrl); }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={redirectUrl}
              onChange={(e) => setRedirectUrl(e.target.value)}
              placeholder="Target URL..."
              className="flex-1 bg-input text-foreground border-border rounded-lg px-4 py-2 text-sm font-mono glow-focus"
            />
            <button type="submit" disabled={redirectMutation.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg font-medium">Redirect</button>
          </form>
          <TerminalOutput 
            isLoading={redirectMutation.isPending}
            error={redirectMutation.error?.message}
            content={redirectMutation.data}
          />
        </ToolCard>

        <ToolCard
          title="Apply Coupons"
          description="Calculate discount with stacking bug (Business Logic)."
          icon={Zap}
          delay={1.2}
        >
          <form 
            onSubmit={(e) => { e.preventDefault(); discountMutation.mutate(parseFloat(baseAmount), coupons.split(',')); }}
            className="flex flex-col gap-2"
          >
            <input
              type="number"
              value={baseAmount}
              onChange={(e) => setBaseAmount(e.target.value)}
              placeholder="Base amount..."
              className="w-full bg-input text-foreground border-border rounded-lg px-4 py-2 text-sm font-mono glow-focus"
            />
            <input
              type="text"
              value={coupons}
              onChange={(e) => setCoupons(e.target.value)}
              placeholder="Coupons (comma-separated)..."
              className="w-full bg-input text-foreground border-border rounded-lg px-4 py-2 text-sm font-mono glow-focus"
            />
            <button type="submit" disabled={discountMutation.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg font-medium">Calculate</button>
          </form>
          <TerminalOutput 
            isLoading={discountMutation.isPending}
            error={discountMutation.error?.message}
            content={discountMutation.data}
          />
        </ToolCard>

        <ToolCard
          title="Generate Token"
          description="Create security token (Weak Randomness)."
          icon={Code}
          delay={1.3}
        >
          <button
            onClick={() => tokenMutation.mutate()}
            disabled={tokenMutation.isPending}
            className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 px-4 py-2 rounded-lg font-medium"
          >
            {tokenMutation.isPending ? "Generating..." : "Generate Token"}
          </button>
          <TerminalOutput 
            isLoading={tokenMutation.isPending}
            error={tokenMutation.error?.message}
            content={tokenMutation.data}
          />
        </ToolCard>

        <ToolCard
          title="Process File"
          description="Parse file with operations (Prototype Pollution)."
          icon={FileJson}
          delay={1.4}
        >
          <form 
            onSubmit={(e) => { e.preventDefault(); fileMutation.mutate("config.json", protoPayload); }}
            className="flex flex-col gap-2"
          >
            <textarea
              value={protoPayload}
              onChange={(e) => setProtoPayload(e.target.value)}
              rows={2}
              className="w-full bg-input text-foreground border-border rounded-lg px-4 py-2 text-sm font-mono glow-focus"
            />
            <button type="submit" disabled={fileMutation.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg font-medium">Process</button>
          </form>
          <TerminalOutput 
            isLoading={fileMutation.isPending}
            error={fileMutation.error?.message}
            content={fileMutation.data}
          />
        </ToolCard>
      </div>
    </div>
  );
}
