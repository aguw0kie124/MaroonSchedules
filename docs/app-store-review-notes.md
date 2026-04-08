# App Store Review Follow-Up

## Guideline 5.1.2(i): Tracking

The current app codebase does not include an advertising or attribution SDK that would normally require App Tracking Transparency.
The likely fix is to update the App Privacy section in App Store Connect so it reflects actual app behavior.

Recommended response to App Review:

> MaroonLife does not use data for third-party tracking or advertising on iOS. We have reviewed the app implementation and updated our App Privacy information in App Store Connect to remove tracking disclosures that were inaccurate for this submission.

If you later add real tracking or ad attribution, then you should add ATT before resubmitting that build.

## Guideline 1.5: Support URL

This repo now includes a support page template at `docs/support.html`.

Recommended next step:

1. Publish that page at `https://maroonschedules.tamu.edu/support` or another live support URL you control.
2. Update the Support URL field in App Store Connect to the published page.

Recommended review note:

> We updated the Support URL to a live support page that includes contact information for users: https://maroonschedules.tamu.edu/support
