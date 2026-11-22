"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@/components/AuthProvider";
import api from "@/lib/api";
import { Notification } from "@/lib/types";

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    if (!user) return;
    api
      .get("/api/notifications")
      .then((res) => {
        setNotifications(res.data);
      })
      .catch(() => {});
  }, [user]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // Optimistic update: flip locally first, roll back if the request fails.
  const markAsRead = async (id: Notification["id"]) => {
    const target = notifications.find((n) => n.id === id);
    if (!target || target.is_read) return;

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    try {
      await api.patch(`/api/notifications/${id}/read`);
    } catch {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: false } : n)),
      );
      toast.error("Failed to mark notification as read");
    }
  };

  const markAllAsRead = async () => {
    const previouslyUnread = notifications
      .filter((n) => !n.is_read)
      .map((n) => n.id);
    if (previouslyUnread.length === 0) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await api.patch("/api/notifications/read-all");
    } catch {
      setNotifications((prev) =>
        prev.map((n) =>
          previouslyUnread.includes(n.id) ? { ...n, is_read: false } : n,
        ),
      );
      toast.error("Failed to mark all as read");
    }
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-white/60 bg-white/70 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 shadow-[0_1px_0_0_rgba(99,102,241,0.08),0_8px_24px_-12px_rgba(79,70,229,0.18)]">
      {/* accent line */}
      <div className="h-0.5 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/dashboard" className="group flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30 transition-transform duration-200 group-hover:scale-105 group-hover:rotate-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </span>
            <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-indigo-700 to-violet-600 bg-clip-text text-transparent">
              Incident<span className="font-black">IQ</span>
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* User chip */}
            {user && (
              <div className="hidden sm:flex items-center gap-2.5 rounded-full border border-gray-200/80 bg-white/80 py-1 pl-1 pr-3 shadow-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-sm font-semibold uppercase text-white ring-2 ring-white">
                  {user.username?.charAt(0)}
                </span>
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold text-gray-800">
                    {user.username}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-indigo-500">
                    {user.role}
                  </span>
                </div>
              </div>
            )}

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifs(!showNotifs)}
                aria-label="Notifications"
                className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 ${
                  showNotifs
                    ? "bg-indigo-100 text-indigo-700"
                    : "text-gray-500 hover:bg-indigo-50 hover:text-indigo-600"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
                    <span className="relative inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  </span>
                )}
              </button>

              {showNotifs && (
                <div className="absolute right-0 mt-3 w-80 origin-top-right overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-2xl shadow-indigo-900/10 ring-1 ring-black/5">
                  <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-800">
                        Notifications
                      </h3>
                      {unreadCount > 0 && (
                        <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 px-4 py-10 text-gray-400">
                        <span className="text-3xl">🔔</span>
                        <p className="text-sm">You're all caught up</p>
                      </div>
                    ) : (
                      notifications.slice(0, 10).map((n) => (
                        <div
                          key={n.id}
                          onClick={() => markAsRead(n.id)}
                          title={
                            n.is_read ? undefined : "Click to mark as read"
                          }
                          className={`relative flex gap-3 border-b border-gray-50 px-4 py-3 text-sm transition-colors hover:bg-gray-50 ${
                            n.is_read
                              ? "text-gray-500"
                              : "cursor-pointer bg-indigo-50/40 text-gray-800"
                          }`}
                        >
                          <span
                            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                              n.is_read ? "bg-gray-300" : "bg-indigo-500"
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className={n.is_read ? "" : "font-medium"}>
                              {n.message}
                            </p>
                            <p className="mt-1 text-xs text-gray-400">
                              {new Date(n.created_at).toLocaleString()}
                            </p>
                          </div>
                          {!n.is_read && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(n.id);
                              }}
                              aria-label="Mark as read"
                              className="shrink-0 self-start rounded-full px-2 py-0.5 text-[11px] font-medium text-indigo-600 hover:bg-indigo-100"
                            >
                              ✓ Read
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <span className="hidden sm:block h-6 w-px bg-gray-200" />

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="group flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium text-gray-600 transition-all duration-200 hover:bg-red-50 hover:text-red-600"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
