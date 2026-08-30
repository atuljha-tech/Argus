export interface PredictionRequest {
  features: {
    src_port: number;
    dst_port: number;
    protocol: number;
    length: number;
  };
}

export interface PredictionResponse {
  prediction: number;
  attack_type: string;
  confidence: number;
  risk_level: string;
  timestamp: string;
}

export interface AnalysisResponse {
  prediction: number;
  attack_type: string;
  confidence: number;
  risk_level: string;
  features: {
    src_port: number;
    dst_port: number;
    protocol: number;
    length: number;
  };
  timestamp: string;
  recommendations: string[];
}

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
  version: string;
}
