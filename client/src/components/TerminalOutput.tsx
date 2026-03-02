import { motion, AnimatePresence } from "framer-motion";
import { Terminal, AlertCircle } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TerminalOutputProps {
  content: string | null | any;
  error?: string | null;
  isLoading?: boolean;
  className?: string;
  rawHTML?: boolean;
}

export function TerminalOutput({ content, error, isLoading, className, rawHTML }: TerminalOutputProps) {
  const formatContent = (data: any) => {
    if (typeof data === "string") return data;
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  return (
    <div className={cn(
      "relative w-full rounded-lg bg-[#0a0a0a] border border-border overflow-hidden flex flex-col font-mono text-sm shadow-inner group",
      className
    )}>
      {/* Terminal Header */}
      <div className="flex items-center px-3 py-2 bg-secondary/50 border-b border-border/50 text-xs text-muted-foreground select-none">
        <Terminal className="w-3.5 h-3.5 mr-2" />
        <span>output.log</span>
        <div className="ml-auto flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-border group-hover:bg-destructive/80 transition-colors" />
          <div className="w-2.5 h-2.5 rounded-full bg-border group-hover:bg-warning/80 transition-colors" />
          <div className="w-2.5 h-2.5 rounded-full bg-border group-hover:bg-primary/80 transition-colors" />
        </div>
      </div>

      {/* Terminal Body */}
      <div className="p-4 flex-1 overflow-auto min-h-[160px] max-h-[300px]">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-primary flex items-center"
            >
              <span className="mr-2">Executing query</span>
              <span className="flex space-x-1">
                <span className="animate-bounce">.</span>
                <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: "0.4s" }}>.</span>
              </span>
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-destructive whitespace-pre-wrap flex flex-col gap-2"
            >
              <div className="flex items-center gap-2 font-bold text-glow-destructive">
                <AlertCircle className="w-4 h-4" />
                <span>ERR_EXECUTION_FAILED</span>
              </div>
              <div className="pl-6 border-l-2 border-destructive/30 text-destructive/90">
                {error}
              </div>
            </motion.div>
          ) : content ? (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-primary/90 whitespace-pre-wrap break-all"
            >
              {rawHTML ? (
                <div dangerouslySetInnerHTML={{ __html: formatContent(content) }} />
              ) : (
                formatContent(content)
              )}
              <span className="inline-block w-2 h-4 bg-primary ml-1 animate-blink align-middle" />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-muted-foreground/50"
            >
              Awaiting input...
              <span className="inline-block w-2 h-4 bg-muted-foreground/50 ml-1 animate-blink align-middle" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
