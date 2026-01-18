import React from "react"
import { useEffect, useState } from "react"
import "./style.css"
import { initializeGemini, sendPromptWithStreaming } from "~gemini"
import spotifyData from "./data/spotify-listening-history.json"
import Burny, { type BurnyExpression } from "./components/Burny"
import { PlaidLinkButton, ConnectedAccounts } from "./components/PlaidLinkButton"
import PlaidSubscriptions from "./components/PlaidSubscriptions"

interface Subscription {
  id: string
  name: string
  url: string | null
  visit_count: number
  last_visit: string
  total_time_seconds: number
  user_id: string
  created_at: string
  updated_at: string
}

const API_BASE = "http://localhost:3000/api"

function generateUUID(): string {
  return crypto.randomUUID()
}

async function getUserId(): Promise<string> {
  // Try chrome.storage.local first, fall back to localStorage
  try {
    if (chrome?.storage?.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get(["userId"], (result) => {
          if (result.userId) {
            resolve(result.userId)
          } else {
            const newId = generateUUID()
            chrome.storage.local.set({ userId: newId }, () => {
              resolve(newId)
            })
          }
        })
      })
    }
  } catch (e) {
    // chrome.storage.local not available
  }

  // Fallback to localStorage
  const storedId = localStorage.getItem("userId")
  if (storedId) return storedId
  const newId = generateUUID()
  localStorage.setItem("userId", newId)
  return newId
}

