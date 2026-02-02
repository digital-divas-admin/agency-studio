# 🐛 Debug: Requests Appearing Then Vanishing

## What's Happening

```
Timeline:
1. Filter = "All" ✓
2. Create request → Shows success ✓
3. Request appears in list ✓
4. Refresh page ✓
5. Request appears briefly ✓
6. Request vanishes! ✗
```

This suggests a **race condition** or **context filter** interfering.

---

## 🔍 Debug Steps

I've added extensive logging. Let's see what's happening:

### Step 1: Hard Refresh
```
Windows: Ctrl + Shift + R
Mac: Cmd + Shift + R
```

### Step 2: Open Console BEFORE doing anything
```
Press F12 → Console tab
```

### Step 3: Watch the Console Output

You should see something like this when page loads:

```javascript
🎨 ContentRequestsPage rendered
🔍 selectedModel changed: null
🔄 useEffect running - loading requests and models
📥 Loading requests with filters: {}
   selectedModel: null
   filterStatus: ""
📦 Loaded requests: 3 requests
   First request: Test Request status: pending
   Filters active: {modelFilter: "none", statusFilter: "none"}
✅ Initial load complete
```

### Step 4: Create a Request

Watch for:
```javascript
Creating content request with data: {...}
Content request created successfully: {...}
📥 Loading requests with filters: {}
📦 Loaded requests: 4 requests  ← Should increase
```

### Step 5: Refresh Page

**CRITICAL:** Watch the console during refresh. Look for:

```javascript
// GOOD (only loads once):
🎨 ContentRequestsPage rendered
📥 Loading requests with filters: {}
📦 Loaded requests: 4 requests

// BAD (loads multiple times with different filters):
🎨 ContentRequestsPage rendered
📥 Loading requests with filters: {}
📦 Loaded requests: 4 requests
🔍 selectedModel changed: {id: "xxx", name: "Sarah"}  ← MODEL CONTEXT CHANGING!
🎨 ContentRequestsPage rendered
📥 Loading requests with filters: {model_id: "xxx"}    ← NOW FILTERED!
📦 Loaded requests: 2 requests                         ← FEWER REQUESTS!
```

---

## 🎯 What to Look For

### Scenario A: Model Context Interfering

If you see:
```
🔍 selectedModel changed: {id: "xxx", name: "Sarah"}
📥 Loading requests with filters: {model_id: "xxx"}
```

**Problem:** The ModelContext is auto-selecting a model, filtering out your new request.

**Solution:** We need to ignore selectedModel on this page.

### Scenario B: Multiple Loads

If you see:
```
📥 Loading requests with filters: {}
📥 Loading requests with filters: {}
📥 Loading requests with filters: {status: "pending"}
```

**Problem:** loadRequests is being called multiple times with different filters.

**Solution:** We need to debounce or fix the useEffect dependencies.

### Scenario C: Filter Status Changing

If you see:
```
   filterStatus: ""
   filterStatus: "pending"
   filterStatus: ""
```

**Problem:** filterStatus is changing randomly.

**Solution:** Need to track why it's changing.

---

## 📋 What to Send Me

After refreshing with console open, copy and send me:

1. **The FULL console output** (scroll to top, select all, copy)

2. **Answer these questions:**
   - Do you see "selectedModel changed" messages?
   - How many times does "Loading requests" appear?
   - Do the filter values change between loads?
   - What's the "Loaded requests: X requests" count on each load?

3. **Screenshot of the console** if possible

---

## 🔧 Potential Fixes (Based on What We Find)

### If it's the Model Context:

```javascript
// Ignore selectedModel on ContentRequests page
const loadRequests = useCallback(async () => {
  const params = {};
  // Don't filter by selectedModel
  if (filterStatus) params.status = filterStatus;
  // ...
}, [filterStatus]); // Remove selectedModel from dependencies
```

### If it's Multiple Loads:

```javascript
// Add loading guard
if (isLoading) return; // Don't load if already loading
setIsLoading(true);
// ... load
setIsLoading(false);
```

### If it's Filter Changing:

```javascript
// Store filter in ref to prevent re-renders
const filterRef = useRef(filterStatus);
```

---

## 🎯 Quick Test

Try this to isolate the issue:

1. **Clear your browser cache completely**
   ```
   Chrome: Settings → Privacy → Clear browsing data → Cached images and files
   ```

2. **Disable any browser extensions**
   - Try in Incognito/Private mode

3. **Check if you have multiple tabs open**
   - Close all but one tab
   - Refresh

4. **Check the Model selector at the top of the page**
   - Is there a model selected in the dropdown?
   - Try selecting "All Models" if there is one

---

## ⚡ Immediate Workaround

While we debug, try this:

1. After creating a request, **don't refresh**
2. Click away to another page (Dashboard)
3. Click back to Content Requests
4. Does it appear now?

This tells us if it's a refresh issue vs a loading issue.

---

## 🚨 What I Need From You

Run through the steps above and send me:

1. **Full console output** (copy/paste the text)
2. **Answers to the questions** above
3. **Whether the workaround works** (navigate away and back)

This will tell me exactly what's causing the issue!
