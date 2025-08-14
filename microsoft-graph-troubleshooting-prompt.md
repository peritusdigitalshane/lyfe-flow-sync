# Microsoft Graph API 403 Error Troubleshooting Prompt

Copy and paste this prompt to an AI assistant for detailed troubleshooting help:

---

**PROMPT:**

I'm experiencing a Microsoft Graph API authentication issue and need detailed troubleshooting steps.

## Current Situation:
- I have a Supabase-based email management application
- Using Microsoft Graph API to access Outlook mailboxes
- Recently added `MailboxSettings.ReadWrite` permission to my Azure app registration
- Getting 403 "ErrorAccessDenied" when calling `/me/outlook/masterCategories` endpoint

## Technical Details:
- **Error**: 403 Forbidden with message "Access is denied. Check credentials and try again."
- **Endpoint**: `https://graph.microsoft.com/v1.0/me/outlook/masterCategories`
- **Current Permissions**: `Mail.ReadWrite`, `MailboxSettings.ReadWrite` (recently added)
- **OAuth Flow**: Using authorization code flow with PKCE
- **Token Storage**: Storing tokens in Supabase database

## Edge Function Log Details:
```
Microsoft Graph API error: 403 {"error":{"code":"ErrorAccessDenied","message":"Access is denied. Check credentials and try again."}}
```

## Questions:
1. Do existing OAuth tokens automatically inherit new permissions added to the Azure app registration?
2. What is the exact process to refresh tokens with updated scopes?
3. Are there any specific requirements for the `MailboxSettings.ReadWrite` permission?
4. Should I be using a different endpoint or API version for accessing Outlook categories?
5. What are the common causes of 403 errors specifically for the masterCategories endpoint?

## What I've Already Tried:
- Added `MailboxSettings.ReadWrite` permission in Azure Portal
- Waited for permission propagation
- Verified the token is being sent correctly in Authorization header

Please provide step-by-step troubleshooting instructions and explain the technical reasons behind each step.