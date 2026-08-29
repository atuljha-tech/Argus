use anyhow::{bail, Context, Result};
use byteorder::{BigEndian, LittleEndian, ByteOrder};
use std::fs::File;
use std::io::{BufReader, Read};
use std::net::{Ipv4Addr, Ipv6Addr};

use crate::types::{ConnectionInfo, PacketInfo, Report, SecurityAssessment};

pub enum Endianness {
    Big,
    Little,
}

pub struct IPsecParser {
    pub packets: Vec<PacketInfo>,
    pub ike_packets: Vec<PacketInfo>,
    pub esp_packets: Vec<PacketInfo>,
}

impl IPsecParser {
    pub fn new() -> Self {
        Self {
            packets: Vec::new(),
            ike_packets: Vec::new(),
            esp_packets: Vec::new(),
        }
    }

    pub fn parse_pcap(&mut self, pcap_path: &str) -> Result<Report> {
        println!("📄 Reading PCAP: {}", pcap_path);

        let file = File::open(pcap_path)
            .with_context(|| format!("Failed to open PCAP file: {}", pcap_path))?;
        let mut reader = BufReader::new(file);

        // Read Global Header (24 bytes)
        let mut global_hdr = [0u8; 24];
        if let Err(e) = reader.read_exact(&mut global_hdr) {
            bail!("Failed to read PCAP global header from {}: {}", pcap_path, e);
        }

        let (endianness, is_nanos) = match &global_hdr[0..4] {
            [0xa1, 0xb2, 0xc3, 0xd4] => (Endianness::Big, false),
            [0xd4, 0xc3, 0xb2, 0xa1] => (Endianness::Little, false),
            [0xa1, 0xb2, 0x3c, 0x4d] => (Endianness::Big, true),
            [0x4d, 0xc3, 0xb2, 0xa1] => (Endianness::Little, true),
            _ => bail!("Invalid PCAP magic number in {}: {:x?}", pcap_path, &global_hdr[0..4]),
        };

        let linktype = match endianness {
            Endianness::Big => BigEndian::read_u32(&global_hdr[20..24]),
            Endianness::Little => LittleEndian::read_u32(&global_hdr[20..24]),
        };

        let mut total_packets = 0;
        let mut ike_count = 0;
        let mut esp_count = 0;

        // Loop over packet records (16-byte record header each)
        let mut rec_hdr = [0u8; 16];
        while reader.read_exact(&mut rec_hdr).is_ok() {
            let (ts_sec, ts_usec, incl_len) = match endianness {
                Endianness::Big => (
                    BigEndian::read_u32(&rec_hdr[0..4]),
                    BigEndian::read_u32(&rec_hdr[4..8]),
                    BigEndian::read_u32(&rec_hdr[8..12]) as usize,
                ),
                Endianness::Little => (
                    LittleEndian::read_u32(&rec_hdr[0..4]),
                    LittleEndian::read_u32(&rec_hdr[4..8]),
                    LittleEndian::read_u32(&rec_hdr[8..12]) as usize,
                ),
            };

            let mut packet_buf = vec![0u8; incl_len];
            if reader.read_exact(&mut packet_buf).is_err() {
                break;
            }

            total_packets += 1;

            let timestamp = if is_nanos {
                ts_sec as f64 + (ts_usec as f64 / 1_000_000_000.0)
            } else {
                ts_sec as f64 + (ts_usec as f64 / 1_000_000.0)
            };

            // Parse Link Layer
            let ip_payload = match linktype {
                1 => {
                    // Ethernet II
                    if packet_buf.len() < 14 {
                        continue;
                    }
                    let ethertype = u16::from_be_bytes([packet_buf[12], packet_buf[13]]);
                    if ethertype == 0x8100 && packet_buf.len() >= 18 {
                        // VLAN Tagged
                        let inner_type = u16::from_be_bytes([packet_buf[16], packet_buf[17]]);
                        if inner_type == 0x0800 || inner_type == 0x86DD {
                            &packet_buf[18..]
                        } else {
                            continue;
                        }
                    } else if ethertype == 0x0800 || ethertype == 0x86DD {
                        &packet_buf[14..]
                    } else {
                        continue;
                    }
                }
                0 => {
                    // BSD loopback
                    if packet_buf.len() < 4 {
                        continue;
                    }
                    &packet_buf[4..]
                }
                101 => {
                    // Raw IP
                    &packet_buf[..]
                }
                113 => {
                    // Linux SLL
                    if packet_buf.len() < 16 {
                        continue;
                    }
                    &packet_buf[16..]
                }
                276 => {
                    // Linux SLL2
                    if packet_buf.len() < 20 {
                        continue;
                    }
                    &packet_buf[20..]
                }
                _ => &packet_buf[..],
            };

            if ip_payload.is_empty() {
                continue;
            }

            let version = (ip_payload[0] >> 4) & 0x0F;
            let (src_ip, dst_ip, protocol_num, transport_payload) = if version == 4 {
                if ip_payload.len() < 20 {
                    continue;
                }
                let ihl = ((ip_payload[0] & 0x0F) * 4) as usize;
                if ip_payload.len() < ihl {
                    continue;
                }
                let proto = ip_payload[9];
                let src = Ipv4Addr::new(ip_payload[12], ip_payload[13], ip_payload[14], ip_payload[15]).to_string();
                let dst = Ipv4Addr::new(ip_payload[16], ip_payload[17], ip_payload[18], ip_payload[19]).to_string();
                (src, dst, proto, &ip_payload[ihl..])
            } else if version == 6 {
                if ip_payload.len() < 40 {
                    continue;
                }
                let proto = ip_payload[6];
                let mut src_bytes = [0u8; 16];
                let mut dst_bytes = [0u8; 16];
                src_bytes.copy_from_slice(&ip_payload[8..24]);
                dst_bytes.copy_from_slice(&ip_payload[24..40]);
                let src = Ipv6Addr::from(src_bytes).to_string();
                let dst = Ipv6Addr::from(dst_bytes).to_string();
                (src, dst, proto, &ip_payload[40..])
            } else {
                continue;
            };

            let mut src_port = 0u16;
            let mut dst_port = 0u16;
            let is_udp = protocol_num == 17;
            let is_esp = protocol_num == 50;

            if is_udp && transport_payload.len() >= 8 {
                src_port = u16::from_be_bytes([transport_payload[0], transport_payload[1]]);
                dst_port = u16::from_be_bytes([transport_payload[2], transport_payload[3]]);
            }

            let is_ike = is_udp && (src_port == 500 || dst_port == 500 || src_port == 4500 || dst_port == 4500);

            let proto_str = if is_udp {
                "UDP".to_string()
            } else if is_esp {
                "ESP".to_string()
            } else if protocol_num == 6 {
                "TCP".to_string()
            } else {
                format!("PROTO_{}", protocol_num)
            };

            let pkt_info = PacketInfo {
                timestamp,
                src_ip,
                dst_ip,
                src_port,
                dst_port,
                protocol: proto_str,
                length: incl_len,
                data_hex: hex::encode(&packet_buf[..std::cmp::min(64, packet_buf.len())]),
            };

            self.packets.push(pkt_info.clone());

            if is_ike {
                ike_count += 1;
                self.ike_packets.push(pkt_info.clone());
            }

            if is_esp {
                esp_count += 1;
                self.esp_packets.push(pkt_info.clone());
            }
        }

        println!("📊 Total packets: {}", total_packets);
        println!("🔐 IKE packets: {}", ike_count);
        println!("🔒 ESP packets: {}", esp_count);

        let report = Report {
            file_name: pcap_path.to_string(),
            total_packets,
            ike_packets: ike_count,
            esp_packets: esp_count,
            connections: self.analyze_connections(),
            summary: self.generate_summary(),
        };

        Ok(report)
    }

