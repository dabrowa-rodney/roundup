"use client";

import { useEffect, useState, useCallback } from "react";
import { Screen } from "@/components/screen";
import { Avatar, RoleBadge } from "@/components/ui";

const COLS = "grid-cols-[2fr_1.1fr_1.4fr_80px]";

interface TeamUser {
  id: number;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  avatarColor: string | null;
  areas: string[];
}

interface TeamStats {
  contributors: number;
  administrators: number;
  recipientsOnly: number;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[14px] border border-line bg-surface px-5 py-4">
      <div className="text-[12.5px] text-muted">{label}</div>
      <div className="mt-1 font-head text-[22px] font-bold">{value}</div>
    </div>
  );
}

function InviteModal({
  open,
  onClose,
  onInvited,
}: {
  open: boolean;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("contributor");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }
      setEmail("");
      setName("");
      setRole("contributor");
      setLoading(false);
      onInvited();
      onClose();
    } catch {
      setError("Failed to invite user");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl">
        <h2 className="font-head text-lg font-bold mb-4">Invite member</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm focus:border-accent focus:outline-none"
              placeholder="name@company.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm focus:border-accent focus:outline-none"
              placeholder="Full name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm focus:border-accent focus:outline-none"
            >
              <option value="contributor">Contributor</option>
              <option value="admin">Administrator</option>
              <option value="recipient">Recipient</option>
            </select>
          </div>
          {error && (
            <p className="text-sm text-bad bg-red-tint rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-line px-4 py-2 text-sm font-medium text-muted hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-accent-ink disabled:opacity-40"
            >
              {loading ? "Inviting..." : "Invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditUserModal({
  user,
  onClose,
  onUpdated,
}: {
  user: TeamUser;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [name, setName] = useState(user.name || "");
  const [role, setRole] = useState(user.role);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update");
        setLoading(false);
        return;
      }
      onUpdated();
      onClose();
    } catch {
      setError("Failed to update user");
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Remove ${user.name || user.email} from the team?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to delete");
        setLoading(false);
        return;
      }
      onUpdated();
      onClose();
    } catch {
      setError("Failed to delete user");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl">
        <h2 className="font-head text-lg font-bold mb-1">Edit member</h2>
        <p className="text-sm text-muted mb-4">{user.email}</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm focus:border-accent focus:outline-none"
            >
              <option value="contributor">Contributor</option>
              <option value="admin">Administrator</option>
              <option value="recipient">Recipient</option>
            </select>
          </div>
          {error && (
            <p className="text-sm text-bad bg-red-tint rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handleDelete}
              disabled={loading}
              className="text-sm font-medium text-bad hover:underline disabled:opacity-40"
            >
              Remove from team
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="rounded-full border border-line px-4 py-2 text-sm font-medium text-muted hover:bg-canvas"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-accent-ink disabled:opacity-40"
              >
                {loading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [stats, setStats] = useState<TeamStats>({ contributors: 0, administrators: 0, recipientsOnly: 0 });
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [editingUser, setEditingUser] = useState<TeamUser | null>(null);

  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setTeamUsers(data.users);
        setStats(data.stats);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const roleLabel = (role: string) => {
    if (role === "admin") return "Administrator";
    if (role === "recipient") return "Recipient";
    return "Contributor";
  };

  if (loading) {
    return (
      <Screen title="Team" subtitle="People and permissions">
        <div className="text-center py-12 text-muted">Loading team...</div>
      </Screen>
    );
  }

  return (
    <Screen title="Team" subtitle="People and permissions">
      <InviteModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        onInvited={fetchTeam}
      />
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onUpdated={fetchTeam}
        />
      )}

      <div className="mb-[18px] flex items-center">
        <div className="flex-1" />
        <button
          onClick={() => setShowInvite(true)}
          className="rounded-full bg-accent px-[18px] py-2.5 text-sm font-bold text-accent-ink"
        >
          + Invite member
        </button>
      </div>

      {teamUsers.length === 0 ? (
        <div className="rounded-card border border-line bg-surface p-8 text-center">
          <p className="text-muted">No team members yet. Invite someone to get started!</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <div
            className={`grid ${COLS} gap-3.5 border-b border-line px-[22px] py-3.5 text-[12px] font-bold tracking-[0.04em] text-muted`}
          >
            <span>MEMBER</span>
            <span>ROLE</span>
            <span>ASSIGNED REPORT</span>
            <span />
          </div>
          {teamUsers.map((u) => (
            <div
              key={u.id}
              className={`grid ${COLS} items-center gap-3.5 border-t border-line px-[22px] py-3.5`}
            >
              <div className="flex min-w-0 items-center gap-[11px]">
                <Avatar name={u.name || u.email} size={34} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{u.name || u.email}</div>
                  <div className="truncate text-[12px] text-muted">{u.email}</div>
                </div>
              </div>
              <span>
                <RoleBadge role={roleLabel(u.role)} />
              </span>
              <span className="text-[13.5px] text-ink">
                {u.areas.length > 0 ? u.areas.join(", ") : "—"}
              </span>
              <button
                onClick={() => setEditingUser(u)}
                aria-label={`Actions for ${u.name}`}
                className="text-right text-[18px] text-muted hover:text-ink"
              >
                ···
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3.5">
        <StatCard label="Contributors" value={stats.contributors} />
        <StatCard label="Administrators" value={stats.administrators} />
        <StatCard label="Recipients only" value={stats.recipientsOnly} />
      </div>
    </Screen>
  );
}
