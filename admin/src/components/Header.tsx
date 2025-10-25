import { useAuthStore } from '../store/authStore';

export default function Header() {
  const { user, logout } = useAuthStore();

  return (
    <header className="bg-surface border-b border-surface-light">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-primary">Project Drift</h1>
          <span className="text-text-secondary">Admin Dashboard</span>
        </div>
        
        <div className="flex items-center space-x-4">
          <span className="text-text-secondary">Welcome, {user?.username}</span>
          <button onClick={logout} className="btn-secondary">
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
