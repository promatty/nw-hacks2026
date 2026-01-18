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
};

interface Subscription {
  id: string;
  name: string;
  url: string | null;
  visit_count: number;
  last_visit: string;
  total_time_seconds: number;
  user_id: string;
  created_at: string;
  wasted_days_this_month: number;
}

interface TrackedTab {
  subscriptionId: string;
  domain: string;
  startTime: number;
}

// In-memory state
let subscriptions: Subscription[] = [];
let userId: string | null = null;

// Track ALL open subscription tabs (tabId -> tracking info)
const openSubscriptionTabs: Map<number, TrackedTab> = new Map();

// Track accumulated but unsaved time per subscription (subscriptionId -> seconds)
const pendingTimeUpdates: Map<string, number> = new Map();

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

// Fetch subscriptions from API (both manual and Plaid)
async function fetchSubscriptions(): Promise<void> {
  try {
    const uid = await getUserId();

    // Fetch manual subscriptions
    const manualResponse = await fetch(`${API_BASE}/subscriptions/${uid}`);
    let manualSubs: Subscription[] = [];
    if (manualResponse.ok) {
      manualSubs = await manualResponse.json();
    }

    // Fetch Plaid subscriptions
    const plaidResponse = await fetch(`http://localhost:3000/api/plaid/recurring/${uid}`);
    let plaidSubs: Subscription[] = [];
    if (plaidResponse.ok) {
      const plaidData = await plaidResponse.json();
      // Convert Plaid subscriptions to the same format
      plaidSubs = (plaidData.subscriptions || []).map((sub: any) => ({
        id: sub.id,
        name: sub.name || sub.merchant_name,
        url: sub.url || null,
        visit_count: sub.visit_count || 0,
        last_visit: sub.last_visit || sub.last_date || new Date().toISOString(),
        total_time_seconds: sub.total_time_seconds || 0,
        user_id: uid,
        created_at: sub.last_date || new Date().toISOString(),
        wasted_days_this_month: 0
      }));
    }

    // Combine both lists (manual first, then Plaid)
    subscriptions = [...manualSubs, ...plaidSubs];
    console.log("[Background] Loaded", manualSubs.length, "manual +", plaidSubs.length, "Plaid subscriptions");
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

// Strip www prefix from domain for comparison
function stripWww(domain: string): string {
  return domain.startsWith("www.") ? domain.slice(4) : domain;
}

// Check if a URL matches a subscription
function findMatchingSubscription(url: string): Subscription | null {
  const domain = extractDomain(url);
  if (!domain) return null;

  const strippedDomain = stripWww(domain);

  for (const sub of subscriptions) {
    if (!sub.url) continue;

    const subDomain = extractDomain(sub.url);
    if (!subDomain) continue;

    const strippedSubDomain = stripWww(subDomain);

    // Match if domains are the same (ignoring www prefix) or if the current domain is a subdomain
    if (strippedDomain === strippedSubDomain ||
        strippedDomain.endsWith("." + strippedSubDomain) ||
        strippedSubDomain.endsWith("." + strippedDomain)) {
      return sub;
    }
  }
  return null;
}

// Check if a subscription is a Plaid subscription (ID starts with "recurring-")
function isPlaidSubscription(subscriptionId: string): boolean {
  return subscriptionId.startsWith("recurring-");
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

    let response: Response;

    if (isPlaidSubscription(subscriptionId)) {
      // Use Plaid usage API for Plaid subscriptions
      const uid = await getUserId();
      response = await fetch(`http://localhost:3000/api/plaid/usage/${uid}/${encodeURIComponent(sub.name)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addSeconds, incrementVisit })
      });
    } else {
      // Use manual subscriptions API
      response = await fetch(`${API_BASE}/subscriptions/${subscriptionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData)
      });
    }

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
        sub.name,
        incrementVisit ? "(+1 visit)" : "",
        addSeconds > 0 ? `(+${addSeconds}s)` : ""
      );
    }
  } catch (error) {
    console.error("[Background] Failed to update subscription stats:", error);
  }
}

// Check if we should count a new visit for this subscription
function shouldCountVisit(subscriptionId: string): boolean {
  const lastVisit = lastVisitCounted.get(subscriptionId);
  if (!lastVisit) return true;

  const timeSinceLastVisit = Date.now() - lastVisit;
  return timeSinceLastVisit >= MIN_VISIT_INTERVAL_MS;
}

// Calculate wasted days since last visit
function calculateWastedDays(subscription: Subscription): { wastedDays: number; shouldReset: boolean; } {
  const now = new Date();
  const lastVisitDate = new Date(subscription.last_visit);
  const createdDate = new Date(subscription.created_at);
  const billingDay = createdDate.getDate(); // Day of month subscription was created

  // Get current billing cycle start date
  const getCurrentBillingCycleStart = (): Date => {
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();

    if (today >= billingDay) {
      // Current billing cycle started this month
      return new Date(year, month, billingDay);
    } else {
      // Current billing cycle started last month
      return new Date(year, month - 1, billingDay);
    }
  };

  const billingCycleStart = getCurrentBillingCycleStart();

  // Check if last visit was before current billing cycle - reset
  if (lastVisitDate < billingCycleStart) {
    // Calculate days from billing cycle start to today
    const daysSinceCycleStart = Math.floor((now.getTime() - billingCycleStart.getTime()) / (1000 * 60 * 60 * 24));
    return { wastedDays: daysSinceCycleStart, shouldReset: true };
  }

  // Same billing cycle - calculate days between last visit and today
  const lastVisitDay = lastVisitDate.getDate();
  const today = now.getDate();
  const dayGap = today - lastVisitDay - 1; // Days between, not including visit days

  return { wastedDays: Math.max(0, dayGap), shouldReset: false };
}

