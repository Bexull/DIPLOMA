"""
OSINT Threat Intelligence фиды.

Загружает и кэширует данные из открытых источников:
  - URLhaus (abuse.ch)  — вредоносные URL
  - OpenPhish           — фишинговые URL
  - Feodo (abuse.ch)    — IP ботнет C&C серверов

Кэш обновляется раз в 30 минут.
"""

import asyncio
import csv
import io
import logging
import time
from dataclasses import dataclass, field
from urllib.parse import urlparse

import aiohttp

logger = logging.getLogger(__name__)

CACHE_TTL = 1800  # 30 минут

# VirusTotal API (бесплатный: 4 запроса/мин, 500/день)
VT_API_KEY = "ab4c2ad3c4e97db57778947f4ad989d683e7f226d56981712926b03025ceec61"


@dataclass
class ThreatMatch:
    source: str          # "URLhaus" | "OpenPhish" | "Feodo"
    indicator: str       # URL или IP который совпал
    threat_type: str     # "malware" | "phishing" | "botnet"
    details: str         # доп. информация


@dataclass
class _FeedCache:
    malicious_urls: set[str] = field(default_factory=set)
    malicious_domains: set[str] = field(default_factory=set)
    malicious_ips: set[str] = field(default_factory=set)
    last_update: float = 0.0
    loading: bool = False


_cache = _FeedCache()


def _extract_domain(url: str) -> str:
    """Извлечь домен из URL."""
    try:
        parsed = urlparse(url if "://" in url else f"https://{url}")
        return (parsed.hostname or "").lower().strip(".")
    except Exception:
        return ""


async def _fetch_text(session: aiohttp.ClientSession, url: str) -> str:
    """Скачать текстовый файл."""
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status == 200:
                return await resp.text(errors="ignore")
    except Exception as e:
        logger.warning(f"Не удалось загрузить {url}: {e}")
    return ""


async def _load_urlhaus(session: aiohttp.ClientSession) -> tuple[set[str], set[str]]:
    """URLhaus — вредоносные URL и домены."""
    urls: set[str] = set()
    domains: set[str] = set()

    text = await _fetch_text(session, "https://urlhaus.abuse.ch/downloads/csv_recent/")
    if not text:
        return urls, domains

    for line in text.split("\n"):
        if not line or line.startswith("#") or line.startswith('"id"'):
            continue
        # CSV: "id","dateadded","url","url_status",...
        try:
            parts = next(csv.reader(io.StringIO(line)))
            if len(parts) >= 3:
                raw_url = parts[2].strip().strip('"')
                urls.add(raw_url.lower())
                domain = _extract_domain(raw_url)
                if domain:
                    domains.add(domain)
        except Exception:
            continue

    logger.info(f"URLhaus: {len(urls)} URL, {len(domains)} доменов")
    return urls, domains


async def _load_openphish(session: aiohttp.ClientSession) -> tuple[set[str], set[str]]:
    """OpenPhish — фишинговые URL."""
    urls: set[str] = set()
    domains: set[str] = set()

    text = await _fetch_text(
        session,
        "https://raw.githubusercontent.com/openphish/public_feed/refs/heads/main/feed.txt",
    )
    if not text:
        return urls, domains

    for line in text.split("\n"):
        line = line.strip()
        if line:
            urls.add(line.lower())
            domain = _extract_domain(line)
            if domain:
                domains.add(domain)

    logger.info(f"OpenPhish: {len(urls)} URL, {len(domains)} доменов")
    return urls, domains


async def _load_phishing_database(session: aiohttp.ClientSession) -> tuple[set[str], set[str]]:
    """Phishing.Database (mitchellkrogza) — ~800K активных фишинговых URL."""
    urls: set[str] = set()
    domains: set[str] = set()

    text = await _fetch_text(
        session,
        "https://raw.githubusercontent.com/mitchellkrogza/Phishing.Database/master/phishing-links-ACTIVE.txt",
    )
    if not text:
        return urls, domains

    for line in text.split("\n"):
        line = line.strip()
        if line and not line.startswith("#"):
            urls.add(line.lower())
            domain = _extract_domain(line)
            if domain:
                domains.add(domain)

    logger.info(f"Phishing.Database: {len(urls)} URL, {len(domains)} доменов")
    return urls, domains


