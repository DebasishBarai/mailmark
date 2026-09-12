"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

function CategoryPill({ category }: { category: "beta" | "normal" | "admin" }) {
  const tone =
    category === "admin"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
      : category === "beta"
        ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
        : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      {category}
    </span>
  );
}

/**
 * The admin user directory: find an account, then open its dashboard exactly
 * as that user sees it.
 *
 * With no search term this is the 50 newest accounts, which is the list an
 * admin answering a fresh support mail usually wants. Typing searches by email
 * address through the users search index, so an older account is one query
 * away rather than a scan of everything created since.
 */
export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const term = search.trim();
  const users = useQuery(api.users.listAllForAdmin, { search: term });

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6">
        <Link
          href="/admin"
          className="text-sm font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
        >
          &larr; Admin
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">Users</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Open any account&apos;s dashboard as that user sees it. The view is read only
          and nothing about their account changes when you open it.
        </p>
      </div>

      <div className="mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email address"
          className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
        />
        <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
          {term.length === 0
            ? "Showing the 50 newest accounts. Type an address to search all of them."
            : "Showing up to 25 matches."}
        </p>
      </div>

      {users === undefined ? (
        <div className="flex min-h-[12rem] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
        </div>
      ) : users.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          {term.length === 0 ? "No users yet." : `No account matches "${term}".`}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Category</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Audience</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Joined</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Dashboard</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-gray-100 last:border-0 dark:border-gray-700/50">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{user.email}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{user.name ?? "-"}</td>
                  <td className="px-4 py-3">
                    <CategoryPill category={user.category} />
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">
                    {user.recipientCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">
                    {new Date(user.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