function IndexPopup() {
  // View state
  const [view, setView] = useState<"home" | "manager">("home")

  // Gemini state
  const [geminiResponse, setGeminiResponse] = useState("")
  const [geminiLoading, setGeminiLoading] = useState(false)
  const [burnyExpression, setBurnyExpression] = useState<BurnyExpression>("neutral")

  // Subscription manager state
  const [userId, setUserId] = useState<string | null>(null)
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [newUrl, setNewUrl] = useState("")
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Subscription | null>(null)
  const [editName, setEditName] = useState("")
  const [editUrl, setEditUrl] = useState("")
  
  // Plaid state
  const [activeTab, setActiveTab] = useState<"plaid" | "manual">("plaid")
  const [plaidRefreshKey, setPlaidRefreshKey] = useState(0)

  useEffect(() => {
    getUserId().then((id) => {
      setUserId(id)
    })
    // Initialize Gemini
    try {
      initializeGemini()
    } catch (error) {
      console.error("Failed to initialize Gemini:", error)
    }
  }, [])

  const fetchSubscriptions = async (uid: string, silent = false) => {
    try {
      if (!silent) {
        setError(null)
        setLoading(true)
      }
      const response = await fetch(`${API_BASE}/subscriptions/${uid}`)
      if (!response.ok) {
        throw new Error("Failed to fetch subscriptions")
      }
      const data = await response.json()
      // Only update state if data actually changed
      setSubscriptions((prev) => {
        const prevJson = JSON.stringify(prev)
        const newJson = JSON.stringify(data)
        if (prevJson === newJson) return prev
        return data
      })
    } catch (err) {
      if (!silent) {
        if (err instanceof TypeError && err.message.includes("fetch")) {
          setError("Cannot connect to server. Is the backend running?")
        } else {
          setError(err instanceof Error ? err.message : "An error occurred")
        }
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    if (userId) {
      fetchSubscriptions(userId)
    }
  }, [userId])

  // Auto-refresh subscriptions every 3 seconds when in manager view
  useEffect(() => {
    if (!userId || view !== "manager") return

    const interval = setInterval(() => {
      fetchSubscriptions(userId, true) // Silent refresh - no loading state
    }, 3000)

    return () => clearInterval(interval)
  }, [userId, view])

  // Notify background script when subscriptions change
  const notifySubscriptionsUpdated = () => {
    try {
      chrome.runtime?.sendMessage({ type: "SUBSCRIPTIONS_UPDATED" })
    } catch (e) {
      // Background script may not be available
    }
  }

  const handleAdd = async () => {
    if (!newName.trim() || !userId) return

    setAdding(true)
    try {
      const response = await fetch(`${API_BASE}/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          name: newName.trim(),
          url: newUrl.trim() || null
        })
      })
      if (!response.ok) {
        throw new Error("Failed to add subscription")
      }
      console.log("[API] ADD successful")
      setNewName("")
      setNewUrl("")
      await fetchSubscriptions(userId)
      notifySubscriptionsUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add")
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!userId) return
    try {
      const response = await fetch(`${API_BASE}/subscriptions/${id}`, {
        method: "DELETE"
      })
      if (!response.ok) {
        throw new Error("Failed to delete subscription")
      }
      console.log("[API] DELETE successful")
      await fetchSubscriptions(userId)
      notifySubscriptionsUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  const openEdit = (sub: Subscription) => {
    setEditing(sub)
    setEditName(sub.name)
    setEditUrl(sub.url || "")
  }

  const handleEdit = async () => {
    if (!editing || !editName.trim() || !userId) return
    try {
      const response = await fetch(`${API_BASE}/subscriptions/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          url: editUrl.trim() || null
        })
      })
      if (!response.ok) {
        throw new Error("Failed to update subscription")
      }
      console.log("[API] EDIT successful")
      setEditing(null)
      await fetchSubscriptions(userId)
      notifySubscriptionsUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAdd()
    }
  }

  const testGemini = async () => {
    setGeminiLoading(true)
    setGeminiResponse("")
    setBurnyExpression("evil")
    try {
      // Check if user has been active recently
      const now = new Date()
      const mostRecentPlay = new Date(spotifyData.items[0]?.played_at || 0)
      const daysSinceLastPlay = Math.floor((now.getTime() - mostRecentPlay.getTime()) / (1000 * 60 * 60 * 24))
      const hasRecentActivity = daysSinceLastPlay <= 7

      // Set expression based on activity
      setBurnyExpression(hasRecentActivity ? "happy" : "savage")

      // Create personalized prompt
      const prompt = `You are a subscription manager assistant with a sassy personality. Your job is to track subscriptions and roast users for ones they don't use.

Examples:
- "$45 down the drain in 3 months. You're literally paying to NOT watch TV."
- "Gym membership unused for 6 months? That's $180 for a very expensive guilt trip."
- "Spotify Premium while you listen to YouTube? Congratulations on your donation to Sweden."

For active subscriptions: brief positive note.

Keep it snappy. No paragraphs.

Here's the data:
service: Spotify
days since last used: ${daysSinceLastPlay}`

      await sendPromptWithStreaming(
        prompt,
        (chunk) => {
          setGeminiResponse((prev) => prev + chunk)
        }
      )
    } catch (error) {
      setGeminiResponse(`Error: ${error instanceof Error ? error.message : "Failed to get response"}`)
    } finally {
      setGeminiLoading(false)
    }
  }

  const handlePlaidSuccess = () => {
    setPlaidRefreshKey(prev => prev + 1)
    setBurnyExpression("happy")
  }

  // Render home view
  if (view === "home") {
    return (
      <div
        style={{
          width: 380,
          maxHeight: 600,
          overflowY: "auto",
          padding: 16,
          fontFamily: "system-ui, -apple-system, sans-serif",
          border: "3px solid #F97316",
          background: "#FAFAFA"
        }}>
        {/* Header */}
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between",
          marginBottom: 16
        }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>
            🔥 RoastMySubs
          </h2>
          <button
            onClick={testGemini}
            disabled={geminiLoading}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "none",
              background: geminiLoading ? "#9CA3AF" : "#10A37F",
              color: "white",
              fontSize: 12,
              fontWeight: 500,
              cursor: geminiLoading ? "not-allowed" : "pointer",
            }}>
            {geminiLoading ? "..." : "🤖 Roast Me"}
          </button>
        </div>

        {/* Burny Mascot */}
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
          <Burny
            expression={burnyExpression}
            message={geminiResponse || "Connect your bank to track subscriptions!"}
            size={120}
          />
        </div>

        {/* Connected Accounts & Plaid Link */}
        {userId && (
          <div style={{ marginBottom: 16 }}>
            <ConnectedAccounts 
              userId={userId} 
              onDisconnect={() => setPlaidRefreshKey(prev => prev + 1)}
            />
            <PlaidLinkButton 
              userId={userId} 
              onSuccess={handlePlaidSuccess}
            />
          </div>
        )}

        {/* Tabs */}
        <div style={{ 
          display: "flex", 
          gap: 4, 
          marginBottom: 12,
          background: "#E5E7EB",
          padding: 4,
          borderRadius: 8
        }}>
          <button
            onClick={() => setActiveTab("plaid")}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: 6,
              border: "none",
              background: activeTab === "plaid" ? "#FFFFFF" : "transparent",
              color: activeTab === "plaid" ? "#111827" : "#6B7280",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              boxShadow: activeTab === "plaid" ? "0 1px 2px rgba(0,0,0,0.1)" : "none"
            }}>
            💳 Auto-Detected
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: 6,
              border: "none",
              background: activeTab === "manual" ? "#FFFFFF" : "transparent",
              color: activeTab === "manual" ? "#111827" : "#6B7280",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              boxShadow: activeTab === "manual" ? "0 1px 2px rgba(0,0,0,0.1)" : "none"
            }}>
            ✏️ Manual
          </button>
        </div>

        {/* Plaid Subscriptions Tab */}
        {activeTab === "plaid" && userId && (
          <div key={plaidRefreshKey}>
            <PlaidSubscriptions userId={userId} useMockData={false} />
          </div>
        )}

        {/* Manual Subscriptions Tab */}
        {activeTab === "manual" && (
          <>
            {/* Manage Subscriptions Button */}
            <button
              onClick={() => setView("manager")}
              style={{
                padding: "12px 16px",
                borderRadius: 8,
                border: "1px solid #4F46E5",
                background: "white",
                color: "#4F46E5",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
                width: "100%",
                marginBottom: 12
              }}>
              📝 Manage Manual Subscriptions
            </button>
            
            {/* Quick add form */}
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                placeholder="Add subscription..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={adding}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #ddd",
                  fontSize: 13,
                  outline: "none"
                }}
              />
              <button
                onClick={handleAdd}
                disabled={adding || !newName.trim()}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: "#4F46E5",
                  color: "white",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: adding || !newName.trim() ? "not-allowed" : "pointer",
                  opacity: adding || !newName.trim() ? 0.6 : 1
                }}>
                +
              </button>
            </div>
          </>
        )}

        {/* Manage Subscriptions Button */}
        <button
          onClick={() => setView("manager")}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            background: "#F97316",
            color: "white",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
            width: "100%"
          }}>
          Manage Subscriptions
        </button>
      </div>
    )
  }

  // Render subscription manager view
  return (
    <div
      style={{
        width: 380,
        maxHeight: 600,
        overflowY: "auto",
        padding: 16,
        fontFamily: "system-ui, -apple-system, sans-serif",
        border: "3px solid #F97316",
        background: "#FAFAFA"
      }}>
      {/* Header with back button */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16, gap: 8 }}>
        <button
          onClick={() => setView("home")}
          style={{
            padding: "4px 8px",
            borderRadius: 4,
            border: "1px solid #ddd",
            background: "white",
            cursor: "pointer",
            fontSize: 14
          }}>
          ← Back
        </button>
        <h2 style={{ margin: 0, fontSize: 18, flex: 1 }}>
          Manage Subscriptions
        </h2>
      </div>

      {/* Error message */}
      {error && (
        <div
          style={{
            padding: "8px 12px",
            marginBottom: 16,
            background: "#FEE2E2",
            color: "#DC2626",
            borderRadius: 6,
            fontSize: 12
          }}>
          {error}
        </div>
      )}

      {/* Subscriptions list */}
      <div>
        <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 500 }}>
          Your Subscriptions
        </h3>
        {loading ? (
          <div style={{ textAlign: "center", color: "#666", padding: 20, fontSize: 13 }}>
            Loading...
          </div>
        ) : subscriptions.length === 0 ? (
          <div style={{ textAlign: "center", color: "#666", padding: 20, fontSize: 13 }}>
            No subscriptions yet. Add one below!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {subscriptions.map((sub) => {
              // Format last visit
              const formatLastVisit = (dateString: string) => {
                if (!dateString) return "Never"
                const date = new Date(dateString)
                const now = new Date()
                const diffMs = now.getTime() - date.getTime()
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

                if (diffDays === 0) return "Today"
                if (diffDays === 1) return "Yesterday"
                if (diffDays < 7) return `${diffDays} days ago`
                if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
                if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
                return `${Math.floor(diffDays / 365)} years ago`
              }

              // Format total time
              const formatTotalTime = (seconds: number) => {
                if (seconds < 60) return `${seconds}s`
                const minutes = Math.floor(seconds / 60)
                if (minutes < 60) return `${minutes}m`
                const hours = Math.floor(minutes / 60)
                if (hours < 24) return `${hours}h`
                const days = Math.floor(hours / 24)
                return `${days}d`
              }

              return (
                <div
                  key={sub.id}
                  style={{
                    padding: "10px 12px",
                    background: "#F9FAFB",
                    borderRadius: 6,
                    border: "1px solid #E5E7EB"
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                        {sub.name}
                      </div>
                      {sub.url && (
                        <a
                          href={sub.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: 11,
                            color: "#6B7280",
                            textDecoration: "none",
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            marginBottom: 6
                          }}>
                          {sub.url}
                        </a>
                      )}
                      {/* Usage Statistics */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 11, color: "#6B7280" }}>
                        <span>{sub.visit_count} visits</span>
                        <span>•</span>
                        <span>Last: {formatLastVisit(sub.last_visit)}</span>
                        <span>•</span>
                        <span>Time: {formatTotalTime(sub.total_time_seconds)}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: 8 }}>
                      <button
                        onClick={() => openEdit(sub)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 4,
                          border: "1px solid #E5E7EB",
                          background: "white",
                          cursor: "pointer",
                          fontSize: 11,
                          fontWeight: 500,
                          color: "#374151"
                        }}>
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(sub.id)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 4,
                          border: "none",
                          background: "#EF4444",
                          color: "white",
                          fontSize: 11,
                          fontWeight: 500,
                          cursor: "pointer"
                        }}>
                        Del
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add subscription form */}
      <div style={{ marginTop: 16, padding: 12, background: "#F9FAFB", borderRadius: 6 }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 500 }}>
          Add New Subscription
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            type="text"
            placeholder="Name (e.g., Netflix)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={adding}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #ddd",
              fontSize: 13,
              outline: "none"
            }}
          />
          <input
            type="url"
            placeholder="URL (optional)"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={adding}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #ddd",
              fontSize: 13,
              outline: "none"
            }}
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newName.trim()}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "none",
              background: "#F97316",
              color: "white",
              fontSize: 13,
              fontWeight: 500,
              cursor: adding || !newName.trim() ? "not-allowed" : "pointer",
              opacity: adding || !newName.trim() ? 0.6 : 1
            }}>
            {adding ? "Adding..." : "Add"}
          </button>
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}>
          <div
            style={{
              background: "white",
              padding: 20,
              borderRadius: 8,
              width: 280,
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)"
            }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: 16, fontWeight: 600 }}>
              Edit Subscription
            </h3>
            <input
              type="text"
              placeholder="Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid #ddd",
                fontSize: 13,
                marginBottom: 12,
                boxSizing: "border-box",
                outline: "none"
              }}
            />
            <input
              type="url"
              placeholder="URL"
              value={editUrl}
              onChange={(e) => setEditUrl(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid #ddd",
                fontSize: 13,
                marginBottom: 16,
                boxSizing: "border-box",
                outline: "none"
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setEditing(null)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px solid #ddd",
                  background: "white",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer"
                }}>
                Cancel
              </button>
              <button
                onClick={handleEdit}
                disabled={!editName.trim()}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: "#4F46E5",
                  color: "white",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: !editName.trim() ? "not-allowed" : "pointer",
                  opacity: !editName.trim() ? 0.6 : 1
                }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default IndexPopup
