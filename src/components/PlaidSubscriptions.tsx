import React, { useCallback, useEffect, useState } from 'react';

const API_BASE = 'http://localhost:3000/api';

interface PlaidSubscription {
  streamId: string;
  merchantName: string;
  description: string;
  amount: number;
  frequency: string;
  category: string[];
  lastDate: string;
  nextProjectedDate?: string;
  isActive: boolean;
  status: string;
  accountId: string;
  institutionName?: string;
}

interface PlaidSubscriptionsResponse {
  subscriptions: PlaidSubscription[];
  totalMonthlyAmount: number;
  totalAnnualAmount: number;
}

interface PlaidSubscriptionsProps {
  userId: string;
  useMockData?: boolean;
}

interface CancellationModal {
  serviceName: string;
  url: string;
  difficulty: string;
  notes?: string;
  email?: string;
  matchScore: number;
  source: 'curated' | 'ai-generated';
}

export function PlaidSubscriptions({ userId, useMockData = false }: PlaidSubscriptionsProps) {
  const [data, setData] = useState<PlaidSubscriptionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellationModal, setCancellationModal] = useState<CancellationModal | null>(null);
  const [cancellationLoading, setCancellationLoading] = useState(false);

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Use mock endpoint for demo, or real Plaid endpoint
      const endpoint = useMockData
        ? `${API_BASE}/demo/subscriptions`
        : `${API_BASE}/plaid/recurring/${userId}`;

      const response = await fetch(endpoint);

      if (!response.ok) {
        if (response.status === 404) {
          // No connected accounts - not an error, just empty state
          setData({ subscriptions: [], totalMonthlyAmount: 0, totalAnnualAmount: 0 });
          return;
        }
        throw new Error('Failed to fetch subscriptions');
      }

      const json = await response.json();
      
      // Normalize response from either endpoint
      if (useMockData) {
        setData({
          subscriptions: json.subscriptions.map((s: any) => ({
            streamId: s.id,
            merchantName: s.name,
            description: s.description,
            amount: s.amount,
            frequency: s.frequency,
            category: [s.category],
            lastDate: s.lastCharged,
            nextProjectedDate: s.nextCharge,
            isActive: s.isActive,
            status: s.status,
            accountId: 'mock',
            logo: s.logo,
          })),
          totalMonthlyAmount: json.summary.monthlyTotal,
          totalAnnualAmount: json.summary.annualTotal,
        });
      } else {
        setData(json);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [userId, useMockData]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const handleCancelSubscription = async (serviceName: string) => {
    setCancellationLoading(true);
    try {
      const response = await fetch(`${API_BASE}/cancellation-links/${encodeURIComponent(serviceName)}`);
      const json = await response.json();

      if (response.ok && json.success) {
        setCancellationModal(json.data);
      } else {
        setError(json.error || "Could not find cancellation information for this service");
        setTimeout(() => setError(null), 3000);
      }
    } catch (err) {
      setError("Failed to fetch cancellation information");
      setTimeout(() => setError(null), 3000);
    } finally {
      setCancellationLoading(false);
    }
  };

  const getDifficultyColor = (difficulty: string): string => {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return '#10B981';
      case 'medium':
        return '#F59E0B';
      case 'hard':
        return '#EF4444';
      case 'impossible':
        return '#7C3AED';
      default:
        return '#6B7280';
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280' }}>
        <div style={{
          width: '24px',
          height: '24px',
          border: '3px solid #E5E7EB',
          borderTopColor: '#3B82F6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 8px'
        }} />
        Loading subscriptions...
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '16px', 
        background: '#FEF2F2', 
        borderRadius: '8px',
        border: '1px solid #FECACA'
      }}>
        <p style={{ margin: 0, fontSize: '13px', color: '#DC2626' }}>{error}</p>
      </div>
    );
  }

  if (!data || data.subscriptions.length === 0) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center', 
        color: '#6B7280',
        background: '#F9FAFB',
        borderRadius: '8px',
        border: '1px dashed #E5E7EB'
      }}>
        <p style={{ margin: '0 0 4px', fontSize: '14px' }}>No subscriptions detected</p>
        <p style={{ margin: 0, fontSize: '12px' }}>Connect a bank account to auto-detect subscriptions</p>
      </div>
    );
  }

  const getCategoryColor = (category: string) => {
    switch (category?.toUpperCase()) {
      case 'ENTERTAINMENT': return '#E11D48';
      case 'SOFTWARE': return '#7C3AED';
      case 'PERSONAL_CARE': return '#0891B2';
      default: return '#6B7280';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category?.toUpperCase()) {
      case 'ENTERTAINMENT': return '🎬';
      case 'SOFTWARE': return '💻';
      case 'PERSONAL_CARE': return '💪';
      default: return '💳';
    }
  };

  return (
    <div>
      {/* Summary Card */}
      <div style={{
        background: 'linear-gradient(135deg, #1E40AF 0%, #7C3AED 100%)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '12px',
        color: 'white'
      }}>
        <p style={{ margin: '0 0 4px', fontSize: '12px', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Monthly Spending
        </p>
        <p style={{ margin: '0 0 8px', fontSize: '28px', fontWeight: '700' }}>
          ${data.totalMonthlyAmount.toFixed(2)}
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', opacity: 0.9 }}>
          <span>{data.subscriptions.filter(s => s.isActive).length} active subscriptions</span>
          <span>${data.totalAnnualAmount.toFixed(2)}/year</span>
        </div>
      </div>

      {/* Subscription List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {data.subscriptions.slice(0, 8).map((sub) => (
          <div
            key={sub.streamId}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px',
              background: '#FFFFFF',
              borderRadius: '10px',
              border: '1px solid #E5E7EB',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
              {/* Category Icon */}
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: `${getCategoryColor(sub.category[0])}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                flexShrink: 0
              }}>
                {getCategoryIcon(sub.category[0])}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: 0,
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#111827',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {sub.merchantName}
                </p>
                <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>
                  {sub.frequency} • {sub.isActive ? 'Active' : 'Inactive'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <button
                onClick={() => handleCancelSubscription(sub.merchantName)}
                disabled={cancellationLoading}
                title="Cancel Subscription"
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid #DC2626',
                  background: '#FEE2E2',
                  color: '#DC2626',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: cancellationLoading ? 'not-allowed' : 'pointer',
                  opacity: cancellationLoading ? 0.5 : 1
                }}>
                Cancel
              </button>

              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#111827' }}>
                  ${sub.amount.toFixed(2)}
                </p>
                <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF' }}>
                  /mo
                </p>
              </div>
            </div>
          </div>
        ))}
        
        {data.subscriptions.length > 8 && (
          <p style={{ textAlign: 'center', fontSize: '12px', color: '#6B7280', margin: '8px 0 0' }}>
            +{data.subscriptions.length - 8} more subscriptions
          </p>
        )}
      </div>

      {/* Cancellation Modal */}
      {cancellationModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
          onClick={() => setCancellationModal(null)}>
          <div
            style={{
              background: "#1F2937",
              padding: 20,
              borderRadius: 8,
              width: 320,
              border: "2px solid #F97316",
              boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
              maxHeight: "80vh",
              overflowY: "auto"
            }}
            onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: 16, fontWeight: 600, color: "#F9FAFB" }}>
              Cancel {cancellationModal.serviceName}
            </h3>

            {/* Difficulty badge */}
            <div style={{ marginBottom: 12 }}>
              <span
                style={{
                  padding: "4px 8px",
                  borderRadius: 4,
                  background: getDifficultyColor(cancellationModal.difficulty),
                  color: "white",
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase"
                }}>
                {cancellationModal.difficulty}
              </span>
            </div>

            {/* Instructions */}
            {cancellationModal.notes && (
              <div style={{ marginBottom: 16, padding: 12, background: "#374151", borderRadius: 6 }}>
                <p style={{ margin: 0, fontSize: 13, color: "#E5E7EB", lineHeight: "1.5" }}>
                  {cancellationModal.notes}
                </p>
              </div>
            )}

            {/* Email if needed */}
            {cancellationModal.email && (
              <div style={{ marginBottom: 16, padding: 12, background: "#374151", borderRadius: 6 }}>
                <p style={{ margin: 0, fontSize: 13, color: "#E5E7EB" }}>
                  📧 Email: <span style={{ color: "#F97316", fontWeight: 500 }}>{cancellationModal.email}</span>
                </p>
              </div>
            )}

            {/* AI-generated warning */}
            {cancellationModal.source === 'ai-generated' && (
              <div style={{ marginBottom: 16, padding: 12, background: "#1e3a8a", borderRadius: 6, border: "1px solid #60A5FA" }}>
                <p style={{ margin: 0, fontSize: 12, color: "#DBEAFE" }}>
                  🤖 AI-Generated URL ({cancellationModal.matchScore}% confidence) - Please verify this link is correct before proceeding.
                </p>
              </div>
            )}

            {/* Fuzzy match warning for curated entries */}
            {cancellationModal.source === 'curated' && cancellationModal.matchScore < 100 && (
              <div style={{ marginBottom: 16, padding: 12, background: "#451a03", borderRadius: 6, border: "1px solid #F59E0B" }}>
                <p style={{ margin: 0, fontSize: 12, color: "#FDE68A" }}>
                  ⚠️ Fuzzy match ({cancellationModal.matchScore}% confidence) - Please verify this is the correct service.
                </p>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setCancellationModal(null)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px solid #4B5563",
                  background: "#374151",
                  color: "#E5E7EB",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer"
                }}>
                Close
              </button>
              <button
                onClick={() => {
                  window.open(cancellationModal.url, '_blank');
                  setCancellationModal(null);
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: "#DC2626",
                  color: "white",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer"
                }}>
                Go to Cancellation Page
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlaidSubscriptions;
