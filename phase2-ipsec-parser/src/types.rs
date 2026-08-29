use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PacketInfo {
    pub timestamp: f64,
    pub src_ip: String,
    pub dst_ip: String,
    pub src_port: u16,
    pub dst_port: u16,
    pub protocol: String,
    pub length: usize,
    pub data_hex: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityAssessment {
    pub encryption_algorithm: String,
    pub authentication_algorithm: String,
    pub key_exchange: String,
    pub perfect_forward_secrecy: bool,
    pub key_lifetime: String,
    pub security_score: u8,
    pub issues: Vec<String>,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionInfo {
    pub connection_name: String,
    pub ike_version: String,
    pub encryption: String,
    pub authentication: String,
    pub dh_group: String,
    pub pfs_enabled: bool,
    pub security_assessment: SecurityAssessment,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Report {
    pub file_name: String,
    pub total_packets: usize,
    pub ike_packets: usize,
    pub esp_packets: usize,
    pub connections: Vec<ConnectionInfo>,
    pub summary: String,
}
