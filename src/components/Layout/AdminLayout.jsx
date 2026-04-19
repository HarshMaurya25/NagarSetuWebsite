import { Outlet } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';

export default function AdminLayout() {
  return (
    <div className="bg-background text-on-surface font-body antialiased">
      <AdminSidebar />
      <main className="ml-64 min-h-screen">
        <AdminHeader />
        <div className="page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
