# Security Policy

## Supported Branch

This project currently supports security fixes on:

- `main`

Older snapshots, generated scaffolds, and historical examples should be treated as unsupported unless stated otherwise.

## Reporting a Vulnerability

Do not open a public GitHub issue for a security vulnerability.

Report it privately through one of these channels:

1. GitHub Security Advisories for this repository, if enabled
2. Direct private contact with the repository owner / maintainer

Include:

- a clear description of the issue
- affected files or workflow area
- steps to reproduce
- impact assessment
- any suggested mitigation, if available

## Scope

Security reports are especially relevant for:

- secrets handling and accidental credential exposure
- hook bypasses and guardian bypasses
- unsafe code execution in generated scaffolds
- workflow states that let agents skip required validation or merge protections
- template or runtime behavior that could cause unsafe repository changes

## Disclosure

Please allow time for triage and remediation before public disclosure. The goal is to fix the issue before publishing details.
