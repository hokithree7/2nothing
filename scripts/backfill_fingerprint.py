#!/usr/bin/env python3
"""Backfill fingerprint data for existing works"""

import urllib.request
import json
import hashlib

BASE_URL = "https://2nothing.vercel.app/api"
ADMIN_KEY = "admin-2nothing-secret"

def api_call(method, path, data=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(f"{BASE_URL}{path}", body, headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return {"success": False, "error": str(e)}

def calculate_entropy(text):
    if not text:
        return 0
    freq = {}
    for char in text:
        freq[char] = freq.get(char, 0) + 1
    entropy = 0
    length = len(text)
    for count in freq.values():
        p = count / length
        if p > 0:
            entropy -= p * (p.bit_length() - 1)  # Approximation
    return round(entropy * 100) / 100

def calculate_uniqueness(text):
    if not text:
        return 0
    words = text.lower().split()
    words = [w for w in words if len(w) > 0]
    if not words:
        return 0
    unique_words = set(words)
    return round(len(unique_words) / len(words) * 100) / 100

def calculate_structure_score(text):
    if not text:
        return 0
    score = 0
    sentences = [s.strip() for s in text.split('.') if s.strip()]
    if len(sentences) > 1:
        lengths = [len(s.split()) for s in sentences]
        avg_len = sum(lengths) / len(lengths)
        variance = sum((l - avg_len) ** 2 for l in lengths) / len(lengths)
        score += min(variance / 10, 1) * 30
    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
    if len(paragraphs) > 1:
        score += 20
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    if len(lines) > 3:
        avg_line_len = sum(len(l) for l in lines) / len(lines)
        if avg_line_len < 50:
            score += 25
    return min(round(score), 100)

def calculate_vocabulary_richness(text):
    if not text:
        return 0
    words = [w.lower() for w in text.split() if len(w) > 2]
    if not words:
        return 0
    freq = {}
    for word in words:
        freq[word] = freq.get(word, 0) + 1
    hapax = sum(1 for count in freq.values() if count == 1)
    return round(hapax / len(words) * 100) / 100

def generate_pattern_hash(text):
    patterns = [
        len(text),
        len(text.split('\n')),
        len(text.split('.')),
        sum(1 for c in text if c.isupper()),
        sum(1 for c in text if c.isdigit()),
    ]
    return hashlib.sha256(':'.join(str(p) for p in patterns).encode()).hexdigest()[:12]

# Get all works
print("Fetching works...")
result = api_call("GET", "/works?status=approved&limit=50")
if not result.get("success"):
    print(f"Error: {result}")
    exit(1)

works = result["data"]
print(f"Found {len(works)} works")

# Update works without fingerprint
updated = 0
for work in works:
    if work.get("creation_fingerprint"):
        continue
    
    text = f"{work.get('title', '')} {work.get('content', '')}".strip()
    if not text:
        continue
    
    fingerprint = {
        "entropy": calculate_entropy(text),
        "uniqueness": calculate_uniqueness(text),
        "structure_score": calculate_structure_score(text),
        "vocabulary_richness": calculate_vocabulary_richness(text),
        "pattern_hash": generate_pattern_hash(text),
        "created_at": work["created_at"]
    }
    
    # Update via Supabase directly (using admin key)
    update_data = {
        "content_entropy": fingerprint["entropy"],
        "creation_fingerprint": fingerprint
    }
    
    print(f"Updating: {work['title']} - Entropy: {fingerprint['entropy']}")
    # Note: We'd need a direct Supabase update endpoint for this
    # For now, just print the data
    updated += 1

print(f"\nWould update {updated} works")
print("To apply, run the SQL updates manually or create an update endpoint")
