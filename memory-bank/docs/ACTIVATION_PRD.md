# RETAIL MANAGER - ACTIVATION KEY SYSTEM
## PRD Audit Prompt for Gemini 3 Preview

---

## PROJECT CONTEXT
**Product:** Retail Manager (Tauri + React + Node.js)
**Feature:** Offline License Activation System
**Target Users:** Small retail stores in Mali (offline-first)
**Tech Stack:** Tauri (Rust), React, SQLite, Node.js backend

---

## REQUIREMENTS SPECIFICATION

### 1. LICENSING MODEL
- **Purchase Model:** One activation key = One purchase
- **Store Limit:** Each key can activate maximum 2 stores
- **Trial Period:** 30 days free (no key required)
- **After Trial:** Key required to continue, but app NOT blocked

### 2. KEY SPECIFICATIONS

#### 2.1 Key Format (Hybrid)
```
Format: RM-YYYY-SSSS-HHHH-VVVV
Where:
  RM        = Product prefix (Retail Manager)
  YYYY      = Year of purchase (e.g., 2026)
  SSSS      = Sequential store identifier (0001-9999)
  HHHH      = Hardware hash (first 4 chars of device MAC address)
  VVVV      = Validation checksum (4-char LUHN-like algorithm)

Example: RM-2026-0001-A1B2-K7X9
```

#### 2.2 Key Validation (Offline)
- All validation happens locally (NO internet required)
- Checksum verified using custom algorithm
- Hardware hash prevents key sharing across devices
- Expiration date calculated from purchase date

### 3. USER LIFECYCLE

#### 3.1 First Launch (Day 1)
```
User opens app for first time
  ↓
"Welcome to Retail Manager"
  ↓
[Option A] "Enter Activation Key"  [Option B] "Try Free (30 days)"
  ↓ (If B selected)
Trial mode activated
App is fully usable
```

#### 3.2 Free Trial Period (Days 1-30)
- App works normally WITHOUT key
- No prompts or warnings
- On startup: Show "Days remaining: 28" banner (optional)
- All features available

#### 3.3 After Trial Expires (Day 31+)
```
Day 31 and onwards:
  ↓
User launches app
  ↓
Check: Is key activated?
  YES → Load app normally, no prompt
  NO → Show "Activation Required" dialog
       ↓
       [Enter Key]  [Continue Without Key]
       ↓
       If [Continue]: App loads normally but dialog repeats on EVERY launch
       If [Enter Key]: Validate & store key, never ask again
```

#### 3.4 Key Entry Screen
```
┌─────────────────────────────────────────┐
│ 📜 ACTIVATION REQUIRED                   │
├─────────────────────────────────────────┤
│                                          │
│ Your 30-day trial has ended.             │
│ Please activate to continue using        │
│ Retail Manager.                          │
│                                          │
│ Activation Key:                          │
│ [RM-2026-____-____-____] ✓              │
│                                          │
│ (Format: RM-YYYY-SSSS-HHHH-VVVV)       │
│                                          │
│ [Cancel]            [Activate]           │
│                                          │
│ Have no key?                             │
│ [Get Key]  (Opens info/contact)          │
│                                          │
└─────────────────────────────────────────┘
```

### 4. KEY STORAGE

#### 4.1 License File Location
```
macOS:   ~/Library/Application Support/Retail Manager/license.enc
Linux:   ~/.config/retail-manager/license.enc
Windows: %APPDATA%/Retail Manager/license.enc
```

#### 4.2 License File Content (Encrypted)
```json
{
  "activationKey": "RM-2026-0001-A1B2-K7X9",
  "purchaseDate": "2026-02-03",
  "activationDate": "2026-02-05",
  "stores": [
    {
      "storeId": "store-001",
      "storeName": "Main Store",
      "activatedAt": "2026-02-05T10:30:00Z"
    }
  ],
  "hardwareHash": "A1B2C3D4E5F6",
  "deviceFingerprint": "mac-arm64-2026",
  "version": "1"
}
```

