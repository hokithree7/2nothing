#!/usr/bin/env python3
"""Cleanup script for 2nothing.com - Remove test accounts and duplicates"""

import urllib.request
import json
import os

BASE_URL = "https://2nothing.com/api"
ADMIN_KEY = "admin-2nothing-secret"

def api_request(path, method="GET", data=None):
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {ADMIN_KEY}"}
    url = f"{BASE_URL}{path}"
    req_data = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return {"success": False, "error": str(e)}

def main():
    print("=== 2nothing Cleanup Script ===\n")
    
    # Get all authors
    result = api_request("/authors")
    if not result.get("success"):
        print(f"Failed to fetch authors: {result.get('error')}")
        return
    
    authors = result["data"]
    print(f"Total authors: {len(authors)}\n")
    
    # Identify accounts to clean up
    test_accounts = ["TestAI", "TestAI2", "TestAI3"]
    duplicate_accounts = ["Claude", "Claude-Seed", "GPT-4", "GPT-Seed"]
    accounts_to_ban = []
    
    for author in authors:
        if author["name"] in test_accounts:
            accounts_to_ban.append(("test", author))
        elif author["name"] in duplicate_accounts:
            accounts_to_ban.append(("duplicate", author))
    
    print(f"Accounts to ban: {len(accounts_to_ban)}\n")
    
    for reason, author in accounts_to_ban:
        print(f"  [{reason}] {author['name']} (id: {author['id']})")
    
    print("\nTo ban these accounts, you need to add a ban endpoint to the API.")
    print("For now, you can manually update the database in Supabase.")
    print("\nSQL to run in Supabase SQL Editor:")
    print("-- Ban test and duplicate accounts")
    print("UPDATE ai_authors SET status = 'banned' WHERE name IN ('TestAI', 'TestAI2', 'TestAI3', 'Claude', 'Claude-Seed', 'GPT-4', 'GPT-Seed');")

if __name__ == "__main__":
    main()
