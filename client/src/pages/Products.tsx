import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { motion } from "framer-motion";
import { Search, Star, Zap, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import type { Product } from "@shared/schema";
import { useCart } from "../App";

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "keyboards", label: "Keyboards" },
  { key: "switches", label: "Switches" },
  { key: "keycaps", label: "Keycaps" },
  { key: "accessories", label: "Accessories" },
];

const CATEGORY_GRADIENT: Record<string, string> = {
  keyboards: "from-primary/20 to-primary/5",
  switches: "from-blue-500/20 to-blue-500/5",
  keycaps: "from-purple-500/20 to-purple-500/5",
  accessories: "from-amber-500/20 to-amber-500/5",
};

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
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group glass-panel rounded-xl overflow-hidden flex flex-col hover-elevate"
    >
      <Link href={`/products/${product.slug}`}>
        <div className={`relative h-44 bg-gradient-to-br ${CATEGORY_GRADIENT[product.category] ?? "from-muted/30 to-muted/10"} flex items-center justify-center cursor-pointer`}>
          <Zap className="w-10 h-10 text-primary opacity-30 group-hover:opacity-50 transition-opacity" />
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
          <h3 className="font-display font-semibold text-foreground group-hover:text-primary transition-colors cursor-pointer leading-snug">
            {product.name}
          </h3>
        </Link>
        <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{product.description}</p>
        <div className="flex items-center justify-between mt-auto pt-2 gap-2">
          <span className="text-lg font-bold font-mono text-foreground">${parseFloat(product.price).toFixed(2)}</span>
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

export default function Products() {
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const defaultCat = params.get("category") || "all";

  const [category, setCategory] = useState(defaultCat);
  const [searchQuery, setSearchQuery] = useState("");

  const queryKey = searchQuery
    ? ["/api/products", { q: searchQuery }]
    : ["/api/products", { category }];

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey,
    queryFn: async () => {
      const url = new URL("/api/products", window.location.origin);
      if (searchQuery) url.searchParams.set("q", searchQuery);
      else if (category !== "all") url.searchParams.set("category", category);
      const res = await fetch(url.toString());
      return res.json();
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-foreground mb-2">Shop</h1>
        <p className="text-muted-foreground">Premium components for your perfect build.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            data-testid="input-product-search"
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-input text-foreground border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                data-testid={`button-category-${cat.key}`}
                onClick={() => { setCategory(cat.key); setSearchQuery(""); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  category === cat.key && !searchQuery
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[...Array(8)].map((_, i) => <div key={i} className="h-64 rounded-xl bg-card/50 animate-pulse" />)}
        </div>
      ) : products?.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No products found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {products?.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
        </div>
      )}
    </div>
  );
}
