import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini Client
const geminiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (geminiKey) {
  ai = new GoogleGenAI({
    apiKey: geminiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
} else {
  console.warn("GEMINI_API_KEY environment variable is not set. Triage AI features will fail.");
}

// API Routes
app.post("/api/triage/analyze", async (req, res) => {
  try {
    const { symptoms, patientInfo } = req.body;
    
    if (!symptoms) {
      return res.status(400).json({ error: "Symptoms description is required" });
    }

    if (!ai) {
      return res.status(503).json({ 
        error: "AI service is currently unavailable. Please configure GEMINI_API_KEY in secrets." 
      });
    }

    const patientContext = patientInfo 
      ? `Patient Details: Age ${patientInfo.age || 'unknown'}, Gender ${patientInfo.gender || 'unknown'}, Medical History: ${patientInfo.history || 'none'}`
      : "Patient details: unknown";

    const prompt = `
      You are an expert clinical triage assistant. Analyze the following patient symptoms and determine the urgency level, most relevant medical department, clinical analysis, and immediate instructions.
      
      ${patientContext}
      Symptoms description: "${symptoms}"
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an automated triage bot for ClinicOS. Categorize symptoms precisely and provide safe, reassuring guidelines. Never provide final diagnoses, only triage classifications.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            urgency: {
              type: Type.STRING,
              description: "Triage urgency category. Must be exactly one of: 'critical' (immediate life threat), 'high' (urgent clinical care), 'medium' (semi-urgent or standard outpatient), 'low' (non-urgent, self-care)."
            },
            department: {
              type: Type.STRING,
              description: "The primary medical department suited for this care (e.g. Cardiology, Pediatrics, Internal Medicine, General Outpatient Clinic, Surgery)."
            },
            analysis: {
              type: Type.STRING,
              description: "A professional clinical analysis of the potential conditions or severity indicated by the symptoms."
            },
            instructions: {
              type: Type.STRING,
              description: "Clear and actionable next steps or immediate advice (e.g. 'Go to the nearest emergency room', 'Schedule an appointment', or 'Rest and monitor')."
            }
          },
          required: ["urgency", "department", "analysis", "instructions"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response text received from Gemini API");
    }

    const triageResult = JSON.parse(resultText.trim());
    return res.json(triageResult);
  } catch (error: any) {
    console.error("Triage analysis failed:", error);
    return res.status(500).json({ error: error?.message || "Internal server error during symptom analysis" });
  }
});

app.post("/api/doctor/consult-ai", async (req, res) => {
  try {
    const { action, patientData, clinicalSession } = req.body;

    if (!action) {
      return res.status(400).json({ error: "Action is required" });
    }

    if (!ai) {
      return res.status(503).json({ 
        error: "AI Clinical Assistant is offline. Please configure GEMINI_API_KEY in Secrets." 
      });
    }

    const patientContext = `
Patient Demographics:
- Name: ${patientData?.name || 'Unknown'}
- Age: ${patientData?.age || 'Unknown'}
- Gender: ${patientData?.gender || 'Unknown'}
- Blood Type: ${patientData?.bloodType || 'Unknown'}

Clinical Status:
- Allergies: ${Array.isArray(patientData?.allergies) ? patientData.allergies.join(', ') : patientData?.allergies || 'None'}
- Chronic Conditions: ${Array.isArray(patientData?.chronicConditions) ? patientData.chronicConditions.join(', ') : patientData?.chronicConditions || 'None'}
- Current Medications: ${Array.isArray(patientData?.medications) ? patientData.medications.join(', ') : patientData?.medications || 'None'}

Active Consultation Session:
- Presenting Complaint: ${clinicalSession?.presentingComplaint || 'Not recorded'}
- History of Present Illness: ${clinicalSession?.historyOfPresentIllness || 'Not recorded'}
- Examination: ${clinicalSession?.examination || 'Not recorded'}
- Clinical Notes: ${clinicalSession?.notes || 'Not recorded'}
- Active Diagnoses: ${clinicalSession?.diagnosis || 'Not recorded'}
- Treatment Plan: ${clinicalSession?.treatmentPlan || 'Not recorded'}
    `;

    let systemPrompt = "";
    let userPrompt = "";

    switch (action) {
      case "summarize_history":
        systemPrompt = "You are an expert EHR clinical summarizer. Create a concise, structured, chronological medical summary of the patient's case history, highlighting key milestones, alerts, and care guidelines.";
        userPrompt = `Please summarize this patient's medical history based on the following clinical parameters:\n${patientContext}`;
        break;
      case "abnormal_trends":
        systemPrompt = "You are a clinical diagnostics validator. Analyze the provided clinical indicators and identify any potential abnormal trends, vital warnings, or metabolic red flags. Suggest what metrics require close observation.";
        userPrompt = `Please check for and highlight abnormal health trends based on these records:\n${patientContext}`;
        break;
      case "suggest_diagnoses":
        systemPrompt = "You are a senior clinical diagnostician. Analyze the presenting symptoms, medical history, and examination logs to suggest differential diagnoses ranked by clinical likelihood. Suggest diagnostic validations.";
        userPrompt = `Based on the active session, list potential differential diagnoses and justification:\n${patientContext}`;
        break;
      case "check_interactions":
        systemPrompt = "You are a clinical pharmacologist. Screen the patient's current medications, active conditions, and proposed treatment plans for potential drug-drug, drug-allergy, or drug-disease interactions.";
        userPrompt = `Please screen this patient's active drugs and allergies for severe clinical interactions:\n${patientContext}`;
        break;
      case "recommend_guidelines":
        systemPrompt = "You are a medical guidelines specialist. Recommend established, evidence-based clinical practices and targets (e.g., AHA, ADA, NICE guidelines) suitable for the patient's demographics and diagnoses.";
        userPrompt = `What are the evidence-based clinical guidelines recommended for managing this patient's condition? Context:\n${patientContext}`;
        break;
      case "draft_summary":
        systemPrompt = "You are a clinical scribe. Draft a highly professional, formatted visit summary or SOAP note for the active consultation suitable for incorporation into official EHR archives.";
        userPrompt = `Draft a finalized clinical visit summary based on the current session:\n${patientContext}`;
        break;
      case "patient_explanation":
        systemPrompt = "You are a compassionate patient communicator. Translate complex medical jargon, active diagnoses, and proposed treatment plans into empathetic, simple, layperson-friendly terms, using clear formatting and analogies.";
        userPrompt = `Create a patient-friendly care instructions sheet explaining what their diagnosis means and how to execute their treatment plan:\n${patientContext}`;
        break;
      default:
        return res.status(400).json({ error: "Invalid action type specified" });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt + " Always end your responses with a prominent disclaimer: 'AI-Generated Suggestion - Must be reviewed and approved by the attending physician before clinical implementation.'",
      }
    });

    const outputText = response.text;
    return res.json({ result: outputText || "" });

  } catch (error: any) {
    console.error("AI Clinical Consultation failed:", error);
    return res.status(500).json({ error: error?.message || "Internal server error during clinical consultation AI reasoning." });
  }
});

// Vite middleware setup for assets/routing
async function configureServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ClinicOS server running on http://0.0.0.0:${PORT}`);
  });
}

configureServer();
