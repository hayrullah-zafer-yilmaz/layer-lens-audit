# Security policy

## Supported versions

Security fixes are released for the latest minor version.

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |

## Reporting a vulnerability

Please don't report security issues in public issues or pull requests. Report them privately on GitHub instead: open the [Security tab](https://github.com/hayrullah-zafer-yilmaz/layer-lens-audit/security) and choose **Report a vulnerability**, or use [this form](https://github.com/hayrullah-zafer-yilmaz/layer-lens-audit/security/advisories/new) directly.

Please include:

- the affected version,
- the steps or a small page that reproduces the issue,
- what an attacker could do with it.

You can expect a first reply within a week. Once a fix is released, the advisory is published with credit to you, unless you prefer otherwise.

## Scope

layer-lens-audit runs in the browser and has no runtime dependencies. It makes no network requests; the bookmarklet loads the package itself from unpkg. It reads the page's DOM and style sheets, changes inline styles only for a moment and puts them back, shows page content such as class names and ids with `textContent`, and writes to the clipboard only when you press the copy button. Reports are especially welcome for:

- page content, such as class names, ids or attribute values shown in the panel, that ends up running script,
- an audit or a 3D view that leaves the page changed,
- anything that makes a page's Content Security Policy weaker.

Advisories in development tools such as Vite, Vitest, Playwright or tsup don't reach the published package. They're handled through regular dependency updates.
