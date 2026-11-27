import { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  /** Receives raw definition JSON pushed by the MCP session bridge. */
  onDefinitionReceived: (def: unknown) => void;
};

type Status = 'disconnected' | 'connecting' | 'connected' | 'error';

const STATUS_TEXT: Record<Status, string> = {
  disconnected: 'Not connected',
  connecting: 'Connecting…',
  connected: 'Connected',
  error: 'Connection failed',
};

/** Subscribes to an MCP server's live session (Server-Sent Events). */
export function LiveSession({ onDefinitionReceived }: Props) {
  const [url, setUrl] = useState('http://localhost:3001');
  const [status, setStatus] = useState<Status>('disconnected');
  const [sessionName, setSessionName] = useState('');
  const source = useRef<EventSource | null>(null);

  const close = useCallback(() => {
    source.current?.close();
    source.current = null;
  }, []);

  const connect = useCallback(() => {
    close();
    setStatus('connecting');
    const es = new EventSource(`${url}/session/events`);
    source.current = es;
    es.onopen = () => setStatus('connected');
    es.onmessage = e => {
      try {
        const def = JSON.parse(e.data) as { name?: string; system?: { bodies?: unknown[] } };
        setSessionName(def.name ?? '');
        if (def.system?.bodies?.length) onDefinitionReceived(def);
      } catch {
        // ignore malformed events
      }
    };
    es.onerror = () => { setStatus('error'); close(); };
  }, [url, onDefinitionReceived, close]);

  useEffect(() => close, [close]);

  return (
    <details className="live-session">
      <summary>
        <span className={`status-dot status-${status}`} aria-hidden />
        Live MCP session
        <span className="muted">{status === 'connected' && sessionName ? `“${sessionName}”` : STATUS_TEXT[status]}</span>
      </summary>
      <div className="row">
        {status === 'connected' ? (
          <button className="btn" onClick={() => { close(); setStatus('disconnected'); setSessionName(''); }}>Disconnect</button>
        ) : (
          <>
            <input type="text" aria-label="MCP server URL" value={url} onChange={e => setUrl(e.target.value)} />
            <button className="btn btn-primary" onClick={connect} disabled={status === 'connecting'}>
              {status === 'error' ? 'Retry' : 'Connect'}
            </button>
          </>
        )}
      </div>
      <p className="field-hint">Start the server with <code>node mcp-server/dist/index.js</code>; every agent edit appears here.</p>
    </details>
  );
}