async def _load_feodo(session: aiohttp.ClientSession) -> set[str]:
    """Feodo Tracker — ботнет C&C IP-адреса."""
    ips: set[str] = set()

    text = await _fetch_text(session, "https://feodotracker.abuse.ch/downloads/ipblocklist.csv")
    if not text:
        return ips

    for line in text.split("\n"):
        if not line or line.startswith("#") or line.startswith('"first_seen'):
            continue
        try:
            parts = next(csv.reader(io.StringIO(line)))
            if len(parts) >= 2:
                ip = parts[1].strip().strip('"')
                if ip and ip[0].isdigit():
                    ips.add(ip)
        except Exception:
            continue

    logger.info(f"Feodo: {len(ips)} IP-адресов")
    return ips


async def update_feeds() -> None:
    """Обновить все фиды (вызывается при необходимости)."""
    global _cache

    if _cache.loading:
        return
    _cache.loading = True

    try:
        async with aiohttp.ClientSession(
            headers={"User-Agent": "NetShield-IDS/1.0"}
        ) as session:
            # Параллельная загрузка всех фидов
            urlhaus_task = _load_urlhaus(session)
            openphish_task = _load_openphish(session)
            phishdb_task = _load_phishing_database(session)
            feodo_task = _load_feodo(session)

            (uh_urls, uh_domains), (op_urls, op_domains), (pd_urls, pd_domains), feodo_ips = await asyncio.gather(
                urlhaus_task, openphish_task, phishdb_task, feodo_task,
            )

        _cache.malicious_urls = uh_urls | op_urls | pd_urls
        _cache.malicious_domains = uh_domains | op_domains | pd_domains
        _cache.malicious_ips = feodo_ips
        _cache.last_update = time.time()

        total = len(_cache.malicious_urls) + len(_cache.malicious_ips)
        logger.info(
            f"Threat feeds обновлены: {len(_cache.malicious_urls)} URL, "
            f"{len(_cache.malicious_domains)} доменов, "
            f"{len(_cache.malicious_ips)} IP. Всего индикаторов: {total}"
        )
    except Exception as e:
        logger.error(f"Ошибка обновления фидов: {e}")
    finally:
        _cache.loading = False


async def _ensure_loaded() -> None:
    """Убедиться что фиды загружены и свежие."""
    if time.time() - _cache.last_update > CACHE_TTL:
        await update_feeds()


# Крупные хостинги — домен сам по себе не является угрозой,
# даже если на нём размещён вредоносный контент.
HOSTING_DOMAINS = {
    "github.com", "raw.githubusercontent.com", "githubusercontent.com",
    "gitlab.com", "bitbucket.org",
    "drive.google.com", "docs.google.com", "storage.googleapis.com",
    "dropbox.com", "dl.dropboxusercontent.com",
    "amazonaws.com", "s3.amazonaws.com",
    "discord.com", "cdn.discordapp.com",
    "t.me", "telegram.org",
    "pastebin.com", "paste.ee",
    "mediafire.com", "mega.nz",
    "1drv.ms", "onedrive.live.com",
    "archive.org",
}


