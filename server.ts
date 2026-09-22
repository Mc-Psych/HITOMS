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
