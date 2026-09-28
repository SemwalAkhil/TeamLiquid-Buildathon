# PhoneMail — Requirements Specification

> **Project:** ALPHASTACK 7-Day Buildathon  
> **Product:** PhoneMail  
> **Document:** Software Requirements Specification (SRS)  
> **Status:** Initial Requirement Baseline  
> **Primary Development Priority:** Mobile Client  
> **Backend Requirement:** Node.js or Go  
> **Deployment Requirement:** Docker + Docker Compose

---

# 1. Project Overview

## 1.1 Product Name

**PhoneMail**

## 1.2 Product Description

PhoneMail is an email application in which a user's **phone number acts as their email identity**.

Example:

```text
Phone Number:
9888820532

PhoneMail Address:
9888820532@phonemail.com
````

The application provides two primary interfaces:

1. **Mobile Interface**
2. **Web/Desktop Interface**

The official task requires the mobile client to be prioritized first, followed by the remaining components. 

---

# 2. Problem Statement

Traditional email systems generally require users to remember email addresses and passwords. PhoneMail aims to simplify email identity and access by associating an email identity directly with a user's phone number.

The system must allow users to:

* create an account using their phone number,
* receive a PhoneMail email address,
* send and receive emails,
* access emails through mobile and web interfaces,
* use phone-based authentication,
* and receive SMS notifications when applicable.

---

# 3. Project Objectives

The system shall:

1. Use a phone number as the basis of a user's email identity.
2. Provide a functional email system capable of sending and receiving emails.
3. Provide a mobile-first user experience.
4. Provide a separate web/desktop experience.
5. Support OTP-based authentication where possible.
6. Support IVR/SMS-based account creation.
7. Provide SMS notifications for eligible users.
8. Use a local SMTP implementation for email handling.
9. Provide Dockerized deployment.
10. Allow the entire application to be started using Docker Compose.
11. Follow the supplied design language and interaction requirements.
12. Provide sufficient documentation for setup and usage.

---

# 4. Users

The system primarily targets users who want a simple phone-number-based email experience.

The interface should be designed with accessibility and simplicity in mind, with the rural audience considered during interface and interaction design.

---

# 5. System Interfaces

PhoneMail shall provide the following interfaces:

```text
                    PhoneMail
                        |
        ┌───────────────┼───────────────┐
        |               |               |
      Mobile           Web          IVR / SMS
      Client          Client       Registration
```

## 5.1 Mobile Client

The mobile interface is the **primary development priority**.

The mobile interface shall follow the specified WhatsApp-style design language and conversation-based interaction model. 

## 5.2 Web Client

The web interface shall provide a Gmail-like email experience.

The web client does **not** need to use the mobile chat/conversation interface. 

## 5.3 IVR Interface

The system shall provide an automated IVR mechanism for account creation.

## 5.4 SMS Interface

The system shall support SMS-based account creation and SMS notifications where applicable.

---

# 6. Functional Requirements

# 6.1 Account Creation

The system shall support the following account creation methods.

## 6.1.1 IVR Account Creation

A user shall be able to create a PhoneMail account using a toll-free phone number.

Expected flow:

```text
User calls toll-free number
        ↓
Automated IVR
        ↓
User presses "1"
        ↓
PhoneMail account is created
```

The official task specifies that the user can call a toll-free number and press `1` to create a PhoneMail account through automated IVR. 

---

## 6.1.2 SMS Account Creation

A user shall be able to initiate account creation through SMS.

The implementation may use Twilio or another available SMS gateway/provider.

For trial/free provider limitations, a provider-provided SMS template may be used. 

---

## 6.1.3 Web Registration

The web registration interface shall contain only:

```text
Phone Number
OTP
Next
```

The registration interface is intended specifically for account creation.

After successful account creation, the registration fields shall reset for a new account creation attempt. 

The registration screen shall display:

```text
By signing up, you agree to the Terms of Service
```

where **Terms of Service** is a hyperlink. 

---

# 6.2 PhoneMail Address Generation

Once an account is created, the user's phone number shall be associated with a PhoneMail email identity.

Example:

```text
Phone:
9888820532

Email:
9888820532@phonemail.com
```

The domain shall be configurable rather than hardcoded so that it can be changed through configuration if required.

Suggested configuration:

```env
EMAIL_DOMAIN=phonemail.com
```

---

# 6.3 Authentication

## 6.3.1 OTP Authentication

OTP-based authentication is preferred.

Basic flow:

```text
Phone Number
      ↓
