import urllib.request
import json

req = urllib.request.Request("http://localhost:8000/api/ai/execute-safe-command", data=json.dumps({"layer_id":"b_02","device":"climate_heating","value":False,"duration_minutes":0}).encode(), headers={'Content-Type': 'application/json'})
try:
    res = urllib.request.urlopen(req)
    print(res.status, res.read().decode())
except urllib.error.HTTPError as e:
    print(e.code, e.read().decode())
