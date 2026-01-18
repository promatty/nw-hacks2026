/**
 * Background service worker for tracking subscription usage
 * Monitors ALL open tabs and accumulates time for subscription websites
 */

const API_BASE = "http://localhost:3000/api";

// Hardcoded CAD prices for common services
export const SERVICE_PRICES_CAD: Record<string, number> = {
  'netflix.com': 16.49,
  'spotify.com': 11.99,
  'disneyplus.com': 11.99,
  'youtube.com': 13.99,  // YouTube Premium
  'primevideo.com': 9.99,
  'amazon.com': 9.99,    // Prime Video
  'max.com': 16.99,
  'hulu.com': 9.99,
  'apple.com': 12.99,    // Apple TV+
  'tv.apple.com': 12.99, // Apple TV+
  'crunchyroll.com': 12.99,
}

interface Subscription {
<<<<<<< HEAD
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
=======
  id: string
  name: string
  url: string | null
  visit_count: number
  last_visit: string
  total_time_seconds: number
  wasted_days_this_month: number
  user_id: string
  created_at: string
}

interface TrackedTab {
  subscriptionId: string
  domain: string
  startTime: number
}

// In-memory state
let subscriptions: Subscription[] = []
let userId: string | null = null
>>>>>>> main

// Track ALL open subscription tabs (tabId -> tracking info)
const openSubscriptionTabs: Map<number, TrackedTab> = new Map()

// Track accumulated but unsaved time per subscription (subscriptionId -> seconds)
const pendingTimeUpdates: Map<string, number> = new Map()

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

<<<<<<< HEAD
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

=======
>>>>>>> main
// Check if we should count a new visit for this subscription
function shouldCountVisit(subscriptionId: string): boolean {
  const lastVisit = lastVisitCounted.get(subscriptionId);
  if (!lastVisit) return true;

  const timeSinceLastVisit = Date.now() - lastVisit;
  return timeSinceLastVisit >= MIN_VISIT_INTERVAL_MS;
}

<<<<<<< HEAD
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
=======
// Calculate wasted days between last visit and today
// Billing cycle resets on the day of the month the subscription was created
function calculateWastedDays(subscription: Subscription): { wastedDays: number; shouldReset: boolean } {
  const now = new Date()

  if (!subscription.last_visit) {
    return { wastedDays: 0, shouldReset: false }
  }
>>>>>>> main

  const lastVisitDate = new Date(subscription.last_visit)
  const createdDate = new Date(subscription.created_at)
  const billingDay = createdDate.getDate() // Day of month subscription was created

  // Get current billing cycle start date
  const getCurrentBillingCycleStart = (): Date => {
    const year = now.getFullYear()
    const month = now.getMonth()
    const today = now.getDate()

    if (today >= billingDay) {
      // Current billing cycle started this month
      return new Date(year, month, billingDay)
    } else {
      // Current billing cycle started last month
      return new Date(year, month - 1, billingDay)
    }
  }

  const billingCycleStart = getCurrentBillingCycleStart()

  // Check if last visit was before current billing cycle - reset
  if (lastVisitDate < billingCycleStart) {
    // Calculate days from billing cycle start to today
    const daysSinceCycleStart = Math.floor((now.getTime() - billingCycleStart.getTime()) / (1000 * 60 * 60 * 24))
    return { wastedDays: daysSinceCycleStart, shouldReset: true }
  }

  // Same billing cycle - calculate days between last visit and today
  const lastVisitDay = lastVisitDate.getDate()
  const today = now.getDate()
  const dayGap = today - lastVisitDay - 1 // Days between, not including visit days

  return { wastedDays: Math.max(0, dayGap), shouldReset: false }
}

// Start tracking a tab with a subscription
async function startTrackingTab(subscription: Subscription, tabId: number, domain: string): Promise<void> {
  // If already tracking this tab with same subscription, just update start time
  const existing = openSubscriptionTabs.get(tabId)
  if (existing && existing.subscriptionId === subscription.id) {
    return // Already tracking
  }

  openSubscriptionTabs.set(tabId, {
    subscriptionId: subscription.id,
    domain,
    startTime: Date.now()
  })

  // Only increment visit count if enough time has passed since last visit
  const shouldIncrement = shouldCountVisit(subscription.id);
  if (shouldIncrement) {
<<<<<<< HEAD
    await updateSubscriptionStats(subscription.id, 0, true);
    lastVisitCounted.set(subscription.id, Date.now());
    console.log("[Background] Started session for:", subscription.name, "(counted as new visit)");
  } else {
    console.log("[Background] Resumed session for:", subscription.name, "(not counting as new visit)");
=======
    // Calculate wasted days before updating
    const { wastedDays, shouldReset } = calculateWastedDays(subscription)

    // Update subscription with visit count and wasted days
    await updateSubscriptionWithWastedDays(subscription.id, wastedDays, shouldReset)

    lastVisitCounted.set(subscription.id, Date.now())
    console.log("[Background] Started tracking tab", tabId, "for:", subscription.name,
      "(counted as new visit, wasted days:", wastedDays, shouldReset ? "- month reset" : "", ")")
  } else {
    console.log("[Background] Started tracking tab", tabId, "for:", subscription.name, "(not counting as new visit)")
>>>>>>> main
  }
}

