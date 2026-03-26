import { useCallback, useEffect, useRef, useState } from 'react';

export interface RealtimeRecord {
  type: string;
  index: number;
  is_attack: boolean;
  attack_type: string;
  anomaly_score: number;
  confidence: number;
  timestamp: string;
  src_ip?: string;
  dst_ip?: string;
  src_port?: number;
  dst_port?: number;
  protocol?: string;
  dst_label?: string;
  process?: string;
}

export interface ScenarioEvent {
  scenario: string;
  title: string;
  description: string;
  total?: number;
  attacks?: number;
}

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [records, setRecords] = useState<RealtimeRecord[]>([]);
  const [status, setStatus] = useState('Отключено');
  const [running, setRunning] = useState(false);
  const [scenario, setScenario] = useState<ScenarioEvent | null>(null);
  const [completed, setCompleted] = useState<ScenarioEvent | null>(null);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws/realtime`);

    socket.onopen = () => {
      setConnected(true);
      setStatus('Подключено к серверу');
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'prediction') {
        setRecords(prev => [data, ...prev].slice(0, 1000));
      } else if (data.type === 'scenario_start') {
        setScenario(data);
        setCompleted(null);
        setStatus(data.message);
      } else if (data.type === 'scenario_complete') {
        setCompleted(data);
        setRunning(false);
        setStatus(data.message);
      } else if (data.type === 'status') {
        setStatus(data.message);
        if (data.message.includes('остановлен')) {
          setRunning(false);
        }
      } else if (data.type === 'error') {
        setStatus(`Ошибка: ${data.message}`);
        setRunning(false);
      }
    };

    socket.onclose = () => {
      setConnected(false);
      setRunning(false);
      setStatus('Отключено');
    };

    ws.current = socket;
  }, []);

  const runScenario = useCallback((name: string) => {
    if (ws.current?.readyState !== WebSocket.OPEN) return;
    setRecords([]);
    setRunning(true);
    setCompleted(null);
    if (name === 'live') {
      ws.current.send(JSON.stringify({ action: 'start_live' }));
    } else {
      ws.current.send(JSON.stringify({ action: 'run_scenario', scenario: name }));
    }
  }, []);

  const stop = useCallback(() => {
    if (ws.current?.readyState !== WebSocket.OPEN) return;
    ws.current.send(JSON.stringify({ action: 'stop' }));
    setRunning(false);
  }, []);

  const disconnect = useCallback(() => {
    ws.current?.close();
    ws.current = null;
  }, []);

  useEffect(() => {
    return () => { ws.current?.close(); };
  }, []);

  return {
    connected, records, status, running, scenario, completed,
    connect, runScenario, stop, disconnect,
  };
}
