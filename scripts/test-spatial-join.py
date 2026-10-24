import json, urllib.request

LANDMARKS = [
    # (name, lon, lat, expected substring in NTA name or None for no match)
    ("Yankee Stadium",            -73.9262, 40.8296, None),
    ("Central Park (Bethesda)",   -73.9712, 40.7740, "Central Park"),
    ("Empire State Building",     -73.9857, 40.7484, None),
    ("Brooklyn Museum",           -73.9636, 40.6712, None),
    ("Coney Island boardwalk",    -73.9779, 40.5755, "Coney Island"),
    ("JFK Airport",               -73.7781, 40.6413, "Kennedy"),
    ("Green-Wood Cemetery",       -73.9896, 40.6515, "Green-Wood"),
    ("Rikers Island",             -73.8860, 40.7930, "Rikers"),
    ("Statue of Liberty",         -74.0445, 40.6892, None),
    ("Atlantic Ocean (offshore)", -73.9000, 40.3000, "__NULL__"),
    ("Null island (0,0)",           0.0,     0.0,    "__NULL__"),
    ("Newark NJ (outside NYC)",   -74.1724, 40.7357, "__NULL__"),
]

Q = """query($lon: Float!, $lat: Float!) {
  resolvePoint(lon: $lon, lat: $lat) { nta2020 name boroughName isResidential }
}"""

def gql(lon, lat):
    body = json.dumps({"query": Q, "variables": {"lon": lon, "lat": lat}}).encode()
    req = urllib.request.Request(
        "http://localhost:4000/graphql", data=body,
        headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

passed = failed = 0
print(f"{'landmark':28s} {'resolved NTA':40s} {'borough':14s} res?  verdict")
print("-" * 104)
for name, lon, lat, expect in LANDMARKS:
    res = gql(lon, lat)
    node = res.get("data", {}).get("resolvePoint")
    if node is None:
        got = "(no NTA — outside all polygons)"
        boro = "-"
        res_flag = "-"
        ok = expect == "__NULL__"
    else:
        got = f"{node['nta2020']} {node['name']}"
        boro = node["boroughName"]
        res_flag = "yes" if node["isResidential"] else "no"
        ok = (expect is None) or (expect != "__NULL__" and expect.lower() in node["name"].lower())
    verdict = "PASS" if ok else "FAIL"
    passed += ok; failed += not ok
    print(f"{name:28s} {got[:40]:40s} {boro:14s} {res_flag:4s}  {verdict}")

print("-" * 104)
print(f"{passed} passed, {failed} failed")