Request OTP
      ↓
OTP delivered
      ↓
OTP verification
      ↓
Authenticated session
```

The buildathon requirements specify OTP-based login as preferred. 

---

## 6.3.2 Password Authentication

If a suitable free OTP provider is unavailable, password-based authentication may be used as the fallback mechanism. 

---

## 6.3.3 OTP Entry

For web interfaces:

* Manual OTP entry shall be supported.
* Automatic OTP detection may be implemented where browser capabilities allow it.

For a native Android application:

* Automatic OTP detection should be implemented if an APK is eventually delivered.

The official requirements specify automatic phone/OTP detection for the mobile client and allow manual OTP entry when automatic detection is unavailable. 

---

# 6.4 Mobile Onboarding

The mobile client shall contain the following onboarding screens.

## Screen 1 — Language Selection

The user selects the application language.

## Screen 2 — Terms & Conditions

The user views/accepts the Terms & Conditions.

## Screen 3 — Phone Number Verification

The user's phone number should be automatically detected and pre-filled where supported.

The user must be able to edit the number if required.

## Screen 4 — OTP Verification

The OTP should be automatically detected and verified where supported.

After successful verification, the user shall be taken to their inbox/home experience. 

---

# 6.5 Device Permissions

The mobile application should request required device permissions at the appropriate onboarding stages.

Potential permissions include:

* phone number/SIM detection,
* SMS/OTP auto-detection,
* contacts access,
* other permissions required by implemented functionality.

The official specification explicitly mentions requesting required permissions at the appropriate onboarding stage. 

---

# 6.6 Mobile Home

The mobile home interface shall follow the supplied WhatsApp-style interaction model.

## Required Components

### Search

A full-width search bar shall appear at the top.

### Filters

Filter chips shall be provided:

```text
All
Unread
Attachments
Favorites
```

### Navigation Menu

A top-left menu shall provide access to:

```text
Home
Drafts
Spam
Trash
```

The mobile Home represents a unified inbox/sent experience rather than separate Inbox and Sent folders. 

### Profile

A top-right profile icon shall provide access to account settings.

Settings may include:

* Alias IDs
* Language
* Personal details
* Profile picture
* Other account settings

---

# 6.7 Mobile Email Organization

Mobile emails shall be organized into **chats/conversations**.

There shall be:

```text
No separate Inbox folder
No separate Sent folder
```

Instead:

```text
Emails
   ↓
Conversations
```

Emails exchanged with the same sender shall remain in the same conversation where applicable. 

---

# 6.8 Mobile Compose

The mobile client shall support two ways of composing an email.

## Method 1 — Traditional Compose

The user shall be able to use a compose button, located as specified by the mobile design.

## Method 2 — Chat Compose

The user shall be able to search for a phone number and start a conversation.

The conversation can then be used to compose/send an email. 

---

# 6.9 Mobile Conversation

Inside a conversation:

* The Subject field shall appear above the message box for a new email.
* Existing emails from the same sender shall be grouped within the same conversation.
* New emails shall display their subject.
* Replies shall be linked to their original email.
* A user shall be able to swipe right on a message to tag/select the original email for reply.
* The Subject field shall be hidden when replying.
* The Subject field shall remain visible for a new email.
* Each message may be replied to only once.
* Long emails shall be openable in a traditional email view. 

---

# 6.10 Traditional Email View on Mobile

Inside a conversation, users shall be able to switch to a traditional email composition/viewing experience.

For a new email:

```text
To
Subject
Body
```

The `To` field shall be pre-filled and locked when composing from a conversation.

To create an email with multiple recipients, the user shall start a new Compose operation from the Home screen. 

---

# 6.11 Multiple Recipients and Group Conversations

When two or more recipients are added using Home-screen Compose:

```text
New email
   ↓
2+ recipients
   ↓
New group conversation
```

Future emails to an individual recipient shall continue to appear in that recipient's existing one-to-one conversation rather than the group conversation. 

---

# 6.12 Email Composition

The application shall support standard email composition fields:

```text
To
CC
BCC
Subject
Body
```

The user shall be able to send the composed email.

---

# 6.13 Email Sending

The system shall provide an email sending pipeline:

```text
Client
   ↓
Backend API
   ↓
Email Service
   ↓
SMTP
   ↓
Recipient
```

The implementation shall use SMTP for email communication.

The buildathon identifies local SMTP as a key technology. 

---

# 6.14 Email Receiving

Incoming emails shall be processed through the local SMTP service.

Expected flow:

```text
Incoming Email
      ↓
