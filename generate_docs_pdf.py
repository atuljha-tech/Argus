import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        # Top banner line
        self.setStrokeColor(colors.HexColor('#00ff87'))
        self.setLineWidth(1.5)
        self.line(36, 762, 576, 762)

        # Header Text
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor('#1e293b'))
        self.drawString(36, 768, "ARGUS ENTERPRISE CYBER DEFENSE // SYSTEM DOCUMENTATION")
        
        # Footer
        self.setStrokeColor(colors.HexColor('#e2e8f0'))
        self.setLineWidth(0.5)
        self.line(36, 40, 576, 40)

        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor('#64748b'))
        self.drawString(36, 28, "CONFIDENTIAL & PROPRIETARY — ARGUS CYBER INTELLIGENCE SYSTEM")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(576, 28, page_str)
        self.restoreState()

def create_pdf(filename="ARGUS_Platform_Technical_Documentation.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=48,
        bottomMargin=48
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0f172a'),
        spaceAfter=4
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor('#059669'),
        spaceAfter=12
    )
    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=colors.HexColor('#0f172a'),
        spaceBefore=8,
        spaceAfter=4
    )
    body_style = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor('#334155'),
        spaceAfter=6
    )
    bold_body = ParagraphStyle(
        'BoldBody',
        parent=body_style,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#0f172a')
    )
    code_style = ParagraphStyle(
        'CodeStyle',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#0f172a')
    )

    story = []

    # ==================== PAGE 1 ====================
    story.append(Paragraph("ARGUS // Unified Cyber Defense Platform", title_style))
    story.append(Paragraph("TECHNICAL ARCHITECTURE, PHASE SPECIFICATIONS & DIRECTORY MAPPING", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#00ff87'), spaceAfter=10))

    # Executive Overview
    story.append(Paragraph("1. Executive System Overview", section_heading))
    overview_text = (
        "<b>ARGUS</b> is an integrated, high-assurance cybersecurity intelligence platform designed to evaluate IPsec VPN "
        "cryptographic configurations, detect security misconfigurations, and perform real-time machine learning inference "
        "to forecast network attack vectors before exploitation occurs. By unifying VPN configuration inspection with time-series "
        "packet anomaly detection, ARGUS provides security operations centers (SOCs) with unified posture scores and automated countermeasures."
    )
    story.append(Paragraph(overview_text, body_style))

    # System Architecture Summary
    story.append(Paragraph("2. Operational Architecture & End-to-End Flow", section_heading))
    arch_data = [
        [Paragraph("<b>Component Layer</b>", bold_body), Paragraph("<b>Technology Stack</b>", bold_body), Paragraph("<b>Primary Functionality</b>", bold_body)],
        [Paragraph("Phase 1: VPN Testbed", body_style), Paragraph("Docker, StrongSwan, tcpdump", body_style), Paragraph("Deploys IPsec VPN gateways & captures pcap traffic", body_style)],
        [Paragraph("Phase 2: Packet Parser", body_style), Paragraph("Rust (pcap-parser, nom)", body_style), Paragraph("Parses IKEv2/ESP headers & evaluates cipher security", body_style)],
        [Paragraph("Phase 3: Feature Engineering", body_style), Paragraph("Python 3, pandas, numpy", body_style), Paragraph("Extracts 4D feature vectors [src_port, dst_port, proto, len]", body_style)],
        [Paragraph("Phase 4: ML Models", body_style), Paragraph("scikit-learn, joblib", body_style), Paragraph("Trains DecisionTree classifier & saves serialized model", body_style)],
        [Paragraph("Phase 5: Backend API", body_style), Paragraph("FastAPI, uvicorn, Pydantic", body_style), Paragraph("REST API for real-time inference & security reports", body_style)],
        [Paragraph("Phase 6: Frontend SOC", body_style), Paragraph("Next.js 16, Tailwind, Recharts", body_style), Paragraph("Tactical black & white UI dashboard with live graphs", body_style)],
        [Paragraph("Phase 7: Orchestration", body_style), Paragraph("Docker Compose, Shell Scripts", body_style), Paragraph("One-click containerized deployment & automated tests", body_style)]
    ]
    t_arch = Table(arch_data, colWidths=[1.4*inch, 1.8*inch, 4.3*inch])
    t_arch.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_arch)
    story.append(Spacer(1, 8))

    # Phase 1 & 2 Breakdown
    story.append(Paragraph("3. Detailed Phase Breakdown — Phases 1 & 2", section_heading))
    p1_text = (
        "<b>Phase 1 — VPN Testbed & Capture (<code>phase1-vpn-testbed/</code>):</b><br/>"
        "Configures a containerized strongSwan IPsec gateway (IKEv2 with AES-256-GCM / SHA-256) inside Docker. Traffic generation scripts "
        "simulate benign VPN connections alongside adversarial traffic vectors (DDoS surges, port recon, and exploit probes). "
        "Raw packets are captured into PCAP files stored in <code>phase1-vpn-testbed/capture/pcap_store/</code>."
    )
    story.append(Paragraph(p1_text, body_style))

    p2_text = (
        "<b>Phase 2 — High-Performance IPsec Parser (<code>phase2-ipsec-parser/</code>):</b><br/>"
        "Written in Rust for microsecond-level throughput. Key files include <code>src/main.rs</code> (CLI entrypoint), "
        "<code>src/parser.rs</code> (zero-copy pcap binary header decoder), and <code>src/report.rs</code> (security score evaluator). "
        "Generates structured JSON security reports detailing encryption strength, DH group size, Perfect Forward Secrecy (PFS) state, "
        "and security scores (0-100)."
    )
    story.append(Paragraph(p2_text, body_style))

    story.append(PageBreak())

    # ==================== PAGE 2 ====================
    story.append(Paragraph("4. Detailed Phase Breakdown — Phases 3, 4 & 5", section_heading))

    p3_text = (
        "<b>Phase 3 — Feature Engineering (<code>phase3-feature-engineering/</code>):</b><br/>"
        "Converts parsed packet streams into normalized feature matrices ready for machine learning consumption. Main modules:<br/>"
        "• <code>src/data_labeler.py</code>: Reads PCAP/CSV captures, extracts 4 key network attributes (<code>src_port</code>, "
        "<code>dst_port</code>, <code>protocol</code>, <code>length</code>), and assigns ground-truth threat labels (0 = Normal, 1 = Suspicious).<br/>"
        "• Outputs clean dataset files into <code>data/synthetic_vpn_traffic.csv</code> for training."
    )
    story.append(Paragraph(p3_text, body_style))

    p4_text = (
        "<b>Phase 4 — Machine Learning Model Development (<code>phase4-ml-model/</code>):</b><br/>"
        "Trains and evaluates predictive classification algorithms to detect threat anomalies in network flows.<br/>"
        "• <code>src/train.py</code>: Ingests the feature dataset, performs StandardScaler normalization, trains a Decision Tree "
        "classifier, and outputs evaluation metrics (accuracy, precision, recall, confusion matrix).<br/>"
        "• Exported Model Artifacts: Serialized binaries <code>decision_tree.pkl</code> and <code>scaler.pkl</code> stored in "
        "<code>models/</code> directory."
    )
    story.append(Paragraph(p4_text, body_style))

    p5_text = (
        "<b>Phase 5 — REST API Backend (<code>phase5-backend/</code>):</b><br/>"
        "FastAPI microservice providing real-time REST inference and health monitoring.<br/>"
        "• <code>app/main.py</code>: Initializes FastAPI app, CORS middleware, and global exception handlers.<br/>"
        "• <code>app/routes.py</code>: Defines endpoints <code>/api/v1/health</code>, <code>/api/v1/predict</code>, and <code>/api/v1/analyze</code>.<br/>"
        "• <code>app/models.py</code>: Pydantic request/response schemas with namespace protection.<br/>"
        "• <code>app/utils.py</code>: Robust <code>ModelLoader</code> class for loading <code>decision_tree.pkl</code> and executing inferencing."
    )
    story.append(Paragraph(p5_text, body_style))

    # Backend Endpoints Table
    story.append(Paragraph("5. Backend REST API Endpoint Specification", section_heading))
    api_data = [
        [Paragraph("<b>Endpoint Route</b>", bold_body), Paragraph("<b>HTTP Method</b>", bold_body), Paragraph("<b>Payload / Parameters</b>", bold_body), Paragraph("<b>Description & Output</b>", bold_body)],
        [Paragraph("<code>/api/v1/health</code>", code_style), Paragraph("GET", body_style), Paragraph("None", body_style), Paragraph("Returns system health status & model load confirmation status", body_style)],
        [Paragraph("<code>/api/v1/predict</code>", code_style), Paragraph("POST", body_style), Paragraph("JSON: <code>{src_port, dst_port, protocol, length}</code>", code_style), Paragraph("Returns prediction class (0/1), attack type string & confidence score", body_style)],
        [Paragraph("<code>/api/v1/analyze</code>", code_style), Paragraph("POST", body_style), Paragraph("JSON: Feature key-value dictionary", code_style), Paragraph("Full telemetry report, risk level, confidence meter & recommendations", body_style)]
    ]
    t_api = Table(api_data, colWidths=[1.5*inch, 0.9*inch, 2.5*inch, 2.6*inch])
    t_api.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_api)
    story.append(Spacer(1, 10))

    # File Hierarchy Mapping Summary
    story.append(Paragraph("6. Project Workspace Directory Map", section_heading))
    tree_text = (
        "<code>"
        "unified-cyber-platform/<br/>"
        "├── phase1-vpn-testbed/          # Docker strongSwan IPsec VPN container & PCAP captures<br/>"
        "├── phase2-ipsec-parser/         # Rust binary packet parser & security scoring engine<br/>"
        "├── phase3-feature-engineering/  # Python feature extraction & dataset labeling<br/>"
        "├── phase4-ml-model/             # Decision Tree training & serialized model generation<br/>"
        "├── phase5-backend/              # FastAPI server (main.py, routes.py, models.py, utils.py)<br/>"
        "├── phase6-frontend/             # Next.js SOC Dashboard (app/page.tsx, components, Recharts)<br/>"
        "├── deploy.sh & demo.sh          # One-click deployment & automated verification scripts<br/>"
        "└── README.md                    # Project documentation & operational quick-start guide"
        "</code>"
    )
    story.append(Paragraph(tree_text, body_style))

    story.append(PageBreak())

    # ==================== PAGE 3 ====================
    story.append(Paragraph("7. Detailed Phase Breakdown — Phases 6 & 7", section_heading))

    p6_text = (
        "<b>Phase 6 — Frontend SOC Command Dashboard (<code>phase6-frontend/</code>):</b><br/>"
        "High-performance Next.js Turbopack web application crafted with a tactical black & white cybersecurity aesthetic, "
        "monospace font typography (JetBrains Mono), emerald green matrix status lights, and colorful Recharts analytics visualization.<br/>"
        "• <code>app/page.tsx</code>: Central command center dashboard integrating form inputs, security score gauge, and live charts.<br/>"
        "• <code>app/components/Navbar.tsx</code>: Header with live UTC telemetry clock, DecisionTree status pill, and active defense badge.<br/>"
        "• <code>app/components/PredictionForm.tsx</code>: Tactical input panel featuring 1-click test vector presets (Normal VPN, DDoS Flood, Port Recon, VPN Exploit).<br/>"
        "• <code>app/components/SecurityScore.tsx</code>: Animated SVG circular security score ring gauge & latency stats.<br/>"
        "• <code>app/components/ResultsDisplay.tsx</code>: Real-time inference report card displaying risk level, confidence percentage bar, and security recommendations.<br/>"
        "• <code>app/components/ThreatAnalytics.tsx</code>: Area trend stream & bar charts visualizing packet throughput and attack vector distributions."
    )
    story.append(Paragraph(p6_text, body_style))

    p7_text = (
        "<b>Phase 7 — Container Orchestration & Automated Testing (Root Scripts):</b><br/>"
        "• <code>deploy.sh</code>: One-click orchestration script that compiles Rust parser, installs backend dependencies, builds Next.js frontend, and launches uvicorn + dev servers.<br/>"
        "• <code>demo.sh</code>: Automated validation script executing sample API requests and outputting end-to-end verification metrics."
    )
    story.append(Paragraph(p7_text, body_style))

    # Machine Learning Performance & Metrics
    story.append(Paragraph("8. Machine Learning Model Benchmark", section_heading))
    ml_data = [
        [Paragraph("<b>Metric Name</b>", bold_body), Paragraph("<b>Value / Benchmark</b>", bold_body), Paragraph("<b>Operational Significance</b>", bold_body)],
        [Paragraph("Primary Classifier", body_style), Paragraph("Decision Tree (scikit-learn)", body_style), Paragraph("Provides deterministic, reproducible rule splits with zero latency", body_style)],
        [Paragraph("Inference Latency", body_style), Paragraph("&lt; 3.0 milliseconds", body_style), Paragraph("Enables real-time inline packet stream classification without lag", body_style)],
        [Paragraph("Feature Vector", body_style), Paragraph("4 Parameters (src, dst, proto, len)", body_style), Paragraph("Lightweight payload extraction compatible with eBPF and pcap", body_style)],
        [Paragraph("Target Classes", body_style), Paragraph("Normal (0) / Suspicious (1)", body_style), Paragraph("Immediate binary alert triggering for SOC automated response", body_style)]
    ]
    t_ml = Table(ml_data, colWidths=[1.8*inch, 2.2*inch, 3.5*inch])
    t_ml.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_ml)
    story.append(Spacer(1, 10))

    # Operating Instructions & Deployment Verification
    story.append(Paragraph("9. Quick Operating & Verification Guide", section_heading))
    guide_text = (
        "<b>1. Launch Backend API Server (Port 8000):</b><br/>"
        "<code>cd phase5-backend && python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000</code><br/><br/>"
        "<b>2. Launch Frontend SOC Dashboard (Port 3000):</b><br/>"
        "<code>cd phase6-frontend && npm run dev</code><br/><br/>"
        "<b>3. Access Dashboard & Execute Analysis:</b><br/>"
        "Navigate to <code>http://localhost:3000</code>. Select one of the quick test vector presets (e.g. <i>Normal VPN</i> or <i>DDoS Flood</i>) "
        "and click <b>EVALUATE_TRAFFIC_VECTOR</b>. The AI inference report and security gauge will update instantaneously."
    )
    story.append(Paragraph(guide_text, body_style))

    # Build Document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"✅ PDF successfully generated: {filename}")

if __name__ == '__main__':
    create_pdf()
