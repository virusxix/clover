(function () {
  "use strict";

  const sidebar = document.getElementById("sidebar");
  const menuToggle = document.getElementById("menuToggle");
  const canvas = document.getElementById("performanceChart");

  /* Mobile sidebar */
  menuToggle?.addEventListener("click", () => {
    sidebar?.classList.toggle("is-open");
  });

  document.addEventListener("click", (e) => {
    if (
      sidebar?.classList.contains("is-open") &&
      !sidebar.contains(e.target) &&
      e.target !== menuToggle &&
      !menuToggle?.contains(e.target)
    ) {
      sidebar.classList.remove("is-open");
    }
  });

  /* Animated counters */
  function animateCount(el) {
    const target = parseInt(el.dataset.count, 10);
    if (isNaN(target)) return;
    const isMoney = el.dataset.format === "currency";
    const duration = 1400;
    const start = performance.now();

    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = Math.round(target * eased);
      if (target >= 1000) {
        el.textContent = isMoney
          ? "$" + val.toLocaleString()
          : val.toLocaleString();
      } else {
        el.textContent = isMoney ? "$" + val : String(val);
      }
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  document.querySelectorAll("[data-count]").forEach((el) => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          animateCount(entry.target);
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
  });

  /* Performance chart */
  function drawChart() {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;

    const months = 12;
    const revenue = [42, 48, 45, 58, 62, 68, 72, 78, 85, 92, 98, 110];
    const sessions = [30, 35, 38, 42, 45, 50, 52, 58, 62, 68, 72, 80];
    const pad = { t: 20, r: 20, b: 32, l: 48 };
    const chartW = w - pad.l - pad.r;
    const chartH = h - pad.t - pad.b;
    const max = 120;

    ctx.clearRect(0, 0, w, h);

    /* Grid */
    ctx.strokeStyle = "rgba(15, 23, 42, 0.06)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
    }

    function drawLine(data, gradientStops) {
      const grad = ctx.createLinearGradient(0, pad.t, 0, h - pad.b);
      gradientStops.forEach(([offset, color]) => grad.addColorStop(offset, color));

      ctx.beginPath();
      data.forEach((v, i) => {
        const x = pad.l + (chartW / (months - 1)) * i;
        const y = pad.t + chartH - (v / max) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();

      /* Fill */
      const fillGrad = ctx.createLinearGradient(0, pad.t, 0, h - pad.b);
      fillGrad.addColorStop(0, "rgba(79, 70, 229, 0.15)");
      fillGrad.addColorStop(1, "rgba(79, 70, 229, 0)");
      ctx.lineTo(pad.l + chartW, pad.t + chartH);
      ctx.lineTo(pad.l, pad.t + chartH);
      ctx.closePath();
      ctx.fillStyle = fillGrad;
      ctx.fill();
    }

    drawLine(revenue, [
      [0, "#4F46E5"],
      [1, "#8B5CF6"],
    ]);

    ctx.beginPath();
    sessions.forEach((v, i) => {
      const x = pad.l + (chartW / (months - 1)) * i;
      const y = pad.t + chartH - (v / max) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    const cyanGrad = ctx.createLinearGradient(0, 0, w, 0);
    cyanGrad.addColorStop(0, "#06B6D4");
    cyanGrad.addColorStop(1, "#22D3EE");
    ctx.strokeStyle = cyanGrad;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    /* Labels */
    ctx.fillStyle = "#9CA3AF";
    ctx.font = "11px Inter, sans-serif";
    const labels = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
    labels.forEach((lbl, i) => {
      const x = pad.l + (chartW / (months - 1)) * i;
      ctx.textAlign = "center";
      ctx.fillText(lbl, x, h - 10);
    });
  }

  drawChart();
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawChart, 150);
  });

  /* Segmented control */
  document.querySelectorAll(".segmented").forEach((group) => {
    group.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        group.querySelectorAll("button").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
      });
    });
  });

  /* Subtle tilt on float cards */
  document.querySelectorAll("[data-tilt]").forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(800px) rotateY(${x * 4}deg) rotateX(${-y * 4}deg) translateY(-4px)`;
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  });

  /* Add SVG gradient defs for sparkline if missing */
  const spark = document.querySelector(".sparkline svg");
  if (spark && !spark.querySelector("#sparkGrad")) {
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = `<linearGradient id="sparkGrad" x1="0" y1="0" x2="120" y2="0"><stop stop-color="#4F46E5"/><stop offset="1" stop-color="#06B6D4"/></linearGradient>`;
    spark.prepend(defs);
    const path = spark.querySelector(".sparkline__path");
    if (path) path.setAttribute("stroke", "url(#sparkGrad)");
  }

  const donut = document.querySelector(".donut svg");
  if (donut && !donut.querySelector("#donutGrad")) {
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = `<linearGradient id="donutGrad" x1="0" y1="0" x2="36" y2="36"><stop stop-color="#4F46E5"/><stop offset="1" stop-color="#8B5CF6"/></linearGradient>`;
    donut.prepend(defs);
    const fg = donut.querySelector(".donut__fg");
    if (fg) fg.setAttribute("stroke", "url(#donutGrad)");
  }
})();
