import { useState, useEffect, useRef, useCallback } from 'react';
import type { DemoDefinition } from '../schema';

interface Props {
  onDefinitionReceived: (def: DemoDefinition) => void;
}

type Status = 'disconnected' | 'connecting' | 'connected' | 'error';

export function LiveSession({ onDefinitionReceived }: Props) {
  const [url, setUrl] = useState('http://localhost:3001');
  const [status, setStatus] = useState<Status>('disconnected');
  const [sessionName, setSessionName] = useState<string>('');
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setStatus('connecting');
    const es = new EventSource(`${url}/session/events`);
    esRef.current = es;

    es.onopen = () => setStatus('connected');

    es.onmessage = (e) => {
      try {
        const def = JSON.parse(e.data) as Partial<DemoDefinition>;
        if (def?.system?.bodies?.length) {
          setSessionName(def.name ?? '');
          onDefinitionReceived(def as DemoDefinition);
        } else {
          setSessionName(def.name ?? '');
        }
      } catch {
        // ignore malformed events
      }
    };

    es.onerror = () => {
      setStatus('error');
      esRef.current = null;
      es.close();
    };
  }, [url, onDefinitionReceived]);

  const disconnect = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setStatus('disconnected');
    setSessionName('');
  }, []);

  useEffect(() => () => { esRef.current?.close(); }, []);

  const statusColor: Record<Status, string> = {
    disconnected: '#888',
    connecting: '#f0a500',
    connected: '#22c55e',
    error: '#ef4444',
  };

  return (
    <div className="live-session-panel">
      <div className="live-session-header">
        <span
          className="live-session-dot"
          style={{ color: statusColor[status] }}
          title={status}
        >●</span>
        <span className="live-session-title">Live MCP Session</span>
      </div>
      {status !== 'connected' ? (
        <div className="live-session-connect">
          <input
            className="live-session-url"
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="http://localhost:3001"
          />
          <button
            className="live-session-btn"
            onClick={connect}
            disabled={status === 'connecting'}
          >
            {status === 'connecting' ? 'Connecting…' : status === 'error' ? 'Retry' : 'Connect'}
          </button>
        </div>
      ) : (
        <div className="live-session-active">
          <span className="live-session-name">
            {sessionName ? `"${sessionName}"` : 'Session active'}
          </span>
          <button className="live-session-btn live-session-btn--disconnect" onClick={disconnect}>
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
