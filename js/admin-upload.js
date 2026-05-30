/** Shared image upload UI for admin (no URL typing) */
(function (global) {
  async function previewUrl(src) {
    if (!src || CloverMedia.isBadPath(src)) return "";
    return CloverMedia.resolveUrl(src);
  }

  async function processFile(file, opts) {
    if (!file || !file.type.startsWith("image/")) return null;
    if (typeof AdminCrop === "undefined" || opts.crop === false) return file;
    return AdminCrop.cropIfNeeded(file, {
      aspect: opts.aspect || "free",
    });
  }

  async function renderGallery(holder, images, opts) {
    const folder = opts.folder || "Product Images";
    const grid = holder.querySelector("[data-upload-grid]") || holder;
    const onChange = opts.onChange || (() => {});

    let list = (images || []).filter((i) => i?.src && !CloverMedia.isBadPath(i.src));

    async function paint() {
      holder.dataset.images = JSON.stringify(list);
      grid.innerHTML = "";
      if (!list.length) {
        grid.innerHTML = `<p class="adm-upload__empty">No photos yet — click Upload below.</p>`;
      }
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const url = await previewUrl(item.src);
        const cell = document.createElement("div");
        cell.className = "adm-upload__item";
        cell.innerHTML = `
          <img src="${url || "assets/logo-icon.png"}" alt="" />
          <div class="adm-upload__actions">
            <button type="button" data-crop="${i}" title="Crop">✂</button>
            <button type="button" data-up="${i}" title="Move up">↑</button>
            <button type="button" data-down="${i}" title="Move down">↓</button>
            <button type="button" data-rm="${i}" title="Remove">×</button>
          </div>`;
        grid.appendChild(cell);
      }
      grid.querySelectorAll("[data-rm]").forEach((btn) => {
        btn.onclick = () => {
          list.splice(Number(btn.dataset.rm), 1);
          paint();
          onChange(list);
        };
      });
      grid.querySelectorAll("[data-crop]").forEach((btn) => {
        btn.onclick = async () => {
          const idx = Number(btn.dataset.crop);
          const item = list[idx];
          if (!item?.src || typeof AdminCrop === "undefined") return;
          try {
            const cropped = await AdminCrop.cropFromSrc(item.src, item.label || "photo.jpg", {
              aspect: opts.aspect || "free",
            });
            if (!cropped) return;
            const ref = await CloverMedia.uploadImageRef(cropped, folder);
            list[idx] = { ...ref, label: item.label || ref.label };
            paint();
            onChange(list);
          } catch (e) {
            alert(e.message || "Crop failed");
          }
        };
      });
      grid.querySelectorAll("[data-up]").forEach((btn) => {
        btn.onclick = () => {
          const i = Number(btn.dataset.up);
          if (i > 0) {
            [list[i - 1], list[i]] = [list[i], list[i - 1]];
            paint();
            onChange(list);
          }
        };
      });
      grid.querySelectorAll("[data-down]").forEach((btn) => {
        btn.onclick = () => {
          const i = Number(btn.dataset.down);
          if (i < list.length - 1) {
            [list[i + 1], list[i]] = [list[i], list[i + 1]];
            paint();
            onChange(list);
          }
        };
      });
    }

    const input = holder.querySelector("[data-upload-input]");
    if (input) {
      input.onchange = async () => {
        const files = [...input.files];
        input.value = "";
        for (const file of files) {
          try {
            const cropped = await processFile(file, opts);
            if (!cropped) continue;
            const ref = await CloverMedia.uploadImageRef(cropped, folder);
            list.push(ref);
          } catch (e) {
            alert(e.message || "Upload failed");
          }
        }
        paint();
        onChange(list);
      };
    }

    await paint();
    return {
      getImages: () => list,
      setImages: (next) => {
        list = next || [];
        paint();
      },
    };
  }

  function galleryHtml(label, help) {
    return `
      <div class="adm-field adm-upload-field">
        <label>${label}</label>
        ${help ? `<p class="adm-help">${help}</p>` : ""}
        <div class="adm-upload" data-upload-root>
          <div class="adm-upload__grid" data-upload-grid></div>
          <label class="adm-btn adm-btn--sm adm-btn--accent adm-upload__btn">
            📷 Upload images
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden data-upload-input />
          </label>
        </div>
      </div>`;
  }

  function singleHtml(label, help) {
    return `
      <div class="adm-field adm-upload-field">
        <label>${label}</label>
        ${help ? `<p class="adm-help">${help}</p>` : ""}
        <div class="adm-upload adm-upload--single" data-single-upload>
          <div class="adm-upload__preview" data-single-preview></div>
          <label class="adm-btn adm-btn--sm adm-btn--accent adm-upload__btn">
            📷 Upload image
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden data-single-input />
          </label>
          <button type="button" class="adm-btn adm-btn--sm" data-single-crop hidden>✂ Crop</button>
          <button type="button" class="adm-btn adm-btn--sm adm-btn--danger" data-single-remove hidden>Remove</button>
        </div>
      </div>`;
  }

  async function bindSingle(holder, src, opts) {
    const folder = opts.folder || "Hero Images";
    const preview = holder.querySelector("[data-single-preview]");
    const input = holder.querySelector("[data-single-input]");
    const removeBtn = holder.querySelector("[data-single-remove]");
    const cropBtn = holder.querySelector("[data-single-crop]");
    let current = CloverMedia.isBadPath(src) ? "" : src || "";

    async function show() {
      holder.dataset.src = current;
      if (!current) {
        preview.innerHTML = `<span class="adm-upload__empty">No image</span>`;
        removeBtn.hidden = true;
        if (cropBtn) cropBtn.hidden = true;
        return;
      }
      const url = await previewUrl(current);
      preview.innerHTML = `<img src="${url}" alt="" />`;
      removeBtn.hidden = false;
      if (cropBtn) cropBtn.hidden = typeof AdminCrop === "undefined";
    }

    input.onchange = async () => {
      const file = input.files[0];
      input.value = "";
      if (!file) return;
      try {
        const cropped = await processFile(file, opts);
        if (!cropped) return;
        const ref = await CloverMedia.uploadImageRef(cropped, folder);
        current = ref.src;
        show();
        opts.onChange?.(current);
      } catch (e) {
        alert(e.message || "Upload failed");
      }
    };

    if (cropBtn) {
      cropBtn.onclick = async () => {
        if (!current || typeof AdminCrop === "undefined") return;
        try {
          const cropped = await AdminCrop.cropFromSrc(current, "image.jpg", {
            aspect: opts.aspect || "free",
          });
          if (!cropped) return;
          const ref = await CloverMedia.uploadImageRef(cropped, folder);
          current = ref.src;
          show();
          opts.onChange?.(current);
        } catch (e) {
          alert(e.message || "Crop failed");
        }
      };
    }

    removeBtn.onclick = () => {
      current = "";
      show();
      opts.onChange?.("");
    };

    await show();
    return { getSrc: () => current };
  }

  global.AdminUpload = { renderGallery, galleryHtml, singleHtml, bindSingle, processFile };
})(typeof window !== "undefined" ? window : global);
