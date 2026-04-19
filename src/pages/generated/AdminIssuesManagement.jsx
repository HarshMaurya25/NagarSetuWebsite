import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdminIssueList } from '../../services/api';

export default function AdminIssuesManagement() {
  const [page, setPage] = useState(0);
  const [size] = useState(10);
  const [data, setData] = useState({ content: [], totalPages: 1, totalElements: 0 });
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await getAdminIssueList(page, size);
        if (mounted) setData(response);
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to fetch issues.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [page, size]);

  const filtered = useMemo(() => {
    return (data.content || []).filter((issue) => {
      const text = `${issue.title}`.toLowerCase();
      const matchSearch = !search || text.includes(search.toLowerCase());
      const matchStage = stageFilter === 'ALL' || issue.stage === stageFilter;
      return matchSearch && matchStage;
    });
  }, [data.content, search, stageFilter]);

  return (
    <div className="pt-24 px-8 pb-12 space-y-6">
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <h1 className="text-3xl font-black text-primary">Issue Management</h1>
          <p className="text-on-surface-variant text-sm">Manage and track all civic issues</p>
        </div>
      </div>

      <section className="bg-surface-container-low p-4 rounded-xl flex flex-wrap gap-3">
        <input
          className="bg-surface-container-lowest px-3 py-2 rounded-lg border border-outline-variant/30 min-w-72"
          placeholder="Search by title"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="bg-surface-container-lowest px-3 py-2 rounded-lg border border-outline-variant/30"
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
        >
          <option value="ALL">All Stages</option>
          <option value="PENDING">PENDING</option>
          <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
          <option value="TEAM_ASSIGNED">TEAM_ASSIGNED</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="RECONSIDERED">RECONSIDERED</option>
        </select>
      </section>

      {loading && <p>Loading issues...</p>}
      {error && <p className="text-error">{error}</p>}

      {!loading && !error && (
        <section className="bg-surface-container-lowest rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-container-low border-b border-outline-variant/15">
              <tr>
                <th className="text-left px-4 py-3">Title</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Location</th>
                <th className="text-left px-4 py-3">Criticality</th>
                <th className="text-left px-4 py-3">Stage</th>
                <th className="text-left px-4 py-3">Assigned</th>
                <th className="text-left px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((issue) => (
                <tr key={issue.id} className="border-b border-outline-variant/10">
                  <td className="px-4 py-3 font-semibold">{issue.title}</td>
                  <td className="px-4 py-3">{issue.issueType}</td>
                  <td className="px-4 py-3">{issue.location}</td>
                  <td className="px-4 py-3">{issue.criticality}</td>
                  <td className="px-4 py-3">{issue.stageLabel}</td>
                  <td className="px-4 py-3">{issue.assignedTo}</td>
                  <td className="px-4 py-3">
                    <button
                      className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary hover:text-white transition-all"
                      onClick={() => navigate(`/admin/issues/${issue.id}`)}
                    >
                      Detail →
                    </button>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td className="px-4 py-6 text-outline" colSpan="7">No issues found for current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-outline">Total: {data.totalElements}</p>
        <div className="flex gap-2">
          <button
            className="px-3 py-2 rounded-lg border border-outline-variant/20 disabled:opacity-40"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Prev
          </button>
          <span className="px-3 py-2 text-sm">Page {page + 1} / {Math.max(1, data.totalPages)}</span>
          <button
            className="px-3 py-2 rounded-lg border border-outline-variant/20 disabled:opacity-40"
            disabled={page + 1 >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
