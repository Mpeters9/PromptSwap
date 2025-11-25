export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-gray-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p className="text-center sm:text-left">© {new Date().getFullYear()} PromptSwap</p>
        <div className="flex flex-wrap justify-center gap-4 text-sm sm:justify-end">
          <a className="transition hover:text-indigo-600" href="/about">
            About
          </a>
          <a className="transition hover:text-indigo-600" href="/contact">
            Contact
          </a>
          <a className="transition hover:text-indigo-600" href="/terms">
            Terms
          </a>
        </div>
      </div>
    </footer>
  );
}
