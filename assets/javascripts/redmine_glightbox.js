// Redmine GLightbox Integration
// Automatically enhances supported Redmine attachments with GLightbox

(function () {
  "use strict";

  // Public API for external regeneration
  window.redmineGLightbox = window.redmineGLightbox || {};

  const imgExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"];
  const videoExtensions = ["mp4", "webm", "ogg", "mov", "avi", "flv", "mkv"];
  const mimeTypeMap = {
    mp4: "video/mp4",
    webm: "video/webm",
    ogg: "video/ogg",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    flv: "video/x-flv",
    mkv: "video/x-matroska",
  };
  const scriptPath = "/assets/plugin_assets/redmine_glightbox";
  const scriptEl = document.querySelector(
    "head script[src*='" + scriptPath + "']",
  );
  const homeUrl =
    scriptEl && scriptEl.src ? scriptEl.src.split(scriptPath)[0] : "";
  const zoomLevels = [1.2, 1.5, 2, 3, 5];
  const maxZoomScale = zoomLevels[zoomLevels.length - 1];

  // Store state for regeneration
  let currentLightbox = null;
  let currentThumbnailPanel = null;

  function parseAttachmentIdFromUrl(url) {
    const match = url.match(
      /\/attachments\/(?:(download|thumbnail)\/)?(\d+)(?:\/|$)/,
    );
    return match ? parseInt(match[2]) : null;
  }

  // Parse URL query parameters
  function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    const value = urlParams.get(param);

    if (param === "glightbox" && value !== null) {
      if (!/^\d+$/.test(value)) {
        return null;
      }

      const attachmentId = Number.parseInt(value, 10);
      return Number.isNaN(attachmentId) ? null : attachmentId;
    }

    return value;
  }

  function hasQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has(param);
  }

  // Update URL with query parameter using attachment ID
  function updateUrl(attachmentId, action = "replace") {
    const url = new URL(window.location);
    if (attachmentId !== null && attachmentId !== undefined) {
      url.searchParams.set("glightbox", attachmentId);
    } else {
      url.searchParams.delete("glightbox");
    }

    if (action === "push") {
      window.history.pushState({ glightbox: attachmentId }, "", url);
    } else {
      window.history.replaceState({ glightbox: attachmentId }, "", url);
    }
  }

  // Create thumbnail panel for GLightbox
  function createThumbnailPanel(glightboxContent) {
    const panel = document.createElement("div");
    panel.className = "glightbox-thumbs";

    const outer = document.createElement("div");
    outer.className = "glightbox-thumbs-outer";

    const inner = document.createElement("div");
    inner.className = "glightbox-thumbs-inner";

    outer.appendChild(inner);
    panel.appendChild(outer);

    // Create thumbnail buttons
    glightboxContent.forEach((item, index) => {
      const button = document.createElement("button");
      button.className = "glightbox-thumb-btn";
      button.setAttribute("title", item.title || `Image ${index + 1}`);
      button.setAttribute("aria-label", item.title || `Image ${index + 1}`);
      button.dataset.index = index;

      if (item.thumb) {
        const img = document.createElement("img");
        img.src = item.thumb;
        img.alt = item.title || `Image ${index + 1}`;
        button.appendChild(img);
      }
      inner.appendChild(button);
    });

    return panel;
  }

  // Global flag to track if we're navigating via browser history
  let isHistoryNavigation = false;

  // Listen to pageshow to detect bfcache restore
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      isHistoryNavigation = true;
    }
  });

  function extractFilenameFromElement(el) {
    return (
      el?.textContent ||
      el?.alt ||
      el?.title ||
      decodeURIComponent((el?.href || el?.src).split("/").pop()) ||
      ""
    );
  }

  function generateDownloadUrl(id, filename) {
    return (
      `${homeUrl}/attachments/download/${id}/` + encodeURIComponent(filename)
    );
  }

  // Cleanup function to destroy existing lightbox
  function cleanupGLightbox() {
    if (currentLightbox) {
      currentLightbox.destroy();
      currentLightbox = null;
    }

    if (currentThumbnailPanel) {
      currentThumbnailPanel.remove();
      currentThumbnailPanel = null;
    }

    // Remove event handlers and class from target elements
    $("#content").off("click", ".glightbox-target");
    document.querySelectorAll(".glightbox-target").forEach((el) => {
      el.classList.remove("glightbox-target");
    });
  }

  class ImageZoomController {
    // --- Static helper methods ---

    static clampZoomScale(value) {
      if (value <= 0) {
        return 0;
      }

      return Math.min(maxZoomScale, Math.max(zoomLevels[0], value));
    }

    static getNextZoomScale(currentScale, direction) {
      if (direction > 0) {
        return zoomLevels.find((scale) => scale > currentScale) || maxZoomScale;
      }

      const previousLevels = zoomLevels.filter((scale) => scale < currentScale);
      return previousLevels.length > 0
        ? previousLevels[previousLevels.length - 1]
        : 0;
    }

    // --- Constructor ---

    constructor() {
      this.zoomInButton = null;
      this.zoomOutButton = null;
      this.slideNode = null;
      this.img = null;
    }

    // --- Instance helper methods ---

    getSlideImage() {
      return this.slideNode?.querySelector(".gslide-image img") || null;
    }

    getZoomViewport() {
      return (
        this.slideNode?.querySelector(".ginner-container") ||
        this.slideNode?.querySelector(".gslide-inner-content") ||
        this.slideNode
      );
    }

    isNativeZoomAvailable() {
      return Boolean(
        this.slideNode &&
        this.img &&
        this.slideNode.classList.contains("zoomed") &&
        this.img.classList.contains("zoomable") &&
        window.innerWidth > 768 &&
        this.img.dataset.rgZoomMode !== "manual",
      );
    }

    getCurrentZoomScale() {
      const customScale = Number.parseFloat(this.img?.dataset.rgZoomScale || "");

      if (!Number.isNaN(customScale) && customScale > 0) {
        return customScale;
      }

      return this.slideNode?.classList.contains("zoomed") ? 1 : 0;
    }

    getManualZoomOffset() {
      const offsetX = Number.parseFloat(this.img?.dataset.rgZoomOffsetX || "0");
      const offsetY = Number.parseFloat(this.img?.dataset.rgZoomOffsetY || "0");

      return {
        x: Number.isNaN(offsetX) ? 0 : offsetX,
        y: Number.isNaN(offsetY) ? 0 : offsetY,
      };
    }

    canUseNativeZoom() {
      return Boolean(this.img.classList.contains("zoomable") && window.innerWidth > 768);
    }

    getImageContainer() {
      return this.img.closest(".gslide-image") || this.img.parentElement;
    }

    renderManualZoomTransform(autoCorrect = true) {
      if (!this.img) {
        return;
      }

      const viewPort = this.getZoomViewport();
      const overflow = {
        x: Math.max(0, this.img.offsetWidth - viewPort.offsetWidth),
        y: Math.max(0, this.img.offsetHeight - viewPort.offsetHeight),
      };

      const correction = autoCorrect ? {
        x: this.canUseNativeZoom()
          ? -this.getImageContainer().getBoundingClientRect().left
          : 0,
        y: 0,
      } : { x: 0, y: 0 };

      const dragOffset = this.getManualZoomOffset();
      const currentScale = this.getCurrentZoomScale();
      const totalOffset = {
        x: dragOffset.x * currentScale + (correction.x || 0) - overflow.x / 2,
        y: dragOffset.y * currentScale + (correction.y || 0) - overflow.y / 2,
      };

      if (totalOffset.x === 0 && totalOffset.y === 0) {
        this.img.style.transform = "";
        return;
      }

      this.img.style.transform = `translate3d(${totalOffset.x}px, ${totalOffset.y}px, 0)`;
    }

    applyManualZoomOffset(offsetX, offsetY) {
      if (!this.img) {
        return;
      }

      this.img.dataset.rgZoomOffsetX = String(offsetX);
      this.img.dataset.rgZoomOffsetY = String(offsetY);
      this.renderManualZoomTransform();
    }

    resetManualZoomOffset() {
      if (!this.img) {
        return;
      }

      delete this.img.dataset.rgZoomOffsetX;
      delete this.img.dataset.rgZoomOffsetY;
      this.renderManualZoomTransform(false);
    }

    clearManualZoom() {
      if (!this.slideNode || !this.img) {
        return;
      }

      delete this.img.dataset.rgZoomScale;
      delete this.img.dataset.rgZoomMode;
      this.img.style.width = "";
      this.img.style.height = "";
      this.img.style.maxWidth = "";
      this.img.style.maxHeight = "";
      this.img.style.transformOrigin = "";
      this.img.classList.remove("rg-manual-zoom", "dragging");
      this.img.isDragging = false;
      this.resetManualZoomOffset();

      if (this.img.parentElement) {
        this.img.parentElement.style.transform = "";
      }

      this.slideNode.classList.remove("zoomed");
    }

    applyZoom(scale) {
      if (!this.slideNode || !this.img) {
        return 0;
      }

      const nextScale = ImageZoomController.clampZoomScale(scale);

      if (nextScale <= 0) {
        this.clearManualZoom();
        return 0;
      }

      this.img.dataset.rgZoomScale = String(nextScale);
      this.img.dataset.rgZoomMode = "manual";
      this.img.style.width = `${this.img.naturalWidth * nextScale}px`;
      this.img.style.height = `${this.img.naturalHeight * nextScale}px`;
      this.img.style.maxWidth = "none";
      this.img.style.maxHeight = "none";
      this.img.style.transformOrigin = "center center";
      this.img.classList.add("rg-manual-zoom");

      this.renderManualZoomTransform();

      this.slideNode.classList.add("zoomed");

      return nextScale;
    }

    restoreNativeZoom() {
      if (!this.img) {
        return;
      }

      delete this.img.dataset.rgZoomScale;
      delete this.img.dataset.rgZoomMode;
      this.img.style.width = "";
      this.img.style.height = "";
      this.img.style.maxWidth = `${this.img.naturalWidth}px`;
      this.img.style.maxHeight = `${this.img.naturalHeight}px`;
      this.img.classList.remove("rg-manual-zoom", "dragging");
      this.img.isDragging = false;
      this.resetManualZoomOffset();
      this.img.style.transformOrigin = "center center";
    }

    dispatchNativeImageClick() {
      if (!this.img) {
        return;
      }

      this.img.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      );
    }

    // --- Public methods ---

    setButtons(zoomInButton, zoomOutButton) {
      this.zoomInButton = zoomInButton;
      this.zoomOutButton = zoomOutButton;
    }

    clearButtons() {
      this.zoomInButton = null;
      this.zoomOutButton = null;
    }

    updateZoomButtons() {
      if (!this.zoomInButton || !this.zoomOutButton) {
        return;
      }

      this.slideNode = document.querySelector(".gslide.current");
      this.img = this.getSlideImage();

      if (!this.slideNode || !this.img) {
        this.zoomInButton.disabled = true;
        this.zoomOutButton.disabled = true;
        return;
      }

      const currentScale = this.getCurrentZoomScale();
      this.zoomInButton.disabled = currentScale >= maxZoomScale;
      this.zoomOutButton.disabled = currentScale <= 0;
    }

    syncImageZoomState(slideNode) {
      this.slideNode = slideNode;
      this.img = this.getSlideImage();

      if (!this.slideNode || !this.img) {
        this.updateZoomButtons();
        return;
      }

      if (!this.slideNode.classList.contains("zoomed")) {
        delete this.img.dataset.rgZoomScale;
        delete this.img.dataset.rgZoomMode;
        this.img.style.transformOrigin = "";
      } else if (this.img.dataset.rgZoomMode !== "manual") {
        if (this.getCurrentZoomScale() <= 1) {
          delete this.img.dataset.rgZoomScale;
          delete this.img.dataset.rgZoomMode;
        }
      }

      this.updateZoomButtons();
    }

    setImageZoomScale(requestedScale) {
      if (!this.slideNode || !this.img) {
        return;
      }

      const targetScale = ImageZoomController.clampZoomScale(requestedScale);

      if (targetScale <= 0) {
        if (this.isNativeZoomAvailable()) {
          this.restoreNativeZoom();
          this.dispatchNativeImageClick();
        } else {
          this.clearManualZoom();
        }
        requestAnimationFrame(() => {
          this.updateZoomButtons();
        });
        return;
      }

      if (this.canUseNativeZoom()) {
        if (!this.slideNode.classList.contains("zoomed")) {
          this.dispatchNativeImageClick();
          this.updateZoomButtons();
          return;
        } else if (this.getCurrentZoomScale() == 1 && targetScale > 1) {
          // Keep the visual position when switching from native to manual zoom mode.
          const imgContainerRect = this.getImageContainer().getBoundingClientRect();
          const imgRect = this.img.getBoundingClientRect();
          this.applyManualZoomOffset(
            imgRect.left - imgContainerRect.left,
            imgRect.top - imgContainerRect.top,
          );
        }
      }

      this.applyZoom(targetScale);
      this.updateZoomButtons();
    }

    adjustActiveImageZoom(direction) {
      this.slideNode = document.querySelector(".gslide.current");
      this.img = this.getSlideImage();

      if (!this.slideNode || !this.img) {
        this.updateZoomButtons();
        return;
      }

      const currentScale = this.getCurrentZoomScale();
      const targetScale = ImageZoomController.getNextZoomScale(currentScale, direction);

      this.setImageZoomScale(targetScale);
    }

    prepareImageZoom(slideNode) {
      this.slideNode = slideNode;
      this.img = this.getSlideImage();

      if (!this.slideNode || !this.img || this.img.dataset.rgZoomPrepared === "true") {
        return;
      }

      const img = this.img;
      img.dataset.rgZoomPrepared = "true";

      let activePointerId = null;
      let startPointerX = 0;
      let startPointerY = 0;
      let startOffsetX = 0;
      let startOffsetY = 0;

      const stopManualDrag = () => {
        activePointerId = null;
        img.classList.remove("dragging");

        setTimeout(() => {
          img.isDragging = false;
        }, 100);
      };

      const onPointerMove = (event) => {
        if (activePointerId !== event.pointerId) {
          return;
        }

        event.preventDefault();

        this.slideNode = slideNode;
        this.img = img;
        const currentScale = this.getCurrentZoomScale();
        const nextOffsetX =
          startOffsetX + (event.clientX - startPointerX) / currentScale;
        const nextOffsetY =
          startOffsetY + (event.clientY - startPointerY) / currentScale;
        img.isDragging = true;
        this.applyManualZoomOffset(nextOffsetX, nextOffsetY);
      };

      const onPointerUp = (event) => {
        if (activePointerId !== event.pointerId) {
          return;
        }

        if (img.hasPointerCapture?.(event.pointerId)) {
          img.releasePointerCapture(event.pointerId);
        }

        stopManualDrag();
      };

      img.addEventListener("pointerdown", (event) => {
        this.slideNode = slideNode;
        this.img = img;
        const currentScale = this.getCurrentZoomScale();
        const isManualZoom = img.dataset.rgZoomMode === "manual";

        if (
          !isManualZoom ||
          currentScale <= 1 ||
          (event.pointerType === "mouse" && event.button !== 0)
        ) {
          return;
        }

        const currentOffset = this.getManualZoomOffset();
        activePointerId = event.pointerId;
        startPointerX = event.clientX;
        startPointerY = event.clientY;
        startOffsetX = currentOffset.x;
        startOffsetY = currentOffset.y;
        img.isDragging = false;
        img.classList.add("dragging");
        img.setPointerCapture?.(event.pointerId);
        event.preventDefault();
      });

      img.addEventListener("pointermove", onPointerMove);
      img.addEventListener("pointerup", onPointerUp);
      img.addEventListener("pointercancel", onPointerUp);

      img.addEventListener(
        "click",
        (event) => {
          this.slideNode = slideNode;
          this.img = img;
          const currentScale = this.getCurrentZoomScale();

          if (currentScale > 1) {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (!img.isDragging) {
              this.setImageZoomScale(1);
            }
          }
        },
        true,
      );

      img.addEventListener("click", () => {
        requestAnimationFrame(() => {
          this.syncImageZoomState(slideNode);
        });
      });
    }
  }

  // Wait for DOM to be ready
  async function initGLightbox() {
    if (typeof GLightbox === "undefined") {
      console.warn("GLightbox library not loaded");
      return;
    }

    const controller = Array.from(document.body.classList)
      .filter((item) => item.startsWith("controller-"))[0]
      ?.replace("controller-", "");
    const action = Array.from(document.body.classList)
      .filter((item) => item.startsWith("action-"))[0]
      ?.replace("action-", "");

    // Detect attachment links
    const allAttachments = Array.from(
      document.querySelectorAll("#main :is(a[href], img[src])"),
    )
      .map((el) => {
        const url = el.href || el.src;
        const id = parseAttachmentIdFromUrl(url);
        const filename = id ? extractFilenameFromElement(el) : null;
        const content_url =
          id && filename ? generateDownloadUrl(id, filename) : null;
        return { id, filename, content_url };
      })
      .filter((item) => item.id !== null)
      .filter(
        // Remove duplicates based on ID, keeping the first occurrence
        (item, index, self) =>
          item && self.findIndex((i) => i.id === item.id) === index,
      );

    // Fetch attachment data for each ID
    const attachmentCandidates = await Promise.all(
      allAttachments.map(async (attachment) => {
        if (attachment.content_url) {
          return attachment;
        }

        // Try to get attachment data from sessionStorage
        const storageKey = `redmine_glightbox_attachment_${attachment.id}`;
        const cachedData = sessionStorage.getItem(storageKey);
        if (cachedData) {
          try {
            return JSON.parse(cachedData);
          } catch (e) {
            console.warn("Failed to parse cached attachment data:", e);
          }
        }

        // Fetch attachment data from html page
        const content_url = await fetch(
          `${homeUrl}/attachments/${attachment.id}`,
        )
          .then((response) => response.text())
          .then((html) => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            return doc.querySelector('a[href*="/attachments/download/"]')?.href;
          });

        return {
          id: attachment.id,
          filename:
            attachment.filename ||
            decodeURIComponent(content_url?.split("/").pop()),
          content_url: content_url,
        };
      }),
    );

    // Save to sessionStorage
    attachmentCandidates.forEach((attachmentData) => {
      const storageKey = `redmine_glightbox_attachment_${attachmentData.id}`;
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(attachmentData));
      } catch (e) {
        console.warn("Failed to cache attachment data:", e);
      }
    });

    const attachments = attachmentCandidates
      .filter((attachment) => attachment && attachment.content_url)
      .filter((attachment) => {
        const urlLower = attachment.content_url?.toLowerCase();
        return urlLower?.match(
          new RegExp(
            "\\.(" +
            imgExtensions.join("|") +
            "|" +
            videoExtensions.join("|") +
            "|pdf" +
            ")(\\?|$)",
            "i",
          ),
        );
      });

    if (!attachments || attachments.length === 0) {
      return;
    }

    // Extract attachment IDs
    const attachmentIds = attachments.map((attachment) => attachment.id);

    // Prepare GLightbox content array
    const glightboxContent = attachments.map((attachment) => {
      const attachmentId = attachment.id;
      const url = attachment.content_url;
      const isVideo = new RegExp(
        "\\.(" + videoExtensions.join("|") + ")(\\?|$)",
        "i",
      ).test(url.toLowerCase());
      const isPdf = /\.pdf(\?|$)/i.test(url.toLowerCase());
      const caption = attachment.filename;
      const thumbnailImgEl = document.querySelector(
        `img[src*='/attachments/thumbnail/${attachmentId}']`,
      );

      if (isVideo) {
        const videoType = url
          .toLowerCase()
          .match(
            new RegExp("\\.(" + videoExtensions.join("|") + ")(\\?|$)", "i"),
          )[1];
        const mimeType = mimeTypeMap[videoType] || "video/mp4";
        const videoIconThumbnail = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23333' width='100' height='100'/%3E%3Cpolygon fill='%23fff' points='41.25,31.25 41.25,68.75 68.75,50'/%3E%3C/svg%3E`;
        const videoHtml = `<video class="glightbox-video-native" controls preload="metadata"><source src="${url}" type="${mimeType}"></video>`;

        return {
          type: "inline",
          content: videoHtml,
          width: "90vw",
          height: "90vh",
          title: caption,
          thumb: thumbnailImgEl?.src || videoIconThumbnail,
        };
      }

      if (isPdf) {
        const pdfIconThumbnail = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23e2e2e2' width='100' height='100'/%3E%3Ctext x='50' y='55' font-size='30' text-anchor='middle' fill='%23333' font-family='Arial, sans-serif'%3EPDF%3C/text%3E%3C/svg%3E`;
        const iframeHtml = `<iframe class="glightbox-pdf-iframe" src="${url}" style="width: 100%; height: 100%;" loading="lazy"></iframe>`;
        return {
          type: "inline",
          content: iframeHtml,
          title: caption,
          width: "90vw",
          height: "90vh",
          thumb: thumbnailImgEl?.src || pdfIconThumbnail,
        };
      }

      return {
        href: url,
        type: "image",
        title: caption,
        thumb: thumbnailImgEl?.src || url,
        alt: caption,
      };
    });

    // Create thumbnail panel HTML
    const thumbPanel = createThumbnailPanel(glightboxContent);
    currentThumbnailPanel = thumbPanel;

    // Function to update active thumbnail
    const updateActiveThumbnail = (index) => {
      const allButtons = thumbPanel.querySelectorAll(".glightbox-thumb-btn");
      allButtons.forEach((btn, idx) => {
        btn.classList.toggle("active", idx === index);
      });

      // Scroll the active thumbnail into view
      if (allButtons[index]) {
        const activeBtn = allButtons[index];
        const outer = thumbPanel.querySelector(".glightbox-thumbs-outer");
        const { left, right } = activeBtn.getBoundingClientRect();
        const { left: outerLeft, right: outerRight } =
          outer.getBoundingClientRect();

        if (right > outerRight) {
          outer.scrollLeft += right - outerRight + 4;
        } else if (left < outerLeft) {
          outer.scrollLeft -= outerLeft - left + 4;
        }
      }
    };

    let zoomController = null;

    const ensureImageLoaded = (payload) => {
      const slideNode = payload?.slide;
      if (!slideNode) {
        return;
      }

      const img = slideNode.querySelector("img");
      if (!img) {
        return;
      }

      const src = img.getAttribute("src");
      if (!src) {
        return;
      }

      const retry = () => {
        if (img.complete && img.naturalWidth === 0) {
          img.src = "";
          requestAnimationFrame(() => {
            img.src = src;
          });
        }
      };

      img.addEventListener("error", retry, { once: true });
      setTimeout(retry, 300);
    };

    const renderFilename = (payload) => {
      const slideNode = payload?.slide;
      if (!slideNode) {
        return;
      }

      const title = glightboxContent[payload.index]?.title || "";
      const existing = slideNode.querySelector(".glightbox-filename");

      if (!title) {
        if (existing) {
          existing.remove();
        }
        return;
      }

      const label = existing || document.createElement("div");
      label.className = "glightbox-filename";
      label.textContent = title;

      if (!existing) {
        const inner = slideNode.querySelector(".gslide-inner-content");
        (inner || slideNode).appendChild(label);
      }
    };

    // Create thumbnail toggle button
    function createThumbnailToggleButton() {
      const button = document.createElement("button");
      button.className = "glightbox-toggle-thumbs";
      const label_toggle_thumbs =
        window.redmineGLightbox.i18n?.label_toggle_thumbs ||
        "Toggle thumbnails";
      button.setAttribute("title", label_toggle_thumbs);
      button.setAttribute("aria-label", label_toggle_thumbs);
      // SVG for hide icon
      button.innerHTML =
        '<svg class="toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="0" y="2" width="24" height="20"/><rect x="2" y="16" width="5" height="5"/><rect x="9.5" y="16" width="5" height="5"/><rect x="17" y="16" width="5" height="5"/></svg>';
      return button;
    }

    // Bootstrap Icons moon SVG for dark background toggle
    const darkBGIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-moon" viewBox="0 0 16 16">
      <path d="M6 .278a.77.77 0 0 1 .08.858 7.2 7.2 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277q.792-.001 1.533-.16a.79.79 0 0 1 .81.316.73.73 0 0 1-.031.893A8.35 8.35 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.75.75 0 0 1 6 .278M4.858 1.311A7.27 7.27 0 0 0 1.025 7.71c0 4.02 3.279 7.276 7.319 7.276a7.32 7.32 0 0 0 5.205-2.162q-.506.063-1.029.063c-4.61 0-8.343-3.714-8.343-8.29 0-1.167.242-2.278.681-3.286"/>
      </svg>`;

    // Bootstrap Icons sun SVG for light background toggle
    const lightBGIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-sun" viewBox="0 0 16 16">
      <path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6m0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8M8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0m0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13m8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5M3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8m10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0m-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0m9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707M4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708"/>
      </svg>`;

    // Create background color toggle button
    function createBackgroundToggleButton() {
      const button = document.createElement("button");
      button.className = "glightbox-toggle-bg";
      const label_toggle_bg = window.redmineGLightbox?.i18n?.label_toggle_bg || "Toggle background color";
      button.setAttribute("title", label_toggle_bg);
      button.setAttribute("aria-label", label_toggle_bg);
      // Default to dark background icon
      button.innerHTML = darkBGIconSvg;
      return button;
    }

    // Create zoom-in button
    function createZoomInButton() {
      const button = document.createElement("button");
      button.className = "glightbox-zoom-in";
      const label_zoom_in = window.redmineGLightbox?.i18n?.label_zoom_in || "Zoom in";
      button.setAttribute("title", label_zoom_in);
      button.setAttribute("aria-label", label_zoom_in);
      // Bootstrap Icons zoom-in SVG (to avoid confusion with existing zoom icons in GLightbox)
      button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-zoom-in" viewBox="0 0 16 16">`
        + `<path fill-rule="evenodd" d="M6.5 12a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11M13 6.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0"/>`
        + `<path d="M10.344 11.742q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1 6.5 6.5 0 0 1-1.398 1.4z"/>`
        + `<path fill-rule="evenodd" d="M6.5 3a.5.5 0 0 1 .5.5V6h2.5a.5.5 0 0 1 0 1H7v2.5a.5.5 0 0 1-1 0V7H3.5a.5.5 0 0 1 0-1H6V3.5a.5.5 0 0 1 .5-.5"/>`
        + `</svg>`;
      return button;
    }

    // Create zoom-out button
    function createZoomOutButton() {
      const button = document.createElement("button");
      button.className = "glightbox-zoom-out";
      const label_zoom_out = window.redmineGLightbox?.i18n?.label_zoom_out || "Zoom out";
      button.setAttribute("title", label_zoom_out);
      button.setAttribute("aria-label", label_zoom_out);
      // Bootstrap Icons zoom-out SVG (to avoid confusion with existing zoom icons in GLightbox)
      button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-zoom-out" viewBox="0 0 16 16">`
        + `<path fill-rule="evenodd" d="M6.5 12a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11M13 6.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0"/>`
        + `<path d="M10.344 11.742q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1 6.5 6.5 0 0 1-1.398 1.4z"/>`
        + `<path fill-rule="evenodd" d="M3 6.5a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5"/>`
        + `</svg>`;
      return button;
    }

    function getParents(el, selector) {
      const parents = [];
      while ((el = el.parentElement) !== null) {
        if (el.nodeType !== Node.ELEMENT_NODE) continue;
        if (!selector || el.matches(selector)) {
          parents.push(el);
        }
      }
      return parents;
    }

    // Flag to track if closing from popstate event
    let isClosingFromPopstate = false;
    // Flag to track if lightbox is currently open
    let isLightboxOpen = false;

    // Initialize GLightbox
    const lightbox = GLightbox({
      elements: glightboxContent,
      touchNavigation: true,
      loop: false,
      autoplayVideos: false,
      preload: false,
      slideEffect: "fade",
      onOpen: () => {
        isLightboxOpen = true;
        const container = document.querySelector(".glightbox-container");
        if (container) {
          container.appendChild(thumbPanel);
        }

        const customButtonsContainer = document.createElement("div");
        customButtonsContainer.className = "glightbox-custom-buttons";

        const zoomInButton = createZoomInButton();
        zoomInButton.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          zoomController.adjustActiveImageZoom(1);
        });
        customButtonsContainer.appendChild(zoomInButton);

        const zoomOutButton = createZoomOutButton();
        zoomOutButton.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          zoomController.adjustActiveImageZoom(-1);
        });
        customButtonsContainer.appendChild(zoomOutButton);
        zoomController = new ImageZoomController();
        zoomController.setButtons(zoomInButton, zoomOutButton);

        const bgToggleButton = createBackgroundToggleButton();
        bgToggleButton.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const isLight = document.querySelector("#glightbox-body").classList.toggle("glightbox-light-bg");
          bgToggleButton.innerHTML = isLight ? lightBGIconSvg : darkBGIconSvg;
        });
        customButtonsContainer.appendChild(bgToggleButton);

        // Create and add thumbnail toggle button
        const toggleButton = createThumbnailToggleButton();
        toggleButton.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const isVisible = !thumbPanel.classList.contains(
            "glightbox-thumbs-collapsed",
          );
          thumbPanel.classList.toggle("glightbox-thumbs-collapsed", isVisible);
        });
        customButtonsContainer.appendChild(toggleButton);

        const closeBtn = container.querySelector(".gclose");
        if (closeBtn && !closeBtn.querySelector(".glightbox-toggle-thumbs")) {
          closeBtn.parentElement.insertBefore(customButtonsContainer, closeBtn);
        }

        const index = lightbox.getActiveSlideIndex();
        updateActiveThumbnail(index);
        if (zoomController) {
          zoomController.prepareImageZoom(document.querySelector(".gslide.current"));
          zoomController.updateZoomButtons();
        }

        // Update URL with current attachment ID on open
        // Use push for normal open, replace for history navigation to avoid creating duplicate history
        if (isHistoryNavigation) {
          updateUrl(attachmentIds[index], "replace");
          isHistoryNavigation = false;
        } else {
          updateUrl(attachmentIds[index], "push");
        }
      },
      beforeSlideChange: (_prev, current) => {
        updateActiveThumbnail(current.index);
        if (zoomController) {
          requestAnimationFrame(() => {
            zoomController.prepareImageZoom(document.querySelector(".gslide.current"));
            zoomController.updateZoomButtons();
          });
        }

        // Update URL when slide changes with attachment ID (without creating new history entry)
        updateUrl(attachmentIds[current.index]);
      },
      afterSlideLoad: (payload) => {
        ensureImageLoaded(payload);
        renderFilename(payload);
        if (zoomController) {
          zoomController.prepareImageZoom(payload?.slide);
          zoomController.updateZoomButtons();
        }
      },
      onClose: () => {
        isLightboxOpen = false;
        // When user closes manually, create new history entry without glightbox query
        if (!isClosingFromPopstate) {
          updateUrl(null, "push");
        }
        isClosingFromPopstate = false;
      },
    });

    // Store current lightbox instance
    currentLightbox = lightbox;

    // Add click handlers to thumbnails
    const thumbnailButtons = thumbPanel.querySelectorAll(
      ".glightbox-thumb-btn",
    );
    thumbnailButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const button = e.target.closest(".glightbox-thumb-btn");
        const index = parseInt(button.dataset.index);
        lightbox.goToSlide(index);
      });
    });

    // Add class to target elements
    let targetElements = Array.from(
      document.querySelectorAll(
        "a[href]" +
        ':not([data-method="delete"])' +
        ':not([href*="/attachments/download/"])' +
        ", img[src]",
      ),
    )
      .filter((el) => {
        const href = el.href || el.src;
        return attachmentIds.some((id) =>
          href.match(
            new RegExp(`/attachments/(?:(download|thumbnail)/)?${id}(?:/|$)`),
          ),
        );
      })
      .map((el) => {
        el.classList.add("glightbox-target");
        return el;
      });

    // Remove duplicate target elements (e.g. thumbnail)
    targetElements = targetElements.filter((el) => {
      const hasParent = getParents(el, ".glightbox-target").some((parent) => {
        return el !== parent && parent.contains(el);
      });
      if (hasParent) {
        el.classList.remove("glightbox-target");
      }
      return !hasParent;
    });

    // Attach click handlers to target elements to open lightbox
    $("#content").on("click", ".glightbox-target", function (e) {
      const href = this.href || this.src;
      const attachmentId = parseAttachmentIdFromUrl(href);
      const index = attachmentIds.indexOf(attachmentId);
      if (index >= 0) {
        e.preventDefault();
        lightbox.openAt(index);
      }
    });

    // Handle browser back/forward buttons
    window.addEventListener("popstate", (event) => {
      const hasAttachmentParam = hasQueryParam("glightbox");
      const attachmentId = getQueryParam("glightbox");
      isHistoryNavigation = true;

      if (hasAttachmentParam && attachmentId !== null) {
        // Find the index of the attachment ID
        const index = attachmentIds.indexOf(attachmentId);
        if (index >= 0) {
          if (!isLightboxOpen) {
            lightbox.openAt(index);
          } else {
            lightbox.goToSlide(index);
          }
        } else {
          updateUrl(null);
        }
        // If attachment ID not found, do nothing (don't open)
      } else {
        // Close lightbox if query param is removed
        if (isLightboxOpen) {
          isClosingFromPopstate = true;
          lightbox.close();
        } else if (hasAttachmentParam) {
          updateUrl(null);
        }
      }
    });

    // Check URL parameter on page load
    const hasInitialAttachmentParam = hasQueryParam("glightbox");
    const initialAttachmentId = getQueryParam("glightbox");
    if (hasInitialAttachmentParam && initialAttachmentId !== null) {
      // Find the index of the attachment ID
      const index = attachmentIds.indexOf(initialAttachmentId);
      if (index >= 0) {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          lightbox.openAt(index);
        }, 100);
      } else {
        updateUrl(null);
      }
      // If attachment ID not found, do nothing (don't open)
    } else if (hasInitialAttachmentParam) {
      updateUrl(null);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGLightbox);
  } else {
    initGLightbox();
  }

  // Public API for external regeneration
  window.redmineGLightbox.regenerate = async function () {
    /**
     * Regenerate glightbox items
     *
     * @returns {Promise<void>}
     *
     * Usage:
     * - window.redmineGLightbox.regenerate();
     */
    // Cleanup existing lightbox
    cleanupGLightbox();

    // Reinitialize
    await initGLightbox();
  };

  // Public API to get current lightbox instance
  window.redmineGLightbox.getLightbox = function () {
    /**
     * Get the current lightbox instance
     *
     * @returns {object|null} Current GLightbox instance or null
     *
     * Usage:
     * - const lb = window.redmineGLightbox.getLightbox();
     * - lb.openAt(0); // Open first item
     */
    return currentLightbox;
  };

  document.addEventListener("DOMContentLoaded", () => {
    // Compatible with Redmine Lazy Load History plugin
    document.querySelectorAll(".lazy-load-history").forEach((container) => {
      container.addEventListener("lazyLoadHistory:loaded", (event) => {
        window.redmineGLightbox.regenerate();
      });
    });
  });
})();
