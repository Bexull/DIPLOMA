const BASE = import.meta.env.VITE_API_URL || '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Ошибка сервера');
  }
  return res.json();
}

export interface FeatureContribution {
  feature: string;
  value: number;
  normal_mean: number;
  deviation: number;
}

export interface Prediction {
  is_attack: boolean;
  attack_type: string;
  anomaly_score: number;
  confidence: number;
  confidence_type?: string;
  threshold?: number;
  top_features?: FeatureContribution[];
}

export interface AnalysisResponse {
  analysis_id: number;
  filename: string;
  total_records: number;
  attacks_found: number;
  attack_percentage: number;
  predictions: Prediction[];
}

export interface AnalysisSummary {
  id: number;
  filename: string;
  timestamp: string;
  total_records: number;
  attacks_found: number;
  attack_percentage: number;
  model_used: string;
}

export interface Stats {
  total_analyses: number;
  total_records_analyzed: number;
  total_attacks_found: number;
  attack_percentage: number;
  attack_distribution: Record<string, number>;
}

export interface ModelMetrics {
  accuracy: number;
  precision?: number;
  precision_score?: number;
  recall: number;
  f1_weighted?: number;
  f1?: number;
  f1_macro?: number;
  roc_auc: number | null;
}

export interface ModelInfo {
  model_name?: string;
  metrics: ModelMetrics;
  type: string;
  confusion_matrix?: number[][];
}

export async function analyzeFile(file: File, maxRecords = 10000): Promise<AnalysisResponse> {
  const form = new FormData();
  form.append('file', file);
  return request<AnalysisResponse>(`/analyze?max_records=${maxRecords}`, {
    method: 'POST',
    body: form,
  });
}

export async function getModels(): Promise<{ models: Record<string, ModelInfo> | ModelInfo[]; source: string }> {
  return request('/models');
}

export async function getHistory(limit = 50): Promise<{ analyses: AnalysisSummary[]; total: number }> {
  return request(`/history?limit=${limit}`);
}

export async function getStats(): Promise<Stats> {
  return request('/stats');
}

export async function getHealth(): Promise<{ status: string; pipeline_loaded: boolean }> {
  return request('/health');
}

/* ── URL Analysis ─────────────────────────────────────── */

export interface SecurityHeader {
  name: string;
  present: boolean;
  value: string | null;
  severity: string;
  description: string;
}

export interface ConnectionInfo {
  ip: string;
  port: number;
  protocol: string;
  response_time_ms: number;
  status_code: number;
  content_length: number;
  redirect_count: number;
  ssl_valid: boolean | null;
  ssl_issuer: string | null;
  ssl_expiry: string | null;
}

export interface ScoreBreakdown {
  ssl_tls: number;
  headers: number;
  url_domain: number;
  content_behavior: number;
  threat_intel: number;
}

export interface VTInfo {
  available: boolean;
  malicious: number;
  suspicious: number;
  harmless: number;
  undetected: number;
  total_engines: number;
  reputation: number;
  error: string | null;
}

export interface ThreatIntelResult {
  found: boolean;
  matches: { source: string; indicator: string; threat_type: string; details: string }[];
  feeds_loaded: number;
  virustotal: VTInfo | null;
}

export interface URLAnalysisResponse {
  url: string;
  domain: string;
  connection: ConnectionInfo;
  security_headers: SecurityHeader[];
  security_score: number;
  score_breakdown: ScoreBreakdown;
  threat_intel: ThreatIntelResult;
  risk_level: string;
  recommendations: string[];
  timestamp: string;
}

export async function analyzeUrl(url: string): Promise<URLAnalysisResponse> {
  return request<URLAnalysisResponse>('/analyze-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
}
