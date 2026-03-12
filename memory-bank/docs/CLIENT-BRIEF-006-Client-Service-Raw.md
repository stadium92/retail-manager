# Original Team Brief — Client-Service Analysis, Discount Flow & Sale Integrity

> **Date:** 2026-02-21  
> **Source:** Client verbal brief + team analysis request (raw, unedited)  
> **Status:** Processed → See indexed files below

---

## Related Files

| File | Purpose |
|------|---------|
| **[`analysis/CLIENT-SERVICE-ANALYSIS-006.md`](../analysis/CLIENT-SERVICE-ANALYSIS-006.md)** | Full team audit report — 11 findings, priority matrix, team Q/A |
| **[`docs/PROMPT-006-Client-Service-Backend-And-Discount-Fix.md`](PROMPT-006-Client-Service-Backend-And-Discount-Fix.md)** | Agent-ready implementation prompt (Gemini 3 Pro, 1M ctx) |
| **This file** | Original unedited team brief and client voice |

---

## Client Brief (Verbatim)

### Team composition and analysis request:

Okay, I need you to think like a team of analysts and You need to think that way. There is a team of analysts, there is a group of QA testers, there is a group of clients and there is a group of beta testers or see there is a group of People that are using this app currently. So I want you to put it that way. I want you now to analyze this so now the app is more focused on the supplier side of the project right the supplier are bringing in right any client and client service are taking out right we supply we buy the client we buy out right and there's this one service we need to look into. There's just one service we need to link into. We need to look through kind of pretty much everything, the logic how it interacts with the code base and understand how it really works and how we can like kind of fix some some problem with it if there is a problem we need to fix so this team needs to think between themselves and find a way to improve the code but actually when I try to see, it is more supplier focused so it's more for supplier focus which the supplier focus and it is backing the supplier focus one is backing up the price logic the box logic and everything so we want to refer to that and kind of refine and build the client service side okay let's talk more about the client service side now which is for example like the client service let's say we are under the worker side of the project let's see if it is under the master side also okay the client service is here so there's a like the client service we have like group of client which is VIP grocers and public each with a discount percentage So, we need to make sure those discount percentages are really working correctly and are consistent. So, the team can ask each other the questions, it can ask each other questions and to see how the codebase works and how we can improve the implementation.

### Client service and discount focus:

So, what else? Okay, when we are selling it right? We are selling it at a time. With the clients and how do you do product is going out right? The price logic, the calculation logic, all the value logic should be taken into account like how do products going out going out see? The price has been taken and all this thing we need to think deeply about each general any of that sorry everybody english but help you yeah yeah not to this one so this counts so yeah this is it so let's see what you can do please thank you so much.

---

## Team Roles Defined By Client

| Role | Mandate |
|------|---------|
| **Team of Analysts** | Analyze code architecture, trace data flows, identify structural gaps |
| **QA Testers** | Test edge cases, verify discount math, confirm data persistence |
| **Client Representatives** | Validate user-facing behavior matches real-world retail scenarios |
| **Beta Testers / Current Users** | Report what works today, what breaks in practice, real usage pain |

---

## Key Client Observations (Extracted)

### 1. Supplier vs Client asymmetry
> "The app is more focused on the supplier side of the project... the supplier are bringing in... the client service are taking out... we supply, we buy, the client, we buy out."

> "It is more supplier focused... the supplier focus is backing up the price logic, the box logic and everything. So we want to refer to that and kind of refine and build the client service side."

**Client intent:** The supplier side is complete and working. Use it as the reference pattern to build out the client side to the same level of completeness.

### 2. Client groups with discount percentages
> "The client service, we have groups of clients which is VIP, grocers and public, each with a discount percentage. So we need to make sure those discount percentages are really working correctly and are consistent."

**Client intent:** VIP, Grocers, and Public client groups each have an assigned discount percentage. These must actually WORK — auto-apply at the POS, not just display in the UI.

### 3. Product outflow and price logic
> "When we are selling it right? We are selling it at a time, with the clients and how do products going out right? The price logic, the calculation logic, all the value logic should be taken into account."

**Client intent:** When products leave the store (via sales), the full chain must be correct: price selection → discount application → line total → stock deduction → valuation update. Nothing can be orphaned.

### 4. Deep analysis before implementation
> "We need to look through kind of pretty much everything, the logic how it interacts with the codebase and understand how it really works."

> "This team needs to think between themselves and find a way to improve the code."

**Client intent:** Don't just patch — understand the full flow first, have the team roles cross-examine each other, then make surgical fixes.

### 5. Worker and Master scope
> "Let's say we are under the worker side of the project, let's see if it is under the master side also."

**Client intent:** Verify the client service feature exists in both Worker AND Master dashboards, and works consistently across both.
