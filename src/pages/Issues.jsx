import { useState } from 'react';
import { Search, Filter, Clock, AlertCircle, CheckCircle, ArrowUpDown } from 'lucide-react';

const issuesData = [
  { id: 1, title: 'Pothole on Main Street', location: 'Zone A', category: 'Road', status: 'open', priority: 'high', date: '2024-04-10', votes: 24 },
  { id: 2, title: 'Street light not working', location: 'Zone B', category: 'Lighting', status: 'in-progress', priority: 'medium', date: '2024-04-09', votes: 18 },
  { id: 3, title: 'Garbage overflow', location: 'Zone C', category: 'Waste', status: 'resolved', priority: 'high', date: '2024-04-08', votes: 32 },
  { id: 4, title: 'Water pipeline leak', location: 'Zone A', category: 'Water', status: 'open', priority: 'high', date: '2024-04-07', votes: 15 },
  { id: 5, title: 'Damaged pavement', location: 'Zone B', category: 'Road', status: 'in-progress', priority: 'medium', date: '2024-04-06', votes: 22 },
];

export default function Issues() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('date');

  const filteredIssues = issuesData
    .filter(issue => {
      const matchesSearch = issue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            issue.location.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || issue.status === filterStatus;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch(sortBy) {
        case 'votes':
          return b.votes - a.votes;
        case 'priority':
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        case 'date':
        default:
          return new Date(b.date) - new Date(a.date);
      }
    });

  return (
    <div className="space-y-6 page-enter">
      <div>
        <h2 className="text-2xl font-public-sans font-bold text-gray-900">Issues Tracker</h2>
        <p className="text-gray-600 text-sm mt-1">Manage and track community reports</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 md:items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
          <input
            type="text"
            placeholder="Search issues by title or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-base pl-12"
          />
        </div>
        <div className="w-full md:w-48">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input-base"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="in-progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        <div className="w-full md:w-48">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input-base"
          >
            <option value="date">Sort: Latest</option>
            <option value="votes">Sort: Most Votes</option>
            <option value="priority">Sort: Priority</option>
          </select>
        </div>
      </div>

      {filteredIssues.length === 0 ? (
        <div className="card text-center py-12 border border-gray-200">
          <AlertCircle size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">No issues found matching your criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredIssues.map(issue => (
            <div key={issue.id} className="card group hover:shadow-elevated border border-gray-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{issue.title}</h3>
                  <p className="text-xs text-gray-600">{issue.location}</p>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-semibold flex-shrink-0 ${
                  issue.priority === 'high' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {issue.priority}
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                {issue.status === 'open' && <AlertCircle size={16} className="text-red-600" />}
                {issue.status === 'resolved' && <CheckCircle size={16} className="text-green-600" />}
                <span className={`text-xs font-medium capitalize ${
                  issue.status === 'open' ? 'text-red-600' :
                  issue.status === 'resolved' ? 'text-green-600' :
                  'text-yellow-600'
                }`}>
                  {issue.status}
                </span>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                <span className="text-xs text-gray-600">{issue.date}</span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-blue-600">{issue.votes}</span>
                  <span className="text-xs text-gray-600">votes</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
