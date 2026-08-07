---
name: api-server port config
description: Root-cause for API server EADDRINUSE 0.0.0.0:8080 conflict in this monorepo's dev sandbox
---

The `api-server` artifact's `artifact.toml` was misconfigured with `localPort = 8080`, the same port as the root `eitashot` web artifact. In this workspace, all artifact dev processes share one Linux container/network namespace, so two services requesting the literal same `localPort` genuinely collide (`EADDRINUSE`) — it is not just a preview-routing label, it's the actual bind port passed via `PORT` env at spawn time.

**Why:** `.replit` reserves three ports (8080→80, 8081→8081, 19561→3000). The root `/` artifact should take 8080; any other backend/API artifact sharing the same dev container must use one of the other reserved ports (e.g. 8081), never re-declare 8080.

**How to apply:** If a workflow fails to start with `EADDRINUSE: address already in use 0.0.0.0:<port>`, check whether another registered artifact's `.replit-artifact/artifact.toml` declares the same `localPort`. Fix by editing the conflicting artifact's `artifact.toml` (via `verifyAndReplaceArtifactToml`, not directly) to use a different reserved port from `.replit`'s `[[ports]]` list, updating both `[[services]] localPort` and any `[services.production.run.env] PORT` value, then restart the workflow.
