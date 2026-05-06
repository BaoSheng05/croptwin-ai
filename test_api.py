import urllib.request
import json

req = urllib.request.Request("http://localhost:8000/api/ai/execute-safe-command", data=json.dumps({"layer_id":"b_02","device":"pump","value":True,"duration_minutes":2}).encode(), headers={'Content-Type': 'application/json'})
try:
    res = urllib.request.urlopen(req)
    print(res.status, res.read().decode())
except urllib.error.HTTPError as e:
    print(e.code, e.read().decode())
