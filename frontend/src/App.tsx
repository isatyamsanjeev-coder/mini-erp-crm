import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  FileSpreadsheet, 
  LogOut, 
  Plus, 
  Search, 
  Edit3, 
  AlertTriangle, 
  CheckCircle, 
  Printer, 
  Clock, 
  MapPin, 
  ClipboardList 
} from 'lucide-react';
import './App.css';

const API_BASE = 'http://localhost:5000/api';

// --- TS Interfaces ---
interface User {
  id: string;
  username: string;
  name: string;
  role: 'Admin' | 'Sales' | 'Warehouse' | 'Accounts';
}

interface Customer {
  id: string;
  name: string;
  mobile: string;
  email: string;
  businessName: string;
  gstNumber: string | null;
  type: 'Retail' | 'Wholesale' | 'Distributor';
  address: string;
  status: 'Lead' | 'Active' | 'Inactive';
  followUpDate: string | null;
  notes: string | null;
  createdAt: string;
  followUps?: FollowUpNote[];
}

interface FollowUpNote {
  id: string;
  customerId: string;
  note: string;
  createdBy: string;
  createdAt: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  unitPrice: number;
  currentStock: number;
  minStockAlert: number;
  location: string;
  createdAt: string;
}

interface StockLog {
  id: string;
  productId: string;
  qtyChanged: number;
  movementType: 'IN' | 'OUT';
  reason: string;
  createdBy: string;
  timestamp: string;
}

interface Challan {
  id: string;
  challanNumber: string;
  customerId: string;
  customer?: Customer;
  totalQuantity: number;
  status: 'Draft' | 'Confirmed' | 'Cancelled';
  createdBy: string;
  createdAt: string;
  items?: ChallanItem[];
}

interface ChallanItem {
  id: string;
  productId: string;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
}

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('erp_token'));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('erp_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // --- API Fetch Helper ---
  const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers
    };
    
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }
      
      return data;
    } catch (err: any) {
      if (err.message.includes('token') || err.message.includes('Unauthorized') || err.message.includes('Forbidden')) {
        handleLogout();
      }
      throw err;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('erp_token');
    localStorage.removeItem('erp_user');
    setToken(null);
    setUser(null);
    setCurrentTab('dashboard');
  };

  const showNotification = (type: 'success' | 'error', text: string) => {
    if (type === 'success') {
      setSuccessMsg(text);
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg(text);
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  // Auto-set tab based on role view access when role changes
  useEffect(() => {
    if (user) {
      const allowed = getAllowedTabs(user.role);
      if (!allowed.includes(currentTab)) {
        setCurrentTab(allowed[0]);
      }
    }
  }, [user]);

  if (!token || !user) {
    return <LoginView setToken={setToken} setUser={setUser} showNotification={showNotification} />;
  }

  return (
    <div className="app-container">
      {/* Notifications */}
      {successMsg && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', backgroundColor: 'var(--color-success)',
          padding: '12px 24px', borderRadius: '8px', zIndex: 2000, boxShadow: 'var(--shadow-lg)',
          animation: 'fadeIn 0.2s', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <CheckCircle size={18} /> {successMsg}
        </div>
      )}
      {errorMsg && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', backgroundColor: 'var(--color-danger)',
          padding: '12px 24px', borderRadius: '8px', zIndex: 2000, boxShadow: 'var(--shadow-lg)',
          animation: 'fadeIn 0.2s', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <AlertTriangle size={18} /> {errorMsg}
        </div>
      )}

      {/* Sidebar Navigation */}
      <Sidebar user={user} currentTab={currentTab} setCurrentTab={setCurrentTab} handleLogout={handleLogout} />

      {/* Main Content Area */}
      <div className="main-content">
        <header className="header">
          <h1 className="header-title" style={{ textTransform: 'capitalize' }}>{currentTab} Portal</h1>
          <div className="header-actions">
            <span className="badge badge-info">{user.role} Privilege</span>
          </div>
        </header>

        <div className="content-body">
          {currentTab === 'dashboard' && <DashboardTab user={user} apiFetch={apiFetch} setCurrentTab={setCurrentTab} />}
          {currentTab === 'crm' && <CrmTab user={user} apiFetch={apiFetch} showNotification={showNotification} />}
          {currentTab === 'inventory' && <InventoryTab user={user} apiFetch={apiFetch} showNotification={showNotification} />}
          {currentTab === 'challans' && <ChallansTab user={user} apiFetch={apiFetch} showNotification={showNotification} />}
        </div>
      </div>
    </div>
  );
}

// --- Sidebar Rules ---
const getAllowedTabs = (role: string) => {
  switch (role) {
    case 'Admin':
      return ['dashboard', 'crm', 'inventory', 'challans'];
    case 'Sales':
      return ['dashboard', 'crm', 'inventory', 'challans'];
    case 'Warehouse':
      return ['dashboard', 'inventory', 'challans'];
    case 'Accounts':
      return ['dashboard', 'crm', 'inventory', 'challans'];
    default:
      return ['dashboard'];
  }
};

// Login View Component
interface LoginProps {
  setToken: (t: string | null) => void;
  setUser: (u: User | null) => void;
  showNotification: (type: 'success' | 'error', text: string) => void;
}
function LoginView({ setToken, setUser, showNotification }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      showNotification('error', 'Please fill in both fields');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      localStorage.setItem('erp_token', data.token);
      localStorage.setItem('erp_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      showNotification('success', `Welcome back, ${data.user.name}!`);
    } catch (err: any) {
      showNotification('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (role: string) => {
    const creds: Record<string, string> = {
      admin: 'admin123',
      sales: 'sales123',
      warehouse: 'warehouse123',
      accounts: 'accounts123'
    };
    setUsername(role);
    setPassword(creds[role]);
  };

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh',
      background: 'linear-gradient(135deg, #090d16 0%, #1e1b4b 100%)', padding: '20px'
    }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '420px', padding: '40px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div className="logo-icon" style={{ margin: '0 auto 16px', width: '50px', height: '50px', fontSize: '24px' }}>E</div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#fff' }}>Mini ERP + CRM</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '6px' }}>Sign in to access your portal</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input 
              type="text" id="username" className="input-field" 
              value={username} onChange={e => setUsername(e.target.value)} 
              placeholder="e.g. admin, sales" 
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input 
              type="password" id="password" className="input-field" 
              value={password} onChange={e => setPassword(e.target.value)} 
              placeholder="••••••••" 
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }} disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="demo-logins-panel">
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Quick Login Selectors</span>
          <div className="demo-login-grid">
            <button className="demo-login-btn" onClick={() => fillCredentials('admin')}>Admin</button>
            <button className="demo-login-btn" onClick={() => fillCredentials('sales')}>Sales</button>
            <button className="demo-login-btn" onClick={() => fillCredentials('warehouse')}>Warehouse</button>
            <button className="demo-login-btn" onClick={() => fillCredentials('accounts')}>Accounts</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Sidebar Navigation Component
