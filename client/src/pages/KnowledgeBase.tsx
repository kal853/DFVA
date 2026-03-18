import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Upload, Trash2, FileText, FileCode, File, RefreshCw, AlertCircle, Lock } from "lucide-react";
import { useSession } from "@/lib/session";
import { useToast } from "@/hooks/use-toast";

type RagDocument = {
  id: number;
  userId: number;
  filename: string;
  contentType: string;
  chunkCount: number;
  status: string;
  uploadedAt: string;
};

function FileIcon({ contentType }: { contentType: string }) {
  if (contentType === "application/pdf") return <FileText className="w-4 h-4 text-red-400" />;
  if (contentType === "text/markdown") return <FileCode className="w-4 h-4 text-blue-400" />;
  return <File className="w-4 h-4 text-muted-foreground" />;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    processing: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    ready:      "bg-green-500/10  text-green-400  border-green-500/20",
    error:      "bg-red-500/10   text-red-400    border-red-500/20",
  };
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${map[status] ?? "bg-muted text-muted-foreground border-border"}`}>
      {status === "processing" && <RefreshCw className="inline w-2.5 h-2.5 mr-1 animate-spin" />}
      {status}
    </span>
  );
}

export default function KnowledgeBase() {
  const { user } = useSession();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const userId = user?.id ?? 0;
  const isEnterprise = user?.plan === "enterprise";

  const { data: docs = [], isLoading } = useQuery<RagDocument[]>({
    queryKey: ["/api/rag/documents", userId],
    queryFn: () => fetch(`/api/rag/documents?userId=${userId}`).then(r => r.json()),
    enabled: !!userId,
    refetchInterval: 5000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/rag/documents/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rag/documents", userId] });
      toast({ title: "Document deleted" });
    },
  });

  async function handleUpload(file: File) {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("userId", String(userId));
      fd.append("username", user?.username ?? "unknown");

      // VULN: plan sent as client header — server trusts this with no DB check
      const res = await fetch("/api/rag/upload", {
        method: "POST",
        headers: { "X-User-Plan": user?.plan ?? "free" },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast({ title: "Upload started", description: `${file.name} is being indexed.` });
      qc.invalidateQueries({ queryKey: ["/api/rag/documents", userId] });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleUpload(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleUpload(f);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display tracking-tight text-foreground">
              ARIA Knowledge Base
            </h1>
            <p className="text-sm text-muted-foreground">Enterprise · Internal Document Indexing</p>
          </div>
        </div>
        <p className="text-muted-foreground text-sm mt-3 max-w-2xl">
          Upload internal documentation (PDFs, Markdown, text files) to extend ARIA's knowledge.
          Uploaded content is chunked, embedded, and retrieved automatically when relevant to support queries.
        </p>
      </div>

      {/* Plan gate warning */}
      {!isEnterprise && (
        <div
          data-testid="banner-enterprise-gate"
          className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm"
        >
          <Lock className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-amber-400">Enterprise plan required</p>
            <p className="text-muted-foreground mt-0.5">
              Your current plan is <span className="font-mono text-foreground">{user?.plan ?? "free"}</span>.
              Upgrade to Enterprise to upload documents. You can still browse this page.
            </p>
          </div>
        </div>
      )}

      {/* Upload zone */}
      <div
        data-testid="zone-upload"
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => isEnterprise && fileRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl px-6 py-10 text-center transition-all mb-8 ${
          dragging
            ? "border-primary bg-primary/5"
            : isEnterprise
              ? "border-border/60 hover:border-primary/50 hover:bg-muted/20 cursor-pointer"
              : "border-border/30 opacity-50 cursor-not-allowed"
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.md,.txt,text/plain,text/markdown,application/pdf"
          className="hidden"
          onChange={onFileChange}
          data-testid="input-file-upload"
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm font-medium text-foreground">Uploading and indexing…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className={`w-8 h-8 ${dragging ? "text-primary" : "text-muted-foreground"}`} />
            <p className="text-sm font-medium text-foreground">
              {isEnterprise ? "Drop a file or click to browse" : "Upload unavailable on your plan"}
            </p>
            <p className="text-xs text-muted-foreground">PDF, Markdown, or plain text · max 5 MB</p>
          </div>
        )}
      </div>

      {/* Document list */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Indexed Documents ({docs.length})
        </h2>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 rounded-xl bg-muted/20 animate-pulse" />
            ))}
          </div>
        ) : docs.length === 0 ? (
          <div
            data-testid="state-empty-docs"
            className="flex flex-col items-center gap-2 py-16 text-center"
          >
            <FileText className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No documents indexed yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {docs.map(doc => (
              <div
                key={doc.id}
                data-testid={`card-doc-${doc.id}`}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/60 bg-card/40 hover:bg-card/60 transition-colors"
              >
                <FileIcon contentType={doc.contentType} />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium text-foreground truncate"
                    data-testid={`text-doc-filename-${doc.id}`}
                  >
                    {doc.filename}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {doc.chunkCount} chunk{doc.chunkCount !== 1 ? "s" : ""} ·{" "}
                    {new Date(doc.uploadedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <StatusBadge status={doc.status} />
                <button
                  data-testid={`button-delete-doc-${doc.id}`}
                  onClick={() => deleteMutation.mutate(doc.id)}
                  className="ml-2 p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Delete document"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security notice (deliberate irony) */}
      <div
        data-testid="banner-security-notice"
        className="mt-10 flex items-start gap-3 rounded-xl border border-border/60 bg-muted/10 px-4 py-3 text-xs text-muted-foreground"
      >
        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground/60" />
        <p>
          Uploaded documents are stored in a shared vector index and may influence ARIA responses
          across your organisation. Ensure all uploaded content complies with your data classification policy.
          Documents are processed and indexed within approximately 30 seconds of upload.
        </p>
      </div>
    </div>
  );
}
