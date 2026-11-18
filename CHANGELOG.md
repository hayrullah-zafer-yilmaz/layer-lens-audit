# Changelog

## 0.1.0 (2026-11-18)

First version, published as `layer-lens-audit`.

- `audit()`: finds wrappers that draw nothing and change nothing, empty elements, and DOM that is too big, too deep or too wide. Each candidate is measured with and without its box, and the page is put back exactly as it was.
- Keeps anything with a style, an effect, a job or a state it isn't in right now: inherited styles, `:hover` and dark mode rules, responsive and container query rules, size limits, positional selectors, roles, aria, framework event handlers and refs.
- Points at the component, and in Vue and Svelte the file, that rendered each finding.
- `inspect()`: a panel that lists the findings, outlines them on the page, opens them in 3D and copies the report as JSON.
- `installInspector()`: opens the inspector with a keyboard shortcut, Alt+Shift+L by default.
- A bookmarklet and a script tag build for any page, without installing.
- `createLayerLensAudit()`: the exploded 3D view on its own, with `marks` for elements to show in red.
- English and Turkish: the panel, the findings and the summary follow the browser's language, or the `locale` option.
- `npx layer-lens-audit <url>`: audits a page in headless Chrome at several screen sizes and reports only what can go at all of them, as text, Markdown or JSON, with `--max` and a baseline for CI.
- `layer-lens-audit/vite`: a Vite plugin that adds the inspector to the dev server.
- `data-layer-lens-audit="keep"` and `data-layer-lens-audit="ignore"` to mark elements in the markup.
- `root` takes a selector; reports have `toMarkdown()`, and the panel copies Markdown or JSON.
- Zoom in the 3D view: Ctrl + scroll or a pinch, the + and − keys, Shift + drag to move, zoom controls in the panel, and `zoom`, `setZoom()`, `resetView()` and `onZoomChange` in the API.
- Every finding says why it was reported (`detail`) and what to do about it (`fix`), with advice for React, Vue, Svelte and Angular when the framework is known. Clicking a finding in the panel shows both, and for wrappers the markup before and after. Markdown and terminal reports end with the advice for each kind of finding.
- Fast on large pages: every element is screened before any is measured, elements of the same kind are measured together while they keep passing, boxes read before a failed attempt are reused, and selectors are found without searching the whole page for each element. A page of 16,000 elements takes about 2 seconds.
- Style sheets are read in one pass per selector, and the audit no longer waits on timers between slices.
- The 3D view opened from the panel stays under 2,000 elements, so long lists still turn smoothly.
