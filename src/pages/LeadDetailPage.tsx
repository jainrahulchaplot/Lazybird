// LeadDetailPage.tsx  — fixed & streamlined
import React, { useEffect, useState } from "react";
import { db } from "../lib/supabase";
import { gmailUtils } from "../lib/gmail";
import { Card, CardHeader, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, TextArea } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { FitScoreCard } from "../components/leads/FitScoreCard";
import { CompanyInfoCard } from "../components/leads/CompanyInfoCard";
import {
  AlertCircle,
  ArrowLeft,
  Brain,
  Building2,
  Calendar,
  CheckCircle,
  Edit3,
  Eye,
  File,
  Key,
  Linkedin,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  Save,
  Send,
  Sparkles,
  Target,
  User,
  X,
  Search
} from "lucide-react";
import { Lead, Contact, Application, Message } from "../types";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { useGlobalStore } from "../stores/globalStore";
import { LushaEnrichmentModal } from "../components/ui/LushaEnrichmentModal";

type Tab = "overview" | "my-fit" | "contacts" | "my-applications";

interface LeadDetailPageProps {
  leadId: string;
  onBack: () => void;
}

interface LeadFormData {
  company: string;
  role: string;
  location: string;
  seniority: string;
  description_text: string;
  must_haves: string[];
  nice_to_haves: string[];
  keywords: string[];
}

interface ContactFormData {
  name: string;
  title: string;
  email: string;
  phone: string;
  linkedin_url: string;
}

interface CoverLetterData {
  content: string;
  tone: string;
  length: string;
  generated_at?: string;
}

interface ResumeData {
  id?: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  uploaded_at: string;
}

