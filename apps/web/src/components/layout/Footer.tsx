import Link from "next/link";
import { BrandLogo } from "@/components/layout/BrandLogo";

export function Footer() {
  return (
    <footer className="mt-12 sm:mt-20 px-2 sm:px-5 lg:px-8 pb-3 sm:pb-5 safe-bottom">
      <div className="nav-float max-w-7xl mx-auto overflow-hidden">
        <div className="px-4 sm:px-8 py-10 sm:py-12 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 text-sm">
          <div className="col-span-2 sm:col-span-2 lg:col-span-1">
            <BrandLogo href="/" size="sm" wordmarkClassName="" className="mb-4" />
            <p className="text-soul-muted text-sm leading-relaxed mt-4">
              Premium gym sportswear and athleisure — engineered for athletes who show up before sunrise.
            </p>
          </div>
          <div>
            <p className="font-semibold mb-3 uppercase text-xs tracking-wider">Shop</p>
            <ul className="space-y-2 text-soul-muted">
              <li><Link href="/shop" className="hover:text-black transition-colors">All Products</Link></li>
              <li><Link href="/shop?category=leggings" className="hover:text-black transition-colors">Leggings</Link></li>
              <li><Link href="/shop?category=tops" className="hover:text-black transition-colors">Tops & Bras</Link></li>
              <li><Link href="/about" className="hover:text-black transition-colors">About Me</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold mb-3 uppercase text-xs tracking-wider">Support</p>
            <ul className="space-y-2 text-soul-muted">
              <li><Link href="/contact" className="hover:text-black transition-colors">Contact</Link></li>
              <li><Link href="/account/orders" className="hover:text-black transition-colors">Track Order</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold mb-3 uppercase text-xs tracking-wider">Account</p>
            <ul className="space-y-2 text-soul-muted">
              <li><Link href="/login" className="hover:text-black transition-colors">Sign In</Link></li>
              <li><Link href="/account" className="hover:text-black transition-colors">Profile</Link></li>
            </ul>
          </div>
        </div>
        <div className="text-center text-xs text-soul-muted py-5 sm:py-6 border-t border-black/5 mx-4 sm:mx-8">
          © {new Date().getFullYear()} THE CLOVER. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
