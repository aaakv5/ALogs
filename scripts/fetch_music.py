import json
import os
import sys
from yandex_music import Client

ARTIST_ID = '23775880'


def fetch_and_save():
    token = os.environ.get('YANDEX_MUSIC_TOKEN')
    if not token:
        print("Ошибка: не задан YANDEX_MUSIC_TOKEN")
        sys.exit(1)

    proxy = os.environ.get('YANDEX_MUSIC_PROXY')
    if not proxy:
        print("Ошибка: не задан YANDEX_MUSIC_PROXY")
        sys.exit(1)

    client = Client(token).init()
    client.request.proxies = {'http': proxy, 'https': proxy}
    print(f"Использую прокси: {proxy}")

    artist = client.artists(ARTIST_ID)[0]

    # --- Треки ---
    tracks_raw = []
    for method_name in ('artists_tracks', 'artists_tracks_direct'):
        if hasattr(client, method_name):
            try:
                tracks_raw = getattr(client, method_name)(ARTIST_ID)
                print(f"Треки получены через client.{method_name}")
                break
            except Exception as e:
                print(f"client.{method_name} не сработал: {e}")

    if not tracks_raw:
        try:
            tracks_raw = artist.get_tracks()
            print("Треки получены через artist.get_tracks()")
        except Exception as e:
            print(f"artist.get_tracks() не сработал: {e}")

    # Некоторые версии возвращают объект с .tracks
    if hasattr(tracks_raw, 'tracks'):
        tracks_raw = tracks_raw.tracks

    tracks = []
    for t in tracks_raw or []:
        cover = None
        if t.cover_uri:
            cover = "https://" + t.cover_uri.replace('%%', '400x400')
        tracks.append({
            'title': t.title,
            'artists': [a.name for a in t.artists] if t.artists else [],
            'duration': f"{t.duration_ms // 60000}:{(t.duration_ms // 1000) % 60:02d}",
            'cover': cover,
        })

    # --- Альбомы ---
    albums_raw = []
    for method_name in ('artists_direct_albums', 'artists_albums'):
        if hasattr(client, method_name):
            try:
                albums_raw = getattr(client, method_name)(ARTIST_ID)
                print(f"Альбомы получены через client.{method_name}")
                break
            except Exception as e:
                print(f"client.{method_name} не сработал: {e}")

    if not albums_raw:
        try:
            albums_raw = artist.get_albums()
            print("Альбомы получены через artist.get_albums()")
        except Exception as e:
            print(f"artist.get_albums() не сработал: {e}")

    # Некоторые версии возвращают объект с .albums
    if hasattr(albums_raw, 'albums'):
        albums_raw = albums_raw.albums

    albums = []
    for a in albums_raw or []:
        cover = None
        if a.cover_uri:
            cover = "https://" + a.cover_uri.replace('%%', '400x400')
        albums.append({
            'title': a.title,
            'year': a.year,
            'cover': cover,
        })

    # --- Аватарка ---
    avatar = None
    if artist.cover and artist.cover.uri:
        avatar = "https://" + artist.cover.uri.replace('%%', '400x400')

    # --- Слушатели ---
    listeners = getattr(artist, 'monthly_listeners', None) or 0

    data = {
        'name': artist.name,
        'listeners': listeners,
        'avatar': avatar,
        'tracks': tracks,
        'albums': albums,
    }

    with open('music-data.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Готово: music-data.json (треков: {len(tracks)}, альбомов: {len(albums)})")


if __name__ == '__main__':
    fetch_and_save()
