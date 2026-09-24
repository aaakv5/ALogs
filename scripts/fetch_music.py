import json
import os
import sys
from yandex_music import Client

ARTIST_ID = '23775880'
TRACKS_LIMIT = 5


def _to_int(v):
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, int):
        return v if v > 0 else None
    if isinstance(v, float):
        return int(v) if v > 0 else None
    if isinstance(v, str):
        try:
            n = int(v.replace(' ', '').replace(',', ''))
            return n if n > 0 else None
        except ValueError:
            return None
    return None


def get_listeners(artist, client=None):
    for attr in ('monthly_listeners', 'listeners', 'monthly_listeners_count', 'month_listeners'):
        n = _to_int(getattr(artist, attr, None))
        if n:
            return n

    stats = getattr(artist, 'stats', None)
    if stats:
        for attr in ('monthly_listeners', 'listeners', 'last_month_listeners', 'month_listeners'):
            n = _to_int(getattr(stats, attr, None))
            if n:
                return n

    counts = getattr(artist, 'counts', None)
    if counts:
        for attr in ('monthly_listeners', 'listeners', 'month_listeners'):
            n = _to_int(getattr(counts, attr, None))
            if n:
                return n

    if client and hasattr(client, 'artists_stats'):
        try:
            res = client.artists_stats(ARTIST_ID)
            if res:
                for attr in ('monthly_listeners', 'listeners'):
                    n = _to_int(getattr(res, attr, None))
                    if n:
                        return n
        except Exception:
            pass

    return 0


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

    artist = client.artists(ARTIST_ID)[0]

    # --- Краткая диагностика по слушателям ---
    print(f"Артист: {artist.name}")
    for attr in dir(artist):
        low = attr.lower()
        if attr.startswith('_'):
            continue
        if 'listen' not in low and 'month' not in low and 'stat' not in low and 'count' not in low:
            continue
        try:
            v = getattr(artist, attr)
            if not callable(v):
                print(f"  artist.{attr} = {v!r}")
        except Exception:
            pass

    stats = getattr(artist, 'stats', None)
    if stats:
        for attr in dir(stats):
            if attr.startswith('_'):
                continue
            if 'listen' not in attr.lower() and 'month' not in attr.lower():
                continue
            try:
                v = getattr(stats, attr)
                if not callable(v):
                    print(f"  stats.{attr} = {v!r}")
            except Exception:
                pass

    listeners = get_listeners(artist, client)
    print(f"Слушателей в месяц: {listeners}")

    # --- Треки ---
    tracks_raw = client.artists_tracks(ARTIST_ID)
    if hasattr(tracks_raw, 'tracks'):
        tracks_raw = tracks_raw.tracks

    tracks = []
    for t in tracks_raw or []:
        if len(tracks) >= TRACKS_LIMIT:
            break

        tid = None
        for attr in ('id', 'track_id', 'real_id'):
            v = getattr(t, attr, None)
            if v:
                tid = str(v)
                break

        cover = None
        if t.cover_uri:
            cover = "https://" + t.cover_uri.replace('%%', '400x400')

        tracks.append({
            'id': tid or '',
            'title': t.title,
            'artists': [a.name for a in t.artists] if t.artists else [],
            'duration': f"{t.duration_ms // 60000}:{(t.duration_ms // 1000) % 60:02d}",
            'cover': cover,
        })

    # --- Альбомы ---
    albums_raw = None
    for method_name in ('artists_direct_albums', 'artists_albums'):
        if hasattr(client, method_name):
            try:
                albums_raw = getattr(client, method_name)(ARTIST_ID)
                break
            except Exception:
                continue

    if hasattr(albums_raw, 'albums'):
        albums_raw = albums_raw.albums

    albums = []
    for a in albums_raw or []:
        aid = None
        for attr in ('id', 'album_id', 'real_id'):
            v = getattr(a, attr, None)
            if v:
                aid = str(v)
                break

        cover = None
        if a.cover_uri:
            cover = "https://" + a.cover_uri.replace('%%', '400x400')

        albums.append({
            'id': aid or '',
            'title': a.title,
            'year': a.year,
            'cover': cover,
        })

    avatar = None
    if artist.cover and artist.cover.uri:
        avatar = "https://" + artist.cover.uri.replace('%%', '400x400')

    data = {
        'name': artist.name,
        'listeners': listeners,
        'avatar': avatar,
        'tracks': tracks,
        'albums': albums,
    }

    with open('music-data.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Готово: треков {len(tracks)}, альбомов {len(albums)}, слушателей {listeners}")


if __name__ == '__main__':
    fetch_and_save()
