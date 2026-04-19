export default function Profile() {
  const user = JSON.parse(localStorage.getItem('user') || '{"fullName":"Admin","email":"admin@nagar.setu"}');

  return (
    <div className="max-w-2xl mx-auto space-y-6 page-enter">
      <div>
        <h2 className="text-2xl font-public-sans font-bold text-avenue-on-surface">Profile & Settings</h2>
        <p className="text-avenue-on-surface-variant text-sm mt-1">Manage your account and preferences</p>
      </div>

      {/* Profile Card */}
      <div className="card">
        <div className="flex items-start gap-6 pb-6 border-b border-avenue-outline/10">
          <div className="w-20 h-20 rounded-full bg-gradient-primary flex items-center justify-center text-white font-bold text-2xl">
            {user.fullName?.[0]?.toUpperCase() || 'A'}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-avenue-on-surface">{user.fullName}</h3>
            <p className="text-avenue-on-surface-variant">{user.email}</p>
            <p className="text-sm text-avenue-on-surface-variant mt-1">Administrator • Active</p>
            <button className="btn-secondary mt-3 text-sm py-2 px-4">Edit Profile</button>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-avenue-on-surface">Email Notifications</p>
              <p className="text-xs text-avenue-on-surface-variant">Receive email alerts for important events</p>
            </div>
            <input type="checkbox" className="w-4 h-4 rounded" defaultChecked />
          </div>
          <div className="flex items-center justify-between py-3 border-t border-avenue-outline/10">
            <div>
              <p className="font-medium text-avenue-on-surface">Two-Factor Authentication</p>
              <p className="text-xs text-avenue-on-surface-variant">Add an extra layer of security</p>
            </div>
            <input type="checkbox" className="w-4 h-4 rounded" />
          </div>
          <div className="flex items-center justify-between py-3 border-t border-avenue-outline/10">
            <div>
              <p className="font-medium text-avenue-on-surface">Dark Mode</p>
              <p className="text-xs text-avenue-on-surface-variant">Use dark theme interface</p>
            </div>
            <input type="checkbox" className="w-4 h-4 rounded" />
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card border-2 border-avenue-error/20">
        <h4 className="text-title-medium font-public-sans font-bold text-avenue-error mb-4">Danger Zone</h4>
        <p className="text-avenue-on-surface-variant text-sm mb-4">
          Irreversible and destructive actions
        </p>
        <button className="border-2 border-avenue-error text-avenue-error px-6 py-2 rounded-lg hover:bg-avenue-error/5 transition-colors font-medium">
          Change Password
        </button>
      </div>
    </div>
  );
}
