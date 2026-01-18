import React from "react"
import { useEffect, useState } from "react"
import { initializeGemini, sendPromptWithStreaming } from "~gemini"
import Burny, { type BurnyExpression } from "./components/Burny"

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

interface CachedRoasts {
  subscriptionId: string
  subscriptionName: string
  daysSinceLastVisit: number
  roastMessages: string[]
  timestamp: number
}

const API_BASE = "http://localhost:3000/api"
const ROAST_CACHE_KEY = "cachedRoast"

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

// Cache helpers for roasts
async function getCachedRoasts(): Promise<CachedRoasts | null> {
  try {
    if (chrome?.storage?.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get([ROAST_CACHE_KEY], (result) => {
          resolve(result[ROAST_CACHE_KEY] || null)
        })
      })
    }
  } catch (e) {
    // chrome.storage.local not available
  }
  // Fallback to localStorage
  const cached = localStorage.getItem(ROAST_CACHE_KEY)
  return cached ? JSON.parse(cached) : null
}

async function saveCachedRoasts(roasts: CachedRoasts): Promise<void> {
  try {
    if (chrome?.storage?.local) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [ROAST_CACHE_KEY]: roasts }, () => {
          resolve()
        })
      })
    }
  } catch (e) {
    // chrome.storage.local not available
  }
  // Fallback to localStorage
  localStorage.setItem(ROAST_CACHE_KEY, JSON.stringify(roasts))
}

