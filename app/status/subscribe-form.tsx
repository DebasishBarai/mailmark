"use client";

export default function SubscribeForm() {
  return (
    <form className="mt-5 flex gap-3" onSubmit={(e) => e.preventDefault()}>
      <input
        type="email"
        placeholder="you@example.com"
        className="flex-1 rounded-full border border-gray-200 px-5 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-violet-500 dark:focus:ring-violet-900/30"
      />
      <button
        type="submit"
        className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
      >
        Subscribe
      </button>
    </form>
  );
}
