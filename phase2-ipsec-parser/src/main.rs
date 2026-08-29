mod types;
mod parser;

use std::path::Path;
use std::fs;
use clap::Parser;
use serde_json;
use parser::IPsecParser;

#[derive(Parser, Debug)]
#[command(name = "ipsec-parser")]
#[command(about = "IPsec VPN Security Assessment Tool", version = "0.1.0")]
struct Args {
    /// Path to PCAP file to analyze
    #[arg(short, long)]
    input: String,

    /// Output directory for report
    #[arg(short, long, default_value = "./output")]
    output: String,

    /// Enable debug output
    #[arg(short, long)]
    debug: bool,
}

fn main() -> anyhow::Result<()> {
    let args = Args::parse();

    println!("{}", "=".repeat(60));
    println!("  🔐 IPsec VPN Security Assessment Tool");
    println!("  SIH26160 - Phase 2");
    println!("{}", "=".repeat(60));

    // Check if input file exists
    let input_path = Path::new(&args.input);
    if !input_path.exists() {
        eprintln!("❌ Input file not found: {}", args.input);
        eprintln!("   Please provide a valid PCAP file.");
        eprintln!("   Example: ./ipsec-parser --input ../phase1-vpn-testbed/capture/pcap_store/vpn_traffic.pcap");
        std::process::exit(1);
    }

    // Create output directory
    let output_path = Path::new(&args.output);
    if !output_path.exists() {
        fs::create_dir_all(output_path)?;
        println!("📁 Created output directory: {}", args.output);
    }

    // Initialize parser
    let mut parser = IPsecParser::new();

    // Parse PCAP
    let report = parser.parse_pcap(&args.input)?;

    // Save report as JSON
    let report_path = output_path.join("security_report.json");
    let json = serde_json::to_string_pretty(&report)?;
    fs::write(&report_path, json)?;
    println!("📄 Report saved to: {}", report_path.display());

    // Also save as human-readable text
    let txt_path = output_path.join("security_report.txt");
    let mut txt_content = String::new();

    txt_content.push_str(&"=".repeat(60));
    txt_content.push_str("\n");
    txt_content.push_str(&format!("📄 File: {}\n", report.file_name));
    txt_content.push_str(&format!("📊 Total packets: {}\n", report.total_packets));
    txt_content.push_str(&format!("🔐 IKE packets: {}\n", report.ike_packets));
    txt_content.push_str(&format!("🔒 ESP packets: {}\n", report.esp_packets));
    txt_content.push_str("\n");
    txt_content.push_str("📋 Summary:\n");
    txt_content.push_str(&format!("   {}\n", report.summary));
    txt_content.push_str("\n");
    txt_content.push_str(&"=".repeat(60));
    txt_content.push_str("\n");
    txt_content.push_str("🔒 CONNECTION DETAILS\n");
    txt_content.push_str(&"=".repeat(60));
    txt_content.push_str("\n");

    for conn in &report.connections {
        txt_content.push_str(&format!("\n🔗 Connection: {}\n", conn.connection_name));
        txt_content.push_str(&format!("   IKE Version: {}\n", conn.ike_version));
        txt_content.push_str(&format!("   Encryption: {}\n", conn.encryption));
        txt_content.push_str(&format!("   Authentication: {}\n", conn.authentication));
        txt_content.push_str(&format!("   DH Group: {}\n", conn.dh_group));
        txt_content.push_str(&format!("   PFS Enabled: {}\n", conn.pfs_enabled));

        txt_content.push_str("\n   🛡️ SECURITY ASSESSMENT:\n");
        let sa = &conn.security_assessment;
        txt_content.push_str(&format!("      Security Score: {}/100\n", sa.security_score));
        txt_content.push_str(&format!("      Encryption: {}\n", sa.encryption_algorithm));
        txt_content.push_str(&format!("      Authentication: {}\n", sa.authentication_algorithm));

        if !sa.issues.is_empty() {
            txt_content.push_str("      ⚠️ Issues:\n");
            for issue in &sa.issues {
                txt_content.push_str(&format!("         - {}\n", issue));
            }
        }

        if !sa.recommendations.is_empty() {
            txt_content.push_str("      💡 Recommendations:\n");
            for rec in &sa.recommendations {
                txt_content.push_str(&format!("         - {}\n", rec));
            }
        }
    }

    txt_content.push_str("\n");
    txt_content.push_str(&"=".repeat(60));
    txt_content.push_str("\n");
    txt_content.push_str("✅ Analysis complete!\n");

    fs::write(&txt_path, txt_content)?;
    println!("📄 Human-readable report saved to: {}", txt_path.display());

    // Print summary to console
    println!("\n📊 SUMMARY:");
    println!("   {}", report.summary);
    if let Some(conn) = report.connections.first() {
        println!("   🔒 Security Score: {}/100", conn.security_assessment.security_score);
        if !conn.security_assessment.issues.is_empty() {
            println!("   ⚠️ Issues found: {}", conn.security_assessment.issues.len());
        }
    }

    println!("\n✅ Phase 2 Complete!");

    Ok(())
}
