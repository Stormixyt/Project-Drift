// Stub components - to be fully implemented

export default function ServerList({ servers, selectedServer, onServerSelect, loading }: any) {
  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4">Game Servers</h2>
      {loading ? (
        <p className="text-text-secondary">Loading servers...</p>
      ) : (
        <div className="space-y-2">
          {servers.map((server: any) => (
            <div
              key={server.id}
              onClick={() => onServerSelect(server)}
              className={`p-4 rounded-lg cursor-pointer transition-colors ${
                selectedServer?.id === server.id
                  ? 'bg-primary/20 border border-primary'
                  : 'bg-surface-light hover:bg-surface-light/80'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">{server.name}</h3>
                  <p className="text-sm text-text-secondary">
                    {server.players}/{server.maxPlayers} players
                  </p>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    server.status === 'running'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-600 text-white'
                  }`}
                >
                  {server.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
