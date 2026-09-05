# Multilingual portal

The MVP now opens with a language-selection screen before authentication. Supported languages are:

- English (`en-IN`)
- Hindi (`hi-IN`)
- Marathi (`mr-IN`)

The selection is stored in `localStorage` under `pashu_lang`, so the chosen language persists between sessions. A language switcher is also available in the authenticated portal header and on the login screen.

The MVP uses a local translation dictionary rather than an external translation API. This keeps the demo deterministic, avoids API keys/rate limits, and prevents sensitive livestock-health text from being sent to a third-party translation service. Browser `Intl` locale support can be used for locale-sensitive dates and numbers; the UI language itself is controlled by the portal's selected locale.

For production, move translations into version-controlled locale files and have an authorised translator/veterinary-domain reviewer validate every label, disease name, specimen term, warning, and workflow message before deployment.
