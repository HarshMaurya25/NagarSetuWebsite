import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteSupervisor, getAdminWorkforce } from "../../services/api";

export default function AdminWorkforceManagement() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  const [activeView, setActiveView] = useState("supervisors");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getAdminWorkforce();
      setData(response);
    } catch (err) {
      setError(err.message || "Failed to load workforce data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const idleWorkers = useMemo(() => data?.workersNoStart || [], [data]);
  const idleSupervisors = useMemo(() => data?.supervisorsNoStart || [], [data]);

  const handleDeleteSupervisor = async (id) => {
    setActionMsg("");
    try {
      await deleteSupervisor(id);
      setActionMsg("Supervisor deleted successfully.");
      await load();
    } catch (err) {
      setActionMsg(err.message || "Failed to delete supervisor.");
    }
  };

  const openSupervisor = (id) => {
    navigate(`/admin/workforce/supervisor/${id}`);
  };

  const openWorker = (id) => {
    navigate(`/admin/workforce/worker/${id}`);
  };

  return (
    <div className="pt-24 px-8 pb-12 space-y-6">
      <h1 className="text-3xl font-black text-primary">Workforce Management</h1>

      {loading && <p>Loading workforce...</p>}
      {error && <p className="text-error">{error}</p>}
      {actionMsg && (
        <p className="text-sm text-primary font-semibold">{actionMsg}</p>
      )}

      {!loading && !error && data && (
        <>
          <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-surface-container-lowest rounded-xl p-5 border-l-4 border-primary">
              <p className="text-xs uppercase font-bold text-outline">
                Supervisors
              </p>
              <p className="text-3xl font-black">
                {data.supervisors?.length || 0}
              </p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 border-l-4 border-secondary">
              <p className="text-xs uppercase font-bold text-outline">
                Workers
              </p>
              <p className="text-3xl font-black">{data.workers?.length || 0}</p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 border-l-4 border-tertiary">
              <p className="text-xs uppercase font-bold text-outline">
                No-start Supervisors
              </p>
              <p className="text-3xl font-black">{idleSupervisors.length}</p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 border-l-4 border-error">
              <p className="text-xs uppercase font-bold text-outline">
                No-start Workers
              </p>
              <p className="text-3xl font-black">{idleWorkers.length}</p>
            </div>
          </section>

          <section className="bg-surface-container-low rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                className={`px-4 py-2 rounded-lg font-bold ${activeView === "supervisors" ? "bg-primary text-white" : "bg-surface-container-lowest"}`}
                onClick={() => setActiveView("supervisors")}
              >
                Supervisors
              </button>
              <button
                className={`px-4 py-2 rounded-lg font-bold ${activeView === "workers" ? "bg-primary text-white" : "bg-surface-container-lowest"}`}
                onClick={() => setActiveView("workers")}
              >
                Workers
              </button>
            </div>
            <div className="text-sm text-outline">
              Select a row to view full details.
            </div>
          </section>

          <section className="bg-surface-container-lowest rounded-xl overflow-auto">
            <div className="p-4 border-b border-outline-variant/10">
              <h2 className="font-bold">
                {activeView === "supervisors" ? "Supervisors" : "Workers"}
              </h2>
            </div>

            {activeView === "supervisors" ? (
              <table className="w-full text-sm">
                <thead className="bg-surface-container-low">
                  <tr>
                    <th className="text-left px-4 py-3">Name</th>
                    <th className="text-left px-4 py-3">Ward</th>
                    <th className="text-left px-4 py-3">Started</th>
                    <th className="text-left px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.supervisors || []).map((sup) => (
                    <tr
                      key={sup.id}
                      className="border-b border-outline-variant/10"
                    >
                      <td className="px-4 py-3 font-semibold">
                        {sup.username}
                      </td>
                      <td className="px-4 py-3">{sup.wardName || "N/A"}</td>
                      <td className="px-4 py-3">{String(sup.started)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button
                            className="text-primary font-semibold hover:underline"
                            onClick={() => openSupervisor(sup.id)}
                          >
                            View
                          </button>
                          <button
                            className="text-error font-semibold"
                            onClick={() => handleDeleteSupervisor(sup.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface-container-low">
                  <tr>
                    <th className="text-left px-4 py-3">Name</th>
                    <th className="text-left px-4 py-3">Supervisor</th>
                    <th className="text-left px-4 py-3">Ward</th>
                    <th className="text-left px-4 py-3">Started</th>
                    <th className="text-left px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.workers || []).map((worker) => (
                    <tr
                      key={worker.id}
                      className="border-b border-outline-variant/10"
                    >
                      <td className="px-4 py-3 font-semibold">
                        {worker.username}
                      </td>
                      <td className="px-4 py-3">
                        {worker.supervisorName || "Unassigned"}
                      </td>
                      <td className="px-4 py-3">{worker.wardName || "N/A"}</td>
                      <td className="px-4 py-3">{String(worker.started)}</td>
                      <td className="px-4 py-3">
                        <button
                          className="text-primary font-semibold hover:underline"
                          onClick={() => openWorker(worker.id)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
