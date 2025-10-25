import { useState } from 'react';
import { useAuthStore } from '../store/authStore';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login(username, password);
    } catch (err) {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="card max-w-md w-full">
        <h1 className="text-3xl font-bold text-primary mb-6 text-center">
          Project Drift
        </h1>
        <p className="text-text-secondary text-center mb-8">
          Admin Dashboard Login
        </p>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-600/20 border border-red-600 text-red-400 px-4 py-2 rounded mb-4">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="label">Username</label>
            <input
              type="text"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="mb-6">
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary w-full">
            Sign In
          </button>
        </form>

        <p className="text-text-secondary text-sm text-center mt-4">
          Default: admin / admin123 (change in production)
        </p>
      </div>
    </div>
  );
}

export default Login;