    fn analyze_connections(&self) -> Vec<ConnectionInfo> {
        let mut connections = Vec::new();

        if self.ike_packets.is_empty() {
            return connections;
        }

        let conn = ConnectionInfo {
            connection_name: "VPN-1".to_string(),
            ike_version: "IKEv2".to_string(),
            encryption: self.detect_encryption(),
            authentication: self.detect_authentication(),
            dh_group: "DH-2048".to_string(),
            pfs_enabled: self.detect_pfs(),
            security_assessment: self.create_assessment(),
        };

        connections.push(conn);
        connections
    }

    fn detect_encryption(&self) -> String {
        let data: Vec<u8> = self.ike_packets.iter()
            .flat_map(|p| hex::decode(&p.data_hex).unwrap_or_default())
            .collect();

        let data_str = String::from_utf8_lossy(&data);

        if data_str.contains("AES256") || data_str.contains("AES-256") {
            "AES-256-GCM".to_string()
        } else if data_str.contains("AES128") || data_str.contains("AES-128") {
            "AES-128-CBC".to_string()
        } else if data_str.contains("3DES") {
            "3DES".to_string()
        } else {
            "Unknown".to_string()
        }
    }

    fn detect_authentication(&self) -> String {
        let data: Vec<u8> = self.ike_packets.iter()
            .flat_map(|p| hex::decode(&p.data_hex).unwrap_or_default())
            .collect();

        let data_str = String::from_utf8_lossy(&data);

        if data_str.contains("SHA256") {
            "SHA-256".to_string()
        } else if data_str.contains("SHA1") {
            "SHA-1".to_string()
        } else if data_str.contains("MD5") {
            "MD5".to_string()
        } else {
            "Unknown".to_string()
        }
    }

