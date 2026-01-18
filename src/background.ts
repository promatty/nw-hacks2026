/**
 * Background service worker for tracking subscription usage
 * Monitors tab activity and updates visit counts and time spent
 */

const API_BASE = "http://localhost:3000/api";

interface Subscription {
  id: string;
  name: string;
  url: string | null;
  visit_count: number;
  last_visit: string;
  total_time_seconds: number;
  user_id: string;
}

interface ActiveSession {
  subscriptionId: string;
  tabId: number;
  startTime: number;
  lastUrl: string;
}

// In-memory state
let subscriptions: Subscription[] = [];
let activeSession: ActiveSession | null = null;
let userId: string | null = null;

// Track when we last counted a visit for each subscription (to avoid duplicate counts)
// Key: subscriptionId, Value: timestamp of last visit count
const lastVisitCounted: Map<string, number> = new Map();

// Minimum time between counting visits for the same subscription (5 minutes)
const MIN_VISIT_INTERVAL_MS = 5 * 60 * 1000;

// Get or create user ID
async function getUserId(): Promise<string> {
  if (userId) return userId;

  return new Promise((resolve) => {
    chrome.storage.local.get(["userId"], (result) => {
      if (result.userId) {
        userId = result.userId;
        resolve(result.userId);
      } else {
        const newId = crypto.randomUUID();
        userId = newId;
        chrome.storage.local.set({ userId: newId }, () => {
          resolve(newId);
        });
      }
    });
  });
}

// Fetch subscriptions from API
async function fetchSubscriptions(): Promise<void> {
  try {
    const uid = await getUserId();
    const response = await fetch(`${API_BASE}/subscriptions/${uid}`);
    if (response.ok) {
      subscriptions = await response.json();
      console.log("[Background] Loaded", subscriptions.length, "subscriptions");
    }
  } catch (error) {
    console.error("[Background] Failed to fetch subscriptions:", error);
  }
}

// Extract domain from URL
function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.toLowerCase();
  } catch {
    return null;
  }
}

// Check if a URL matches a subscription
function findMatchingSubscription(url: string): Subscription | null {
  const domain = extractDomain(url);
  if (!domain) return null;

  for (const sub of subscriptions) {
    if (!sub.url) continue;

    const subDomain = extractDomain(sub.url);
    if (!subDomain) continue;

    // Match if domains are the same or if the current domain is a subdomain
    if (domain === subDomain || domain.endsWith("." + subDomain)) {
      return sub;
    }
  }
  return null;
}

