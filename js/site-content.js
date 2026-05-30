/** THE CLOVER — Apply CMS settings to storefront pages */
(function () {
  "use strict";

  if (typeof CloverCMS === "undefined") return;

  function cmsData() {
    return CloverCMS.getPublished?.() || CloverCMS.get();
  }

  async function setImgSrc(img, src) {
    if (!img || !src) return;
    if (typeof CloverMedia !== "undefined") {
      const url = await CloverMedia.resolveUrl(src);
      if (url) img.src = url;
      return;
    }
    img.src = src;
  }

  function setMeta(attr, key, value) {
    if (!value) return;
    let meta = document.querySelector(`meta[${attr}="${key}"]`);
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute(attr, key);
      document.head.appendChild(meta);
    }
    meta.content = value;
  }

  async function applySeo() {
    const seo = cmsData().seo;
    if (seo.metaDescription) setMeta("name", "description", seo.metaDescription);
    if (seo.siteTitle) document.title = seo.siteTitle;
    if (seo.ogImage) {
      let ogUrl = seo.ogImage;
      if (typeof CloverMedia !== "undefined") {
        const resolved = await CloverMedia.resolveUrl(seo.ogImage);
        if (resolved) ogUrl = resolved;
      }
      setMeta("property", "og:image", ogUrl);
      setMeta("name", "twitter:image", ogUrl);
    }
  }

  async function applyHomepage() {
    if (document.body.dataset.page !== "home") return;
    const hp = cmsData().homepage;

    const hero = hp.hero;
    const title = document.querySelector(".veg-hero__title");
    if (title && hero.title) title.innerHTML = hero.title;
    const desc = document.querySelector(".veg-hero__desc");
    if (desc && hero.subtitle) desc.textContent = hero.subtitle;
    const cta = document.querySelector(".veg-hero .btn--dark");
    if (cta) {
      if (hero.ctaLabel) cta.textContent = hero.ctaLabel;
      if (hero.ctaHref) cta.href = hero.ctaHref;
    }
    const video = document.querySelector(".veg-hero__video");
    if (video) {
      if (hero.videoSrc) video.src = hero.videoSrc;
      video.autoplay = !!hero.videoAutoplay;
      video.muted = !!hero.videoMuted;
      video.loop = !!hero.videoLoop;
      video.style.display = hero.videoEnabled === false ? "none" : "";
      if (hero.imageSrc && hero.videoEnabled === false) {
        const img = document.createElement("img");
        img.alt = "Hero";
        img.className = "veg-hero__video";
        await setImgSrc(img, hero.imageSrc);
        video.replaceWith(img);
      }
    }
    const t1 = document.querySelector(".veg-hero__tag--1");
    const t2 = document.querySelector(".veg-hero__tag--2");
    if (t1 && hero.tag1) t1.textContent = hero.tag1;
    if (t2 && hero.tag2) t2.textContent = hero.tag2;

    const sec = hp.featuredSection;
    const eyebrow = document.querySelector(".veg-special .veg-eyebrow");
    const h1 = document.querySelector(".veg-special .veg-section-title");
    const sub = document.querySelector(".veg-special .page-hero p");
    if (eyebrow && sec.eyebrow) eyebrow.textContent = sec.eyebrow;
    if (h1 && sec.title) h1.textContent = sec.title;
    if (sub && sec.subtitle) sub.textContent = sec.subtitle;

    const expert = hp.expert;
    const exTitle = document.querySelector(".veg-expert .veg-section-title");
    if (exTitle && expert.title) exTitle.innerHTML = expert.title;
    const exImg = document.querySelector(".veg-expert__media img");
    if (exImg && expert.imageSrc) await setImgSrc(exImg, expert.imageSrc);

    const nl = hp.newsletter;
    const nlH = document.querySelector(".veg-newsletter h2");
    const nlP = document.querySelector(".veg-newsletter p");
    if (nlH && nl.title) nlH.innerHTML = nl.title;
    if (nlP && nl.subtitle) nlP.textContent = nl.subtitle;
  }

  async function applyAbout() {
    if (document.body.dataset.page !== "about") return;
    const about = cmsData().about;
    const h1 = document.querySelector(".page-hero h1");
    const sub = document.querySelector(".page-hero p");
    if (h1 && about.title) h1.textContent = about.title;
    if (sub && about.subtitle) sub.textContent = about.subtitle;
    const img = document.querySelector(".about-split img[data-about-image], .about-split img");
    if (img && about.imageSrc) await setImgSrc(img, about.imageSrc);
    const copy = document.querySelector(".about-copy p");
    if (copy && about.body) copy.textContent = about.body;
  }

  function applyShop() {
    if (document.body.dataset.page !== "shop") return;
    const s = cmsData().shop;
    if (!s) return;
    const eyebrow = document.querySelector(".page-hero .veg-eyebrow");
    const h1 = document.querySelector(".page-hero .veg-section-title");
    const sub = document.querySelector(".page-hero p");
    if (eyebrow && s.eyebrow) eyebrow.textContent = s.eyebrow;
    if (h1 && s.title) h1.textContent = s.title;
    if (sub && s.subtitle) sub.textContent = s.subtitle;
  }

  function applyContact() {
    if (document.body.dataset.page !== "contact") return;
    const c = cmsData().contact;
    const h1 = document.querySelector(".page-hero h1");
    const sub = document.querySelector(".page-hero p");
    if (h1 && c.title) h1.textContent = c.title;
    if (sub && c.subtitle) sub.textContent = c.subtitle;
    const items = document.querySelectorAll(".contact-item");
    items.forEach((el) => {
      const strong = el.querySelector("strong")?.textContent?.toLowerCase() || "";
      const target = el.querySelector("a, span:last-child");
      if (!target) return;
      if (strong.includes("email") && c.email) target.textContent = c.email;
      if (strong.includes("phone") && c.phone) target.textContent = c.phone;
      if (strong.includes("hours") && c.hours) target.textContent = c.hours;
      if (strong.includes("flagship") && c.address) target.textContent = c.address;
    });
  }

  function applyFooter() {
    const f = cmsData().footer;
    const brandP = document.querySelector(".veg-footer__brand p");
    if (brandP && f.address) brandP.innerHTML = f.address.replace(/\n/g, "<br />");
    const copy = document.querySelector(".veg-footer__bottom p");
    if (copy && f.copyright) copy.textContent = f.copyright;
  }

  async function refresh() {
    await applySeo();
    await applyHomepage();
    await applyAbout();
    applyShop();
    applyContact();
    applyFooter();
    if (typeof CloverMedia !== "undefined") CloverMedia.hydrateImages(document);
  }

  function init() {
    refresh();
    window.addEventListener("cms:updated", () => refresh());
    window.addEventListener("ve:published", () => refresh());
    window.addEventListener("catalog:updated", () => {
      if (typeof window.__homeRefresh === "function") window.__homeRefresh();
      if (typeof window.__shopRefresh === "function") window.__shopRefresh();
      if (typeof window.CloverPDP?.refresh === "function") window.CloverPDP.refresh();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
