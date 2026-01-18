## Inspiration
In 2024, studies discovered that the average consumer has 8.2 subscriptions, with 32% having 10+ subscriptions*, and consumers estimated $86/month but actually spent $133 - a 155% underestimation, amounting to $564+ in overlooked annual expenses**. Clearly, we've all signed up for "just one more" streaming service only to realize we're already paying for five we barely use. We wanted to create a tool that not only tracks subscriptions but makes you feel something about your wasteful spending - through humor and *shame*.

## What it does
RoastMySubs is a Chrome extension that connects to your bank via Plaid to automatically detect subscription payments. Our AI mascot "Burny" roasts you for unused subscriptions with savage, personalized callouts powered by Gemini. Although humorous, the killer feature is *checkout interception* - when you try to subscribe to Netflix, Spotify, or other entertainment services, for example, a pop-up shows exactly how much you're already spending in that category, shaming you into reconsidering. It's where financial awareness meets accountability comedy.

## How we built it

-Chrome Extension built with Plasmo framework for seamless React-based browser extension development
-Plaid API integration for automatic bank connection and subscription detection from real transaction data
-Gemini 2.5 Flash with streaming responses powers personalized AI roasts based on your actual usage patterns
-Express.js backend with TypeScript handles API routing and Plaid token management
-Supabase for persistent storage of user data and subscription tracking
-React + Framer Motion for smooth UI animations and the expressive Burny mascot
-Implementing an iterative workflow, we used a feature list where we'd call out which feature we were working on. Finished features got crossed off, and whoever finished first grabbed the next unclaimed one. 

## Challenges we ran into
-Chrome extension content script injection timing was tricky—detecting checkout pages on SPAs required careful URL monitoring
-Balancing the "roast" tone: making it funny without being genuinely hurtful
-Plaid sandbox testing vs. real bank data required careful mock data architecture

## Accomplishments that we're proud of
-The checkout interception feature genuinely makes you think twice before subscribing
-Burny's animated expressions responding to your spending habits
-Seamless Plaid integration auto-detecting subscriptions without manual input
-Streaming AI responses that feel natural and conversational

## What we learned
-First time integrating Plaid - transaction categorization, and recurring payment detection
-How to build a full Chrome extension with Plasmo (content scripts, background workers, popup UI)
-Prompt engineering to get consistently funny yet relevant roasts from Gemini

## What's next for RoastMySubs
-Chrome Web Store deployment
-Adding automated cancellation using AI agents
-Budget goals and spending alerts
-Mobile companion app to monitor Apple Pay payments, credit card use, etc. 

\* (Source: 11fs.com) https://www.11fs.com/article/subscription-trends-to-watch-in-2025#:~:text=With%20the%20average%20US%20consumer,app%20to%20manage%20their%20subscriptions.

\*\* (Source: C+R Research) https://www.crresearch.com/blog/subscription-service-statistics-and-costs/
