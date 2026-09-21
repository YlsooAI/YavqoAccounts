"use client";

import { useFormStatus } from "react-dom";

export function AuthorizeButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="oauth-primary" disabled={pending}>
      {pending ? (
        <>
          <span className="oauth-spinner oauth-spinner-light" aria-hidden="true" />
          Authorizing…
        </>
      ) : (
        "Authorize"
      )}
    </button>
  );
}

export function CancelButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="oauth-secondary" disabled={pending}>
      {pending ? (
        <>
          <span className="oauth-spinner oauth-spinner-dark" aria-hidden="true" />
          Cancelling…
        </>
      ) : (
        "Cancel"
      )}
    </button>
  );
}
