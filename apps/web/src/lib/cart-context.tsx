"use client";

/**
 * Cart React context
 * ------------------
 * Keeps bag item count in sync for the header badge after add / update / remove.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import { useAuth } from "./auth-context";

type CartCtx = {
  /** Total units in the bag (sum of quantities). */
  itemCount: number;
  refreshCart: () => Promise<void>;
};

const CartContext = createContext<CartCtx>({
  itemCount: 0,
  refreshCart: async () => {},
});

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [itemCount, setItemCount] = useState(0);

  const refreshCart = useCallback(async () => {
    if (!user) {
      setItemCount(0);
      return;
    }
    try {
      const data = await api<{ items: { quantity: number }[] }>("/api/cart");
      setItemCount(data.items.reduce((sum, item) => sum + (item.quantity || 0), 0));
    } catch {
      setItemCount(0);
    }
  }, [user]);

  useEffect(() => {
    if (loading) return;
    void refreshCart();
  }, [loading, refreshCart]);

  return (
    <CartContext.Provider value={{ itemCount, refreshCart }}>{children}</CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
