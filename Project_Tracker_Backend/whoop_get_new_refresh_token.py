#!/usr/bin/env python3
"""
Whoop API - Get New Refresh Token via OAuth Flow

This script helps you get a completely new refresh token when:
- Your current refresh token has expired
- Your refresh token has been revoked
- You're setting up the API for the first time

Usage:
1. Run this script to get the authorization URL
2. Visit the URL in an Incognito window and authorize the app
3. Copy the authorization code from the redirect URL
4. Edit this file and paste the code into the AUTH_CODE variable (line ~45)
5. Run the script again to exchange the code for a refresh token

⚠️ Important: Authorization codes expire in 5 minutes!
"""

import os
import requests
from dotenv import load_dotenv, set_key

# Load environment variables
ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
load_dotenv(ENV_PATH)

# --- CONFIGURATION ---
CLIENT_ID = "a219c4fd-6404-4ecc-9ccc-fb3831854cdb"
CLIENT_SECRET = "8a188cd76b5169785867d8d6c856b03b2f74b5997192fe7a0d856ef0fff5f3ae"
REDIRECT_URI = "https://www.samarthkumbla.com"

# Whoop OAuth endpoints
TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token"

# Full authorization URL with all required scopes
AUTHORIZATION_URL = (
    "https://api.prod.whoop.com/oauth/oauth2/auth?"
    "response_type=code&"
    f"client_id={CLIENT_ID}&"
    f"redirect_uri={REDIRECT_URI}&"
    "scope=read:recovery read:cycles read:workout read:sleep read:profile read:body_measurement offline&"
    "state=refresh_token_manual_fix"
)

# 🔴 PASTE YOUR CODE FROM STEP 2 HERE (or leave empty to enter interactively):
# ⚠️ Auth codes can only be used ONCE! Clear this after each use.
AUTH_CODE = ""


def get_permanent_token(code):
    """Exchange authorization code for access token and refresh token"""
    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "redirect_uri": REDIRECT_URI
    }
    
    try:
        response = requests.post(TOKEN_URL, data=payload, timeout=30)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"❌ Error: {e}")
        try:
            print(f"Server Response: {response.text}")
        except:
            pass
        return None


def extract_auth_code_from_url(url):
    """Extract authorization code from a full redirect URL"""
    if not url:
        return None
    
    # Look for 'code=' in the URL
    if 'code=' not in url:
        return None
    
    # Find the start of the code parameter
    code_start = url.find('code=') + len('code=')
    
    # Find the end of the code (either at '&' or end of string)
    code_end = url.find('&', code_start)
    if code_end == -1:
        code_end = len(url)
    
    # Extract the code
    auth_code = url[code_start:code_end]
    return auth_code if auth_code else None


def save_tokens(token_data):
    """Save tokens to .env file"""
    if not token_data:
        return False
    
    access_token = token_data.get('access_token')
    refresh_token = token_data.get('refresh_token')
    
    if not refresh_token:
        print("❌ No refresh token in response!")
        return False
    
    try:
        if os.path.exists(ENV_PATH):
            if access_token:
                set_key(ENV_PATH, 'WHOOP_ACCESS_TOKEN', access_token)
            set_key(ENV_PATH, 'WHOOP_REFRESH_TOKEN', refresh_token)
            print(f"✅ Tokens saved to {ENV_PATH}")
            return True
        else:
            print(f"⚠️  .env file not found at {ENV_PATH}")
            return False
    except Exception as e:
        print(f"❌ Error saving tokens: {e}")
        return False


def main():
    global AUTH_CODE
    
    print("=" * 70)
    print("Whoop API - Get New Refresh Token")
    print("=" * 70)
    print()
    
    # Step 1: Show authorization URL
    print("📋 STEP 1: Open an Incognito window and visit this URL:")
    print()
    print(AUTHORIZATION_URL)
    print()
    print("📋 STEP 2: Log in with your Whoop credentials and authorize the app.")
    print()
    print("📋 STEP 3: After authorizing, you'll be redirected to:")
    print(f"   {REDIRECT_URI}/?code=LONG_STRING_OF_CHARACTERS&state=...")
    print()
    print("   You can paste the entire URL or just the code value")
    print()
    
    # Step 3: Get authorization code
    auth_code = AUTH_CODE
    if not auth_code or (isinstance(auth_code, str) and "PASTE" in auth_code):
        user_input = input("🔑 Enter the full redirect URL or just the authorization code: ").strip()
        if not user_input:
            print("⚠️  No code provided. Exiting.")
            return
        
        # Try to extract code from URL, otherwise use input as-is
        extracted_code = extract_auth_code_from_url(user_input)
        if extracted_code:
            auth_code = extracted_code
            print(f"✅ Extracted authorization code from URL")
        else:
            # If no 'code=' found, assume it's just the code itself
            auth_code = user_input
    
    print()
    print("--- EXCHANGING CODE FOR TOKEN ---")
    token_data = get_permanent_token(auth_code)
    
    if not token_data:
        print("❌ Failed. Code may have expired.")
        print()
        print("Common issues:")
        print("  - Authorization code expired (codes are valid for only 5 minutes)")
        print("  - Code was already used (each code can only be used once)")
        print("  - Redirect URI doesn't match Whoop app settings")
        return
    
    # Step 4: Display and save tokens
    refresh_token = token_data.get('refresh_token')
    
    if refresh_token:
        print()
        print("✅ SUCCESS! NEW REFRESH TOKEN:")
        print("=" * 70)
        print(refresh_token)
        print("=" * 70)
        print()
        
        # Try to save tokens
        saved = save_tokens(token_data)
        
        print()
        print("📋 STEP 5: Save & Update")
        if saved:
            print("   ✅ Token automatically saved to .env file!")
        else:
            print("   ⚠️  Could not save automatically. Please update manually:")
            print(f'   WHOOP_REFRESH_TOKEN="{refresh_token}"')
        
        print()
        print("📋 STEP 6: Restart your dashboard/backend application.")
        print()
        print("   If in production (Railway), update WHOOP_REFRESH_TOKEN in Railway dashboard.")
    else:
        print("❌ Failed. Code may have expired.")


if __name__ == '__main__':
    main()
