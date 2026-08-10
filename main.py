from fastapi import FastAPI, HTTPException
import httpx

app = FastAPI(title="Rust Tracker Backend")

# ⚠️ Aquí deberás poner tu API Key real de Steam
STEAM_API_KEY = "2463D354F7CA49ECF8A24DB765C81A33"
RUST_APP_ID = 252490

@app.get("/api/rust-stats/{steam_id}")
async def get_rust_stats(steam_id: str):
    url = "http://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v0002/"
    params = {
        "appid": RUST_APP_ID,
        "key": STEAM_API_KEY,
        "steamid": steam_id
    }

    # Hacemos la petición a Steam de forma asíncrona
    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params)

    # Manejo del muro de privacidad de Steam
    if response.status_code == 403 or response.status_code == 400:
        raise HTTPException(
            status_code=403, 
            detail="Perfil privado o SteamID inválido. No se pueden leer las estadísticas."
        )
    elif response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code, 
            detail="Error al conectar con los servidores de Steam."
        )

    data = response.json()
    
    # Steam devuelve una lista plana de diccionarios, la convertimos para buscar más fácil
    stats_list = data.get("playerstats", {}).get("stats", [])
    stats_dict = {stat["name"]: stat["value"] for stat in stats_list}

    # Extraemos los datos clave para Rust
    kills = stats_dict.get("kill_player", 0)
    deaths = stats_dict.get("deaths", 0)
    headshots = stats_dict.get("headshot", 0)
    bullets_fired = stats_dict.get("bullet_fired", 0)
    bullets_hit = stats_dict.get("bullet_hit_player", 0)
    
    # Cálculos adicionales
    kda = round(kills / deaths, 2) if deaths > 0 else kills
    accuracy = round((bullets_hit / bullets_fired) * 100, 2) if bullets_fired > 0 else 0

    return {
        "steam_id": steam_id,
        "kills": kills,
        "deaths": deaths,
        "kda": kda,
        "headshots": headshots,
        "accuracy_percent": accuracy
    }