import React from "react"
import { useEffect, useState } from "react"

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

function SubscriptionManager() {
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

  useEffect(() => {
    getUserId().then((id) => {
      setUserId(id)
    })
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

  return (
    <div
      style={{
        maxWidth: 800,
        margin: "0 auto",
        padding: 32,
        fontFamily: "system-ui, -apple-system, sans-serif",
        minHeight: "100vh",
        background: "#F9FAFB"
      }}>
      <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
        <h1 style={{ margin: "0 0 24px 0", fontSize: 28, fontWeight: 600 }}>
          Subscription Manager
        </h1>

        {/* Add subscription form */}
        <div style={{ marginBottom: 32, padding: 20, background: "#F9FAFB", borderRadius: 8 }}>
          <h2 style={{ margin: "0 0 16px 0", fontSize: 18, fontWeight: 500 }}>
            Add New Subscription
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              type="text"
              placeholder="Subscription name (e.g., Netflix, Spotify)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={adding}
              style={{
                padding: "10px 14px",
                borderRadius: 6,
                border: "1px solid #ddd",
                fontSize: 14,
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
                padding: "10px 14px",
                borderRadius: 6,
                border: "1px solid #ddd",
                fontSize: 14,
                outline: "none"
              }}
            />
            <button
              onClick={handleAdd}
              disabled={adding || !newName.trim()}
              style={{
                padding: "10px 18px",
                borderRadius: 6,
                border: "none",
                background: "#4F46E5",
                color: "white",
                fontSize: 14,
                fontWeight: 500,
                cursor: adding || !newName.trim() ? "not-allowed" : "pointer",
                opacity: adding || !newName.trim() ? 0.6 : 1
              }}>
              {adding ? "Adding..." : "Add Subscription"}
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div
            style={{
              padding: "12px 16px",
              marginBottom: 24,
              background: "#FEE2E2",
              color: "#DC2626",
              borderRadius: 6,
              fontSize: 14
            }}>
            {error}
          </div>
        )}

        {/* Subscriptions list */}
        <div>
          <h2 style={{ margin: "0 0 16px 0", fontSize: 18, fontWeight: 500 }}>
            Your Subscriptions
          </h2>
          {loading ? (
            <div style={{ textAlign: "center", color: "#666", padding: 40 }}>
              Loading...
            </div>
          ) : subscriptions.length === 0 ? (
            <div style={{ textAlign: "center", color: "#666", padding: 40 }}>
              No subscriptions yet. Add one above!
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {subscriptions.map((sub) => (
                <div
                  key={sub.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 20px",
                    background: "#F9FAFB",
                    borderRadius: 8,
                    border: "1px solid #E5E7EB"
                  }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>
                      {sub.name}
                    </div>
                    {sub.url && (
                      <a
                        href={sub.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 13,
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
                  <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: 16 }}>
                    <button
                      onClick={() => openEdit(sub)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 6,
                        border: "1px solid #E5E7EB",
                        background: "white",
                        cursor: "pointer",
                        fontSize: 14,
                        fontWeight: 500,
                        color: "#374151"
                      }}>
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(sub.id)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 6,
                        border: "none",
                        background: "#EF4444",
                        color: "white",
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: "pointer"
                      }}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
              padding: 24,
              borderRadius: 12,
              width: 400,
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)"
            }}>
            <h3 style={{ margin: "0 0 20px 0", fontSize: 18, fontWeight: 600 }}>
              Edit Subscription
            </h3>
            <input
              type="text"
              placeholder="Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 6,
                border: "1px solid #ddd",
                fontSize: 14,
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
                padding: "10px 14px",
                borderRadius: 6,
                border: "1px solid #ddd",
                fontSize: 14,
                marginBottom: 20,
                boxSizing: "border-box",
                outline: "none"
              }}
            />
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setEditing(null)}
                style={{
                  padding: "10px 20px",
                  borderRadius: 6,
                  border: "1px solid #ddd",
                  background: "white",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer"
                }}>
                Cancel
              </button>
              <button
                onClick={handleEdit}
                disabled={!editName.trim()}
                style={{
                  padding: "10px 20px",
                  borderRadius: 6,
                  border: "none",
                  background: "#4F46E5",
                  color: "white",
                  fontSize: 14,
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

export default SubscriptionManager
