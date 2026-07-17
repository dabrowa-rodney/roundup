"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Screen } from "@/components/screen";
import { Avatar, RoleBadge, SectionLabel } from "@/components/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { TeamBuilder } from "@/components/team-builder";
import { relativeTime } from "@/lib/dates";

const COLS = "min-w-[960px] grid-cols-[1.8fr_0.9fr_1.3fr_1.2fr_1.2fr_70px]";

interface TeamMembershipLite {
  id: number;
  name: string;
  role: string;
}

interface TeamUser {
  id: number;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  avatarColor: string | null;
  lastLoginAt: string | null;
  areas: string[];
  teams: TeamMembershipLite[];
}

interface TeamLite {
  id: number;
  name: string;
  parentTeamId: number | null;
}

/** Depth-first order (root first) so the picker reads like the team tree. */
function orderTeamsForPicker(teams: TeamLite[]): { team: TeamLite; depth: number }[] {
  const byParent = new Map<number | null, TeamLite[]>();
  for (const t of teams) {
    const list = byParent.get(t.parentTeamId) ?? [];
    list.push(t);
    byParent.set(t.parentTeamId, list);
  }
  const out: { team: TeamLite; depth: number }[] = [];
  const walk = (parentId: number | null, depth: number) => {
    for (const t of byParent.get(parentId) ?? []) {
      out.push({ team: t, depth });
      walk(t.id, depth + 1);
    }
  };
  // Roots first (parentTeamId null); orphans (parent archived) fall in after.
  walk(null, 0);
  const placed = new Set(out.map((o) => o.team.id));
  for (const t of teams) if (!placed.has(t.id)) out.push({ team: t, depth: 0 });
  return out;
}

/** Checkbox list of teams, tree-ordered — the shared picker used in the invite
 *  and edit dialogs. */
function TeamPicker({
  allTeams,
  selected,
  onToggle,
}: {
  allTeams: TeamLite[];
  selected: Set<number>;
  onToggle: (teamId: number) => void;
}) {
  if (allTeams.length === 0) {
    return <p className="text-[13px] text-muted">No teams yet.</p>;
  }
  return (
    <div className="max-h-[190px] overflow-y-auto rounded-lg border border-line">
      {orderTeamsForPicker(allTeams).map(({ team, depth }) => (
        <label
          key={team.id}
          className="flex cursor-pointer items-center gap-2.5 border-b border-line px-3 py-2 text-sm last:border-b-0 hover:bg-canvas"
          style={{ paddingLeft: 12 + depth * 18 }}
        >
          <input
            type="checkbox"
            checked={selected.has(team.id)}
            onChange={() => onToggle(team.id)}
            className="h-4 w-4 accent-accent"
          />
          <span className="truncate">{team.name}</span>
        </label>
      ))}
    </div>
  );
}

