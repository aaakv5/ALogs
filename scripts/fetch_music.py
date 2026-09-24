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

    tracks_raw = client.artists_tracks(ARTIST_ID)
    tracks = []
    for t in tracks_raw:
        cover = None
        if t.cover_uri:
            cover = "https://" + t.cover_uri.replace('%%', '400x400')
        tracks.append({
            'title': t.title,
            'artists': [a.name for a in t.artists] if t.artists else [],
            'duration': f"{t.duration_ms // 60000}:{(t.duration_ms // 1000) % 60:02d}",
            'cover': cover,
        })

    albums_raw = client.artists_albums(ARTIST_ID)
    albums = []
    for a in albums_raw:
        cover = None
        if a.cover_uri:
            cover = "https://" + a.cover_uri.replace('%%', '400x400')
        albums.append({
            'title': a.title,
            'year': a.year,
            'cover': cover,
        })

    avatar = None
    if artist.cover and artist.cover.uri:
        avatar = "https://" + artist.cover.uri.replace('%%', '400x400')

    data = {
        'name': artist.name,
        'listeners': artist.monthly_listeners,
        'avatar': avatar,
        'tracks': tracks,
        'albums': albums,
    }

    with open('music-data.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print("Готово: music-data.json")


if __name__ == '__main__':
    fetch_and_save()
