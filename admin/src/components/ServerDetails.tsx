// Stub component - to be fully implemented

export default function ServerDetails({ server, onStopServer }: any) {
  if (!server) {
    return (
      <div className="card">
        <p className="text-text-secondary">Select a server to view details</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold">{server.name}</h2>
          <p className="text-text-secondary">Server ID: {server.id}</p>
        </div>
        <button onClick={() => onStopServer(server.id)} className="btn-danger">
          Stop Server
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-surface-light p-4 rounded-lg">
          <p className="text-text-secondary text-sm">Status</p>
          <p className="text-lg font-bold text-primary">{server.status}</p>
        </div>
        <div className="bg-surface-light p-4 rounded-lg">
          <p className="text-text-secondary text-sm">Players</p>
          <p className="text-lg font-bold text-primary">
            {server.players}/{server.maxPlayers}
          </p>
        </div>
        <div className="bg-surface-light p-4 rounded-lg">
          <p className="text-text-secondary text-sm">Uptime</p>
          <p className="text-lg font-bold text-primary">{server.uptime}h</p>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-bold mb-4">Connected Players</h3>
        <div className="space-y-2">
          <p className="text-text-secondary">Player list will appear here</p>
        </div>
      </div>
    </div>
  );
}