// Update subscription with wasted days calculation
async function updateSubscriptionWithWastedDays(
  subscriptionId: string,
  wastedDays: number,
  shouldReset: boolean
): Promise<void> {
  try {
    const sub = subscriptions.find((s) => s.id === subscriptionId)
    if (!sub) return

    const newWastedDays = shouldReset ? wastedDays : sub.wasted_days_this_month + wastedDays

    const updatedData = {
      visit_count: sub.visit_count + 1,
      wasted_days_this_month: newWastedDays,
      last_visit: new Date().toISOString()
    }

    const response = await fetch(`${API_BASE}/subscriptions/${subscriptionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedData)
    })

    if (response.ok) {
      // Update local cache
      const index = subscriptions.findIndex((s) => s.id === subscriptionId)
      if (index !== -1) {
        subscriptions[index] = {
          ...subscriptions[index],
          ...updatedData
        }
      }
      console.log("[Background] Updated wasted days for:", subscriptionId, "total:", newWastedDays)
    }
  } catch (error) {
    console.error("[Background] Failed to update wasted days:", error)
  }
}

// Stop tracking a tab and accumulate its time
function stopTrackingTab(tabId: number): void {
  const tracked = openSubscriptionTabs.get(tabId)
  if (!tracked) return

  const elapsedSeconds = Math.floor((Date.now() - tracked.startTime) / 1000)
  if (elapsedSeconds > 0) {
    const current = pendingTimeUpdates.get(tracked.subscriptionId) || 0
    pendingTimeUpdates.set(tracked.subscriptionId, current + elapsedSeconds)
  }

  openSubscriptionTabs.delete(tabId)
  console.log("[Background] Stopped tracking tab", tabId)
}

// Accumulate time for all open subscription tabs and save to backend
async function flushTimeUpdates(): Promise<void> {
  // First, accumulate current time from all open tabs
  const now = Date.now()
  for (const [tabId, tracked] of openSubscriptionTabs.entries()) {
    const elapsedSeconds = Math.floor((now - tracked.startTime) / 1000)
    if (elapsedSeconds > 0) {
      const current = pendingTimeUpdates.get(tracked.subscriptionId) || 0
      pendingTimeUpdates.set(tracked.subscriptionId, current + elapsedSeconds)
      // Reset the start time
      tracked.startTime = now
    }
  }

  // Now save all pending updates to backend
  for (const [subscriptionId, seconds] of pendingTimeUpdates.entries()) {
    if (seconds > 0) {
      await updateSubscriptionStats(subscriptionId, seconds, false)
    }
  }
  pendingTimeUpdates.clear()
}

// Process a tab URL change
async function processTabUrl(tabId: number, url: string): Promise<void> {
  // Skip chrome:// and other internal URLs
  if (!url || !url.startsWith("http")) {
<<<<<<< HEAD
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
=======
    stopTrackingTab(tabId)
    return
  }

  const matchingSub = findMatchingSubscription(url)
  const domain = extractDomain(url)

  if (matchingSub && domain) {
    await startTrackingTab(matchingSub, tabId, domain)
  } else {
    // No matching subscription - stop tracking this tab if we were
    stopTrackingTab(tabId)
>>>>>>> main
  }
}

// Periodic time save (every 30 seconds) to prevent data loss
setInterval(async () => {
<<<<<<< HEAD
  if (activeSession) {
    const elapsedSeconds = Math.floor((Date.now() - activeSession.startTime) / 1000);
    if (elapsedSeconds >= 30) {
      await updateSubscriptionStats(activeSession.subscriptionId, elapsedSeconds, false);
      // Reset the timer
      activeSession.startTime = Date.now();
    }
=======
  if (openSubscriptionTabs.size > 0) {
    console.log("[Background] Flushing time updates for", openSubscriptionTabs.size, "tracked tabs")
    await flushTimeUpdates()
>>>>>>> main
  }
}, 30000);

// Scan all open tabs on startup to begin tracking
async function scanAllTabs(): Promise<void> {
  try {
<<<<<<< HEAD
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      await processTabUrl(activeInfo.tabId, tab.url);
=======
    const tabs = await chrome.tabs.query({})
    console.log("[Background] Scanning", tabs.length, "open tabs")
    for (const tab of tabs) {
      if (tab.id && tab.url) {
        await processTabUrl(tab.id, tab.url)
      }
>>>>>>> main
    }
    console.log("[Background] Now tracking", openSubscriptionTabs.size, "subscription tabs")
  } catch (error) {
<<<<<<< HEAD
    console.error("[Background] Error on tab activated:", error);
  }
});
=======
    console.error("[Background] Error scanning tabs:", error)
  }
}
>>>>>>> main

// Tab event listeners
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only process when URL changes and is complete
  if (changeInfo.status === "complete" && tab.url) {
    await processTabUrl(tabId, tab.url);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
<<<<<<< HEAD
  if (activeSession && activeSession.tabId === tabId) {
    await endSession();
=======
  stopTrackingTab(tabId)
  // Flush any pending updates when a tab closes
  if (pendingTimeUpdates.size > 0) {
    await flushTimeUpdates()
>>>>>>> main
  }
});

<<<<<<< HEAD
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
=======
// Show Spotify cancellation notification
function showSpotifyCancelNotification(): void {
  console.log("[Background] Attempting to show Spotify cancel notification...")
  const manifest = chrome.runtime.getManifest()
  const iconPath = manifest.icons?.['128'] || manifest.icons?.['48'] || 'icon.png'
  const iconUrl = chrome.runtime.getURL(iconPath)
  console.log("[Background] Using icon URL:", iconUrl)
  chrome.notifications.create('spotify-cancel', {
    type: 'basic',
    iconUrl: iconUrl,
    title: '🔥 Cancel Spotify?',
    message: "You haven't used Spotify in a while. Want to cancel and save $11.99/month?",
    buttons: [
      { title: 'Remind me later' },
      { title: 'Cancel Subscription' }
    ],
    priority: 2,
    requireInteraction: true
  }, (notificationId) => {
    if (chrome.runtime.lastError) {
      console.error("[Background] Notification error:", chrome.runtime.lastError.message)
    } else {
      console.log("[Background] Notification created with ID:", notificationId)
    }
  })
}

// Handle notification click (for macOS - buttons don't work on macOS)
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId === 'spotify-cancel') {
    // Open Spotify account page when notification is clicked
    chrome.tabs.create({ url: 'https://www.spotify.com/account/overview/' })
    chrome.notifications.clear(notificationId)
  }
})

// Handle notification button clicks (Windows only)
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId === 'spotify-cancel') {
    if (buttonIndex === 0) {
      // Remind me later - show again in 5 seconds
      chrome.notifications.clear(notificationId)
      setTimeout(() => {
        showSpotifyCancelNotification()
      }, 5000)
    } else if (buttonIndex === 1) {
      // Cancel - open Spotify account page
      chrome.tabs.create({ url: 'https://www.spotify.com/account/overview/' })
      chrome.notifications.clear(notificationId)
>>>>>>> main
    }
  }
});

// Listen for subscription changes (when user adds/edits/deletes) and price requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SUBSCRIPTIONS_UPDATED") {
<<<<<<< HEAD
    fetchSubscriptions();
    sendResponse({ success: true });
=======
    fetchSubscriptions().then(() => {
      scanAllTabs() // Re-scan tabs after subscriptions updated
    })
    sendResponse({ success: true })
  } else if (message.type === "GET_SERVICE_PRICES") {
    sendResponse({ prices: SERVICE_PRICES_CAD })
  } else if (message.type === "SHOW_CANCEL_NOTIFICATION") {
    showSpotifyCancelNotification()
    sendResponse({ success: true })
>>>>>>> main
  }
  return true;
});

// Initialize on startup
<<<<<<< HEAD
fetchSubscriptions();

// Also refresh subscriptions periodically (every 5 minutes)
setInterval(fetchSubscriptions, 5 * 60 * 1000);

console.log("[Background] Tab tracking service initialized");
=======
async function initialize(): Promise<void> {
  await fetchSubscriptions()
  await scanAllTabs()
  console.log("[Background] Tab tracking service initialized")

  // Auto-trigger Spotify cancel notification for demo (3 seconds after load)
  setTimeout(() => {
    showSpotifyCancelNotification()
  }, 3000)
}

initialize()

// Also refresh subscriptions periodically (every 5 minutes)
setInterval(fetchSubscriptions, 5 * 60 * 1000)
>>>>>>> main
