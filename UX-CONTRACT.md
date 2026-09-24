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

YavqoID home groups existing profile, people, app, and security destinations.
The profile editor remains the owner of handle, name, bio, and photo changes.
Deleting a YavqoID requires a modal confirmation naming the handle and leaves
the Yavqo Account and existing TV friends intact.

Notifications reads the latest 100 rows from the signed-in user's
`notifications` table. The user may filter locally, refresh, mark one as read,
or mark the shown unread rows as read. The page does not create notifications.

Preferences saves the three existing `account_preferences` booleans explicitly
through an upsert. No row uses the database defaults in the editor. The page
states that each Yavqo service must consume those choices to affect its own
behavior; saving a choice does not claim that all services already do so.

Saved addresses owns the add/edit/delete flow for the signed-in user's
`addresses` rows. Required fields are validated inline. The address-type
dropdown is native; the operating system owns its popup. The first address is
saved as default. Changing the default clears the prior default before setting
the chosen address and reloads after a failed change. Deletion names the
address in a native modal dialog and requires a second action.
