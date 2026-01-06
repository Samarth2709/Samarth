# How to Regenerate a Whoop Refresh Token

**Purpose:** Use this guide when your refresh_token has expired, been revoked, or is returning `invalid_grant` errors. This process requires a manual "handshake" in the browser to establish a new persistent connection.

## Prerequisites

Ensure you have your App Credentials ready (from the Whoop Developer Dashboard):

- **Client ID:** `a219c4fd-6404-4ecc-9ccc-fb3831854cdb`
- **Client Secret:** `8a188cd76b5169785867d8d6c856b03b2f74b5997192fe7a0d856ef0fff5f3ae`
- **Redirect URI:** `https://www.samarthkumbla.com` (Must match your app settings exactly)

## Step 1: Generate the Authorization Code

You must log in manually to grant permission to your app again.

1. **Open an Incognito window**

2. **Copy and paste this exact URL into the address bar:**

   ```
   https://api.prod.whoop.com/oauth/oauth2/auth?response_type=code&client_id=a219c4fd-6404-4ecc-9ccc-fb3831854cdb&redirect_uri=https://www.samarthkumbla.com&scope=read:recovery read:cycles read:workout read:sleep read:profile read:body_measurement offline&state=refresh_token_manual_fix
   ```

3. **Log In:** Enter your Whoop username and password.

4. **Authorize:** Click "Authorize" if prompted.

## Step 2: Extract the Code

After authorizing, Whoop will redirect you to your website (samarthkumbla.com). The page might be blank or show your homepage—this is normal.

1. **Look at the URL bar in your browser.**

2. **It will look like this:**
   ```
   https://www.samarthkumbla.com/?code=LONG_STRING_OF_CHARACTERS&state=...
   ```

3. **Copy the text between `code=` and `&`.**

   **Example:** If URL is `...com/?code=AbCdEfGh&state=...`, copy `AbCdEfGh`.

## Step 3: Exchange Code for Token (Python Script)

⚠️ **Important:** The code from Step 2 is valid for only 5 minutes. You must run this script immediately.

1. **Create a file named `get_refresh_token.py`.**

2. **Paste the code below.**

3. **Paste your browser code into the `AUTH_CODE` variable.**

```python
import requests

# --- CONFIGURATION ---
CLIENT_ID = "a219c4fd-6404-4ecc-9ccc-fb3831854cdb"
CLIENT_SECRET = "8a188cd76b5169785867d8d6c856b03b2f74b5997192fe7a0d856ef0fff5f3ae"

# 🔴 PASTE YOUR CODE FROM STEP 2 HERE:
AUTH_CODE = "PASTE_YOUR_COPIED_CODE_HERE" 

def get_permanent_token(code):
    url = "https://api.prod.whoop.com/oauth/oauth2/token"
    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "redirect_uri": "https://www.samarthkumbla.com"
    }
    
    try:
        response = requests.post(url, data=payload)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"❌ Error: {e}")
        try:
            print(f"Server Response: {response.text}")
        except:
            pass
        return None

if __name__ == "__main__":
    if not AUTH_CODE or "PASTE" in AUTH_CODE:
        print("⚠️  STOP: You must paste the code from the browser into the script first.")
    else:
        print("--- EXCHANGING CODE FOR TOKEN ---")
        data = get_permanent_token(AUTH_CODE)
        
        if data and 'refresh_token' in data:
            print("\n✅ SUCCESS! NEW REFRESH TOKEN:")
            print("==================================================")
            print(data['refresh_token'])
            print("==================================================")
        else:
            print("❌ Failed. Code may have expired.")
```

## Step 4: Save & Update

1. **Copy the Refresh Token** output by the script (it starts with a long random string).

2. **Open your `.env` file.**

3. **Update the `WHOOP_REFRESH_TOKEN` variable:**
   ```env
   WHOOP_REFRESH_TOKEN="<paste_new_token_here>"
   ```

4. **Restart your dashboard/backend application.**
