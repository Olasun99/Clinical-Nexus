import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, doc, addDoc, updateDoc, onSnapshot, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { createNotification } from '../hooks/useNotifications';
import { logAction } from '../lib/audit';
import PatientTimeline from './PatientTimeline';
import Markdown from 'react-markdown';
import { 
  ArrowLeft, 
  Activity, 
  Sparkles, 
  Mic, 
  MicOff, 
  Plus, 
  Trash2, 
  Clock, 
  Send, 
  FileText, 
  Brain, 
  Heart, 
  Check, 
  AlertTriangle, 
  Search, 
  HelpCircle, 
  ChevronRight, 
  Bookmark, 
  FileCheck,
  Award,
  Video,
  Pill,
  Pause,
  Play,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

interface DoctorConsultationWorkspaceProps {
  patientId: string;
  onBack: () => void;
}

// Built-in standard ICD-10 search suggestions for diagnostic autocomplete
const ICD10_CODES = [
  { code: 'I10', desc: 'Essential (primary) hypertension' },
  { code: 'E11.9', desc: 'Type 2 diabetes mellitus without complications' },
  { code: 'J06.9', desc: 'Acute upper respiratory infection, unspecified' },
  { code: 'M54.5', desc: 'Low back pain' },
  { code: 'K21.9', desc: 'Gastro-esophageal reflux disease without esophagitis' },
  { code: 'H10.9', desc: 'Unspecified conjunctivitis' },
  { code: 'F41.1', desc: 'Generalized anxiety disorder' },
  { code: 'J45.909', desc: 'Unspecified asthma, uncomplicated' },
  { code: 'I25.10', desc: 'Atherosclerotic heart disease of native coronary artery' },
  { code: 'E78.5', desc: 'Hyperlipidemia, unspecified' },
];

export default function DoctorConsultationWorkspace({ patientId, onBack }: DoctorConsultationWorkspaceProps) {
  const { profile } = useAuth();
  
  // Patient & Clinical Data States
  const [patientUser, setPatientUser] = useState<any>(null);
  const [patientBio, setPatientBio] = useState<any>({
    age: 35,
    gender: 'Male',
    bloodType: 'O+',
    allergies: ['Penicillin', 'Peanuts'],
    chronicConditions: ['Hypertension', 'Mild Asthma'],
    medications: ['Lisinopril 10mg daily', 'Albuterol inhaler as needed']
  });
  const [labResults, setLabResults] = useState<any[]>([
    { id: 'lab-1', date: '2026-06-15', title: 'Complete Blood Count (CBC)', desc: 'White blood cells: 7.2 k/uL, Hemoglobin: 14.5 g/dL (Normal)' },
    { id: 'lab-2', date: '2026-06-15', title: 'Basic Metabolic Panel (BMP)', desc: 'Blood Glucose: 142 mg/dL (Abnormal High)', abnormal: true },
    { id: 'lab-3', date: '2026-05-10', title: 'Lipid Panel', desc: 'Total Cholesterol: 210 mg/dL (Abnormal Borderline), LDL: 135 mg/dL', abnormal: true },
    { id: 'lab-4', date: '2026-04-01', title: 'Blood Pressure Log', desc: 'BP: 152/95 mmHg (Abnormal High)', abnormal: true },
  ]);
  const [imagingRecords, setImagingRecords] = useState<any[]>([
    { id: 'img-1', date: '2026-05-20', title: 'Chest X-Ray', desc: 'Clear lung fields. Normal cardiothymic silhouette.' },
  ]);

  // Loading States
  const [loadingPatient, setLoadingPatient] = useState(true);

  // Active Session Form States (Clinical Notes Desk)
  const [presentingComplaint, setPresentingComplaint] = useState('');
  const [historyOfPresentIllness, setHistoryOfPresentIllness] = useState('');
  const [examination, setExamination] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatmentPlan, setTreatmentPlan] = useState('');

  // UI Interactive States
  const [activeRightTab, setActiveRightTab] = useState<'timeline' | 'trends' | 'ai'>('ai');
  const [allergyInput, setAllergyInput] = useState('');
  const [chronicInput, setChronicInput] = useState('');
  const [medInput, setMedInput] = useState('');
  const [diagnosisSearch, setDiagnosisSearch] = useState('');
  const [showIcdSuggestions, setShowIcdSuggestions] = useState(false);

  // Diagnostics & Prescriptions Dispatch States
  const [orderTestName, setOrderTestName] = useState('');
  const [orderType, setOrderType] = useState<'lab' | 'imaging'>('lab');
  const [isOrdering, setIsOrdering] = useState(false);

  const [prescMedName, setPrescMedName] = useState('');
  const [prescDosage, setPrescDosage] = useState('');
  const [prescPharmacy, setPrescPharmacy] = useState('');
  const [isPrescribing, setIsPrescribing] = useState(false);

  // Voice Dictation Simulation States
  const [isDictating, setIsDictating] = useState(false);
  const [dictationTarget, setDictationTarget] = useState<'complaint' | 'hpi' | 'exam' | 'notes' | 'plan' | null>(null);
  const [dictationText, setDictationText] = useState('');
  const dictationIntervalRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (dictationIntervalRef.current) {
        clearInterval(dictationIntervalRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.log("Recognition cleanup ignored:", e);
        }
      }
    };
  }, []);

  // Session Timer & Throughput States
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [timerActive, setTimerActive] = useState(true);

  useEffect(() => {
    let interval: any = null;
    if (timerActive) {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerActive]);

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // AI Assistant States
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOutput, setAiOutput] = useState('');
  const [aiAction, setAiAction] = useState<string | null>(null);

  // Load Patient Profile & Details
  useEffect(() => {
    if (!patientId) return;
    setLoadingPatient(true);

    // Watch Patient General User Document
    const userDocRef = doc(db, 'users', patientId);
    const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setPatientUser({ id: docSnap.id, ...docSnap.data() });
        const data = docSnap.data();
        // If profile exists inside user doc
        if (data.patientProfile) {
          setPatientBio((prev: any) => ({
            ...prev,
            ...data.patientProfile
          }));
        }
      } else {
        // Fallback or Mock patient info
        setPatientUser({
          id: patientId,
          name: 'Patient Node ' + patientId.substring(0, 5),
          email: 'patient.' + patientId.substring(0, 4) + '@example.com'
        });
      }
      setLoadingPatient(false);
    }, (error) => {
      console.error("Error loading patient user:", error);
      setLoadingPatient(false);
    });

    // Real-time listener for clinical diagnostics results flowing back automatically
    const recordsQuery = query(
      collection(db, 'medicalRecords'),
      where('patientId', '==', patientId)
    );
    const unsubscribeRecords = onSnapshot(recordsQuery, (snapshot) => {
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const dbLabs = records
        .filter((r: any) => r.type === 'lab')
        .map((r: any) => ({
          id: r.id,
          date: r.date ? format(new Date(r.date), 'yyyy-MM-dd') : 'Recent',
          title: r.title,
          desc: r.content,
          abnormal: r.abnormal || false,
          status: r.status || 'completed'
        }));

      const dbImgs = records
        .filter((r: any) => r.type === 'imaging')
        .map((r: any) => ({
          id: r.id,
          date: r.date ? format(new Date(r.date), 'yyyy-MM-dd') : 'Recent',
          title: r.title,
          desc: r.content,
          status: r.status || 'completed'
        }));

      setLabResults(prev => {
        const defaultMock = [
          { id: 'lab-1', date: '2026-06-15', title: 'Complete Blood Count (CBC)', desc: 'White blood cells: 7.2 k/uL, Hemoglobin: 14.5 g/dL (Normal)', abnormal: false, status: 'completed' },
          { id: 'lab-2', date: '2026-06-15', title: 'Basic Metabolic Panel (BMP)', desc: 'Blood Glucose: 142 mg/dL (Abnormal High)', abnormal: true, status: 'completed' },
          { id: 'lab-3', date: '2026-05-10', title: 'Lipid Panel', desc: 'Total Cholesterol: 210 mg/dL (Abnormal Borderline), LDL: 135 mg/dL', abnormal: true, status: 'completed' },
          { id: 'lab-4', date: '2026-04-01', title: 'Blood Pressure Log', desc: 'BP: 152/95 mmHg (Abnormal High)', abnormal: true, status: 'completed' },
        ];
        // Combine, filter out overrides by title
        const filteredDefault = defaultMock.filter(m => !dbLabs.some((l: any) => l.title === m.title));
        return [...dbLabs, ...filteredDefault];
      });

      setImagingRecords(prev => {
        const defaultMock = [
          { id: 'img-1', date: '2026-05-20', title: 'Chest X-Ray', desc: 'Clear lung fields. Normal cardiothymic silhouette.', status: 'completed' },
        ];
        // Combine, filter out overrides by title
        const filteredDefault = defaultMock.filter(m => !dbImgs.some((i: any) => i.title === m.title));
        return [...dbImgs, ...filteredDefault];
      });
    });

    return () => {
      unsubscribeUser();
      unsubscribeRecords();
    };
  }, [patientId]);

  // Load patient diagnosis symptoms if any upcoming appointment exists
  useEffect(() => {
    const q = query(
      collection(db, 'appointments'),
      where('patientId', '==', patientId),
      where('status', '==', 'scheduled')
    );
    getDocs(q).then((snap) => {
      if (!snap.empty) {
        const firstApt = snap.docs[0].data();
        if (firstApt.symptoms && !presentingComplaint) {
          setPresentingComplaint(firstApt.symptoms);
        }
      }
    });
  }, [patientId]);

  // Dispatch lab/imaging test and simulate dynamic automated result flow back
  const handleOrderDiagnostic = async () => {
    if (!profile || !patientId || !orderTestName) return;
    setIsOrdering(true);

    try {
      // 1. Create pending record in medicalRecords
      const docRef = await addDoc(collection(db, 'medicalRecords'), {
        patientId,
        doctorId: profile.userId,
        type: orderType,
        title: orderTestName,
        content: 'Diagnostic Order Dispatched // Sample Collection & Scanner Queue Pending...',
        status: 'ordered',
        abnormal: false,
        date: new Date().toISOString()
      });

      // 2. Automated billing updates in real-time
      const cost = orderType === 'imaging' ? 150 : 45;
      await addDoc(collection(db, 'invoices'), {
        userId: patientId,
        label: `Diagnostic ${orderType === 'imaging' ? 'Scan' : 'Lab'}: ${orderTestName}`,
        amount: cost,
        status: 'unpaid',
        dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
      });

      // 3. Log action & notify patient
      await logAction(profile.userId, profile.name, 'ORDER_DIAGNOSTIC', 'Medical Records', `Ordered diagnostic test "${orderTestName}" for patient ${patientId}`);
      await createNotification(patientId, {
        title: `Diagnostic Ordered: ${orderTestName}`,
        message: `Your physician has ordered a ${orderType}: "${orderTestName}". Please visit the diagnostics reception desk.`,
        type: 'info'
      });

      const currentTestName = orderTestName;
      const currentType = orderType;
      setOrderTestName('');

      // 4. Simulate results flowing back automatically after 8 seconds
      setTimeout(async () => {
        try {
          let testContent = '';
          let isAbnormal = false;

          if (currentTestName.includes('HbA1c')) {
            testContent = 'HbA1c Level: 7.4% (Abnormal High). Recommended metabolic therapy titration.';
            isAbnormal = true;
          } else if (currentTestName.includes('ECG') || currentTestName.includes('Electrocardiogram')) {
            testContent = 'Electrocardiogram findings: Normal sinus rhythm at 72 bpm. Mild PR interval elongation. No acute ST changes.';
          } else if (currentTestName.includes('Lipid')) {
            testContent = 'Total Cholesterol: 218 mg/dL (Borderline High), Triglycerides: 165 mg/dL. Recommending low-fat dietary modifications.';
            isAbnormal = true;
          } else if (currentTestName.includes('BMP')) {
            testContent = 'Blood Glucose: 135 mg/dL (Elevated Fasting), Serum Sodium: 140 mEq/L, Potassium: 4.1 mEq/L (Normal).';
            isAbnormal = true;
          } else if (currentTestName.includes('MRI')) {
            testContent = 'Brain MRI: No acute intracranial hemorrhage, mass effect, or large territorial infarct. Ventricles are within normal limits.';
          } else if (currentTestName.includes('Ultrasound')) {
            testContent = 'Abdominal Ultrasound: Mild hepatic steatosis noted. Gallbladder, spleen, and bilateral kidneys are unremarkable.';
          } else if (currentTestName.includes('X-Ray')) {
            testContent = 'Chest X-Ray: Clear lung fields bilaterally. Cardiomegaly absent. No pleural effusions.';
          } else {
            testContent = 'Diagnostic analysis completed. Findings trace normal nominal range. No focal pathological anomalies identified.';
          }

          // Update Firestore record
          await updateDoc(doc(db, 'medicalRecords', docRef.id), {
            content: testContent,
            status: 'completed',
            abnormal: isAbnormal,
            date: new Date().toISOString()
          });

          // Create notification of results
          await createNotification(patientId, {
            title: `Diagnostic Result Received: ${currentTestName}`,
            message: `Results are now finalized for your ${currentTestName} scan and synced with your physician workspace.`,
            type: isAbnormal ? 'warning' : 'success'
          });

          // Log Action
          await logAction('system', 'EHR Lab Processor', 'FINALIZE_DIAGNOSTIC', 'Medical Records', `Processed and updated result for diagnostic "${currentTestName}" (ID: ${docRef.id})`);
        } catch (subErr) {
          console.error("Async result flow back simulation failed:", subErr);
        }
      }, 8000);

      alert(`Diagnostic test "${currentTestName}" dispatched! Results will flow back to your workspace automatically in a few seconds.`);
    } catch (err) {
      console.error("Failed to dispatch diagnostic order:", err);
      alert("Error dispatching diagnostic order. Please check connections.");
    } finally {
      setIsOrdering(false);
    }
  };

  // Dispatch electronic prescription (e-Rx)
  const handleDispatchPrescription = async () => {
    if (!profile || !patientId || !prescMedName || !prescDosage || !prescPharmacy) return;
    setIsPrescribing(true);

    try {
      // 1. Add prescription to medicalRecords
      const title = `${prescMedName} Prescription`;
      const content = `${prescMedName} // Instruction: ${prescDosage} // Dispatched Electronically to Pharmacy: ${prescPharmacy}. Refills remaining: 3.`;
      
      await addDoc(collection(db, 'medicalRecords'), {
        patientId,
        doctorId: profile.userId,
        type: 'prescription',
        title,
        content,
        date: new Date().toISOString()
      });

      // Append to Treatment Plan text box
      setTreatmentPlan(prev => {
        const text = `[e-Rx Dispatched]: ${prescMedName} - ${prescDosage} sent electronically to ${prescPharmacy}`;
        return prev ? `${prev}\n\n${text}` : text;
      });

      // 2. Automated billing updates in real-time
      await addDoc(collection(db, 'invoices'), {
        userId: patientId,
        label: `Medication Dispensing: ${prescMedName}`,
        amount: 15,
        status: 'unpaid',
        dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
      });

      // 3. Log action & notify patient
      await logAction(profile.userId, profile.name, 'DISPATCH_PRESCRIPTION', 'Medical Records', `Dispatched electronic prescription for "${prescMedName}" to ${prescPharmacy}`);
      await createNotification(patientId, {
        title: `Electronic Prescription Sent`,
        message: `Your prescription for ${prescMedName} has been transmitted electronically to ${prescPharmacy} and is ready for billing & collection.`,
        type: 'success'
      });

      // Reset form fields
      setPrescMedName('');
      setPrescDosage('');
      setPrescPharmacy('');

      alert("Electronic prescription successfully transmitted to pharmacy server! Added to patient EHR ledger and billed accordingly.");
    } catch (err) {
      console.error("Prescription dispatch failed:", err);
      alert("Error sending prescription. Please check connections.");
    } finally {
      setIsPrescribing(false);
    }
  };

  // Apply clinical note templates
  const applyTemplate = (templateType: string) => {
    switch (templateType) {
      case 'soap':
        setPresentingComplaint('Patient reports mild chest tightness and localized fatigue.');
        setHistoryOfPresentIllness('S: Patient reports chest tightness (3/10 severity) starting 2 days ago, aggravated by physical exertion. Rest offers relief. No radiating pain. \n\nO: Pulse 82 bpm, Blood pressure 144/90 mmHg, SpO2 98% on room air.');
        setExamination('Lungs are clear bilaterally. Heart rate is regular. No murmurs or gallops. Normal S1/S2.');
        setClinicalNotes('A: Primary hypertension with cardiac fatigue. Rule out mild ischemic events.');
        setDiagnosis('I10 - Essential (primary) hypertension');
        setTreatmentPlan('P: Start amlodipine 5mg once daily. Schedule fasting lipid panel and 12-lead ECG. Educate patient on cardiac signs.');
        break;
      case 'operative':
        setPresentingComplaint('Acute localized pain and clinical indications for laparoscopic cholecystectomy.');
        setHistoryOfPresentIllness('INDICATIONS FOR SURGERY: Symptomatic cholelithiasis with recurrent biliary colic.');
        setExamination('Abdomen is soft, mildly tender in the right upper quadrant, with positive Murphy sign.');
        setClinicalNotes('PROCEDURE COMPLETED: Successful uncomplicated laparoscopic cholecystectomy.\nFindings: Gallbladder with multiple cholesterol stones, thickened wall.\nComplications: None.');
        setDiagnosis('K80.20 - Calculus of gallbladder without cholecystitis without obstruction');
        setTreatmentPlan('1. Clear liquids, advance to low-fat diet as tolerated.\n2. Post-operative analgesia: Acetaminophen 500mg as needed.\n3. Follow up in clinical ward in 7 days.');
        break;
      case 'antenatal':
        setPresentingComplaint('Routine antenatal review. Gestational Age: 24 weeks.');
        setHistoryOfPresentIllness('Patient reports nominal symptoms. Active fetal movements noticed. No bleeding, leaking, or localized abdominal pain.');
        setExamination('BP: 118/72 mmHg. Fundal height: 24cm. Fetal Heart Rate: 145 bpm (Regular, normal). No peripheral edema.');
        setClinicalNotes('A: 24-week uncomplicated singleton pregnancy.');
        setDiagnosis('O09.90 - Supervision of high-risk pregnancy, unspecified trimester');
        setTreatmentPlan('1. Continue routine prenatal vitamins and calcium.\n2. Screen for gestational diabetes (OGTT) at next visit.\n3. Return immediately for bleeding, fever, or reduced fetal kicks.');
        break;
      case 'pediatric':
        setPresentingComplaint('Well-child pediatric development review.');
        setHistoryOfPresentIllness('12-month well-child visit. Parents report appropriate weaning progress, sleeping patterns, and vocalizations.');
        setExamination('Weight: 10.2 kg (75th percentile), Height: 76 cm (60th percentile).\nDevelopmental Milestones: Stands independently, responsive to verbal cues, waves goodbye.');
        setClinicalNotes('Normal well-developed pediatric growth index.');
        setDiagnosis('Z00.129 - Encounter for routine child health examination without abnormal findings');
        setTreatmentPlan('1. Administered MMR and Varicella vaccine dose 1.\n2. Recommended transition to whole milk and finger foods.\n3. Follow-up well-child review at 15 months.');
        break;
      case 'chronic':
        setPresentingComplaint('Biannual diabetic and metabolic management review.');
        setHistoryOfPresentIllness('Patient reports stable dietary compliance. Mild neuropathy symptoms in bilateral feet.');
        setExamination('HbA1c: 7.4% (elevated). BP: 135/84 mmHg. Decreased monofilament sensation in feet.');
        setClinicalNotes('Metabolic control requires therapeutic titration.');
        setDiagnosis('E11.9 - Type 2 diabetes mellitus without complications');
        setTreatmentPlan('1. Titrate Metformin to 1000mg twice daily.\n2. Refer to podiatry for comprehensive foot exam.\n3. Target HbA1c < 7.0%. Review labs in 3 months.');
        break;
    }
  };

  // Add/Delete Bio Elements in Firestore for live integration
  const handleAddBioElement = async (field: 'allergies' | 'chronicConditions' | 'medications', value: string) => {
    if (!value.trim() || !patientId) return;

    try {
      const userRef = doc(db, 'users', patientId);
      await updateDoc(userRef, {
        [`patientProfile.${field}`]: arrayUnion(value.trim())
      });
      setPatientBio((prev: any) => ({
        ...prev,
        [field]: [...(prev[field] || []), value.trim()]
      }));
      
      // Log Action
      if (profile) {
        await logAction(profile.userId, profile.name, 'UPDATE_PATIENT_BIO', 'Medical Records', `Added "${value}" to patient ${field}`);
      }
    } catch (err) {
      console.error("Error adding bio element:", err);
    }
  };

  const handleRemoveBioElement = async (field: 'allergies' | 'chronicConditions' | 'medications', value: string) => {
    if (!patientId) return;

    try {
      const userRef = doc(db, 'users', patientId);
      await updateDoc(userRef, {
        [`patientProfile.${field}`]: arrayRemove(value)
      });
      setPatientBio((prev: any) => ({
        ...prev,
        [field]: (prev[field] || []).filter((item: string) => item !== value)
      }));

      // Log Action
      if (profile) {
        await logAction(profile.userId, profile.name, 'UPDATE_PATIENT_BIO', 'Medical Records', `Removed "${value}" from patient ${field}`);
      }
    } catch (err) {
      console.error("Error removing bio element:", err);
    }
  };

  // Integrate Web Speech API for real-time voice-to-text dictation
  const toggleDictation = (target: 'complaint' | 'hpi' | 'exam' | 'notes' | 'plan') => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (isDictating) {
      // Stop dictation
      if (dictationIntervalRef.current) {
        clearInterval(dictationIntervalRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.log(e);
        }
      }
      setIsDictating(false);
      setDictationTarget(null);
    } else {
      // Start dictation
      setIsDictating(true);
      setDictationTarget(target);

      const appendText = (text: string) => {
        if (target === 'complaint') setPresentingComplaint(prev => prev + text);
        if (target === 'hpi') setHistoryOfPresentIllness(prev => prev + text);
        if (target === 'exam') setExamination(prev => prev + text);
        if (target === 'notes') setClinicalNotes(prev => prev + text);
        if (target === 'plan') setTreatmentPlan(prev => prev + text);
      };

      if (!SpeechRecognition) {
        // Fallback simulation if browser doesn't support Web Speech API
        console.warn("Web Speech API not supported in this environment. Falling back to dictation simulator.");
        appendText(" [Voice Dictation Simulator Active (Speak now)]: ");
        
        const sentences = [
          "Patient presents with mild cardiovascular tension,",
          " accompanied by subjective localized fatigue and occasional dyspnea",
          " upon moderate physical exertion.",
          " Vital stats trace blood pressure elevated at 145 over 90.",
          " Lungs are clear, cardiac rhythm is regular."
        ];
        
        let index = 0;
        dictationIntervalRef.current = setInterval(() => {
          if (index < sentences.length) {
            appendText(sentences[index]);
            index++;
          } else {
            clearInterval(dictationIntervalRef.current);
            setIsDictating(false);
            setDictationTarget(null);
          }
        }, 2200);
        return;
      }

      // Real Speech Recognition Integration
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          const lastResultIndex = event.results.length - 1;
          const transcript = event.results[lastResultIndex][0].transcript;
          if (transcript) {
            appendText(" " + transcript.trim());
          }
        };

        recognition.onerror = (err: any) => {
          console.error("Speech Recognition Error:", err);
          if (err.error === 'not-allowed') {
            alert("Microphone permission denied. Please allow microphone access in your browser options to use dictation.");
          }
          setIsDictating(false);
          setDictationTarget(null);
        };

        recognition.onend = () => {
          setIsDictating(false);
          setDictationTarget(null);
        };

        recognitionRef.current = recognition;
        recognition.start();
        appendText(" [Dictation Active]:");
      } catch (e) {
        console.error("Failed to start speech recognition:", e);
        setIsDictating(false);
        setDictationTarget(null);
      }
    }
  };

  // Autocomplete ICD-10 Search
  const filteredIcdSuggestions = ICD10_CODES.filter(item => 
    item.code.toLowerCase().includes(diagnosisSearch.toLowerCase()) ||
    item.desc.toLowerCase().includes(diagnosisSearch.toLowerCase())
  );

  const applyIcdCode = (item: { code: string, desc: string }) => {
    setDiagnosis(`${item.code} - ${item.desc}`);
    setDiagnosisSearch('');
    setShowIcdSuggestions(false);
  };

  // AI Assistant trigger
  const runAiClinicalAssistant = async (action: string) => {
    setAiLoading(true);
    setAiAction(action);
    setAiOutput('');

    try {
      const res = await fetch('/api/doctor/consult-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          patientData: {
            name: patientUser?.name,
            age: patientBio?.age,
            gender: patientBio?.gender,
            bloodType: patientBio?.bloodType,
            allergies: patientBio?.allergies,
            chronicConditions: patientBio?.chronicConditions,
            medications: patientBio?.medications
          },
          clinicalSession: {
            presentingComplaint,
            historyOfPresentIllness,
            examination,
            notes: clinicalNotes,
            diagnosis,
            treatmentPlan
          }
        })
      });

      const data = await res.json();
      if (res.ok && data.result) {
        setAiOutput(data.result);
      } else {
        setAiOutput(`### Error Calling AI Link\n${data.error || 'Failed to complete AI reasoning.'}`);
      }
    } catch (err: any) {
      console.error("Clinical assistant invocation failed:", err);
      setAiOutput(`### Clinical Assistant Error\nFailed to establish connection. Details: ${err?.message || err}`);
    } finally {
      setAiLoading(false);
    }
  };

  // AI Recommendation Review & Approve Flow
  const handleApproveAiRecommendation = () => {
    if (!aiOutput) return;

    // Remove disclaimer text for neatness
    const cleanOutput = aiOutput.replace(/AI-Generated Suggestion - Must be reviewed and approved.*/gi, '').trim();

    if (aiAction === 'suggest_diagnoses') {
      // Put in diagnosis
      setDiagnosis(prev => prev ? `${prev}\n\n[Approved Suggestion]:\n${cleanOutput}` : cleanOutput);
      setActiveRightTab('timeline');
      setAiOutput('');
    } else if (aiAction === 'check_interactions' || aiAction === 'recommend_guidelines') {
      // Put in treatment plan
      setTreatmentPlan(prev => prev ? `${prev}\n\n[Approved Care Protocol]:\n${cleanOutput}` : cleanOutput);
      setActiveRightTab('timeline');
      setAiOutput('');
    } else if (aiAction === 'draft_summary') {
      // Put in clinical notes
      setClinicalNotes(prev => prev ? `${prev}\n\n[Approved SOAP Summary]:\n${cleanOutput}` : cleanOutput);
      setActiveRightTab('timeline');
      setAiOutput('');
    } else {
      // Copy to treatment plan / care notes
      setTreatmentPlan(prev => prev ? `${prev}\n\n[Clinical AI Insight]:\n${cleanOutput}` : cleanOutput);
      setActiveRightTab('timeline');
      setAiOutput('');
    }

    if (profile) {
      logAction(profile.userId, profile.name, 'APPROVE_AI_SUGGESTION', 'Medical Records', `Approved and incorporated ${aiAction} suggestion for patient ${patientId}`);
    }
  };

  // Save the entire consultation session
  const handleSaveConsultation = async () => {
    if (!profile) return;

    try {
      // 1. Build a structured content block
      const fullContent = `
PRESENTING COMPLAINT:
${presentingComplaint || 'None recorded'}

HISTORY OF PRESENT ILLNESS (HPI):
${historyOfPresentIllness || 'None recorded'}

PHYSICAL EXAMINATION:
${examination || 'None recorded'}

CLINICAL AUDIT NOTES:
${clinicalNotes || 'None recorded'}

FINAL DIAGNOSIS:
${diagnosis || 'Unspecified'}

TREATMENT & PRESCRIPTION PLAN:
${treatmentPlan || 'None recorded'}
      `.trim();

      // 2. Add as a MedicalRecord to DB
      const recordTitle = diagnosis ? `Consultation note: ${diagnosis.split('\n')[0]}` : 'Clinical Consultation Session';
      
      const recordRef = await addDoc(collection(db, 'medicalRecords'), {
        patientId,
        doctorId: profile.userId,
        type: 'note',
        title: recordTitle,
        content: fullContent,
        date: new Date().toISOString()
      });

      // 3. Set the active scheduled or waiting appointment to 'completed'
      const aptQuery = query(
        collection(db, 'appointments'),
        where('patientId', '==', patientId),
        where('status', 'in', ['scheduled', 'waiting', 'in-consultation'])
      );
      const aptSnap = await getDocs(aptQuery);
      if (!aptSnap.empty) {
        await updateDoc(doc(db, 'appointments', aptSnap.docs[0].id), {
          status: 'completed'
        });
      }

      // 3.5 Create real-time Consultation Fee Invoice
      await addDoc(collection(db, 'invoices'), {
        userId: patientId,
        label: `Clinical Consultation: Dr. ${profile.name}`,
        amount: 100,
        status: 'unpaid',
        dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
      });

      // 4. Log and notify
      await logAction(profile.userId, profile.name, 'CREATE_RECORD', 'Medical Records', `Saved consultation record "${recordTitle}" (ID: ${recordRef.id}) for patient ${patientId}`);
      await createNotification(patientId, {
        title: 'Clinical Consultation Complete',
        message: `Your medical consultation notes have been finalized by Dr. ${profile.name}.`,
        type: 'success'
      });

      alert("Consultation session saved successfully to patient EHR card!");
      onBack();
    } catch (err) {
      console.error("Failed to save consultation:", err);
      alert("Error saving medical record. Please try again.");
    }
  };

  if (loadingPatient) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-text-dim text-xs font-mono uppercase tracking-widest">
         <Activity className="animate-spin text-emerald-500" />
         Loading Patient Consultation Room...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Consultation Room Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border-accent/10">
        <div className="flex flex-wrap items-center gap-4">
          <button 
            onClick={onBack}
            className="p-3 bg-inner-bg hover:bg-white/5 border border-border-accent rounded-2xl text-text-dim hover:text-text-main transition-colors active:scale-95"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500">DIGITAL_CONSULTATION_ROOM // SECURE_HUB</h1>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <h2 className="text-3xl font-black text-text-main uppercase tracking-tighter italic font-serif">
                {patientUser?.name || 'Anonymous Patient'}
              </h2>
              
              {/* SESSION TIMER DECK */}
              <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 border border-slate-800 rounded-xl shadow-inner text-white">
                <Clock size={12} className={timerActive ? "text-emerald-400 animate-pulse" : "text-text-dim"} />
                <span className="font-mono text-xs font-black tracking-widest text-emerald-300">
                  {formatTimer(secondsElapsed)}
                </span>
                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${secondsElapsed > 900 ? 'bg-rose-500/20 text-rose-400 animate-pulse' : 'bg-emerald-500/10 text-emerald-400'}`}>
                  {secondsElapsed > 900 ? 'OVERTIME (15m+)' : 'SESSION TIMER'}
                </span>
                <div className="flex items-center gap-1 border-l border-white/10 pl-2 ml-1">
                  <button 
                    onClick={() => setTimerActive(!timerActive)} 
                    className="p-1 hover:bg-white/5 rounded text-text-dim hover:text-text-main transition-colors"
                    title={timerActive ? "Pause Timer" : "Start Timer"}
                  >
                    {timerActive ? <Pause size={10} /> : <Play size={10} />}
                  </button>
                  <button 
                    onClick={() => setSecondsElapsed(0)} 
                    className="p-1 hover:bg-white/5 rounded text-text-dim hover:text-rose-400 transition-colors"
                    title="Reset Timer"
                  >
                    <RotateCcw size={10} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Template Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[9px] font-black uppercase text-text-dim tracking-widest mr-2 font-mono">EHR Note Templates:</span>
          {['SOAP', 'Operative', 'Antenatal', 'Pediatric', 'Chronic'].map((t) => (
            <button
              key={t}
              onClick={() => applyTemplate(t.toLowerCase())}
              className="px-4 py-2 bg-inner-bg hover:bg-emerald-500/10 hover:border-emerald-500/30 border border-border-accent text-[9px] font-black uppercase text-text-muted hover:text-emerald-400 rounded-xl transition-all"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Main 3-Panel Consultation Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        
        {/* ================= LEFT PANEL: DEMOGRAPHICS & CLINICAL BIOMETRICS ================= */}
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-card-bg border border-border-accent rounded-[32px] p-6 shadow-xl space-y-6">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-emerald-500 border-b border-border-accent/10 pb-3 flex items-center gap-2">
              <Activity size={14} />
              Biometric ID
            </h3>
            
            {/* Demographics Summary */}
            <div className="space-y-3.5 bg-inner-bg p-5 border border-border-accent rounded-2xl relative overflow-hidden">
              <div className="flex justify-between text-xs">
                <span className="text-text-dim">Node Code</span>
                <span className="font-mono font-bold text-text-muted">{patientId.substring(0, 12).toUpperCase()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-dim">Age / Sex</span>
                <span className="font-mono font-bold text-text-main">{patientBio.age || '35'} yrs / {patientBio.gender || 'Male'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-dim">Blood Type</span>
                <span className="font-mono font-black text-emerald-400">{patientBio.bloodType || 'O+'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-dim">Email Sync</span>
                <span className="text-text-dim select-all truncate max-w-[140px] font-mono text-[10px]">{patientUser?.email || 'N/A'}</span>
              </div>
            </div>

            {/* Interactive Allergies List */}
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-text-dim tracking-widest pl-1">Allergy Ledger</label>
              <div className="flex flex-wrap gap-1.5">
                {(patientBio.allergies || []).map((allergy: string) => (
                  <span key={allergy} className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-[10px] font-black uppercase">
                    {allergy}
                    <button onClick={() => handleRemoveBioElement('allergies', allergy)} className="hover:text-rose-200 transition-colors">
                      <Trash2 size={10} />
                    </button>
                  </span>
                ))}
                {(patientBio.allergies || []).length === 0 && (
                  <span className="text-xs text-text-dim italic">No active allergies recorded.</span>
                )}
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Add allergy..." 
                  value={allergyInput} 
                  onChange={e => setAllergyInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (handleAddBioElement('allergies', allergyInput), setAllergyInput(''))}
                  className="flex-1 px-4 py-2 bg-inner-bg border border-border-accent rounded-xl text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-rose-500/30"
                />
                <button 
                  onClick={() => { handleAddBioElement('allergies', allergyInput); setAllergyInput(''); }}
                  className="p-2 bg-rose-600/10 border border-rose-500/20 hover:bg-rose-500 hover:text-white rounded-xl text-rose-400 transition-all"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Interactive Chronic Conditions List */}
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-text-dim tracking-widest pl-1">Chronic Conditions</label>
              <div className="flex flex-wrap gap-1.5">
                {(patientBio.chronicConditions || []).map((condition: string) => (
                  <span key={condition} className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-[10px] font-black uppercase">
                    {condition}
                    <button onClick={() => handleRemoveBioElement('chronicConditions', condition)} className="hover:text-amber-200 transition-colors">
                      <Trash2 size={10} />
                    </button>
                  </span>
                ))}
                {(patientBio.chronicConditions || []).length === 0 && (
                  <span className="text-xs text-text-dim italic">No chronic ailments logged.</span>
                )}
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Add chronic condition..." 
                  value={chronicInput} 
                  onChange={e => setChronicInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (handleAddBioElement('chronicConditions', chronicInput), setChronicInput(''))}
                  className="flex-1 px-4 py-2 bg-inner-bg border border-border-accent rounded-xl text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-amber-500/30"
                />
                <button 
                  onClick={() => { handleAddBioElement('chronicConditions', chronicInput); setChronicInput(''); }}
                  className="p-2 bg-amber-600/10 border border-amber-500/20 hover:bg-amber-500 hover:text-white rounded-xl text-amber-400 transition-all"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Interactive Current Medications */}
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-text-dim tracking-widest pl-1">Active Medication Ledger</label>
              <div className="space-y-2">
                {(patientBio.medications || []).map((med: string) => (
                  <div key={med} className="flex items-center justify-between p-3 bg-inner-bg border border-border-accent rounded-xl">
                    <span className="text-xs font-bold text-text-muted">{med}</span>
                    <button onClick={() => handleRemoveBioElement('medications', med)} className="text-text-dim hover:text-rose-400 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                {(patientBio.medications || []).length === 0 && (
                  <span className="text-xs text-text-dim italic block pl-1">No active therapies recorded.</span>
                )}
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Add medication & dose..." 
                  value={medInput} 
                  onChange={e => setMedInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (handleAddBioElement('medications', medInput), setMedInput(''))}
                  className="flex-1 px-4 py-2 bg-inner-bg border border-border-accent rounded-xl text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-emerald-500/30"
                />
                <button 
                  onClick={() => { handleAddBioElement('medications', medInput); setMedInput(''); }}
                  className="p-2 bg-emerald-600/10 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white rounded-xl text-emerald-400 transition-all"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* ================= CENTER PANEL: ACTIVE CONSULTATION WORKSPACE ================= */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-card-bg border border-border-accent rounded-[32px] p-8 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-border-accent/10 pb-4">
              <h3 className="text-xl font-black text-text-main uppercase tracking-tighter italic font-serif flex items-center gap-3">
                <FileText className="text-emerald-500" />
                Consultation Records Desk
              </h3>
              <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest px-3 py-1 bg-emerald-500/10 rounded-lg">LIVE_ARCHIVE_SESSION</span>
            </div>

            {/* Complaint & History Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Presenting Complaint */}
              <div className="space-y-2 relative">
                <div className="flex justify-between items-center pl-1">
                  <label className="text-[10px] font-black uppercase text-text-dim tracking-widest">Presenting Complaint</label>
                  <button 
                    onClick={() => toggleDictation('complaint')} 
                    className={`p-1.5 rounded-lg transition-all ${isDictating && dictationTarget === 'complaint' ? 'bg-rose-500 text-white animate-pulse' : 'text-text-dim hover:text-emerald-500 bg-inner-bg'}`}
                    title="Simulate Speech-to-Text Dictation"
                  >
                    <Mic size={12} />
                  </button>
                </div>
                <textarea 
                  value={presentingComplaint} 
                  onChange={e => setPresentingComplaint(e.target.value)}
                  placeholder="Primary reason for clinical check-in..."
                  rows={3}
                  className="w-full p-4 rounded-2xl bg-inner-bg border border-border-accent text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-emerald-500/30 outline-none transition-colors"
                />
              </div>

              {/* History of Present Illness (HPI) */}
              <div className="space-y-2">
                <div className="flex justify-between items-center pl-1">
                  <label className="text-[10px] font-black uppercase text-text-dim tracking-widest">History of Present Illness (HPI)</label>
                  <button 
                    onClick={() => toggleDictation('hpi')} 
                    className={`p-1.5 rounded-lg transition-all ${isDictating && dictationTarget === 'hpi' ? 'bg-rose-500 text-white animate-pulse' : 'text-text-dim hover:text-emerald-500 bg-inner-bg'}`}
                    title="Simulate Speech-to-Text Dictation"
                  >
                    <Mic size={12} />
                  </button>
                </div>
                <textarea 
                  value={historyOfPresentIllness} 
                  onChange={e => setHistoryOfPresentIllness(e.target.value)}
                  placeholder="Chronological narrative of active complaints..."
                  rows={3}
                  className="w-full p-4 rounded-2xl bg-inner-bg border border-border-accent text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-emerald-500/30 outline-none transition-colors"
                />
              </div>
            </div>

            {/* Dictation Warning / Visual Indicator */}
            <AnimatePresence>
              {isDictating && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative flex items-center justify-center w-5 h-5">
                      <span className="absolute w-full h-full bg-rose-500 rounded-full animate-ping opacity-75"></span>
                      <span className="relative w-2.5 h-2.5 bg-rose-500 rounded-full"></span>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-rose-400">Microphone Input Sync Active</span>
                      <p className="text-xs text-text-muted mt-0.5">Streaming clinical dictation into the "{dictationTarget?.toUpperCase()}" slot...</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => toggleDictation(dictationTarget!)}
                    className="px-4 py-1.5 bg-rose-600 text-white font-black uppercase text-[9px] tracking-widest rounded-lg hover:bg-rose-500"
                  >
                    Mute Sync
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Physical Examination & Clinical Audit Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Physical Examination */}
              <div className="space-y-2">
                <div className="flex justify-between items-center pl-1">
                  <label className="text-[10px] font-black uppercase text-text-dim tracking-widest">Physical Examination Findings</label>
                  <button 
                    onClick={() => toggleDictation('exam')} 
                    className={`p-1.5 rounded-lg transition-all ${isDictating && dictationTarget === 'exam' ? 'bg-rose-500 text-white animate-pulse' : 'text-text-dim hover:text-emerald-500 bg-inner-bg'}`}
                    title="Simulate Speech-to-Text Dictation"
                  >
                    <Mic size={12} />
                  </button>
                </div>
                <textarea 
                  value={examination} 
                  onChange={e => setExamination(e.target.value)}
                  placeholder="Vitals, cardiac review, localized physical findings..."
                  rows={3}
                  className="w-full p-4 rounded-2xl bg-inner-bg border border-border-accent text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-emerald-500/30 outline-none transition-colors"
                />
              </div>

              {/* Clinical Notes / Assessment */}
              <div className="space-y-2">
                <div className="flex justify-between items-center pl-1">
                  <label className="text-[10px] font-black uppercase text-text-dim tracking-widest">Clinical Audit Notes (SOAP Notes)</label>
                  <button 
                    onClick={() => toggleDictation('notes')} 
                    className={`p-1.5 rounded-lg transition-all ${isDictating && dictationTarget === 'notes' ? 'bg-rose-500 text-white animate-pulse' : 'text-text-dim hover:text-emerald-500 bg-inner-bg'}`}
                    title="Simulate Speech-to-Text Dictation"
                  >
                    <Mic size={12} />
                  </button>
                </div>
                <textarea 
                  value={clinicalNotes} 
                  onChange={e => setClinicalNotes(e.target.value)}
                  placeholder="Primary assessment logs and diagnostic metrics..."
                  rows={3}
                  className="w-full p-4 rounded-2xl bg-inner-bg border border-border-accent text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-emerald-500/30 outline-none transition-colors"
                />
              </div>
            </div>

            {/* Diagnosis (with Smart ICD-10 suggestions) */}
            <div className="space-y-2 relative">
              <label className="text-[10px] font-black uppercase text-text-dim tracking-widest pl-1">Final Diagnoses</label>
              <div className="relative">
                <textarea 
                  value={diagnosis} 
                  onChange={e => setDiagnosis(e.target.value)}
                  placeholder="Final diagnoses. (E.g. I10 - Essential hypertension)"
                  rows={2}
                  className="w-full p-4 rounded-2xl bg-inner-bg border border-border-accent text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-emerald-500/30 outline-none transition-colors"
                />
              </div>
              
              {/* Autocomplete trigger box */}
              <div className="bg-inner-bg p-4 border border-border-accent rounded-2xl flex flex-col md:flex-row gap-4 items-center">
                <div className="flex-1 relative w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-dim" size={14} />
                  <input 
                    type="text" 
                    placeholder="Search ICD-10 Diagnostic Codes..." 
                    value={diagnosisSearch}
                    onChange={e => { setDiagnosisSearch(e.target.value); setShowIcdSuggestions(true); }}
                    onFocus={() => setShowIcdSuggestions(true)}
                    className="w-full pl-11 pr-4 py-2 text-xs bg-card-bg border border-border-accent rounded-xl text-text-main placeholder:text-text-dim focus:outline-none focus:border-emerald-500/30"
                  />
                  
                  {/* Autocomplete Dropdown List */}
                  {showIcdSuggestions && diagnosisSearch && (
                    <div className="absolute left-0 right-0 mt-2 bg-inner-bg border border-border-accent rounded-xl shadow-2xl z-30 max-h-48 overflow-y-auto divide-y divide-border-accent/30">
                      {filteredIcdSuggestions.map((item) => (
                        <button
                          key={item.code}
                          onClick={() => applyIcdCode(item)}
                          className="w-full text-left px-4 py-2.5 hover:bg-emerald-500/10 text-xs transition-colors flex items-center justify-between"
                        >
                          <span className="font-bold text-emerald-400">{item.code}</span>
                          <span className="text-text-muted truncate ml-4 flex-1">{item.desc}</span>
                          <ChevronRight size={12} className="text-text-dim" />
                        </button>
                      ))}
                      {filteredIcdSuggestions.length === 0 && (
                        <div className="p-3 text-xs text-text-dim italic">No matching codes found.</div>
                      )}
                    </div>
                  )}
                </div>
                {showIcdSuggestions && (
                  <button 
                    onClick={() => setShowIcdSuggestions(false)}
                    className="text-[10px] font-black uppercase text-text-dim hover:text-text-main tracking-widest px-3 py-1 bg-card-bg border border-border-accent rounded-lg"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>

            {/* Treatment & Prescriptions Plan */}
            <div className="space-y-2">
              <div className="flex justify-between items-center pl-1">
                <label className="text-[10px] font-black uppercase text-text-dim tracking-widest">Treatment Plan & Prescription Sheets</label>
                <button 
                  onClick={() => toggleDictation('plan')} 
                  className={`p-1.5 rounded-lg transition-all ${isDictating && dictationTarget === 'plan' ? 'bg-rose-500 text-white animate-pulse' : 'text-text-dim hover:text-emerald-500 bg-inner-bg'}`}
                  title="Simulate Speech-to-Text Dictation"
                >
                  <Mic size={12} />
                </button>
              </div>
              <textarea 
                value={treatmentPlan} 
                onChange={e => setTreatmentPlan(e.target.value)}
                placeholder="List therapies, drugs, dosing intervals, follow-up dates..."
                rows={4}
                className="w-full p-4 rounded-2xl bg-inner-bg border border-border-accent text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:border-emerald-500/30 outline-none transition-colors"
              />
            </div>

            {/* Electronic Prescription Dispatcher */}
            <div className="bg-inner-bg p-5 border border-border-accent rounded-2xl space-y-4">
              <div className="flex items-center gap-2 text-emerald-400">
                <Pill size={14} />
                <h4 className="text-[10px] font-black uppercase tracking-widest">Electronic Prescription Dispatch (e-Rx)</h4>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input 
                  type="text" 
                  placeholder="Medication Name (e.g. Amoxicillin 500mg)" 
                  value={prescMedName}
                  onChange={e => setPrescMedName(e.target.value)}
                  className="px-3 py-2 text-xs bg-card-bg border border-border-accent rounded-xl text-text-main placeholder:text-text-dim focus:outline-none focus:border-emerald-500/30"
                />
                <input 
                  type="text" 
                  placeholder="Dosage Instruction (e.g. 1 tab 3x daily)" 
                  value={prescDosage}
                  onChange={e => setPrescDosage(e.target.value)}
                  className="px-3 py-2 text-xs bg-card-bg border border-border-accent rounded-xl text-text-main placeholder:text-text-dim focus:outline-none focus:border-emerald-500/30"
                />
                <select 
                  value={prescPharmacy}
                  onChange={e => setPrescPharmacy(e.target.value)}
                  className="px-3 py-2 text-xs bg-card-bg border border-border-accent rounded-xl text-text-main focus:outline-none focus:border-emerald-500/30 font-bold"
                >
                  <option value="">-- Select Pharmacy --</option>
                  <option value="Olasun Central Pharmacy">Olasun Central Pharmacy (In-Facility)</option>
                  <option value="RxExpress Dispensing Center">RxExpress Dispensing Center</option>
                  <option value="CVS CareLink 24/7">CVS CareLink 24/7</option>
                  <option value="Walgreens Local Hub">Walgreens Local Hub</option>
                </select>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={handleDispatchPrescription}
                  disabled={!prescMedName || !prescDosage || !prescPharmacy || isPrescribing}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md shadow-emerald-500/10 flex items-center gap-1.5"
                >
                  <Send size={10} />
                  {isPrescribing ? 'Transmitting e-Rx...' : 'Transmit e-Prescription'}
                </button>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-4 border-t border-border-accent/10 flex justify-between items-center">
              <span className="text-[9px] font-mono text-text-dim">Required: ATTENDING PHYSICIAN FINAL REVIEW</span>
              <div className="flex gap-4">
                <button 
                  onClick={onBack}
                  className="px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-text-muted rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Cancel Note
                </button>
                <button 
                  onClick={handleSaveConsultation}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20"
                >
                  Save & Terminate Consultation
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* ================= RIGHT PANEL: CHRONOLOGY, LABS & AI CLINICAL ASSISTANT ================= */}
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-card-bg border border-border-accent rounded-[32px] p-6 shadow-xl space-y-6">
            
            {/* Tab navigation for Right Panel */}
            <div className="bg-inner-bg p-1 rounded-2xl border border-border-accent flex shadow-inner">
              <button
                onClick={() => setActiveRightTab('ai')}
                className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeRightTab === 'ai' ? 'bg-emerald-600 text-white shadow-md' : 'text-text-dim hover:text-text-main'}`}
              >
                AI assistant
              </button>
              <button
                onClick={() => setActiveRightTab('timeline')}
                className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeRightTab === 'timeline' ? 'bg-emerald-600 text-white shadow-md' : 'text-text-dim hover:text-text-main'}`}
              >
                Visits
              </button>
              <button
                onClick={() => setActiveRightTab('trends')}
                className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeRightTab === 'trends' ? 'bg-emerald-600 text-white shadow-md' : 'text-text-dim hover:text-text-main'}`}
              >
                Diagnostics
              </button>
            </div>

            {/* TAB CONTENTS: AI CLINICAL ASSISTANT */}
            {activeRightTab === 'ai' && (
              <div className="space-y-6">
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl">
                  <h4 className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2 mb-1.5">
                    <Brain size={14} className="text-emerald-500" />
                    Clinical AI Nexus
                  </h4>
                  <p className="text-[10px] text-text-dim leading-relaxed font-medium">
                    Fully automated diagnostic verification hub. All suggestions must be audited and signed off by the practitioner before EHR execution.
                  </p>
                </div>

                {/* Interactive AI Triggers */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-text-dim tracking-widest pl-1 block">Clinical AI Protocols</label>
                  
                  <AiTriggerButton icon={<Brain size={12} />} label="Summarize Patient History" onClick={() => runAiClinicalAssistant('summarize_history')} disabled={aiLoading} />
                  <AiTriggerButton icon={<Activity size={12} />} label="Highlight Abnormal Trends" onClick={() => runAiClinicalAssistant('abnormal_trends')} disabled={aiLoading} />
                  <AiTriggerButton icon={<Sparkles size={12} />} label="Suggest Differential Diagnoses" onClick={() => runAiClinicalAssistant('suggest_diagnoses')} disabled={aiLoading} />
                  <AiTriggerButton icon={<AlertTriangle size={12} />} label="Check Drug Interactions" onClick={() => runAiClinicalAssistant('check_interactions')} disabled={aiLoading} />
                  <AiTriggerButton icon={<Award size={12} />} label="Recommend Clinical Guidelines" onClick={() => runAiClinicalAssistant('recommend_guidelines')} disabled={aiLoading} />
                  <AiTriggerButton icon={<FileText size={12} />} label="Draft Visit SOAP Note" onClick={() => runAiClinicalAssistant('draft_summary')} disabled={aiLoading} />
                  <AiTriggerButton icon={<HelpCircle size={12} />} label="Generate Patient Explanation" onClick={() => runAiClinicalAssistant('patient_explanation')} disabled={aiLoading} />
                </div>

                {/* AI Assistant Output Box */}
                <AnimatePresence>
                  {(aiLoading || aiOutput) && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-inner-bg p-5 border border-border-accent rounded-2xl relative"
                    >
                      {aiLoading ? (
                        <div className="py-10 text-center text-[10px] font-black uppercase tracking-widest text-emerald-400 animate-pulse flex flex-col items-center gap-3">
                           <Brain className="animate-spin text-emerald-500" size={24} />
                           Securing Clinical Logic...
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center border-b border-border-accent/15 pb-2">
                            <span className="text-[9px] font-black uppercase text-emerald-400 tracking-widest">Nexus Suggestions</span>
                            <span className="text-[8px] font-mono text-text-dim uppercase bg-card-bg px-2 py-0.5 rounded border border-border-accent">L3_DEDUCTION</span>
                          </div>
                          
                          {/* Markdown Text Area */}
                          <div className="text-xs text-text-muted leading-relaxed font-sans overflow-y-auto max-h-96 pr-1 markdown-body select-text">
                            <Markdown>{aiOutput}</Markdown>
                          </div>

                          {/* Review & Approve Interface */}
                          <div className="pt-3 border-t border-border-accent/15 flex flex-col gap-3">
                            <div className="flex items-center gap-2 text-[9px] font-black uppercase text-amber-500 tracking-widest bg-amber-500/5 p-2 border border-amber-500/10 rounded-lg">
                              <AlertTriangle size={12} />
                              Physician Review Required
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => setAiOutput('')}
                                className="flex-1 py-2 border border-white/10 hover:bg-white/5 text-[9px] font-black uppercase tracking-widest text-text-muted rounded-lg"
                              >
                                Decline
                              </button>
                              <button 
                                onClick={handleApproveAiRecommendation}
                                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-1 shadow-md shadow-emerald-500/15"
                              >
                                <Check size={10} />
                                Approve & Apply
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>
            )}

            {/* TAB CONTENTS: PREVIOUS VISITS CHRONOLOGY */}
            {activeRightTab === 'timeline' && (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                <PatientTimeline patientId={patientId} />
              </div>
            )}

            {/* TAB CONTENTS: LABS & IMAGING DIAGNOSTICS */}
            {activeRightTab === 'trends' && (
              <div className="space-y-6">
                
                {/* Quick-Order Diagnostics Panel */}
                <div className="bg-inner-bg p-5 border border-border-accent rounded-2xl space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                    <Activity size={12} />
                    Order Diagnostics Hub
                  </h4>
                  <div className="flex gap-2">
                    <select 
                      value={orderTestName} 
                      onChange={e => {
                        const name = e.target.value;
                        setOrderTestName(name);
                        if (['Chest X-Ray', 'Abdominal Ultrasound', 'Brain MRI'].includes(name)) {
                          setOrderType('imaging');
                        } else {
                          setOrderType('lab');
                        }
                      }}
                      className="flex-1 bg-card-bg border border-border-accent text-[11px] rounded-xl px-3 py-2 text-text-main focus:outline-none focus:border-emerald-500/30 font-bold"
                    >
                      <option value="">-- Select Diagnostic Test --</option>
                      <optgroup label="Laboratory Tests">
                        <option value="Complete Blood Count (CBC)">Complete Blood Count (CBC)</option>
                        <option value="Basic Metabolic Panel (BMP)">Basic Metabolic Panel (BMP)</option>
                        <option value="Lipid Panel">Lipid Panel</option>
                        <option value="HbA1c Level">HbA1c Level</option>
                        <option value="Thyroid Stimulating Hormone (TSH)">Thyroid Stimulating Hormone (TSH)</option>
                      </optgroup>
                      <optgroup label="Radiology & Imaging Scans">
                        <option value="Chest X-Ray">Chest X-Ray</option>
                        <option value="Abdominal Ultrasound">Abdominal Ultrasound</option>
                        <option value="Brain MRI">Brain MRI</option>
                        <option value="Electrocardiogram (ECG)">Electrocardiogram (ECG)</option>
                      </optgroup>
                    </select>
                    
                    <button 
                      onClick={handleOrderDiagnostic}
                      disabled={!orderTestName || isOrdering}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md shadow-emerald-500/10"
                    >
                      {isOrdering ? 'Dispatching...' : 'Order'}
                    </button>
                  </div>
                </div>

                {/* Lab Results Column */}
                <div className="space-y-3.5">
                  <h4 className="text-[10px] font-black uppercase text-text-dim tracking-widest pl-1">Laboratory Reports</h4>
                  <div className="space-y-3">
                    {labResults.map((lab) => (
                      <div 
                        key={lab.id} 
                        className={`p-4 rounded-2xl border transition-all ${lab.abnormal ? 'bg-rose-500/5 border-rose-500/20 text-rose-300' : 'bg-inner-bg border-border-accent text-text-muted'}`}
                      >
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-xs font-black uppercase truncate max-w-[150px]">{lab.title}</span>
                          <span className="text-[9px] font-mono text-text-dim">{lab.date}</span>
                        </div>
                        <p className="text-[11px] font-medium leading-relaxed font-mono">
                          {lab.desc}
                        </p>
                        {lab.abnormal && (
                          <div className="mt-2 text-[8px] font-black uppercase tracking-widest text-rose-400 flex items-center gap-1">
                            <AlertTriangle size={10} />
                            ABNORMAL BIOMETRIC INDEX
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Imaging Column */}
                <div className="space-y-3.5 pt-4 border-t border-border-accent/15">
                  <h4 className="text-[10px] font-black uppercase text-text-dim tracking-widest pl-1">Imaging & Radiograph Records</h4>
                  <div className="space-y-3">
                    {imagingRecords.map((img) => (
                      <div key={img.id} className="p-4 bg-inner-bg border border-border-accent rounded-2xl text-text-muted">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-xs font-black uppercase truncate">{img.title}</span>
                          <span className="text-[9px] font-mono text-text-dim">{img.date}</span>
                        </div>
                        <p className="text-[11px] font-medium leading-relaxed font-sans italic opacity-85">
                          "{img.desc}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}

// Sub-components
function AiTriggerButton({ icon, label, onClick, disabled }: { icon: React.ReactNode, label: string, onClick: () => void, disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full text-left px-4 py-3 bg-inner-bg hover:bg-emerald-500/10 border border-border-accent hover:border-emerald-500/30 rounded-xl transition-all flex items-center gap-3 text-xs font-bold text-text-muted hover:text-emerald-400 disabled:opacity-40 disabled:pointer-events-none group"
    >
      <div className="p-1.5 bg-card-bg border border-border-accent rounded-lg text-text-dim group-hover:text-emerald-400 group-hover:bg-emerald-500/10 transition-colors">
        {icon}
      </div>
      <span className="truncate">{label}</span>
      <ChevronRight size={12} className="ml-auto text-text-dim group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
    </button>
  );
}
