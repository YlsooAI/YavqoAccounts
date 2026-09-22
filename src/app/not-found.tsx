import Link from "next/link";

export default function NotFound() {
  return (
    <main className="public-page">
      <header className="public-header"><Link href="/" className="public-brand" aria-label="Yavqo Accounts home">Yavqo <span>Accounts</span></Link></header>
      <section className="public-not-found" aria-labelledby="missing-title">
        <p className="public-overline">404 · Page not found</p>
        <h1 id="missing-title">This page isn’t available</h1>
        <p>The link may be broken, or the page may have moved. You can return to your account and continue from there.</p>
        <Link href="/" className="public-primary public-return">Go to your account</Link>
      </section>
      <footer className="public-footer"><span>Yavqo Accounts</span><nav aria-label="Legal"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav></footer>
    </main>
  );
}
