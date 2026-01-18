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

export function PlaidSubscriptions({ userId, useMockData = false }: PlaidSubscriptionsProps) {
  const [data, setData] = useState<PlaidSubscriptionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#111827' }}>
                ${sub.amount.toFixed(2)}
              </p>
              <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF' }}>
                /mo
              </p>
            </div>
          </div>
        ))}
        
        {data.subscriptions.length > 8 && (
          <p style={{ textAlign: 'center', fontSize: '12px', color: '#6B7280', margin: '8px 0 0' }}>
            +{data.subscriptions.length - 8} more subscriptions
          </p>
        )}
      </div>
    </div>
  );
}

export default PlaidSubscriptions;
