import { useState } from 'react';
import { Search, Plus, MoreVertical, Trash2, Edit2, CheckCircle, XCircle, X } from 'lucide-react';

let workersData = [
  { id: 1, name: 'Amit Kumar', phone: '9876543210', area: 'Zone A', status: 'active', joinDate: '2024-01-15' },
  { id: 2, name: 'Priya Singh', phone: '9876543211', area: 'Zone B', status: 'active', joinDate: '2023-11-20' },
  { id: 3, name: 'Rajesh Patel', phone: '9876543212', area: 'Zone C', status: 'inactive', joinDate: '2024-02-01' },
  { id: 4, name: 'Neha Verma', phone: '9876543213', area: 'Zone A', status: 'active', joinDate: '2024-03-10' },
  { id: 5, name: 'Arjun Mishra', phone: '9876543214', area: 'Zone B', status: 'pending', joinDate: '2024-04-05' },
];

export default function Workers() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [workers, setWorkers] = useState(workersData);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '', area: 'Zone A', status: 'active' });

  const filteredWorkers = workers.filter(worker => {
    const matchesSearch = worker.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || worker.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleAddWorker = () => {
    if (formData.name && formData.phone) {
      const newWorker = {
        id: Math.max(...workers.map(w => w.id), 0) + 1,
        ...formData,
        joinDate: new Date().toISOString().split('T')[0],
      };
      setWorkers([...workers, newWorker]);
      setFormData({ name: '', phone: '', area: 'Zone A', status: 'active' });
      setShowModal(false);
    }
  };

  const handleDeleteWorker = (id) => {
    setWorkers(workers.filter(w => w.id !== id));
    setOpenMenuId(null);
  };

  return (
    <div className="space-y-6 page-enter">
      {/* Header with Search and Add Button */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-public-sans font-bold text-gray-900">Workers Management</h2>
          <p className="text-gray-600 text-sm mt-1">Manage field workers and their assignments</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 w-fit">
          <Plus size={20} />
          Add Worker
        </button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-3.5 text-gray-500" size={20} />
          <input
            type="text"
            placeholder="Search workers by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-base pl-12 border border-gray-200 rounded-lg"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="input-base w-full md:w-40 border border-gray-200 rounded-lg"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* Workers Table */}
      <div className="card overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Worker</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Phone</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Area</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Join Date</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkers.map((worker) => (
                <tr key={worker.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors relative">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                        {worker.name[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{worker.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{worker.phone}</td>
                  <td className="px-6 py-4">
                    <span className="badge badge-primary bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-medium">{worker.area}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {worker.status === 'active' && <CheckCircle size={16} className="text-green-600" />}
                      {worker.status === 'inactive' && <XCircle size={16} className="text-red-600" />}
                      <span className={`text-sm font-medium capitalize ${
                        worker.status === 'active' ? 'text-green-600' :
                        worker.status === 'inactive' ? 'text-red-600' :
                        'text-yellow-600'
                      }`}>
                        {worker.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600 text-sm">{worker.joinDate}</td>
                  <td className="px-6 py-4 text-center relative">
                    <button 
                      onClick={() => setOpenMenuId(openMenuId === worker.id ? null : worker.id)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors inline-flex"
                    >
                      <MoreVertical size={16} className="text-gray-600" />
                    </button>
                    {openMenuId === worker.id && (
                      <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                        <button className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                          <Edit2 size={16} /> Edit
                        </button>
                        <button 
                          onClick={() => handleDeleteWorker(worker.id)}
                          className="w-full text-left px-4 py-2 hover:bg-red-50 flex items-center gap-2 text-red-600"
                        >
                          <Trash2 size={16} /> Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stats Footer */}
      <div className="grid grid-cols-3 md:grid-cols-3 gap-4">
        <div className="card text-center border border-gray-200">
          <p className="stat-label text-gray-600">Total Workers</p>
          <p className="stat-value text-gray-900 text-2xl font-bold">{workers.length}</p>
        </div>
        <div className="card text-center border border-gray-200">
          <p className="stat-label text-gray-600">Active</p>
          <p className="stat-value text-green-600 text-2xl font-bold">{workers.filter(w => w.status === 'active').length}</p>
        </div>
        <div className="card text-center border border-gray-200">
          <p className="stat-label text-gray-600">Pending</p>
          <p className="stat-value text-yellow-600 text-2xl font-bold">{workers.filter(w => w.status === 'pending').length}</p>
        </div>
      </div>

      {/* Add Worker Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Add New Worker</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Worker name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="Phone number"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
                <select
                  value={formData.area}
                  onChange={(e) => setFormData({...formData, area: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-blue-500"
                >
                  <option value="Zone A">Zone A</option>
                  <option value="Zone B">Zone B</option>
                  <option value="Zone C">Zone C</option>
                  <option value="Zone D">Zone D</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <button 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddWorker}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add Worker
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
