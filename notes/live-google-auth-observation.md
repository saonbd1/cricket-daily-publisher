# Live Google Authentication Observation

Source URL: https://accounts.google.com/v3/signin/accountchooser?client_id=152762050604-r1ou1il3iri6a1bar4sqhel8hhro1i4p.apps.googleusercontent.com&redirect_uri=https%3A%2F%2Fcricket-daily-publisher.vercel.app%2Fapi%2Fgoogle%2Fcallback

Observed page: Google account chooser for `cricket-daily-publisher.vercel.app`, not Manus OAuth. It showed the accounts `classicbd616@gmail.com` and `arahamin17@gmail.com` (the latter marked signed out), plus “Use another account.”

The production start endpoint previously returned HTTP 302 to Google and set `__Host-google_oauth_state`. The reported HTTP 400 likely occurs only after selecting an account and reaching the callback; the browser snapshot currently does not show that callback error page, so the exact callback query/error still needs capture.
