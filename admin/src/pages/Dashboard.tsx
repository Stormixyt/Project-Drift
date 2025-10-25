import { useState, useEffect } from 'react';
import { Server, Users, Activity, Settings } from 'lucide-react';
import ServerList from '../components/ServerList';
import ServerDetails from '../components/ServerDetails';
import Header from '../components/Header';
import { api } from '../services/api';

interface Server {
  id: string;
  name: string;
  status: string;
  players: number;
  maxPlayers: number;
  uptime: number;
}

function Dashboard() {
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServers();
    const interval = setInterval(loadServers, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, []);

  const loadServers = async () => {
    try {
      const data = await api.getServers();
      setServers(data.servers);
      if (!selectedServer && data.servers.length > 0) {
        setSelectedServer(data.servers[0]);
      }
    } catch (error) {
      console.error('Failed to load servers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleServerSelect = (server: Server) => {
    setSelectedServer(server);
  };

  const handleKickPlayer = async (playerId: string) => {
    if (!selectedServer) return;
    try {
      await api.kickPlayer(selectedServer.id, playerId);
      loadServers();
    } catch (error) {
      console.error('Failed to kick player:', error);
    }
  };

  const handleStopServer = async (serverId: string) => {
    try {
      await api.stopServer(serverId);
      setSelectedServer(null);
      loadServers();
    } catch (error) {
      console.error('Failed to stop server:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm">Active Servers</p>
                <p className="text-2xl font-bold text-primary">{servers.length}</p>
              </div>
              <Server className="w-8 h-8 text-primary" />
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm">Total Players</p>
                <p className="text-2xl font-bold text-primary">
                  {servers.reduce((sum, s) => sum + s.players, 0)}
                </p>
              </div>
              <Users className="w-8 h-8 text-primary" />
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm">Server Load</p>
                <p className="text-2xl font-bold text-primary">42%</p>
              </div>
              <Activity className="w-8 h-8 text-primary" />
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm">Settings</p>
                <p className="text-sm text-text-secondary">Configure</p>
              </div>
              <Settings className="w-8 h-8 text-primary" />
            </div>
          </div>
        </div>

        {/* Main Content - Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Server List */}
          <div className="lg:col-span-1">
            <ServerList
              servers={servers}
              selectedServer={selectedServer}
              onServerSelect={handleServerSelect}
              loading={loading}
            />
          </div>

          {/* Server Details */}
          <div className="lg:col-span-2">
            <ServerDetails
              server={selectedServer}
              onKickPlayer={handleKickPlayer}
              onStopServer={handleStopServer}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
