"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Pencil,
  Plus,
  Settings2,
  X,
} from "lucide-react";
import { Avatar, SectionLabel } from "./ui";
import { ConfirmDialog } from "./confirm-dialog";

/* ------------------------------------------------------------------ types */

export type TeamCadence = "weekly" | "monthly" | "quarterly";
export type RollupMode = "members" | "children" | "both";
export type TemplateMode = "shared" | "per_member";

export interface TeamMemberEntry {
  id: number;
  name: string | null;
  email: string;
  avatarColor: string | null;
  role: "lead" | "member";
}

export interface TeamNode {
  id: number;
  parentTeamId: number | null;
  name: string;
  cadence: TeamCadence;
  rollupMode: RollupMode;
  templateMode: TemplateMode;
  archivedAt: string | null;
  members: TeamMemberEntry[];
}

export interface OrgUser {
  id: number;
  name: string | null;
  email: string;
}

/* ------------------------------------------------------------------- copy */

const CADENCE_LABEL: Record<TeamCadence, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

const CADENCE_BADGE: Record<TeamCadence, string> = {
  weekly: "bg-accent-soft text-accent",
  monthly: "bg-good-soft text-good-ink",
  quarterly: "bg-warn-soft text-warn-ink",
};

const CADENCE_HELP: Record<TeamCadence, string> = {
  weekly: "A roundup every week, Monday to Sunday.",
  monthly: "One roundup per calendar month.",
  quarterly: "One roundup per calendar quarter (Jan / Apr / Jul / Oct).",
};

const ROLLUP_LABEL: Record<RollupMode, string> = {
  members: "Members' reports",
  children: "Sub-team roundups",
  both: "Both",
};

const ROLLUP_HELP: Record<RollupMode, string> = {
  members: "Summarise members' reports.",
  children: "Roll up sub-team roundups.",
  both: "Both — members' reports and sub-team roundups together.",
};

const TEMPLATE_LABEL: Record<TemplateMode, string> = {
  shared: "One shared template",
  per_member: "Per-member templates",
};

const TEMPLATE_HELP: Record<TemplateMode, string> = {
  shared: "Every member of this team fills in the same template.",
  per_member: "Each member is assigned their own template.",
};

/* ------------------------------------------------------------ tree helpers */

