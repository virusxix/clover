(function () {
  "use strict";

  const ORDERS = [
    { id: "ORD-2841", date: "May 24, 2026", items: 2, total: 316, status: "Shipped" },
    { id: "ORD-2835", date: "May 10, 2026", items: 1, total: 128, status: "Delivered" },
    { id: "ORD-2820", date: "Apr 28, 2026", items: 1, total: 100, status: "Delivered" },
  ];

  const WISHLIST_IMAGES = {
    "Void Tech Hoodie": "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&q=80&auto=format&fit=crop",
    "Flux Legging": "https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=400&q=80&auto=format&fit=crop",
  };

  const tabs = document.querySelectorAll(".user-nav__item");
  const panels = document.querySelectorAll(".user-tab");
  const ordersBody = document.getElementById("ordersBody");
  const wishlistGrid = document.getElementById("wishlistGrid");
  const recentPreview = document.getElementById("recentOrderPreview");
  const profileForm = document.getElementById("profileForm");

  function showTab(id) {
    tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.tab === id));
    panels.forEach((p) => {
      const show = p.dataset.tab === id;
      p.classList.toggle("is-active", show);
      p.hidden = !show;
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => showTab(tab.dataset.tab));
  });

  function statusClass(s) {
    return s === "Shipped" || s === "Delivered" ? "status-badge" : "status-badge status-badge--muted";
  }

  function renderOrders() {
    if (!ordersBody) return;
    ordersBody.innerHTML = ORDERS.map(
      (o) => `
      <tr>
        <td><strong>#${o.id}</strong></td>
        <td>${o.date}</td>
        <td>${o.items}</td>
        <td>$${o.total.toFixed(2)}</td>
        <td><span class="${statusClass(o.status)}">${o.status}</span></td>
      </tr>`
    ).join("");

    const latest = ORDERS[0];
    if (recentPreview && latest) {
      recentPreview.innerHTML = `
        <span class="user-order-preview__id">#${latest.id}</span>
        <span class="user-order-preview__meta">${latest.date} · ${latest.items} items</span>
        <span class="${statusClass(latest.status)}">${latest.status}</span>
        <span class="user-order-preview__total">$${latest.total.toFixed(2)}</span>
      `;
    }

    const statOrders = document.getElementById("statOrders");
    if (statOrders) statOrders.textContent = String(ORDERS.length);
  }

  function renderWishlist() {
    if (!wishlistGrid) return;
    const products = CloverStore.getAll().slice(0, 2);
    if (!products.length) {
      wishlistGrid.innerHTML = '<p class="user-wish-empty">Your wishlist is empty. <a href="index.html">Shop now</a></p>';
      return;
    }

    wishlistGrid.innerHTML = products
      .map(
        (p) => `
      <article class="user-wish-card">
        <div class="user-wish-card__img">
          <img src="${WISHLIST_IMAGES[p.name] || "https://images.unsplash.com/photo-1517836357463-d6dfbc63a0aa?w=400&q=80&auto=format&fit=crop"}" alt="${p.name}" loading="lazy" />
        </div>
        <div class="user-wish-card__body">
          <h3>${p.name}</h3>
          <span>$${Number(p.price).toFixed(0)}</span>
        </div>
      </article>`
      )
      .join("");

    const statWish = document.getElementById("statWishlist");
    if (statWish) statWish.textContent = String(products.length);
  }

  function loadProfile() {
    try {
      const raw = localStorage.getItem("clover_user");
      if (!raw) return;
      const u = JSON.parse(raw);
      if (u.firstName) document.getElementById("firstName").value = u.firstName;
      if (u.lastName) document.getElementById("lastName").value = u.lastName;
      if (u.email) document.getElementById("email").value = u.email;
      if (u.phone) document.getElementById("phone").value = u.phone;
      updateProfileUI(u);
    } catch (_) {}
  }

  function updateProfileUI(u) {
    const name = `${u.firstName || "Jordan"} ${u.lastName || "Mitchell"}`.trim();
    const initials = ((u.firstName?.[0] || "J") + (u.lastName?.[0] || "M")).toUpperCase();
    const el = (id, text) => {
      const n = document.getElementById(id);
      if (n) n.textContent = text;
    };
    el("userName", name);
    el("userEmail", u.email || "jordan@email.com");
    el("userFirstName", u.firstName || "Jordan");
    el("userAvatar", initials);
  }

  function showToast(msg) {
    let t = document.querySelector(".toast-user");
    if (!t) {
      t = document.createElement("div");
      t.className = "toast-user";
      t.setAttribute("role", "status");
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("is-visible");
    setTimeout(() => t.classList.remove("is-visible"), 2500);
  }

  profileForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const u = {
      firstName: document.getElementById("firstName").value.trim(),
      lastName: document.getElementById("lastName").value.trim(),
      email: document.getElementById("email").value.trim(),
      phone: document.getElementById("phone").value.trim(),
    };
    localStorage.setItem("clover_user", JSON.stringify(u));
    updateProfileUI(u);
    showToast("Profile saved");
  });

  renderOrders();
  renderWishlist();
  loadProfile();
})();