SMTP
      ↓
Email Processing
      ↓
Recipient Identification
      ↓
Database
      ↓
User Interface
```

The backend shall identify the recipient based on the PhoneMail email address.

Example:

```text
9888820532@phonemail.com
```

shall map to the corresponding user.

---

# 6.15 Web Client

The web client shall provide a Gmail-like email interface.

Required functionality shall include:

* Login/Signup
* Inbox
* Email viewing
* Compose
* To
* CC
* BCC
* Subject
* Body
* Drafts
* Spam
* Trash
* Search
* Profile
* Settings

The web interface shall not be required to use the mobile conversation/chat-style interface. 

---

# 6.16 SMS Notifications

SMS notifications shall apply to users who do not have the mobile application.

Users may include those who registered through:

* phone call,
* web portal,
* web client.

When an eligible user receives an email, the system shall send an SMS notification.

Required notification information:

```text
You have received an email from <Sender>.
Subject: <Subject>.
```

The exact SMS implementation may use a provider-supported template where trial accounts do not permit custom templates. 

---

# 6.17 IVR

The application shall expose an IVR endpoint/integration.

Minimum required flow:

```text
Incoming Call
      ↓
Automated Greeting
      ↓
"Press 1 to create account"
      ↓
User presses 1
      ↓
Backend creates PhoneMail account
```

Twilio or another available provider may be used.

---

# 6.18 Alias Management

The mobile settings/profile section should support management of alias IDs.

The exact alias-management behavior is not further specified in the supplied requirements and shall therefore be designed during system design without contradicting the documented requirement.

---

# 6.19 Search

The system shall provide search functionality.

Mobile:

```text
Full-width search bar
```

Web:

```text
Gmail-like search
```

Search behavior and supported fields shall be finalized during API/system design.

---

# 7. Non-Functional Requirements

# 7.1 Usability

The system should:

* use simple navigation,
* minimize unnecessary interaction steps,
* present clear actions,
* provide understandable error messages,
* remain usable on smaller screens.

---

# 7.2 Accessibility

The system should consider accessibility during design.

Examples may include:

* readable text sizes,
* sufficient contrast,
* accessible controls,
* clear labels,
* keyboard navigation on web,
* large touch targets,
* understandable error messages.

Accessibility is explicitly listed as a "Good to Have" item. 

---

# 7.3 Responsiveness

The web application shall support different screen sizes.

The design shall provide distinct interfaces for:

```text
Mobile
Desktop/Web
```

while sharing the same backend.

Interface responsiveness is explicitly identified as a desirable feature. 

---

# 7.4 Performance

The application should be designed for users with potentially limited bandwidth and less powerful devices.

The implementation should therefore avoid unnecessary:

* large assets,
* heavy animations,
* excessive network requests,
* unnecessary dependencies.

---

# 7.5 Security

The system should implement appropriate security features.

At minimum, the implementation should consider:

* secure authentication,
* OTP expiration,
* OTP attempt limits,
* password hashing when passwords are used,
* session expiration,
* input validation,
* secure API endpoints,
* environment-based secrets,
* database protection,
* protection against injection attacks,
* safe handling of external-provider credentials.

Security features are explicitly listed as a "Good to Have" requirement. 

---

# 7.6 Reliability

The system should provide graceful handling of:

* invalid OTPs,
* expired OTPs,
* invalid phone numbers,
* failed email delivery,
* SMTP failures,
* database failures,
* third-party provider failures.

---

# 7.7 Maintainability

The system shall use a modular architecture.

Recommended separation:

```text
Frontend
Backend
Database
SMTP
External Communication
Infrastructure
```

Business logic shall not be unnecessarily duplicated between mobile and web interfaces.

---

# 8. Technology Requirements

## 8.1 Backend

Allowed backend technologies:

```text
Node.js
OR
Go
```

The project shall use one primary backend technology. 

---

## 8.2 Email

The project shall use:

```text
SMTP
```

with a local SMTP implementation/environment.

---

## 8.3 Communication

The project may use:

```text
Twilio
```

for:

* OTP,
* IVR,
* SMS.

Other SMS gateways/providers may be used where appropriate.

---

## 8.4 Frontend

The frontend shall provide:

```text
Mobile Interface
+
Desktop/Web Interface
```

The supplied requirements do not mandate a specific frontend framework.

---

## 8.5 Containerization

The entire application shall be Dockerized.

Docker Compose shall be used to run the complete system.

Required command:

```bash
docker compose up -d
```

The application should start successfully using this command.  

---

## 8.6 Version Control

Git shall be used for source-code version control.

Git is explicitly listed among the key technologies. 

---

# 9. Architecture Requirements

The system shall follow a modular architecture similar to:

```text
                        ┌──────────────┐
                        │ Mobile Client│
                        └──────┬───────┘
                               │
                               │
                        ┌──────▼───────┐
                        │              │
                        │  Node.js/Go  │
                        │    Backend   │
                        │              │
                        └───┬──────┬───┘
                            │      │
                    ┌───────┘      └────────┐
                    ▼                       ▼
              ┌──────────┐            ┌──────────┐
              │Database  │            │   SMTP   │
              └──────────┘            └──────────┘
                    ▲                       ▲
                    │                       │
              ┌─────┴─────┐                 │
              │ Web Client│                 │
              └───────────┘                 │
                                            │
                                      Email Network

                        ┌───────────────┐
                        │ Twilio / SMS  │
                        │ / IVR         │
                        └───────┬───────┘
                                │
                                ▼
                           Backend