export const LeadDetailPage: React.FC<LeadDetailPageProps> = ({ leadId, onBack }) => {
  const { settings, user } = useGlobalStore();
  


  // Load settings if not available
  useEffect(() => {
    if (!settings) {
      const loadSettings = async () => {
        try {
          const { data, error } = await db.getSettings();
          if (!error && data) {
            // Update global store settings
            useGlobalStore.getState().setSettings(data as any);
          }
        } catch (error) {
          console.error('Failed to load settings in LeadDetailPage:', error);
        }
      };
      loadSettings();
    }
  }, [settings]);

  // Show loading if settings are not loaded yet
  if (!settings) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
        <span className="ml-2 text-gray-600">Loading settings...</span>
      </div>
    );
  }

  // core entities
  const [lead, setLead] = useState<Lead | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [application, setApplication] = useState<Application | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // ui state
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [saving, setSaving] = useState(false);

  // lead edit
  const [editingLead, setEditingLead] = useState(false);
  const [leadFormData, setLeadFormData] = useState<LeadFormData>({
    company: "",
    role: "",
    location: "",
    seniority: "",
    description_text: "",
    must_haves: [],
    nice_to_haves: [],
    keywords: []
  });

  // contacts
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactFormData, setContactFormData] = useState<ContactFormData>({
    name: "",
    title: "",
    email: "",
    phone: "",
    linkedin_url: ""
  });

  // resumes
  const [availableResumes, setAvailableResumes] = useState<any[]>([]);
  const [loadingResumes, setLoadingResumes] = useState(false);
  const [resume, setResume] = useState<ResumeData | null>(null);

  // cover letter + email gen
  const [coverLetter, setCoverLetter] = useState<CoverLetterData | null>(null);
  const [generatingCoverLetter, setGeneratingCoverLetter] = useState(false);
  const [coverLetterTone, setCoverLetterTone] = useState("professional");
  const [coverLetterLength, setCoverLetterLength] = useState("medium");

  const [emailGeneratorTone, setEmailGeneratorTone] = useState("professional");
  const [emailGeneratorDepth, setEmailGeneratorDepth] = useState("basic");
  const [emailGeneratorContext, setEmailGeneratorContext] = useState("");
  const [generatedEmailSubject, setGeneratedEmailSubject] = useState("");
  const [generatedEmailBody, setGeneratedEmailBody] = useState("");
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);

  // applications drawer
  const [showApplicationsDrawer, setShowApplicationsDrawer] = useState(false);
  const [sendingApplication, setSendingApplication] = useState(false);
  const [testingGmail, setTestingGmail] = useState(false);
  const [gmailStatus, setGmailStatus] = useState("");

  // State for contact selection
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [fitAnalysis, setFitAnalysis] = useState<any>(null);
  const [companyResearch, setCompanyResearch] = useState<any>(null);
  const [isLoadingFit, setIsLoadingFit] = useState(false);
  const [isLoadingCompany, setIsLoadingCompany] = useState(false);

  // State for Lusha enrichment
  const [enrichingContactId, setEnrichingContactId] = useState<string | null>(null);

  // State for applications and Gmail
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedThread, setSelectedThread] = useState<any>(null);
  const [isLoadingApplications, setIsLoadingApplications] = useState(false);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [isGeneratingFollowUp, setIsGeneratingFollowUp] = useState(false);
  const [followUpEmail, setFollowUpEmail] = useState({ subject: '', body: '' });

  // Auto-select contact if only one exists
  useEffect(() => {
    if (contacts.length === 1 && !selectedContact) {
      setSelectedContact(contacts[0]);
    }
  }, [contacts, selectedContact]);

  // Load fit analysis and company research
  useEffect(() => {
    if (!lead) return;
    
    // Check if we already have stored data
    if (lead.fit_analysis && !fitAnalysis) {
      console.log('Using stored fit analysis data');
      setFitAnalysis(lead.fit_analysis);
    }
    
    if (lead.company_research && !companyResearch) {
      console.log('Using stored company research data');
      setCompanyResearch(lead.company_research);
    }
    
    // Only make API calls if we don't have the data
    if (!lead.fit_analysis) {
      loadFitAnalysis();
    }
    
    if (!lead.company_research) {
      loadCompanyResearch();
    }
  }, [lead]);

  const loadFitAnalysis = async () => {
    if (!lead) return;
    setIsLoadingFit(true);
    try {
      const analysis = await computeFitScore(lead.id, undefined);
      setFitAnalysis(analysis);
    } catch (e) {
      console.error('Fit analysis failed:', e);
    } finally {
      setIsLoadingFit(false);
    }
  };

  const loadCompanyResearch = async () => {
    if (!lead?.company) return;
    setIsLoadingCompany(true);
    try {
      const research = await fetchCompanyInfo(lead.company);
      setCompanyResearch(research);
    } catch (e) {
      console.error('Company research failed:', e);
    } finally {
      setIsLoadingCompany(false);
    }
  };

  // Load applications for this lead
  const loadApplications = async () => {
    if (!lead?.id) return;
    
    setIsLoadingApplications(true);
    try {
      const response = await fetch('http://localhost:3001/api/gmail/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id })
      });
      
      if (response.ok) {
        const data = await response.json();
        setApplications(data.applications || []);
      }
    } catch (error) {
      console.error('Failed to load applications:', error);
    } finally {
      setIsLoadingApplications(false);
    }
  };

  // Load email thread
  const loadThread = async (threadId: string) => {
    setIsLoadingThread(true);
    try {
      const response = await fetch('http://localhost:3001/api/gmail/thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId })
      });
      
      if (response.ok) {
        const data = await response.json();
        setSelectedThread(data.thread);
      }
    } catch (error) {
      console.error('Failed to load thread:', error);
    } finally {
      setIsLoadingThread(false);
    }
  };

  // Generate AI follow-up email
  const generateFollowUp = async () => {
    if (!selectedThread || !lead) return;
    
    setIsGeneratingFollowUp(true);
    try {
      const response = await fetch('http://localhost:3001/api/openai/generate-email-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          resumeId: resume?.id,
          tone: 'professional',
          researchDepth: 'detailed',
          customContext: `Generate a follow-up email for this application thread. Previous emails: ${JSON.stringify(selectedThread.messages)}`,
          leadData: lead,
          contactInfo: selectedContact,
          enhancedContext: {
            companyResearch,
            fitAnalysis,
            knowledgeChunks: [],
            selectedResume: resume,
            contactInfo: selectedContact
          }
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setFollowUpEmail({
          subject: data.subject || 'Follow-up',
          body: data.body || ''
        });
      }
    } catch (error) {
      console.error('Failed to generate follow-up:', error);
    } finally {
      setIsGeneratingFollowUp(false);
    }
  };

  // Send follow-up email
  const sendFollowUp = async () => {
    if (!selectedThread || !followUpEmail.subject || !followUpEmail.body) return;
    
    try {
      const response = await fetch('http://localhost:3001/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedThread.messages[0]?.to || selectedContact?.email,
          subject: followUpEmail.subject,
          body: followUpEmail.body,
          threadId: selectedThread.id
        })
      });
      
      if (response.ok) {
        // Reload thread to show new email
        await loadThread(selectedThread.id);
        setFollowUpEmail({ subject: '', body: '' });
      }
    } catch (error) {
      console.error('Failed to send follow-up:', error);
    }
  };

  // ---- helper calls (keep your existing API routes) ----

  const fetchCompanyInfo = async (companyName: string) => {
    const res = await fetch("/api/openai/company-research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName, leadId })
    });
    if (!res.ok) throw new Error("company research failed");
    const data = await res.json();
    return data.companyInfo;
  };

  const computeFitScore = async (leadId_: string, resumeId?: string) => {
    const res = await fetch("/api/openai/fit-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: leadId_,
        resumeId,
        leadData: lead,
        resumeData: availableResumes.find((r) => r.id === resumeId)
      })
    });
    if (!res.ok) throw new Error("fit analysis failed");
    const data = await res.json();
    return data.fitAnalysis;
  };

  const listApplications = async (leadId_: string) => {
    const res = await fetch("/api/gmail/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: leadId_, companyName: lead?.company, roleName: lead?.role })
    });
    if (!res.ok) throw new Error("applications fetch failed");
    const data = await res.json();
    return data.applications;
  };

  const getThread = async (threadId: string) => {
    const res = await fetch("/api/gmail/thread", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, leadId })
    });
    if (!res.ok) throw new Error("thread fetch failed");
    const data = await res.json();
    return data.messages;
  };

  const generateEmailDraft = async (opts: {
    tone: string;
    researchDepth: string;
    context?: string;
    leadId: string;
    resumeId?: string;
    enhancedContext?: any;
  }) => {
      const res = await fetch("http://localhost:3001/api/openai/generate-email-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: opts.leadId,
          resumeId: opts.resumeId,
          tone: opts.tone,
          researchDepth: opts.researchDepth,
          customContext: opts.context,
          enhancedContext: opts.enhancedContext,
          leadData: {
            company: lead?.company,
            role: lead?.role,
            location: lead?.location,
            seniority: lead?.seniority,
            description: lead?.description_text,
            mustHaves: lead?.must_haves,
            niceToHaves: lead?.nice_to_haves,
            keywords: lead?.keywords
          },
          contactInfo: {
            name: contacts.find((c) => c.name)?.name,
            email: contacts.find((c) => c.email)?.email,
            mobile: contacts.find((c) => c.phone)?.phone
          }
        })
      });
      if (!res.ok) throw new Error("email draft failed");
    const data = await res.json();
    return { subject: data.subject, body: data.body, generatedAt: data.generatedAt || new Date().toISOString() };
  };

  // ---- data bootstrap ----
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        const { data: leadData, error: leadErr } = await db.getLead(leadId);
        if (leadErr) throw leadErr;
        if (leadData) {
          const lead_ = leadData as Lead;
          setLead(lead_);
          setContacts((leadData as any).contacts || []);
          setLeadFormData({
            company: lead_.company || "",
            role: lead_.role || "",
            location: lead_.location || "",
            seniority: lead_.seniority || "",
            description_text: lead_.description_text || "",
            must_haves: lead_.must_haves || [],
            nice_to_haves: lead_.nice_to_haves || [],
            keywords: lead_.keywords || []
          });

          if ((leadData as any).applications?.length) {
            const app = (leadData as any).applications[0] as Application;
            setApplication(app);
            setMessages(app.messages || []);
          } else {
            const { data: newApp } = await db.createApplication({ lead_id: leadId, stage: "identified" });
            if (newApp) setApplication(newApp as Application);
          }
        }

        // resumes
        setLoadingResumes(true);
        const { data: resumes, error: resumesErr } = await db.getResumes();
        if (resumesErr) throw resumesErr;
        const transformed = (Array.isArray(resumes) ? resumes : []).map((r: any) => ({
          id: r.id,
          filename: r.title || r.filename || "Resume",
          name: r.title || r.filename || "Resume",
          file_url: r.file_url || r.url || r.storage_path,
          url: r.file_url || r.url || r.storage_path,
          size: r.size || 0,
          created_at: r.created_at,
          focus_tags: r.focus_tags || [],
          tags: r.focus_tags || [],
          description: r.description || r.title || "No description available",
          json_struct: r.json_struct
        }));
        setAvailableResumes(transformed);

        // autoselect single resume
        if (transformed.length === 1 && transformed[0].file_url) {
          setResume({
            id: transformed[0].id,
            fileUrl: transformed[0].file_url,
            fileName: transformed[0].filename || transformed[0].name,
            fileSize: transformed[0].size || 0,
            uploaded_at: transformed[0].created_at || new Date().toISOString()
          });
        }
      } catch (e) {
        console.error(e);
        toast.error("Failed to load lead details");
      } finally {
        setLoading(false);
        setLoadingResumes(false);
      }
    })();
  }, [leadId]);

  // Load applications when component mounts
  useEffect(() => {
    if (activeTab === 'my-applications') {
      loadApplications();
    }
  }, [activeTab, lead?.id]);

  // ---- handlers ----

  const handleSaveLead = async () => {
    if (!leadFormData.company.trim() || !leadFormData.role.trim()) {
      toast.error("Company and role are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leadFormData)
      });
      const result = await res.json();
      if (!result.success) throw new Error("update failed");
      setLead(result.data);
      setEditingLead(false);
      toast.success("Lead updated");
    } catch (error: any) {
      console.error("Failed to update lead:", error);
      toast.error(`Failed to update lead: ${error.message || "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const resetContactForm = () => {
    setContactFormData({ name: "", title: "", email: "", phone: "", linkedin_url: "" });
    setEditingContactId(null);
    setShowContactForm(false);
  };

  const handleEditContact = (c: Contact) => {
    setContactFormData({
      name: c.name || "",
      title: c.title || "",
      email: c.email || "",
      phone: c.phone || "",
      linkedin_url: c.linkedin_url || ""
    });
    setEditingContactId(c.id);
    setShowContactForm(true);
  };

  const handleSaveContact = async () => {
    if (!contactFormData.name.trim()) {
      toast.error("Contact name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...contactFormData, lead_id: leadId };
      if (editingContactId) {
        const { data, error } = await db.updateContact(editingContactId, payload);
        if (error) throw error;
        setContacts((prev) => prev.map((c) => (c.id === editingContactId ? (data as Contact) : c)));
        toast.success("Contact updated");
      } else {
        const { data, error } = await db.createContact(payload);
        if (error) throw error;
        setContacts((prev) => [data as Contact, ...prev]);
        toast.success("Contact created");
      }
      resetContactForm();
    } catch {
      toast.error("Failed to save contact");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (!confirm("Delete this contact?")) return;
    try {
      const { error } = await db.deleteContact(id);
      if (error) throw error;
      setContacts((prev) => prev.filter((c) => c.id !== id));
      toast.success("Contact deleted");
    } catch {
      toast.error("Failed to delete contact");
    }
  };

  const handleResumeSelect = (r: any) => {
    const url = r.file_url || r.url;
    if (!url) return toast.error("Invalid resume (no URL)");
    if (url.startsWith("blob:")) return toast.error("Invalid resume file");
    if (!url.includes("supabase.co") && !url.includes("storage.googleapis.com"))
      return toast.error("Invalid resume URL");
    setResume({
      fileUrl: url,
      fileName: r.filename || r.name,
      fileSize: r.size || 0,
      uploaded_at: r.created_at || new Date().toISOString()
    });
    toast.success("Resume selected");
  };

  const handleResumeDeselect = () => setResume(null);

  const testGmailConnection = async () => {
    setTestingGmail(true);
    setGmailStatus("");
    try {
      const result = await gmailUtils.testConnection();
      if (result.success) {
        setGmailStatus(`✅ Connected to ${result.email}`);
        toast.success("Gmail connected");
      } else {
        setGmailStatus(`❌ ${result.error}`);
        toast.error(result.error || "Gmail connection failed");
      }
    } catch {
      setGmailStatus("❌ Connection test failed");
      toast.error("Failed to test Gmail connection");
    } finally {
      setTestingGmail(false);
    }
  };

  const handleSendApplication = async () => {
    if (!coverLetter?.content) return toast.error("Generate a cover letter first");
    const contactEmail = contacts.find((c) => c.email)?.email;
    if (!contactEmail) return toast.error("Add a contact with email");
    if (!resume?.fileUrl) return toast.error("Select a resume");

    setSendingApplication(true);
    try {
      if (resume.fileUrl.startsWith("blob:")) throw new Error("invalid resume");
      const result = await gmailUtils.sendEmail(leadId, contactEmail, coverLetter.content, resume.fileUrl);
      if (!result.success) throw new Error(result.error || "send failed");
      toast.success("Application sent");
      if (application) {
        const { data: updated } = await db.updateApplication(application.id, {
          stage: "applied",
          last_action_at: new Date().toISOString()
        });
        if (updated) setApplication(updated as Application);
      }
    } catch (e: any) {
      toast.error(`Failed to send: ${e.message || "unknown error"}`);
    } finally {
      setSendingApplication(false);
    }
  };

  const handleDeleteApplication = async (threadId: string) => {
    if (!confirm('Are you sure you want to delete this application thread? This will permanently remove all messages and cannot be undone.')) return;
    
    try {
      // Find the application that matches this thread
      const app = applications.find(a => a.threadId === threadId);
      if (!app) {
        toast.error('Application not found');
        return;
      }
      
      // Delete the message thread
      const { error } = await db.deleteMessageThread(threadId);
      if (error) {
        toast.error(`Failed to delete thread: ${error}`);
        return;
      }
      
      // Remove from local state
      setApplications(prev => prev.filter(a => a.threadId !== threadId));
      
      // Clear selected thread if it was the deleted one
      if (selectedThread?.id === threadId) {
        setSelectedThread(null);
      }
      
      toast.success('Application thread deleted successfully');
    } catch (err) {
      toast.error('Failed to delete application thread');
    }
  };

  // Lusha enrichment modal state
  const [lushaModalOpen, setLushaModalOpen] = useState(false);
  const [lushaContacts, setLushaContacts] = useState<any[]>([]);
  const [enrichingContact, setEnrichingContact] = useState<Contact | null>(null);

  // Lusha contact enrichment
  const handleEnrichContact = async (contact: Contact) => {
    if (!contact.name || !lead?.company) {
      toast.error("Contact name and company are required for enrichment");
      return;
    }

    setEnrichingContact(contact);
    setEnrichingContactId(contact.id);
    try {
      // Call Lusha API to find contact details
      const response = await fetch("http://localhost:3001/api/lusha/enrich-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: contact.name.split(" ")[0],
          lastName: contact.name.split(" ").slice(1).join(" "),
          company: lead.company
        })
      });

      if (!response.ok) {
        throw new Error("Failed to enrich contact");
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        // Show modal with all results
        setLushaContacts(result.data);
        setLushaModalOpen(true);
      } else {
        toast.error("No additional contact information found");
      }
    } catch (error: any) {
      console.error("Contact enrichment failed:", error);
      toast.error(`Enrichment failed: ${error.message || "Unknown error"}`);
    } finally {
      setEnrichingContactId(null);
    }
  };

  // Handle contact selection from Lusha modal
  const handleLushaContactSelection = async (selectedContacts: any[]) => {
    if (!enrichingContact || selectedContacts.length === 0) return;

    try {
      // For now, use the first selected contact (can be enhanced for multiple)
      const selectedContact = selectedContacts[0];
      
      // Update contact with enriched data
      const enrichedData = {
        name: enrichingContact.name,
        title: selectedContact.title || enrichingContact.title,
        email: selectedContact.email || enrichingContact.email,
        phone: selectedContact.phone || enrichingContact.phone,
        linkedin_url: selectedContact.linkedin_url || enrichingContact.linkedin_url
      };

      const { data: updatedContact, error } = await db.updateContact(enrichingContact.id, enrichedData);
      
      if (error) throw error;
      
      // Update local state
      setContacts((prev) => prev.map((c) => 
        c.id === enrichingContact.id ? (updatedContact as Contact) : c
      ));
      
      // Refresh lead data to ensure persistence
      try {
        const { data: refreshedLead, error: refreshError } = await db.getLead(leadId);
        if (!refreshError && refreshedLead) {
          setLead(refreshedLead as Lead);
          setContacts((refreshedLead as any).contacts || []);
        }
      } catch (refreshError) {
        console.warn('Failed to refresh lead data:', refreshError);
      }
      
      toast.success(`Contact enriched with ${selectedContacts.length} Lusha contact(s)!`);
    } catch (error: any) {
      console.error("Failed to update contact:", error);
      toast.error(`Failed to update contact: ${error.message || "Unknown error"}`);
    }
  };

  // ---- render ----

  if (loading) return <LoadingSpinner size="lg" text="Loading lead details..." />;

  if (!lead)
    return (
      <div className="text-center py-20">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Lead not found</h2>
        <p className="text-gray-600 mb-6">It may not exist or was deleted.</p>
        <Button onClick={onBack} icon={ArrowLeft}>
          Back to Leads
        </Button>
      </div>
    );

  return (
    <div className="space-y-6 pt-6">
      {/* Back */}
      <div className="mb-4">
        <Button onClick={onBack} variant="ghost" icon={ArrowLeft} size="sm">
          Back to Leads
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: "overview", label: "Overview", icon: Target },
            { id: "my-applications", label: "My Applications", icon: MessageSquare }
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as Tab)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === (t.id as Tab)
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Job Details"
              action={
                <Button onClick={() => setEditingLead(!editingLead)} variant="ghost" size="sm" icon={editingLead ? X : Edit3}>
                  {editingLead ? "Cancel" : "Edit"}
                </Button>
              }
            />
            <CardBody>
              {editingLead ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Company *"
                      value={leadFormData.company}
                      onChange={(e) => setLeadFormData((p) => ({ ...p, company: e.target.value }))}
                      placeholder="Company name"
                      icon={Building2}
                    />
                    <Input
                      label="Role *"
                      value={leadFormData.role}
                      onChange={(e) => setLeadFormData((p) => ({ ...p, role: e.target.value }))}
                      placeholder="Job title"
                      icon={Target}
                    />
                    <Input
                      label="Location"
                      value={leadFormData.location}
                      onChange={(e) => setLeadFormData((p) => ({ ...p, location: e.target.value }))}
                      placeholder="Location"
                      icon={MapPin}
                    />
                    <Input
                      label="Seniority"
                      value={leadFormData.seniority}
                      onChange={(e) => setLeadFormData((p) => ({ ...p, seniority: e.target.value }))}
                      placeholder="Seniority"
                    />
                  </div>

                  <TextArea
                    label="Job Description"
                    value={leadFormData.description_text}
                    onChange={(e) => setLeadFormData((p) => ({ ...p, description_text: e.target.value }))}
                    placeholder="Job description..."
                    rows={8}
                  />

                  <div className="flex gap-2">
                    <Button onClick={handleSaveLead} loading={saving} icon={Save}>
                      Save Changes
                    </Button>
                    <Button onClick={() => setEditingLead(false)} variant="outline">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Company:</span>
                      <span>{lead.company}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Target className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Role:</span>
                      <span>{lead.role}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Location:</span>
                      <span>{lead.location || "Not specified"}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Added:</span>
                      <span>{format(new Date(lead.created_at), "MMM d, yyyy")}</span>
                    </div>
                  </div>

                  {lead.description_text && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Job Description</h4>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{lead.description_text}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Requirements */}
          {(lead.must_haves?.length ?? 0) > 0 && (
            <Card>
              <CardHeader title="Must Haves" />
              <CardBody>
                <div className="space-y-2">
                  {lead.must_haves!.map((req: string, i: number) => (
                    <div key={i} className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-red-500" />
                      <span className="text-sm">{req}</span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {(lead.nice_to_haves?.length ?? 0) > 0 && (
            <Card>
              <CardHeader title="Nice to Haves" />
              <CardBody>
                <div className="space-y-2">
                  {lead.nice_to_haves!.map((req: string, i: number) => (
                    <div key={i} className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm">{req}</span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {/* New Overview Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FitScoreCard analysis={fitAnalysis} isLoading={isLoadingFit} />
            <CompanyInfoCard companyName={lead.company} research={companyResearch} isLoading={isLoadingCompany} />
          </div>

          {/* Contact Selection */}
          <Card>
            <CardHeader 
              title="Contact Selection" 
              subtitle="Choose who to contact for this opportunity"
              action={
                <Button onClick={() => setShowContactForm(true)} icon={Plus} size="sm">
                  Add Contact
                </Button>
              }
            />
            <CardBody>
              {showContactForm && (
                <Card className="mb-6 border-blue-200 bg-blue-50">
                  <CardHeader
                    title={editingContactId ? "Edit Contact" : "Add New Contact"}
                    action={
                      <Button variant="ghost" size="sm" icon={X} onClick={resetContactForm}>
                        Cancel
                      </Button>
                    }
                  />
                  <CardBody>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                          label="Name *"
                          value={contactFormData.name}
                          onChange={(e) => setContactFormData((p) => ({ ...p, name: e.target.value }))}
                          placeholder="John Doe"
                          icon={User}
                        />
                        <Input
                          label="Title"
                          value={contactFormData.title}
                          onChange={(e) => setContactFormData((p) => ({ ...p, title: e.target.value }))}
                          placeholder="Hiring Manager"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input
                          label="Email"
                          type="email"
                          value={contactFormData.email}
                          onChange={(e) => setContactFormData((p) => ({ ...p, email: e.target.value }))}
                          placeholder="john@company.com"
                          icon={Mail}
                        />
                                                  <Input
                            label="Phone"
                            value={contactFormData.phone}
                            onChange={(e) => setContactFormData((p) => ({ ...p, phone: e.target.value }))}
                            placeholder="+1 234 567 8900"
                            icon={Phone}
                          />
                          
                        <Input
                          label="LinkedIn"
                          value={contactFormData.linkedin_url}
                          onChange={(e) => setContactFormData((p) => ({ ...p, linkedin_url: e.target.value }))}
                          placeholder="linkedin.com/in/johndoe"
                          icon={Linkedin}
                        />
                                              </div>
                        
                        <div className="flex gap-2">
                        <Button onClick={handleSaveContact} loading={saving} icon={Save}>
                          {editingContactId ? "Update" : "Add"} Contact
                        </Button>
                        <Button onClick={resetContactForm} variant="outline">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              )}

              {contacts.length === 0 ? (
                <div className="text-center py-8">
                  <User className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <h3 className="text-sm font-medium text-gray-900 mb-1">No contacts yet</h3>
                  <p className="text-xs text-gray-600">Add contacts to start building relationships</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {contacts.map((c) => (
                    <div
                      key={c.id}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        selectedContact?.id === c.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedContact(c)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{c.name}</h4>
                          {c.title && <p className="text-sm text-gray-600">{c.title}</p>}
                        </div>
                        <div className="flex items-center space-x-2">
                          {selectedContact?.id === c.id && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          )}
                          <Button size="sm" variant="ghost" icon={Edit3} onClick={(e) => {
                            e.stopPropagation();
                            handleEditContact(c);
                          }} />
                        </div>
                      </div>
                      <div className="mt-2 space-y-1">
                        {c.email && (
                          <div className="flex items-center space-x-2 text-xs">
                            <Mail className="h-3 w-3 text-gray-400" />
                            <span className="text-blue-600">{c.email}</span>
                          </div>
                        )}
                                                                          {c.phone && (
                          <div className="flex items-center space-x-2 text-xs">
                            <Phone className="h-3 w-3 text-gray-400" />
                            <span>{c.phone}</span>
                          </div>
                        )}
                        {c.linkedin_url && (
                          <div className="flex items-center space-x-2 text-xs">
                            <Linkedin className="h-3 w-3 text-gray-400" />
                            <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              LinkedIn Profile
                            </a>
                          </div>
                        )}
                      </div>
                      
                      {/* Enrich with Lusha Button */}
                      <div className="mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          icon={Search}
                          onClick={() => handleEnrichContact(c)}
                          loading={enrichingContactId === c.id}
                          fullWidth
                        >
                          {enrichingContactId === c.id ? "Enriching..." : "Enrich with Lusha"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Email Generator */}
          <Card>
            <CardHeader 
              title="Email Generator" 
              subtitle="Generate personalized email content for your application"
              action={
                <div className="flex items-center space-x-2">
                  {!settings?.openai_api_key && (
                    <Badge variant="warning" size="sm">
                      <Key className="h-3 w-3 mr-1" />
                      OpenAI not configured
                    </Badge>
                  )}
                </div>
              }
            />
            <CardBody>
              <div className="space-y-4">
                {/* Controls */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tone</label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={emailGeneratorTone}
                      onChange={(e) => setEmailGeneratorTone(e.target.value)}
                    >
                      <option value="professional">Professional</option>
                      <option value="casual">Casual</option>
                      <option value="enthusiastic">Enthusiastic</option>
                      <option value="formal">Formal</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Research Depth</label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={emailGeneratorDepth}
                      onChange={(e) => setEmailGeneratorDepth(e.target.value)}
                    >
                      <option value="basic">Basic</option>
                      <option value="deep">Deep</option>
                      <option value="comprehensive">Comprehensive</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Context (optional)</label>
                    <Input
                      placeholder="Additional context..."
                      value={emailGeneratorContext}
                      onChange={(e) => setEmailGeneratorContext(e.target.value)}
                    />
                  </div>
                </div>

                {/* Generate Button */}
                <div className="flex justify-center space-x-3">
                  <Button
                    onClick={async () => {
                      if (isGeneratingEmail) return;
                      if (!selectedContact) {
                        toast.error("Please select a contact first");
                        return;
                      }
                      setIsGeneratingEmail(true);
                      try {
                        // Gather comprehensive context
                        const selectedResume = resume ? availableResumes.find((r) => (r.file_url || r.url) === resume.fileUrl) : null;
                        
                        // Get company research if available
                        let companyResearch = null;
                        try {
                          if (lead.company) {
                            companyResearch = await fetchCompanyInfo(lead.company);
                          }
                        } catch (e) {
                          console.log('Company research not available, proceeding without it');
                        }

                        // Get fit analysis if available
                        let fitAnalysis = null;
                        try {
                          fitAnalysis = await computeFitScore(leadId, selectedResume?.id);
                        } catch (e) {
                          console.log('Fit analysis not available, proceeding without it');
                        }

                        // Get knowledge base chunks - search through ALL documents
                        let knowledgeChunks = [];
                        try {
                          console.log('🔍 Starting knowledge base search...');
                          
                          // Search for user profile and personal documents specifically
                          const profileResponse = await fetch('http://localhost:3001/api/documents/search', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              query: 'Rahul experience background skills projects work history resume',
                              threshold: 0.3,
                              limit: 15
                            })
                          });
                          
                          if (profileResponse.ok) {
                            const profileData = await profileResponse.json();
                            console.log('👤 Profile chunks found:', profileData.results?.length || 0);
                            knowledgeChunks = profileData.results || [];
                          }
                          
                          // Get all available chunks for comprehensive context
                          const allDocsResponse = await fetch('http://localhost:3001/api/documents/search', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              query: 'experience skills projects achievements background',
                              threshold: 0.2,
                              limit: 25
                            })
                          });
                          
                          if (allDocsResponse.ok) {
                            const allDocsData = await allDocsResponse.json();
                            console.log('📚 All chunks found:', allDocsData.results?.length || 0);
                            if (allDocsData.results) {
                              knowledgeChunks = [...knowledgeChunks, ...allDocsData.results];
                            }
                          }
                          
                          // Search for role-specific content
                          const roleResponse = await fetch('http://localhost:3001/api/documents/search', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              query: `${lead.company} ${lead.role} ${lead.description_text || ''} product management AI leadership`,
                              threshold: 0.5,
                              limit: 10
                            })
                          });
                          
                          if (roleResponse.ok) {
                            const roleData = await roleResponse.json();
                            console.log('🎯 Role-specific chunks found:', roleData.results?.length || 0);
                            if (roleData.results) {
                              knowledgeChunks = [...knowledgeChunks, ...roleData.results];
                            }
                          }
                          
                          // Remove duplicates and log final context
                          knowledgeChunks = knowledgeChunks.filter((chunk: any, index: number, self: any[]) => 
                            index === self.findIndex((c: any) => c.id === chunk.id)
                          );
                          
                          console.log('🧠 Final knowledge chunks for email generation:', knowledgeChunks.length);
                          console.log('📝 Sample chunks:', knowledgeChunks.slice(0, 3).map((c: any) => ({
                            id: c.id,
                            content: c.content?.substring(0, 100) + '...',
                            metadata: c.metadata
                          })));
                          
                          // DEBUG: Log the actual content being sent
                          console.log('🚨 ACTUAL KNOWLEDGE CHUNKS BEING SENT TO EMAIL GENERATION:');
                          knowledgeChunks.forEach((chunk: any, index: number) => {
                            console.log(`📄 CHUNK ${index + 1}:`);
                            console.log(`   ID: ${chunk.id}`);
                            console.log(`   Content: ${chunk.content?.substring(0, 200)}...`);
                            console.log(`   Metadata: ${JSON.stringify(chunk.metadata)}`);
                          });
                          
                        } catch (e) {
                          console.error('❌ Knowledge base search error:', e);
                        }

                        const draft = await generateEmailDraft({
                          tone: emailGeneratorTone,
                          researchDepth: emailGeneratorDepth,
                          context: emailGeneratorContext,
                          leadId,
                          resumeId: (resume?.id ? String(resume.id) : resume?.fileUrl) || undefined,
                          enhancedContext: {
                            companyResearch,
                            fitAnalysis,
                            knowledgeChunks,
                            selectedResume: selectedResume ? {
                              filename: selectedResume.filename || selectedResume.name,
                              focusTags: selectedResume.focus_tags || [],
                              description: selectedResume.description
                            } : null,
                            contactInfo: selectedContact ? {
                              name: selectedContact.name,
                              title: selectedContact.title,
                              email: selectedContact.email
                            } : null
                          }
                        });
                        setGeneratedEmailSubject(draft.subject);
                        setGeneratedEmailBody(draft.body);
                        toast.success("Smart email content generated with full context!");
                      } catch (e) {
                        console.error('Email generation error:', e);
                        toast.error("Failed to generate email content");
                      } finally {
                        setIsGeneratingEmail(false);
                      }
                    }}
                    icon={isGeneratingEmail ? LoadingSpinner : Sparkles}
                    size="sm"
                    variant="outline"
                    disabled={!settings?.openai_api_key || isGeneratingEmail || !selectedContact}
                  >
                    {isGeneratingEmail ? "Generating..." : "Generate Email Content"}
                  </Button>
                  
                  <Button
                    onClick={() => {
                      // Show prompt preview in console for now
                      console.log('🔍 Email Generation Prompt Preview:');
                      console.log('Tone:', emailGeneratorTone);
                      console.log('Research Depth:', emailGeneratorDepth);
                      console.log('Custom Context:', emailGeneratorContext);
                      console.log('Lead:', lead);
                      console.log('Selected Resume:', resume);
                      console.log('Contacts:', contacts);
                      toast.success('Check console for prompt preview');
                    }}
                    icon={Eye}
                    size="sm"
                    variant="outline"
                    disabled={!settings?.openai_api_key}
                  >
                    Preview Prompt
                  </Button>
                </div>

                {/* Generated Content */}
                {(generatedEmailSubject || generatedEmailBody) && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                      <Input
                        placeholder="Email subject..."
                        value={generatedEmailSubject}
                        onChange={(e) => setGeneratedEmailSubject(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Cover Letter</label>
                      <TextArea
                        placeholder="Email body content..."
                        value={generatedEmailBody}
                        onChange={(e) => setGeneratedEmailBody(e.target.value)}
                        rows={6}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        onClick={() => {
                          if (!generatedEmailBody.trim()) return toast.error("Nothing to save");
                          setCoverLetter({
                            content: generatedEmailBody,
                            tone: emailGeneratorTone,
                            length: emailGeneratorDepth,
                            generated_at: new Date().toISOString()
                          });
                          toast.success("Saved as cover letter!");
                        }}
                        icon={Save}
                        size="sm"
                        variant="outline"
                      >
                        Save as Cover Letter
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Resume picker on Overview */}
          <Card>
            <CardHeader title="Resume" subtitle="Select a resume from your uploads" />
            <CardBody>
              {loadingResumes ? (
                <div className="flex items-center justify-center p-8">
                  <LoadingSpinner size="sm" />
                  <span className="ml-2 text-sm text-gray-600">Loading resumes…</span>
                </div>
              ) : availableResumes.length === 0 ? (
                <div className="border-dashed border-2 border-gray-300 rounded-lg p-8 text-center">
                  <div className="p-3 bg-gray-100 rounded-lg inline-block mb-3">
                    <svg width="20" height="20" />
                  </div>
                  <h3 className="font-medium text-gray-900 mb-2">No Resumes</h3>
                  <p className="text-sm text-gray-600 mb-1">Upload resumes in your workspace first.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900">Available Resumes</h4>
                    <Button size="sm" variant="outline" icon={Plus} onClick={() => (window.location.hash = "#/workspace")}>
                      Upload New Resume
                    </Button>
                  </div>
                  {availableResumes.map((r) => {
                    const url = r.file_url || r.url;
                    const isSelected = resume?.fileUrl === url;
                    const selectable = url && typeof url === "string" && (url.includes("supabase.co") || url.includes("storage.googleapis.com"));
                    return (
                      <div
                        key={r.id}
                        className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                          isSelected ? "bg-green-50 border-green-200" : selectable ? "bg-gray-50 border-gray-200 hover:bg-gray-100 cursor-pointer" : "bg-red-50 border-red-200 opacity-60"
                        }`}
                        onClick={() => selectable && handleResumeSelect(r)}
                      >
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {r.filename || r.name}
                            {isSelected && (
                              <Badge variant="success" size="sm" className="ml-2">
                                Selected
                              </Badge>
                            )}
                          </h4>
                          <p className="text-xs text-gray-500">{r.description || "No description available"}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          {selectable && (
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={Eye}
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(url, "_blank");
                              }}
                            >
                              Preview
                            </Button>
                          )}
                          {isSelected && (
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={X}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResumeDeselect();
                              }}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Send Application */}
          <Card>
            <CardHeader
              title="Send Application"
              subtitle="Send your application via Gmail"
              action={
                !settings?.gmail_connected && (
                  <Badge variant="warning" size="sm">
                    Gmail not configured
                  </Badge>
                )
              }
            />
            <CardBody>
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Application Summary</h4>
                  <div className="space-y-1 text-sm text-blue-800">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4" />
                      <span>Cover Letter: {coverLetter ? "Ready" : "Not generated"}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4" />
                      <span>Resume: {resume ? "Selected" : "Not selected"}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4" />
                      <span>Contact: {contacts.find((c) => c.email) ? "Available" : "Not found"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Button onClick={testGmailConnection} loading={testingGmail} icon={Key} variant="outline" size="sm">
                    Test Gmail Connection
                  </Button>
                  {gmailStatus && <span className="text-sm text-gray-600">{gmailStatus}</span>}
                </div>

                <Button
                  onClick={handleSendApplication}
                  loading={sendingApplication}
                  icon={Send}
                  disabled={!coverLetter?.content || !resume || !contacts.find((c) => c.email) || !settings?.gmail_connected}
                  fullWidth
                  size="lg"
                >
                  Send Application via Gmail
                </Button>
                <p className="text-sm text-gray-600 text-center">Your cover letter is the email body; resume is attached.</p>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* My Applications Tab */}
      {activeTab === 'my-applications' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">My Applications</h2>
            <Button onClick={() => setShowApplicationsDrawer(true)}>
              <MessageSquare className="w-4 h-4 mr-2" />
              Open Applications
            </Button>
          </div>
          
          {/* Applications List */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Applications</h3>
              
              {isLoadingApplications ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : applications.length > 0 ? (
                <div className="space-y-3">
                  {applications.slice(0, 5).map((app, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                    >
                      <div 
                        className="flex-1 cursor-pointer"
                        onClick={() => loadThread(app.threadId)}
                      >
                        <div className="font-medium text-gray-900">{app.subject}</div>
                        <div className="text-sm text-gray-600">{app.to}</div>
                        <div className="text-xs text-gray-500">{new Date(app.date).toLocaleDateString()}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={app.status === 'sent' ? 'success' : 'default'} size="sm">
                          {app.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={X}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteApplication(app.threadId);
                          }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No applications found for this lead</p>
                  <p className="text-sm">Applications will appear here once you send emails</p>
                </div>
              )}
            </div>
          </div>

          {/* Thread Viewer */}
          {selectedThread && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Email Thread</h3>
                  <Button onClick={generateFollowUp} disabled={isGeneratingFollowUp}>
                    {isGeneratingFollowUp ? (
                      <LoadingSpinner className="w-4 h-4 mr-2" />
                    ) : (
                      <Search className="w-4 h-4 mr-2" />
                    )}
                    Generate Follow-up
                  </Button>
                </div>
                
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {selectedThread.messages?.map((message: any, index: number) => (
                    <div key={index} className="border-l-4 border-blue-500 pl-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-medium text-gray-900">{message.from}</span>
                          <span className="text-gray-500 mx-2">→</span>
                          <span className="font-medium text-gray-900">{message.to}</span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {new Date(message.date).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-sm text-gray-700 mb-2">{message.subject}</div>
                      <div className="text-gray-600 whitespace-pre-wrap">{message.body}</div>
                    </div>
                  ))}
                </div>
                
                {/* Follow-up Email Form */}
                {followUpEmail.subject && (
                  <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                    <h4 className="font-medium text-gray-900 mb-3">AI Generated Follow-up</h4>
                    <div className="space-y-3">
                      <Input
                        placeholder="Subject"
                        value={followUpEmail.subject}
                        onChange={(e) => setFollowUpEmail(prev => ({ ...prev, subject: e.target.value }))}
                      />
                      <TextArea
                        placeholder="Email body"
                        value={followUpEmail.body}
                        onChange={(e) => setFollowUpEmail(prev => ({ ...prev, body: e.target.value }))}
                        rows={4}
                      />
                      <div className="flex gap-2">
                        <Button onClick={sendFollowUp} size="sm">
                          Send Follow-up
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setFollowUpEmail({ subject: '', body: '' })}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* DRAWER */}
      {showApplicationsDrawer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-end">
          <div className="bg-white h-full w-full max-w-6xl shadow-2xl flex flex-col">
            {/* header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">My Applications</h2>
                <p className="text-sm text-gray-600">History, threads, and AI drafting</p>
              </div>
              <div className="flex items-center space-x-3">
                <Button onClick={generateFollowUp} disabled={isGeneratingFollowUp} icon={Sparkles} size="sm" variant="outline">
                  {isGeneratingFollowUp ? 'Generating...' : 'Generate Follow-up'}
                </Button>
                <Button onClick={() => setShowApplicationsDrawer(false)} variant="ghost" size="sm" icon={X}>
                  Close
                </Button>
              </div>
            </div>

            {/* body */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3">
              {/* left: list */}
              <div className="lg:col-span-1 border-r border-gray-200 p-6 overflow-y-auto">
                <h3 className="font-medium text-gray-900 mb-4">Application History</h3>
                {isLoadingApplications ? (
                  <div className="flex justify-center py-4">
                    <LoadingSpinner />
                  </div>
                ) : applications.length > 0 ? (
                  <div className="space-y-3">
                    {applications.map((app, index) => (
                      <div 
                        key={index}
                        className={`p-3 border rounded-lg transition-colors ${
                          selectedThread?.id === app.threadId ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        <div 
                          className="cursor-pointer"
                          onClick={() => loadThread(app.threadId)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm text-gray-900">{app.subject}</span>
                            <Badge variant={app.status === 'sent' ? 'success' : 'default'} size="sm">
                              {app.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-700 mb-1 line-clamp-2">{app.to}</p>
                          <p className="text-xs text-gray-500">{new Date(app.date).toLocaleDateString()}</p>
                        </div>
                        <div className="flex justify-end mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={X}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteApplication(app.threadId);
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No applications found</p>
                  </div>
                )}
              </div>

              {/* right: generator + thread */}
              <div className="lg:col-span-2 p-6 overflow-y-auto space-y-6">
                {/* resume selector (auto-hide if single resume already selected) */}
                {availableResumes.length > 1 && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">Resume Selection</h3>
                    <div className="grid gap-2">
                      {availableResumes.map((r) => {
                        const url = r.file_url || r.url;
                        const isSelected = resume?.fileUrl === url;
                        return (
                          <div
                            key={r.id}
                            className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                              isSelected ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                            }`}
                            onClick={() => handleResumeSelect(r)}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{r.filename || r.name}</span>
                              {isSelected && <Badge variant="success" size="sm">Selected</Badge>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Email Generator - Moved to Overview tab */}
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="font-medium text-gray-900 mb-2">Email Generator</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Use the Email Generator in the Overview tab to create personalized content
                  </p>
                  <Button
                    onClick={() => setShowApplicationsDrawer(false)}
                    variant="outline"
                    size="sm"
                  >
                    Go to Overview
                  </Button>
                </div>

                {/* thread viewer placeholder */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-4">Email Thread</h3>
                  {selectedThread ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Thread: {selectedThread.subject}</span>
                        <Button onClick={generateFollowUp} disabled={isGeneratingFollowUp} size="sm">
                          {isGeneratingFollowUp ? (
                            <LoadingSpinner className="w-4 h-4 mr-2" />
                          ) : (
                            <Search className="w-4 h-4 mr-2" />
                          )}
                          Generate Follow-up
                        </Button>
                      </div>
                      
                      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 max-h-64 overflow-y-auto">
                        {selectedThread.messages?.map((message: any, index: number) => (
                          <div key={index} className="mb-3 pb-3 border-b border-gray-200 last:border-b-0">
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-xs font-medium text-gray-700">{message.from}</span>
                              <span className="text-xs text-gray-500">
                                {new Date(message.date).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 mb-1">{message.subject}</div>
                            <div className="text-xs text-gray-700 line-clamp-2">{message.body}</div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Follow-up Email Form */}
                      {followUpEmail.subject && (
                        <div className="border border-gray-200 rounded-lg p-4 bg-blue-50">
                          <h5 className="font-medium text-gray-900 mb-3 text-sm">AI Generated Follow-up</h5>
                          <div className="space-y-3">
                            <Input
                              placeholder="Subject"
                              value={followUpEmail.subject}
                              onChange={(e) => setFollowUpEmail(prev => ({ ...prev, subject: e.target.value }))}
                              size={1}
                            />
                            <TextArea
                              placeholder="Email body"
                              value={followUpEmail.body}
                              onChange={(e) => setFollowUpEmail(prev => ({ ...prev, body: e.target.value }))}
                              rows={3}
                            />
                            <div className="flex gap-2">
                              <Button onClick={sendFollowUp} size="sm">
                                Send Follow-up
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setFollowUpEmail({ subject: '', body: '' })}
                              >
                                Clear
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-lg p-6 bg-gray-50 text-center">
                      <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">Select an application to view thread</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lusha Enrichment Modal */}
      <LushaEnrichmentModal
        isOpen={lushaModalOpen}
        onClose={() => setLushaModalOpen(false)}
        contacts={lushaContacts}
        onSelectContacts={handleLushaContactSelection}
        companyName={lead?.company}
      />
    </div>
  );
};
