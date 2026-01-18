import type { PlasmoCSConfig } from "plasmo"
import React, { useEffect, useState } from "react"
import { detectCheckoutPage, CATEGORIES, type CheckoutPattern, type CategoryKey } from "~data/checkout-patterns"
import Burny from "~components/Burny"

// Plasmo content script configuration
export const config: PlasmoCSConfig = {
  matches: [
    "https://*.netflix.com/*",
    "https://*.spotify.com/*",
    "https://*.disneyplus.com/*",
    "https://*.disney.com/*",
    "https://*.max.com/*",
    "https://*.hbomax.com/*",
    "https://*.youtube.com/*",
    "https://*.amazon.com/*",
    "https://*.amazon.ca/*",
    "https://*.amazon.co.uk/*",
    "https://*.apple.com/*",
    "https://*.hulu.com/*",
    "https://*.xbox.com/*",
    "https://*.microsoft.com/*",
    "https://*.openai.com/*",
    "https://*.chatgpt.com/*",
    "https://*.icloud.com/*",
    "https://*.planetfitness.com/*"
  ],
  all_frames: false
}

const API_BASE = "http://localhost:3000/api"

interface CategorySpending {
  category: string
  categoryDisplay: string
  monthlyTotal: number
  subscriptions: Array<{
    name: string
    amount: number
    lastDate: string
  }>
  subscriptionCount: number
}

// Get or create user ID
async function getUserId(): Promise<string> {
  try {
    if (chrome?.storage?.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get(["userId"], (result) => {
          if (result.userId) {
            resolve(result.userId)
          } else {
            const newId = crypto.randomUUID()
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

  const storedId = localStorage.getItem("userId")
  if (storedId) return storedId
  const newId = crypto.randomUUID()
  localStorage.setItem("userId", newId)
  return newId
}

// Fetch category spending from backend (uses mock data)
async function fetchCategorySpending(userId: string, category: string): Promise<CategorySpending | null> {
  try {
    const response = await fetch(`${API_BASE}/spending/category/${userId}/${category}`)
    if (!response.ok) {
      console.error("Failed to fetch category spending:", response.status)
      return null
    }
    return await response.json()
  } catch (error) {
    console.error("Error fetching category spending:", error)
    return null
  }
}

// Checkout Warning Overlay Component
function CheckoutWarningOverlay({ 
  pattern, 
  spending,
  onDismiss 
}: { 
  pattern: CheckoutPattern
  spending: CategorySpending
  onDismiss: () => void 
}) {
  const categoryInfo = CATEGORIES[pattern.category as CategoryKey] || CATEGORIES.ENTERTAINMENT

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2147483647,
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}
      onClick={onDismiss}
    >
      <div
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "16px",
          padding: "24px",
          maxWidth: "420px",
          width: "90%",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "3px solid #F97316",
          animation: "slideIn 0.3s ease-out"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with warning icon */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              backgroundColor: "#FEF3C7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              fontWeight: "700",
              color: "#D97706"
            }}
          >
            !
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#111827" }}>
              Hold up!
            </h2>
            <p style={{ margin: 0, fontSize: "14px", color: "#6B7280" }}>
              Before you subscribe to {pattern.service}...
            </p>
          </div>
        </div>

        {/* Burny spending message */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
          <Burny
            expression="angry"
            message={`You've spent $${spending.monthlyTotal.toFixed(2)} on ${categoryInfo.name.toLowerCase()} this month! You already have ${spending.subscriptionCount} subscription${spending.subscriptionCount !== 1 ? 's' : ''}.`}
            size={150}
          />
        </div>

        {/* Existing subscriptions list */}
        {spending.subscriptions.length > 0 && (
          <div style={{ marginBottom: "16px" }}>
            <p style={{ fontSize: "12px", fontWeight: "500", color: "#9CA3AF", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Your current {pattern.categoryDisplay.toLowerCase()} subscriptions:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {spending.subscriptions.slice(0, 4).map((sub, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    backgroundColor: "#F9FAFB",
                    borderRadius: "8px",
                    border: "1px solid #E5E7EB"
                  }}
                >
                  <span style={{ fontSize: "14px", color: "#374151" }}>{sub.name}</span>
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "#111827" }}>
                    ${sub.amount.toFixed(2)}/mo
                  </span>
                </div>
              ))}
              {spending.subscriptions.length > 4 && (
                <p style={{ fontSize: "12px", color: "#6B7280", textAlign: "center", margin: "4px 0 0" }}>
                  +{spending.subscriptions.length - 4} more
                </p>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={onDismiss}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: "8px",
              border: "1px solid #E5E7EB",
              backgroundColor: "transparent",
              color: "#374151",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = "#F3F4F6"
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = "transparent"
            }}
          >
            I'll waste money
          </button>
          <button
            onClick={() => {
              chrome.runtime.sendMessage({ action: "closeTab" })
            }}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "#F97316",
              color: "#FFFFFF",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.opacity = "0.9"
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.opacity = "1"
            }}
          >
            Close this tab
          </button>
        </div>

        {/* Footer text */}
        <p style={{ 
          fontSize: "11px", 
          color: "#6B7280", 
          textAlign: "center", 
          marginTop: "12px",
          marginBottom: 0
        }}>
          RoastMySubs • Helping you spend smarter
        </p>
      </div>

      {/* Keyframe animation styles */}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  )
}

// Main content script component
function CheckoutDetector() {
  const [pattern, setPattern] = useState<CheckoutPattern | null>(null)
  const [spending, setSpending] = useState<CategorySpending | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const checkPage = async () => {
      if (checked) return
      setChecked(true)

      const currentUrl = window.location.href
      const matchedPattern = detectCheckoutPage(currentUrl)

      if (matchedPattern) {
        console.log("[RoastMySubs] Checkout page detected:", matchedPattern.service)
        setPattern(matchedPattern)

        // Check if already dismissed for this session
        const dismissKey = `dismissed_${matchedPattern.service}_${new Date().toDateString()}`
        try {
          const stored = sessionStorage.getItem(dismissKey)
          if (stored) {
            setDismissed(true)
            return
          }
        } catch (e) {
          // sessionStorage not available
        }

        // Fetch spending data
        const userId = await getUserId()
        const spendingData = await fetchCategorySpending(userId, matchedPattern.category)
        
        if (spendingData && spendingData.monthlyTotal > 0) {
          setSpending(spendingData)
        }
      }
    }

    // Check immediately and also on URL changes (for SPAs)
    checkPage()

    // Listen for URL changes (for single-page apps)
    const observer = new MutationObserver(() => {
      const currentUrl = window.location.href
      if (!checked) {
        checkPage()
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [checked])

  const handleDismiss = () => {
    setDismissed(true)
    
    // Store dismissal for this session
    if (pattern) {
      const dismissKey = `dismissed_${pattern.service}_${new Date().toDateString()}`
      try {
        sessionStorage.setItem(dismissKey, "true")
      } catch (e) {
        // sessionStorage not available
      }
    }
  }

  if (!pattern || !spending || dismissed) {
    return null
  }

  return <CheckoutWarningOverlay pattern={pattern} spending={spending} onDismiss={handleDismiss} />
}

// Plasmo content script UI mount
export default CheckoutDetector