/** Depth-first flatten: root first, children in creation order under their parent. */
function flattenTree(teams: TeamNode[]): { team: TeamNode; depth: number }[] {
  const byParent = new Map<number | null, TeamNode[]>();
  for (const t of teams) {
    const list = byParent.get(t.parentTeamId) ?? [];
    list.push(t);
    byParent.set(t.parentTeamId, list);
  }
  const out: { team: TeamNode; depth: number }[] = [];
  const walk = (parentId: number | null, depth: number) => {
    for (const t of byParent.get(parentId) ?? []) {
      out.push({ team: t, depth });
      walk(t.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** Ids of a team's whole subtree (itself included). */
function subtreeIds(teams: TeamNode[], rootId: number): Set<number> {
  const ids = new Set<number>([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of teams) {
      if (
        t.parentTeamId !== null &&
        ids.has(t.parentTeamId) &&
        !ids.has(t.id)
      ) {
        ids.add(t.id);
        grew = true;
      }
    }
  }
  return ids;
}

/* -------------------------------------------------------------- primitives */

const inputClass =
  "w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm focus:border-accent focus:outline-none";

function ErrorNote({ message }: { message: string }) {
  return (
    <p className="text-sm text-bad bg-red-tint rounded-lg px-3 py-2">
      {message}
    </p>
  );
}

function ModalShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl">
        <h2 className="font-head text-lg font-bold mb-1">{title}</h2>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function ModalFooter({
  onClose,
  submitLabel,
  busyLabel,
  busy,
  disabled,
}: {
  onClose: () => void;
  submitLabel: string;
  busyLabel: string;
  busy: boolean;
  disabled?: boolean;
}) {
  return (
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
        disabled={busy || disabled}
        className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-accent-ink disabled:opacity-40"
      >
        {busy ? busyLabel : submitLabel}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ modals */

function RenameTeamModal({
  team,
  onClose,
  onSaved,
}: {
  team: TeamNode;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(team.name);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${team.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }
      await onSaved();
      onClose();
    } catch {
      setError("Failed to rename team");
      setLoading(false);
    }
  };

  return (
    <ModalShell title="Rename team">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-muted mb-1">
            Team name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            className={inputClass}
            placeholder="e.g. Product Design"
          />
        </div>
        {error && <ErrorNote message={error} />}
        <ModalFooter
          onClose={onClose}
          submitLabel="Save"
          busyLabel="Saving..."
          busy={loading}
          disabled={!name.trim()}
        />
      </form>
    </ModalShell>
  );
}

function AddSubTeamModal({
  parent,
  onClose,
  onCreated,
}: {
  parent: TeamNode;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [cadence, setCadence] = useState<TeamCadence>("weekly");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          parentTeamId: parent.id,
          cadence,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }
      await onCreated();
      onClose();
    } catch {
      setError("Failed to create sub-team");
      setLoading(false);
    }
  };

  return (
    <ModalShell
      title="New sub-team"
      subtitle={`Sits inside ${parent.name} — its roundup rolls up to that team.`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-muted mb-1">
            Team name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            className={inputClass}
            placeholder="e.g. Platform Engineering"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted mb-1">
            Cadence
          </label>
          <select
            value={cadence}
            onChange={(e) => setCadence(e.target.value as TeamCadence)}
            className={inputClass}
          >
            {(Object.keys(CADENCE_LABEL) as TeamCadence[]).map((c) => (
              <option key={c} value={c}>
                {CADENCE_LABEL[c]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[12.5px] text-muted">{CADENCE_HELP[cadence]}</p>
        </div>
        <p className="text-[12.5px] text-muted">
          You can fine-tune what rolls up, and how templates work, from
          Configure once the team is created.
        </p>
        {error && <ErrorNote message={error} />}
        <ModalFooter
          onClose={onClose}
          submitLabel="Create sub-team"
          busyLabel="Creating..."
          busy={loading}
          disabled={!name.trim()}
        />
      </form>
    </ModalShell>
  );
}

function ConfigureTeamModal({
  team,
  onClose,
  onSaved,
}: {
  team: TeamNode;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [cadence, setCadence] = useState<TeamCadence>(team.cadence);
  const [rollupMode, setRollupMode] = useState<RollupMode>(team.rollupMode);
  const [templateMode, setTemplateMode] = useState<TemplateMode>(
    team.templateMode,
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${team.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cadence, rollupMode, templateMode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }
      await onSaved();
      onClose();
    } catch {
      setError("Failed to update team");
      setLoading(false);
    }
  };

  return (
    <ModalShell
      title={`Configure ${team.name}`}
      subtitle="How often this team rounds up, and what feeds it."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-muted mb-1">
            Cadence
          </label>
          <select
            value={cadence}
            onChange={(e) => setCadence(e.target.value as TeamCadence)}
            className={inputClass}
          >
            {(Object.keys(CADENCE_LABEL) as TeamCadence[]).map((c) => (
              <option key={c} value={c}>
                {CADENCE_LABEL[c]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[12.5px] text-muted">{CADENCE_HELP[cadence]}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-muted mb-1">
            Roundup rolls up
          </label>
          <select
            value={rollupMode}
            onChange={(e) => setRollupMode(e.target.value as RollupMode)}
            className={inputClass}
          >
            {(Object.keys(ROLLUP_LABEL) as RollupMode[]).map((r) => (
              <option key={r} value={r}>
                {ROLLUP_LABEL[r]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[12.5px] text-muted">
            {ROLLUP_HELP[rollupMode]}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-muted mb-1">
            Report templates
          </label>
          <select
            value={templateMode}
            onChange={(e) => setTemplateMode(e.target.value as TemplateMode)}
            className={inputClass}
          >
            {(Object.keys(TEMPLATE_LABEL) as TemplateMode[]).map((m) => (
              <option key={m} value={m}>
                {TEMPLATE_LABEL[m]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[12.5px] text-muted">
            {TEMPLATE_HELP[templateMode]}
          </p>
        </div>
        {error && <ErrorNote message={error} />}
        <ModalFooter
          onClose={onClose}
          submitLabel="Save"
          busyLabel="Saving..."
          busy={loading}
        />
      </form>
    </ModalShell>
  );
}

/* ----------------------------------------------------------- member panel */

function TeamMembersPanel({
  team,
  allTeams,
  orgUsers,
  isAdmin,
  indent,
  onMutated,
}: {
  team: TeamNode;
  allTeams: TeamNode[];
  orgUsers: OrgUser[];
  isAdmin: boolean;
  indent: number;
  onMutated: () => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [addUserId, setAddUserId] = useState("");
  const [removing, setRemoving] = useState<TeamMemberEntry | null>(null);

  const run = async (fn: () => Promise<Response>) => {
    setError("");
    setBusy(true);
    try {
      const res = await fn();
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return false;
      }
      await onMutated();
      return true;
    } catch {
      setError("Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const setRole = (userId: number, role: "lead" | "member") =>
    run(() =>
      fetch(`/api/teams/${team.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      }),
    );

  const addMember = async () => {
    const userId = parseInt(addUserId, 10);
    if (isNaN(userId)) return;
    const ok = await run(() =>
      fetch(`/api/teams/${team.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: "member" }),
      }),
    );
    if (ok) setAddUserId("");
  };

  const removeMember = (userId: number) =>
    run(() =>
      fetch(`/api/teams/${team.id}/members?userId=${userId}`, {
        method: "DELETE",
      }),
    );

  const moveTeam = (parentTeamId: number) =>
    run(() =>
      fetch(`/api/teams/${team.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentTeamId }),
      }),
    );

  const memberIds = new Set(team.members.map((m) => m.id));
  const addable = orgUsers.filter((u) => !memberIds.has(u.id));

  // Valid new parents: any active team outside this team's own subtree.
  const excluded = subtreeIds(allTeams, team.id);
  const moveTargets = allTeams.filter(
    (t) => !excluded.has(t.id) && !t.archivedAt,
  );
  const isRoot = team.parentTeamId === null;

  return (
    <div
      className="border-t border-line bg-bg/60 py-4 pr-[22px]"
      style={{ paddingLeft: indent }}
    >
      <SectionLabel className="mb-2.5">Members</SectionLabel>

      {team.members.length === 0 ? (
        <p className="text-[13px] text-muted">
          No one in this team yet
          {isAdmin ? " — add your first member below." : "."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {team.members.map((m) => (
            <div key={m.id} className="flex items-center gap-2.5">
              <Avatar name={m.name || m.email} size={28} />
              <div className="min-w-0 flex-1">
                <span className="truncate text-[13px] font-semibold">
                  {m.name || m.email}
                </span>
                {m.role === "lead" && (
                  <span className="ml-2 rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                    Lead
                  </span>
                )}
              </div>
              {isAdmin && (
                <>
                  <div
                    className="flex gap-0.5 rounded-[9px] bg-line p-[2px]"
                    role="group"
                    aria-label={`Role for ${m.name || m.email}`}
                  >
                    {(["member", "lead"] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => m.role !== r && setRole(m.id, r)}
                        disabled={busy}
                        aria-pressed={m.role === r}
                        className={`rounded-[7px] px-2.5 py-1 text-[11.5px] font-semibold disabled:opacity-50 ${
                          m.role === r
                            ? "bg-surface text-ink"
                            : "bg-transparent text-muted"
                        }`}
                      >
                        {r === "lead" ? "Lead" : "Member"}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setRemoving(m)}
                    disabled={busy}
                    aria-label={`Remove ${m.name || m.email} from ${team.name}`}
                    title="Remove from this team"
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-muted hover:bg-red-tint hover:text-bad disabled:opacity-50"
                  >
                    <X size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
          <select
            value={addUserId}
            onChange={(e) => setAddUserId(e.target.value)}
            disabled={addable.length === 0}
            aria-label={`Add a member to ${team.name}`}
            className="max-w-[260px] rounded-lg border border-line bg-surface px-3 py-2 text-[13px] focus:border-accent focus:outline-none disabled:opacity-50"
          >
            <option value="">
              {addable.length === 0
                ? "Everyone's already in this team"
                : "Add someone to this team…"}
            </option>
            {addable.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email}
              </option>
            ))}
          </select>
          <button
            onClick={addMember}
            disabled={busy || !addUserId}
            className="rounded-full bg-accent px-3.5 py-2 text-[12.5px] font-bold text-accent-ink disabled:opacity-40"
          >
            + Add member
          </button>

          {!isRoot && !team.archivedAt && (
            <div className="ml-auto flex items-center gap-2 text-[12.5px] text-muted">
              Move to
              <select
                value={team.parentTeamId ?? ""}
                onChange={(e) => {
                  const next = parseInt(e.target.value, 10);
                  if (!isNaN(next) && next !== team.parentTeamId) {
                    moveTeam(next);
                  }
                }}
                disabled={busy}
                aria-label={`Move ${team.name} under another team`}
                className="max-w-[220px] rounded-lg border border-line bg-surface px-3 py-2 text-[13px] focus:border-accent focus:outline-none disabled:opacity-50"
              >
                {moveTargets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      )}

      <ConfirmDialog
        open={removing !== null}
        title="Remove from this team?"
        body={
          removing && (
            <>
              <strong className="text-ink">
                {removing.name || removing.email}
              </strong>{" "}
              will be removed from <strong className="text-ink">{team.name}</strong>.
              Their reports and any other team memberships are untouched.
            </>
          )
        }
        confirmLabel="Remove"
        onConfirm={async () => {
          if (removing) await removeMember(removing.id);
        }}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}

/* -------------------------------------------------------------- team row */

function TeamRow({
  team,
  depth,
  allTeams,
  orgUsers,
  isAdmin,
  expanded,
  onToggle,
  onRename,
  onAddSub,
  onConfigure,
  onArchive,
  onRestore,
  onMutated,
}: {
  team: TeamNode;
  depth: number;
  allTeams: TeamNode[];
  orgUsers: OrgUser[];
  isAdmin: boolean;
  expanded: boolean;
  onToggle: () => void;
  onRename: () => void;
  onAddSub: () => void;
  onConfigure: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onMutated: () => Promise<void>;
}) {
  const archived = team.archivedAt !== null;
  const isRoot = team.parentTeamId === null;
  const leads = team.members.filter((m) => m.role === "lead");
  const indent = 22 + depth * 26;

  const iconBtn =
    "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted disabled:opacity-50";

  return (
    <div className={archived ? "opacity-60" : ""}>
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3.5 pr-[18px]"
        style={{ paddingLeft: indent }}
      >
        {depth > 0 && (
          <CornerDownRight size={14} className="flex-shrink-0 text-muted" />
        )}
        <button
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${team.name}`}
          className="flex min-w-0 items-center gap-2 text-left"
        >
          {expanded ? (
            <ChevronDown size={15} className="flex-shrink-0 text-muted" />
          ) : (
            <ChevronRight size={15} className="flex-shrink-0 text-muted" />
          )}
          <span className="truncate font-head text-[14.5px] font-bold">
            {team.name}
          </span>
        </button>

        <span
          className={`whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold ${CADENCE_BADGE[team.cadence]}`}
        >
          {CADENCE_LABEL[team.cadence]}
        </span>
        {archived && (
          <span className="whitespace-nowrap rounded-md bg-line/50 px-2 py-0.5 text-[11px] font-semibold text-muted">
            Archived
          </span>
        )}

        <span className="whitespace-nowrap text-[12.5px] text-muted">
          {team.members.length} member{team.members.length !== 1 ? "s" : ""}
        </span>
        {leads.length > 0 ? (
          <span className="flex min-w-0 flex-wrap items-center gap-1">
            {leads.map((l) => (
              <span
                key={l.id}
                className="whitespace-nowrap rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent"
              >
                {(l.name || l.email).split(" ")[0]} · Lead
              </span>
            ))}
          </span>
        ) : (
          <span className="whitespace-nowrap text-[12px] text-muted">
            No lead yet
          </span>
        )}

        {isAdmin && (
          <div className="ml-auto flex items-center gap-0.5">
            {archived ? (
              <button
                onClick={onRestore}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface px-3.5 py-2 text-[12.5px] font-semibold text-ink hover:border-accent"
              >
                <ArchiveRestore size={14} /> Restore
              </button>
            ) : (
              <>
                <button
                  onClick={onRename}
                  aria-label={`Rename ${team.name}`}
                  title="Rename"
                  className={`${iconBtn} hover:bg-accent-soft hover:text-accent`}
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={onAddSub}
                  aria-label={`Add a sub-team under ${team.name}`}
                  title="Add sub-team"
                  className={`${iconBtn} hover:bg-accent-soft hover:text-accent`}
                >
                  <Plus size={16} />
                </button>
                <button
                  onClick={onConfigure}
                  aria-label={`Configure ${team.name}`}
                  title="Configure cadence & roll-up"
                  className={`${iconBtn} hover:bg-accent-soft hover:text-accent`}
                >
                  <Settings2 size={15} />
                </button>
                {!isRoot && (
                  <button
                    onClick={onArchive}
                    aria-label={`Archive ${team.name}`}
                    title="Archive (includes sub-teams)"
                    className={`${iconBtn} hover:bg-red-tint hover:text-bad`}
                  >
                    <Archive size={15} />
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {expanded && (
        <TeamMembersPanel
          team={team}
          allTeams={allTeams}
          orgUsers={orgUsers}
          isAdmin={isAdmin && !archived}
          indent={indent}
          onMutated={onMutated}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ main */

/**
 * Team structure builder: renders the org's team tree and (for admins) all
 * the editing surface — rename, sub-teams, cadence/roll-up config, member
 * management, moving and archiving. Sits above the member table on the Team
 * page; fetches on mount and refetches after every mutation.
 */
export function TeamBuilder({
  isAdmin,
  orgUsers,
}: {
  isAdmin: boolean;
  orgUsers: OrgUser[];
}) {
  const [teams, setTeams] = useState<TeamNode[] | null>(null);
  const [error, setError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [renaming, setRenaming] = useState<TeamNode | null>(null);
  const [configuring, setConfiguring] = useState<TeamNode | null>(null);
  const [addingUnder, setAddingUnder] = useState<TeamNode | null>(null);
  const [archiving, setArchiving] = useState<TeamNode | null>(null);

  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch("/api/teams");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load the team structure");
        return;
      }
      setTeams(data.teams);
    } catch {
      setError("Failed to load the team structure");
    }
  }, []);

  // Fetch on mount, and again whenever the org's member list changes (an
  // invite or removal on the page above can affect team membership).
  useEffect(() => {
    fetchTeams();
  }, [fetchTeams, orgUsers]);

  const setArchivedState = async (team: TeamNode, archived: boolean) => {
    setError("");
    try {
      const res = await fetch(`/api/teams/${team.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      await fetchTeams();
    } catch {
      setError("Something went wrong");
    }
  };

  const all = teams ?? [];
  const rows = flattenTree(all).filter(
    ({ team }) => showArchived || team.archivedAt === null,
  );
  const archivedCount = all.filter((t) => t.archivedAt !== null).length;
  const archivingDescendants = archiving
    ? subtreeIds(all, archiving.id).size - 1
    : 0;

  return (
    <section className="mb-9">
      {renaming && (
        <RenameTeamModal
          team={renaming}
          onClose={() => setRenaming(null)}
          onSaved={fetchTeams}
        />
      )}
      {configuring && (
        <ConfigureTeamModal
          team={configuring}
          onClose={() => setConfiguring(null)}
          onSaved={fetchTeams}
        />
      )}
      {addingUnder && (
        <AddSubTeamModal
          parent={addingUnder}
          onClose={() => setAddingUnder(null)}
          onCreated={fetchTeams}
        />
      )}
      <ConfirmDialog
        open={archiving !== null}
        title="Archive this team?"
        body={
          archiving && (
            <>
              <strong className="text-ink">{archiving.name}</strong>
              {archivingDescendants > 0 && (
                <>
                  {" "}
                  and its {archivingDescendants} sub-team
                  {archivingDescendants !== 1 ? "s" : ""}
                </>
              )}{" "}
              will stop opening new reporting periods. Nothing is deleted —
              past reports and roundups are kept, and you can restore the team
              at any time.
            </>
          )
        }
        confirmLabel="Archive team"
        onConfirm={async () => {
          if (archiving) await setArchivedState(archiving, true);
        }}
        onClose={() => setArchiving(null)}
      />

      <div className="mb-3.5 flex flex-wrap items-end gap-x-4 gap-y-2">
        <div>
          <SectionLabel>Team structure</SectionLabel>
          <p className="mt-1 text-[13px] text-muted">
            Teams inside teams — mirror how your organisation works. Each
            team&apos;s roundup rolls up into its parent.
          </p>
        </div>
        {archivedCount > 0 && (
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="ml-auto whitespace-nowrap rounded-full border border-line bg-surface px-3.5 py-2 text-[12.5px] font-semibold text-muted hover:border-accent hover:text-ink"
          >
            {showArchived
              ? "Hide archived"
              : `Show archived (${archivedCount})`}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3">
          <ErrorNote message={error} />
        </div>
      )}

      {teams === null ? (
        <div className="rounded-card border border-line bg-surface p-8 text-center text-muted">
          Loading team structure...
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-card border border-line bg-surface p-8 text-center text-muted">
          No teams yet.
        </div>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {rows.map(({ team, depth }) => (
            <TeamRow
              key={team.id}
              team={team}
              depth={depth}
              allTeams={all}
              orgUsers={orgUsers}
              isAdmin={isAdmin}
              expanded={expandedId === team.id}
              onToggle={() =>
                setExpandedId((cur) => (cur === team.id ? null : team.id))
              }
              onRename={() => setRenaming(team)}
              onAddSub={() => setAddingUnder(team)}
              onConfigure={() => setConfiguring(team)}
              onArchive={() => setArchiving(team)}
              onRestore={() => setArchivedState(team, false)}
              onMutated={fetchTeams}
            />
          ))}
        </div>
      )}
    </section>
  );
}
