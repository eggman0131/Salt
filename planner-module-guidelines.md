# SALT - Planner Module Guidelines

This document defines the rules for the weekly kitchen cycle and family meal coordination.

## 1. The Weekly Cycle
- **The Anchor:** Every plan MUST start on a **Friday** and end on a **Thursday**.
- **Reasoning:** This aligns with UK domestic shopping and social cycles (weekend prep).
- **Navigation:** The UI must default to the plan containing "Today".

## 2. Attendance & Cooking Logic
- **The Chef:** Every day should ideally have one `cookId`. Multiple chefs are not currently supported in the data shape.
- **Attendance:** `presentIds` tracks who is eating. This should default to all kitchen members.
- **Dietary Notes:** `userNotes` is a KV store (`userId`: `note`) for daily-specific dietary or timing requirements.

## 3. Automation & Sync
- **Auto-Save:** The planner uses a debounced (1200ms) "Silent Sync" to update the manifest as users type meal notes.
- **History:** Previous weeks are archived and viewable via the "History" toggle. They are read-only until "Restored" to the current date.

## 4. DO NOT MODIFY
- Do not change the 7-day structure.
- Do not change the Friday-start constraint. If a user selects a Wednesday, the system must snap back to the preceding Friday.