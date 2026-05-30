(function () {
  "use strict";

  const layout = document.getElementById("checkoutLayout");
  const empty = document.getElementById("checkoutEmpty");
  const itemsEl = document.getElementById("checkoutItems");
  const form = document.getElementById("checkoutForm");

  function renderTotals() {
    const sub = CloverCart.subtotal();
    const { shipping, tax, total } = CloverSite.orderTotals(sub);
    document.getElementById("chkSubtotal").textContent = CloverSite.formatMoney(sub);
    document.getElementById("chkShipping").textContent =
      shipping === 0 ? "Free" : CloverSite.formatMoney(shipping);
    document.getElementById("chkTax").textContent = CloverSite.formatMoney(tax);
    document.getElementById("chkTotal").textContent = CloverSite.formatMoney(total);
  }

  function renderItems() {
    const items = CloverCart.getItems();
    if (!items.length) {
      layout.hidden = true;
      empty.hidden = false;
      return;
    }
    layout.hidden = false;
    empty.hidden = true;

    itemsEl.innerHTML = items
      .map(
        (i) => `
      <div class="summary-row" style="align-items:center">
        <span style="display:flex;align-items:center;gap:0.5rem">
          <img class="checkout-line__img" src="${i.image}" alt="" width="40" height="48" />
          ${i.name}${i.colorName ? ` · ${i.colorName}` : ""} (${i.size}) × ${i.qty}
        </span>
        <span>${CloverSite.formatMoney(i.price * i.qty)}</span>
      </div>`
      )
      .join("");

    renderTotals();
  }

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const btn = document.getElementById("placeOrderBtn");
    btn.disabled = true;
    btn.textContent = "Processing…";

    setTimeout(() => {
      CloverCart.clear();
      window.location.href = "order-confirmation.html";
    }, 1200);
  });

  renderItems();
})();
