# Authentication — Findings

## Login Endpoint

```
POST https://getmymacros.com/assets/script/login.php
Content-Type: application/x-www-form-urlencoded
```

### Required Parameters
| Param | Required | Notes |
|-------|----------|-------|
| `username` | ✅ | |
| `password` | ✅ | Missing password still returns "password does not match" (not "missing") |
| `action` | ✅ | Must be `"login"` — omitting causes `success:false` |
| `source` | ❌ | Optional. Web UI sends `"mm-web"` but omitting still works |

### Headers
- **No special headers required** — no User-Agent, no Content-Type header needed
- Simple `curl -d` works fine

### Success Response
```json
{
  "success": true,
  "reason": "Login successful",
  "is_coach": false,
  "session_id": "abc123...",
  "email": "user@example.com",
  "fname": "",
  "uname": "username",
  "profile": {
    "fname": "",
    "lname": "",
    "uname": "username",
    "email": "user@example.com"
  }
}
```

### Error Responses
```json
// Wrong username
{"success":false,"reason":"The user account for that username was not found."}

// Wrong password
{"success":false,"ask-reset":true,"reason":"The password you entered does not match."}

// Missing action param
{"success":false}
```

### Invalid/Expired Session (on any API call)
```json
{"success":false,"no_session":true,"reason":"...Code 821..."}
```

The `no_session:true` flag is the key indicator that re-authentication is needed.

---

## Session Behavior

### Multiple Concurrent Sessions
- Each login creates a **new, independent session_id**
- Old sessions are **NOT invalidated** — all remain valid simultaneously
- Browser session + multiple curl sessions can coexist
- Session IDs are 26-character lowercase alphanumeric strings (PHP session IDs)

### Session Expiry
- Sessions auto-expire after ~1 hour of inactivity (user-reported)
- No explicit server-side logout endpoint

### Logout
- **Purely client-side** — the web app just calls `localStorage.clear()` and redirects
- The session_id remains valid server-side even after "logout"
- No `logout.php` or session invalidation API

---

## Auth Flow for Programmatic Access

Minimal working example:
```bash
# Login (store session securely)
SID=$(curl -s 'https://getmymacros.com/assets/script/login.php' \
  -d "username=$MYMACROS_USER&password=$MYMACROS_PASSWORD&action=login" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['session_id'])")

# Use session for any API call
curl -s -X POST 'https://getmymacros.com/assets/script/DM.php' \
  -d "date=02-17-2026&session_id=$SID"
```

### Re-auth Strategy
Since sessions expire after ~1 hour:
- Check for `no_session:true` in any API response
- Re-login automatically when detected
- Store credentials in env vars: `MYMACROS_USER`, `MYMACROS_PASSWORD`

---

## Client security notes

- The service uses HTTPS and form-encoded credentials; protect credentials and session IDs as secrets.
- Session IDs are sent as request form parameters, so do not enable verbose request logging in shared environments.
- This client redacts password and session fields in its debug output and stores sessions in the OS keyring when available.
- Service-side authentication behavior is undocumented and may change. Potential service vulnerabilities should be reported privately to the service owner rather than documented here.
