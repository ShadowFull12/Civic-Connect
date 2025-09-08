# **App Name**: Civic Connect

## Core Features:

- User Authentication: Secure sign-up/login using email/password, phone (OTP), or Google account.
- Issue Reporting: Report civic issues by uploading a photo, adding a description (with optional voice input using the Web Speech API), and automatic location tagging using the MapTiler API (API key: lzZb3ygVJBpZSlkEQ2fv).
- Real-Time Map View: Display reported issues on a map using MapTiler API (API key: lzZb3ygVJBpZSlkEQ2fv), with markers indicating issue locations and filtering options by category and status.
- My Reports: Allow users to view a list of their submitted issues and track status updates (pending, acknowledged, in-progress, resolved).
- Admin Dashboard: Provide an admin interface to manage reported issues, update statuses, assign issues to departments, and view analytics on issue trends.
- Auto-Routing: Use a Firebase Function tool to analyze reported issues and automatically route them to the correct department based on issue category and location.
- Analytics Dashboard: Display data visualizations of key metrics like the number of issues by category and response time using Firebase and Chart.js/Recharts.

## Style Guidelines:

- Primary color: Teal (#008080) for trust and civic responsibility.
- Background color: Light teal (#E0F8F8), subtly tinted and heavily desaturated.
- Accent color: Yellow-gold (#B8860B) for highlights and calls to action; creates contrast while remaining analogous to teal.
- Body and headline font: 'PT Sans', a humanist sans-serif that is suitable for both headlines and body text. Note: currently only Google Fonts are supported.
- Use clean, minimalist icons to represent issue categories and status updates.
- Mobile-first design with a clear and intuitive layout for easy navigation and issue reporting.
- Subtle animations and transitions to enhance user experience and provide feedback.