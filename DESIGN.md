---
version: alpha
name: Yavqo Account
description: Spacious account settings inspired by the supplied Meta account reference.
colors:
  background: "#ffffff"
  foreground: "#172126"
  muted: "#607080"
  soft: "#f1f4f7"
  border: "#e1e5e9"
  primary: "#0064e0"
typography:
  sans:
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
  mono:
    fontFamily: "ui-monospace, monospace"
rounded:
  navigation: "28px"
spacing:
  content: "680px"
  header: "72px"
---

# Yavqo Account design

## Overview

Product settings for existing Yavqo users. The user's September 21 Meta
account screenshot is the visual reference: white canvas, text navigation,
one pale selected pill, a vertical divider, and generous content whitespace.
Retain Yavqo identity and real account destinations. English interface;
desktop and mobile. No new market-specific behavior is implied.

## Colors

Runtime ownership lives in the account-scoped variables in
src/app/globals.css. This document mirrors those values. Existing dark
utility classes are adapted inside .account-shell so shared forms receive
the same light palette. Login and 404 use this same light palette as public account pages; standalone OAuth
consent shares the account palette without navigation chrome.
Blue identifies actions; green, amber, and red remain semantic feedback.

## Typography

System sans serif: 28px/600 page headings, 17px navigation, 14–16px supporting
text and forms. Technical values keep their existing monospace treatment.

## Layout

72px header, sidebar up to 425px, 680px content measure. Document scrolling
owns long pages. Below 768px a native details disclosure replaces the sidebar.
The overview uses a profile header and divided settings rows.

OAuth consent follows the supplied Meta login reference: a top-aligned
560px column, 24px outer gutters, back control, 25px heading, outlined
account identity, plain permission list, and full-width blue pill action.
The invalid-request state uses the same layout and a safe account-home link.

Account switching uses the September 21 account chooser reference: centered
brand, narrow 560px column, outlined identity rows with avatars and masked
email, a pale add-account pill, and a quiet footer. It shares the account
palette and typography.

## Elevation & Depth

Use whitespace and fine borders. No shadows on navigation or overview rows.

## Shapes

Pill-shaped selected navigation and primary actions. Existing rounded form
panels retain their geometry; avatars remain circular.

## Components

AccountShell owns chrome and theme scope; AccountNav owns route labels and
selection; MobileNav reuses AccountNav in a native disclosure. Keep all
existing form handlers, pending states, and database operations intact.
Links and controls receive visible focus rings; disabled controls retain
their disabled semantics. Reduced-motion preferences suppress animations.
Global scrollbar styling supplies visible thumb and interaction states.

## Do's and Don'ts

- Use the shared shell for account routes.
- Preserve real destinations, user data, and existing save behavior.
- Avoid colorful navigation badges, decorative gradients in chrome, and fake controls.
- Leave functional and browser testing to the user per their request.
