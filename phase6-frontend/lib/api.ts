import axios from 'axios';
import { PredictionRequest, PredictionResponse, AnalysisResponse, HealthResponse } from '@/types';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://argus-backend-kbg6.onrender.com/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15_000,
});

export const healthCheck = async (): Promise<HealthResponse> => {
  const response = await api.get('/health');
  return response.data;
};

export const predict = async (data: PredictionRequest): Promise<PredictionResponse> => {
  const response = await api.post('/predict', data);
  return response.data;
};

export const analyze = async (features: PredictionRequest['features']): Promise<AnalysisResponse> => {
  const response = await api.post('/analyze', features);
  return response.data;
};

export interface RecentResponse {
  packets: AnalysisResponse[];
  returned: number;
  buffer_size: number;
  next_since: string | null;
  server_time: string;
}

/**
 * HTTP fallback for live packet delivery — short-polled by LiveStream.
 * Returns all packets buffered by the backend since `since` (ISO timestamp),
 * or up to `limit` most recent if `since` is omitted.
 */
export const getRecentPackets = async (
  since?: string | null,
  limit: number = 100,
): Promise<RecentResponse> => {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (since) params.set('since', since);
  const response = await api.get(`/recent?${params.toString()}`);
  return response.data as RecentResponse;
};

export default api;
