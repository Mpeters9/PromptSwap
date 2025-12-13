import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-4 py-16 sm:py-20">
        <section className="rounded-3xl border border-border/60 bg-card p-10 shadow-2xl">
          <h1 className="text-4xl font-bold leading-tight text-foreground sm:text-5xl">
            About PromptSwap
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            PromptSwap is a platform designed for creators and users to buy, sell, and swap AI prompts. It connects people who need effective prompts with those who create them, fostering a community around AI workflows.
          </p>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-foreground">What We Do</h2>
          <p className="mt-4 text-muted-foreground">
            PromptSwap enables instant access to high-quality AI prompts. Creators can upload their prompts for sale or swap, while buyers get one-time purchases with immediate downloads. The platform includes moderation to ensure quality and a rating system for feedback.
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <article className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-background/40 p-4">
              <h3 className="text-lg font-semibold text-foreground">Marketplace</h3>
              <p className="text-sm text-muted-foreground">
                Browse and purchase prompts from verified creators. Everything is one-time pricing with instant access.
              </p>
            </article>
            <article className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-background/40 p-4">
              <h3 className="text-lg font-semibold text-foreground">Swapping</h3>
              <p className="text-sm text-muted-foreground">
                Exchange prompts with other users to build your collection without spending money.
              </p>
            </article>
            <article className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-background/40 p-4">
              <h3 className="text-lg font-semibold text-foreground">Moderation</h3>
              <p className="text-sm text-muted-foreground">
                Admins review prompts to maintain quality and safety across the platform.
              </p>
            </article>
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-foreground">How It Works</h2>
          <p className="mt-4 text-muted-foreground">
            Creators upload prompts, set prices, and connect Stripe for payouts. Buyers purchase instantly and download. Swaps happen peer-to-peer. The platform uses modern web technologies for a smooth experience.
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <article className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-background/40 p-4">
              <h3 className="text-lg font-semibold text-foreground">For Creators</h3>
              <p className="text-sm text-muted-foreground">
                Upload prompts, manage earnings, and track analytics. Get paid directly via Stripe.
              </p>
            </article>
            <article className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-background/40 p-4">
              <h3 className="text-lg font-semibold text-foreground">For Buyers</h3>
              <p className="text-sm text-muted-foreground">
                Search, purchase, or swap prompts. Rate and comment to help the community.
              </p>
            </article>
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-foreground">What Needs to Be Done Next</h2>
          <p className="mt-4 text-muted-foreground">
            To keep PromptSwap growing, here are the key next steps:
          </p>
          <ul className="mt-6 space-y-4 text-muted-foreground">
            <li className="flex items-start gap-3">
              <span className="text-primary">•</span>
              <span>Complete full setup and testing of Supabase database and Stripe integrations to ensure smooth transactions.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-primary">•</span>
              <span>Deploy the app to Vercel or another hosting platform for public access.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-primary">•</span>
              <span>Add more features like advanced search filters, prompt categories, and user notifications.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-primary">•</span>
              <span>Implement community features such as forums or direct messaging for better user engagement.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-primary">•</span>
              <span>Monitor performance and user feedback to iterate on design and functionality.</span>
            </li>
          </ul>
        </section>

        <section className="text-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background shadow-lg transition hover:opacity-90"
          >
            Back to Home
          </Link>
        </section>
      </div>
    </main>
  );
}
