import React from "react"
import { useEffect, useState } from "react"
import { initializeGemini, sendPromptWithStreaming } from "~gemini"
import spotifyData from "./data/spotify-listening-history.json"

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
  const [geminiResponse, setGeminiResponse] = useState("")
  const [geminiLoading, setGeminiLoading] = useState(false)

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

  const fetchSubscriptions = async (uid: string) => {
    try {
      setError(null)
      setLoading(true)
      const response = await fetch(`${API_BASE}/subscriptions/${uid}`)
      if (!response.ok) {
        throw new Error("Failed to fetch subscriptions")
      }
      const data = await response.json()
      console.log("[API] GET successful:", data.length, "subscriptions")
      setSubscriptions(data)
    } catch (err) {
      if (err instanceof TypeError && err.message.includes("fetch")) {
        setError("Cannot connect to server. Is the backend running?")
      } else {
        setError(err instanceof Error ? err.message : "An error occurred")
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (userId) {
      fetchSubscriptions(userId)
    }
  }, [userId])

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
    try {
      // Check if user has been active recently
      const now = new Date()
      const mostRecentPlay = new Date(spotifyData.items[0]?.played_at || 0)
      const daysSinceLastPlay = Math.floor((now.getTime() - mostRecentPlay.getTime()) / (1000 * 60 * 60 * 24))
      const hasRecentActivity = daysSinceLastPlay <= 7

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

  return (
    <div
      style={{
        width: 350,
        minHeight: 400,
        padding: 16,
        fontFamily: "system-ui, -apple-system, sans-serif"
      }}>
      <h2 style={{ margin: "0 0 16px 0", fontSize: 18 }}>
        RoastMySubs
      </h2>

      {/* Gemini Test Button */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={testGemini}
          disabled={geminiLoading}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            background: "#10A37F",
            color: "white",
            fontSize: 14,
            cursor: geminiLoading ? "not-allowed" : "pointer",
            opacity: geminiLoading ? 0.6 : 1,
            width: "100%"
          }}>
          {geminiLoading ? "Testing Gemini..." : "Test Gemini"}
        </button>
        {geminiResponse && (
          <div
            style={{
              marginTop: 8,
              padding: "8px 12px",
              background: "#F0F9FF",
              border: "1px solid #BAE6FD",
              borderRadius: 6,
              fontSize: 13,
              color: "#0C4A6E"
            }}>
            {geminiResponse}
          </div>
        )}
      </div>

      {/* Add subscription form */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Subscription name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={adding}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #ddd",
            fontSize: 14
          }}
        />
        <input
          type="url"
          placeholder="URL"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={adding}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #ddd",
            fontSize: 14
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
            fontSize: 14,
            cursor: adding || !newName.trim() ? "not-allowed" : "pointer",
            opacity: adding || !newName.trim() ? 0.6 : 1
          }}>
          {adding ? "Adding..." : "Add Subscription"}
        </button>
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
            fontSize: 13
          }}>
          {error}
        </div>
      )}

      {/* Subscriptions list */}
      {loading ? (
        <div style={{ textAlign: "center", color: "#666", padding: 20 }}>
          Loading...
        </div>
      ) : subscriptions.length === 0 ? (
        <div style={{ textAlign: "center", color: "#666", padding: 20 }}>
          No subscriptions yet. Add one above!
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {subscriptions.map((sub) => (
            <div
              key={sub.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                background: "#F9FAFB",
                borderRadius: 6,
                border: "1px solid #E5E7EB"
              }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{sub.name}</div>
                {sub.url && (
                  <a
                    href={sub.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 12,
                      color: "#6B7280",
                      textDecoration: "none",
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}>
                    {sub.url}
                  </a>
                )}
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: 8 }}>
                <button
                  onClick={() => openEdit(sub)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 4,
                    border: "none",
                    background: "#E5E7EB",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    <path d="m15 5 4 4" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(sub.id)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 4,
                    border: "none",
                    background: "#EF4444",
                    color: "white",
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                  X
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
              width: 300,
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)"
            }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: 16 }}>Edit Subscription</h3>
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
                fontSize: 14,
                marginBottom: 8,
                boxSizing: "border-box"
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
                fontSize: 14,
                marginBottom: 16,
                boxSizing: "border-box"
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
                  fontSize: 14,
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
                  fontSize: 14,
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
