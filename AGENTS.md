# PhoneMail - AI Development Rules

## Project

PhoneMail is a phone-number-based email application.

Example:

9888820532@phonemail.com

The official project requirements are documented in:

Documentations/requirements.md

This file is the primary source of project requirements.

---

## Development Method

Follow an SDLC-based incremental development process:

1. Requirement Analysis
2. System Design
3. Database Design
4. API Design
5. Implementation
6. Testing
7. Integration
8. Deployment
9. Documentation

Do not skip directly from requirements to full implementation.

---

## Core Principles

- Read and follow Documentations/requirements.md before implementing features.
- Do not invent requirements that contradict the specification.
- Do not remove required functionality.
- Do not change the architecture without documenting the reason.
- Prefer simple architecture suitable for a 7-day buildathon.
- Avoid unnecessary microservices and unnecessary dependencies.
- Implement features incrementally.
- Test each feature before moving to the next major feature.
- Do not modify unrelated features while implementing a task.
- Never hardcode secrets or credentials.
- Use environment variables for sensitive configuration.
- Keep development and production configuration separate where practical.
- Keep the application runnable through Docker Compose.

---

## Priority

Implementation priority:

1. Core email functionality
2. Mobile client
3. Web client
4. SMTP
5. Authentication
6. IVR / SMS integration
7. Security
8. Accessibility
9. Optional features

The mobile experience is prioritized according to the official task.

---

## Technology

The technology stack must be finalized during system design.

Backend must use:
- Node.js OR Go

The project must include:
- Local SMTP
- Docker
- Docker Compose
- Git

Frontend must provide:
- Mobile interface
- Desktop/Web interface

---

## Mobile UI

Mobile should follow the specified WhatsApp-style interaction model.

Mobile email organization:
- conversations instead of separate Inbox/Sent
- search
- filters
- compose
- reply
- settings

---

## Web UI

Web should follow the specified Gmail-like interface.

Do not simply stretch the mobile interface into desktop dimensions.

---

## External Services

External services such as Twilio must be isolated behind service modules.

The application should support mocked/local development wherever practical so that development does not depend completely on external providers.

---

## Docker

The final application must work using:

docker compose up -d

A clean checkout should be able to start the complete application after environment configuration.

---

## Testing

Every major feature must be tested.

UI changes should be verified in a browser.

Backend changes should include appropriate automated tests.

End-to-end flows must eventually be tested.

---

## Documentation

Update documentation when architecture, APIs, database schema, setup, or major behavior changes.

Documentation should remain understandable to another developer or hackathon judge.

---

## Important Rule

Before implementing any major feature:

1. Read the relevant requirements.
2. Explain the implementation plan.
3. Identify files that will change.
4. Implement.
5. Test.
6. Verify.
7. Report the result.

Do not silently make major architectural decisions.