/** "Last signed in" cell: a time for members, invite state + resend for the rest. */
function LastLoginCell({ user }: { user: TeamUser }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">(
    "idle",
  );

  if (user.lastLoginAt) {
    return (
      <span className="text-[13px] text-muted">
        {relativeTime(user.lastLoginAt)}
      </span>
    );
  }

  const resend = async () => {
    setState("sending");
    try {
      const res = await fetch(`/api/users/${user.id}/invite`, {
        method: "POST",
      });
      setState(res.ok ? "sent" : "failed");
      if (res.ok) setTimeout(() => setState("idle"), 4000);
    } catch {
      setState("failed");
    }
  };

  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="whitespace-nowrap rounded-md bg-warn-soft px-2 py-0.5 text-[11.5px] font-semibold text-warn-ink">
        Invite pending
      </span>
      {state === "sent" ? (
        <span className="text-[12px] font-semibold text-good">Invite sent ✓</span>
      ) : (
        <button
          onClick={resend}
          disabled={state === "sending"}
          className={`whitespace-nowrap text-[12px] font-semibold underline-offset-2 hover:underline disabled:opacity-50 ${
            state === "failed" ? "text-bad" : "text-accent"
          }`}
        >
          {state === "sending"
            ? "Sending…"
            : state === "failed"
              ? "Failed — retry"
              : "Resend invite"}
        </button>
      )}
    </span>
  );
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
  allTeams,
  onClose,
  onInvited,
}: {
  open: boolean;
  allTeams: TeamLite[];
  onClose: () => void;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("contributor");
  const [teamIds, setTeamIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const toggleTeam = (id: number) =>
    setTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          role,
          teamIds: [...teamIds],
        }),
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
      setTeamIds(new Set());
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
          <div>
            <label className="block text-sm font-medium text-muted mb-1">
              Teams
            </label>
            <TeamPicker
              allTeams={allTeams}
              selected={teamIds}
              onToggle={toggleTeam}
            />
            <p className="mt-1 text-[12px] text-muted">
              Which teams this person belongs to. You can change this any time.
            </p>
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
  allTeams,
  onClose,
  onUpdated,
}: {
  user: TeamUser;
  allTeams: TeamLite[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [name, setName] = useState(user.name || "");
  const [role, setRole] = useState(user.role);
  const [teamIds, setTeamIds] = useState<Set<number>>(
    new Set(user.teams.map((t) => t.id)),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);

  const toggleTeam = (id: number) =>
    setTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
      // Reconcile team membership in one call.
      const teamRes = await fetch(`/api/users/${user.id}/teams`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamIds: [...teamIds] }),
      });
      if (!teamRes.ok) {
        const td = await teamRes.json().catch(() => ({}));
        setError(td.error || "Saved the member, but couldn't update their teams.");
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
          <div>
            <label className="block text-sm font-medium text-muted mb-1">
              Teams
            </label>
            <TeamPicker
              allTeams={allTeams}
              selected={teamIds}
              onToggle={toggleTeam}
            />
            <p className="mt-1 text-[12px] text-muted">
              Tick every team this person is part of. Lead roles are set in the
              team structure above.
            </p>
          </div>
          {error && (
            <p className="text-sm text-bad bg-red-tint rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setConfirmRemove(true)}
              disabled={loading}
              className="text-sm font-medium text-bad hover:underline disabled:opacity-40"
            >
              Remove from org
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
      <ConfirmDialog
        open={confirmRemove}
        title="Remove from the organisation?"
        body={
          <>
            <strong className="text-ink">{user.name || user.email}</strong>{" "}
            will lose access to this workspace and be removed from every team.
            Any reports assigned to them stay, but you&apos;ll need to reassign
            them.
          </>
        }
        confirmLabel="Remove from org"
        onConfirm={handleDelete}
        onClose={() => setConfirmRemove(false)}
      />
    </div>
  );
}

export default function TeamPage() {
  const { data: session } = useSession();
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [stats, setStats] = useState<TeamStats>({ contributors: 0, administrators: 0, recipientsOnly: 0 });
  const [allTeams, setAllTeams] = useState<TeamLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [editingUser, setEditingUser] = useState<TeamUser | null>(null);

  // The builder shows editing controls only to org admins. Role isn't in the
  // session, so find the signed-in member in the fetched list (the API
  // enforces admin-only writes regardless).
  const myEmail = session?.user?.email?.toLowerCase();
  const isAdmin = teamUsers.some(
    (u) => u.email.toLowerCase() === myEmail && u.role === "admin",
  );

  const fetchTeam = useCallback(async () => {
    try {
      const [usersRes, teamsRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/teams"),
      ]);
      if (usersRes.ok) {
        const data = await usersRes.json();
        setTeamUsers(data.users);
        setStats(data.stats);
      }
      if (teamsRes.ok) {
        const data = await teamsRes.json();
        // Active teams only — the picker offers places people can actually go.
        setAllTeams(
          (data.teams as (TeamLite & { archivedAt: string | null })[])
            .filter((t) => !t.archivedAt)
            .map((t) => ({
              id: t.id,
              name: t.name,
              parentTeamId: t.parentTeamId,
            })),
        );
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
        allTeams={allTeams}
        onClose={() => setShowInvite(false)}
        onInvited={fetchTeam}
      />
      {editingUser && (
        <EditUserModal
          user={editingUser}
          allTeams={allTeams}
          onClose={() => setEditingUser(null)}
          onUpdated={fetchTeam}
        />
      )}

      {/* Team structure — the org's tree of teams, above the people list. */}
      <TeamBuilder isAdmin={isAdmin} orgUsers={teamUsers} />

      <div className="mb-[18px] flex items-center">
        <SectionLabel>People</SectionLabel>
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
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <div
            className={`grid ${COLS} gap-3.5 border-b border-line px-[22px] py-3.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted`}
          >
            <span>MEMBER</span>
            <span>ROLE</span>
            <span>TEAMS</span>
            <span>ASSIGNED REPORT</span>
            <span>LAST SIGNED IN</span>
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
              <span className="flex flex-wrap gap-1">
                {u.teams.length > 0 ? (
                  u.teams.map((t) => (
                    <span
                      key={t.id}
                      className={`whitespace-nowrap rounded-md px-2 py-0.5 text-[11.5px] font-semibold ${
                        t.role === "lead"
                          ? "bg-accent-soft text-accent"
                          : "bg-line/50 text-muted"
                      }`}
                      title={t.role === "lead" ? "Lead" : "Member"}
                    >
                      {t.name}
                      {t.role === "lead" ? " · Lead" : ""}
                    </span>
                  ))
                ) : (
                  <span className="text-[13.5px] text-muted">—</span>
                )}
              </span>
              <span className="text-[13.5px] text-ink">
                {u.areas.length > 0 ? u.areas.join(", ") : "—"}
              </span>
              <LastLoginCell user={u} />
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
