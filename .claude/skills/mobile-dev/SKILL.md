---
name: mobile-dev
description: >-
  Development companion for the React Native mobile app. Automatically
  screenshots the connected physical device before and after every code change
  to maintain visual context. Use this skill for ANY mobile development task —
  features, bug fixes, styling, layout, navigation, refactoring visible UI,
  or anything involving the mobile app screens. Even if the user just says
  "fix this" or "change that" and mobile is the context, use this skill.
  Delegates all device interaction to the agent-device skill.
---

# Mobile Dev Companion

This skill wraps every mobile development task with visual feedback from the connected device. Before coding, it screenshots the current state. After coding, it waits for Fast Refresh and screenshots again. This gives you visual confirmation without leaving the terminal.

## Assumptions

The app is already running. The user has already done:

1. `pnpm -F mobile prebuild`
2. `pnpm dev:mobile` (Metro is running)
3. `pnpm -F mobile android` or `pnpm -F mobile ios`

Do NOT attempt to start Metro, prebuild, install, or open the app.

## Session Setup

Before any device interaction, agent-device needs an active session. If there's no session yet (first command of the conversation), run:

```
agent-device open ie.ceolx.app --platform ios --device "iPhone 17 Pro"
```

This does not restart the app — it just binds agent-device to the already-running app process. You only need to do this once per conversation. After that, all agent-device commands work without re-opening.

## Workflow: See → Code → Verify

### Phase 1 — See

Before writing any code, capture the current device state so you understand what the user sees.

1. Ensure an agent-device session is active (open one if not)
2. Take a `screenshot` of the connected device
3. If the task involves specific UI elements (layout, buttons, text), also take a `snapshot` to read the UI tree
4. Briefly describe what you see on screen to confirm shared context with the user

This gives you ground truth — you know exactly what screen the user is on and what the current UI looks like before you touch any code.

### Phase 2 — Code

Make the requested code changes using normal file editing. No special device commands needed here.

Metro Fast Refresh applies changes automatically when files are saved — there is no manual reload step for most changes.

### Phase 3 — Verify

After your code changes are saved:

1. Wait 2-3 seconds for Fast Refresh to apply the changes
2. Take another `screenshot` of the device
3. Compare the before and after visually — did the change take effect?
4. If the change is not reflected or looks wrong:
   - Fix the code
   - Wait again
   - Screenshot again
5. Cap at 3 verification rounds. If the change still isn't working after 3 attempts, ask the user what they see or if there's an error

### Navigation

If the code change affects a screen that isn't currently displayed:

- Use `snapshot -i` to see interactive elements, then navigate to the right screen using `press @ref`
- After navigating, wait for the screen to settle before taking the verify screenshot

### React Native Dev Overlays

In dev builds, warning or error overlays may appear after code changes. Follow the agent-device rules:

- If they don't block the task: dismiss and continue
- If they keep returning or block the task: read the error, fix the code, and report what you saw
- Always mention any overlays you encountered in your response

## Bug Fix Flow

The user often works through a series of bugs in one session. The pattern is:

1. User says something like **"okay there is a bug"** or **"next bug"** — begin the See → Code → Verify loop
2. Work together to investigate and fix the bug
3. User confirms the fix with **"okay it is fixed"**, **"that's fixed"**, **"looks good"**, or similar confirmation

**On confirmation, immediately commit the changes** before moving to the next task:

- Stage only the files modified for this bug fix
- Use commit format: `🐛 fix(mobile): <concise description of what was fixed>`
- Follow all project commit conventions (lowercase subject, valid scope, emoji prefix)
- After a successful commit, acknowledge it briefly and wait for the next task

This keeps each fix as an atomic commit and prevents work from piling up uncommitted.

## When to Skip Device Phases

Not every mobile task needs screenshots. Skip the See/Verify phases for:

- **Non-visual changes:** utility functions, API calls, types, hooks with no UI effect, config files
- **No device connected:** if `devices` returns nothing, just code and tell the user you couldn't verify visually
- **User says so:** if the user says "don't screenshot", "just code", or "skip the device" — respect it

When in doubt about whether a change is visual, lean toward taking the screenshot — it only costs a few seconds and catches surprises.

## Related Skills

- **agent-device** — handles all device commands (screenshot, snapshot, press, fill, wait, scroll, logs, etc.). This skill is already installed and Claude auto-loads it. Refer to it for command syntax and interaction patterns.
- **dogfood** — for systematic QA and bug hunting sessions. Use that skill when the goal is to explore the app for bugs, not to develop features.
- **heroui-native** — for HeroUI Native component library usage and patterns.
- **building-native-ui** — for Expo Router navigation and React Native component patterns.