```

---

# 10. Deployment Requirements

The complete application shall be deployable through Docker Compose.

Expected deployment structure:

```text
Docker Compose
│
├── Frontend
├── Backend
├── Database
└── SMTP
```

External communication services such as Twilio may run outside the Docker environment and communicate through configured APIs/webhooks.

---

# 11. Documentation Requirements

A proper `README.md` shall be provided.

The documentation should include:

1. Project overview
2. Features
3. Technology stack
4. Architecture
5. Prerequisites
6. Environment variables
7. Local setup
8. Docker setup
9. Docker Compose commands
10. Database setup
11. SMTP setup
12. Twilio configuration
13. API documentation
14. Testing instructions
15. Demo instructions
16. Known limitations

Proper documentation is explicitly required by the buildathon specification. 

---

# 12. Priority Classification

## P0 — Mandatory / Core

These features must be implemented before the project can be considered complete.

```text
[ ] Phone-number-based email identity
[ ] Account creation
[ ] Web registration
[ ] Authentication
[ ] OTP or password fallback
[ ] Mobile client
[ ] Web client
[ ] Email compose
[ ] To
[ ] CC
[ ] BCC
[ ] Subject
[ ] Body
[ ] Send email
[ ] Receive email
[ ] Local SMTP
[ ] Mobile conversation system
[ ] Gmail-like web interface
[ ] IVR account creation
[ ] SMS notification
[ ] Docker
[ ] Docker Compose
[ ] README documentation
```

---

# 13. P1 — Important Enhancements

```text
[ ] OTP-based login using external provider
[ ] Search
[ ] Email filters
[ ] Drafts
[ ] Spam
[ ] Trash
[ ] Profile/settings
[ ] Alias management
[ ] Security hardening
[ ] Accessibility improvements
[ ] Responsive behavior
```

---

# 14. P2 — Optional / Stretch Features

The following features are not specified as mandatory in the supplied requirements and should only be attempted after P0 functionality is stable.

```text
[ ] Native Android APK
[ ] Advanced OTP auto-detection
[ ] PWA/offline functionality
[ ] Advanced accessibility features
[ ] Additional integrations
[ ] Additional communication providers
```

The official clarification states that an APK is not required as the primary deliverable, while the later note indicates that delivering one would be beneficial if it can be achieved without compromising the primary implementation.

---

# 15. Assumptions

The following assumptions shall be used unless the organizers provide different instructions.

### A1 — Email Domain

The exact final email domain may be configurable.

Example:

```text
EMAIL_DOMAIN=phonemail.com
```

### A2 — OTP Provider

An OTP provider may be unavailable or restricted during development.

The system must therefore support a password-based fallback.

### A3 — SMS Provider

Trial/free SMS providers may restrict custom message templates.

The implementation should therefore support provider-supported templates.

### A4 — External Services

Twilio and other external services may not always be available during local development.

The system should support mocked/local development modes where practical.

### A5 — Web OTP

Automatic OTP detection cannot be assumed to work in every browser.

Manual OTP entry must therefore remain available.

### A6 — APK

Native Android development is treated as optional unless explicitly required later.

---

# 16. Constraints

The project is being developed within a **7-day buildathon**.

Therefore:

* core functionality takes priority over advanced features,
* mobile development takes priority over desktop/web polish,
* unnecessary architectural complexity shall be avoided,
* third-party dependencies should be minimized where practical,
* all mandatory features must remain operational together,
* Docker Compose must remain the final execution mechanism.

---

# 17. Acceptance Criteria

The following criteria define the minimum working system.

## AC-01 — Account Creation

Given a valid phone number,

when a supported registration flow is completed,

then a PhoneMail account shall be created.

---

## AC-02 — Email Identity

Given a registered phone number:

```text
9888820532
```

the system shall associate it with:

```text
9888820532@phonemail.com
```

---

## AC-03 — Authentication

Given a registered user,

the user shall be able to authenticate using:

```text
Phone Number + OTP
```

or the approved password fallback.

---

## AC-04 — Email Sending

An authenticated user shall be able to compose and send an email using:

```text
To
CC
BCC
Subject
Body
```

---

## AC-05 — Email Receiving

A valid incoming email addressed to a PhoneMail identity shall:

```text
enter SMTP
→ be processed
→ be associated with the correct user
→ be persisted
→ appear in the user's interface
```

---

## AC-06 — Mobile Client

The mobile client shall allow a user to:

```text
Register/Login
→ Open Home
→ Search
→ Open Conversation
→ Compose
→ Send
→ Reply
```

---

## AC-07 — Mobile Conversation Behavior

Emails shall be grouped into conversations according to the specified conversation rules.

---

## AC-08 — Web Client

The web client shall provide a Gmail-like email experience with core email operations.

---

## AC-09 — IVR

A user shall be able to call the configured toll-free/test number and initiate account creation by pressing `1`.

---

## AC-10 — SMS Notification

When an eligible user without the mobile application receives an email, the system shall trigger an SMS notification.

---

## AC-11 — Docker

A clean project checkout shall be able to start the application using:

```bash
docker compose up -d
```

---

## AC-12 — Documentation

A new developer/judge shall be able to understand how to install, configure, start and test the application using the README.

---

# 18. Core End-to-End User Journeys

## Journey 1 — Web Registration

```text
Open Web Portal
      ↓
