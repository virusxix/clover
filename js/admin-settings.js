/** THE CLOVER — CMS / Admin settings (localStorage + activity logs) */
(function (global) {
  const KEY = "clover_cms";
  const SESSION_KEY = "clover_admin_session";
  const CMS_VERSION = 1;

  const MEDIA_FOLDERS = [
    "Hero Images",
    "Hero Videos",
    "Product Images",
    "Product Videos",
    "Collection Images",
    "Blog Images",
    "Marketing Assets",
  ];

  const ROLES = ["super_admin", "admin", "content_manager", "staff"];

  const DEFAULT = {
    version: CMS_VERSION,
    store: { name: "THE CLOVER", email: "support@theclover.com", currency: "USD", currencySymbol: "$" },
    seo: {
      siteTitle: "THE CLOVER | Premium Gym Sportswear",
      metaDescription: "Premium gym sportswear and athleisure — compression, fleece, and training essentials.",
      ogImage: "assets/hero-image.png",
      productTitleTemplate: "{{name}} | THE CLOVER",
    },
    nav: [
      { id: "home", label: "Home", href: "index.html", order: 0 },
      { id: "shop", label: "Shop", href: "shop.html", order: 1 },
      { id: "about", label: "About", href: "about.html", order: 2 },
      { id: "contact", label: "Contact", href: "contact.html", order: 3 },
    ],
    footer: {
      address: "2840 Performance Ave\nLos Angeles, CA 90017",
      columns: [
        { title: "Information", links: [{ label: "About us", href: "about.html" }, { label: "Contact", href: "contact.html" }, { label: "Shop all", href: "shop.html" }] },
        { title: "Helpful Links", links: [{ label: "Shipping", href: "contact.html" }, { label: "Returns", href: "contact.html" }, { label: "Size guide", href: "contact.html" }] },
        { title: "Collections", links: [{ label: "Tops", href: "shop.html?cat=tops" }, { label: "Hoodies", href: "shop.html?cat=hoodies" }, { label: "Shorts", href: "shop.html?cat=shorts" }] },
      ],
      social: [{ label: "Instagram", href: "#", code: "IG" }, { label: "Twitter", href: "#", code: "X" }, { label: "TikTok", href: "#", code: "TT" }],
      copyright: "© 2026 THE CLOVER. All rights reserved.",
    },
    shop: { eyebrow: "All collections", title: "Shop Gear", subtitle: "Compression, hoodies, shorts & training essentials." },
    homepage: {
      hero: {
        title: "Performance gear to live a <em>stronger</em> life every day.",
        subtitle:
          "Premium compression, technical fleece, and training essentials — engineered for athletes who show up before sunrise.",
        ctaLabel: "Get Started",
        ctaHref: "shop.html",
        videoEnabled: true,
        videoSrc: "assets/hero-video.mp4",
        imageSrc: "",
        videoAutoplay: true,
        videoMuted: true,
        videoLoop: true,
        tag1: "Seamless",
        tag2: "4-Way Stretch",
        campaignStart: "",
        campaignEnd: "",
      },
      featuredSection: {
        eyebrow: "Our Special Drop",
        title: "Featured Gear",
        subtitle: "Premium ribbed zip jackets and training essentials.",
        productIds: [],
      },
      expert: {
        eyebrow: "Built for performance",
        title: "Designed by athletes,<br />for athletes.",
        bullets: [
          "Lab-tested four-way stretch fabrics",
          "Moisture-wicking & zero-distraction seams",
          "Stress-tested in real training conditions",
          "Sustainable, durable construction",
        ],
        ctaLabel: "Our Story",
        ctaHref: "about.html",
        imageSrc: "assets/hero-image.png",
      },
      newsletter: {
        title: "Join our community & get up to 20% off.",
        subtitle: "Early access to drops, training tips, and exclusive offers.",
        buttonLabel: "Sign Up",
      },
    },
    about: {
      title: "About Us",
      subtitle: "Performance apparel for everyday athletes.",
      body: "THE CLOVER engineers compression, fleece, and training essentials with lab-tested fabrics.",
      imageSrc: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=900&q=90&auto=format&fit=crop",
    },
    contact: {
      title: "Contact Us",
      subtitle: "We're here to help with orders, sizing, and more.",
      email: "support@theclover.com",
      phone: "+1 (800) 555-CLOVER",
      hours: "Mon–Fri, 9am–6pm PST",
      address: "2840 Performance Ave, Los Angeles, CA",
      mapEmbed: "",
    },
    categories: null,
    collections: [
      { id: "new-drop", name: "New Drop", slug: "new-drop", description: "Latest arrivals", productIds: [], image: "", seoTitle: "", seoDescription: "" },
    ],
    shopListings: { order: [], hidden: [], pinned: [], trending: [], featuredIds: [] },
    promotions: [],
    orders: [
      { id: "ORD-2841", customerId: "c1", customerName: "Jordan M.", email: "jordan@example.com", items: 2, total: 316, status: "shipped", createdAt: "2026-05-28T10:00:00Z" },
      { id: "ORD-2840", customerId: "c2", customerName: "Sam K.", email: "sam@example.com", items: 1, total: 128, status: "processing", createdAt: "2026-05-27T14:30:00Z" },
      { id: "ORD-2839", customerId: "c3", customerName: "Alex R.", email: "alex@example.com", items: 3, total: 408, status: "delivered", createdAt: "2026-05-26T09:15:00Z" },
    ],
    customers: [
      { id: "c1", name: "Jordan M.", email: "jordan@example.com", orders: 4, spent: 1240 },
      { id: "c2", name: "Sam K.", email: "sam@example.com", orders: 2, spent: 380 },
      { id: "c3", name: "Alex R.", email: "alex@example.com", orders: 6, spent: 2100 },
    ],
    media: [],
    users: [
      { id: "u1", email: "admin@theclover.com", name: "Admin", role: "super_admin", password: "clover2026" },
    ],
    activity: [],
  };

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function loadPublished() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const data = JSON.parse(raw);
        return {
          ...clone(DEFAULT),
          ...data,
          homepage: {
            ...DEFAULT.homepage,
            ...data.homepage,
            hero: { ...DEFAULT.homepage.hero, ...data.homepage?.hero },
          },
          about: { ...DEFAULT.about, ...data.about },
        };
      }
    } catch (_) {}
    return clone(DEFAULT);
  }

  function load() {
    const storageKey =
      typeof CloverVE !== "undefined" && CloverVE.useDraft() ? "clover_cms_draft" : KEY;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const data = JSON.parse(raw);
        return { ...clone(DEFAULT), ...data, homepage: { ...DEFAULT.homepage, ...data.homepage, hero: { ...DEFAULT.homepage.hero, ...data.homepage?.hero } }, about: { ...DEFAULT.about, ...data.about } };
      }
    } catch (_) {}
    const fresh = clone(DEFAULT);
    localStorage.setItem(storageKey, JSON.stringify(fresh));
    return fresh;
  }

  function save(data) {
    const live = !(typeof CloverVE !== "undefined" && CloverVE.useDraft());
    if (!live) {
      CloverVE.saveCmsDraft(data);
      return;
    }
    localStorage.setItem(KEY, JSON.stringify(data));
    localStorage.setItem("clover_cms_draft", JSON.stringify(data));
    if (typeof CloverVE !== "undefined") CloverVE.ensureDrafts();
    if (typeof CloverMedia !== "undefined" && CloverMedia.embedPublishedMedia) {
      CloverMedia.embedPublishedMedia(data, null).catch(() => {});
    }
    window.dispatchEvent(new CustomEvent("cms:updated"));
  }

  function get() {
    return load();
  }

  function getPublished() {
    return loadPublished();
  }

  function patch(section, values) {
    const data = load();
    if (section.includes(".")) {
      const [a, b] = section.split(".");
      data[a] = data[a] || {};
      data[a][b] = { ...data[a][b], ...values };
    } else {
      data[section] = { ...(data[section] || {}), ...values };
    }
    save(data);
    return data;
  }

  function log(action, detail) {
    const data = load();
    const user = getSession()?.email || "system";
    data.activity.unshift({
      id: `log-${Date.now()}`,
      action,
      detail,
      user,
      at: new Date().toISOString(),
    });
    data.activity = data.activity.slice(0, 200);
    save(data);
  }

  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function login(email, password) {
    const data = load();
    const user = data.users.find((u) => u.email === email && u.password === password);
    if (!user) return null;
    const session = { email: user.email, name: user.name, role: user.role };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    log("login", `User ${email} signed in`);
    return session;
  }

  function logout() {
    log("logout", "Session ended");
    sessionStorage.removeItem(SESSION_KEY);
  }

  function can(permission) {
    const role = getSession()?.role || "staff";
    const map = {
      super_admin: ["*"],
      admin: ["products", "orders", "customers", "promotions", "shop", "categories", "collections", "analytics"],
      content_manager: ["media", "homepage", "seo", "nav", "footer", "about", "contact", "collections"],
      staff: ["view"],
    };
    const perms = map[role] || [];
    return perms.includes("*") || perms.includes(permission) || permission === "view";
  }

  function getCategories() {
    const cms = load();
    if (cms.categories?.length) return cms.categories;
    return typeof CloverCatalogData !== "undefined" ? CloverCatalogData.CATEGORIES : [];
  }

  function saveCategories(cats) {
    const data = load();
    data.categories = cats;
    save(data);
    log("categories_update", `${cats.length} categories`);
  }

  function syncShopOrderFromCatalog() {
    const data = load();
    const ids = CloverStore.getProducts().map((p) => p.id);
    const order = data.shopListings.order.length ? data.shopListings.order.filter((id) => ids.includes(id)) : ids;
    ids.forEach((id) => {
      if (!order.includes(id)) order.push(id);
    });
    data.shopListings.order = order;
    save(data);
  }

  function getShopOrderedProducts() {
    syncShopOrderFromCatalog();
    const data =
      typeof CloverVE !== "undefined" && CloverVE.useDraft() ? load() : loadPublished();
    const all = CloverStore.getProducts().filter((p) => (p.status || "active") === "active");
    const hidden = new Set(data.shopListings.hidden || []);
    const visible = all.filter((p) => !hidden.has(p.id));
    const order = data.shopListings.order || [];
    return visible.sort((a, b) => {
      const ia = order.indexOf(a.id);
      const ib = order.indexOf(b.id);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }

  function getHomepageProductIds() {
    const data =
      typeof CloverVE !== "undefined" && CloverVE.useDraft() ? load() : loadPublished();
    const ids = data.homepage.featuredSection.productIds;
    if (ids?.length) return ids;
    return CloverStore.getProducts()
      .filter((p) => p.featured && (p.status || "active") === "active")
      .map((p) => p.id)
      .slice(0, 8);
  }

  global.CloverCMS = {
    KEY,
    MEDIA_FOLDERS,
    ROLES,
    get,
    getPublished,
    save,
    patch,
    log,
    login,
    logout,
    getSession,
    can,
    getCategories,
    saveCategories,
    getShopOrderedProducts,
    getHomepageProductIds,
    syncShopOrderFromCatalog,
    DEFAULT: clone(DEFAULT),
  };
})(typeof window !== "undefined" ? window : global);
