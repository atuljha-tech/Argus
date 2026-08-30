import axios from 'axios';
import { PredictionRequest, PredictionResponse, AnalysisResponse, HealthResponse } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://argus-backend-kbg6.onrender.com/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
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

export default api;
