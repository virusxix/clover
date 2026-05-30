(function () {
  "use strict";

  const content = document.getElementById("cartContent");
  const summary = document.getElementById("cartSummary");

  function renderSummary() {
    const sub = CloverCart.subtotal();
    const { shipping, tax, total } = CloverSite.orderTotals(sub);

    document.getElementById("sumSubtotal").textContent = CloverSite.formatMoney(sub);
    document.getElementById("sumShipping").textContent =
      shipping === 0 ? "Free" : CloverSite.formatMoney(shipping);
    document.getElementById("sumTax").textContent = CloverSite.formatMoney(tax);
    document.getElementById("sumTotal").textContent = CloverSite.formatMoney(total);
    summary.hidden = false;
  }

  function render() {
    const items = CloverCart.getItems();

    if (!items.length) {
      content.innerHTML = `
        <div class="cart-empty">
          <p>Your cart is empty. Discover our latest drop.</p>
          <a href="shop.html" class="btn btn--primary">Shop now</a>
        </div>`;
      summary.hidden = true;
      return;
    }

    content.innerHTML = `
      <table class="cart-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Price</th>
            <th>Qty</th>
            <th>Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (i) => `
            <tr data-code="${i.code}" data-size="${i.size}">
              <td>
                <div class="cart-item">
                  <img src="${i.image}" alt="" />
                  <div>
                    <p class="cart-item__name">${i.name}</p>
                    <p class="cart-item__meta">${i.colorName ? `${i.colorName} · ` : ""}Size: ${i.size}</p>
                  </div>
                </div>
              </td>
              <td>${CloverSite.formatMoney(i.price)}</td>
              <td>
                <div class="qty-control">
                  <button type="button" data-qty-minus aria-label="Decrease">−</button>
                  <span>${i.qty}</span>
                  <button type="button" data-qty-plus aria-label="Increase">+</button>
                </div>
              </td>
              <td>${CloverSite.formatMoney(i.price * i.qty)}</td>
              <td><button type="button" class="cart-remove" data-remove>Remove</button></td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`;

    content.querySelectorAll("tr").forEach((row) => {
      const code = row.dataset.code;
      const size = row.dataset.size;
      row.querySelector("[data-qty-minus]")?.addEventListener("click", () => {
        const item = CloverCart.getItems().find((i) => i.code === code && i.size === size);
        if (item) CloverCart.updateQty(code, size, item.qty - 1);
        render();
      });
      row.querySelector("[data-qty-plus]")?.addEventListener("click", () => {
        const item = CloverCart.getItems().find((i) => i.code === code && i.size === size);
        if (item) CloverCart.updateQty(code, size, item.qty + 1);
        render();
      });
      row.querySelector("[data-remove]")?.addEventListener("click", () => {
        CloverCart.remove(code, size);
        render();
      });
    });

    renderSummary();
  }

  render();
  window.addEventListener("cart:updated", render);
})();
