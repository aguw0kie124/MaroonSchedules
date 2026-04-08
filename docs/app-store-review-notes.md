# App Store Review Follow-Up

## Guideline 5.1.2(i): Tracking

Verified on April 7, 2026: the current app codebase does not include an advertising or attribution SDK that would normally require App Tracking Transparency.
There is no ATT prompt implementation in the app, and there does not appear to be a third-party tracking SDK that would justify adding one just to satisfy review metadata.

The likely fix is to update the App Privacy section in App Store Connect so it reflects actual app behavior for this iOS build.

Recommended response to App Review:

> MaroonLife does not use data for third-party tracking or advertising on iOS. We have reviewed the app implementation and updated our App Privacy information in App Store Connect to remove tracking disclosures that were inaccurate for this submission.

If you later add real tracking or ad attribution, then you should add ATT before resubmitting that build.

## Guideline 1.5: Support URL

This repo includes a support page template at `docs/support.html`, but it still must be published to a live URL and updated with a real monitored support contact before resubmitting.

Required next steps:

1. Replace the placeholder support email in `docs/support.html` with a real monitored inbox.
2. Publish that page at `https://maroonschedules.tamu.edu/support` or another live support URL you control.
3. Update the Support URL field in App Store Connect to the published page.

Recommended review note:

> We updated the Support URL to a live support page that includes contact information for users: https://maroonschedules.tamu.edu/support

## Resubmission Checklist

Before resubmitting in App Store Connect:

1. Remove any inaccurate tracking disclosures from App Privacy if the app is not actually tracking users on iOS.
2. Reply to App Review stating that the privacy metadata was corrected for this submission.
3. Publish the support page to a live public URL.
4. Make sure the published page includes real support contact information.
5. Update the Support URL field to that live page.
