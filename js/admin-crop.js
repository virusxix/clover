/** THE CLOVER — Image crop modal (display pixels = export pixels) */
(function (global) {
  const RATIOS = [
    { id: "free", label: "Free", value: null },
    { id: "1:1", label: "Square", value: 1 },
    { id: "4:5", label: "4:5", value: 4 / 5 },
    { id: "3:4", label: "3:4", value: 3 / 4 },
    { id: "16:9", label: "16:9", value: 16 / 9 },
  ];

  const VIEW_H = 360;

  let modal = null;
  let pending = null;

  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement("div");
    modal.className = "adm-crop-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="adm-crop-modal__backdrop" data-crop-cancel></div>
      <div class="adm-crop-modal__panel" role="dialog" aria-modal="true" aria-labelledby="admCropTitle">
        <header class="adm-crop-modal__head">
          <h2 id="admCropTitle">Crop image</h2>
          <button type="button" class="adm-modal__close" data-crop-cancel aria-label="Close">×</button>
        </header>
        <div class="adm-crop-modal__body">
          <p class="adm-help">Drag the image to reposition. Zoom in/out, then apply.</p>
          <div class="adm-crop-ratios" data-crop-ratios></div>
          <div class="adm-crop-viewport" data-crop-viewport>
            <img alt="" draggable="false" data-crop-img />
            <div class="adm-crop-frame" data-crop-frame></div>
          </div>
          <label class="adm-crop-zoom">
            <span>Zoom</span>
            <input type="range" min="1" max="100" step="1" value="50" data-crop-zoom />
          </label>
        </div>
        <footer class="adm-crop-modal__foot">
          <button type="button" class="adm-btn" data-crop-cancel>Cancel</button>
          <button type="button" class="adm-btn adm-btn--primary" data-crop-apply>Apply crop</button>
        </footer>
      </div>`;
    document.body.appendChild(modal);

    modal.querySelector("[data-crop-ratios]").innerHTML = RATIOS.map(
      (r, i) =>
        `<button type="button" class="adm-crop-ratio${i === 0 ? " is-active" : ""}" data-ratio="${r.id}">${r.label}</button>`
    ).join("");

    modal.querySelectorAll("[data-crop-cancel]").forEach((el) => {
      el.onclick = () => close(null);
    });
    modal.querySelector("[data-crop-apply]").onclick = () => applyCrop();

    return modal;
  }

  function close(result) {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("adm-crop-open");
    const { resolve, objectUrl, dragCleanup } = pending || {};
    pending = null;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    dragCleanup?.();
    resolve?.(result);
  }

  function getRatio(id) {
    return RATIOS.find((r) => r.id === id)?.value ?? null;
  }

  function viewportSize(viewport) {
    return {
      w: viewport.clientWidth || viewport.offsetWidth || 520,
      h: viewport.clientHeight || VIEW_H,
    };
  }

  function frameSize(viewport, ratio) {
    const { w: vw, h: vh } = viewportSize(viewport);
    const pad = 20;
    const maxW = vw - pad;
    const maxH = vh - pad;
    if (!ratio) return { w: maxW, h: maxH };
    if (maxW / maxH > ratio) return { w: maxH * ratio, h: maxH };
    return { w: maxW, h: maxW / ratio };
  }

  function layoutFrame(state) {
    const ratio = getRatio(state.ratioId);
    const { w, h } = frameSize(state.viewport, ratio);
    const { w: vw, h: vh } = viewportSize(state.viewport);
    state.frameW = w;
    state.frameH = h;
    state.frameLeft = (vw - w) / 2;
    state.frameTop = (vh - h) / 2;
    state.frame.style.width = `${w}px`;
    state.frame.style.height = `${h}px`;
    state.frame.style.left = `${state.frameLeft}px`;
    state.frame.style.top = `${state.frameTop}px`;
  }

  function displaySize(state) {
    const nw = state.img.naturalWidth;
    const nh = state.img.naturalHeight;
    return { dw: nw * state.scale, dh: nh * state.scale, nw, nh };
  }

  function imagePos(state) {
    const { dw, dh } = displaySize(state);
    const { w: vw, h: vh } = viewportSize(state.viewport);
    return {
      left: (vw - dw) / 2 + state.tx,
      top: (vh - dh) / 2 + state.ty,
      dw,
      dh,
    };
  }

  function coverScale(state) {
    const { nw, nh } = displaySize(state);
    return Math.max(state.frameW / nw, state.frameH / nh);
  }

  function syncZoomSlider(state) {
    const min = state.minScale;
    const max = state.maxScale;
    const pct = ((state.scale - min) / (max - min)) * 100;
    state.zoomInput.value = String(Math.round(Math.max(0, Math.min(100, pct))));
  }

  function scaleFromSlider(state, pct) {
    const t = pct / 100;
    return state.minScale + t * (state.maxScale - state.minScale);
  }

  function paintImage(state) {
    const { dw, dh } = displaySize(state);
    const pos = imagePos(state);
    const img = state.img;
    img.style.width = `${dw}px`;
    img.style.height = `${dh}px`;
    img.style.left = `${pos.left}px`;
    img.style.top = `${pos.top}px`;
  }

  function clampPan(state) {
    const pos = imagePos(state);
    const fr = state;
    const minLeft = fr.frameLeft + fr.frameW - pos.dw;
    const maxLeft = fr.frameLeft;
    const minTop = fr.frameTop + fr.frameH - pos.dh;
    const maxTop = fr.frameTop;

    let left = pos.left;
    let top = pos.top;
    if (pos.dw >= fr.frameW) left = Math.min(maxLeft, Math.max(minLeft, left));
    if (pos.dh >= fr.frameH) top = Math.min(maxTop, Math.max(minTop, top));

    const { w: vw, h: vh } = viewportSize(state.viewport);
    state.tx = left - (vw - pos.dw) / 2;
    state.ty = top - (vh - pos.dh) / 2;
    paintImage(state);
  }

  function fitImage(state) {
    const cover = coverScale(state);
    state.minScale = cover;
    state.maxScale = cover * 4;
    state.scale = cover;
    state.tx = 0;
    state.ty = 0;
    syncZoomSlider(state);
    clampPan(state);
  }

  function bindDrag(state) {
    const viewport = state.viewport;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startTx = 0;
    let startTy = 0;

    const onDown = (e) => {
      if (e.button !== 0) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startTx = state.tx;
      startTy = state.ty;
      viewport.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!dragging) return;
      state.tx = startTx + (e.clientX - startX);
      state.ty = startTy + (e.clientY - startY);
      clampPan(state);
    };
    const onUp = () => {
      dragging = false;
    };

    viewport.addEventListener("pointerdown", onDown);
    viewport.addEventListener("pointermove", onMove);
    viewport.addEventListener("pointerup", onUp);
    viewport.addEventListener("pointercancel", onUp);

    return () => {
      viewport.removeEventListener("pointerdown", onDown);
      viewport.removeEventListener("pointermove", onMove);
      viewport.removeEventListener("pointerup", onUp);
      viewport.removeEventListener("pointercancel", onUp);
    };
  }

  function exportBlob(state) {
    const { img, fileName, mime } = state;
    const pos = imagePos(state);
    const { nw, nh } = displaySize(state);
    const fr = state;

    let sx = ((fr.frameLeft - pos.left) / pos.dw) * nw;
    let sy = ((fr.frameTop - pos.top) / pos.dh) * nh;
    let sw = (fr.frameW / pos.dw) * nw;
    let sh = (fr.frameH / pos.dh) * nh;

    sx = Math.max(0, sx);
    sy = Math.max(0, sy);
    sw = Math.min(nw - sx, sw);
    sh = Math.min(nh - sy, sh);
    if (sw < 1 || sh < 1) return Promise.resolve(null);

    const outW = Math.max(1, Math.round(sw));
    const outH = Math.max(1, Math.round(sh));
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

    const type = mime === "image/png" ? "image/png" : "image/jpeg";
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          const base = (fileName || "image").replace(/\.[^.]+$/, "");
          resolve(new File([blob], `${base}-cropped.jpg`, { type, lastModified: Date.now() }));
        },
        type,
        type === "image/jpeg" ? 0.92 : undefined
      );
    });
  }

  async function applyCrop() {
    if (!pending?.state) return;
    const file = await exportBlob(pending.state);
    if (!file) {
      alert("Could not crop this image. Try zooming out slightly.");
      return;
    }
    close(file);
  }

  function bindRatios(state) {
    modal.querySelectorAll("[data-crop-ratio]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.ratio === state.ratioId);
      btn.onclick = () => {
        modal.querySelectorAll("[data-crop-ratio]").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        state.ratioId = btn.dataset.ratio;
        layoutFrame(state);
        fitImage(state);
      };
    });
  }

  function openCrop(file, opts = {}) {
    ensureModal();
    return new Promise((resolve) => {
      if (pending) close(null);

      const objectUrl = URL.createObjectURL(file);
      pending = { resolve, objectUrl, file };

      modal.hidden = false;
      document.body.classList.add("adm-crop-open");

      const img = modal.querySelector("[data-crop-img]");
      const frame = modal.querySelector("[data-crop-frame]");
      const viewport = modal.querySelector("[data-crop-viewport]");
      const zoomInput = modal.querySelector("[data-crop-zoom]");

      const state = {
        img,
        frame,
        viewport,
        zoomInput,
        ratioId: opts.aspect || "free",
        fileName: file.name,
        mime: file.type || "image/jpeg",
        frameW: 0,
        frameH: 0,
        frameLeft: 0,
        frameTop: 0,
        minScale: 1,
        maxScale: 4,
        scale: 1,
        tx: 0,
        ty: 0,
      };
      pending.state = state;

      bindRatios(state);

      zoomInput.oninput = () => {
        state.scale = scaleFromSlider(state, parseFloat(zoomInput.value) || 0);
        clampPan(state);
      };

      const init = () => {
        layoutFrame(state);
        fitImage(state);
        pending.dragCleanup = bindDrag(state);
      };

      img.onload = () => {
        requestAnimationFrame(() => requestAnimationFrame(init));
      };
      img.onerror = () => {
        alert("Could not load image for cropping.");
        close(null);
      };
      img.src = objectUrl;
    });
  }

  async function cropIfNeeded(file, opts = {}) {
    if (opts.skipCrop) return file;
    if (typeof opts.crop === "boolean" && !opts.crop) return file;
    const result = await openCrop(file, opts);
    return result || null;
  }

  async function cropFromSrc(src, fileName, opts = {}) {
    const url = await CloverMedia.resolveUrl(src);
    if (!url) throw new Error("Could not load image");
    let blob;
    if (url.startsWith("blob:") || url.startsWith("data:")) {
      const res = await fetch(url);
      blob = await res.blob();
    } else {
      const res = await fetch(url);
      blob = await res.blob();
    }
    const file = new File([blob], fileName || "image.jpg", { type: blob.type || "image/jpeg" });
    return cropIfNeeded(file, opts);
  }

  global.AdminCrop = { open: openCrop, cropIfNeeded, cropFromSrc, RATIOS };
})(typeof window !== "undefined" ? window : global);
