"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Archive,
  ArchiveRestore,
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { SectionLabel } from "./ui";
import { ConfirmDialog } from "./confirm-dialog";
import { initials, avatarColor } from "@/lib/avatar";
import { parseConfig } from "@/lib/questions";

interface TemplateAssignee {
  id: number;
  name: string | null;
  email: string;
}

interface UserOption {
  id: number;
  name: string | null;
  email: string;
  role: string;
}

interface Template {
  id: number;
  teamId: number;
  name: string;
  area: string | null;
  cadence: string;
  dataSourceUrl: string | null;
  archivedAt: string | null;
  deletedAt: string | null;
  qCount: number;
  assignees: TemplateAssignee[];
}

interface Team {
  id: number;
  parentTeamId: number | null;
  name: string;
  cadence: string;
  rollupMode: string;
  templateMode: string;
  archivedAt: string | null;
}

/** Teams in tree order: root first, then depth-first following the API's
 *  sibling order. Orphans (broken parent links / cycles) trail at the end. */
function orderTeams(teams: Team[]): Team[] {
  const byParent = new Map<number | null, Team[]>();
  for (const t of teams) {
    const list = byParent.get(t.parentTeamId) ?? [];
    list.push(t);
    byParent.set(t.parentTeamId, list);
  }
  const out: Team[] = [];
  const visit = (parentId: number | null) => {
    for (const t of byParent.get(parentId) ?? []) {
      out.push(t);
      visit(t.id);
    }
  };
  visit(null);
  const seen = new Set(out.map((t) => t.id));
  for (const t of teams) if (!seen.has(t.id)) out.push(t);
  return out;
}

/** Group header / option label — sub-teams get a "Parent › Child" breadcrumb. */
function teamLabel(team: Team, teams: Team[]): string {
  if (team.parentTeamId === null) return team.name;
  const parent = teams.find((t) => t.id === team.parentTeamId);
  return parent ? `${parent.name} › ${team.name}` : team.name;
}

const PURGE_DAYS = 7;

/** Whole days until a deleted template is purged (min 0). */
function daysUntilPurge(deletedAt: string): number {
  const purgeAt = new Date(deletedAt).getTime() + PURGE_DAYS * 86_400_000;
  return Math.max(0, Math.ceil((purgeAt - Date.now()) / 86_400_000));
}

interface Question {
  id: number;
  templateId: number;
  order: number;
  text: string;
  type: string;
  config: unknown;
}

const TYPE_LABELS: Record<string, string> = {
  rag: "RAG",
  long_text: "Long text",
  short_text: "Short text",
  single_choice: "Single choice",
  multi_choice: "Multi choice",
  number: "Number",
  file_link: "File / Link",
};

