"use client";

import { useState, useEffect, useCallback } from "react";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { SectionLabel } from "./ui";
import { initials, avatarColor } from "@/lib/avatar";

interface TemplateAssignee {
  id: number;
  name: string | null;
  email: string;
}

interface Template {
  id: number;
  name: string;
  area: string | null;
  cadence: string;
  dataSourceUrl: string | null;
  qCount: number;
  assignees: TemplateAssignee[];
}

interface Question {
  id: number;
  templateId: number;
  order: number;
  text: string;
  type: string;
  config: unknown;
}

const EDGE_COLORS = ["#2E6B4E", "#2D54EB", "#C0455B", "#B5762E", "#1F8A8A", "#7A4FB5", "#3D7A9E", "#9E4F7A"];
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
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), area: area.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create");
        setLoading(false);
        return;
      }
      setName("");
      setArea("");
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
          {error && <p className="text-sm text-bad">{error}</p>}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-muted hover:bg-canvas">Cancel</button>
            <button type="submit" disabled={loading || !name.trim()} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-ink disabled:opacity-40">
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddQuestionModal({
  open,
  templateId,
  onClose,
  onAdded,
}: {
  open: boolean;
  templateId: number;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [text, setText] = useState("");
  const [type, setType] = useState("long_text");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/templates/${templateId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), type }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to add question");
        setLoading(false);
        return;
      }
      setText("");
      setType("long_text");
      setLoading(false);
      onAdded();
      onClose();
    } catch {
      setError("Failed to add question");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl">
        <h2 className="font-head text-lg font-bold mb-4">Add question</h2>
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
          {error && <p className="text-sm text-bad">{error}</p>}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-muted hover:bg-canvas">Cancel</button>
            <button type="submit" disabled={loading || !text.trim()} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-ink disabled:opacity-40">
              {loading ? "Adding..." : "Add question"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ReportsManager() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [showAddQuestion, setShowAddQuestion] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates);
        if (data.templates.length > 0 && selected === null) {
          setSelected(data.templates[0].id);
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

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    if (selected !== null) {
      fetchQuestions(selected);
    }
  }, [selected, fetchQuestions]);

  const selectedTemplate = templates.find((t) => t.id === selected);

  const handleArchiveTemplate = async () => {
    if (!selected || !selectedTemplate) return;
    if (!confirm(`Archive "${selectedTemplate.name}"? It won't be assigned for future weeks.`)) return;
    try {
      await fetch(`/api/templates/${selected}`, { method: "DELETE" });
      setSelected(null);
      setQuestions([]);
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

  if (loading) {
    return <div className="text-center py-12 text-muted">Loading templates...</div>;
  }

  return (
    <>
      <NewTemplateModal
        open={showNewTemplate}
        onClose={() => setShowNewTemplate(false)}
        onCreated={fetchTemplates}
      />
      {selected !== null && (
        <AddQuestionModal
          open={showAddQuestion}
          templateId={selected}
          onClose={() => setShowAddQuestion(false)}
          onAdded={() => fetchQuestions(selected)}
        />
      )}

      <div className="grid grid-cols-1 items-start gap-[22px] lg:grid-cols-[1.3fr_1fr]">
        {/* Left — template list */}
        <div>
          <div className="mb-3.5 flex items-center">
            <SectionLabel className="tracking-[0.05em]">Report templates</SectionLabel>
            <div className="flex-1" />
            <button
              onClick={() => setShowNewTemplate(true)}
              className="rounded-[10px] bg-accent px-4 py-[9px] text-[13.5px] font-bold text-accent-ink"
            >
              + New report
            </button>
          </div>

          {templates.length === 0 ? (
            <div className="rounded-card border border-line bg-surface p-8 text-center text-muted">
              No report templates yet. Create one to get started!
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {templates.map((r, i) => {
                const active = r.id === selected;
                const edgeColor = EDGE_COLORS[i % EDGE_COLORS.length];
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelected(r.id)}
                    className={`flex items-center gap-3.5 rounded-[14px] border bg-surface px-[18px] py-4 text-left transition-colors ${
                      active ? "border-accent" : "border-line hover:border-accent"
                    }`}
                    style={{ borderLeft: `3px solid ${edgeColor}` }}
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
          )}
        </div>

        {/* Right — editor panel */}
        {selectedTemplate ? (
          <div className="sticky top-[96px] rounded-card border border-line bg-surface p-[22px]">
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
            <div className="mb-[18px] flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-muted">Assigned to</span>
              {selectedTemplate.assignees.length > 0 ? (
                selectedTemplate.assignees.map((a) => (
                  <span key={a.id} className="rounded-[7px] bg-accent-soft px-[9px] py-0.5 text-[12px] font-semibold text-accent">
                    {a.name || a.email}
                  </span>
                ))
              ) : (
                <span className="text-[12px] text-muted italic">No one assigned</span>
              )}
            </div>

            <SectionLabel className="mb-2.5 tracking-[0.05em]">Questions</SectionLabel>
            <div className="flex flex-col gap-2">
              {questions.map((q) => (
                <div key={q.id} className="flex items-center gap-[11px] rounded-[11px] border border-line bg-bg px-3 py-[11px]">
                  <GripVertical size={15} className="flex-shrink-0 cursor-grab text-muted" />
                  <span className="flex-1 truncate text-[13.5px]">{q.text}</span>
                  <span className="whitespace-nowrap rounded-[7px] bg-accent-soft px-[9px] py-[3px] text-[11px] font-semibold text-accent">
                    {TYPE_LABELS[q.type] || q.type}
                  </span>
                  <button
                    onClick={() => handleArchiveQuestion(q.id)}
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
                  <span className="flex-1 truncate text-[13px] text-muted">{selectedTemplate.dataSourceUrl}</span>
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
                onClick={handleArchiveTemplate}
                className="flex items-center gap-2 rounded-[10px] border border-[#E3C3BC] bg-surface px-[15px] py-[9px] text-[13px] font-semibold text-bad hover:bg-red-tint"
              >
                <Trash2 size={15} /> Archive report
              </button>
              <span className="min-w-[180px] flex-1 text-[12px] leading-[1.4] text-muted">
                Archiving stops the report being assigned for future weeks. Nothing is deleted — every past submission stays on record.
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