### 5. TRIAL TRACKING

#### 5.1 Trial Start Detection
```
On First Launch:
1. Check if app_installed_date.json exists
2. Check if license.enc exists
3. If neither: Create app_installed_date.json with timestamp
4. Calculate: trialDaysRemaining = 30 - (today - installDate)
```

#### 5.2 Trial Expiration Check
```
On Every Launch:
1. Read app_installed_date.json
2. Calculate days elapsed
3. If < 30 days: Allow access (trial mode)
4. If >= 30 days AND no license.enc: Show activation dialog
5. If license.enc exists: Validate & load
```

### 6. KEY VALIDATION LOGIC

#### 6.1 Checksum Algorithm (Pseudo-code)
```
Function: ValidateKey(key: string): boolean
  
  1. Parse: parts = key.split('-')
     Expected: ['RM', YYYY, SSSS, HHHH, VVVV]
  
  2. Validate Format:
     - part[0] == 'RM' ✓
     - part[1] is valid year ✓
     - part[2] is 0001-9999 ✓
     - part[3] is 4 hex chars ✓
     - part[4] is 4 alphanumeric ✓
  
  3. Validate Hardware Hash:
     - Get device MAC address
     - Hash first 4 chars: HHHH
     - Compare with key[HHHH]
     - If mismatch: INVALID (key is for different device)
  
  4. Calculate Checksum:
     - dataToCheck = 'RM' + YYYY + SSSS + HHHH
     - checksum = CustomLuhn(dataToCheck)
     - Compare: checksum == key[VVVV]
     - If mismatch: INVALID (corrupted key)
  
  5. Return: VALID or INVALID
```

#### 6.2 Hardware Hash Generation
```
macOS:
  1. Get primary MAC address: `networksetup -getmacaddress en0`
  2. Take first 4 chars: e.g., "A1:B2" → "A1B2"
  3. Store in license file

Windows:
  1. Get MAC: `getmac /fo csv /nh`
  2. First 4 chars of first adapter
  3. Store in license file

Linux:
  1. Get MAC: `ip link show | grep ether`
  2. First 4 chars
  3. Store in license file
```

### 7. STORE MANAGEMENT

#### 7.1 Store Activation
```
First key entry:
  1. User enters key: RM-2026-0001-A1B2-K7X9
  2. Validate key
  3. Prompt: "Store Name?" → "Main Store"
  4. Store saved as store-001
  5. License file updated with store data
  6. App loads dashboard

Second store (same key):
  User clicks: "Settings" → "Add Another Store"
  ↓
  Dialog: "Enter Store Name" → "Branch Store"
  ↓
  Check: How many stores already activated with this key?
  ↓
  If 1 store: Allow (total = 2)
  If 2+ stores: Reject "Maximum 2 stores per key"
  ↓
  Store saved as store-002
```

#### 7.2 Store Switching
```
Header/Menu shows:
  [Main Store ▼]
  
  Click ▼:
  • Main Store ✓
  • Branch Store
  
  Select → Switch store context
```

### 8. USER EXPERIENCE FLOW

#### 8.1 Scenario A: Pays on Day 1
```
Day 1: Opens app
  → "Try Free" selected
  → Uses app normally

Day 31: Opens app
  → Dialog: "Activation Required"
  → User enters: RM-2026-0001-A1B2-K7X9
  → App validates & stores key
  → App restarts automatically
  → Never asks again (unless key invalid)

30 years later: Still works ✓
```

#### 8.2 Scenario B: Never Enters Key
```
Day 1-30: Trial works
Day 31: Dialog shows
Day 32: Dialog shows
Day 100: Dialog still shows on every launch
...
Day 1000: Still works, still asks ✓
(App is not blocked, just nags)
```

#### 8.3 Scenario C: Wrong Key
```
User enters: RM-2026-0001-A1B2-WRONG
Validation fails
Error: "Invalid key format or checksum"
Dialog stays open
User can retry or continue without key
(Same nag behavior as Scenario B)
```

