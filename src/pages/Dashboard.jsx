import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Award, AlertCircle, CheckCircle2 } from 'lucide-react';

// Mock data
const chartData = [
  { day: 'Mon', issues: 24, resolved: 18 },
  { day: 'Tue', issues: 35, resolved: 28 },
  { day: 'Wed', issues: 28, resolved: 22 },
  { day: 'Thu', issues: 42, resolved: 35 },
  { day: 'Fri', issues: 55, resolved: 48 },
  { day: 'Sat', issues: 38, resolved: 32 },
  { day: 'Sun', issues: 31, resolved: 26 },
];

const statusData = [
  { name: 'Open', value: 45, color: '#005DAC' },
  { name: 'In Progress', value: 32, color: '#F59E0B' },
  { name: 'Resolved', value: 88, color: '#22C55E' },
];

const stats = [
  { icon: AlertCircle, label: 'Total Issues', value: '165', color: 'text-avenue-primary' },
  { icon: TrendingUp, label: 'This Week', value: '42', color: 'text-avenue-secondary' },
  { icon: CheckCircle2, label: 'Resolved (30d)', value: '134', color: 'text-avenue-success' },
  { icon: Award, label: 'Resolution Rate', value: '81.2%', color: 'text-avenue-warning' },
];

export default function Dashboard() {
  return (
    <div className="space-y-8 page-enter">
      {/* Welcome Banner */}
      <div className="glass-card backdrop-blur-xl p-8 rounded-3xl border border-white/20 bg-gradient-to-br from-avenue-primary/10 to-avenue-primary/5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-public-sans font-bold text-avenue-on-surface mb-2">
              Welcome back, Admin
            </h2>
            <p className="text-avenue-on-surface-variant">
              Here's what happening with your civic management system today
            </p>
          </div>
          <div className="hidden lg:block w-32 h-32 rounded-full bg-gradient-primary opacity-20 blur-2xl"></div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="card group hover:shadow-elevated">
              <div className="flex items-start justify-between">
                <div>
                  <p className="stat-label capitalize">{stat.label}</p>
                  <p className="stat-value">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg bg-avenue-surface group-hover:scale-110 transition-transform ${stat.color}`}>
                  <Icon size={24} />
                </div>
              </div>
              <div className="mt-4 h-1 bg-avenue-surface rounded-full overflow-hidden">
                <div className={`h-full w-3/4 bg-gradient-primary rounded-full`}></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Chart - Issues Trend */}
        <div className="lg:col-span-2 card">
          <h3 className="text-title-large font-public-sans font-bold text-avenue-on-surface mb-4">
            Issue Trends (7 Days)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,93,172,0.1)" />
              <XAxis dataKey="day" stroke="rgba(0,93,172,0.5)" />
              <YAxis stroke="rgba(0,93,172,0.5)" />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid rgba(0,93,172,0.1)',
                  borderRadius: '12px',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="issues"
                stroke="#005DAC"
                strokeWidth={3}
                dot={{ fill: '#005DAC', r: 5 }}
                activeDot={{ r: 7 }}
              />
              <Line
                type="monotone"
                dataKey="resolved"
                stroke="#22C55E"
                strokeWidth={3}
                dot={{ fill: '#22C55E', r: 5 }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart - Status Distribution */}
        <div className="card">
          <h3 className="text-title-large font-public-sans font-bold text-avenue-on-surface mb-4">
            Issue Status
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid rgba(0,93,172,0.1)',
                  borderRadius: '12px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-4">
            {statusData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                ></div>
                <span className="text-sm text-avenue-on-surface-variant">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h3 className="text-title-large font-public-sans font-bold text-avenue-on-surface mb-4">
          Recent Activity
        </h3>
        <div className="space-y-4">
          {[
            { type: 'Issue Created', desc: 'Pothole detected at Junction 5', time: '2 hours ago', status: 'new' },
            { type: 'Issue Updated', desc: 'Road construction complaint assigned', time: '4 hours ago', status: 'progress' },
            { type: 'Issue Resolved', desc: 'Street light repair completed', time: '1 day ago', status: 'resolved' },
            { type: 'Task Assigned', desc: 'Waste management survey assigned to Team B', time: '2 days ago', status: 'new' },
          ].map((activity, idx) => (
            <div key={idx} className="flex items-start gap-4 pb-4 border-b border-avenue-outline/10 last:border-0">
              <div className={`p-2 rounded-lg ${
                activity.status === 'new' ? 'bg-avenue-primary/10' :
                activity.status === 'progress' ? 'bg-avenue-warning/10' :
                'bg-avenue-success/10'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  activity.status === 'new' ? 'bg-avenue-primary' :
                  activity.status === 'progress' ? 'bg-avenue-warning' :
                  'bg-avenue-success'
                }`}></div>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-avenue-on-surface">{activity.type}</p>
                <p className="text-sm text-avenue-on-surface-variant">{activity.desc}</p>
              </div>
              <span className="text-xs text-avenue-on-surface-variant whitespace-nowrap">{activity.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