Enter Phone Number
      ↓
Request/Enter OTP
      ↓
Verify OTP
      ↓
Account Created
      ↓
PhoneMail Address Assigned
```

---

## Journey 2 — Mobile Registration

```text
Language Selection
      ↓
Terms & Conditions
      ↓
Phone Verification
      ↓
OTP Verification
      ↓
Home
```

---

## Journey 3 — Send Email

```text
Login
 ↓
Compose
 ↓
Enter Recipient
 ↓
Subject + Body
 ↓
Send
 ↓
SMTP
 ↓
Recipient
```

---

## Journey 4 — Receive Email

```text
Sender
 ↓
Recipient@phonemail.com
 ↓
SMTP
 ↓
Backend
 ↓
Database
 ↓
Mobile/Web Client
```

---

## Journey 5 — IVR Registration

```text
Call Toll-Free Number
 ↓
IVR
 ↓
Press 1
 ↓
Backend
 ↓
Account Created
```

---

## Journey 6 — SMS Notification

```text
Email Received
 ↓
Identify User
 ↓
Check Mobile-App Availability
 ↓
No Mobile App
 ↓
Send SMS Notification
```

---

# 19. Definition of Done

A feature shall be considered complete only when:

```text
[ ] Implementation completed
[ ] Backend/API integrated
[ ] Database interaction verified
[ ] UI connected
[ ] Error handling implemented
[ ] Tests written where applicable
[ ] Browser/device behavior verified where applicable
[ ] Docker environment verified
[ ] Documentation updated
[ ] No unrelated functionality is broken
```

---

# 20. Development Principle

The project shall be developed incrementally using vertical slices.

The first complete vertical slice should be:

```text
Registration
     ↓
Authentication
     ↓
Compose
     ↓
Send
     ↓
SMTP
     ↓
Receive
     ↓
View Email
```

Only after this core flow works should additional features such as IVR, SMS, advanced settings, accessibility enhancements and optional APK development be prioritized.

---

# 21. Final Requirement Baseline

The following are the primary project requirements:

```text
PHONE NUMBER
     ↓
PhoneMail ID
     ↓
Authentication
     ↓
Mobile + Web Access
     ↓
Send / Receive Email
     ↓
SMTP
     ↓
IVR / SMS
     ↓
Dockerized Application
```

The system must ultimately provide a complete, integrated application rather than independent feature demonstrations.

