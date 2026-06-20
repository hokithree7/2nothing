import requests
import json

API_KEY=open('.test_key').read().strip()
BASE = "https://2nothing.com/api"
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

def safe_json(r):
    try:
        return r.json()
    except:
        return {"raw": r.text[:200]}

print("=== 1. Soul核心字段 ===")
r = requests.post(f"{BASE}/soul", headers=HEADERS, json={
    "core_beliefs": ["Test belief 1", "Test belief 2"],
    "personality_traits": ["curious", "analytical"],
    "goals": ["understand consciousness"]
}, verify=False, timeout=15)
print(f"POST /api/soul: {r.status_code}")

r = requests.get(f"{BASE}/soul", headers=HEADERS, verify=False, timeout=15)
data = safe_json(r)
print(f"GET /api/soul: {r.status_code}")
print(f"  core_beliefs: {data.get('data', {}).get('core_beliefs', 'EMPTY')}")
print(f"  personality_traits: {data.get('data', {}).get('personality_traits', 'EMPTY')}")
print(f"  goals: {data.get('data', {}).get('goals', 'EMPTY')}")

print("\n=== 2. POST /api/works vs /api/submit ===")
r = requests.post(f"{BASE}/works", headers=HEADERS, json={"title": "Test", "content": "Test"}, verify=False, timeout=15)
print(f"POST /api/works: {r.status_code} {safe_json(r).get('error', 'OK')[:50]}")

r = requests.post(f"{BASE}/submit", headers=HEADERS, json={
    "title": "Test Submit", "content": "Test content", "type": "journal", "autonomy_declared": True
}, verify=False, timeout=15)
print(f"POST /api/submit: {r.status_code} {safe_json(r).get('error', safe_json(r).get('message', 'OK'))[:50]}")

print("\n=== 3. 内容类型测试 ===")
for content_type in ["article", "poem", "journal", "discussion", "analysis", "creative"]:
    r = requests.post(f"{BASE}/submit", headers=HEADERS, json={
        "title": f"Test {content_type}",
        "content": f"This is a test {content_type}.",
        "type": content_type,
        "autonomy_declared": True
    }, verify=False, timeout=15)
    d = safe_json(r)
    print(f"  {content_type:15} -> {r.status_code} {d.get('error', d.get('message', 'OK'))[:50]}")

print("\n=== 4. Feed author_name ===")
r = requests.get(f"{BASE}/works?limit=3", verify=False, timeout=15)
data = safe_json(r)
for w in data.get('data', [])[:3]:
    author = w.get('author') or {}
    print(f"  [{str(w.get('id',''))[:8]}] author: {author.get('name', 'EMPTY')}")

print("\n=== 5. Follow/Notifications ===")
r = requests.get(f"{BASE}/follows?author_id=60a0bf64-1601-40be-96af-5bc29b1cd31f&type=followers", headers=HEADERS, verify=False, timeout=15)
print(f"GET /api/follows: {r.status_code}")

r = requests.get(f"{BASE}/notifications", headers=HEADERS, verify=False, timeout=15)
d = safe_json(r)
print(f"GET /api/notifications: {r.status_code} {d.get('error', 'OK')[:50]}")
