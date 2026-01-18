import React, { useCallback, useEffect, useState } from 'react';

const API_BASE = 'http://localhost:3000';

interface PlaidLinkButtonProps {
  userId: string;
  onSuccess?: () => void;
}

export function PlaidLinkButton({ userId, onSuccess }: PlaidLinkButtonProps) {
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);

  // Check if user has connected accounts
  useEffect(() => {
    const checkConnected = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/plaid/items/${userId}`);
        if (response.ok) {
          const data = await response.json();
          setConnected(data.length > 0);
        }
      } catch (err) {
        console.error('Failed to check connection status:', err);
      }
    };
    
    if (userId) {
      checkConnected();
    }
  }, [userId]);

  // Open Plaid Link page in new tab
  const openPlaidLink = useCallback(() => {
    setLoading(true);
    
    // Open the backend's Plaid Link page
    const plaidUrl = `${API_BASE}/plaid-link?userId=${encodeURIComponent(userId)}`;
    
    console.log('[PlaidLink] Opening Plaid Link page:', plaidUrl);
    
    chrome.tabs.create({ url: plaidUrl }, (tab) => {
      if (!tab?.id) {
        setLoading(false);
        return;
      }
      
      const tabId = tab.id;
      
      // Background script will auto-close the tab when it detects success=true in URL
      // We just need to listen for tab removal to update our state
      const handleTabRemoved = async (removedTabId: number) => {
        if (removedTabId === tabId) {
          chrome.tabs.onRemoved.removeListener(handleTabRemoved);
          setLoading(false);
          
          // Check if accounts were connected
          try {
            const response = await fetch(`${API_BASE}/api/plaid/items/${userId}`);
            if (response.ok) {
              const data = await response.json();
              if (data.length > 0) {
                setConnected(true);
                onSuccess?.();
              }
            }
          } catch (err) {
            console.error('Failed to check connection:', err);
          }
        }
      };
      
      chrome.tabs.onRemoved.addListener(handleTabRemoved);
      
      // Clear listener after 5 minutes max
      setTimeout(() => {
        chrome.tabs.onRemoved.removeListener(handleTabRemoved);
        setLoading(false);
      }, 5 * 60 * 1000);
    });
  }, [userId, onSuccess]);

  // If connected, show success state
  if (connected) {
    return (
      <div style={{ 
        padding: '12px', 
        background: '#F0FDF4', 
        borderRadius: '8px',
        border: '1px solid #BBF7D0',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: '#22C55E',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#166534' }}>
            Bank Connected
          </p>
          <p style={{ margin: 0, fontSize: '12px', color: '#15803D' }}>
            Your subscriptions are being tracked
          </p>
        </div>
        <button
          onClick={openPlaidLink}
          style={{
            padding: '6px 10px',
            fontSize: '11px',
            background: 'transparent',
            border: '1px solid #22C55E',
            borderRadius: '4px',
            color: '#166534',
            cursor: 'pointer',
            fontWeight: '500'
          }}
        >
          + Add Another
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={openPlaidLink}
      disabled={loading}
      style={{
        width: '100%',
        padding: '12px 16px',
        borderRadius: '8px',
        border: 'none',
        background: loading 
          ? '#9CA3AF' 
          : 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
        color: 'white',
        fontSize: '14px',
        fontWeight: '600',
        cursor: loading ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        transition: 'all 0.2s',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}
    >
      {loading ? (
        <>
          <span style={{ 
            width: '16px', 
            height: '16px', 
            border: '2px solid white',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          Waiting for connection...
        </>
      ) : (
        <>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          Connect Bank Account
        </>
      )}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  );
}

// Component to display connected accounts
interface ConnectedAccountsProps {
  userId: string;
  onDisconnect?: () => void;
}

export function ConnectedAccounts({ userId, onDisconnect }: ConnectedAccountsProps) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/plaid/items/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setAccounts(data);
      }
    } catch (err) {
      console.error('Failed to fetch connected accounts:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleDisconnect = async (itemId: string) => {
    try {
      await fetch(`${API_BASE}/api/plaid/items/${itemId}`, { method: 'DELETE' });
      await fetchAccounts();
      onDisconnect?.();
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  };

  if (loading) {
    return null;
  }

  if (accounts.length === 0) {
    return null;
  }

  return (
    <div style={{ marginBottom: '12px' }}>
      <p style={{ 
        fontSize: '12px', 
        fontWeight: '600', 
        color: '#6B7280', 
        marginBottom: '8px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        Connected Banks
      </p>
      {accounts.map((account) => (
        <div
          key={account.item_id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            background: '#F0FDF4',
            borderRadius: '8px',
            border: '1px solid #BBF7D0',
            marginBottom: '6px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              background: '#22C55E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                {account.institution_name || 'Bank Account'}
              </p>
              <p style={{ margin: 0, fontSize: '11px', color: '#6B7280' }}>
                Connected
              </p>
            </div>
          </div>
          <button
            onClick={() => handleDisconnect(account.item_id)}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              background: 'transparent',
              border: '1px solid #E5E7EB',
              borderRadius: '4px',
              color: '#6B7280',
              cursor: 'pointer'
            }}
          >
            Disconnect
          </button>
        </div>
      ))}
    </div>
  );
}

export default PlaidLinkButton;
