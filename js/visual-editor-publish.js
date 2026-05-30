/** Draft · Preview · Publish · Undo · Revisions */
(function (global) {
  const VE_EDIT = "clover_ve_edit";
  const VE_PREVIEW = "clover_ve_preview";
  const CMS_DRAFT = "clover_cms_draft";
  const CMS_PUB = "clover_cms";
  const CAT_DRAFT = "clover_catalog_draft";
  const REV_KEY = "clover_ve_revisions";
  const UNDO_KEY = "clover_ve_undo";

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function isEditing() {
    return sessionStorage.getItem(VE_EDIT) === "1";
  }

  function isPreview() {
    return sessionStorage.getItem(VE_PREVIEW) === "1";
  }

  function isStorefrontEditor() {
    if (typeof document === "undefined") return false;
    return (
      document.body?.classList?.contains("ve-editing") ||
      location.search.includes("ve=1")
    );
  }

  function useDraft() {
    return isEditing() && !isPreview() && isStorefrontEditor();
  }

  function enableEdit() {
    sessionStorage.setItem(VE_EDIT, "1");
    sessionStorage.removeItem(VE_PREVIEW);
    ensureDrafts();
    if (!sessionStorage.getItem(UNDO_KEY)) {
      sessionStorage.setItem(
        UNDO_KEY,
        JSON.stringify([
          { t: "cms", data: getCmsDraft() },
          { t: "catalog", data: getCatalogDraft() },
        ])
      );
    }
  }

  function disableEdit() {
    sessionStorage.removeItem(VE_EDIT);
    sessionStorage.removeItem(VE_PREVIEW);
  }

  function setPreview(on) {
    if (on) sessionStorage.setItem(VE_PREVIEW, "1");
    else sessionStorage.removeItem(VE_PREVIEW);
    window.dispatchEvent(new CustomEvent("ve:mode"));
  }

  function ensureDrafts() {
    if (!localStorage.getItem(CMS_DRAFT)) {
      localStorage.setItem(CMS_DRAFT, localStorage.getItem(CMS_PUB) || JSON.stringify(CloverCMS.DEFAULT));
    }
    if (!localStorage.getItem(CAT_DRAFT)) {
      const cat = localStorage.getItem("clover_catalog");
      localStorage.setItem(CAT_DRAFT, cat || JSON.stringify(CloverCatalogData.PRODUCTS));
    }
  }

  function getCmsDraft() {
    ensureDrafts();
    try {
      return JSON.parse(localStorage.getItem(CMS_DRAFT));
    } catch (_) {
      return clone(CloverCMS.DEFAULT);
    }
  }

  function saveCmsDraft(data) {
    localStorage.setItem(CMS_DRAFT, JSON.stringify(data));
    pushUndo("cms");
    window.dispatchEvent(new CustomEvent("cms:updated"));
  }

  function getCatalogDraft() {
    ensureDrafts();
    try {
      return JSON.parse(localStorage.getItem(CAT_DRAFT));
    } catch (_) {
      return clone(CloverCatalogData.PRODUCTS);
    }
  }

  function saveCatalogDraft(products) {
    localStorage.setItem(CAT_DRAFT, JSON.stringify(products));
    pushUndo("catalog");
    window.dispatchEvent(new CustomEvent("catalog:draft"));
  }

  function publish() {
    ensureDrafts();
    const cms = getCmsDraft();
    const cat = getCatalogDraft();
    const finish = () => {
      localStorage.setItem(CMS_PUB, JSON.stringify(cms));
      localStorage.setItem("clover_catalog", JSON.stringify(cat));
      saveRevision({ cms, catalog: cat });
      if (typeof CloverCMS !== "undefined") CloverCMS.log("ve_publish", "Published draft to live site");
      window.dispatchEvent(new CustomEvent("ve:published"));
      window.dispatchEvent(new CustomEvent("cms:updated"));
    };
    if (typeof CloverMedia !== "undefined" && CloverMedia.embedPublishedMedia) {
      return CloverMedia.embedPublishedMedia(cms, cat).then(finish).catch(finish);
    }
    finish();
    return Promise.resolve(true);
  }

  function saveRevision(snapshot) {
    let revs = [];
    try {
      revs = JSON.parse(localStorage.getItem(REV_KEY) || "[]");
    } catch (_) {}
    revs.unshift({ id: Date.now(), at: new Date().toISOString(), snapshot: clone(snapshot) });
    localStorage.setItem(REV_KEY, JSON.stringify(revs.slice(0, 30)));
  }

  function getRevisions() {
    try {
      return JSON.parse(localStorage.getItem(REV_KEY) || "[]");
    } catch (_) {
      return [];
    }
  }

  function pushUndo(type) {
    let stack = [];
    try {
      stack = JSON.parse(sessionStorage.getItem(UNDO_KEY) || "[]");
    } catch (_) {}
    const snap =
      type === "cms"
        ? { t: "cms", data: getCmsDraft() }
        : { t: "catalog", data: getCatalogDraft() };
    stack.push(snap);
    if (stack.length > 40) stack = stack.slice(-40);
    sessionStorage.setItem(UNDO_KEY, JSON.stringify(stack));
    sessionStorage.setItem("clover_ve_redo", "[]");
  }

  function undo() {
    let stack = JSON.parse(sessionStorage.getItem(UNDO_KEY) || "[]");
    if (stack.length < 2) return false;
    const current = stack.pop();
    let redo = JSON.parse(sessionStorage.getItem("clover_ve_redo") || "[]");
    redo.push(current);
    sessionStorage.setItem("clover_ve_redo", JSON.stringify(redo));
    sessionStorage.setItem(UNDO_KEY, JSON.stringify(stack));
    const prev = stack[stack.length - 1];
    if (prev.t === "cms") localStorage.setItem(CMS_DRAFT, JSON.stringify(prev.data));
    else localStorage.setItem(CAT_DRAFT, JSON.stringify(prev.data));
    window.dispatchEvent(new CustomEvent("ve:undo"));
    return true;
  }

  function redo() {
    let redo = JSON.parse(sessionStorage.getItem("clover_ve_redo") || "[]");
    if (!redo.length) return false;
    const next = redo.pop();
    sessionStorage.setItem("clover_ve_redo", JSON.stringify(redo));
    let stack = JSON.parse(sessionStorage.getItem(UNDO_KEY) || "[]");
    stack.push(next);
    sessionStorage.setItem(UNDO_KEY, JSON.stringify(stack));
    if (next.t === "cms") localStorage.setItem(CMS_DRAFT, JSON.stringify(next.data));
    else localStorage.setItem(CAT_DRAFT, JSON.stringify(next.data));
    window.dispatchEvent(new CustomEvent("ve:redo"));
    return true;
  }

  global.CloverVE = {
    VE_EDIT,
    VE_PREVIEW,
    isEditing,
    isPreview,
    useDraft,
    enableEdit,
    disableEdit,
    setPreview,
    ensureDrafts,
    getCmsDraft,
    saveCmsDraft,
    getCatalogDraft,
    saveCatalogDraft,
    publish,
    getRevisions,
    undo,
    redo,
  };
})(typeof window !== "undefined" ? window : global);
