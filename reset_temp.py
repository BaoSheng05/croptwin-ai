"""Reset b_01 and b_02 temperatures back to a healthy value by injecting a reading."""
import urllib.request
import json

API = "http://localhost:8000/api/sensors/readings"

for layer_id in ["b_01", "b_02"]:
    payload = {
        "layer_id": layer_id,
        "temperature": 23.5,   # Basil ideal: 21-28 -> mid is 24.5
        "humidity": 50.0,      # Basil ideal: 40-60
        "soil_moisture": 55.0, # Basil ideal: 45-70
        "ph": 6.3,
        "light_intensity": 650.0,
        "water_level": 80.0,
    }
    req = urllib.request.Request(
        API,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    try:
        res = urllib.request.urlopen(req)
        print(f"{layer_id}: reset OK ({res.status})")
    except urllib.error.HTTPError as e:
        print(f"{layer_id}: ERROR {e.code} {e.read().decode()}")
