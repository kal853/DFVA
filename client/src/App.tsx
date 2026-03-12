import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ShoppingCart, Menu, X, Zap } from "lucide-react";
import { useState, createContext, useContext, useEffect } from "react";
import Home from "./pages/Home";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Membership from "./pages/Membership";
import NotFound from "@/pages/not-found";

// ── Cart Context ─────────────────────────────────────────────────────────────
export type CartItem = { id: number; slug: string; name: string; price: number; quantity: number };

type CartCtx = {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity">) => void;
  remove: (id: number) => void;
  update: (id: number, qty: number) => void;
  clear: () => void;
  total: number;
  count: number;
};

const CartContext = createContext<CartCtx>({} as CartCtx);
export const useCart = () => useContext(CartContext);

function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem("apex-cart") || "[]"); } catch { return []; }
  });

  useEffect(() => { localStorage.setItem("apex-cart", JSON.stringify(items)); }, [items]);

  const add = (item: Omit<CartItem, "quantity">) =>
    setItems(prev => {
      const ex = prev.find(i => i.id === item.id);
      return ex ? prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i) : [...prev, { ...item, quantity: 1 }];
    });

  const remove = (id: number) => setItems(prev => prev.filter(i => i.id !== id));
  const update = (id: number, qty: number) =>
    setItems(prev => qty <= 0 ? prev.filter(i => i.id !== id) : prev.map(i => i.id === id ? { ...i, quantity: qty } : i));
  const clear = () => setItems([]);
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return <CartContext.Provider value={{ items, add, remove, update, clear, total, count }}>{children}</CartContext.Provider>;
}

// ── Nav ──────────────────────────────────────────────────────────────────────
function NavBar() {
  const [location] = useLocation();
  const { count } = useCart();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/", label: "Home" },
    { href: "/products", label: "Shop" },
    { href: "/membership", label: "Membership" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/">
          <span className="flex items-center gap-2 cursor-pointer group">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-foreground group-hover:text-primary transition-colors">
              APEX<span className="text-primary">GEAR</span>
            </span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {links.map(({ href, label }) => (
            <Link key={href} href={href}>
              <span className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all ${
                location === href
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}>{label}</span>
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/cart">
            <span className="relative cursor-pointer p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all">
              <ShoppingCart className="w-5 h-5" />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </span>
          </Link>
          <button className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground" onClick={() => setOpen(!open)}>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-border/60 bg-background px-4 py-3 flex flex-col gap-1">
          {links.map(({ href, label }) => (
            <Link key={href} href={href}>
              <span onClick={() => setOpen(false)} className="block px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground cursor-pointer">{label}</span>
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60 py-10 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 font-display font-bold text-foreground">
          <Zap className="w-4 h-4 text-primary" /> APEX<span className="text-primary">GEAR</span>
        </div>
        <p>© 2025 ApexGear. All rights reserved.</p>
        <div className="flex gap-4">
          {["Privacy", "Terms", "Contact"].map(l => (
            <span key={l} className="hover:text-foreground cursor-pointer transition-colors">{l}</span>
          ))}
        </div>
      </div>
    </footer>
  );
}

function Router() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <NavBar />
      <main className="flex-1">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/products" component={Products} />
          <Route path="/products/:slug" component={ProductDetail} />
          <Route path="/membership" component={Membership} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CartProvider>
          <Toaster />
          <Router />
        </CartProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
