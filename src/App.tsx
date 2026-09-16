/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  LandParcel, Slot, Client, QALog, Contractor, PayrollRecord, 
  CompanyBudget, UserSession, PunchListDefect, CivilWorksMilestone, ProcessAuditLog, DailyManpowerAudit,
  LaborAllocation, AIManpowerRecommendation, ProjectTask, DailySiteLog, ProjectDocument, ProjectRisk,
  ChangeOrder, CADParsedLot, TaskStatus, GovernmentPermit, ScheduleEvent,
  ProjectProfile, ExtendedPayrollItem, ProjectRFI, FitoutQuotationItem
} from './types';
import LandingPage from './components/LandingPage';
import LoginPortal from './components/LoginPortal';
import AdminPortal from './components/AdminPortal';
import LoadingScreen from './components/LoadingScreen';

export default function App() {
  // --- DATABASE STATE MODULES ---
  const [parcels, setParcels] = useState<LandParcel[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [qaLogs, setQaLogs] = useState<QALog[]>([]);
  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
  const [budget, setBudget] = useState<CompanyBudget | null>(null);
  
  // Real Estate Operational Workflow Modules
  const [punchListDefects, setPunchListDefects] = useState<PunchListDefect[]>([]);
  const [civilWorksMilestones, setCivilWorksMilestones] = useState<CivilWorksMilestone[]>([]);
  const [auditLogs, setAuditLogs] = useState<ProcessAuditLog[]>([]);
  const [manpowerAudits, setManpowerAudits] = useState<DailyManpowerAudit[]>([]);
  const [laborAllocations, setLaborAllocations] = useState<LaborAllocation[]>([]);
  const [aiRecommendations, setAiRecommendations] = useState<AIManpowerRecommendation[]>([]);

  // Project Management System (PMS) Modules
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [siteLogs, setSiteLogs] = useState<DailySiteLog[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [risks, setRisks] = useState<ProjectRisk[]>([]);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [rfis, setRfis] = useState<ProjectRFI[]>([]);
  const [quotations, setQuotations] = useState<FitoutQuotationItem[]>([]);
  const [permits, setPermits] = useState<GovernmentPermit[]>([]);
  const [scheduleEvents, setScheduleEvents] = useState<ScheduleEvent[]>([]);
  const [projects, setProjects] = useState<ProjectProfile[]>([]);
  const [extendedPayroll, setExtendedPayroll] = useState<ExtendedPayrollItem[]>([]);

  // Active Session context: 
  // null = Landing Page 
  // 'login' = Portal Authenticator Screen
  // UserSession = Active logged-in role Dashboard
  const [session, setSession] = useState<UserSession | 'login' | null>(null);
  const [urlInviteToken, setUrlInviteToken] = useState<string | null>(null);

  // Loading & Animation transition state
  const [loadingState, setLoadingState] = useState<{
    active: boolean;
    mode: 'login' | 'logout';
    pendingSession?: UserSession | null;
  }>({
    active: false,
    mode: 'login',
    pendingSession: null,
  });

  // SSE reconnect ref
  const sseRef = useRef<EventSource | null>(null);
  const sseReconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- URL TOKEN INSPECTOR & PERSISTENCE RESTORER ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('activateToken') || params.get('token');
      if (token) {
        setUrlInviteToken(token);
        setSession('login');
      } else {
        const saved = localStorage.getItem('xyz_pm_user_session') || localStorage.getItem('xyz_erp_user_session');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setSession(parsed);

            // Re-sync with latest PostgreSQL database profile in background
            const q = parsed.id ? `?userId=${encodeURIComponent(parsed.id)}` : parsed.email ? `?email=${encodeURIComponent(parsed.email)}` : '';
            fetch(`/api/auth/profile${q}`)
              .then(res => res.ok ? res.json() : null)
              .then(data => {
                if (data?.profile) {
                  const p = data.profile;
                  setSession(prev => {
                    if (typeof prev === 'object' && prev !== null) {
                      const updated = {
                        ...prev,
                        name: p.name || prev.name,
                        email: p.email || prev.email,
                        avatarUrl: p.avatarUrl !== undefined ? p.avatarUrl : prev.avatarUrl,
                        title: p.title || prev.title,
                        phone: p.contact || prev.phone,
                        division: p.division || prev.division,
                      };
                      localStorage.setItem('xyz_pm_user_session', JSON.stringify(updated));
                      return updated;
                    }
                    return prev;
                  });
                }
              })
              .catch(() => {});
          } catch {
            localStorage.removeItem('xyz_pm_user_session');
            localStorage.removeItem('xyz_erp_user_session');
          }
        }
      }
    }
  }, []);

  // ============================================================================
  // GRANULAR FETCH HELPERS — fetch only the changed entity slice
  // Much faster than reloadAllData() which queries every table.
  // ============================================================================

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/clients');
      if (res.ok) setClients(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchSlots = useCallback(async () => {
    try {
      const res = await fetch('/api/slots');
      if (res.ok) setSlots(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchPunchLists = useCallback(async () => {
    try {
      const res = await fetch('/api/punch-lists');
      if (res.ok) setPunchListDefects(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchCivilMilestones = useCallback(async () => {
    try {
      const res = await fetch('/api/civil-milestones');
      if (res.ok) setCivilWorksMilestones(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/audit-logs');
      if (res.ok) setAuditLogs(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchPayroll = useCallback(async () => {
    try {
      const res = await fetch('/api/payroll-records');
      if (res.ok) setPayroll(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks-list');
      if (res.ok) setTasks(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchContractors = useCallback(async () => {
    try {
      const res = await fetch('/api/contractors-list');
      if (res.ok) setContractors(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) setDocuments(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchSiteLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/site-logs');
      if (res.ok) setSiteLogs(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchPermits = useCallback(async () => {
    try {
      const res = await fetch('/api/permits');
      if (res.ok) setPermits(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchSchedule = useCallback(async () => {
    try {
      const res = await fetch('/api/schedule');
      if (res.ok) setScheduleEvents(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) setProjects(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchExtendedPayroll = useCallback(async () => {
    try {
      const res = await fetch('/api/extended-payroll');
      if (res.ok) setExtendedPayroll(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchChangeOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/change-orders');
      if (res.ok) setChangeOrders(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchRfis = useCallback(async () => {
    try {
      const res = await fetch('/api/rfis');
      if (res.ok) setRfis(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchQuotations = useCallback(async () => {
    try {
      const res = await fetch('/api/quotations');
      if (res.ok) setQuotations(await res.json());
    } catch { /* silent */ }
  }, []);

  // --- PERSISTENCE STATE SYNCHRONIZER (FETCH FROM DB) ---
  // Used for initial page load only. After that, SSE + granular fetches handle updates.
  const reloadAllData = async () => {
    try {
      const res = await fetch('/api/all-data');
      if (!res.ok) throw new Error('API fetch failed');
      const data = await res.json();
      setParcels(data.parcels || []);
      setSlots(data.slots || []);
      setClients(data.clients || []);
      setContractors(data.contractors || []);
      setQaLogs(data.qaLogs || []);
      setPunchListDefects(data.punchListDefects || []);
      setCivilWorksMilestones(data.civilWorksMilestones || []);
      setAuditLogs(data.auditLogs || []);
      setPayroll(data.payroll || []);
      setBudget(data.budget || null);
      setManpowerAudits(data.manpowerAudits || []);
      setLaborAllocations(data.laborAllocations || []);
      setAiRecommendations(data.aiRecommendations || []);
      setTasks(data.tasks || []);
      setSiteLogs(data.siteLogs || []);
      setDocuments(data.documents || []);
      setRisks(data.risks || []);
      setChangeOrders(data.changeOrders || []);
      setRfis(data.rfis || []);
      setQuotations(data.quotations || []);
      setPermits(data.permits || []);
      setScheduleEvents(data.scheduleEvents || []);
      setProjects(data.projects || []);
      setExtendedPayroll(data.extendedPayroll || []);
    } catch (err) {
      console.error('Failed to load data from database:', err);
    }
  };

  // Initial load
  useEffect(() => {
    reloadAllData();
  }, []);

  // ============================================================================
  // SSE REAL-TIME SYNC ENGINE
  // Connects to /api/events and listens for data_changed push events from server.
  // On each push, only the affected entity slice is re-fetched (not everything).
  // Auto-reconnects if the connection drops.
  // ============================================================================

  const connectSSE = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.close();
    }

    const es = new EventSource('/api/events');
    sseRef.current = es;

    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type !== 'data_changed') return;

        // Route to the correct granular fetch based on the entity that changed
        switch (msg.entity) {
          case 'clients':    fetchClients(); break;
          case 'slots':      fetchSlots(); break;
          case 'punchLists': fetchPunchLists(); break;
          case 'civilMilestones': fetchCivilMilestones(); break;
          case 'auditLogs':  fetchAuditLogs(); break;
          case 'payroll':    fetchPayroll(); break;
          case 'tasks':      fetchTasks(); break;
          case 'contractors': fetchContractors(); break;
          case 'siteLogs':   fetchSiteLogs(); break;
          case 'documents':  fetchDocuments(); break;
          case 'permits':    fetchPermits(); break;
          case 'schedule':   fetchSchedule(); break;
          case 'projects':   fetchProjects(); break;
          case 'extendedPayroll': fetchExtendedPayroll(); break;
          case 'changeOrders': fetchChangeOrders(); break;
          case 'rfis':       fetchRfis(); break;
          case 'quotations': fetchQuotations(); break;
          case 'aiRecommendations': reloadAllData(); break;
          case 'manpowerAudits': reloadAllData(); break;
          case 'risks':
            // Risks not on a granular endpoint — skip
            break;
          case 'qaLogs':
            // QA logs not on a granular endpoint — skip
            break;
          default: break;
        }
      } catch { /* malformed message */ }
    };

    es.onerror = () => {
      es.close();
      sseRef.current = null;
      // Auto-reconnect after 3 seconds
      if (sseReconnectTimer.current) clearTimeout(sseReconnectTimer.current);
      sseReconnectTimer.current = setTimeout(connectSSE, 3000);
    };
  }, [fetchClients, fetchSlots, fetchPunchLists, fetchCivilMilestones, fetchAuditLogs, fetchPayroll, fetchTasks, fetchContractors, fetchSiteLogs, fetchDocuments, fetchPermits, fetchSchedule, fetchProjects, fetchExtendedPayroll, fetchChangeOrders, fetchRfis, fetchQuotations]);

  useEffect(() => {
    connectSSE();
    return () => {
      if (sseRef.current) sseRef.current.close();
      if (sseReconnectTimer.current) clearTimeout(sseReconnectTimer.current);
    };
  }, [connectSSE]);

  // --- SESSION AUTH TRANSITIONS WITH ANIMATION ---
  const handleInitiateLogin = (targetSession: UserSession) => {
    localStorage.setItem('xyz_pm_user_session', JSON.stringify(targetSession));
    setLoadingState({
      active: true,
      mode: 'login',
      pendingSession: targetSession,
    });
  };

  const handleInitiateLogout = () => {
    localStorage.removeItem('xyz_pm_user_session');
    localStorage.removeItem('xyz_erp_user_session');
    const currentSession = typeof session === 'object' && session !== null ? session : null;
    setLoadingState({
      active: true,
      mode: 'logout',
      pendingSession: currentSession,
    });
  };

  const handleUpdateSession = useCallback((updated: Partial<UserSession>) => {
    setSession(prev => {
      if (typeof prev === 'object' && prev !== null) {
        const merged = { ...prev, ...updated };
        localStorage.setItem('xyz_pm_user_session', JSON.stringify(merged));
        return merged;
      }
      return prev;
    });
  }, []);

  // --- CHRONOLOGICAL DATA MUTATORS (with Optimistic UI Updates) ---
  // Pattern: update state instantly → call API → reconcile with server data
  // If API fails, rollback to previous state.

  // 1. Add Land Parcel
  const handleAddParcel = async (parcel: LandParcel) => {
    // Optimistic: add immediately
    setParcels(prev => [...prev, parcel]);
    try {
      const res = await fetch('/api/parcels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parcel)
      });
      if (!res.ok) {
        // Rollback
        setParcels(prev => prev.filter(p => p.id !== parcel.id));
      }
      // Server broadcasts → SSE handles the granular refetch
    } catch (err) {
      setParcels(prev => prev.filter(p => p.id !== parcel.id));
      console.error('Error adding parcel:', err);
    }
  };

  // 2. Subdivide Lots
  const handleSubdivideParcel = async (parcelId: string, areaSqm: number, price: number, isReady: boolean) => {
    const startLotNumber = slots.length + 1;
    try {
      const res = await fetch('/api/slots/subdivide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parcelId, areaSqm, price, startLotNumber })
      });
      if (res.ok) {
        const newSlots = await res.json();
        // Reconcile: merge new slots from server response (already have optimistic data)
        setSlots(prev => [...prev, ...newSlots.map((s: any) => ({
          id: s.id, parcelId: s.parcelId, slotNumber: s.slotNumber, areaSqm: s.sizeSqm,
          basePrice: Number(s.price), status: 'Available', row: s.row, col: s.col,
          polygonPoints: s.polygonPoints, blockName: s.blockName, assignedClientId: null,
        }))]);
      }
    } catch (err) {
      console.error('Error subdividing parcel:', err);
    }
  };

  // 3. Register Buyer Profile
  const handleRegisterClient = async (client: Client) => {
    // Optimistic: add immediately
    setClients(prev => [...prev, client]);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(client)
      });
      if (res.ok) {
        const serverClient = await res.json();
        // Reconcile: replace optimistic entry with server's canonical version
        setClients(prev => prev.map(c => c.id === client.id ? serverClient : c));
      } else {
        setClients(prev => prev.filter(c => c.id !== client.id));
      }
    } catch (err) {
      setClients(prev => prev.filter(c => c.id !== client.id));
      console.error('Error registering client:', err);
    }
  };

  // 3.5. Delete Buyer Account
  const handleDeleteClient = async (clientId: string) => {
    // Optimistic: remove immediately
    const removedClient = clients.find(c => c.id === clientId);
    setClients(prev => prev.filter(c => c.id !== clientId));
    // Release slot optimistically
    if (removedClient?.slotId) {
      setSlots(prev => prev.map(s => s.id === removedClient.slotId ? { ...s, status: 'Available', assignedClientId: null } : s));
    }
    try {
      const res = await fetch(`/api/clients/${clientId}`, { method: 'DELETE' });
      if (!res.ok && removedClient) {
        // Rollback
        setClients(prev => [...prev, removedClient]);
        if (removedClient.slotId) {
          setSlots(prev => prev.map(s => s.id === removedClient.slotId ? { ...s, status: 'Reserved', assignedClientId: clientId } : s));
        }
      }
    } catch (err) {
      if (removedClient) {
        setClients(prev => [...prev, removedClient]);
      }
      console.error('Error deleting client:', err);
    }
  };

  // 4. Assign Client to Lot
  const handleAssignClient = async (slotId: string, clientId: string) => {
    // Optimistic: update slot and client linkage
    setSlots(prev => prev.map(s => s.id === slotId ? { ...s, assignedClientId: clientId, status: 'Reserved' } : s));
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, slotId } : c));
    try {
      const res = await fetch('/api/clients/assign-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, slotId })
      });
      if (!res.ok) {
        // Rollback
        setSlots(prev => prev.map(s => s.id === slotId ? { ...s, assignedClientId: null } : s));
        setClients(prev => prev.map(c => c.id === clientId ? { ...c, slotId: undefined } : c));
      }
    } catch (err) {
      console.error('Error assigning client to slot:', err);
    }
  };

  // 5. Lot Lifecycle State Machine Transitions
  const handleTransitionSlotStatus = async (slotId: string, newStatus: string, notes?: string, clientId?: string | null) => {
    // Optimistic: update slot status immediately
    const prevSlot = slots.find(s => s.id === slotId);
    setSlots(prev => prev.map(s => s.id === slotId ? { ...s, status: newStatus as import('./types').SlotStatus } : s));
    try {
      const res = await fetch('/api/slots/transition-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId,
          newStatus,
          notes,
          clientId,
          actorName: session && typeof session === 'object' ? session.name : 'Operations Head',
          actorRole: session && typeof session === 'object' ? session.role : 'Admin'
        })
      });
      if (!res.ok && prevSlot) {
        setSlots(prev => prev.map(s => s.id === slotId ? prevSlot : s));
      }
    } catch (err) {
      if (prevSlot) setSlots(prev => prev.map(s => s.id === slotId ? prevSlot : s));
      console.error('Error transitioning slot status:', err);
    }
  };

  // 6. Government Titling & Permitting Pipeline Step Manager
  const handleUpdateTitlePipeline = async (clientId: string, stepKey?: string, value?: boolean, tctNumber?: string, taxDecNumber?: string) => {
    // Optimistic: update client title milestones
    if (stepKey) {
      setClients(prev => prev.map(c => c.id === clientId ? {
        ...c,
        titleMilestones: c.titleMilestones ? { ...c.titleMilestones, [stepKey]: value } : c.titleMilestones
      } : c));
    }
    try {
      const res = await fetch('/api/clients/update-title-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          stepKey,
          value,
          tctNumber,
          taxDecNumber,
          actorName: session && typeof session === 'object' ? session.name : 'Legal Officer'
        })
      });
      if (res.ok) {
        // Reconcile from server (currentPhase may have changed)
        fetchClients();
      } else {
        fetchClients(); // Revert by fetching real state
      }
    } catch (err) {
      fetchClients();
      console.error('Error updating titling pipeline:', err);
    }
  };

  // 7. Buyer KYC Document Verification
  const handleVerifyKyc = async (clientId: string, docKey: string, verified: boolean, notes?: string) => {
    // Optimistic: flip the KYC field immediately
    setClients(prev => prev.map(c => c.id === clientId ? {
      ...c,
      buyerKyc: c.buyerKyc ? { ...c.buyerKyc, [docKey]: verified } : c.buyerKyc
    } : c));
    try {
      const res = await fetch('/api/clients/verify-kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          docKey,
          verified,
          notes,
          actorName: session && typeof session === 'object' ? session.name : 'Compliance Officer'
        })
      });
      if (res.ok) {
        const updatedKyc = await res.json();
        // Reconcile kycStatus from server (server computes allVerified)
        setClients(prev => prev.map(c => c.id === clientId ? {
          ...c,
          buyerKyc: updatedKyc
        } : c));
      } else {
        fetchClients(); // Revert
      }
    } catch (err) {
      fetchClients();
      console.error('Error verifying buyer KYC:', err);
    }
  };

  // 8. Client Certificate of Lot Acceptance & Handover Sign-Off
  const handleSignAcceptance = async (clientId: string, clientName: string) => {
    // Optimistic: advance slot to Handed Over
    const client = clients.find(c => c.id === clientId);
    if (client?.slotId) {
      setSlots(prev => prev.map(s => s.id === client.slotId ? { ...s, status: 'Handed Over' } : s));
    }
    try {
      const res = await fetch('/api/clients/sign-acceptance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, clientName })
      });
      if (!res.ok) {
        fetchSlots(); // Revert
      }
    } catch (err) {
      fetchSlots();
      console.error('Error signing acceptance:', err);
    }
  };

  // 9. Punch-List Defect Management
  const handleCreateDefect = async (defectData: {
    slotId: string;
    title: string;
    description: string;
    severity: string;
    category: string;
    contractorId?: string | null;
    targetDate?: string | null;
  }) => {
    const optimisticDefect: PunchListDefect = {
      id: `DEFECT-OPT-${Date.now()}`,
      inspectorId: '',
      inspectorName: 'Site Monitor',
      contractorId: defectData.contractorId || null,
      contractorName: 'Unassigned Contractor',
      status: 'OPEN' as const,
      resolutionNotes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      slotId: defectData.slotId,
      title: defectData.title,
      description: defectData.description,
      severity: defectData.severity as PunchListDefect['severity'],
      category: defectData.category as PunchListDefect['category'],
      targetDate: defectData.targetDate || null,
    };
    setPunchListDefects(prev => [optimisticDefect, ...prev]);
    try {
      const res = await fetch('/api/punch-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...defectData,
          inspectorId: session && typeof session === 'object' ? session.email : undefined,
        })
      });
      if (res.ok) {
        const serverDefect = await res.json();
        // Reconcile: replace optimistic with server version
        setPunchListDefects(prev => prev.map(d => d.id === optimisticDefect.id ? serverDefect : d));
      } else {
        setPunchListDefects(prev => prev.filter(d => d.id !== optimisticDefect.id));
      }
    } catch (err) {
      setPunchListDefects(prev => prev.filter(d => d.id !== optimisticDefect.id));
      console.error('Error creating defect ticket:', err);
    }
  };

  const handleUpdateDefect = async (id: string, updateData: {
    status?: string;
    resolutionNotes?: string;
    contractorId?: string | null;
  }) => {
    // Optimistic: update immediately
    const prevDefect = punchListDefects.find(d => d.id === id);
    setPunchListDefects(prev => prev.map(d => d.id === id ? {
      ...d,
      ...(updateData.status ? { status: updateData.status as PunchListDefect['status'] } : {}),
      ...(updateData.resolutionNotes !== undefined ? { resolutionNotes: updateData.resolutionNotes } : {}),
      ...(updateData.contractorId !== undefined ? { contractorId: updateData.contractorId } : {}),
    } : d));
    try {
      const res = await fetch(`/api/punch-lists/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updateData,
          actorName: session && typeof session === 'object' ? session.name : 'Inspector',
          actorRole: session && typeof session === 'object' ? session.role : 'Inspector',
        })
      });
      if (res.ok) {
        const serverDefect = await res.json();
        setPunchListDefects(prev => prev.map(d => d.id === id ? serverDefect : d));
      } else if (prevDefect) {
        setPunchListDefects(prev => prev.map(d => d.id === id ? prevDefect : d));
      }
    } catch (err) {
      if (prevDefect) setPunchListDefects(prev => prev.map(d => d.id === id ? prevDefect : d));
      console.error('Error updating defect ticket:', err);
    }
  };

  // 10. Civil Works Engineering Milestone Sign-Off
  const handleUpdateCivilMilestone = async (milestoneId: string, currentPercentage: number, status: string, inspectorSignOff: boolean, remarks?: string) => {
    // Optimistic
    const prev = civilWorksMilestones.find(m => m.id === milestoneId);
    setCivilWorksMilestones(p => p.map(m => m.id === milestoneId ? {
      ...m,
      currentPercentage,
      status: status as CivilWorksMilestone['status'],
      inspectorSignOff,
      remarks: remarks || m.remarks,
    } : m));
    try {
      const res = await fetch('/api/civil-works/update-milestone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          milestoneId,
          currentPercentage,
          status,
          inspectorSignOff,
          remarks,
          actorName: session && typeof session === 'object' ? session.name : 'Site Engineer'
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setCivilWorksMilestones(p => p.map(m => m.id === milestoneId ? updated : m));
      } else if (prev) {
        setCivilWorksMilestones(p => p.map(m => m.id === milestoneId ? prev : m));
      }
    } catch (err) {
      if (prev) setCivilWorksMilestones(p => p.map(m => m.id === milestoneId ? prev : m));
      console.error('Error updating civil works milestone:', err);
    }
  };

  const handleSyncSchedule = async (tasks: any[]) => {
    try {
      const res = await fetch('/api/civil-works/sync-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCivilWorksMilestones(updated);
      }
    } catch (e) {
      console.error('Error syncing schedule:', e);
    }
  };

  // 11. Contractor & Workforce Roster
  const handleRegisterContractor = async (contractor: Contractor) => {
    setContractors(prev => [...prev, contractor]);
    try {
      const res = await fetch('/api/contractors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contractor)
      });
      if (res.ok) {
        const saved = await res.json();
        setContractors(prev => prev.map(c => c.id === contractor.id ? saved : c));
      } else {
        setContractors(prev => prev.filter(c => c.id !== contractor.id));
      }
    } catch (err) {
      setContractors(prev => prev.filter(c => c.id !== contractor.id));
      console.error('Error registering contractor:', err);
    }
  };

  const handleDeleteContractor = useCallback(async (contractorId: string) => {
    // Optimistic: remove immediately
    setContractors(prev => prev.filter(c => c.id !== contractorId));
    try {
      const res = await fetch(`/api/contractors/${contractorId}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        // Rollback: re-fetch real DB state
        fetchContractors();
      }
      // On success, SSE broadcast triggers fetchContractors() automatically
    } catch (err) {
      fetchContractors();
      console.error('Error deleting contractor/worker:', err);
    }
  }, [fetchContractors]);

  const handleUpdateContractors = useCallback(async (updated: Contractor[]) => {
    // Optimistic: apply all changes immediately
    setContractors(updated);
    try {
      const res = await fetch('/api/contractors/update-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractors: updated })
      });
      if (!res.ok) {
        fetchContractors();
      }
    } catch (err) {
      fetchContractors();
      console.error('Error syncing contractors:', err);
    }
  }, [fetchContractors]);

  const handleUpdateContractor = useCallback(async (contractor: Contractor) => {
    // Optimistic: apply status/field change immediately
    setContractors(prev => prev.map(c => c.id === contractor.id ? contractor : c));
    try {
      const res = await fetch(`/api/contractors/${contractor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contractor)
      });
      if (!res.ok) {
        // Rollback: fetch real DB state on failure
        fetchContractors();
      }
      // On success, SSE broadcast triggers fetchContractors() automatically
    } catch (err) {
      fetchContractors();
      console.error('Error updating worker status:', err);
    }
  }, [fetchContractors]);


  // 12. Weekly Progress QA Log
  const handleAddQALog = async (log: Omit<QALog, 'id' | 'date'>) => {
    try {
      const res = await fetch('/api/qa-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log)
      });
      if (res.ok) {
        const newLog = await res.json();
        setQaLogs(prev => [newLog, ...prev]);
      }
    } catch (err) {
      console.error('Error adding QA log:', err);
    }
  };

  // 13. Payroll Records
  const handleAddPayroll = async (record: PayrollRecord) => {
    setPayroll(prev => [record, ...prev]);
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
      if (!res.ok) {
        setPayroll(prev => prev.filter(p => p.id !== record.id));
      }
    } catch (err) {
      setPayroll(prev => prev.filter(p => p.id !== record.id));
      console.error('Error adding payroll:', err);
    }
  };

  // 14. Daily Manpower Audit & Attendance
  const handleCreateManpowerAudit = async (auditData: any) => {
    try {
      const res = await fetch('/api/manpower-audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditData)
      });
      if (res.ok) {
        const newAudit = await res.json();
        setManpowerAudits(prev => [newAudit, ...prev]);
        setContractors(prev => prev.map(c => c.id === auditData.contractorId ? { ...c, activeManpower: Number(auditData.verifiedHeadcount) } : c));
      } else {
        // Fallback: add locally
        const newAudit: DailyManpowerAudit = {
          id: `AUD-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          contractorId: auditData.contractorId,
          contractorName: auditData.contractorName,
          specialty: auditData.specialty,
          shift: auditData.shift || 'Morning',
          claimedHeadcount: Number(auditData.claimedHeadcount || 0),
          verifiedHeadcount: Number(auditData.verifiedHeadcount || 0),
          discrepancy: Number(auditData.claimedHeadcount || 0) - Number(auditData.verifiedHeadcount || 0),
          assignedSectorOrLot: auditData.assignedSectorOrLot,
          supervisorName: auditData.supervisorName || 'Engr. Ricardo Gomez',
          gpsCoordinates: auditData.gpsCoordinates || '14.2789° N, 121.1245° E (NexBridge Commercial Site)',
          verificationStatus: (Number(auditData.claimedHeadcount || 0) - Number(auditData.verifiedHeadcount || 0)) === 0 ? 'VERIFIED_MATCH' : 'DISCREPANCY_FLAGGED',
          photoEvidenceVerified: true,
          remarks: auditData.remarks || '',
          productivityIndex: Number(auditData.productivityIndex || 90)
        };
        setManpowerAudits(prev => [newAudit, ...prev]);
        setContractors(prev => prev.map(c => c.id === auditData.contractorId ? { ...c, activeManpower: Number(auditData.verifiedHeadcount) } : c));
      }
    } catch (err) {
      console.error('Error logging manpower audit:', err);
    }
  };

  // 15. Manual Labor Allocation Update
  const handleSaveAllocation = async (alloc: LaborAllocation) => {
    setLaborAllocations(prev => {
      const exists = prev.some(a => a.id === alloc.id);
      if (exists) {
        return prev.map(a => a.id === alloc.id ? alloc : a);
      }
      return [...prev, alloc];
    });

    // Update contractor active manpower if matching
    setContractors(prev => prev.map(c => {
      if (c.id === alloc.contractorId) {
        return { ...c, activeManpower: alloc.assignedHeadcount };
      }
      return c;
    }));

    try {
      await fetch('/api/labor-allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alloc)
      });
    } catch (err) {
      console.error('Failed to sync labor allocation to database:', err);
    }
  };

  // 16. Apply AI Labor Optimization Recommendation
  const handleApplyAIRecommendation = async (recId: string) => {
    const rec = aiRecommendations.find(r => r.id === recId);
    if (!rec) return;

    // Apply allocation changes
    setLaborAllocations(prev => {
      const match = prev.find(a => a.sectorName === rec.targetSector || a.contractorId === rec.contractorId);
      if (match) {
        return prev.map(a => a.id === match.id ? {
          ...a,
          assignedHeadcount: rec.recommendedHeadcount,
          targetLots: rec.targetLots,
          workScope: rec.suggestedScope,
          notes: `Optimized via AI Assistant: ${rec.title}`,
          updatedAt: new Date().toISOString().split('T')[0]
        } : a);
      } else {
        const newAlloc: LaborAllocation = {
          id: `ALLOC-${Date.now()}`,
          contractorId: rec.contractorId,
          contractorName: rec.contractorName,
          sectorName: rec.targetSector,
          targetLots: rec.targetLots,
          assignedHeadcount: rec.recommendedHeadcount,
          workScope: rec.suggestedScope,
          status: 'ACTIVE',
          notes: `Optimized via AI Assistant: ${rec.title}`,
          updatedAt: new Date().toISOString().split('T')[0]
        };
        return [...prev, newAlloc];
      }
    });

    // Mark AI recommendation as applied
    setAiRecommendations(prev => prev.map(r => r.id === recId ? { ...r, applied: true } : r));

    // Update contractor headcount
    setContractors(prev => prev.map(c => c.id === rec.contractorId ? { ...c, activeManpower: rec.recommendedHeadcount } : c));

    try {
      await fetch('/api/labor-allocations/apply-ai-rec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recId })
      });
    } catch (err) {
      console.error('Failed to sync AI recommendation to database:', err);
    }
  };

  // --- AUTOCAD & PMS SUITE HANDLERS ---
  const handleImportCADLots = async (lots: CADParsedLot[]) => {
    try {
      const res = await fetch('/api/slots/import-cad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parcelId: 'PARCEL-CST', lots }),
      });
      if (res.ok) {
        fetchSlots();
      }
    } catch (e) {
      console.error('Failed to import CAD lots:', e);
    }
  };

  const handleClearAllLots = async () => {
    // Optimistic: clear immediately
    const prevSlots = slots;
    setSlots([]);
    try {
      const res = await fetch('/api/slots/clear-all', { method: 'DELETE' });
      if (!res.ok) {
        setSlots(prevSlots);
      }
    } catch (e) {
      setSlots(prevSlots);
      console.error('Failed to clear lots:', e);
    }
  };

  const handleAddTask = async (taskData: Omit<ProjectTask, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });
      if (res.ok) {
        const newTask = await res.json();
        setTasks(prev => [{ ...newTask, subtasks: newTask.subtasksJson ? JSON.parse(newTask.subtasksJson) : [], tags: newTask.tags ? newTask.tags.split(',') : [] }, ...prev]);
      }
    } catch (e) {
      console.error('Failed to create task:', e);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, status: TaskStatus) => {
    // Optimistic: update immediately
    const prevTask = tasks.find(t => t.id === taskId);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok && prevTask) {
        setTasks(prev => prev.map(t => t.id === taskId ? prevTask : t));
      }
    } catch (e) {
      if (prevTask) setTasks(prev => prev.map(t => t.id === taskId ? prevTask : t));
      console.error('Failed to update task:', e);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    // Optimistic: remove immediately
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (!res.ok) {
        fetchTasks();
      }
    } catch (e) {
      fetchTasks();
      console.error('Failed to delete task:', e);
    }
  };

  const handleClearAllTasks = async () => {
    const prev = tasks;
    setTasks([]);
    try {
      const res = await fetch('/api/tasks-clear-all', { method: 'DELETE' });
      if (!res.ok) {
        setTasks(prev);
      }
    } catch (e) {
      setTasks(prev);
      console.error('Failed to clear all tasks:', e);
    }
  };

  const handleAddSiteLog = async (logData: Omit<DailySiteLog, 'id' | 'createdAt'>) => {
    try {
      const res = await fetch('/api/site-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData),
      });
      if (res.ok) {
        const newLog = await res.json();
        setSiteLogs(prev => [newLog, ...prev]);
      }
    } catch (e) {
      console.error('Failed to save site log:', e);
    }
  };

  const handleAddDocument = async (docData: Omit<ProjectDocument, 'id' | 'createdAt'>) => {
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(docData),
      });
      if (res.ok) {
        const newDoc = await res.json();
        setDocuments(prev => [newDoc, ...prev]);
      }
    } catch (e) {
      console.error('Failed to save document:', e);
    }
  };

  const handleUpdateDocument = async (id: string, docData: Partial<ProjectDocument>) => {
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(docData),
      });
      if (res.ok) {
        const updated = await res.json();
        setDocuments(prev => prev.map(d => d.id === id ? updated : d));
      }
    } catch (e) {
      console.error('Failed to update document:', e);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDocuments(prev => prev.filter(d => d.id !== id));
      }
    } catch (e) {
      console.error('Failed to delete document:', e);
    }
  };

  const handleAddRisk = async (riskData: Omit<ProjectRisk, 'id' | 'createdAt'>) => {
    try {
      const res = await fetch('/api/risks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(riskData),
      });
      if (res.ok) {
        const newRisk = await res.json();
        setRisks(prev => [newRisk, ...prev]);
      }
    } catch (e) {
      console.error('Failed to save risk:', e);
    }
  };

  const handleDeleteParcel = async (parcelId: string) => {
    const prevParcel = parcels.find(p => p.id === parcelId);
    setParcels(prev => prev.filter(p => p.id !== parcelId));
    try {
      const res = await fetch(`/api/parcels/${parcelId}`, { method: 'DELETE' });
      if (!res.ok && prevParcel) {
        setParcels(prev => [...prev, prevParcel]);
      }
    } catch (e) {
      if (prevParcel) setParcels(prev => [...prev, prevParcel]);
      console.error('Failed to delete parcel:', e);
    }
  };

  const handleApplyAIPricing = async (updates: { slotId: string; newBasePrice: number }[], targetMargin: number) => {
    // Optimistic: apply prices immediately
    setSlots(prev => prev.map(s => {
      const update = updates.find(u => u.slotId === s.id);
      return update ? { ...s, basePrice: update.newBasePrice } : s;
    }));
    try {
      const res = await fetch('/api/slots/apply-ai-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates,
          targetMargin,
          actorName: session && typeof session === 'object' ? session.name : 'Operations Lead',
          actorRole: 'ADMIN'
        })
      });
      if (!res.ok) {
        fetchSlots(); // Revert from server
      }
    } catch (e) {
      fetchSlots();
      console.error('Failed to apply AI pricing:', e);
    }
  };

  const handleRecordPayment = async (paymentData: any) => {
    const res = await fetch('/api/payments/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentData)
    });
    if (!res.ok) throw new Error('Failed to record payment');
    await fetchClients();
    await fetchAuditLogs();
  };

  const handleDisbursePayroll = async (id?: string, all?: boolean) => {
    const res = await fetch('/api/payroll/disburse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, all })
    });
    if (!res.ok) throw new Error('Failed to disburse payroll');
    await fetchPayroll();
    await fetchAuditLogs();
  };

  const handleAddPermit = async (permitData: Partial<GovernmentPermit>) => {
    const res = await fetch('/api/permits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(permitData)
    });
    if (!res.ok) throw new Error('Failed to file permit');
    await fetchPermits();
    await fetchAuditLogs();
  };

  const handleUpdatePermitStatus = async (permitId: string, status: any, notes?: string) => {
    const res = await fetch(`/api/permits/${permitId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes })
    });
    if (!res.ok) throw new Error('Failed to update permit');
    await fetchPermits();
  };

  const handleDeletePermit = async (permitId: string) => {
    const res = await fetch(`/api/permits/${permitId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete permit');
    await fetchPermits();
  };

  const handleAddScheduleEvent = async (eventData: Partial<ScheduleEvent>) => {
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData)
    });
    if (!res.ok) throw new Error('Failed to create schedule event');
    await fetchSchedule();
    await fetchAuditLogs();
  };

  const handleUpdatePermit = async (permitId: string, updates: Partial<GovernmentPermit>) => {
    const res = await fetch(`/api/permits/${permitId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update permit');
    await fetchPermits();
  };

  const handleUpdateScheduleEvent = async (eventId: string, updates: Partial<ScheduleEvent>) => {
    const res = await fetch(`/api/schedule/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update schedule event');
    await fetchSchedule();
  };

  const handleDeleteScheduleEvent = async (eventId: string) => {
    const res = await fetch(`/api/schedule/${eventId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete schedule event');
    await fetchSchedule();
  };

  const handleCreateProject = async (projectData: Partial<ProjectProfile>) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
      });
      if (res.ok) {
        const created = await res.json();
        setProjects(prev => [created, ...prev]);
      }
    } catch (err) {
      console.error('Failed to create project:', err);
    }
  };

  const handleUpdateProject = async (id: string, updates: Partial<ProjectProfile>) => {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const updated = await res.json();
        setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p));
      }
    } catch (err) {
      console.error('Failed to update project:', err);
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setProjects(prev => prev.filter(p => p.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const handleAddExtendedPayroll = async (item: Partial<ExtendedPayrollItem>) => {
    try {
      const res = await fetch('/api/extended-payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      if (res.ok) {
        const created = await res.json();
        setExtendedPayroll(prev => [created, ...prev]);
      }
    } catch (err) {
      console.error('Failed to add payroll entry:', err);
    }
  };

  const handleUpdateExtendedPayroll = async (id: string, updates: Partial<ExtendedPayrollItem>) => {
    try {
      const res = await fetch(`/api/extended-payroll/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const updated = await res.json();
        setExtendedPayroll(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p));
      }
    } catch (err) {
      console.error('Failed to update payroll entry:', err);
    }
  };

  const handleDeleteExtendedPayroll = async (id: string) => {
    try {
      const res = await fetch(`/api/extended-payroll/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setExtendedPayroll(prev => prev.filter(p => p.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete payroll entry:', err);
    }
  };

  const handleSubmitChangeOrder = async (order: Partial<ChangeOrder>) => {
    try {
      const res = await fetch('/api/change-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      });
      if (res.ok) {
        fetchChangeOrders();
      }
    } catch (err) {
      console.error('Failed to submit change order:', err);
    }
  };

  const handleUpdateChangeOrderStatus = async (id: string, status: 'APPROVED' | 'REJECTED', approvedAmount?: number) => {
    try {
      const res = await fetch(`/api/change-orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status, 
          approvedAmount,
          approvedBy: (typeof session === 'object' && session?.name) ? session.name : 'Operations Director'
        })
      });
      if (res.ok) {
        fetchChangeOrders();
      }
    } catch (err) {
      console.error('Failed to update change order status:', err);
    }
  };

  const handleSubmitRfi = async (rfi: Partial<ProjectRFI>) => {
    try {
      const res = await fetch('/api/rfis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rfi)
      });
      if (res.ok) {
        fetchRfis();
      }
    } catch (err) {
      console.error('Failed to submit RFI:', err);
    }
  };

  const handleAnswerRfi = async (id: string, answer: string, status: 'OPEN' | 'UNDER_REVIEW' | 'ANSWERED' | 'CLOSED') => {
    try {
      const res = await fetch(`/api/rfis/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer, status })
      });
      if (res.ok) {
        fetchRfis();
      }
    } catch (err) {
      console.error('Failed to answer RFI:', err);
    }
  };

  const handleUpdateQuotationStatus = async (id: string, status: any, notes?: string) => {
    try {
      const res = await fetch(`/api/quotations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, projectNotes: notes })
      });
      if (res.ok) {
        fetchQuotations();
      }
    } catch (err) {
      console.error('Failed to update quotation status:', err);
    }
  };

  const handleConvertQuotationToProject = async (quotation: FitoutQuotationItem) => {
    try {
      const res = await fetch(`/api/quotations/${quotation.id}/convert-to-project`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchQuotations();
        fetchProjects();
      }
    } catch (err) {
      console.error('Failed to convert quotation to project:', err);
    }
  };

  const handleTriggerAiLaborScan = async () => {
    try {
      await fetch('/api/ai-recommendations/scan', { method: 'POST' });
      reloadAllData();
    } catch (err) {
      console.error('Failed to trigger live AI labor scan:', err);
    }
  };

  const handleLogManpowerAudit = async (auditData: any) => {
    try {
      const res = await fetch('/api/manpower-audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditData)
      });
      if (res.ok) {
        reloadAllData();
      }
    } catch (err) {
      console.error('Failed to log daily manpower audit:', err);
    }
  };

  // --- RENDERING ROUTER ---

  const renderActiveWorkspace = () => {
    if (session === null) {
      return <LandingPage onEnterPortal={() => setSession('login')} />;
    }

    if (session === 'login') {
      return (
        <LoginPortal 
          onLoginSuccess={(s) => handleInitiateLogin(s)} 
          onBackToLanding={() => setSession(null)} 
          initialInviteToken={urlInviteToken}
        />
      );
    }

    // All authenticated users route directly into CTVill Project Management Operations Portal

    return (
      <AdminPortal
          parcels={parcels}
          slots={slots}
          clients={clients}
          contractors={contractors}
          qaLogs={qaLogs}
          punchListDefects={punchListDefects}
          civilWorksMilestones={civilWorksMilestones}
          auditLogs={auditLogs}
          payroll={payroll}
          budget={budget}
          manpowerAudits={manpowerAudits}
          laborAllocations={laborAllocations}
          aiRecommendations={aiRecommendations}
          tasks={tasks}
          siteLogs={siteLogs}
          documents={documents}
          risks={risks}
          changeOrders={changeOrders}
          rfis={rfis}
          quotations={quotations}
          permits={permits}
          scheduleEvents={scheduleEvents}
          projects={projects}
          extendedPayroll={extendedPayroll}
          session={session}
          onAddParcel={handleAddParcel}
          onSubdivideParcel={handleSubdivideParcel}
          onRegisterClient={handleRegisterClient}
          onDeleteClient={handleDeleteClient}
          onAssignClient={handleAssignClient}
          onTransitionSlotStatus={handleTransitionSlotStatus}
          onUpdateTitlePipeline={handleUpdateTitlePipeline}
          onVerifyKyc={handleVerifyKyc}
          onCreateDefect={handleCreateDefect}
          onUpdateDefect={handleUpdateDefect}
          onUpdateCivilMilestone={handleUpdateCivilMilestone}
          onRegisterContractor={handleRegisterContractor}
          onDeleteContractor={handleDeleteContractor}
          onUpdateContractor={handleUpdateContractor}
          onUpdateContractors={handleUpdateContractors}
          onAddQALog={handleAddQALog}
          onAddPayroll={handleAddPayroll}
          onCreateManpowerAudit={handleCreateManpowerAudit}
          onSaveAllocation={handleSaveAllocation}
          onApplyAIRecommendation={handleApplyAIRecommendation}
          onAddTask={handleAddTask}
          onUpdateTaskStatus={handleUpdateTaskStatus}
          onDeleteTask={handleDeleteTask}
          onClearAllTasks={handleClearAllTasks}
          onAddSiteLog={handleAddSiteLog}
          onAddDocument={handleAddDocument}
          onUpdateDocument={handleUpdateDocument}
          onDeleteDocument={handleDeleteDocument}
          onSyncSchedule={handleSyncSchedule}
          onAddRisk={handleAddRisk}
          onImportCADLots={handleImportCADLots}
          onClearAllLots={handleClearAllLots}
          onDeleteParcel={handleDeleteParcel}
          onApplyAIPricing={handleApplyAIPricing}
          onAddPermit={handleAddPermit}
          onUpdatePermitStatus={handleUpdatePermitStatus}
          onUpdatePermit={handleUpdatePermit}
          onDeletePermit={handleDeletePermit}
          onAddScheduleEvent={handleAddScheduleEvent}
          onUpdateScheduleEvent={handleUpdateScheduleEvent}
          onDeleteScheduleEvent={handleDeleteScheduleEvent}
          onCreateProject={handleCreateProject}
          onUpdateProject={handleUpdateProject}
          onDeleteProject={handleDeleteProject}
          onAddExtendedPayroll={handleAddExtendedPayroll}
          onUpdateExtendedPayroll={handleUpdateExtendedPayroll}
          onDeleteExtendedPayroll={handleDeleteExtendedPayroll}
          onRecordPayment={handleRecordPayment}
          onDisbursePayroll={handleDisbursePayroll}
          onSubmitChangeOrder={handleSubmitChangeOrder}
          onUpdateChangeOrderStatus={handleUpdateChangeOrderStatus}
          onSubmitRfi={handleSubmitRfi}
          onAnswerRfi={handleAnswerRfi}
          onUpdateQuotationStatus={handleUpdateQuotationStatus}
          onConvertQuotationToProject={handleConvertQuotationToProject}
          onTriggerAiLaborScan={handleTriggerAiLaborScan}
          onLogManpowerAudit={handleLogManpowerAudit}
          onLogout={handleInitiateLogout}
          onUpdateSession={handleUpdateSession}
        />
      );

    return <LandingPage onEnterPortal={() => setSession('login')} />;
  };

  return (
    <div className="min-h-screen flex flex-col justify-between overflow-x-hidden relative select-none bg-slate-950">
      
      {/* Fullscreen Animated Loading/Transition Layer */}
      {loadingState.active && (
        <LoadingScreen
          session={loadingState.pendingSession || null}
          mode={loadingState.mode}
          onComplete={() => {
            if (loadingState.mode === 'login' && loadingState.pendingSession) {
              setSession(loadingState.pendingSession);
            } else if (loadingState.mode === 'logout') {
              setSession(null);
            }
            setLoadingState({ active: false, mode: 'login', pendingSession: null });
          }}
        />
      )}

      <div className="flex-1 w-full">
        {renderActiveWorkspace()}
      </div>
    </div>
  );
}
