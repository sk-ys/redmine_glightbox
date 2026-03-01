# Redmine GLightbox Plugin

A lightweight image gallery plugin for Redmine that integrates the [GLightbox](https://github.com/biati-digital/glightbox) JavaScript library to display images attached to issues.

## Features

- Display images with GLightbox on the issue page (jpg, png, gif, bmp, webp, svg)
- Display video attachments with HTML5 controls (mp4, webm, ogg, mov, avi, flv, mkv)
- Display PDF attachments in an inline viewer
- **Zoomable images** - Click to zoom, scroll wheel, pinch to zoom
- **Thumbnail panel** with auto-scroll for easy navigation
- **Thumbnail toggle** - Show/hide thumbnail panel with a toggle button
- **Responsive** - Adapts to screen size
- **Keyboard navigation** - Arrow keys to navigate, Escape to close
- **Touch gestures** - Swipe to navigate on touch devices
- **URL query support** - Share direct links to specific images with `?glightbox=attachmentId`
- **Browser history navigation** - Back/forward buttons work seamlessly with the gallery
- **Lightweight** - Fast and optimized performance

## Installation

1. Clone the plugin into your Redmine plugins directory:

```bash
cd plugins
git clone https://github.com/sk-ys/redmine_glightbox.git
```

2. Restart Redmine

## Usage

Click an image, video, or PDF file on an issue page and GLightbox opens automatically.
Links to image, video, and PDF files are also supported.

Use the thumbnail panel at the bottom to navigate between attachments.

### Public API

For advanced usage, the plugin exposes a public API through `window.redmineGLightbox`:

#### `regenerate()`
Regenerate the GLightbox gallery after dynamic content changes (e.g., AJAX updates that add new attachments).

```javascript
// Regenerate the gallery
window.redmineGLightbox.regenerate();
```

#### `getLightbox()`
Get the current GLightbox instance for direct manipulation.

```javascript
// Get the lightbox instance
const lightbox = window.redmineGLightbox.getLightbox();

// Open at specific index
if (lightbox) {
  lightbox.openAt(0);
}
```

**Example use case:** If you dynamically add attachments to the page via JavaScript, call `regenerate()` to update the gallery:

```javascript
// After adding new attachments to the DOM
await addNewAttachmentsToDom();
window.redmineGLightbox.regenerate();
```

## Requirements

- Redmine 6.1 (Other versions are untested.)
- GLightbox library (bundled in assets/)

## License

This plugin is licensed under GPLv3. See LICENSE file for details.

GLightbox is licensed under the MIT License: https://github.com/biati-digital/glightbox/blob/master/LICENSE

## Support

For issues and feature requests, visit the [GitHub repository](https://github.com/sk-ys/redmine_glightbox).