interface SidebarProps {
  user: User;
  currentTab: string;
  setCurrentTab: (t: string) => void;
  handleLogout: () => void;
}
function Sidebar({ user, currentTab, setCurrentTab, handleLogout }: SidebarProps) {
  const allowedTabs = getAllowedTabs(user.role);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-icon">Ω</div>
        <span className="logo-text">Apex Portal</span>
      </div>

      <ul className="sidebar-menu">
        {allowedTabs.includes('dashboard') && (
          <li className={`menu-item ${currentTab === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentTab('dashboard')}>
            <LayoutDashboard size={18} /> Dashboard
          </li>
        )}
        {allowedTabs.includes('crm') && (
          <li className={`menu-item ${currentTab === 'crm' ? 'active' : ''}`} onClick={() => setCurrentTab('crm')}>
            <Users size={18} /> Customer CRM
          </li>
        )}
        {allowedTabs.includes('inventory') && (
          <li className={`menu-item ${currentTab === 'inventory' ? 'active' : ''}`} onClick={() => setCurrentTab('inventory')}>
            <Package size={18} /> Products & Stock
          </li>
        )}
        {allowedTabs.includes('challans') && (
          <li className={`menu-item ${currentTab === 'challans' ? 'active' : ''}`} onClick={() => setCurrentTab('challans')}>
            <FileSpreadsheet size={18} /> Sales Challans
          </li>
        )}
      </ul>

      <div className="sidebar-footer">
        <div className="user-profile" style={{ marginBottom: '16px' }}>
          <div className="avatar">{user.name.charAt(0)}</div>
          <div className="user-info">
            <div className="user-name">{user.name}</div>
            <div className="user-role">{user.role}</div>
          </div>
        </div>
        <button onClick={handleLogout} className="btn btn-secondary" style={{ width: '100%', gap: '8px', fontSize: '13px', padding: '8px' }}>
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </aside>
  );
}

// Dashboard / KPI Metrics Component
interface DashboardProps {
  user: User;
  apiFetch: any;
  setCurrentTab: (t: string) => void;
}
function DashboardTab({ user, apiFetch, setCurrentTab }: DashboardProps) {
  const [stats, setStats] = useState({
    customers: 0,
    products: 0,
    lowStock: 0,
    challans: 0
  });
  const [recentChallans, setRecentChallans] = useState<Challan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        // Load data in parallel depending on permissions
        const calls = [
          apiFetch('/products'),
          apiFetch('/challans')
        ];
        
        // Add customers check if user is allowed
        const allowedTabs = getAllowedTabs(user.role);
        if (allowedTabs.includes('crm')) {
          calls.push(apiFetch('/customers'));
        } else {
          calls.push(Promise.resolve({ customers: [] }));
        }

        const [products, challans, customersData] = await Promise.all(calls);

        const customersCount = customersData.customers ? customersData.customers.length : 0;
        const productsCount = products.length;
        const lowStockCount = products.filter((p: Product) => p.currentStock <= p.minStockAlert).length;
        const challanCount = challans.length;

        setStats({
          customers: customersCount,
          products: productsCount,
          lowStock: lowStockCount,
          challans: challanCount
        });

        setRecentChallans(challans.slice(0, 4));
      } catch (err) {
        console.error('Failed to load dashboard metrics', err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: '20px' }}>Loading operational statistics...</div>;

  return (
    <div>
      {/* Top Professional Greeting Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(14, 165, 233, 0.03) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        padding: '24px 28px',
        marginBottom: '24px',
        borderRadius: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>Welcome back, {user.name}</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px', fontSize: '13.5px' }}>
            System node online. You are logged into the <strong style={{ color: '#fff' }}>{user.role}</strong> operational dashboard.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ borderLeft: '2px solid var(--border-color)', paddingLeft: '20px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Active Nodes</span>
            <div style={{ display: 'flex', alignItems: 'center', color: '#fff', fontSize: '13px', marginTop: '2px', fontWeight: 500 }}>
              <span className="pulse-dot"></span> MySQL Cluster Live
            </div>
          </div>
        </div>
      </div>

      {/* Stats KPI Cards with Sparklines */}
      <div className="dashboard-grid">
        {getAllowedTabs(user.role).includes('crm') && (
          <div className="glass-card stat-card" onClick={() => setCurrentTab('crm')} style={{ cursor: 'pointer' }}>
            <div>
              <div className="stat-label">CRM Accounts</div>
              <div className="stat-value">{stats.customers}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg className="sparkline" viewBox="0 0 100 30" width="70" height="25" style={{ opacity: 0.7 }}>
                <path d="M0,20 Q15,5 30,22 T60,10 T90,25 T100,8" fill="none" stroke="var(--color-primary)" strokeWidth="2" />
                <circle cx="100" cy="8" r="2.5" fill="var(--color-primary)" />
              </svg>
              <div className="stat-icon primary"><Users size={20} /></div>
            </div>
          </div>
        )}
        <div className="glass-card stat-card" onClick={() => setCurrentTab('inventory')} style={{ cursor: 'pointer' }}>
          <div>
            <div className="stat-label">Catalog Products</div>
            <div className="stat-value">{stats.products}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg className="sparkline" viewBox="0 0 100 30" width="70" height="25" style={{ opacity: 0.7 }}>
              <path d="M0,15 Q20,10 40,25 T80,8 T100,18" fill="none" stroke="var(--color-info)" strokeWidth="2" />
              <circle cx="100" cy="18" r="2.5" fill="var(--color-info)" />
            </svg>
            <div className="stat-icon info"><Package size={20} /></div>
          </div>
        </div>
        <div className="glass-card stat-card" onClick={() => setCurrentTab('inventory')} style={{ cursor: 'pointer' }}>
          <div>
            <div className="stat-label">Low Stock Alerts</div>
            <div className="stat-value" style={{ color: stats.lowStock > 0 ? 'var(--color-danger)' : '#fff' }}>{stats.lowStock}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg className="sparkline" viewBox="0 0 100 30" width="70" height="25" style={{ opacity: 0.7 }}>
              <path d="M0,5 Q30,28 60,12 T100,28" fill="none" stroke="var(--color-danger)" strokeWidth="2" />
              <circle cx="100" cy="28" r="2.5" fill="var(--color-danger)" />
            </svg>
            <div className="stat-icon danger"><AlertTriangle size={20} /></div>
          </div>
        </div>
        <div className="glass-card stat-card" onClick={() => setCurrentTab('challans')} style={{ cursor: 'pointer' }}>
          <div>
            <div className="stat-label">Sales Challans</div>
            <div className="stat-value">{stats.challans}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg className="sparkline" viewBox="0 0 100 30" width="70" height="25" style={{ opacity: 0.7 }}>
              <path d="M0,28 Q20,20 40,5 T80,25 T100,4" fill="none" stroke="var(--color-success)" strokeWidth="2" />
              <circle cx="100" cy="4" r="2.5" fill="var(--color-success)" />
            </svg>
            <div className="stat-icon success"><FileSpreadsheet size={20} /></div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '24px', marginTop: '24px' }}>
        {/* Recent Challans Panel */}
        <div className="glass-card">
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} style={{ color: 'var(--color-primary)' }} /> Recent Sales Activity
          </h3>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Challan No</th>
                  <th>Customer Account</th>
                  <th>Total Quantity</th>
                  <th>Challan Status</th>
                </tr>
              </thead>
              <tbody>
                {recentChallans.map(ch => (
                  <tr key={ch.id}>
                    <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{ch.challanNumber}</td>
                    <td style={{ fontWeight: 500 }}>{ch.customer?.businessName || 'N/A'}</td>
                    <td>{ch.totalQuantity} units</td>
                    <td>
                      <span className={`badge badge-${ch.status === 'Confirmed' ? 'success' : ch.status === 'Draft' ? 'warning' : 'danger'}`}>
                        {ch.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentChallans.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>No challans recorded.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Panel & Health Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Operations Controls */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ClipboardList size={16} style={{ color: 'var(--color-info)' }} /> Operations Control Center
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {getAllowedTabs(user.role).includes('crm') && user.role !== 'Warehouse' && user.role !== 'Accounts' && (
                <button className="quick-action-btn" onClick={() => setCurrentTab('crm')}>
                  <Plus size={14} /> New CRM Lead
                </button>
              )}
              {getAllowedTabs(user.role).includes('challans') && user.role !== 'Accounts' && (
                <button className="quick-action-btn" onClick={() => setCurrentTab('challans')}>
                  <Plus size={14} /> Issue Challan
                </button>
              )}
              {user.role === 'Warehouse' && (
                <button className="quick-action-btn" onClick={() => setCurrentTab('inventory')}>
                  <Plus size={14} /> New Catalog
                </button>
              )}
              <button className="quick-action-btn secondary" onClick={() => window.print()}>
                <Printer size={14} /> Print Overview
              </button>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Connection Node</span>
                <span style={{ color: '#fff', fontWeight: 500 }}>Aiven MySQL Cluster</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Server Health</span>
                <span style={{ color: 'var(--color-success)', fontWeight: 500 }}>Active (100% Uptime)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Privilege Level</span>
                <span style={{ color: 'var(--color-info)', fontWeight: 500 }}>{user.role} Authorization</span>
              </div>
            </div>
          </div>

          {/* Directory Panel */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>Role Restrictions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
              <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.015)', border: '1px solid var(--border-color)' }}>
                <strong style={{ color: 'var(--color-primary)' }}>Sales Team</strong>
                <p style={{ color: 'var(--text-muted)', marginTop: '3px' }}>Can manage CRM accounts, add follow-ups, and write sales challans.</p>
              </div>
              <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.015)', border: '1px solid var(--border-color)' }}>
                <strong style={{ color: 'var(--color-success)' }}>Warehouse Team</strong>
                <p style={{ color: 'var(--text-muted)', marginTop: '3px' }}>Can create catalog products, edit layouts, and audit movements.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// CRM / Customer Management Component
interface CrmProps {
  user: User;
  apiFetch: any;
  showNotification: any;
}
function CrmTab({ user, apiFetch, showNotification }: CrmProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Detail Drawer state
  const [selectedCustId, setSelectedCustId] = useState<string | null>(null);
  const [custDetail, setCustDetail] = useState<Customer | null>(null);
  const [newNote, setNewNote] = useState('');

  // Add/Edit Modal state
  const [showFormModal, setShowFormModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    mobile: '',
    email: '',
    businessName: '',
    gstNumber: '',
    type: 'Retail',
    address: '',
    status: 'Lead',
    followUpDate: '',
    notes: ''
  });

  const isReadOnly = user.role === 'Warehouse' || user.role === 'Accounts';

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const query = `?search=${encodeURIComponent(search)}&status=${status}&type=${type}&page=${page}&limit=10`;
      const data = await apiFetch(`/customers${query}`);
      setCustomers(data.customers);
      setTotalPages(data.pagination.totalPages);
    } catch (err: any) {
      showNotification('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [search, status, type, page]);

  // Load detailed notes drawer
  const viewCustomerDetails = async (id: string) => {
    try {
      const data = await apiFetch(`/customers/${id}`);
      setCustDetail(data);
      setSelectedCustId(id);
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    try {
      await apiFetch(`/customers/${selectedCustId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ note: newNote })
      });
      setNewNote('');
      showNotification('success', 'Follow-up note appended');
      // Refresh details
      if (selectedCustId) viewCustomerDetails(selectedCustId);
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  const handleOpenCreateModal = () => {
    setFormData({
      id: '',
      name: '',
      mobile: '',
      email: '',
      businessName: '',
      gstNumber: '',
      type: 'Retail',
      address: '',
      status: 'Lead',
      followUpDate: '',
      notes: ''
    });
    setIsEditing(false);
    setShowFormModal(true);
  };

  const handleOpenEditModal = (c: Customer) => {
    setFormData({
      id: c.id,
      name: c.name,
      mobile: c.mobile,
      email: c.email,
      businessName: c.businessName,
      gstNumber: c.gstNumber || '',
      type: c.type,
      address: c.address,
      status: c.status,
      followUpDate: c.followUpDate ? c.followUpDate.split('T')[0] : '',
      notes: ''
    });
    setIsEditing(true);
    setShowFormModal(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        gstNumber: formData.gstNumber.trim() === '' ? null : formData.gstNumber,
        followUpDate: formData.followUpDate === '' ? null : formData.followUpDate
      };

      if (isEditing) {
        await apiFetch(`/customers/${formData.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showNotification('success', 'Customer profile updated successfully');
      } else {
        await apiFetch('/customers', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showNotification('success', 'Customer added successfully');
      }
      setShowFormModal(false);
      loadCustomers();
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Operational Contacts Directory</h2>
        {!isReadOnly && (
          <button className="btn btn-primary" onClick={handleOpenCreateModal}>
            <Plus size={16} /> Add Customer
          </button>
        )}
      </div>

      {/* Filters Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
          <input 
            type="text" className="input-field" style={{ paddingLeft: '36px' }}
            placeholder="Search by name, phone, business..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <select className="select-field" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="Lead">Lead</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>

        <select className="select-field" value={type} onChange={e => { setType(e.target.value); setPage(1); }}>
          <option value="">All Account Types</option>
          <option value="Retail">Retail</option>
          <option value="Wholesale">Wholesale</option>
          <option value="Distributor">Distributor</option>
        </select>
      </div>

      {/* Data Table */}
      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Contact Name</th>
              <th>Business Name</th>
              <th>Type</th>
              <th>Mobile</th>
              <th>Status</th>
              <th>Next Follow-up</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Querying CRM entries...</td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No customer match found.</td>
              </tr>
            ) : (
              customers.map(c => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#fff' }}>{c.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.email}</div>
                  </td>
                  <td>{c.businessName}</td>
                  <td><span className="badge badge-info">{c.type}</span></td>
                  <td>{c.mobile}</td>
                  <td>
                    <span className={`badge badge-${c.status === 'Active' ? 'success' : c.status === 'Lead' ? 'warning' : 'danger'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '13px' }}>
                    {c.followUpDate ? new Date(c.followUpDate).toLocaleDateString() : 'Not Set'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => viewCustomerDetails(c.id)}>
                        Details & Notes
                      </button>
                      {!isReadOnly && (
                        <button className="btn btn-secondary" style={{ padding: '6px', color: 'var(--color-primary)' }} onClick={() => handleOpenEditModal(c)}>
                          <Edit3 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      <div className="pagination-controls">
        <span style={{ color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</button>
          <button className="btn btn-secondary" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </div>

      {/* DETAIL DRAWER */}
      {selectedCustId && custDetail && (
        <div className="drawer-backdrop" onClick={() => setSelectedCustId(null)}>
          <div className="drawer-content" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h3 className="drawer-title">Customer Inspection</h3>
              <button className="close-btn" onClick={() => setSelectedCustId(null)}>×</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '16px', color: '#fff', marginBottom: '8px' }}>{custDetail.name}</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', fontSize: '13px' }}>
                  <div><span style={{ color: 'var(--text-muted)' }}>Business:</span> {custDetail.businessName}</div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Email:</span> {custDetail.email}</div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Mobile:</span> {custDetail.mobile}</div>
                  <div><span style={{ color: 'var(--text-muted)' }}>GSTIN:</span> {custDetail.gstNumber || 'Not Registered'}</div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Address:</span> {custDetail.address}</div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                    <span className="badge badge-info">{custDetail.type}</span>
                    <span className={`badge badge-${custDetail.status === 'Active' ? 'success' : custDetail.status === 'Lead' ? 'warning' : 'danger'}`}>
                      {custDetail.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes Timeline */}
              <div>
                <h4 style={{ color: '#fff', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={16} /> Follow-up Timeline
                </h4>
                
                {!isReadOnly && (
                  <form onSubmit={handleAddNote} style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" className="input-field" placeholder="Append follow-up report..."
                      value={newNote} onChange={e => setNewNote(e.target.value)}
                    />
                    <button type="submit" className="btn btn-primary" style={{ padding: '10px' }}><Plus size={16} /></button>
                  </form>
                )}

                <div className="timeline-container">
                  {custDetail.followUps?.map(note => (
                    <div className="timeline-item" key={note.id}>
                      <div className="timeline-date">{new Date(note.createdAt).toLocaleString()}</div>
                      <div className="timeline-text">{note.note}</div>
                      <div className="timeline-author">Logged by: {note.createdBy}</div>
                    </div>
                  ))}
                  {custDetail.followUps?.length === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>
                      No follow-ups recorded yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE/EDIT DIALOG */}
      {showFormModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">{isEditing ? 'Modify Account Details' : 'Register New Customer'}</h3>
              <button className="close-btn" onClick={() => setShowFormModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleSaveCustomer}>
              <div className="form-row">
                <div className="form-group">
                  <label>Contact Name *</label>
                  <input type="text" className="input-field" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Business Trade Name *</label>
                  <input type="text" className="input-field" required value={formData.businessName} onChange={e => setFormData({...formData, businessName: e.target.value})} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Mobile Contact *</label>
                  <input type="text" className="input-field" required value={formData.mobile} onChange={e => setFormData({...formData, mobile: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Email Address *</label>
                  <input type="email" className="input-field" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>GST Number (Optional)</label>
                  <input type="text" className="input-field" value={formData.gstNumber} onChange={e => setFormData({...formData, gstNumber: e.target.value})} placeholder="e.g. 29AAAAA1111A1Z1" />
                </div>
                <div className="form-group">
                  <label>Customer Account Type *</label>
                  <select className="select-field" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                    <option value="Retail">Retail</option>
                    <option value="Wholesale">Wholesale</option>
                    <option value="Distributor">Distributor</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Operational Address *</label>
                <textarea className="input-field" rows={2} style={{ resize: 'none' }} required value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Lead Stage Status *</label>
                  <select className="select-field" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                    <option value="Lead">Lead</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Scheduled Follow-up Date</label>
                  <input type="date" className="input-field" value={formData.followUpDate} onChange={e => setFormData({...formData, followUpDate: e.target.value})} />
                </div>
              </div>

              {!isEditing && (
                <div className="form-group">
                  <label>Initial Interaction Notes</label>
                  <textarea className="input-field" rows={2} style={{ resize: 'none' }} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Describe initial call summary..." />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowFormModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Inventory Catalog / Stock component
interface InventoryProps {
  user: User;
  apiFetch: any;
  showNotification: any;
}
function InventoryTab({ user, apiFetch, showNotification }: InventoryProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [lowStock, setLowStock] = useState('false');
  const [loading, setLoading] = useState(true);

  // Logs drawer state
  const [viewingLogsProd, setViewingLogsProd] = useState<Product | null>(null);
  const [logs, setLogs] = useState<StockLog[]>([]);

  // Add/Edit modal state
  const [showProdModal, setShowProdModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    sku: '',
    category: '',
    unitPrice: 0,
    currentStock: 0,
    minStockAlert: 10,
    location: ''
  });

  // Stock intake modal state
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustProd, setAdjustProd] = useState<Product | null>(null);
  const [adjustForm, setAdjustForm] = useState({
    quantity: 1,
    movementType: 'IN',
    reason: ''
  });

  const isReadOnly = user.role === 'Sales' || user.role === 'Accounts';

  const loadProducts = async () => {
    try {
      setLoading(true);
      const query = `?search=${encodeURIComponent(search)}&category=${category}&lowStock=${lowStock}`;
      const data = await apiFetch(`/products${query}`);
      setProducts(data);
    } catch (err: any) {
      showNotification('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [search, category, lowStock]);

  const viewLogs = async (p: Product) => {
    try {
      const data = await apiFetch(`/products/${p.id}/logs`);
      setLogs(data);
      setViewingLogsProd(p);
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  const handleOpenCreateModal = () => {
    setFormData({
      id: '',
      name: '',
      sku: '',
      category: '',
      unitPrice: 0,
      currentStock: 0,
      minStockAlert: 10,
      location: ''
    });
    setIsEditing(false);
    setShowProdModal(true);
  };

  const handleOpenEditModal = (p: Product) => {
    setFormData({
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      unitPrice: p.unitPrice,
      currentStock: p.currentStock,
      minStockAlert: p.minStockAlert,
      location: p.location
    });
    setIsEditing(true);
    setShowProdModal(true);
  };

  const handleOpenAdjustModal = (p: Product) => {
    setAdjustProd(p);
    setAdjustForm({
      quantity: 1,
      movementType: 'IN',
      reason: ''
    });
    setShowAdjustModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        unitPrice: parseFloat(formData.unitPrice as any),
        currentStock: parseInt(formData.currentStock as any, 10),
        minStockAlert: parseInt(formData.minStockAlert as any, 10)
      };

      if (isEditing) {
        await apiFetch(`/products/${formData.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showNotification('success', 'Product specifications updated');
      } else {
        await apiFetch('/products', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showNotification('success', 'Product registered in inventory catalog');
      }
      setShowProdModal(false);
      loadProducts();
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustProd) return;
    try {
      await apiFetch(`/products/${adjustProd.id}/stock`, {
        method: 'POST',
        body: JSON.stringify({
          quantity: parseInt(adjustForm.quantity as any, 10),
          movementType: adjustForm.movementType,
          reason: adjustForm.reason
        })
      });
      showNotification('success', `Logged stock ${adjustForm.movementType} adjustment successfully`);
      setShowAdjustModal(false);
      loadProducts();
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Warehouse Stock & Catalog</h2>
        {!isReadOnly && (
          <button className="btn btn-primary" onClick={handleOpenCreateModal}>
            <Plus size={16} /> Add Product
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
          <input 
            type="text" className="input-field" style={{ paddingLeft: '36px' }}
            placeholder="Search by product name or SKU/Code..."
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select className="select-field" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          <option value="Food Grains">Food Grains</option>
          <option value="Edible Oils">Edible Oils</option>
          <option value="Spices & Condiments">Spices & Condiments</option>
          <option value="Beverages">Beverages</option>
        </select>

        <select className="select-field" value={lowStock} onChange={e => setLowStock(e.target.value)}>
          <option value="false">All Stock Levels</option>
          <option value="true">⚠️ Alert Levels Only</option>
        </select>
      </div>

      {/* Table list */}
      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Product Details</th>
              <th>SKU Code</th>
              <th>Category</th>
              <th>Unit Price</th>
              <th>Stock Level</th>
              <th>Warehouse Row</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Querying product rows...</td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No catalog items match search.</td>
              </tr>
            ) : (
              products.map(p => {
                const isAlert = p.currentStock <= p.minStockAlert;
                return (
                  <tr key={p.id} style={isAlert ? { backgroundColor: 'rgba(239, 68, 68, 0.02)' } : {}}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#fff' }}>{p.name}</div>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--color-info)' }}>{p.sku}</td>
                    <td>{p.category}</td>
                    <td>₹{p.unitPrice.toFixed(2)}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 700, color: isAlert ? 'var(--color-danger)' : '#fff' }}>{p.currentStock} units</span>
                          {isAlert ? (
                            <span style={{ fontSize: '10px', color: 'var(--color-danger)', fontWeight: 600 }}>Low Stock</span>
                          ) : (
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Limit: {p.minStockAlert}</span>
                          )}
                        </div>
                        <div className="stock-bar-container">
                          <div 
                            className={`stock-bar-fill ${isAlert ? 'warning' : 'normal'}`}
                            style={{ width: `${Math.min(100, (p.currentStock / Math.max(1, p.minStockAlert * 3.5)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                        <MapPin size={13} /> {p.location}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {!isReadOnly && (
                          <>
                            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleOpenAdjustModal(p)}>
                              Adjust Stock
                            </button>
                            <button className="btn btn-secondary" style={{ padding: '6px', color: 'var(--color-primary)' }} onClick={() => handleOpenEditModal(p)}>
                              <Edit3 size={14} />
                            </button>
                          </>
                        )}
                        {!isReadOnly && (
                          <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => viewLogs(p)} title="Stock Logs">
                            <ClipboardList size={14} />
                          </button>
                        )}
                        {isReadOnly && <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Locked (Read-Only)</span>}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* LOGS TIMELINE DRAWER */}
      {viewingLogsProd && (
        <div className="drawer-backdrop" onClick={() => setViewingLogsProd(null)}>
          <div className="drawer-content" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h3 className="drawer-title" style={{ fontSize: '16px' }}>Stock Ledger: {viewingLogsProd.name}</h3>
              <button className="close-btn" onClick={() => setViewingLogsProd(null)}>×</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                  <div><span style={{ color: 'var(--text-muted)' }}>SKU:</span> {viewingLogsProd.sku}</div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Category:</span> {viewingLogsProd.category}</div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Warehouse row:</span> {viewingLogsProd.location}</div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Current stock:</span> {viewingLogsProd.currentStock}</div>
                </div>
              </div>

              <div className="timeline-container" style={{ maxHeight: '80%' }}>
                {logs.map(log => (
                  <div className="timeline-item" key={log.id} style={{ paddingLeft: '20px' }}>
                    <div style={{
                      position: 'absolute', left: '-12px', top: '6px', width: '6px', height: '6px',
                      borderRadius: '50%', backgroundColor: log.movementType === 'IN' ? 'var(--color-success)' : 'var(--color-danger)'
                    }} />
                    <div className="timeline-date">{new Date(log.timestamp).toLocaleString()}</div>
                    <div className="timeline-text" style={{ padding: '8px 12px' }}>
                      <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: log.movementType === 'IN' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {log.movementType === 'IN' ? '+' : '-'}{log.qtyChanged} units
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{log.movementType} Log</span>
                      </div>
                      <div>{log.reason}</div>
                    </div>
                    <div className="timeline-author">Logged by: {log.createdBy}</div>
                  </div>
                ))}
                {logs.length === 0 && (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>No logs recorded.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE/EDIT MODAL */}
      {showProdModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">{isEditing ? 'Modify Catalog Details' : 'Add New Product to Warehouse'}</h3>
              <button className="close-btn" onClick={() => setShowProdModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleSaveProduct}>
              <div className="form-group">
                <label>Product Name *</label>
                <input type="text" className="input-field" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>SKU / Serial Code *</label>
                  <input type="text" className="input-field" required value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} placeholder="e.g. BEV-NES-001" disabled={isEditing} />
                </div>
                <div className="form-group">
                  <label>Category *</label>
                  <select className="select-field" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                    <option value="">Select Category</option>
                    <option value="Food Grains">Food Grains</option>
                    <option value="Edible Oils">Edible Oils</option>
                    <option value="Spices & Condiments">Spices & Condiments</option>
                    <option value="Beverages">Beverages</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Unit Selling Price (INR) *</label>
                  <input type="number" step="0.01" className="input-field" required value={formData.unitPrice || ''} onChange={e => setFormData({...formData, unitPrice: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="form-group">
                  <label>Min stock alert threshold *</label>
                  <input type="number" className="input-field" required value={formData.minStockAlert} onChange={e => setFormData({...formData, minStockAlert: parseInt(e.target.value, 10) || 0})} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Warehouse Storage Location *</label>
                  <input type="text" className="input-field" required value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="e.g. Aisle A - Row 1" />
                </div>
                {!isEditing && (
                  <div className="form-group">
                    <label>Initial Quantity Intake</label>
                    <input type="number" className="input-field" value={formData.currentStock} onChange={e => setFormData({...formData, currentStock: parseInt(e.target.value, 10) || 0})} />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowProdModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADJUST STOCK LEVEL MODAL */}
      {showAdjustModal && adjustProd && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Manual Stock Intake/Outtake</h3>
              <button className="close-btn" onClick={() => setShowAdjustModal(false)}>×</button>
            </div>
            
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Product: <strong style={{ color: '#fff' }}>{adjustProd.name}</strong><br />
              Current Stock: <strong style={{ color: '#fff' }}>{adjustProd.currentStock} units</strong>
            </div>

            <form onSubmit={handleAdjustStock}>
              <div className="form-group">
                <label>Adjustment Type</label>
                <select className="select-field" value={adjustForm.movementType} onChange={e => setAdjustForm({...adjustForm, movementType: e.target.value as any})}>
                  <option value="IN">Stock Intake (IN)</option>
                  <option value="OUT">Stock Dispatch (OUT)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Quantity</label>
                <input type="number" min="1" className="input-field" value={adjustForm.quantity} onChange={e => setAdjustForm({...adjustForm, quantity: parseInt(e.target.value, 10) || 1})} />
              </div>

              <div className="form-group">
                <label>Audit Explanation Reason *</label>
                <input type="text" className="input-field" required placeholder="e.g. Goods intake, damage wastage" value={adjustForm.reason} onChange={e => setAdjustForm({...adjustForm, reason: e.target.value})} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdjustModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Adjustment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Challan wizard and Invoice pdf component
interface ChallansProps {
  user: User;
  apiFetch: any;
  showNotification: any;
}
function ChallansTab({ user, apiFetch, showNotification }: ChallansProps) {
  const [challans, setChallans] = useState<Challan[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  // Detail Modal / Printer layout state
  const [selectedChallanId, setSelectedChallanId] = useState<string | null>(null);
  const [challanDetail, setChallanDetail] = useState<Challan | null>(null);

  // Wizard state
  const [showWizardModal, setShowWizardModal] = useState(false);
  const [customerOptions, setCustomerOptions] = useState<Customer[]>([]);
  const [productCatalog, setProductCatalog] = useState<Product[]>([]);
  
  const [wizardForm, setWizardForm] = useState<{
    customerId: string;
    status: 'Draft' | 'Confirmed';
    items: { productId: string; quantity: number }[];
  }>({
    customerId: '',
    status: 'Draft',
    items: [{ productId: '', quantity: 1 }]
  });

  const isReadOnly = user.role === 'Accounts';
  const isWarehouse = user.role === 'Warehouse';
  const isSalesOrAdmin = user.role === 'Sales' || user.role === 'Admin';

  const loadChallans = async () => {
    try {
      setLoading(true);
      const query = `?search=${encodeURIComponent(search)}&status=${status}`;
      const data = await apiFetch(`/challans${query}`);
      setChallans(data);
    } catch (err: any) {
      showNotification('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChallans();
  }, [search, status]);

  const loadWizardOptions = async () => {
    try {
      const [prodsData, custsData] = await Promise.all([
        apiFetch('/products'),
        apiFetch('/customers?limit=100') // fetch sufficient contacts
      ]);
      setProductCatalog(prodsData);
      setCustomerOptions(custsData.customers);
    } catch (err: any) {
      showNotification('error', 'Failed to load options for challan creator');
    }
  };

  const handleOpenWizard = () => {
    setWizardForm({
      customerId: '',
      status: 'Draft',
      items: [{ productId: '', quantity: 1 }]
    });
    loadWizardOptions();
    setShowWizardModal(true);
  };

  const handleAddWizardItem = () => {
    setWizardForm({
      ...wizardForm,
      items: [...wizardForm.items, { productId: '', quantity: 1 }]
    });
  };

  const handleRemoveWizardItem = (index: number) => {
    const newItems = [...wizardForm.items];
    newItems.splice(index, 1);
    setWizardForm({ ...wizardForm, items: newItems });
  };

  const handleWizardItemChange = (index: number, field: 'productId' | 'quantity', value: any) => {
    const newItems = [...wizardForm.items];
    if (field === 'productId') {
      newItems[index].productId = value;
    } else {
      newItems[index].quantity = parseInt(value, 10) || 1;
    }
    setWizardForm({ ...wizardForm, items: newItems });
  };

  const handleCreateChallan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wizardForm.customerId) {
      showNotification('error', 'Customer selection is required');
      return;
    }
    
    // Validate duplicates
    const pids = wizardForm.items.map(i => i.productId);
    if (new Set(pids).size !== pids.length) {
      showNotification('error', 'Duplicate products are selected. Please combine quantities.');
      return;
    }

    if (pids.some(pid => pid === '')) {
      showNotification('error', 'All item selections must be filled');
      return;
    }

    // Verify stock checks if Confirmed
    if (wizardForm.status === 'Confirmed') {
      for (const item of wizardForm.items) {
        const prod = productCatalog.find(p => p.id === item.productId);
        if (prod && prod.currentStock < item.quantity) {
          showNotification('error', `Insufficient stock for "${prod.name}". Available: ${prod.currentStock}, Requested: ${item.quantity}`);
          return;
        }
      }
    }

    try {
      await apiFetch('/challans', {
        method: 'POST',
        body: JSON.stringify(wizardForm)
      });
      showNotification('success', `Sales Challan recorded successfully as ${wizardForm.status}`);
      setShowWizardModal(false);
      loadChallans();
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  const handleOpenChallanDetail = async (id: string) => {
    try {
      const data = await apiFetch(`/challans/${id}`);
      setChallanDetail(data);
      setSelectedChallanId(id);
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  const updateChallanStatus = async (id: string, targetStatus: 'Confirmed' | 'Cancelled') => {
    try {
      await apiFetch(`/challans/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: targetStatus })
      });
      showNotification('success', `Challan status set to ${targetStatus}`);
      setSelectedChallanId(null);
      loadChallans();
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Sales Challans Directory</h2>
        {isSalesOrAdmin && (
          <button className="btn btn-primary" onClick={handleOpenWizard}>
            <Plus size={16} /> Create Challan
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.5fr', gap: '16px', marginBottom: '24px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
          <input 
            type="text" className="input-field" style={{ paddingLeft: '36px' }}
            placeholder="Search by challan number, client business name..."
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select className="select-field" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="Draft">Draft</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Challan No</th>
              <th>Customer client</th>
              <th>Quantity Items</th>
              <th>Status</th>
              <th>Issued By</th>
              <th>Issued Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Querying challan files...</td>
              </tr>
            ) : challans.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No sales challans match criteria.</td>
              </tr>
            ) : (
              challans.map(ch => (
                <tr key={ch.id}>
                  <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{ch.challanNumber}</td>
                  <td>
                    <div style={{ fontWeight: 500, color: '#fff' }}>{ch.customer?.businessName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{ch.customer?.name}</div>
                  </td>
                  <td>{ch.totalQuantity} units</td>
                  <td>
                    <span className={`badge badge-${ch.status === 'Confirmed' ? 'success' : ch.status === 'Draft' ? 'warning' : 'danger'}`}>
                      {ch.status}
                    </span>
                  </td>
                  <td>{ch.createdBy}</td>
                  <td style={{ fontSize: '13px' }}>{new Date(ch.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleOpenChallanDetail(ch.id)}>
                      View & Print
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE CHALLAN WIZARD MODAL */}
      {showWizardModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Create Sales Challan Flow</h3>
              <button className="close-btn" onClick={() => setShowWizardModal(false)}>×</button>
            </div>

            <form onSubmit={handleCreateChallan}>
              <div className="form-row">
                <div className="form-group">
                  <label>Select Customer *</label>
                  <select className="select-field" required value={wizardForm.customerId} onChange={e => setWizardForm({...wizardForm, customerId: e.target.value})}>
                    <option value="">-- Choose Business Account --</option>
                    {customerOptions.map(c => (
                      <option key={c.id} value={c.id}>{c.businessName} ({c.name})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Fulfillment Stage *</label>
                  <select className="select-field" value={wizardForm.status} onChange={e => setWizardForm({...wizardForm, status: e.target.value as any})}>
                    <option value="Draft">Draft (Save specs only)</option>
                    <option value="Confirmed">Confirmed (Dispatch / Reduce Stock)</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Items block */}
              <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label style={{ fontSize: '14px', color: '#fff', fontWeight: 600 }}>Select Product Items</label>
                  <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={handleAddWizardItem}>
                    + Add Product Row
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                  {wizardForm.items.map((item, index) => {
                    const selectedProd = productCatalog.find(p => p.id === item.productId);
                    return (
                      <div key={index} style={{ display: 'grid', gridTemplateColumns: '3fr 1.5fr 1fr 40px', gap: '10px', alignItems: 'center' }}>
                        <select className="select-field" required value={item.productId} onChange={e => handleWizardItemChange(index, 'productId', e.target.value)}>
                          <option value="">-- Select Product --</option>
                          {productCatalog.map(p => (
                            <option key={p.id} value={p.id}>{p.name} (Code: {p.sku})</option>
                          ))}
                        </select>

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <input type="number" min="1" className="input-field" placeholder="Qty" required value={item.quantity} onChange={e => handleWizardItemChange(index, 'quantity', e.target.value)} />
                          {selectedProd && (
                            <span style={{ fontSize: '11px', color: selectedProd.currentStock < item.quantity ? 'var(--color-danger)' : 'var(--text-muted)', marginTop: '2px', paddingLeft: '4px' }}>
                              Avail: {selectedProd.currentStock}
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right' }}>
                          ₹{selectedProd ? (selectedProd.unitPrice * item.quantity).toFixed(2) : '0.00'}
                        </div>

                        <button type="button" className="btn btn-danger" style={{ padding: '8px' }} disabled={wizardForm.items.length === 1} onClick={() => handleRemoveWizardItem(index)}>
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total Calculation */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Estimated Bill Total:</span>
                <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-success)' }}>
                  ₹{wizardForm.items.reduce((total, item) => {
                    const prod = productCatalog.find(p => p.id === item.productId);
                    return total + (prod ? prod.unitPrice * item.quantity : 0);
                  }, 0).toFixed(2)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowWizardModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Challan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHALLAN DETAIL DRAWER / INVOICE VIEW */}
      {selectedChallanId && challanDetail && (
        <div className="drawer-backdrop" onClick={() => setSelectedChallanId(null)}>
          <div className="drawer-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="drawer-header no-print">
              <h3 className="drawer-title">Tax Invoice Document</h3>
              <button className="close-btn" onClick={() => setSelectedChallanId(null)}>×</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
              {/* Printed invoice wrapper */}
              <div className="invoice-box" style={{ 
                padding: '24px', backgroundColor: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)',
                borderRadius: '8px', color: 'var(--text-main)' 
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '16px' }}>
                  <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>APEX DISTRIBUTORS</h2>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Industrial Hub, Sector-2, Bangalore - 560002</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--color-primary)' }}>{challanDetail.challanNumber}</div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Date: {new Date(challanDetail.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '12px', marginBottom: '24px' }}>
                  <div>
                    <div style={{ fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Bill To:</div>
                    <strong>{challanDetail.customer?.businessName}</strong><br />
                    <span>Prop: {challanDetail.customer?.name}</span><br />
                    <span>Address: {challanDetail.customer?.address}</span><br />
                    <span>GSTIN: {challanDetail.customer?.gstNumber || 'Unregistered'}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Challan Info:</div>
                    <span>Fulfillment Status: </span>
                    <span style={{ fontWeight: 600 }} className={`badge badge-${challanDetail.status === 'Confirmed' ? 'success' : challanDetail.status === 'Draft' ? 'warning' : 'danger'}`}>
                      {challanDetail.status}
                    </span><br />
                    <span>Authorized By: {challanDetail.createdBy}</span>
                  </div>
                </div>

                {/* Items */}
                <table className="custom-table" style={{ width: '100%', marginBottom: '20px' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '8px' }}>Product description</th>
                      <th style={{ padding: '8px' }}>SKU</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Price</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {challanDetail.items?.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: '8px' }}>{item.name}</td>
                        <td style={{ padding: '8px', fontStyle: 'italic' }}>{item.sku}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>₹{item.unitPrice.toFixed(2)}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>{item.quantity}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>₹{(item.unitPrice * item.quantity).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', gap: '40px', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Quantity Total:</span>
                    <span>{challanDetail.totalQuantity} items</span>
                  </div>
                  <div style={{ display: 'flex', gap: '40px', fontSize: '15px', fontWeight: 700 }}>
                    <span style={{ color: '#fff' }}>Grand Bill Total:</span>
                    <span style={{ color: 'var(--color-success)' }}>
                      ₹{challanDetail.items?.reduce((tot, item) => tot + (item.unitPrice * item.quantity), 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Print and status actions */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => window.print()} style={{ gap: '8px' }}>
                <Printer size={16} /> Print/PDF Invoice
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                {/* Transits */}
                {challanDetail.status === 'Draft' && !isReadOnly && (
                  <button className="btn btn-success" onClick={() => updateChallanStatus(challanDetail.id, 'Confirmed')}>
                    Confirm & Dispatch
                  </button>
                )}
                {challanDetail.status === 'Confirmed' && !isReadOnly && !isWarehouse && (
                  <button className="btn btn-danger" onClick={() => updateChallanStatus(challanDetail.id, 'Cancelled')}>
                    Cancel & Revert Stock
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
