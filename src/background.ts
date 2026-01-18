// Background script for Chrome extension
// Handles messages from content scripts

export {}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "closeTab") {
    // Close the tab that sent the message
    if (sender.tab?.id) {
      chrome.tabs.remove(sender.tab.id)
      sendResponse({ success: true })
    } else {
      sendResponse({ success: false, error: "No tab ID found" })
    }
  }
  
  // Return true to indicate we will send a response asynchronously
  return true
})
