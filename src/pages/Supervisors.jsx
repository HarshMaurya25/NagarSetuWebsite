import { useState } from 'react';
import { Search, Plus, MoreVertical, Trash2, Edit2, X } from 'lucide-react';

let supervisorsData = [
  { id: 1, name: 'Vikas Kumar', email: 'vikas@nagar.setu', zone: 'Zone A', workers: 12, rating: 4.8 },
  { id: 2, name: 'Anjali Sharma', email: 'anjali@nagar.setu', zone: 'Zone B', workers: 15, rating: 4.6 },
  { id: 3, name: 'Mohammed Ali', email: 'mali@nagar.setu', zone: 'Zone C', workers: 10, rating: 4.9 },
];

export default function Supervisors() {
  const [searchTerm, setSearchTerm] = useState('');
  const [supervisors, setSupervisors] = useState(supervisorsData);
  const [showModal, setShowModal] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', zone: 'Zone A' });

  const filteredSupervisors = supervisors.filter(sup =>
    sup.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddSupervisor = () => {
    if (formData.name && formData.email) {
      const newSupervisor = {
        id: Math.max(...supervisors.map(s => s.id), 0) + 1,
        ...formData,
        workers: 0,
        rating: 4.5,
      };
      setSupervisors([...supervisors, newSupervisor]);
      setFormData({ name: '', email: '', zone: 'Zone A' });
      setShowModal(false);
    }
  };

  const handleDeleteSupervisor = (id) => {
    setSupervisors(supervisors.filter(s => s.id !== id));
    setOpenMenuId(null);
  };

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-public-sans font-bold text-gray-900">Supervisors</h2>
          <p className="text-gray-600 text-sm mt-1">Manage supervisory staff</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 w-fit">
          <Plus size={20} />
          Add Supervisor
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-3.5 text-gray-500" size={20} />
        <input
          type="text"
          placeholder="Search supervisors..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-base pl-12 border border-gray-200 rounded-lg"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSupervisors.map(sup => (
          <div key={sup.id} className="card group border border-gray-200">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                  {sup.name[0]}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{sup.name}</h3>
                  <p className="text-xs text-gray-600">{sup.email}</p>
                </div>
              </div>
              <div className="relative">
                <button 
                  onClick={() => setOpenMenuId(openMenuId === sup.id ? null : sup.id)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <MoreVertical size={16} className="text-gray-600" />
                </button>
                {openMenuId === sup.id && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                    <button className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                      <Edit2 size={16} /> Edit
                    </button>
                    <button 
                      onClick={() => handleDeleteSupervisor(sup.id)}
                      className="w-full text-left px-4 py-2 hover:bg-red-50 flex items-center gap-2 text-red-600"
                    >
                      <Trash2 size={16} /> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="badge badge-primary bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-medium">{sup.zone}</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-600">Workers</p>
                  <p className="text-lg font-bold text-blue-600">{sup.workers}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Rating</p>
                  <p className="text-lg font-bold text-yellow-600">{sup.rating}★</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Supervisor Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Add New Supervisor</h3>
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
                  placeholder="Supervisor name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="Email address"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zone</label>
                <select
                  value={formData.zone}
                  onChange={(e) => setFormData({...formData, zone: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-blue-500"
                >
                  <option value="Zone A">Zone A</option>
                  <option value="Zone B">Zone B</option>
                  <option value="Zone C">Zone C</option>
                  <option value="Zone D">Zone D</option>
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
                  onClick={handleAddSupervisor}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add Supervisor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
