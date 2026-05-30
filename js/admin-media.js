/** THE CLOVER — Media library (IndexedDB for uploads) */
(function (global) {
  const DB = "clover_media";
  const STORE = "files";
  const META_KEY = "clover_media_meta";

  const ALLOWED = {
    image: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
    video: ["video/mp4", "video/webm", "video/quicktime"],
  };

  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      };
    });
    return dbPromise;
  }

  function getMetaList() {
    try {
      const raw = localStorage.getItem(META_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  function saveMetaList(list) {
    localStorage.setItem(META_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("media:updated"));
  }

  function validateFile(file) {
    const all = [...ALLOWED.image, ...ALLOWED.video];
    if (!all.includes(file.type)) return "Unsupported file type";
    if (file.size > 25 * 1024 * 1024) return "File must be under 25MB";
    return null;
  }

  async function upload(file, folder, name) {
    const err = validateFile(file);
    if (err) throw new Error(err);
    const id = `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const buffer = await file.arrayBuffer();
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({
        id,
        buffer,
        type: file.type,
        name: name || file.name,
        folder,
        createdAt: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    const meta = {
      id,
      name: name || file.name,
      folder,
      type: file.type,
      kind: file.type.startsWith("video/") ? "video" : "image",
      size: file.size,
      createdAt: new Date().toISOString(),
    };
    const list = getMetaList();
    list.unshift(meta);
    saveMetaList(list);
    if (typeof CloverCMS !== "undefined") CloverCMS.log("media_upload", `${meta.name} → ${folder}`);
    return meta;
  }

  async function getBlobUrl(id) {
    const db = await openDb();
    const row = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (!row) return null;
    const blob = new Blob([row.buffer], { type: row.type });
    return URL.createObjectURL(blob);
  }

  async function remove(id) {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    saveMetaList(getMetaList().filter((m) => m.id !== id));
    if (typeof CloverCMS !== "undefined") CloverCMS.log("media_delete", id);
  }

  function addExternalUrl(url, folder, name, kind) {
    const meta = {
      id: `url-${Date.now()}`,
      name: name || url.split("/").pop(),
      folder,
      type: kind === "video" ? "video/mp4" : "image/png",
      kind: kind || "image",
      url,
      external: true,
      size: 0,
      createdAt: new Date().toISOString(),
    };
    const list = getMetaList();
    list.unshift(meta);
    saveMetaList(list);
    return meta;
  }

  const REF_PREFIX = "clover-media://";
  const EMBED_KEY = "clover_media_embedded";

  function getEmbeddedMap() {
    try {
      return JSON.parse(localStorage.getItem(EMBED_KEY) || "{}");
    } catch (_) {
      return {};
    }
  }

  function saveEmbeddedMap(map) {
    localStorage.setItem(EMBED_KEY, JSON.stringify(map));
  }

  function collectRefs(value, out) {
    if (!value) return;
    if (typeof value === "string") {
      const id = parseRef(value);
      if (id) out.add(id);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((v) => collectRefs(v, out));
      return;
    }
    if (typeof value === "object") {
      Object.values(value).forEach((v) => collectRefs(v, out));
    }
  }

  async function getRow(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function readBlobAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function blobToEmbedDataUrl(blob, maxW = 1800) {
    if (!blob.type.startsWith("image/")) return readBlobAsDataUrl(blob);
    try {
      const bmp = await createImageBitmap(blob);
      let w = bmp.width;
      let h = bmp.height;
      if (w > maxW) {
        h = Math.round((h * maxW) / w);
        w = maxW;
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
      bmp.close();
      return canvas.toDataURL("image/jpeg", 0.88);
    } catch (_) {
      return readBlobAsDataUrl(blob);
    }
  }

  async function embedId(id, map) {
    if (map[id]) return map[id];
    const row = await getRow(id);
    if (!row) return null;
    const blob = new Blob([row.buffer], { type: row.type });
    const dataUrl = await blobToEmbedDataUrl(blob);
    map[id] = dataUrl;
    return dataUrl;
  }

  async function embedPublishedMedia(cms, catalog) {
    const refs = new Set();
    collectRefs(cms, refs);
    collectRefs(catalog, refs);
    if (!refs.size) return;
    const map = getEmbeddedMap();
    for (const id of refs) {
      try {
        await embedId(id, map);
      } catch (_) {}
    }
    saveEmbeddedMap(map);
  }

  function toRef(id) {
    return REF_PREFIX + id;
  }

  function parseRef(src) {
    if (!src || typeof src !== "string") return null;
    if (src.startsWith(REF_PREFIX)) return src.slice(REF_PREFIX.length);
    return null;
  }

  function isBadPath(src) {
    return !src || src.startsWith("file://") || src.startsWith("file///");
  }

  async function resolveUrl(src) {
    if (isBadPath(src)) return "";
    const id = parseRef(src);
    if (id) {
      const embedded = getEmbeddedMap()[id];
      if (embedded) return embedded;
      const blob = await getBlobUrl(id);
      return blob || "";
    }
    if (src.startsWith("data:") || src.startsWith("http") || src.startsWith("assets/") || src.startsWith("/"))
      return src;
    return src;
  }

  async function uploadImageRef(file, folder) {
    const meta = await upload(file, folder || "Product Images");
    return { src: toRef(meta.id), label: file.name.replace(/\.[^.]+$/, "") || "Photo" };
  }

  async function hydrateImages(root) {
    const scope = root || document;
    const imgs = scope.querySelectorAll("img[src^='clover-media://'], img[data-media-src]");
    await Promise.all(
      [...imgs].map(async (img) => {
        const raw = img.dataset.mediaSrc || img.getAttribute("src");
        const url = await resolveUrl(raw);
        if (url) img.src = url;
      })
    );
  }

  function resolveSrc(meta) {
    if (!meta) return "";
    if (meta.url) return meta.url;
    if (meta.external) return meta.url || "";
    return null;
  }

  global.CloverMedia = {
    REF_PREFIX,
    getMetaList,
    upload,
    uploadImageRef,
    getBlobUrl,
    remove,
    addExternalUrl,
    resolveSrc,
    resolveUrl,
    toRef,
    parseRef,
    isBadPath,
    hydrateImages,
    embedPublishedMedia,
    getEmbeddedMap,
    validateFile,
    ALLOWED,
  };
})(typeof window !== "undefined" ? window : global);