// Start tracking a tab with a subscription
async function startTrackingTab(subscription: Subscription, tabId: number, domain: string): Promise<void> {
  // If already tracking this tab with same subscription, just update start time
  const existing = openSubscriptionTabs.get(tabId);
  if (existing && existing.subscriptionId === subscription.id) {
    return; // Already tracking
  }

  openSubscriptionTabs.set(tabId, {
    subscriptionId: subscription.id,
    domain,
    startTime: Date.now()
  });

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

// Update subscription with wasted days calculation
async function updateSubscriptionWithWastedDays(
  subscriptionId: string,
  wastedDays: number,
  shouldReset: boolean
): Promise<void> {
  try {
    const sub = subscriptions.find((s) => s.id === subscriptionId);
    if (!sub) return;

    const newWastedDays = shouldReset ? wastedDays : sub.wasted_days_this_month + wastedDays;

    const updatedData = {
      visit_count: sub.visit_count + 1,
      wasted_days_this_month: newWastedDays,
      last_visit: new Date().toISOString()
    };

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
        };
      }
      console.log("[Background] Updated wasted days for:", subscriptionId, "total:", newWastedDays);
    }
  } catch (error) {
    console.error("[Background] Failed to update wasted days:", error);
  }
}

// Stop tracking a tab and accumulate its time
function stopTrackingTab(tabId: number): void {
  const tracked = openSubscriptionTabs.get(tabId);
  if (!tracked) return;

  const elapsedSeconds = Math.floor((Date.now() - tracked.startTime) / 1000);
  if (elapsedSeconds > 0) {
    const current = pendingTimeUpdates.get(tracked.subscriptionId) || 0;
    pendingTimeUpdates.set(tracked.subscriptionId, current + elapsedSeconds);
  }

  openSubscriptionTabs.delete(tabId);
  console.log("[Background] Stopped tracking tab", tabId);
}

// Accumulate time for all open subscription tabs and save to backend
async function flushTimeUpdates(): Promise<void> {
  // First, accumulate current time from all open tabs
  const now = Date.now();
  for (const [tabId, tracked] of openSubscriptionTabs.entries()) {
    const elapsedSeconds = Math.floor((now - tracked.startTime) / 1000);
    if (elapsedSeconds > 0) {
      const current = pendingTimeUpdates.get(tracked.subscriptionId) || 0;
      pendingTimeUpdates.set(tracked.subscriptionId, current + elapsedSeconds);
      // Reset the start time
      tracked.startTime = now;
    }
  }

  // Now save all pending updates to backend
  for (const [subscriptionId, seconds] of pendingTimeUpdates.entries()) {
    if (seconds > 0) {
      await updateSubscriptionStats(subscriptionId, seconds, false);
    }
  }
  pendingTimeUpdates.clear();
}

// Process a tab URL change
async function processTabUrl(tabId: number, url: string): Promise<void> {
  // Skip chrome:// and other internal URLs
  if (!url || !url.startsWith("http")) {
    stopTrackingTab(tabId);
    return;
  }

  const matchingSub = findMatchingSubscription(url);

  if (matchingSub) {
    const domain = extractDomain(url);
    if (domain) {
      // Use multi-tab tracking system which properly increments visits
      await startTrackingTab(matchingSub, tabId, domain);
    }
  } else {
    // No matching subscription - stop tracking this tab
    stopTrackingTab(tabId);
  }
}

// Periodic time save (every 30 seconds) to prevent data loss
setInterval(async () => {
  await flushTimeUpdates();
}, 30000);

// Scan all open tabs on startup to begin tracking
async function scanAllTabs(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id && tab.url) {
        const matchingSub = findMatchingSubscription(tab.url);
        if (matchingSub) {
          const domain = extractDomain(tab.url);
          if (domain) {
            await startTrackingTab(matchingSub, tab.id, domain);
          }
        }
      }
    }
    console.log("[Background] Now tracking", openSubscriptionTabs.size, "subscription tabs");
  } catch (error) {
    console.error("[Background] Error scanning tabs:", error);
  }
}

// Tab activated listener
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

// Tab event listeners
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only process when URL changes and is complete
  if (changeInfo.status === "complete" && tab.url) {
    await processTabUrl(tabId, tab.url);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  stopTrackingTab(tabId);
});

// Handle window focus changes (user switches to another app)
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus - flush accumulated time
    await flushTimeUpdates();
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

// Listen for subscription changes (when user adds/edits/deletes) and price requests
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
