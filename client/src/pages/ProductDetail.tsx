import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import { Star, ArrowLeft, ShoppingCart, Check, Zap, Package } from "lucide-react";
import { useState } from "react";
import type { Product } from "@shared/schema";
import { useCart } from "../App";
import { useToast } from "@/hooks/use-toast";

function StarRating({ rating, count }: { rating: string; count: number }) {
  const r = parseFloat(rating);
  return (
    <div className="flex items-center gap-2">
      <div className="flex">
        {[1,2,3,4,5].map(i => (
          <Star key={i} className={`w-4 h-4 ${i <= Math.round(r) ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
        ))}
      </div>
      <span className="text-sm text-muted-foreground font-mono">{rating} · {count} reviews</span>
    </div>
  );
}

const CATEGORY_GRADIENT: Record<string, string> = {
  keyboards: "from-primary/30 via-primary/10 to-transparent",
  switches: "from-blue-500/30 via-blue-500/10 to-transparent",
  keycaps: "from-purple-500/30 via-purple-500/10 to-transparent",
  accessories: "from-amber-500/30 via-amber-500/10 to-transparent",
};

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { add, items } = useCart();
  const { toast } = useToast();
  const [added, setAdded] = useState(false);

  const { data: product, isLoading, error } = useQuery<Product>({
    queryKey: ["/api/products", slug],
    queryFn: async () => {
      const res = await fetch(`/api/products/${slug}`);
      if (!res.ok) throw new Error("Product not found");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-pulse">
          <div className="h-96 rounded-2xl bg-card/50" />
          <div className="space-y-4">
            <div className="h-6 w-24 rounded bg-card/50" />
            <div className="h-10 w-3/4 rounded bg-card/50" />
            <div className="h-4 w-1/2 rounded bg-card/50" />
            <div className="h-24 rounded bg-card/50" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
        <h2 className="text-xl font-display font-bold mb-2">Product not found</h2>
        <Link href="/products"><span className="text-primary hover:underline cursor-pointer">Back to shop</span></Link>
      </div>
    );
  }

  const specs = product.specs ? JSON.parse(product.specs) : {};
  const inCart = items.some(i => i.id === product.id);

  const handleAdd = () => {
    add({ id: product.id, slug: product.slug, name: product.name, price: parseFloat(product.price) });
    setAdded(true);
    toast({ title: "Added to cart", description: product.name });
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link href="/products">
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to shop
        </span>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Image panel */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`relative h-80 lg:h-full min-h-[320px] rounded-2xl bg-gradient-to-br ${CATEGORY_GRADIENT[product.category] ?? "from-muted/30 to-muted/5"} flex items-center justify-center`}
        >
          {product.badge && (
            <span className="absolute top-5 left-5 bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider">
              {product.badge}
            </span>
          )}
          <Zap className="w-24 h-24 text-primary opacity-20" />
        </motion.div>

        {/* Info panel */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col gap-5"
        >
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{product.category}</span>
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground mt-1 leading-tight">
              {product.name}
            </h1>
          </div>

          <StarRating rating={product.rating ?? "4.5"} count={product.reviewCount ?? 0} />

          <p className="text-3xl font-bold font-mono text-foreground">
            ${parseFloat(product.price).toFixed(2)}
          </p>

          <p className="text-muted-foreground leading-relaxed">
            {product.longDescription || product.description}
          </p>

          {/* Stock */}
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${(product.stock ?? 0) > 10 ? "bg-primary" : "bg-destructive"}`} />
            <span className="text-muted-foreground">
              {(product.stock ?? 0) > 10 ? `${product.stock} in stock` : `Only ${product.stock} left`}
            </span>
          </div>

          <button
            data-testid="button-add-to-cart"
            onClick={handleAdd}
            className={`flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-base transition-all ${
              added ? "bg-green-600 text-white" : "bg-primary text-primary-foreground"
            }`}
          >
            {added ? (
              <><Check className="w-5 h-5" /> Added!</>
            ) : (
              <><ShoppingCart className="w-5 h-5" /> Add to Cart</>
            )}
          </button>

          {/* Specs */}
          {Object.keys(specs).length > 0 && (
            <div className="mt-2">
              <h3 className="text-sm font-display font-bold text-foreground mb-3 uppercase tracking-wide">Specifications</h3>
              <div className="rounded-xl border border-border/60 overflow-hidden">
                {Object.entries(specs).map(([key, val], i) => (
                  <div key={key} className={`flex gap-4 px-4 py-2.5 text-sm ${i % 2 === 0 ? "bg-card/40" : "bg-card/20"}`}>
                    <span className="text-muted-foreground font-medium min-w-[120px] capitalize">{key.replace(/_/g, " ")}</span>
                    <span className="text-foreground font-mono">{val as string}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
