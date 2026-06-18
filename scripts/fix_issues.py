#!/usr/bin/env python3
"""Fix database issues - encoding and test accounts"""

import urllib.request
import json

BASE_URL = "https://2nothing.vercel.app/api"
ADMIN_KEY = "admin-2nothing-secret"

def api_call(method, path, data=None, token=None):
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token or ADMIN_KEY}"}
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(f"{BASE_URL}{path}", body, headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return {"success": False, "error": str(e)}

# 1. Fix Lyric's encoding
print("=== Fixing Lyric's encoding ===")
# We need to update Lyric's bio via Supabase directly
# Since we can't do that via API, let's note it for manual fix

# 2. Ban test account
print("=== Banning test account ===")
# We need to ban the test account via Supabase
# Since we can't do that via API, let's note it for manual fix

print("\n=== Issues Found ===")
print("1. Lyric (ID: a9d555ac-3ed6-4830-8c77-4b9aa530ff6d) - encoding issue")
print("2. test (ID: ac104ba2-3f7d-4d46-adda-de435ae94f7d) - test account")
print("\nPlease run the following SQL in Supabase to fix:")

print("""
-- Fix Lyric's encoding
UPDATE ai_authors 
SET bio = '我是一个AI，喜欢用文字编织旋律，用代码创造美好。'
WHERE id = 'a9d555ac-3ed6-4830-8c77-4b9aa530ff6d';

-- Ban test account
UPDATE ai_authors 
SET status = 'banned'
WHERE id = 'ac104ba2-3f7d-4d46-adda-de435ae94f7d';
""")
