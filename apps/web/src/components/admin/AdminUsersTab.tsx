"use client";

/**
 * Admin users list
 * ----------------
 * Search, role filter, pagination — assign customer | reception | admin.
 */

import { useMemo, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";

const PAGE_SIZE = 12;

export type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at?: string;
};

type Props = {
  users: AdminUser[];
  onRoleChange?: (userId: string, role: string, confirmPassword?: string) => Promise<void>;
};

function dedupeUsers(users: AdminUser[]) {
  const map = new Map<string, AdminUser>();
  for (const u of users) {
    if (!u?.id || map.has(u.id)) continue;
    map.set(u.id, u);
  }
  return Array.from(map.values());
}

function formatDate(raw?: string) {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function roleBadgeClass(role: string) {
  if (role === "admin") return "bg-black text-white";
  if (role === "reception") return "bg-emerald-800 text-white";
  return "bg-neutral-100 text-soul-muted";
}

export function AdminUsersTab({ users, onRoleChange }: Props) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pendingAdmin, setPendingAdmin] = useState<{ id: string; name: string } | null>(null);
  const [confirmPassword, setConfirmPassword] = useState("");

  const filtered = useMemo(() => {
    const list = dedupeUsers(users);
    const needle = q.trim().toLowerCase();
    return list.filter((u) => {
      if (role && u.role !== role) return false;
      if (!needle) return true;
      const hay = `${u.full_name || ""} ${u.email || ""} ${u.role || ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [users, q, role]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const counts = useMemo(() => {
    const list = dedupeUsers(users);
    return {
      all: list.length,
      customer: list.filter((u) => u.role === "customer").length,
      reception: list.filter((u) => u.role === "reception").length,
      admin: list.filter((u) => u.role === "admin").length,
    };
  }, [users]);

  const changeRole = async (userId: string, next: string, password?: string) => {
    if (!onRoleChange) return;
    setError("");
    setBusyId(userId);
    try {
      await onRoleChange(userId, next, password);
      setPendingAdmin(null);
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setBusyId(null);
    }
  };

  const requestRoleChange = (userId: string, next: string, displayName: string) => {
    if (next === "admin") {
      setPendingAdmin({ id: userId, name: displayName });
      setConfirmPassword("");
      setError("");
      return;
    }
    void changeRole(userId, next);
  };

  const field =
    "w-full px-3 py-2.5 rounded-xl border border-black/10 text-sm min-h-[44px] bg-white/70";

  return (
    <div className="space-y-4">
      <h2 className="text-base sm:text-lg font-black tracking-tight">
        Users
        <span className="text-soul-muted font-semibold text-sm ml-2">{filtered.length}</span>
      </h2>
      <p className="text-sm text-soul-muted">
        Set <span className="font-semibold text-black">reception</span> for floor staff (POS /
        inventory / ICONIC / orders only — no profit or user admin).
      </p>

      <GlassCard className="p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search name or email…"
            className={`${field} flex-1`}
            autoComplete="off"
          />
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
            className={`${field} sm:w-44`}
            aria-label="Role filter"
          >
            <option value="">All roles ({counts.all})</option>
            <option value="customer">Customer ({counts.customer})</option>
            <option value="reception">Reception ({counts.reception})</option>
            <option value="admin">Admin ({counts.admin})</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: "", label: "All", count: counts.all },
              { id: "customer", label: "Customer", count: counts.customer },
              { id: "reception", label: "Reception", count: counts.reception },
              { id: "admin", label: "Admin", count: counts.admin },
            ] as const
          ).map((r) => (
            <button
              key={r.id || "all"}
              type="button"
              onClick={() => {
                setRole(r.id);
                setPage(1);
              }}
              className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
                role === r.id
                  ? "bg-black text-white border-black"
                  : "border-black/10 text-soul-muted"
              }`}
            >
              {r.label} ({r.count})
            </button>
          ))}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <p className="text-[11px] text-soul-muted">
          Showing {pageItems.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–
          {(safePage - 1) * PAGE_SIZE + pageItems.length} · page {safePage}/{totalPages}
        </p>
      </GlassCard>

      {pendingAdmin && (
        <GlassCard className="p-4 sm:p-5 space-y-3 border border-amber-200/80 bg-amber-50/50">
          <p className="text-sm font-semibold">
            Promote <span className="font-black">{pendingAdmin.name}</span> to admin?
          </p>
          <p className="text-xs text-soul-muted">
            Enter your owner password to confirm. Their other sessions will be signed out.
          </p>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Your password"
            autoComplete="current-password"
            className={field}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!confirmPassword || busyId === pendingAdmin.id}
              onClick={() => void changeRole(pendingAdmin.id, "admin", confirmPassword)}
              className="btn-soul--dark rounded-full px-5 min-h-[44px] text-[10px] disabled:opacity-50"
            >
              Confirm promote
            </button>
            <button
              type="button"
              onClick={() => {
                setPendingAdmin(null);
                setConfirmPassword("");
              }}
              className="px-4 py-2 rounded-full text-[10px] font-bold uppercase border border-black/10 min-h-[44px]"
            >
              Cancel
            </button>
          </div>
        </GlassCard>
      )}

      <div className="space-y-2">
        {pageItems.map((u) => (
          <GlassCard
            key={u.id}
            className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">{u.full_name || "—"}</p>
              <p className="text-sm text-soul-muted break-all mt-0.5">{u.email}</p>
              <p className="text-[11px] text-soul-muted mt-1">Joined {formatDate(u.created_at)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full w-fit ${roleBadgeClass(
                  u.role
                )}`}
              >
                {u.role}
              </span>
              {onRoleChange && (
                <select
                  value={u.role}
                  disabled={busyId === u.id}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === u.role) return;
                    requestRoleChange(u.id, next, u.full_name || u.email);
                    // Keep select on current role until API succeeds (parent refreshes list).
                    e.target.value = u.role;
                  }}
                  className="px-2.5 py-2 rounded-xl border border-black/10 text-xs font-semibold bg-white min-h-[40px]"
                  aria-label={`Change role for ${u.full_name || u.email}`}
                >
                  <option value="customer">Customer</option>
                  <option value="reception">Reception (floor)</option>
                  <option value="admin">Admin (owner)</option>
                </select>
              )}
            </div>
          </GlassCard>
        ))}

        {pageItems.length === 0 && (
          <GlassCard className="p-8 text-center text-sm text-soul-muted">
            {q || role ? "No users match these filters." : "No users yet."}
          </GlassCard>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-4 py-2 rounded-full text-xs font-bold uppercase border border-black/10 disabled:opacity-40 min-h-[40px]"
          >
            Prev
          </button>
          <span className="text-xs text-soul-muted tabular-nums px-2">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-4 py-2 rounded-full text-xs font-bold uppercase border border-black/10 disabled:opacity-40 min-h-[40px]"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