async def check_url(url: str) -> list[ThreatMatch]:
    """
    Проверить URL по всем threat-фидам.

    Проверяет:
    1. Полный URL (точное совпадение)
    2. Домен (только если он не из списка крупных хостингов)
    """
    await _ensure_loaded()

    matches: list[ThreatMatch] = []
    url_lower = url.lower().rstrip("/")
    domain = _extract_domain(url)

    # 1. Проверка полного URL
    for cached_url in _cache.malicious_urls:
        if cached_url.rstrip("/") == url_lower:
            matches.append(ThreatMatch(
                source="OSINT фиды",
                indicator=cached_url,
                threat_type="malware/phishing",
                details="Точный URL найден в базе вредоносных/фишинговых ресурсов.",
            ))
            break

    # 2. Проверка домена (исключая крупные хостинги)
    if domain and domain in _cache.malicious_domains:
        # Не фолзим на github.com и подобных
        is_hosting = any(domain == h or domain.endswith("." + h) for h in HOSTING_DOMAINS)
        if not is_hosting:
            matches.append(ThreatMatch(
                source="OSINT фиды",
                indicator=domain,
                threat_type="malicious_domain",
                details=f"Домен {domain} связан с распространением вредоносного ПО или фишингом.",
            ))

    return matches


@dataclass
class VTResult:
    """Результат проверки через VirusTotal."""
    available: bool = False
    malicious: int = 0
    suspicious: int = 0
    harmless: int = 0
    undetected: int = 0
    total_engines: int = 0
    reputation: int = 0
    error: str | None = None


async def check_virustotal(url: str) -> VTResult:
    """Проверить URL через VirusTotal API v3."""
    if not VT_API_KEY:
        return VTResult(error="API ключ не настроен")

    import base64
    url_id = base64.urlsafe_b64encode(url.encode()).decode().rstrip("=")

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"https://www.virustotal.com/api/v3/urls/{url_id}",
                headers={"x-apikey": VT_API_KEY},
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                if resp.status == 404:
                    # URL ещё не проанализирован VT — отправим на анализ
                    async with session.post(
                        "https://www.virustotal.com/api/v3/urls",
                        headers={"x-apikey": VT_API_KEY},
                        data={"url": url},
                        timeout=aiohttp.ClientTimeout(total=10),
                    ) as post_resp:
                        if post_resp.status == 200:
                            return VTResult(
                                available=True,
                                error="URL отправлен на анализ в VirusTotal. Повторите через минуту.",
                            )
                    return VTResult(error="URL не найден в VirusTotal")

                if resp.status == 429:
                    return VTResult(error="Превышен лимит запросов VirusTotal (4/мин)")

                if resp.status != 200:
                    return VTResult(error=f"VirusTotal вернул код {resp.status}")

                data = await resp.json()
                attrs = data.get("data", {}).get("attributes", {})
                stats = attrs.get("last_analysis_stats", {})

                return VTResult(
                    available=True,
                    malicious=stats.get("malicious", 0),
                    suspicious=stats.get("suspicious", 0),
                    harmless=stats.get("harmless", 0),
                    undetected=stats.get("undetected", 0),
                    total_engines=sum(stats.values()),
                    reputation=attrs.get("reputation", 0),
                )
    except asyncio.TimeoutError:
        return VTResult(error="Таймаут VirusTotal API")
    except Exception as e:
        return VTResult(error=f"Ошибка VirusTotal: {str(e)}")


async def check_ip(ip: str) -> list[ThreatMatch]:
    """Проверить IP по фидам."""
    await _ensure_loaded()

    matches: list[ThreatMatch] = []
    if ip in _cache.malicious_ips:
        matches.append(ThreatMatch(
            source="Feodo Tracker",
            indicator=ip,
            threat_type="botnet",
            details=f"IP {ip} идентифицирован как C&C сервер ботнета (Emotet/QakBot и др.).",
        ))
    return matches


def get_feed_stats() -> dict:
    """Статистика загруженных фидов."""
    return {
        "loaded": _cache.last_update > 0,
        "last_update": _cache.last_update,
        "malicious_urls": len(_cache.malicious_urls),
        "malicious_domains": len(_cache.malicious_domains),
        "malicious_ips": len(_cache.malicious_ips),
        "cache_ttl_seconds": CACHE_TTL,
    }
