// Redmine GLightbox Integration
// Automatically enhances images in Redmine issues with GLightbox

(function () {
  "use strict";

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

  function parseAttachmentIdFromUrl(url) {
    const match = url.match(/\/attachments\/(?:download\/)?(\d+)(?:\/|$)/);
    return match ? match[1] : null;
  }

  // Parse URL query parameters
  function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
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

  // Wait for DOM to be ready
  function initGLightbox() {
    if (typeof GLightbox === "undefined") {
      console.warn("GLightbox library not loaded");
      return;
    }

    // Detect attachment links in the issue details attachment section
    // and filter for image/video/pdf files
    const attachmentLinks = Array.from(
      document.querySelectorAll(
        '.issue.details .attachments a[href*="/attachments/download/"]',
      ),
    ).filter((link) => {
      const hrefLower = link.href.toLowerCase();
      return hrefLower.match(
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

    if (attachmentLinks.length === 0) {
      return;
    }

    const attachmentIds = Array.from(attachmentLinks).map((link) =>
      parseAttachmentIdFromUrl(link.href),
    );

    const glightboxContent = attachmentLinks.map((link) => {
      const href = link.href;
      const attachmentId = parseAttachmentIdFromUrl(href);
      const isVideo = new RegExp(
        "\\.(" + videoExtensions.join("|") + ")(\\?|$)",
        "i",
      ).test(href.toLowerCase());
      const isPdf = /\.pdf(\\?|$)/i.test(href.toLowerCase());
      const caption = link.textContent; // Filename
      const thumbnailImgEl = document.querySelector(
        `img[src*='/attachments/thumbnail/${attachmentId}']`,
      );

      if (isVideo) {
        const videoType = href
          .toLowerCase()
          .match(
            new RegExp("\\.(" + videoExtensions.join("|") + ")(\\?|$)", "i"),
          )[1]
          .toLowerCase();
        const mimeType = mimeTypeMap[videoType] || "video/mp4";
        const videoIconThumbnail = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23333' width='100' height='100'/%3E%3Cpolygon fill='%23fff' points='41.25,31.25 41.25,68.75 68.75,50'/%3E%3C/svg%3E`;
        const videoHtml = `<video class="glightbox-video-native" controls preload="metadata"><source src="${href}" type="${mimeType}"></video>`;

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
        const iframeHtml = `<iframe class="glightbox-pdf-iframe" src="${href}" style="width: 100%; height: 100%;" loading="lazy"></iframe>`;
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
        href: href,
        type: "image",
        title: caption,
        thumb: thumbnailImgEl?.src || href,
        alt: caption,
      };
    });

    // Create thumbnail panel HTML
    const thumbPanel = createThumbnailPanel(glightboxContent);

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
      button.setAttribute("title", "Toggle thumbnails");
      button.setAttribute("aria-label", "Toggle thumbnails");
      // SVG for hide icon
      button.innerHTML =
        '<svg class="toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="0" y="2" width="24" height="20"/><rect x="2" y="16" width="5" height="5"/><rect x="9.5" y="16" width="5" height="5"/><rect x="17" y="16" width="5" height="5"/></svg>';
      return button;
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
        const closeBtn = container.querySelector(".gclose");
        if (closeBtn && !closeBtn.querySelector(".glightbox-toggle-thumbs")) {
          closeBtn.parentElement.insertBefore(toggleButton, closeBtn);
        }

        const index = lightbox.getActiveSlideIndex();
        updateActiveThumbnail(index);

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

        // Update URL when slide changes with attachment ID (without creating new history entry)
        updateUrl(attachmentIds[current.index]);
      },
      afterSlideLoad: (payload) => {
        ensureImageLoaded(payload);
        renderFilename(payload);
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

    // Attach click handlers to target elements
    const targetElements = Array.from(
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
      .forEach((el) => {
        el.addEventListener("click", function (event) {
          event.preventDefault();
          const href = el.href || el.src;
          const position = attachmentIds.indexOf(
            parseAttachmentIdFromUrl(href),
          );

          if (position >= 0) {
            lightbox.openAt(position);
          }
        });
        if (el.tagName.toLowerCase() === "img" && !el.closest("a")) {
          el.style.cursor = "pointer";
        }
      });

    // Handle browser back/forward buttons
    window.addEventListener("popstate", (event) => {
      const attachmentId = getQueryParam("glightbox");
      isHistoryNavigation = true;

      if (attachmentId !== null) {
        // Find the index of the attachment ID
        const index = attachmentIds.indexOf(attachmentId);
        if (index >= 0) {
          if (!isLightboxOpen) {
            lightbox.openAt(index);
          } else {
            lightbox.goToSlide(index);
          }
        }
        // If attachment ID not found, do nothing (don't open)
      } else {
        // Close lightbox if query param is removed
        if (isLightboxOpen) {
          isClosingFromPopstate = true;
          lightbox.close();
        }
      }
    });

    // Check URL parameter on page load
    const initialAttachmentId = getQueryParam("glightbox");
    if (initialAttachmentId !== null) {
      // Find the index of the attachment ID
      const index = attachmentIds.indexOf(initialAttachmentId);
      if (index >= 0) {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          lightbox.openAt(index);
        }, 100);
      }
      // If attachment ID not found, do nothing (don't open)
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGLightbox);
  } else {
    initGLightbox();
  }
})();
