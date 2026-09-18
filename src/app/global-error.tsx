"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body
        style={{
          margin: 0,
          minHeight: "100%",
          background: "#202124",
          color: "#e8eaed",
          fontFamily:
            'Roboto, -apple-system, BlinkMacSystemFont, "SF Pro Text", Helvetica, Arial, sans-serif',
        }}
      >
        <main
          style={{
            display: "flex",
            minHeight: "100vh",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              borderRadius: 16,
              background: "#292a2d",
              padding: 32,
              textAlign: "center",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 13,
                letterSpacing: "0.18em",
                color: "#8ab4f8",
                fontWeight: 500,
              }}
            >
              ERROR
            </p>
            <h1 style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 400 }}>
              Something went wrong
            </h1>
            <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.5, color: "#9aa0a6" }}>
              {error.digest
                ? `Yavqo Account hit an unexpected error. Reference ${error.digest}.`
                : "Yavqo Account hit an unexpected error."}
            </p>
            <div style={{ marginTop: 28, display: "flex", justifyContent: "center", gap: 12 }}>
              <button
                type="button"
                onClick={() => reset()}
                style={{
                  height: 40,
                  border: 0,
                  borderRadius: 999,
                  background: "#8ab4f8",
                  color: "#202124",
                  padding: "0 20px",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
              <a
                href="/"
                style={{
                  display: "inline-flex",
                  height: 40,
                  alignItems: "center",
                  borderRadius: 999,
                  border: "1px solid #5f6368",
                  color: "#e8eaed",
                  padding: "0 20px",
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                Go home
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
