import { ReactNode } from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface ToolCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
  delay?: number;
}

export function ToolCard({ title, description, icon: Icon, children, delay = 0 }: ToolCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className="glass-panel rounded-xl overflow-hidden flex flex-col relative group"
    >
      {/* Decorative top border gradient */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="p-6 border-b border-border/50 bg-secondary/20">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 group-hover:shadow-[0_0_15px_rgba(22,163,74,0.3)] transition-all duration-300">
            <Icon className="w-5 h-5" />
          </div>
          <h3 className="text-xl font-bold font-display tracking-tight text-foreground group-hover:text-glow transition-all">
            {title}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground pl-11">
          {description}
        </p>
      </div>
      
      <div className="p-6 flex-1 flex flex-col gap-4 bg-card/40">
        {children}
      </div>
    </motion.div>
  );
}
