import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
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

  // Helper for safe JSON extraction from Gemini responses
  const cleanJsonText = (raw: string | undefined): string => {
    if (!raw) return "{}";
    let text = raw.trim();
    if (text.startsWith("```json")) {
      text = text.slice(7);
    } else if (text.startsWith("```")) {
      text = text.slice(3);
    }
    if (text.endsWith("```")) {
      text = text.slice(0, -3);
    }
    return text.trim();
  };

  // Helper for resilient Gemini API execution with retry & fallback model
  const generateContentWithRetry = async (params: {
    contents: any;
    config?: any;
    primaryModel?: string;
    fallbackModel?: string;
    maxRetries?: number;
  }) => {
    const primaryModel = params.primaryModel || "gemini-3.8-flash";
    const fallbackModel = params.fallbackModel || "gemini-3.1-flash-lite";
    const maxRetries = params.maxRetries ?? 2;

    const modelsToTry = [primaryModel, fallbackModel];
    let lastError: any = null;

    for (const model of modelsToTry) {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: params.contents,
            config: params.config,
          });
          return response;
        } catch (err: any) {
          lastError = err;
          const status = err?.status || err?.code || err?.statusCode || "";
          const msg = (err?.message || "").toLowerCase();
          const isTemporary =
            status === 503 ||
            status === 429 ||
            status === 500 ||
            status === "UNAVAILABLE" ||
            msg.includes("503") ||
            msg.includes("high demand") ||
            msg.includes("unavailable") ||
            msg.includes("resource has been exhausted") ||
            msg.includes("overloaded") ||
            msg.includes("econnreset");

          if (isTemporary && attempt < maxRetries) {
            const delayMs = (attempt + 1) * 1200 + Math.floor(Math.random() * 600);
            console.warn(
              `[HITOMS Server] Gemini ${model} temporarily unavailable (attempt ${attempt + 1}/${maxRetries}). Retrying in ${delayMs}ms...`
            );
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            continue;
          }

          // If retries for primary model exhausted, warn and try secondary model
          console.warn(`[HITOMS Server] Gemini ${model} invocation attempt ${attempt + 1} did not succeed.`);
          break;
        }
      }
    }

    throw lastError;
  };

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

      const response = await generateContentWithRetry({
        primaryModel: "gemini-3.8-flash",
        fallbackModel: "gemini-3.1-flash-lite",
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

      const rawJson = cleanJsonText(response.text);
      const triageData = JSON.parse(rawJson || "{}");
      return res.json({ success: true, triage: triageData });
    } catch (err: any) {
      console.warn("[HITOMS Server] AI Triage switched to offline rule engine:", err?.message || err);

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

      const response = await generateContentWithRetry({
        primaryModel: "gemini-3.8-flash",
        fallbackModel: "gemini-3.1-flash-lite",
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

      const rawJson = cleanJsonText(response.text);
      const memoData = JSON.parse(rawJson || "{}");
      return res.json({ success: true, memo: memoData, isFallback: false });
    } catch (err: any) {
      console.warn("[HITOMS Server] AI Memo Write-Up switched to resilient offline generator:", err?.message || err);

      // Intelligent Offline Fallback Generator
      const currentYear = new Date().getFullYear();
      const randNum = Math.floor(100 + Math.random() * 900);
      const memoType = req.body.memoType || "EXECUTIVE_IT_MEMO";
      const topic = req.body.topic || "Hospital IT Infrastructure & Systems Operational Notice";
      const rawNotes = req.body.rawNotes || "";
      const hospitalName = req.body.hospitalName || "St. Mary Theresa Catholic Hospital";
      const senderName = req.body.senderName || "Super Administrator";
      const senderTitle = req.body.senderTitle || "Chief Information Officer & Super Administrator";

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

  // Dedicated AI Draft Body Endpoint based on Subject
  app.post("/api/ai/memo-draft-body", async (req, res) => {
    try {
      const {
        subject,
        recipient = "All Clinical & Administrative Staff",
        department = "Hospital Administration & IT",
        hospitalName = "St. Mary Theresa Catholic Hospital",
        senderName = "Super Administrator",
      } = req.body;

      if (!subject || !subject.trim()) {
        return res.status(400).json({ error: "Subject is required to draft memorandum body." });
      }

      const prompt = `You are the Lead Clinical Systems & Hospital Communications Executive at ${hospitalName}.
Write a formal, comprehensive, professional body for an official hospital memorandum based on this subject:
"${subject.trim()}"

Target Recipients: ${recipient}
Authoring Department: ${department}
Author: ${senderName}

Guidelines:
1. Tone: Authoritative, formal, polite, and clinical/executive healthcare standard.
2. Structure:
   - Concise executive introduction explaining the reason for this memorandum.
   - Core directives, operational impact, or clinical protocols formatted in clean paragraphs or bullet points.
   - Specific mandatory actions, compliance timelines, or department-level responsibilities.
   - Technical / emergency escalation channels and contacts.
3. Length: Professional, thorough (approximately 150 - 300 words).
4. Output: Return ONLY the drafted memorandum body text. Do not wrap in markdown quotes or preamble.`;

      const response = await generateContentWithRetry({
        primaryModel: "gemini-3.8-flash",
        fallbackModel: "gemini-3.1-flash-lite",
        contents: prompt,
        config: {
          systemInstruction: "You are an expert hospital executive communications specialist. Output only the memorandum body text.",
        },
      });

      const bodyText = response.text?.trim() || "";
      return res.json({ success: true, body: bodyText, isFallback: false });
    } catch (err: any) {
      console.warn("[HITOMS Server] AI Draft Body failed, using offline template:", err?.message || err);
      const subject = req.body.subject || "Hospital Operational Directive";
      const hospitalName = req.body.hospitalName || "St. Mary Theresa Catholic Hospital";
      const fallbackBody = `This memorandum serves as official operational guidance regarding **${subject}** across all departments of ${hospitalName}.

### 1. Purpose & Directives
In line with hospital quality assurance and patient care standards, all departmental heads, clinical supervisors, and administrative officers are instructed to implement the operational guidelines specified below with immediate effect.

### 2. Mandatory Departmental Action Items
- Review clinical workflows and verify all frontline ward terminals are operating normally.
- Coordinate with unit shift leaders to ensure uninterrupted shift handovers and patient record integrity.
- Promptly report any system, hardware, or logistical constraints to the IT & Operations Management helpdesk.

### 3. Compliance & Inquiries
Compliance with this directive is mandatory across all shifts. For technical support, clarification, or immediate escalation, please contact the IT Operations Center via Extension 2101 or the on-call supervisor.`;

      return res.json({ success: true, body: fallbackBody, isFallback: true });
    }
  });

  // Dedicated AI Refine & Polish Body Endpoint (corrects grammar, formal tone, strictly preserves concept)
  app.post("/api/ai/memo-refine-body", async (req, res) => {
    try {
      const { subject, body } = req.body;

      if (!body || !body.trim()) {
        return res.status(400).json({ error: "Body text is required to refine." });
      }

      const prompt = `You are a professional Hospital Executive Editor and Clinical Communications Specialist.
Your task is to refine, correct grammar, and polish the following hospital memorandum body into a more formal, authoritative, and professional tone.

CRITICAL CONSTRAINTS:
1. Do NOT change the concept, core message, factual details, instructions, numbers, names, or subject matter.
2. If there are tables (markdown format starting and ending with |), PRESERVE the table structure, column headers, and data rows intact.
3. Improve grammar, sentence flow, vocabulary, and executive healthcare formatting.
4. Keep the output grounded and practical for hospital staff.

Subject: "${subject || "Official Hospital Directive"}"

Original Body to Refine:
${body}

Output ONLY the refined body text without meta-commentary, introductory notes, or markdown wrappers.`;

      const response = await generateContentWithRetry({
        primaryModel: "gemini-3.8-flash",
        fallbackModel: "gemini-3.1-flash-lite",
        contents: prompt,
        config: {
          systemInstruction: "You are an executive editor. Polish grammar and tone while strictly preserving meaning, numbers, tables, and instructions. Output only the refined text.",
        },
      });

      const refinedText = response.text?.trim() || body;
      return res.json({ success: true, refinedBody: refinedText, isFallback: false });
    } catch (err: any) {
      console.warn("[HITOMS Server] AI Refine Body failed:", err?.message || err);
      return res.json({ success: true, refinedBody: req.body.body, isFallback: true });
    }
  });

  // Endpoint to persist live app preview data as default seed snapshot for GitHub commits
  app.post("/api/save-seed-data", (req, res) => {
    try {
      const payload = req.body;
      const seedFilePath = path.join(process.cwd(), "src", "data", "defaultSeedData.json");
      const dirPath = path.dirname(seedFilePath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      fs.writeFileSync(seedFilePath, JSON.stringify(payload, null, 2), "utf8");
      return res.json({ success: true, savedAt: new Date().toISOString() });
    } catch (err: any) {
      console.error("[HITOMS Server] Error writing defaultSeedData.json:", err);
      return res.status(500).json({ success: false, error: err?.message });
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