function IndexPopup() {
  // View state
  const [view, setView] = useState<"home" | "manager">("home")

  // Gemini state
  const [geminiResponse, setGeminiResponse] = useState("")
  const [geminiLoading, setGeminiLoading] = useState(false)
  const [burnyExpression, setBurnyExpression] = useState<BurnyExpression>("neutral")
  const [targetedSubscription, setTargetedSubscription] = useState<string | null>(null)

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

  // Debug state
  const [debugExpanded, setDebugExpanded] = useState<string | null>(null)

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

  // Auto-trigger roast when subscriptions are loaded (only once per home view visit)
  const [hasAutoRoasted, setHasAutoRoasted] = useState(false)
  useEffect(() => {
    if (subscriptions.length > 0 && !loading && !hasAutoRoasted && view === "home") {
      setHasAutoRoasted(true)
      testGemini()
    }
  }, [subscriptions, loading, hasAutoRoasted, view])

  // Reset hasAutoRoasted and refresh data when returning to home view
  useEffect(() => {
    if (view === "home" && userId) {
      setHasAutoRoasted(false)
      fetchSubscriptions(userId, true)
    }
  }, [view])

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

  // Debug: update subscription stats
  const handleDebugUpdate = async (id: string, updates: { visit_count?: number; last_visit?: string; total_time_seconds?: number }) => {
    if (!userId) return
    try {
      const response = await fetch(`${API_BASE}/subscriptions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      })
      if (!response.ok) {
        throw new Error("Failed to update subscription")
      }
      await fetchSubscriptions(userId)
      notifySubscriptionsUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update")
    }
  }

  // Find the most wasted subscription (not visited in 5+ days, pick longest absence)
  const findMostWastedSubscription = (): { subscription: Subscription; daysSinceLastVisit: number } | null => {
    const now = new Date()
    const WASTE_THRESHOLD_DAYS = 5

    let worstOffender: { subscription: Subscription; daysSinceLastVisit: number } | null = null

    for (const sub of subscriptions) {
      if (!sub.last_visit) continue

      const lastVisit = new Date(sub.last_visit)
      const daysSince = Math.floor((now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24))

      if (daysSince >= WASTE_THRESHOLD_DAYS) {
        if (!worstOffender || daysSince > worstOffender.daysSinceLastVisit) {
          worstOffender = { subscription: sub, daysSinceLastVisit: daysSince }
        }
      }
    }

    return worstOffender
  }

  const testGemini = async () => {
    setGeminiLoading(true)
    setGeminiResponse("")
    setBurnyExpression("evil")
    try {
      // Find the most wasted subscription
      const wasted = findMostWastedSubscription()

      if (!wasted) {
        // No wasted subscriptions - Burny stays quiet
        setBurnyExpression("happy")
        setTargetedSubscription(null)
        setGeminiResponse("You're using all your subscriptions! Nothing to roast here.")
        setGeminiLoading(false)
        return
      }

      // Check cache before calling Gemini
      const cached = await getCachedRoasts()
      if (
        cached &&
        cached.subscriptionId === wasted.subscription.id &&
        cached.daysSinceLastVisit === wasted.daysSinceLastVisit &&
        cached.roastMessages.length > 0
      ) {
        // Pick a random roast from cache
        const randomIndex = Math.floor(Math.random() * cached.roastMessages.length)
        const randomRoast = cached.roastMessages[randomIndex]
        console.log(`[Popup] Using cached roast ${randomIndex + 1}/${cached.roastMessages.length}`)
        setBurnyExpression("savage")
        setTargetedSubscription(cached.subscriptionName)
        setGeminiResponse(randomRoast)
        setGeminiLoading(false)
        return
      }

      // Set savage expression for roasting
      setBurnyExpression("savage")
      setTargetedSubscription(wasted.subscription.name)

      // Create personalized prompt for 10 roasts
      const prompt = `You write brutal Twitter roasts. No filter. Think stan twitter meets finance bro energy.

Examples of the vibe:
- "bestie you haven't opened Netflix in 3 weeks but you'll complain about being broke. the math isn't mathing"
- "paying for a gym membership you don't use is crazy work. your wallet is getting more of a workout than you"
- "imagine paying $15/month to ignore Spotify while you watch YouTube ads like a peasant. couldn't be me (it's you)"
- "that subscription is literally begging you to cancel it. even IT doesn't want your money at this point"
- "you're basically running a charity for corporations rn. very philanthropic of you bestie"

Roast this person for wasting money on ${wasted.subscription.name}. They haven't touched it in ${wasted.daysSinceLastVisit} days.

Rules:
- Write like you're ratio'ing someone on twitter
- Use lowercase, "bestie", "ngl", "lowkey", "the way", "not you", "imagine", etc
- Be unhinged but funny, not mean-spirited
- 1-2 sentences max, punchy
- Generate exactly 10 different roasts
- Format: Return ONLY a JSON array of 10 strings, nothing else. Example: ["roast1", "roast2", ...]`

      let fullResponse = ""
      await sendPromptWithStreaming(
        prompt,
        (chunk) => {
          fullResponse += chunk
        }
      )

      // Parse the JSON array of roasts
      let roastMessages: string[] = []
      try {
        // Try to extract JSON array from response (in case there's extra text)
        const jsonMatch = fullResponse.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          roastMessages = JSON.parse(jsonMatch[0])
        }
      } catch (e) {
        console.error("[Popup] Failed to parse roasts JSON:", e)
        // Fallback: use the whole response as a single roast
        roastMessages = [fullResponse]
      }

      // Pick a random roast to display
      const randomIndex = Math.floor(Math.random() * roastMessages.length)
      setGeminiResponse(roastMessages[randomIndex] || fullResponse)

      // Save all roasts to cache
      await saveCachedRoasts({
        subscriptionId: wasted.subscription.id,
        subscriptionName: wasted.subscription.name,
        daysSinceLastVisit: wasted.daysSinceLastVisit,
        roastMessages,
        timestamp: Date.now()
      })
      console.log(`[Popup] Saved ${roastMessages.length} roasts to cache`)
    } catch (error) {
      setGeminiResponse(`Error: ${error instanceof Error ? error.message : "Failed to get response"}`)
    } finally {
      setGeminiLoading(false)
    }
  }

  // Render home view
  if (view === "home") {
    return (
      <div
        style={{
          width: 350,
          maxHeight: 600,
          overflowY: "auto",
          padding: 16,
          fontFamily: "system-ui, -apple-system, sans-serif"
        }}>
        <h2 style={{ margin: "0 0 16px 0", fontSize: 18 }}>
          RoastMySubs
        </h2>

        {/* Targeted Subscription Name */}
        {targetedSubscription && (
          <div
            style={{
              marginBottom: 8,
              padding: "6px 12px",
              background: "#FEF3C7",
              border: "1px solid #F59E0B",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              color: "#92400E",
              textAlign: "center"
            }}>
            {targetedSubscription}
          </div>
        )}

        {/* Burny Mascot */}
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
          <Burny
            expression={burnyExpression}
            message={geminiResponse || (geminiLoading ? "Loading..." : "Checking your subscriptions...")}
            size={150}
          />
        </div>

        {/* Manage Subscriptions Button */}
        <button
          onClick={() => setView("manager")}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid #F59E0B",
            background: "#FEF3C7",
            color: "#92400E",
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
        width: 350,
        maxHeight: 600,
        overflowY: "auto",
        padding: 16,
        fontFamily: "system-ui, -apple-system, sans-serif"
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
            No subscriptions yet. Add one above!
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
                  {/* Debug Toggle */}
                  <button
                    onClick={() => setDebugExpanded(debugExpanded === sub.id ? null : sub.id)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 4,
                      border: "1px dashed #9CA3AF",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 10,
                      color: "#9CA3AF",
                      marginTop: 8
                    }}>
                    {debugExpanded === sub.id ? "Hide Debug" : "Debug"}
                  </button>
                  {/* Debug Panel */}
                  {debugExpanded === sub.id && (
                    <div style={{ marginTop: 8, padding: 8, background: "#FEF3C7", borderRadius: 4, fontSize: 11 }}>
                      <div style={{ marginBottom: 6, fontWeight: 500, color: "#92400E" }}>Debug: Edit Stats</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 80, color: "#78350F" }}>Visits:</span>
                          <input
                            type="number"
                            defaultValue={sub.visit_count}
                            onBlur={(e) => handleDebugUpdate(sub.id, { visit_count: parseInt(e.target.value) || 0 })}
                            style={{ flex: 1, padding: "4px 6px", borderRadius: 4, border: "1px solid #D97706", fontSize: 11 }}
                          />
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 80, color: "#78350F" }}>Last Visit:</span>
                          <input
                            type="datetime-local"
                            defaultValue={sub.last_visit ? new Date(sub.last_visit).toISOString().slice(0, 16) : ""}
                            onBlur={(e) => handleDebugUpdate(sub.id, { last_visit: new Date(e.target.value).toISOString() })}
                            style={{ flex: 1, padding: "4px 6px", borderRadius: 4, border: "1px solid #D97706", fontSize: 11 }}
                          />
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 80, color: "#78350F" }}>Time (sec):</span>
                          <input
                            type="number"
                            defaultValue={sub.total_time_seconds}
                            onBlur={(e) => handleDebugUpdate(sub.id, { total_time_seconds: parseInt(e.target.value) || 0 })}
                            style={{ flex: 1, padding: "4px 6px", borderRadius: 4, border: "1px solid #D97706", fontSize: 11 }}
                          />
                        </label>
                      </div>
                    </div>
                  )}
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
              background: "#4F46E5",
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