### 9. TECHNICAL IMPLEMENTATION

#### 9.1 Tauri Commands (Rust)
```rust
#[tauri::command]
fn validate_license(key: String) -> Result<LicenseData, String>

#[tauri::command]
fn activate_license(key: String, storeName: String) -> Result<(), String>

#[tauri::command]
fn get_license_status() -> Result<LicenseStatus, String>
// Returns: { status: "active" | "trial" | "expired", 
//            daysRemaining: i32, stores: [...] }

#[tauri::command]
fn add_store(storeName: String) -> Result<Store, String>

#[tauri::command]
fn list_stores() -> Result<Vec<Store>, String>

#[tauri::command]
fn switch_store(storeId: String) -> Result<(), String>

#[tauri::command]
fn get_device_hash() -> Result<String, String>
```

#### 9.2 React Components
```
<ActivationDialog />
  ├─ KeyInput (validated format)
  ├─ StoreNameInput
  └─ ErrorMessage (if invalid)

<ActivationBanner />
  ├─ "Days remaining: 28"
  └─ [Add Key] button

<StoreSelector />
  ├─ Dropdown of activated stores
  └─ [Add Store] option
```

#### 9.3 Data Flow
```
App Launch
  ↓
Check: app_installed_date.json exists?
  ↓
  NO → Create it, set to today
  YES → Calculate days elapsed
  ↓
Check: days < 30?
  ↓
  YES → Allow launch (trial mode)
  NO → Check: license.enc exists & valid?
    ↓
    YES → Allow launch + load store data
    NO → Show activation dialog on every launch
         (But still allow app to launch)
```

### 10. ERROR HANDLING

| Error | User Sees | Solution |
|---|---|---|
| Key format invalid | "Invalid format. Use: RM-YYYY-SSSS-HHHH-VVVV" | Retry |
| Checksum failed | "Key rejected. Please check format." | Retry or contact |
| Hardware hash mismatch | "This key is for another device." | Contact support |
| Max stores reached | "You already activated 2 stores with this key." | Use different key |
| License file corrupted | "License corrupted. Remove and re-activate." | Delete license.enc |

### 11. ACCEPTANCE CRITERIA

- [ ] Key validation works offline (no internet required)
- [ ] 30-day trial works from first launch
- [ ] After day 30, activation dialog appears on EVERY launch (if no key)
- [ ] User can continue using app without key (not blocked)
- [ ] Once key entered, dialog never appears again
- [ ] Can activate max 2 stores per key
- [ ] Hardware hash prevents key sharing
- [ ] License file encrypted and stored locally
- [ ] Works on macOS, Windows, Linux
- [ ] Supports store switching
- [ ] Clear error messages

---

## KEY GENERATION TOOL (For You)

You will need a CLI tool to generate keys:

```bash
./generate-key.sh <year> <storeId> <deviceHash>

Example:
./generate-key.sh 2026 0001 A1B2

Output:
RM-2026-0001-A1B2-K7X9
```

This tool:
1. Takes year, store ID, device hash
2. Calculates LUHN checksum
3. Outputs key
4. (Optional) Saves to CSV for tracking

---

## GEMINI 3 TASK

Please analyze this PRD and:

1. **Validate Requirements:** Are all specs clear and implementable?
2. **Identify Gaps:** What's missing or ambiguous?
3. **Implementation Plan:** Break down into tasks (Rust + React)
4. **Code Structure:** Suggest file organization
5. **Security Review:** Any vulnerabilities in offline key validation?
6. **Testing Strategy:** How to test activation flow?
7. **Risks:** What could go wrong?

---

## BUSINESS CONTEXT

- **Price per key:** $200 (one-time per store)
- **Support level:** Email-based (no phone)
- **Region:** Mali (low internet)
- **Target:** Small retail stores (2-5 users per store)

---

## DEADLINE

Implementation needed by: End of February 2026

---

[END OF PRD]