    fn detect_pfs(&self) -> bool {
        let data: Vec<u8> = self.ike_packets.iter()
            .flat_map(|p| hex::decode(&p.data_hex).unwrap_or_default())
            .collect();

        let data_str = String::from_utf8_lossy(&data);
        data_str.contains("ECP") || data_str.contains("ECDH") || data_str.contains("PFS")
    }

    fn create_assessment(&self) -> SecurityAssessment {
        let encryption = self.detect_encryption();
        let auth = self.detect_authentication();
        let pfs = self.detect_pfs();
        let mut issues = Vec::new();
        let mut recommendations = Vec::new();
        let mut score = 100i32;

        if encryption == "3DES" || encryption == "DES" {
            score -= 30;
            issues.push("Weak encryption algorithm (3DES/DES) detected".to_string());
            recommendations.push("Upgrade to AES-256-GCM or AES-256-CBC".to_string());
        } else if encryption == "AES-128-CBC" {
            score -= 15;
            issues.push("AES-128-CBC is considered weak; use GCM mode".to_string());
            recommendations.push("Use AES-128-GCM or AES-256-GCM".to_string());
        } else if encryption == "AES-256-GCM" {
            // Good encryption
        } else {
            issues.push("Unknown encryption algorithm".to_string());
            recommendations.push("Configure explicit encryption algorithm".to_string());
        }

        if auth == "SHA-1" {
            score -= 10;
            issues.push("SHA-1 is considered weak for authentication".to_string());
            recommendations.push("Use SHA-256 or SHA-384".to_string());
        } else if auth == "MD5" {
            score -= 20;
            issues.push("MD5 is considered broken for authentication".to_string());
            recommendations.push("Use SHA-256 or SHA-384".to_string());
        }

        if !pfs {
            score -= 15;
            issues.push("Perfect Forward Secrecy (PFS) is not enabled".to_string());
            recommendations.push("Enable PFS using ECDH or DH groups".to_string());
        }

        SecurityAssessment {
            encryption_algorithm: encryption,
            authentication_algorithm: auth,
            key_exchange: if pfs { "ECDH (PFS enabled)".to_string() } else { "DH (PFS disabled)".to_string() },
            perfect_forward_secrecy: pfs,
            key_lifetime: "24h".to_string(),
            security_score: score.clamp(0, 100) as u8,
            issues,
            recommendations,
        }
    }

    fn generate_summary(&self) -> String {
        if self.ike_packets.is_empty() {
            return "No IKE packets found. VPN traffic may not be present.".to_string();
        }

        let encryption = self.detect_encryption();
        let pfs = self.detect_pfs();
        let auth = self.detect_authentication();

        format!(
            "VPN Analysis: {} encryption, {} authentication, PFS: {}",
            encryption,
            auth,
            if pfs { "Enabled ✅" } else { "Disabled ❌" }
        )
    }
}