function NewTemplateModal({
  open,
  teams,
  onClose,
  onCreated,
}: {
  open: boolean;
  teams: Team[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  // null = "not chosen yet" — falls back to the root team below.
  const [teamId, setTeamId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const activeTeams = orderTeams(teams.filter((t) => !t.archivedAt));
  const rootTeamId =
    activeTeams.find((t) => t.parentTeamId === null)?.id ??
    activeTeams[0]?.id ??
    null;
  const effectiveTeamId =
    teamId !== null && activeTeams.some((t) => t.id === teamId)
      ? teamId
      : rootTeamId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          area: area.trim(),
          ...(effectiveTeamId !== null ? { teamId: effectiveTeamId } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create");
        setLoading(false);
        return;
      }
      setName("");
      setArea("");
      setTeamId(null);
      setLoading(false);
      onCreated();
      onClose();
    } catch {
      setError("Failed to create template");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl">
        <h2 className="font-head text-lg font-bold mb-4">New report template</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Report name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm focus:border-accent focus:outline-none"
              placeholder="e.g. Customer Success"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Area</label>
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm focus:border-accent focus:outline-none"
              placeholder="e.g. Weekly Update"
            />
          </div>
          {activeTeams.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Team</label>
              <select
                value={effectiveTeamId ?? ""}
                onChange={(e) => setTeamId(Number(e.target.value))}
                className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm focus:border-accent focus:outline-none"
              >
                {activeTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {teamLabel(t, teams)}
                  </option>
                ))}
              </select>
            </div>
          )}
          {error && <p className="text-sm text-bad">{error}</p>}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="rounded-full border border-line px-4 py-2 text-sm font-medium text-muted hover:bg-canvas">Cancel</button>
            <button type="submit" disabled={loading || !name.trim()} className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-accent-ink disabled:opacity-40">
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Add a new question, or — when `question` is set — edit an existing one.
// Render with a key per question so state re-initialises between opens.
function QuestionModal({
  templateId,
  question,
  onClose,
  onSaved,
}: {
  templateId: number;
  question: Question | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initial = parseConfig(question?.config);
  const [text, setText] = useState(question?.text ?? "");
  const [type, setType] = useState(question?.type ?? "long_text");
  const [helper, setHelper] = useState(initial.helper ?? "");
  const [optionsText, setOptionsText] = useState(
    (initial.options ?? []).join("\n"),
  );
  const [unit, setUnit] = useState(initial.unit ?? "");
  const [skippable, setSkippable] = useState(initial.skippable ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isChoice = type === "single_choice" || type === "multi_choice";
  const isNumber = type === "number";

  const reset = () => {
    setText("");
    setType("long_text");
    setHelper("");
    setOptionsText("");
    setUnit("");
    setSkippable(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const options = optionsText
      .split("\n")
      .map((o) => o.trim())
      .filter(Boolean);

    if (isChoice && options.length === 0) {
      setError("Add at least one option (one per line).");
      return;
    }

    const config: Record<string, unknown> = {};
    if (helper.trim()) config.helper = helper.trim();
    if (isChoice) config.options = options;
    if (isNumber && unit.trim()) config.unit = unit.trim();
    if (skippable) config.skippable = true;

    setLoading(true);
    setError("");
    try {
      const payload = {
        text: text.trim(),
        type,
        config: Object.keys(config).length > 0 ? config : null,
      };
      const res = await fetch(`/api/templates/${templateId}/questions`, {
        method: question ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          question ? { questionId: question.id, ...payload } : payload,
        ),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save question");
        setLoading(false);
        return;
      }
      reset();
      setLoading(false);
      onSaved();
      onClose();
    } catch {
      setError("Failed to save question");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl">
        <h2 className="font-head text-lg font-bold mb-4">
          {question ? "Edit question" : "Add question"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Question text *</label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm focus:border-accent focus:outline-none"
              placeholder="e.g. Overall health this week"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm focus:border-accent focus:outline-none"
            >
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          {isChoice && (
            <div>
              <label className="block text-sm font-medium text-muted mb-1">
                Options *{" "}
                <span className="font-normal">(one per line)</span>
              </label>
              <textarea
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm focus:border-accent focus:outline-none"
                placeholder={"Ahead\nOn track\nAt risk\nBehind"}
              />
            </div>
          )}
          {isNumber && (
            <div>
              <label className="block text-sm font-medium text-muted mb-1">
                Unit <span className="font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm focus:border-accent focus:outline-none"
                placeholder="e.g. customers"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-muted mb-1">
              Helper text <span className="font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={helper}
              onChange={(e) => setHelper(e.target.value)}
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm focus:border-accent focus:outline-none"
              placeholder="A short hint shown under the question"
            />
          </div>
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={skippable}
              onChange={(e) => setSkippable(e.target.checked)}
              className="mt-[3px] h-4 w-4 accent-[var(--accent)]"
            />
            <span>
              <span className="block text-sm font-medium text-ink">
                Contributors can skip this question
              </span>
              <span className="block text-[12.5px] text-muted">
                Adds a &ldquo;Nothing this week&rdquo; option on their report;
                skipped questions stay out of the Roundup.
              </span>
            </span>
          </label>
          {error && <p className="text-sm text-bad">{error}</p>}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="rounded-full border border-line px-4 py-2 text-sm font-medium text-muted hover:bg-canvas">Cancel</button>
            <button type="submit" disabled={loading || !text.trim()} className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-accent-ink disabled:opacity-40">
              {loading
                ? "Saving..."
                : question
                  ? "Save changes"
                  : "Add question"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteTemplateModal({
  template,
  onClose,
  onArchive,
  onDelete,
}: {
  template: Template | null;
  onClose: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [busy, setBusy] = useState(false);
  if (!template) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl">
        <h2 className="font-head text-lg font-bold">
          Delete “{template.name}”?
        </h2>
        <div className="mt-3 rounded-xl border border-bad/30 bg-red-tint/60 px-4 py-3 text-[13.5px] leading-[1.55] text-bad">
          <strong>This deletes the report and all of its data</strong> — every
          question and every past submission. It will be permanently erased
          after {PURGE_DAYS} days; until then you can restore it from the
          “Recently deleted” list.
        </div>
        <p className="mt-3 text-[13.5px] leading-[1.55] text-muted">
          If you just want to stop the report going out each week,{" "}
          <strong className="text-ink">archiving is the safer choice</strong> —
          it keeps every past submission and can be undone at any time.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-full border border-line px-4 py-2 text-sm font-medium text-muted hover:bg-canvas"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              setBusy(true);
              await onArchive();
              onClose();
            }}
            disabled={busy}
            className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-accent-ink disabled:opacity-40"
          >
            Archive instead
          </button>
          <button
            onClick={async () => {
              setBusy(true);
              await onDelete();
              onClose();
            }}
            disabled={busy}
            className="rounded-full bg-bad px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            Delete report
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReportsManager() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [moveError, setMoveError] = useState("");
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [savingAssignees, setSavingAssignees] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Template | null>(null);
  const [confirmRemoveQuestion, setConfirmRemoveQuestion] =
    useState<Question | null>(null);
  // Drag-to-reorder: rows are only draggable while the grip is held (armed),
  // and the list live-reorders as the dragged row passes over its siblings.
  const [armedId, setArmedId] = useState<number | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates);
        const actives = (data.templates as Template[]).filter(
          (t) => !t.archivedAt,
        );
        if (actives.length > 0 && selected === null) {
          setSelected(actives[0].id);
        }
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [selected]);

  const fetchQuestions = useCallback(async (templateId: number) => {
    try {
      const res = await fetch(`/api/templates/${templateId}/questions`);
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions);
      }
    } catch {}
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch {}
  }, []);

  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch("/api/teams");
      if (res.ok) {
        const data = await res.json();
        setTeams(data.teams);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchTemplates();
    fetchTeams();
    fetchUsers();
  }, [fetchTemplates, fetchTeams, fetchUsers]);

  useEffect(() => {
    if (selected !== null) {
      fetchQuestions(selected);
    }
  }, [selected, fetchQuestions]);

  const selectTemplate = (id: number) => {
    setShowAssign(false);
    setSelected(id);
  };

  const selectedTemplate = templates.find((t) => t.id === selected);
  const selectedTeam = selectedTemplate
    ? teams.find((t) => t.id === selectedTemplate.teamId)
    : undefined;

  // Active templates grouped by team — root first, then tree order. Archived
  // teams still come back from /api/teams, so their templates group under the
  // team's name; a teamId the API doesn't know trails in an "Unknown" group.
  const activeTemplates = templates.filter((t) => !t.archivedAt);
  const teamGroups: { key: string; label: string | null; items: Template[] }[] =
    [];
  for (const team of orderTeams(teams)) {
    const items = activeTemplates.filter((t) => t.teamId === team.id);
    if (items.length > 0) {
      teamGroups.push({
        key: `team-${team.id}`,
        label: teamLabel(team, teams),
        items,
      });
    }
  }
  const knownTeamIds = new Set(teams.map((t) => t.id));
  const orphaned = activeTemplates.filter((t) => !knownTeamIds.has(t.teamId));
  if (orphaned.length > 0) {
    // Until /api/teams responds there is nothing to group under — no header.
    teamGroups.push({
      key: "team-unknown",
      label: teams.length > 0 ? "Unknown team" : null,
      items: orphaned,
    });
  }

  const setArchived = async (id: number, archived: boolean) => {
    try {
      await fetch(`/api/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      if (archived && id === selected) {
        setSelected(null);
        setQuestions([]);
      }
      fetchTemplates();
    } catch {}
  };

  const deleteTemplate = async (id: number) => {
    try {
      await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (id === selected) {
        setSelected(null);
        setQuestions([]);
      }
      fetchTemplates();
    } catch {}
  };

  const restoreTemplate = async (id: number) => {
    try {
      await fetch(`/api/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore: true }),
      });
      fetchTemplates();
    } catch {}
  };

  const handleArchiveQuestion = async (qId: number) => {
    if (!selected) return;
    try {
      await fetch(`/api/templates/${selected}/questions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archiveQuestionId: qId }),
      });
      fetchQuestions(selected);
    } catch {}
  };

  const handleDragOver = (overId: number) => {
    if (dragId === null || dragId === overId) return;
    setQuestions((prev) => {
      const from = prev.findIndex((q) => q.id === dragId);
      const to = prev.findIndex((q) => q.id === overId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const persistOrder = async (list: Question[]) => {
    if (!selected) return;
    try {
      const res = await fetch(`/api/templates/${selected}/questions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reorder: list.map((q) => q.id) }),
      });
      if (!res.ok) fetchQuestions(selected);
    } catch {
      fetchQuestions(selected);
    }
  };

  const handleDragEnd = async () => {
    setArmedId(null);
    if (dragId === null) return;
    setDragId(null);
    await persistOrder(questions);
  };

  // Up/down fallback for touch screens, where HTML5 drag events don't fire.
  const moveQuestion = (qId: number, dir: -1 | 1) => {
    const from = questions.findIndex((q) => q.id === qId);
    const to = from + dir;
    if (from === -1 || to < 0 || to >= questions.length) return;
    const next = [...questions];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setQuestions(next);
    persistOrder(next);
  };

  const handleUpdateTemplateName = async (newName: string) => {
    if (!selected || !newName.trim()) return;
    try {
      await fetch(`/api/templates/${selected}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      fetchTemplates();
    } catch {}
  };

  const handleUpdateTemplateArea = async (newArea: string) => {
    if (!selected) return;
    try {
      await fetch(`/api/templates/${selected}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area: newArea.trim() }),
      });
      fetchTemplates();
    } catch {}
  };

  // Move the selected template to another team.
  const handleMoveTeam = async (teamId: number) => {
    if (!selected || !Number.isInteger(teamId)) return;
    setMoveError("");
    try {
      const res = await fetch(`/api/templates/${selected}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMoveError(data.error || "Couldn't move this report.");
        return;
      }
      fetchTemplates();
    } catch {
      setMoveError("Couldn't move this report.");
    }
  };

  // Assign / unassign a user to the selected template. The API replaces the
  // full assignee set, so we send the whole next list of user ids.
  const toggleAssignee = async (userId: number) => {
    if (!selected || !selectedTemplate) return;
    const current = selectedTemplate.assignees.map((a) => a.id);
    const next = current.includes(userId)
      ? current.filter((x) => x !== userId)
      : [...current, userId];
    setSavingAssignees(true);
    try {
      await fetch(`/api/templates/${selected}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeIds: next }),
      });
      await fetchTemplates();
    } catch {
    } finally {
      setSavingAssignees(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-muted">Loading templates...</div>;
  }

  return (
    <>
      <NewTemplateModal
        open={showNewTemplate}
        teams={teams}
        onClose={() => setShowNewTemplate(false)}
        onCreated={fetchTemplates}
      />
      <DeleteTemplateModal
        template={confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onArchive={async () => {
          if (confirmDelete) await setArchived(confirmDelete.id, true);
        }}
        onDelete={async () => {
          if (confirmDelete) await deleteTemplate(confirmDelete.id);
        }}
      />
      {selected !== null && (showAddQuestion || editingQuestion) && (
        <QuestionModal
          key={editingQuestion?.id ?? "new"}
          templateId={selected}
          question={editingQuestion}
          onClose={() => {
            setShowAddQuestion(false);
            setEditingQuestion(null);
          }}
          onSaved={() => fetchQuestions(selected)}
        />
      )}
      <ConfirmDialog
        open={confirmRemoveQuestion !== null}
        title="Remove this question?"
        body={
          <>
            <strong className="text-ink">
              “{confirmRemoveQuestion?.text}”
            </strong>{" "}
            will be removed from this report going forward. Past answers to it
            are kept and stay on previous submissions.
          </>
        }
        confirmLabel="Remove question"
        onConfirm={async () => {
          if (confirmRemoveQuestion)
            await handleArchiveQuestion(confirmRemoveQuestion.id);
        }}
        onClose={() => setConfirmRemoveQuestion(null)}
      />

      <div className="grid grid-cols-1 items-start gap-[22px] lg:grid-cols-[1.3fr_1fr]">
        {/* Left — template list */}
        <div className="min-w-0">
          <div className="mb-3.5 flex items-center">
            <SectionLabel className="tracking-[0.05em]">Report templates</SectionLabel>
            <div className="flex-1" />
            <button
              onClick={() => setShowNewTemplate(true)}
              className="rounded-full bg-accent px-4 py-[9px] text-[13.5px] font-bold text-accent-ink"
            >
              + New report
            </button>
          </div>

          {activeTemplates.length === 0 ? (
            <div className="rounded-card border border-line bg-surface p-8 text-center text-muted">
              No report templates yet. Create one to get started!
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {teamGroups.map((g) => (
                <div key={g.key}>
                  {g.label && (
                    <SectionLabel className="mb-2">{g.label}</SectionLabel>
                  )}
                  <div className="flex flex-col gap-2.5">
                    {g.items.map((r) => {
                      const active = r.id === selected;
                      return (
                        <button
                          key={r.id}
                          onClick={() => selectTemplate(r.id)}
                          className={`flex items-center gap-3.5 rounded-card border bg-surface px-[18px] py-4 text-left transition-colors ${
                            active ? "border-accent" : "border-line hover:border-accent"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-head text-[15px] font-bold">{r.name}</div>
                            <div className="mt-[3px] text-[12.5px] text-muted">
                              {r.qCount} question{r.qCount !== 1 ? "s" : ""} · {r.cadence}
                            </div>
                          </div>
                          <div className="flex items-center">
                            {r.assignees.map((a) => (
                              <span
                                key={a.id}
                                className="-ml-1.5 flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-surface text-[11px] font-bold text-white first:ml-0"
                                style={{ background: avatarColor(a.name || a.email) }}
                              >
                                {initials(a.name || a.email)}
                              </span>
                            ))}
                          </div>
                          <span className={`whitespace-nowrap text-[11px] font-bold ${r.dataSourceUrl ? "text-good" : "text-muted"}`}>
                            {r.dataSourceUrl ? "● Sheet connected" : "○ No source"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Archived — reversible, nothing deleted */}
          {templates.some((t) => t.archivedAt && !t.deletedAt) && (
            <>
              <SectionLabel className="mb-2.5 mt-7 tracking-[0.05em]">
                Archived
              </SectionLabel>
              <div className="flex flex-col gap-2">
                {templates
                  .filter((t) => t.archivedAt && !t.deletedAt)
                  .map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-3.5 rounded-[14px] border border-dashed border-line bg-surface/60 px-[18px] py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-head text-[14px] font-bold text-muted">
                          {r.name}
                        </div>
                        <div className="text-[12px] text-muted">
                          Archived — not assigned for new weeks; all past
                          submissions kept.
                        </div>
                      </div>
                      <button
                        onClick={() => setArchived(r.id, false)}
                        className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface px-3.5 py-2 text-[12.5px] font-semibold text-ink hover:border-accent"
                      >
                        <ArchiveRestore size={14} /> Unarchive
                      </button>
                      <button
                        onClick={() => setConfirmDelete(r)}
                        aria-label={`Delete ${r.name}`}
                        title="Delete report"
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted hover:bg-red-tint hover:text-bad"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
              </div>
            </>
          )}

          {/* Recently deleted — restorable until the purge date */}
          {templates.some((t) => t.deletedAt) && (
            <>
              <SectionLabel className="mb-2.5 mt-7 tracking-[0.05em]">
                Recently deleted
              </SectionLabel>
              <div className="flex flex-col gap-2">
                {templates
                  .filter((t) => t.deletedAt)
                  .map((r) => {
                    const days = daysUntilPurge(r.deletedAt!);
                    return (
                      <div
                        key={r.id}
                        className="flex items-center gap-3.5 rounded-[14px] border border-bad/25 bg-red-tint/40 px-[18px] py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-head text-[14px] font-bold text-muted line-through">
                            {r.name}
                          </div>
                          <div className="text-[12px] font-medium text-bad">
                            {days === 0
                              ? "Permanently deleted within a day"
                              : `Permanently deleted in ${days} day${days === 1 ? "" : "s"}`}
                          </div>
                        </div>
                        <button
                          onClick={() => restoreTemplate(r.id)}
                          className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-accent px-3.5 py-2 text-[12.5px] font-bold text-accent-ink"
                        >
                          <RotateCcw size={14} /> Restore
                        </button>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </div>

        {/* Right — editor panel */}
        {selectedTemplate ? (
          <div className="sticky top-[96px] min-w-0 rounded-card border border-line bg-surface p-[22px]">
            <div className="flex items-center gap-2 text-[12px] font-bold tracking-[0.05em] text-accent">
              <span className="h-[7px] w-[7px] rounded-full bg-accent" />
              EDITING
            </div>
            <input
              key={selectedTemplate.id}
              defaultValue={selectedTemplate.name}
              onBlur={(e) => handleUpdateTemplateName(e.target.value)}
              className="my-1 w-full border-none bg-transparent font-head text-[20px] font-bold tracking-[-0.01em] text-ink outline-none"
            />
            <input
              key={`area-${selectedTemplate.id}`}
              defaultValue={selectedTemplate.area ?? ""}
              onBlur={(e) => handleUpdateTemplateArea(e.target.value)}
              placeholder="Area (e.g. Engineering) — shown on the Roundup"
              className="mb-1.5 w-full border-none bg-transparent text-[13px] font-medium text-muted outline-none placeholder:italic"
            />
            {teams.length > 0 && (
              <div className="mb-2.5 flex items-center gap-2">
                <span className="text-[12px] text-muted">Team</span>
                <select
                  value={selectedTemplate.teamId}
                  onChange={(e) => handleMoveTeam(Number(e.target.value))}
                  className="min-w-0 rounded-lg border border-line bg-bg px-2.5 py-1.5 text-[12.5px] font-medium text-ink focus:border-accent focus:outline-none"
                >
                  {/* An archived/unknown team can't be picked, but the current
                      value must still render — show it disabled. */}
                  {!teams.some(
                    (t) => t.id === selectedTemplate.teamId && !t.archivedAt,
                  ) && (
                    <option value={selectedTemplate.teamId} disabled>
                      {selectedTeam
                        ? `${teamLabel(selectedTeam, teams)} (archived)`
                        : "Unknown team"}
                    </option>
                  )}
                  {orderTeams(teams.filter((t) => !t.archivedAt)).map((t) => (
                    <option key={t.id} value={t.id}>
                      {teamLabel(t, teams)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {moveError && (
              <p className="mb-2.5 text-[12.5px] text-bad">{moveError}</p>
            )}
            <div className="mb-[18px] flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-muted">Assigned to</span>
              {selectedTemplate.assignees.length > 0 ? (
                selectedTemplate.assignees.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1 rounded-[7px] bg-accent-soft py-0.5 pl-[9px] pr-1.5 text-[12px] font-semibold text-accent"
                  >
                    {a.name || a.email}
                    <button
                      onClick={() => toggleAssignee(a.id)}
                      disabled={savingAssignees}
                      aria-label={`Unassign ${a.name || a.email}`}
                      className="rounded-full p-0.5 text-accent/60 hover:bg-accent/10 hover:text-accent disabled:opacity-40"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))
              ) : (
                <span className="text-[12px] italic text-muted">No one assigned</span>
              )}

              {/* Assign picker */}
              <div className="relative">
                <button
                  onClick={() => setShowAssign((v) => !v)}
                  className="rounded-[7px] border border-dashed border-line px-[9px] py-0.5 text-[12px] text-muted hover:border-accent hover:text-accent"
                >
                  + assign
                </button>
                {showAssign && (
                  <>
                    <button
                      aria-hidden
                      tabIndex={-1}
                      onClick={() => setShowAssign(false)}
                      className="fixed inset-0 z-40 cursor-default"
                    />
                    <div className="absolute left-0 top-full z-50 mt-1.5 max-h-72 w-72 overflow-auto rounded-xl border border-line bg-surface p-1 shadow-xl">
                      {users.length === 0 ? (
                        <div className="px-3 py-2 text-[12px] text-muted">
                          No users found
                        </div>
                      ) : (
                        users.map((u) => {
                          const assigned = selectedTemplate.assignees.some(
                            (a) => a.id === u.id,
                          );
                          const label = u.name || u.email;
                          return (
                            <button
                              key={u.id}
                              onClick={() => toggleAssignee(u.id)}
                              disabled={savingAssignees}
                              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-accent-soft disabled:opacity-50"
                            >
                              <span
                                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                                style={{ background: avatarColor(label) }}
                              >
                                {initials(label)}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-semibold text-ink">
                                  {label}
                                </span>
                                <span className="block truncate text-[11px] text-muted">
                                  {u.email}
                                  {u.role === "recipient" ? " · recipient" : ""}
                                </span>
                              </span>
                              {assigned && (
                                <Check
                                  size={15}
                                  className="flex-shrink-0 text-accent"
                                />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </div>
              {selectedTeam?.templateMode === "shared" && (
                <span className="w-full text-[12px] italic leading-[1.5] text-muted">
                  This team uses one shared report — every member is included
                  automatically
                </span>
              )}
            </div>

            <SectionLabel className="mb-2.5 tracking-[0.05em]">Questions</SectionLabel>
            <div className="flex flex-col gap-2">
              {questions.map((q) => (
                <div
                  key={q.id}
                  draggable={armedId === q.id}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    setDragId(q.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    handleDragOver(q.id);
                  }}
                  onDrop={(e) => e.preventDefault()}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-[11px] rounded-[11px] border bg-bg px-3 py-[11px] ${
                    dragId === q.id
                      ? "border-accent opacity-60"
                      : "border-line"
                  }`}
                >
                  <span
                    onMouseDown={() => setArmedId(q.id)}
                    onMouseUp={() => setArmedId(null)}
                    aria-label="Drag to reorder"
                    title="Drag to reorder"
                    className="hidden flex-shrink-0 cursor-grab active:cursor-grabbing lg:block"
                  >
                    <GripVertical size={15} className="text-muted" />
                  </span>
                  {/* Touch screens can't use HTML5 drag — nudge buttons instead */}
                  <span className="flex flex-shrink-0 flex-col lg:hidden">
                    <button
                      onClick={() => moveQuestion(q.id, -1)}
                      disabled={questions[0]?.id === q.id}
                      aria-label="Move up"
                      className="flex h-5 w-6 items-center justify-center rounded text-muted hover:bg-accent-soft hover:text-accent disabled:opacity-30"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      onClick={() => moveQuestion(q.id, 1)}
                      disabled={questions[questions.length - 1]?.id === q.id}
                      aria-label="Move down"
                      className="flex h-5 w-6 items-center justify-center rounded text-muted hover:bg-accent-soft hover:text-accent disabled:opacity-30"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </span>
                  <span className="flex-1 truncate text-[13.5px]">{q.text}</span>
                  {parseConfig(q.config).skippable && (
                    <span className="whitespace-nowrap rounded-[7px] border border-line px-[9px] py-[3px] text-[11px] font-semibold text-muted">
                      Skippable
                    </span>
                  )}
                  <span className="whitespace-nowrap rounded-[7px] bg-accent-soft px-[9px] py-[3px] text-[11px] font-semibold text-accent">
                    {TYPE_LABELS[q.type] || q.type}
                  </span>
                  <button
                    onClick={() => setEditingQuestion(q)}
                    aria-label="Edit question"
                    title="Edit question — text, type and settings"
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-muted hover:bg-accent-soft hover:text-accent"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setConfirmRemoveQuestion(q)}
                    aria-label="Remove question"
                    title="Remove question — past answers are kept"
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-muted hover:bg-red-tint hover:text-bad"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setShowAddQuestion(true)}
                className="flex items-center justify-center gap-[7px] rounded-[11px] border border-dashed border-line py-[11px] text-[13.5px] font-semibold text-muted hover:border-accent hover:text-accent"
              >
                <Plus size={15} /> Add question
              </button>
            </div>

            <div className="mt-[18px] border-t border-line pt-4">
              <SectionLabel className="mb-2 tracking-[0.05em]">Data source</SectionLabel>
              {selectedTemplate.dataSourceUrl ? (
                <div className="flex items-center gap-2.5 rounded-[11px] border border-line bg-bg px-3 py-[11px]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--good)" strokeWidth={2} aria-hidden>
                    <path d="M4 4h16v16H4z" /><path d="M8 8h8M8 12h8M8 16h5" />
                  </svg>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-muted">{selectedTemplate.dataSourceUrl}</span>
                  <span className="text-[11px] font-semibold text-good">connected</span>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 rounded-[11px] border border-dashed border-line bg-bg px-3 py-[11px] text-[13px] text-muted">
                  No sheet connected — add one on Data sources.
                </div>
              )}
            </div>

            <div className="mt-[18px] flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <button
                onClick={() => setArchived(selectedTemplate.id, true)}
                className="flex items-center gap-2 rounded-full border border-line bg-surface px-[15px] py-[9px] text-[13px] font-semibold text-ink hover:border-accent"
              >
                <Archive size={15} /> Archive report
              </button>
              <button
                onClick={() => setConfirmDelete(selectedTemplate)}
                className="flex items-center gap-2 rounded-full border border-bad/30 bg-surface px-[15px] py-[9px] text-[13px] font-semibold text-bad hover:bg-red-tint"
              >
                <Trash2 size={15} /> Delete report
              </button>
              <span className="min-w-[180px] flex-1 text-[12px] leading-[1.4] text-muted">
                Archiving stops the report being assigned for future weeks and
                keeps every past submission — you can unarchive any time.
                Deleting erases the report and its data after {PURGE_DAYS} days.
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-card border border-line bg-surface p-8 text-center text-muted">
            {templates.length > 0 ? "Select a template to edit" : "Create your first report template"}
          </div>
        )}
      </div>
    </>
  );
}