// Update subscription stats via API
async function updateSubscriptionStats(
  subscriptionId: string,
  addSeconds: number,
  incrementVisit: boolean
): Promise<void> {
  try {
    // First get current subscription data
    const sub = subscriptions.find((s) => s.id === subscriptionId);
    if (!sub) return;

    const updatedData: Partial<Subscription> = {
      total_time_seconds: sub.total_time_seconds + addSeconds,
      last_visit: new Date().toISOString()
    };

    if (incrementVisit) {
      updatedData.visit_count = sub.visit_count + 1;
    }

    const response = await fetch(`${API_BASE}/subscriptions/${subscriptionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedData)
    });

    if (response.ok) {
      // Update local cache
      const index = subscriptions.findIndex((s) => s.id === subscriptionId);
      if (index !== -1) {
        subscriptions[index] = {
          ...subscriptions[index],
          ...updatedData
        } as Subscription;
      }
      console.log(
        "[Background] Updated stats for subscription:",
        subscriptionId,
        incrementVisit ? "(+1 visit)" : "",
        addSeconds > 0 ? `(+${addSeconds}s)` : ""
      );
    }
  } catch (error) {
    console.error("[Background] Failed to update subscription stats:", error);
  }
}

// End the current session and save time
async function endSession(): Promise<void> {
  if (!activeSession) return;

  const elapsedSeconds = Math.floor((Date.now() - activeSession.startTime) / 1000);

  if (elapsedSeconds > 0) {
    await updateSubscriptionStats(activeSession.subscriptionId, elapsedSeconds, false);
  }

  console.log("[Background] Ended session for subscription:", activeSession.subscriptionId);
  activeSession = null;
}

// Check if we should count a new visit for this subscription
function shouldCountVisit(subscriptionId: string): boolean {
  const lastVisit = lastVisitCounted.get(subscriptionId);
  if (!lastVisit) return true;

  const timeSinceLastVisit = Date.now() - lastVisit;
  return timeSinceLastVisit >= MIN_VISIT_INTERVAL_MS;
}

// Start a new session for a subscription
async function startSession(subscription: Subscription, tabId: number, url: string): Promise<void> {
  // End any existing session first
  await endSession();

  activeSession = {
    subscriptionId: subscription.id,
    tabId,
    startTime: Date.now(),
    lastUrl: url
  };

  // Only increment visit count if enough time has passed since last visit
  const shouldIncrement = shouldCountVisit(subscription.id);
  if (shouldIncrement) {
    await updateSubscriptionStats(subscription.id, 0, true);
    lastVisitCounted.set(subscription.id, Date.now());
    console.log("[Background] Started session for:", subscription.name, "(counted as new visit)");
  } else {
    console.log("[Background] Resumed session for:", subscription.name, "(not counting as new visit)");
  }
}

// Process a tab URL change
async function processTabUrl(tabId: number, url: string): Promise<void> {
  // Skip chrome:// and other internal URLs
  if (!url || !url.startsWith("http")) {
    if (activeSession && activeSession.tabId === tabId) {
      await endSession();
    }
    return;
  }

  const matchingSub = findMatchingSubscription(url);

  if (matchingSub) {
    // Check if we're already tracking this subscription on this tab
    if (activeSession && activeSession.subscriptionId === matchingSub.id && activeSession.tabId === tabId) {
      // Same subscription, same tab - just update the URL
      activeSession.lastUrl = url;
      return;
    }

    // New subscription or different tab - start new session
    await startSession(matchingSub, tabId, url);
  } else {
    // No matching subscription
    if (activeSession && activeSession.tabId === tabId) {
      // Was tracking this tab, but now left the subscription domain
      await endSession();
    }
  }
}

// Periodic time save (every 30 seconds) to prevent data loss
setInterval(async () => {
  if (activeSession) {
    const elapsedSeconds = Math.floor((Date.now() - activeSession.startTime) / 1000);
    if (elapsedSeconds >= 30) {
      await updateSubscriptionStats(activeSession.subscriptionId, elapsedSeconds, false);
      // Reset the timer
      activeSession.startTime = Date.now();
    }
  }
}, 30000);

// Tab event listeners
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      await processTabUrl(activeInfo.tabId, tab.url);
    }
  } catch (error) {
    console.error("[Background] Error on tab activated:", error);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only process when URL changes and is complete
  if (changeInfo.status === "complete" && tab.url) {
    await processTabUrl(tabId, tab.url);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (activeSession && activeSession.tabId === tabId) {
    await endSession();
  }
});

// Handle window focus changes (user switches to another app)
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus - pause tracking
    await endSession();
  } else {
    // Browser regained focus - check active tab
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.url) {
        await processTabUrl(activeTab.id!, activeTab.url);
      }
    } catch (error) {
      console.error("[Background] Error on window focus change:", error);
    }
  }
});

// Listen for subscription changes (when user adds/edits/deletes)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SUBSCRIPTIONS_UPDATED") {
    fetchSubscriptions();
    sendResponse({ success: true });
  }
  return true;
});

// Initialize on startup
fetchSubscriptions();

// Also refresh subscriptions periodically (every 5 minutes)
setInterval(fetchSubscriptions, 5 * 60 * 1000);

console.log("[Background] Tab tracking service initialized");
