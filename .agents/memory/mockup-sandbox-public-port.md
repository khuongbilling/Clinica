---
name: Mockup sandbox public port
description: Canvas iframe URLs for the mockup sandbox must use the external port mapping, not the local vite port.
---

The mockup sandbox vite server listens locally on 23636, but `.replit` maps it to **external port 3001**. Canvas iframes load the public URL in the user's browser, so they must use `https://$REPLIT_DOMAINS:3001/__mockup/preview/{group}/{Component}`.

**Why:** Frames set live with `:23636` render fine in local screenshots/curl but never load for the user (curl to public `:23636` returns 000).

**How to apply:** Before flipping any mockup iframe to `live`, check `[[ports]]` in `.replit` for the localPort→externalPort mapping and build the URL from the external port.
