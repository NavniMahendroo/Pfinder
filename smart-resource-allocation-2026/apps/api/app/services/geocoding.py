import httpx


async def geocode_location(query: str) -> tuple[float, float]:
    params = {"q": query, "format": "json", "limit": 1}
    headers = {"User-Agent": "smart-resource-allocation/1.0"}
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get("https://nominatim.openstreetmap.org/search", params=params, headers=headers)
        response.raise_for_status()
        data = response.json()
    if not data:
        return 0.0, 0.0
    return float(data[0]["lat"]), float(data[0]["lon"])
