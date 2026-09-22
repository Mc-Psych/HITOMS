import express from "express";
import http from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  const PORT = 3000;
  const server = http.createServer(app);

  // Initialize Gemini API client on the server side
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", app: "HITOMS Server", timestamp: new Date().toISOString() });
  });

  // AI Ticket Triage Endpoint
  app.post("/api/ai/triage", async (req, res) => {
    try {
      const { title, description, category, department, location, assetTag } = req.body;

      if (!title && !description) {
        return res.status(400).json({ error: "Title or description is required for AI triage." });
      }

      const prompt = `Analyze this hospital IT helpdesk ticket and perform automated triage for hospital operations:
Title: ${title || "N/A"}
Description: ${description || "N/A"}
Current Category: ${category || "Unknown"}
Department: ${department || "General Hospital"}
Location: ${location || "Unspecified"}
Linked Asset Tag: ${assetTag || "None"}

Evaluate clinical patient care impact, operational risk, recommended priority level (Critical, High, Medium, Low), suggested IT category, technical root cause hypothesis, and actionable immediate troubleshooting steps for hospital IT staff.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are an expert Hospital IT Operations AI Triage Specialist. Analyze tickets accurately with focus on clinical risk, patient care workflows, and medical hardware.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recommendedPriority: {
                type: Type.STRING,
                description: "Must be one of: Critical, High, Medium, Low",
              },
              patientCareImpact: {
                type: Type.STRING,
                description: "Clinical patient care risk assessment (1-2 sentences)",
              },
              suggestedCategory: {
                type: Type.STRING,
                description: "Suggested IT category: Hardware, Software, Network, Internet, Printer, Server, Hospital System, Email, Security, Account/Login, Other",
              },
              rootCauseHypothesis: {
                type: Type.STRING,
                description: "Likely technical cause hypothesis",
              },
              immediateActionSteps: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of 3-4 immediate troubleshooting steps for hospital IT engineers",
              },
              riskSummary: {
                type: Type.STRING,
                description: "Executive operational risk summary",
              },
            },
            required: [
              "recommendedPriority",
              "patientCareImpact",
              "suggestedCategory",
              "rootCauseHypothesis",
              "immediateActionSteps",
              "riskSummary",
            ],
          },
        },
      });

      const triageData = JSON.parse(response.text || "{}");
      return res.json({ success: true, triage: triageData });
    } catch (err: any) {
      console.error("[HITOMS Server] AI Triage error:", err);

      // Intelligent fallback logic if API key is missing or offline
      const deptUpper = (req.body.department || "").toUpperCase();
      const descUpper = (req.body.description || "").toUpperCase();
      const isCriticalDept = deptUpper.includes("ICU") || deptUpper.includes("ER") || deptUpper.includes("OT") || deptUpper.includes("EMERGENCY") || deptUpper.includes("CARDIAC");
      const isCriticalHardware = descUpper.includes("MONITOR") || descUpper.includes("VENTILATOR") || descUpper.includes("PACS") || descUpper.includes("EMR") || descUpper.includes("NETWORK DOWN");

      const fallbackPriority = isCriticalDept || isCriticalHardware ? "Critical" : "Medium";

      return res.json({
        success: true,
        isFallback: true,
        triage: {
          recommendedPriority: fallbackPriority,
          patientCareImpact: isCriticalDept ? "Direct potential impact on critical patient care unit." : "Standard administrative IT workflow impact.",
          suggestedCategory: req.body.category || "Hardware",
          rootCauseHypothesis: "Rule-based offline triage analysis applied.",
          immediateActionSteps: [
            "Check physical hardware power and connectivity status.",
            "Verify IP configuration and test ping to department gateway switch.",
            "Check for recent software/EMR patch updates or login token expiry.",
            "Escalate to Lead IT On-Call Engineer if clinical workflow is affected.",
          ],
          riskSummary: "Maintain active communication with clinical ward staff during troubleshooting.",
        },
      });
    }
  });

  // AI Memos & Formal Hospital Reports Write-Up Endpoint
  app.post("/api/ai/memo-report", async (req, res) => {
    try {
      const {
        memoType = "EXECUTIVE_IT_MEMO",
        topic,
        targetAudience,
        department = "Hospital IT Department",
        rawNotes,
        tone = "FORMAL",
        hospitalName = "St. Mary Theresa Catholic Hospital",
        senderName = "Courage Kay",
        senderTitle = "Lead IT Systems Administrator",
        refineInstruction,
        existingDraft,
        liveStats,
      } = req.body;

      if (!topic && !rawNotes && !refineInstruction) {
        return res.status(400).json({ error: "A topic, bullet notes, or refine instruction is required for AI write-up." });
      }

      const prompt = `You are the Senior Hospital Information Technology & Clinical Systems Communications Specialist for ${hospitalName}.
Write a formal, comprehensive, professional Hospital Memorandum or Executive Operational Report based on the following specifications:

Document Type: ${memoType}
Topic / Purpose: ${topic || "Hospital IT Operations Update"}
Department: ${department}
Target Audience / Recipients: ${targetAudience || "All Clinical Heads of Department, Nursing Supervisors, and Medical Directorate"}
Author / Sender: ${senderName} (${senderTitle})
Tone: ${tone}
User Notes / Bullet Points:
${rawNotes || "Provide standard formal hospital memorandum structure."}

${refineInstruction ? `Specific Refinement or Adjustment Request: ${refineInstruction}` : ""}
${existingDraft ? `Existing Draft to Polish / Enhance: ${JSON.stringify(existingDraft)}` : ""}
${liveStats ? `Live Hospital Data Context: Open Helpdesk Tickets: ${liveStats.openTickets || 0}, Active Major Incidents: ${liveStats.criticalIncidents || 0}, Current SLA Compliance: ${liveStats.slaCompliance || "98.2%"}, Scheduled Maintenance: ${liveStats.activeMaintenance || 0}` : ""}

Ensure the output is written in authoritative, crisp, healthcare-grade English suitable for hospital boards, clinical nursing wards, and technical IT staff.
Include thorough, practical steps, clinical safety precautions, operational timelines, and designated IT escalation channels.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          systemInstruction: `You are an elite Hospital Executive Memo & Technical Report Writer. 
Produce structured, actionable, and formatted hospital memorandums. 
Always return clean JSON complying with the schema.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              memoNumber: {
                type: Type.STRING,
                description: "Official memo reference number, e.g. MEMO-2026-042",
              },
              title: {
                type: Type.STRING,
                description: "Formal capitalized memorandum subject title",
              },
              memoType: {
                type: Type.STRING,
                description: "The memo type classification",
              },
              targetAudience: {
                type: Type.STRING,
                description: "Specific hospital recipients and departments",
              },
              executiveSummary: {
                type: Type.STRING,
                description: "Crisp 2-3 sentence executive summary for executive directors and clinical in-charges",
              },
              backgroundAndContext: {
                type: Type.STRING,
                description: "Clear explanation of the rationale, operational problem, or regulatory mandate",
              },
              detailedFindingsOrBody: {
                type: Type.STRING,
                description: "Comprehensive body text formatted with markdown sections (###), clear technical or clinical details, precautions, and workflows",
              },
              actionRequiredOrChecklist: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Numbered or bulleted list of mandatory action items required from recipients",
              },
              timelineOrDeadline: {
                type: Type.STRING,
                description: "Operational execution window, downtime schedule, or compliance deadline",
              },
              contactPersonOrExtension: {
                type: Type.STRING,
                description: "Designated IT contact person, extension number, and emergency on-call contact",
              },
              recommendedDistribution: {
                type: Type.STRING,
                description: "Recommended channels (e.g. Ward Noticeboards, Department Email, Morning Clinical Briefing)",
              },
            },
            required: [
              "memoNumber",
              "title",
              "memoType",
              "targetAudience",
              "executiveSummary",
              "backgroundAndContext",
              "detailedFindingsOrBody",
              "actionRequiredOrChecklist",
              "timelineOrDeadline",
              "contactPersonOrExtension",
              "recommendedDistribution",
            ],
          },
        },
      });

      const memoData = JSON.parse(response.text || "{}");
      return res.json({ success: true, memo: memoData, isFallback: false });
    } catch (err: any) {
      console.error("[HITOMS Server] AI Memo Write-Up error:", err);

      // Intelligent Offline Fallback Generator
      const currentYear = new Date().getFullYear();
      const randNum = Math.floor(100 + Math.random() * 900);
      const memoType = req.body.memoType || "EXECUTIVE_IT_MEMO";
      const topic = req.body.topic || "Hospital IT Infrastructure & Systems Operational Notice";
      const rawNotes = req.body.rawNotes || "";
      const hospitalName = req.body.hospitalName || "St. Mary Theresa Catholic Hospital";
      const senderName = req.body.senderName || "Courage Kay";
      const senderTitle = req.body.senderTitle || "Super Administrator & Head of IT";

      return res.json({
        success: true,
        isFallback: true,
        memo: {
          memoNumber: `MEMO-${currentYear}-${randNum}`,
          title: `INTERNAL MEMORANDUM: ${topic.toUpperCase()}`,
          memoType: memoType,
          targetAudience: req.body.targetAudience || "All Clinical Wards, Department Heads, and Hospital Management Directorate",
          executiveSummary: `This memorandum serves as official operational guidance from the ${hospitalName} IT Department regarding ${topic}. All clinical and administrative staff are required to review the technical advisories and implement the specified operational steps.`,
          backgroundAndContext: `In accordance with hospital accreditation standards and ongoing IT operational modernization, the IT Department is addressing critical system requirements. ${rawNotes ? `User Brief: ${rawNotes}. ` : ""}Continuous uptime of clinical workstations, electronic health records (LHIMS), and network integrity remains paramount to patient care safety.`,
          detailedFindingsOrBody: `### 1. Operational Overview
The IT Department has conducted a comprehensive assessment regarding **${topic}**. To ensure zero disruption to emergency care, inpatient wards, and outpatient clinics, standard hospital IT operating protocols are to be enforced.

### 2. Technical Scope & System Impact
- **Core Hospital Network:** Primary fiber and Starlink backup links remain monitored 24/7 by the Network Operations Center.
- **LHIMS EMR Workstations:** Clinical data entry must follow local offline caching protocols should any transient disconnect occur.
- **Hardware & Peripherals:** All ward barcode scanners, thermal prescription printers, and nursing station terminals are to remain connected to regulated UPS power lines.

### 3. Safety & Information Governance
All hospital personnel are reminded that patient health information (PHI) must never be extracted or transferred onto unauthorized USB devices. Any suspicious system alerts or login anomalies must immediately be reported to the IT Help Desk.`,
          actionRequiredOrChecklist: [
            "Clinical in-charges must brief ward staff during morning and evening shift handovers.",
            "Verify all critical departmental computer terminals are properly plugged into designated IT backup power sockets.",
            "In case of temporary LHIMS downtime, initiate local paper-based clinical encounter forms as per Hospital Emergency Protocol.",
            "Report any persistent hardware or connectivity errors to the HITOMS Helpdesk ticket portal.",
          ],
          timelineOrDeadline: "Effective immediately upon receipt; mandatory compliance across all 24/7 clinical units.",
          contactPersonOrExtension: `${senderName} (${senderTitle}) | IT Helpdesk Extension: 2101 / On-Call: 2109`,
          recommendedDistribution: "Circulate to All Clinical Department Heads, Ward In-Charges, Pharmacy Lead, Laboratory Supervisor, and Inpatient Noticeboards",
        },
      });
    }
  });

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server,
          clientPort: 443,
        },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`HITOMS Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
