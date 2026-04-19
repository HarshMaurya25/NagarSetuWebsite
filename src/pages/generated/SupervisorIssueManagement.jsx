import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSupervisorIssues } from "../../services/api";
import { getUser } from "../../lib/session";

function formatDate(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
}

function formatCoord(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  return value.toFixed(5);
}

function statusPillClasses(status) {
  if (status === "RESOLVED")
    return "border-tertiary/25 bg-tertiary/10 text-tertiary";
  if (status === "IN_PROGRESS")
    return "border-secondary/25 bg-secondary/10 text-secondary";
  return "border-primary/25 bg-primary/10 text-primary";
}

export default function SupervisorIssueManagement() {
  const user = getUser();
  const navigate = useNavigate();

  const [baseIssues, setBaseIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadIssues = useCallback(async () => {
    if (!user?.id) {
      setError("Supervisor ID missing in session. Please login again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await getSupervisorIssues({ supervisorId: user.id });
      const issues = response?.issues || [];
      setBaseIssues(issues);
    } catch (err) {
      setError(err.message || "Failed to load supervisor issues.");
      setBaseIssues([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  return (
    <div className="pt-24 px-4 sm:px-8 pb-12 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-black text-primary">
            Supervisor Issue Management
          </h1>
          <p className="text-outline mt-1">
            Browse and manage issues reported in your jurisdiction.
          </p>
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-lowest px-4 py-2 font-bold text-sm text-primary hover:bg-primary/5 transition"
          onClick={loadIssues}
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          Refresh
        </button>
      </div>

      {loading && <p>Loading issues...</p>}
      {error && <p className="text-error">{error}</p>}

      {!loading && !error && (
        <>
          <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative overflow-hidden rounded-2xl bg-surface-container-lowest shadow-elevated border border-outline-variant/10 p-6">
              <span className="material-symbols-outlined pointer-events-none absolute -right-3 -top-3 text-primary/10 text-[72px]">
                inventory_2
              </span>
              <p className="text-xs uppercase font-bold text-outline tracking-wide">
                Total Issues
              </p>
              <p className="text-3xl font-black text-primary mt-2">
                {baseIssues.length}
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-surface-container-lowest shadow-elevated border border-outline-variant/10 p-6">
              <span className="material-symbols-outlined pointer-events-none absolute -right-3 -top-3 text-primary/10 text-[72px]">
                report
              </span>
              <p className="text-xs uppercase font-bold text-outline tracking-wide">
                Open
              </p>
              <p className="text-3xl font-black text-primary mt-2">
                {baseIssues.filter((item) => item.status === "OPEN").length}
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-surface-container-lowest shadow-elevated border border-outline-variant/10 p-6">
              <span className="material-symbols-outlined pointer-events-none absolute -right-3 -top-3 text-secondary/10 text-[72px]">
                sync
              </span>
              <p className="text-xs uppercase font-bold text-outline tracking-wide">
                In Progress
              </p>
              <p className="text-3xl font-black text-primary mt-2">
                {
                  baseIssues.filter((item) => item.status === "IN_PROGRESS")
                    .length
                }
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-surface-container-lowest shadow-elevated border border-outline-variant/10 p-6">
              <span className="material-symbols-outlined pointer-events-none absolute -right-3 -top-3 text-tertiary/10 text-[72px]">
                task_alt
              </span>
              <p className="text-xs uppercase font-bold text-outline tracking-wide">
                Resolved
              </p>
              <p className="text-3xl font-black text-primary mt-2">
                {baseIssues.filter((item) => item.status === "RESOLVED").length}
              </p>
            </div>
          </section>

          <section className="rounded-2xl bg-surface-container-lowest shadow-elevated border border-outline-variant/10 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-low">
                <tr>
                  <th className="text-left px-6 py-4">Title</th>
                  <th className="text-left px-6 py-4">Description</th>
                  <th className="text-left px-6 py-4">Ward</th>
                  <th className="text-left px-6 py-4">Location</th>
                  <th className="text-left px-6 py-4">Status</th>
                  <th className="text-left px-6 py-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {baseIssues.map((issue) => (
                  <tr
                    key={issue.id}
                    className="border-b border-outline-variant/10 hover:bg-surface-container-low/60 cursor-pointer"
                    onClick={() => navigate(`/supervisor/issues/${issue.id}`)}
                  >
                    <td className="px-6 py-4 font-semibold text-primary">
                      {issue.title}
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant max-w-xs truncate">
                      {issue.description || "N/A"}
                    </td>
                    <td className="px-6 py-4">{issue.wardName || "N/A"}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 text-outline">
                        <span className="material-symbols-outlined text-[18px]">
                          location_on
                        </span>
                        {formatCoord(issue.latitude)},{" "}
                        {formatCoord(issue.longitude)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black ${statusPillClasses(
                          issue.status,
                        )}`}
                      >
                        {issue.status || "N/A"}
                      </span>
                    </td>
                    <td className="px-6 py-4">{formatDate(issue.createdAt)}</td>
                  </tr>
                ))}
                {!baseIssues.length && (
                  <tr>
                    <td className="px-6 py-6 text-outline" colSpan={6}>
                      No issues found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
