# Account UI contract

Account routes retain their existing data behavior. Account selection adds
separate browser sessions for people who sign in to several Yavqo identities
on one device.

| Capability | Owner | Contract |
| --- | --- | --- |
| Desktop navigation | AccountNav | Real route links, aria-current for selected page; edit YavqoID selects its parent |
| Mobile navigation | MobileNav | Native details/summary, document flow, shared destinations; no modal or scroll lock |
| Layout and theme | AccountShell, globals.css | Shared white account theme, natural page scrolling, narrow-screen reflow |
| Scrollbar | globals.css | Visible global baseline with forced-colors fallback |
| Forms and feedback | Existing editor components | Preserve field semantics, values, handlers, pending and error states |
| Sign out | SignOutButton | Confirm in a dialog before signing out. Log out ends only the active account slot and forgets its chooser label. Log out of all accounts ends every saved session on this device and clears the chooser. Either path then shows the account chooser. Cancel, Escape, and the dimmed backdrop leave the session unchanged. |
| Multiple accounts | account-slots, account API, AccountChooser | Each slot has separate Supabase auth cookies. A switch validates the target session first. Adding an account creates a new slot and opens sign-in. Remembered identity labels contain a masked email only; passwords and tokens are never stored in localStorage. |

An account switch verifies the selected session with Supabase before changing
the active slot. Expired sessions show an inline error and can be added again.
The chooser preserves an internal OAuth return path through login and switching.
Existing native date/select controls remain platform-owned.
