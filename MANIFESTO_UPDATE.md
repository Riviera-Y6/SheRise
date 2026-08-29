# We-Rise Manifesto Floating Reader

This build adds the approved We-Rise manifesto as a public, always-accessible floating feature.

## Behaviour
- Floating `Manifesto` button is shown above the bottom navigation.
- Available to guests and authenticated members.
- Opens a scrollable manifesto reader without navigating away from the active feature.
- Responsive mobile bottom-sheet / desktop modal layout.
- Close via X, overlay click, or Escape.
- No backend, Supabase, Render, or SQL changes are required for this feature.

## Files
- `src/components/Manifesto.jsx`
- `src/data/manifesto.js`
- `src/App.jsx`
- `src/index.css`


## Kirsten mobile position fix
- Moved the persistent Manifesto button to the top-right, directly below the app header.
- The button remains fixed and accessible while browsing.
- Removed the <=360px portrait rule that hid the word “Manifesto”.
- The label now stays visible in both portrait and landscape orientations.
