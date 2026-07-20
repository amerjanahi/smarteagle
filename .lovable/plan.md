## Scope
Three security hardening tasks. No feature/behavior changes to end-user flows.

## 1. `.gitignore` — env & secret files
Append env/secret patterns to the existing root `.gitignore` (currently missing any `.env*` rule; `.env` is present in the repo). Retain `.env.example`.

Add:
```
# Env & secrets
.env
.env.*
!.env.example
*.pem
*.key
*.p12
*.pfx
secrets.json
```

Note (chat only, not code): `.env` is already tracked and contains only publishable Supabase keys — safe, but I'll flag that untracking it requires a git command the user must run manually (`git rm --cached .env`), since I can't run stateful git.

## 2. Sanitize notice HTML with DOMPurify
Install `dompurify` + `@types/dompurify`.

- `src/lib/sanitize-html.ts` (new): thin wrapper exporting `sanitizeHtml(dirty)` with an allow-list config (standard formatting tags, `a`, `img`, `ul/ol/li`, `p`, `span`, `strong/em/u`, `br`, `h1-h6`), allowed attrs (`href`, `src`, `alt`, `style` limited, `target`, `rel`, `data-path`), forces `target=_blank` + `rel=noopener noreferrer` on links, blocks `javascript:` URLs.
- `src/components/admin/RichTextEditor.tsx`: sanitize on every `onChange` before calling the parent callback, and on the initial `innerHTML` write from `value`. Image insertion already builds a controlled `<img>`; still routed through the same sanitizer after `execCommand`.
- `src/routes/_authenticated/admin/notices.tsx`: wrap all three `dangerouslySetInnerHTML={{ __html: ... }}` sites (list preview, editor live preview, published preview) with `sanitizeHtml(...)`.

## 3. Remove automatic first-user admin promotion
Two places currently do this — both need to go:

- **DB trigger** `public.handle_new_user()`: strip the "if no admin exists, insert admin role" block. Keep the profile upsert. Migration will `CREATE OR REPLACE FUNCTION` with the cleaned body (same signature, security definer, search_path).
- **Server fn** `bootstrapAdminIfEmpty` in `src/lib/admin.functions.ts`: remove the function entirely, plus any import/call sites (grep confirms it's only defined here; will re-verify call sites during build and delete them).

Chat message will tell the user how to manually seed the first admin via SQL:
```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('<auth-user-uuid>', 'admin');
```

## Technical notes
- DOMPurify runs client-side; SSR passes strings through untouched (editor is client-only). The sanitizer module uses `isomorphic-dompurify` OR guards `typeof window` — will use `isomorphic-dompurify` for a single import path that works in both environments (safer if any render ever moves to SSR).
- Migration is schema-only (function replace), no table/policy changes.
- No UI changes visible to users.

## Files touched
- `.gitignore` (edit)
- `package.json` (add `isomorphic-dompurify`)
- `src/lib/sanitize-html.ts` (new)
- `src/components/admin/RichTextEditor.tsx` (edit)
- `src/routes/_authenticated/admin/notices.tsx` (edit)
- `src/lib/admin.functions.ts` (remove `bootstrapAdminIfEmpty`; grep for callers)
- Migration: replace `handle_new_user()` without admin auto-promotion
