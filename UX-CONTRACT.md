# Account UI contract

This change is visual. Existing route components and server APIs remain
the implementation evidence for account, authentication, billing, and
privacy operations; it introduces no new business rules.

| Capability | Owner | Contract |
| --- | --- | --- |
| Desktop navigation | AccountNav | Real route links, aria-current for selected page; edit YavqoID selects its parent |
| Mobile navigation | MobileNav | Native details/summary, document flow, shared destinations; no modal or scroll lock |
| Layout and theme | AccountShell, globals.css | Shared white account theme, natural page scrolling, narrow-screen reflow |
| Scrollbar | globals.css | Visible global baseline with forced-colors fallback |
| Forms and feedback | Existing editor components | Preserve field semantics, values, handlers, pending and error states |
| Sign out | SignOutButton | Existing Supabase sign-out action and login destination |

No API, authorization, payment, or destructive-action changes are part of
the redesign. Existing native date/select controls remain platform-owned.
Functional, browser, and automated testing is deferred to the user by request.
