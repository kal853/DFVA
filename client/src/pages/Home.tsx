import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Star, Truck, RefreshCw, Shield, Zap } from "lucide-react";
import type { Product } from "@shared/schema";
import { useCart } from "../App";

function StarRating({ rating, count }: { rating: string; count: number }) {
  const r = parseFloat(rating);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex">
        {[1,2,3,4,5].map(i => (
          <Star key={i} className={`w-3 h-3 ${i <= Math.round(r) ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
        ))}
      </div>
      <span className="text-xs text-muted-foreground font-mono">({count})</span>
    </div>
  );
}

function ProductCard({ product, index }: { product: Product; index: number }) {
  const { add } = useCart();
  const CATEGORY_GRADIENT: Record<string, string> = {
    keyboards: "from-primary/20 to-primary/5",
    switches: "from-blue-500/20 to-blue-500/5",
    keycaps: "from-purple-500/20 to-purple-500/5",
    accessories: "from-amber-500/20 to-amber-500/5",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="group glass-panel rounded-xl overflow-hidden flex flex-col hover-elevate"
    >
      {/* Product image placeholder */}
      <Link href={`/products/${product.slug}`}>
        <div className={`relative h-48 bg-gradient-to-br ${CATEGORY_GRADIENT[product.category] ?? "from-muted/40 to-muted/10"} flex items-center justify-center cursor-pointer`}>
          <div className="flex flex-col items-center gap-2 opacity-40 group-hover:opacity-60 transition-opacity">
            <Zap className="w-12 h-12 text-primary" />
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">{product.category}</span>
          </div>
          {product.badge && (
            <span className="absolute top-3 left-3 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider">
              {product.badge}
            </span>
          )}
        </div>
      </Link>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <StarRating rating={product.rating ?? "4.5"} count={product.reviewCount ?? 0} />
        <Link href={`/products/${product.slug}`}>
          <h3 className="font-display font-bold text-foreground group-hover:text-primary transition-colors cursor-pointer leading-tight">
            {product.name}
          </h3>
        </Link>
        <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{product.description}</p>
        <div className="flex items-center justify-between mt-2 gap-2">
          <span className="text-xl font-bold font-mono text-foreground">${parseFloat(product.price).toFixed(2)}</span>
          <button
            data-testid={`button-add-cart-${product.id}`}
            onClick={() => add({ id: product.id, slug: product.slug, name: product.name, price: parseFloat(product.price) })}
            className="bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-sm font-medium transition-all"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </motion.div>
  );
}

const PERKS = [
  { icon: Truck, title: "Free Shipping", desc: "On all orders over $75" },
  { icon: Shield, title: "2-Year Warranty", desc: "On all APEX keyboards" },
  { icon: RefreshCw, title: "30-Day Returns", desc: "No questions asked" },
  { icon: Zap, title: "Fast Assembly", desc: "Ships in 1–2 business days" },
];

export default function Home() {
  const { data: featured, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products/featured"],
    queryFn: async () => {
      const res = await fetch("/api/products/featured");
      return res.json();
    },
  });

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 relative">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-6">
              <Zap className="w-3.5 h-3.5" />
              Built for precision typing
            </div>
            <h1 className="text-5xl sm:text-6xl font-display font-bold text-foreground leading-tight mb-6">
              Craft your<br />
              <span className="text-primary">perfect build.</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
              Premium mechanical keyboards, switches, and accessories for enthusiasts who won't settle. Hot-swap. QMK. Aluminum.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/products">
                <span className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-6 py-3 font-medium cursor-pointer transition-all">
                  Shop Now <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
              <Link href="/products?category=keyboards">
                <span className="inline-flex items-center gap-2 border border-border rounded-lg px-6 py-3 font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-all">
                  View Keyboards
                </span>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Perks bar */}
      <section className="border-y border-border/60 bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          {PERKS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-display font-bold text-foreground">Featured</h2>
            <p className="text-muted-foreground mt-1">Our most popular builds and components.</p>
          </div>
          <Link href="/products">
            <span className="flex items-center gap-1.5 text-sm text-primary hover:underline cursor-pointer font-medium">
              View all <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-72 rounded-xl bg-card/50 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featured?.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        )}
      </section>

      {/* Category strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <h2 className="text-2xl font-display font-bold text-foreground mb-6">Shop by Category</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { key: "keyboards", label: "Keyboards", color: "from-primary/30 to-primary/5" },
            { key: "switches", label: "Switches", color: "from-blue-500/30 to-blue-500/5" },
            { key: "keycaps", label: "Keycaps", color: "from-purple-500/30 to-purple-500/5" },
            { key: "accessories", label: "Accessories", color: "from-amber-500/30 to-amber-500/5" },
          ].map(cat => (
            <Link key={cat.key} href={`/products?category=${cat.key}`}>
              <div className={`h-28 rounded-xl bg-gradient-to-br ${cat.color} border border-border/50 flex items-center justify-center cursor-pointer hover-elevate transition-all group`}>
                <span className="font-display font-bold text-foreground group-hover:text-primary transition-colors">{cat.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
