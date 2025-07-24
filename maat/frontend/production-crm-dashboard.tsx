import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import { LineChart, BarChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { AlertCircle, Users, Target, TrendingUp, Activity, Plus, Eye, RefreshCw } from 'lucide-react'

// Environment configuration with validation
const getEnvVar = (key, fallback = '') => {
  if (typeof window !== 'undefined') {
    return window.env?.[key] || fallback
  }
  return process.env[key] || fallback
}

// Configuration object
const config = {
  supabase: {
    url: getEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
    key: getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  },
  wordpress: {
    url: getEnvVar('NEXT_PUBLIC_WORDPRESS_URL'),
    apiKey: getEnvVar('NEXT_PUBLIC_WORDPRESS_API_KEY')
  }
}

// Custom hooks for data fetching
const useSupabaseClient = () => {
  return useMemo(() => {
    if (!config.supabase.url || !config.supabase.key) {
      console.warn('Supabase configuration missing')
      return null
    }
    return createClient(config.supabase.url, config.supabase.key)
  }, [])
}

// Error boundary component
const ErrorBoundary = ({ children, fallback }) => {
  const [hasError, setHasError] = useState(false)
  
  useEffect(() => {
    const handleError = () => setHasError(true)
    window.addEventListener('error', handleError)
    return () => window.removeEventListener('error', handleError)
  }, [])
  
  if (hasError) {
    return fallback || <div className="error-boundary">Something went wrong. Please refresh the page.</div>
  }
  
  return children
}

// Loading spinner component
const LoadingSpinner = ({ size = 'medium' }) => (
  <div className={`loading-spinner loading-spinner--${size}`} role="status" aria-label="Loading">
    <RefreshCw className="animate-spin" size={size === 'small' ? 16 : size === 'large' ? 32 : 24} />
  </div>
)

// Stat card component
const StatCard = ({ title, value, icon: Icon, trend, loading = false }) => (
  <div className="stat-card" role="region" aria-labelledby={`stat-${title.replace(/\s+/g, '-').toLowerCase()}`}>
    <div className="stat-card__header">
      <h3 id={`stat-${title.replace(/\s+/g, '-').toLowerCase()}`} className="stat-card__title">{title}</h3>
      {Icon && <Icon className="stat-card__icon" size={20} />}
    </div>
    <div className="stat-card__content">
      {loading ? (
        <LoadingSpinner size="small" />
      ) : (
        <>
          <p className="stat-card__value">{value}</p>
          {trend && <span className={`stat-card__trend stat-card__trend--${trend > 0 ? 'positive' : 'negative'}`}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>}
        </>
      )}
    </div>
  </div>
)

// Main Dashboard Component
const Dashboard = () => {
  // State management
  const [state, setState] = useState({
    contacts: [],
    campaigns: [],
    funnels: [],
    analytics: {},
    loading: true,
    error: null,
    retryCount: 0
  })
  
  const [ui, setUI] = useState({
    refreshing: false,
    selectedTimeRange: '30d'
  })
  
  const supabase = useSupabaseClient()
  
  // WordPress API client with retry logic and error handling
  const wpFetch = useCallback(async (endpoint, method = 'GET', body = null, retries = 3) => {
    if (!config.wordpress.url || !config.wordpress.apiKey) {
      throw new Error('WordPress configuration missing')
    }
    
    const url = `${config.wordpress.url}/wp-json/enterprise-crm/v1${endpoint}`
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.wordpress.apiKey,
        'Cache-Control': 'no-cache'
      },
      body: body ? JSON.stringify(body) : null
    }
    
    for (let i = 0; i <= retries; i++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          if (response.status >= 500 && i < retries) {
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000))
            continue
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const contentType = response.headers.get('content-type')
        if (!contentType?.includes('application/json')) {
          throw new Error('Invalid response format')
        }
        
        return await response.json()
      } catch (err) {
        if (i === retries) {
          console.error(`WordPress API error after ${retries + 1} attempts:`, err)
          throw err
        }
        if (err.name === 'AbortError') {
          throw new Error('Request timeout')
        }
      }
    }
  }, [])
  
  // Data fetching function
  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      setState(prev => ({ ...prev, loading: !isRefresh, error: null }))
      setUI(prev => ({ ...prev, refreshing: isRefresh }))
      
      const promises = []
      
      // Fetch contacts from Supabase
      if (supabase) {
        promises.push(
          supabase
            .from('contacts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100)
            .then(({ data, error }) => {
              if (error) throw error
              return { contacts: data || [] }
            })
        )
      } else {
        promises.push(Promise.resolve({ contacts: [] }))
      }
      
      // Fetch WordPress data
      promises.push(
        Promise.allSettled([
          wpFetch('/campaigns'),
          wpFetch('/funnels'),
          wpFetch(`/analytics?range=${ui.selectedTimeRange}`)
        ]).then(results => ({
          campaigns: results[0].status === 'fulfilled' ? results[0].value : [],
          funnels: results[1].status === 'fulfilled' ? results[1].value : [],
          analytics: results[2].status === 'fulfilled' ? results[2].value : {}
        }))
      )
      
      const [supabaseData, wpData] = await Promise.all(promises)
      
      setState(prev => ({
        ...prev,
        ...supabaseData,
        ...wpData,
        loading: false,
        retryCount: 0
      }))
      
    } catch (err) {
      console.error('Fetch error:', err)
      setState(prev => ({
        ...prev,
        error: err.message || 'Failed to load data',
        loading: false,
        retryCount: prev.retryCount + 1
      }))
    } finally {
      setUI(prev => ({ ...prev, refreshing: false }))
    }
  }, [supabase, wpFetch, ui.selectedTimeRange])
  
  // Set up real-time subscriptions
  useEffect(() => {
    if (!supabase) return
    
    const contactsSubscription = supabase
      .channel('contacts-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contacts' },
        (payload) => {
          setState(prev => {
            const newContacts = [...prev.contacts]
            
            if (payload.eventType === 'DELETE') {
              return {
                ...prev,
                contacts: newContacts.filter(c => c.id !== payload.old?.id)
              }
            }
            
            if (payload.eventType === 'INSERT') {
              return {
                ...prev,
                contacts: [payload.new, ...newContacts.slice(0, 99)]
              }
            }
            
            if (payload.eventType === 'UPDATE') {
              return {
                ...prev,
                contacts: newContacts.map(c => 
                  c.id === payload.new?.id ? payload.new : c
                )
              }
            }
            
            return prev
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(contactsSubscription)
    }
  }, [supabase])
  
  // Initial data fetch
  useEffect(() => {
    fetchData()
  }, [fetchData])
  
  // Auto-refresh data every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (!state.loading && !ui.refreshing) {
        fetchData(true)
      }
    }, 5 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [fetchData, state.loading, ui.refreshing])
  
  // Event handlers
  const handleCreateCampaign = useCallback(async (campaignData) => {
    try {
      const result = await wpFetch('/campaigns', 'POST', campaignData)
      if (result) {
        setState(prev => ({
          ...prev,
          campaigns: [result, ...prev.campaigns]
        }))
        return { success: true, data: result }
      }
      return { success: false, error: 'Failed to create campaign' }
    } catch (err) {
      console.error('Create campaign error:', err)
      return { success: false, error: err.message }
    }
  }, [wpFetch])

  const handleTriggerFunnel = useCallback(async (funnelId, contactIds) => {
    try {
      const result = await wpFetch(`/funnels/${funnelId}/trigger`, 'POST', { contactIds })
      return { success: !!result, data: result }
    } catch (err) {
      console.error('Trigger funnel error:', err)
      return { success: false, error: err.message }
    }
  }, [wpFetch])
  
  const handleRefresh = useCallback(() => {
    fetchData(true)
  }, [fetchData])
  
  const handleRetry = useCallback(() => {
    fetchData()
  }, [fetchData])
  
  // Computed values
  const stats = useMemo(() => ({
    totalContacts: state.analytics.total_contacts || state.contacts.length,
    activeCampaigns: state.analytics.active_campaigns || state.campaigns.filter(c => c.status === 'active').length,
    activeFunnels: state.analytics.active_funnels || state.funnels.filter(f => f.status === 'active').length,
    conversionRate: state.analytics.conversion_rate || 0
  }), [state.analytics, state.contacts.length, state.campaigns, state.funnels])
  
  // Error state
  if (state.error && state.retryCount >= 3) {
    return (
      <div className="error-container" role="alert">
        <div className="error-content">
          <AlertCircle className="error-icon" size={48} />
          <h2>Unable to Load Dashboard</h2>
          <p>{state.error}</p>
          <button 
            onClick={handleRetry} 
            className="btn-primary"
            aria-label="Retry loading dashboard"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }
  
  return (
    <ErrorBoundary>
      <div className="dashboard-container">
        <header className="dashboard-header">
          <div className="header-content">
            <h1>Enterprise CRM Dashboard</h1>
            <div className="header-actions">
              <button 
                onClick={handleRefresh}
                disabled={ui.refreshing}
                className="btn-ghost"
                aria-label="Refresh dashboard data"
              >
                <RefreshCw className={ui.refreshing ? 'animate-spin' : ''} size={16} />
                Refresh
              </button>
              <button className="btn-primary" aria-label="Create new campaign">
                <Plus size={16} />
                New Campaign
              </button>
              <button className="btn-secondary" aria-label="Create new funnel">
                <Plus size={16} />
                Create Funnel
              </button>
            </div>
          </div>
        </header>
        
        {state.loading && (
          <div className="loading-overlay">
            <LoadingSpinner size="large" />
            <p>Loading dashboard data...</p>
          </div>
        )}
        
        <main className="dashboard-main">
          <section className="stats-overview" aria-labelledby="stats-heading">
            <h2 id="stats-heading" className="sr-only">Dashboard Statistics</h2>
            <StatCard 
              title="Total Contacts" 
              value={stats.totalContacts.toLocaleString()} 
              icon={Users}
              loading={state.loading}
            />
            <StatCard 
              title="Active Campaigns" 
              value={stats.activeCampaigns.toLocaleString()} 
              icon={Target}
              loading={state.loading}
            />
            <StatCard 
              title="Running Funnels" 
              value={stats.activeFunnels.toLocaleString()} 
              icon={Activity}
              loading={state.loading}
            />
            <StatCard 
              title="Conversion Rate" 
              value={stats.conversionRate ? `${stats.conversionRate}%` : 'N/A'} 
              icon={TrendingUp}
              loading={state.loading}
            />
          </section>
          
          {!state.loading && (
            <>
              <section className="analytics-section" aria-labelledby="analytics-heading">
                <h2 id="analytics-heading">Performance Analytics</h2>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={state.analytics.performance_data || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="contacts" stroke="#8884d8" strokeWidth={2} />
                      <Line type="monotone" dataKey="conversions" stroke="#82ca9d" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
              
              <div className="data-sections">
                <section className="contacts-section" aria-labelledby="contacts-heading">
                  <h2 id="contacts-heading">Recent Contacts</h2>
                  <div className="table-container">
                    <table className="data-table" role="table">
                      <thead>
                        <tr>
                          <th scope="col">Name</th>
                          <th scope="col">Email</th>
                          <th scope="col">Source</th>
                          <th scope="col">Status</th>
                          <th scope="col">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.contacts.slice(0, 5).map(contact => (
                          <tr key={contact.id}>
                            <td>{contact.first_name} {contact.last_name}</td>
                            <td>{contact.email}</td>
                            <td>{contact.source}</td>
                            <td>
                              <span className={`status-badge status-badge--${contact.status?.toLowerCase() || 'unknown'}`}>
                                {contact.status || 'Unknown'}
                              </span>
                            </td>
                            <td>
                              <button 
                                className="btn-sm" 
                                aria-label={`View details for ${contact.first_name} ${contact.last_name}`}
                              >
                                <Eye size={14} />
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                
                <section className="campaigns-section" aria-labelledby="campaigns-heading">
                  <h2 id="campaigns-heading">Active Campaigns</h2>
                  <div className="campaigns-grid">
                    {state.campaigns
                      .filter(c => c.status === 'active')
                      .slice(0, 3)
                      .map(campaign => (
                        <div key={campaign.id} className="campaign-card">
                          <h3>{campaign.name}</h3>
                          <p><strong>Subject:</strong> {campaign.subject}</p>
                          <p><strong>Status:</strong> {campaign.status}</p>
                          <div className="campaign-stats">
                            <span>Sent: {(campaign.sent_count || 0).toLocaleString()}</span>
                            <span>Opened: {campaign.open_rate || 0}%</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </section>
              </div>
              
              <section className="funnels-section" aria-labelledby="funnels-heading">
                <h2 id="funnels-heading">Funnel Performance</h2>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={state.analytics.funnel_performance || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="conversions" fill="#8884d8" />
                      <Bar dataKey="dropoffs" fill="#ff7300" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
      
      <style jsx>{`
        .dashboard-container {
          min-height: 100vh;
          background-color: #f8fafc;
          color: #1e293b;
        }
        
        .dashboard-header {
          background: white;
          border-bottom: 1px solid #e2e8f0;
          padding: 1rem 2rem;
          position: sticky;
          top: 0;
          z-index: 100;
        }
        
        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          max-width: 1200px;
          margin: 0 auto;
        }
        
        .dashboard-header h1 {
          font-size: 1.5rem;
          font-weight: 600;
          margin: 0;
        }
        
        .header-actions {
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }
        
        .btn-primary, .btn-secondary, .btn-ghost, .btn-sm {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .btn-primary {
          background: #3b82f6;
          color: white;
        }
        
        .btn-primary:hover:not(:disabled) {
          background: #2563eb;
        }
        
        .btn-secondary {
          background: #e2e8f0;
          color: #475569;
        }
        
        .btn-secondary:hover:not(:disabled) {
          background: #cbd5e1;
        }
        
        .btn-ghost {
          background: transparent;
          color: #64748b;
        }
        
        .btn-ghost:hover:not(:disabled) {
          background: #f1f5f9;
        }
        
        .btn-sm {
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
        }
        
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .loading-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(248, 250, 252, 0.8);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          gap: 1rem;
        }
        
        .loading-spinner {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .dashboard-main {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }
        
        .stats-overview {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }
        
        .stat-card {
          background: white;
          border-radius: 0.5rem;
          padding: 1.5rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .stat-card__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        
        .stat-card__title {
          font-size: 0.875rem;
          color: #64748b;
          margin: 0;
          font-weight: 500;
        }
        
        .stat-card__icon {
          color: #94a3b8;
        }
        
        .stat-card__content {
          display: flex;
          align-items: baseline;
          gap: 0.75rem;
        }
        
        .stat-card__value {
          font-size: 2rem;
          font-weight: 700;
          color: #1e293b;
          margin: 0;
        }
        
        .stat-card__trend {
          font-size: 0.75rem;
          font-weight: 500;
        }
        
        .stat-card__trend--positive {
          color: #059669;
        }
        
        .stat-card__trend--negative {
          color: #dc2626;
        }
        
        .analytics-section, .funnels-section {
          background: white;
          border-radius: 0.5rem;
          padding: 1.5rem;
          margin-bottom: 2rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .analytics-section h2, .funnels-section h2 {
          margin: 0 0 1.5rem 0;
          font-size: 1.25rem;
          font-weight: 600;
        }
        
        .chart-container {
          width: 100%;
          height: 400px;
        }
        
        .funnels-section .chart-container {
          height: 300px;
        }
        
        .data-sections {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 2rem;
          margin-bottom: 2rem;
        }
        
        .contacts-section, .campaigns-section {
          background: white;
          border-radius: 0.5rem;
          padding: 1.5rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .contacts-section h2, .campaigns-section h2 {
          margin: 0 0 1.5rem 0;
          font-size: 1.25rem;
          font-weight: 600;
        }
        
        .table-container {
          overflow-x: auto;
        }
        
        .data-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .data-table th,
        .data-table td {
          text-align: left;
          padding: 0.75rem;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .data-table th {
          font-weight: 600;
          color: #374151;
          background: #f9fafb;
        }
        
        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.75rem;
          font-weight: 500;
          text-transform: uppercase;
        }
        
        .status-badge--active {
          background: #dcfce7;
          color: #166534;
        }
        
        .status-badge--inactive {
          background: #fee2e2;
          color: #991b1b;
        }
        
        .status-badge--pending {
          background: #fef3c7;
          color: #92400e;
        }
        
        .status-badge--unknown {
          background: #f1f5f9;
          color: #475569;
        }
        
        .campaigns-grid {
          display: grid;
          gap: 1rem;
        }
        
        .campaign-card {
          border: 1px solid #e2e8f0;
          border-radius: 0.375rem;
          padding: 1rem;
        }
        
        .campaign-card h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1rem;
          font-weight: 600;
        }
        
        .campaign-card p {
          margin: 0.25rem 0;
          font-size: 0.875rem;
          color: #64748b;
        }
        
        .campaign-stats {
          display: flex;
          gap: 1rem;
          margin-top: 0.75rem;
          font-size: 0.75rem;
          color: #475569;
        }
        
        .error-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: #f8fafc;
        }
        
        .error-content {
          text-align: center;
          max-width: 400px;
          padding: 2rem;
        }
        
        .error-icon {
          color: #dc2626;
          margin-bottom: 1rem;
        }
        
        .error-content h2 {
          margin: 0 0 1rem 0;
          color: #1e293b;
        }
        
        .error-content p {
          color: #64748b;
          margin: 0 0 1.5rem 0;
        }
        
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        
        @media (max-width: 768px) {
          .dashboard-header {
            padding: 1rem;
          }
          
          .header-content {
            flex-direction: column;
            gap: 1rem;
            align-items: flex-start;
          }
          
          .dashboard-main {
            padding: 1rem;
          }
          
          .data-sections {
            grid-template-columns: 1fr;
          }
          
          .stats-overview {
            grid-template-columns: 1fr;
          }
          
          .chart-container {
            height: 300px;
          }
        }
      `}</style>
    </ErrorBoundary>
  )
}

export default Dashboard